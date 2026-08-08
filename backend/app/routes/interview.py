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
        if not token:
            return jsonify({"error": "session_token required"}), 400

        session = InterviewSession.query.filter_by(
            session_token=token
        ).first()
        if not session:
            return jsonify({"error": "Invalid session token"}), 404
        if session.candidate_id != user_id:
            return jsonify({"error": "Forbidden"}), 403
        if session.status == "completed":
            return jsonify({"error": "Already completed"}), 400
        if session.status == "disqualified":
            return jsonify({"error": "Disqualified"}), 403

        session.status                 = "in_progress"
        session.started_at             = datetime.utcnow()
        session.current_question_index = 0
        db.session.commit()

        interview = Interview.query.get(session.interview_id)
        return jsonify({
            "message": "Started",
            "session": session.to_dict(),
            "interview": {
                "title":            interview.title,
                "role_name":        interview.role_name,
                "duration_minutes": interview.duration_minutes,
                "total_questions":  interview.total_questions,
                "experience_level": interview.experience_level
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@interview_bp.route("/session/<token>", methods=["GET"])
@jwt_required()
def get_session(token):
    try:
        user_id  = int(get_jwt_identity())
        user     = User.query.get(user_id)
        session  = InterviewSession.query.filter_by(
            session_token=token
        ).first()
        if not session:
            return jsonify({"error": "Not found"}), 404
        if user.role == "candidate" and session.candidate_id != user_id:
            return jsonify({"error": "Forbidden"}), 403

        interview = Interview.query.get(session.interview_id)
        return jsonify({
            "session":   session.to_dict(),
            "interview": interview.to_dict() if interview else {}
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@interview_bp.route("/session/<token>/next-question", methods=["GET"])
@jwt_required()
def next_question(token):
    try:
        user_id = int(get_jwt_identity())
        session = InterviewSession.query.filter_by(
            session_token=token
        ).first()
        if not session:
            return jsonify({"error": "Not found"}), 404
        if session.candidate_id != user_id:
            return jsonify({"error": "Forbidden"}), 403
        if session.status != "in_progress":
            return jsonify({"error": "Session is " + session.status}), 400

        interview = Interview.query.get(session.interview_id)
        q_index   = session.current_question_index
        total     = interview.total_questions

        if q_index >= total:
            return jsonify({"complete": True, "message": "Complete"}), 200

        # Check if already generated
        existing = Question.query.filter_by(
            session_id=session.id,
            order_index=q_index
        ).first()
        if existing:
            return jsonify({
                "complete":        False,
                "question":        existing.to_dict(),
                "question_number": q_index + 1,
                "total_questions": total
            }), 200

        # Generate question with AI
        question_text = None
        q_type        = "technical"
        diff          = "medium"

        # Determine question type
        if q_index == 0:
            q_type = "intro"
        elif q_index == total - 1:
            q_type = "closing"
        else:
            progress = q_index / max(total, 1)
            q_type   = "behavioral" if progress < 0.2 or progress > 0.8 else "technical"

        # Get topics for difficulty
        topics = [t for t in interview.topics if t.is_approved]
        if not topics:
            topics = list(interview.topics)
        if topics:
            idx  = min(int((q_index / max(total, 1)) * len(topics)), len(topics) - 1)
            diff = topics[idx].difficulty if topics else "medium"

        # Try AI generation
        try:
            from app.services.question_engine import get_question_engine
            qe = get_question_engine()
            result, error = qe.get_next_question(session.id)
            if error and error != "Interview complete":
                raise Exception(error)
            if error == "Interview complete":
                return jsonify({"complete": True}), 200
            return jsonify({
                "complete":        False,
                "question":        result,
                "question_number": q_index + 1,
                "total_questions": total
            }), 200
        except Exception as e:
            print("[Interview] AI question failed: " + str(e))
            # Use fallback question
            question_text = _get_fallback_question(
                q_index, total, interview.role_name,
                interview.experience_level, topics
            )

        # Save fallback question
        question = Question(
            interview_id=interview.id,
            session_id=session.id,
            question_text=question_text,
            question_type=q_type,
            difficulty=diff,
            order_index=q_index,
            asked_at=datetime.utcnow()
        )
        db.session.add(question)
        db.session.commit()

        return jsonify({
            "complete":        False,
            "question":        question.to_dict(),
            "question_number": q_index + 1,
            "total_questions": total
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


def _get_fallback_question(q_index, total, role_name,
                            experience_level, topics):
    """Fast fallback questions when AI is unavailable."""
    import random

    if q_index == 0:
        return (
            "Hello! Welcome to your interview. I'm Alex, your AI interviewer. "
            "Could you please start by introducing yourself and telling me "
            "about your background and experience?"
        )

    if q_index == total - 1:
        return (
            "We're nearing the end of our interview. "
            "Do you have any questions for us about the role or the team?"
        )

    topic_name = "general topics"
    if topics:
        idx        = min(int((q_index / max(total, 1)) * len(topics)), len(topics) - 1)
        topic_name = topics[idx].topic_name if topics else "general topics"

    progress = q_index / max(total, 1)

    easy_questions = [
        f"Can you tell me about your experience with {topic_name}?",
        f"How long have you been working with {topic_name}?",
        f"What do you enjoy most about working as a {role_name}?",
        f"How would you describe your skill level in {topic_name}?",
    ]
    medium_questions = [
        f"Can you walk me through a project where you used {topic_name}?",
        f"How do you approach problem-solving in {topic_name}?",
        f"What tools or frameworks do you use for {topic_name}?",
        f"Describe a challenging situation you faced related to {topic_name} and how you resolved it.",
        f"How do you stay updated with the latest trends in {topic_name}?",
    ]
    hard_questions = [
        f"Can you explain the architecture of a complex system you built involving {topic_name}?",
        f"How would you optimize performance in a system using {topic_name}?",
        f"Describe your approach to debugging complex issues in {topic_name}.",
        f"How do you ensure code quality and best practices in {topic_name}?",
        f"What are the trade-offs you consider when designing solutions with {topic_name}?",
    ]

    behavioral_questions = [
        "Tell me about a time you had to work under pressure. How did you handle it?",
        "Describe a situation where you had to learn a new technology quickly.",
        "Tell me about a time you disagreed with a team member. How did you resolve it?",
        "How do you prioritize tasks when working on multiple projects simultaneously?",
        "Describe your experience working in an Agile or Scrum environment.",
    ]

    if progress < 0.2 or progress > 0.8:
        return random.choice(behavioral_questions)
    elif progress < 0.5:
        return random.choice(easy_questions + medium_questions)
    else:
        return random.choice(medium_questions + hard_questions)


@interview_bp.route("/session/<token>/answer", methods=["POST"])
@jwt_required()
def submit_answer(token):
    try:
        user_id = int(get_jwt_identity())
        session = InterviewSession.query.filter_by(
            session_token=token
        ).first()
        if not session:
            return jsonify({"error": "Not found"}), 404
        if session.candidate_id != user_id:
            return jsonify({"error": "Forbidden"}), 403
        if session.status != "in_progress":
            return jsonify({"error": "Session not active"}), 400

        data        = request.get_json() or {}
        answer_text = data.get("answer_text", "").strip()
        question_id = data.get("question_id")
        duration    = int(data.get("duration_seconds", 30))

        if not answer_text:
            return jsonify({"error": "Answer text required"}), 400
        if not question_id:
            return jsonify({"error": "question_id required"}), 400

        # Idempotency check
        existing = Answer.query.filter_by(
            session_id=session.id,
            question_id=question_id
        ).first()
        if existing:
            from app.services.question_engine import get_question_engine
            get_question_engine().advance_question(session.id)
            return jsonify({
                "message": "Already answered",
                "answer":  existing.to_dict(),
                "next_question_index": session.current_question_index
            }), 200

        # Check timing
        try:
            from app.services.cheat_detector import get_cheat_detector
            cd = get_cheat_detector()
            is_fast, sev = cd.analyze_answer_timing(answer_text, duration)
            if is_fast:
                cd.log_cheat_event(
                    session_id=session.id,
                    cheat_type="fast_answer",
                    severity=sev,
                    description="Answer in " + str(duration) + "s"
                )
        except Exception:
            pass

        # Score answer (async - don't block)
        answer = None
        try:
            from app.services.scoring_engine import get_scoring_engine
            se = get_scoring_engine()
            answer_dict, error = se.score_answer(
                session_id=session.id,
                question_id=question_id,
                answer_text=answer_text
            )
            if answer_dict:
                answer = answer_dict
        except Exception as e:
            print("[Interview] Score error: " + str(e))
            # Save answer without score
            from datetime import datetime
            ans = Answer(
                session_id=session.id,
                question_id=question_id,
                answer_text=answer_text,
                ai_score=5.0,
                relevance_score=5.0,
                clarity_score=5.0,
                depth_score=5.0,
                ai_feedback="Answer recorded.",
                submitted_at=datetime.utcnow()
            )
            db.session.add(ans)
            db.session.commit()
            answer = ans.to_dict()

        # Advance question
        from app.services.question_engine import get_question_engine
        get_question_engine().advance_question(session.id)

        return jsonify({
            "message":              "Submitted",
            "answer":               answer,
            "next_question_index":  session.current_question_index
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@interview_bp.route("/session/<token>/end", methods=["POST"])
@jwt_required()
def end_session(token):
    try:
        user_id = int(get_jwt_identity())
        session = InterviewSession.query.filter_by(
            session_token=token
        ).first()
        if not session:
            return jsonify({"error": "Not found"}), 404
        if session.candidate_id != user_id:
            return jsonify({"error": "Forbidden"}), 403

        if session.status == "completed":
            return jsonify({
                "message":    "Already complete",
                "session_id": session.id,
                "score":      session.total_score,
                "grade":      "N/A"
            }), 200

        session.status   = "completed"
        session.ended_at = datetime.utcnow()
        db.session.commit()

        # Calculate score
        final_score = 0.0
        grade       = "F"
        breakdown   = {}
        try:
            from app.services.scoring_engine import get_scoring_engine
            se = get_scoring_engine()
            final_score, grade, breakdown = se.calculate_session_score(session.id)
            se.calculate_percentile(session.id)
        except Exception as e:
            print("[Interview] Score error: " + str(e))

        # Generate report in background
        try:
            import threading
            def gen_report():
                try:
                    from app.services.report_generator import get_report_generator
                    with db.engine.connect():
                        pass
                    from app import create_app
                    rg = get_report_generator()
                    rg.generate_report(session.id)
                except Exception as e:
                    print("[Report] Background error: " + str(e))
            threading.Thread(target=gen_report, daemon=True).start()
        except Exception:
            pass

        return jsonify({
            "message":    "Complete",
            "session_id": session.id,
            "score":      final_score,
            "grade":      grade,
            "breakdown":  breakdown
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@interview_bp.route("/session/<token>/cheat-event", methods=["POST"])
@jwt_required()
def log_cheat(token):
    try:
        user_id = int(get_jwt_identity())
        session = InterviewSession.query.filter_by(
            session_token=token
        ).first()
        if not session or session.candidate_id != user_id:
            return jsonify({"error": "Forbidden"}), 403

        data = request.get_json() or {}
        from app.services.cheat_detector import get_cheat_detector
        cd = get_cheat_detector()
        log, disq, cheat_score = cd.log_cheat_event(
            session_id=session.id,
            cheat_type=data.get("cheat_type", "unknown"),
            severity=data.get("severity", "medium"),
            description=data.get("description", "")
        )
        return jsonify({
            "logged":            True,
            "cheat_score":       cheat_score,
            "should_disqualify": disq
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@interview_bp.route("/session/<token>/status", methods=["GET"])
@jwt_required()
def session_status(token):
    try:
        session = InterviewSession.query.filter_by(
            session_token=token
        ).first()
        if not session:
            return jsonify({"error": "Not found"}), 404
        from app.services.cheat_detector import get_cheat_detector
        cd      = get_cheat_detector()
        summary = cd.get_cheat_summary(session.id)
        return jsonify({
            "session":       session.to_dict(),
            "cheat_summary": summary
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@interview_bp.route("/session/<token>/ai-respond", methods=["POST"])
@jwt_required()
def ai_respond(token):
    try:
        user_id  = int(get_jwt_identity())
        session  = InterviewSession.query.filter_by(
            session_token=token
        ).first()
        if not session or session.candidate_id != user_id:
            return jsonify({"error": "Forbidden"}), 403

        data     = request.get_json() or {}
        question = data.get("question", "")
        if not question:
            return jsonify({"response": "Thank you for your question!"}), 200

        interview    = Interview.query.get(session.interview_id)
        company_name = "the company"
        try:
            if interview and interview.company:
                company_name = interview.company.company_name
        except Exception:
            pass

        try:
            import requests as req
            import os
            api_key = os.environ.get("GROQ_API_KEY", "")
            resp = req.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": "Bearer " + api_key,
                    "Content-Type":  "application/json"
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [
                        {"role": "system",
                         "content": "You are Alex, AI interviewer at " +
                                    company_name + ". Answer candidate questions briefly (2-3 sentences)."},
                        {"role": "user",
                         "content": "Candidate asks: " + question}
                    ],
                    "max_tokens":  150,
                    "temperature": 0.7
                },
                timeout=30
            )
            if resp.status_code == 200:
                answer = resp.json()["choices"][0]["message"]["content"]
                return jsonify({"response": answer}), 200
        except Exception as e:
            print("[AI Respond] Error: " + str(e))

        return jsonify({
            "response": "Great question! The team will discuss this with you. "
                        "Thank you for your curiosity!"
        }), 200

    except Exception as e:
        return jsonify({
            "response": "Thank you for your question!"
        }), 200