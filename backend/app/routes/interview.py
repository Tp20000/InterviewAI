from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app import db
from app.models.user      import User
from app.models.session   import InterviewSession
from app.models.interview import Interview
from app.models.answer    import Answer
from app.models.question  import Question

interview_bp = Blueprint("interview", __name__)


@interview_bp.route("/session/start", methods=["POST"])
@jwt_required()
def start_session():
    try:
        user_id = int(get_jwt_identity())
        data    = request.get_json() or {}
        token   = data.get("session_token", "")
        if not token: return jsonify({"error": "session_token required"}), 400
        session = InterviewSession.query.filter_by(session_token=token).first()
        if not session: return jsonify({"error": "Invalid session token"}), 404
        if session.candidate_id != user_id: return jsonify({"error": "Forbidden"}), 403
        if session.status == "completed": return jsonify({"error": "Already completed"}), 400
        if session.status == "disqualified": return jsonify({"error": "Disqualified"}), 403
        session.status     = "in_progress"
        session.started_at = datetime.utcnow()
        session.current_question_index = 0
        db.session.commit()
        interview = Interview.query.get(session.interview_id)
        return jsonify({"message": "Started", "session": session.to_dict(),
            "interview": {"title": interview.title, "role_name": interview.role_name,
                "duration_minutes": interview.duration_minutes, "total_questions": interview.total_questions,
                "experience_level": interview.experience_level}}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@interview_bp.route("/session/<token>", methods=["GET"])
@jwt_required()
def get_session(token):
    try:
        user_id = int(get_jwt_identity())
        user    = User.query.get(user_id)
        session = InterviewSession.query.filter_by(session_token=token).first()
        if not session: return jsonify({"error": "Not found"}), 404
        if user.role == "candidate" and session.candidate_id != user_id: return jsonify({"error": "Forbidden"}), 403
        interview = Interview.query.get(session.interview_id)
        return jsonify({"session": session.to_dict(), "interview": interview.to_dict() if interview else {}}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@interview_bp.route("/session/<token>/next-question", methods=["GET"])
@jwt_required()
def next_question(token):
    try:
        user_id = int(get_jwt_identity())
        session = InterviewSession.query.filter_by(session_token=token).first()
        if not session: return jsonify({"error": "Not found"}), 404
        if session.candidate_id != user_id: return jsonify({"error": "Forbidden"}), 403
        if session.status != "in_progress": return jsonify({"error": "Session is " + session.status}), 400
        from app.services.question_engine import get_question_engine
        qe = get_question_engine()
        question, error = qe.get_next_question(session.id)
        if error == "Interview complete":
            return jsonify({"complete": True, "message": "Complete"}), 200
        if error:
            return jsonify({"error": error}), 500
        interview = Interview.query.get(session.interview_id)
        return jsonify({"complete": False, "question": question,
            "question_number": session.current_question_index + 1,
            "total_questions": interview.total_questions}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@interview_bp.route("/session/<token>/answer", methods=["POST"])
@jwt_required()
def submit_answer(token):
    try:
        user_id = int(get_jwt_identity())
        session = InterviewSession.query.filter_by(session_token=token).first()
        if not session: return jsonify({"error": "Not found"}), 404
        if session.candidate_id != user_id: return jsonify({"error": "Forbidden"}), 403
        if session.status != "in_progress": return jsonify({"error": "Session not active"}), 400

        data        = request.get_json() or {}
        answer_text = data.get("answer_text", "").strip()
        question_id = data.get("question_id")
        duration    = int(data.get("duration_seconds", 30))

        if not answer_text: return jsonify({"error": "Answer text required"}), 400
        if not question_id: return jsonify({"error": "question_id required"}), 400

        # IDEMPOTENCY: Check if already answered this question
        existing = Answer.query.filter_by(session_id=session.id, question_id=question_id).first()
        if existing:
            # Already answered - just advance and return
            from app.services.question_engine import get_question_engine
            qe = get_question_engine()
            qe.advance_question(session.id)
            return jsonify({"message": "Already answered", "answer": existing.to_dict(),
                "next_question_index": session.current_question_index}), 200

        # Check timing
        from app.services.cheat_detector import get_cheat_detector
        cd = get_cheat_detector()
        is_fast, sev = cd.analyze_answer_timing(answer_text, duration)
        if is_fast:
            cd.log_cheat_event(session_id=session.id, cheat_type="fast_answer",
                severity=sev, description="Answer submitted in " + str(duration) + "s")

        # Score the answer
        from app.services.scoring_engine import get_scoring_engine
        se = get_scoring_engine()
        answer_dict, error = se.score_answer(session_id=session.id, question_id=question_id, answer_text=answer_text)
        if error: return jsonify({"error": error}), 500

        # Advance question
        from app.services.question_engine import get_question_engine
        qe = get_question_engine()
        qe.advance_question(session.id)

        # Notify company in real-time
        try:
            from app import socketio
            iv = Interview.query.get(session.interview_id)
            if iv:
                socketio.emit("interview_update", {
                    "type": "answer_submitted",
                    "session_id": session.id,
                    "question_index": session.current_question_index
                }, room="interview_" + str(iv.id))
        except Exception:
            pass

        return jsonify({"message": "Submitted", "answer": answer_dict,
            "next_question_index": session.current_question_index}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@interview_bp.route("/session/<token>/end", methods=["POST"])
@jwt_required()
def end_session(token):
    try:
        user_id = int(get_jwt_identity())
        session = InterviewSession.query.filter_by(session_token=token).first()
        if not session: return jsonify({"error": "Not found"}), 404
        if session.candidate_id != user_id: return jsonify({"error": "Forbidden"}), 403
        if session.status == "completed":
            return jsonify({"message": "Already complete", "session_id": session.id,
                "score": session.total_score, "grade": "N/A"}), 200
        session.status   = "completed"
        session.ended_at = datetime.utcnow()
        db.session.commit()
        from app.services.scoring_engine import get_scoring_engine
        se = get_scoring_engine()
        final_score, grade, breakdown = se.calculate_session_score(session.id)
        percentile = se.calculate_percentile(session.id)
        from app.services.report_generator import get_report_generator
        rg = get_report_generator()
        report, _ = rg.generate_report(session.id)
        # Notify company
        try:
            from app import socketio
            iv = Interview.query.get(session.interview_id)
            candidate = User.query.get(session.candidate_id)
            if iv:
                socketio.emit("interview_update", {
                    "type": "interview_completed",
                    "session_id": session.id,
                    "candidate_name": candidate.full_name if candidate else "Unknown",
                    "score": final_score, "grade": grade
                }, room="interview_" + str(iv.id))
        except Exception:
            pass
        return jsonify({"message": "Complete", "session_id": session.id,
            "score": final_score, "grade": grade, "percentile": percentile,
            "breakdown": breakdown, "report_id": report.id if report else None}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@interview_bp.route("/session/<token>/cheat-event", methods=["POST"])
@jwt_required()
def log_cheat(token):
    try:
        user_id = int(get_jwt_identity())
        session = InterviewSession.query.filter_by(session_token=token).first()
        if not session or session.candidate_id != user_id: return jsonify({"error": "Forbidden"}), 403
        data = request.get_json() or {}
        from app.services.cheat_detector import get_cheat_detector
        cd = get_cheat_detector()
        log, disq, cheat_score = cd.log_cheat_event(
            session_id=session.id, cheat_type=data.get("cheat_type","unknown"),
            severity=data.get("severity","medium"), description=data.get("description",""))
        return jsonify({"logged": True, "cheat_score": cheat_score,
            "should_disqualify": disq, "warning_message": "Multiple violations!" if cheat_score > 40 else ""}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@interview_bp.route("/session/<token>/status", methods=["GET"])
@jwt_required()
def session_status(token):
    try:
        session = InterviewSession.query.filter_by(session_token=token).first()
        if not session: return jsonify({"error": "Not found"}), 404
        from app.services.cheat_detector import get_cheat_detector
        cd = get_cheat_detector()
        summary = cd.get_cheat_summary(session.id)
        return jsonify({"session": session.to_dict(), "cheat_summary": summary}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@interview_bp.route("/session/<token>/ai-respond", methods=["POST"])
@jwt_required()
def ai_respond(token):
    try:
        user_id = int(get_jwt_identity())
        session = InterviewSession.query.filter_by(session_token=token).first()
        if not session or session.candidate_id != user_id: return jsonify({"error": "Forbidden"}), 403
        data     = request.get_json() or {}
        question = data.get("question", "")
        if not question: return jsonify({"response": "Thank you!"}), 200
        interview = Interview.query.get(session.interview_id)
        company_name = "our company"
        try:
            if interview and interview.company: company_name = interview.company.company_name
        except Exception: pass
        from app.services.ai_interviewer import get_ai_interviewer
        ai = get_ai_interviewer()
        messages = [
            {"role": "system", "content": "You are Alex, AI interviewer at " + company_name + " for " + (interview.role_name if interview else "the role") + ". Candidate asked a question. Answer helpfully in 2-3 sentences."},
            {"role": "user",   "content": "Candidate asks: " + question}
        ]
        response = ai._chat(messages, temperature=0.7, max_tokens=200)
        return jsonify({"response": response}), 200
    except Exception as e:
        return jsonify({"response": "Great question! The team will discuss this further. Thank you!"}), 200