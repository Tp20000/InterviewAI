import json
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user      import User
from app.models.report    import Report
from app.models.session   import InterviewSession
from app.models.answer    import Answer
from app.models.question  import Question
from app.models.cheat_log import CheatLog
from app.models.interview import Interview, Company

report_bp = Blueprint("report", __name__)


def _check_permission(user, session, interview):
    """
    Returns True if user can access this report.
    Fixes the crash where user.company.id was used directly.
    """
    if user.role == "admin":
        return True
    if user.role == "candidate":
        return session.candidate_id == user.id
    if user.role == "company":
        # Safely get company via Company model
        company = Company.query.filter_by(user_id=user.id).first()
        if not company:
            return False
        return interview.company_id == company.id
    return False


@report_bp.route("/session/<int:session_id>", methods=["GET"])
@jwt_required()
def get_session_report(session_id):
    try:
        user_id  = int(get_jwt_identity())
        user     = User.query.get(user_id)
        session  = InterviewSession.query.get(session_id)

        if not session:
            return jsonify({"error": "Session not found"}), 404

        interview = Interview.query.get(session.interview_id)
        if not interview:
            return jsonify({"error": "Interview not found"}), 404

        # FIXED: Use safe permission check instead of user.company.id
        if not _check_permission(user, session, interview):
            return jsonify({"error": "Forbidden"}), 403

        report    = Report.query.filter_by(session_id=session_id).first()
        answers   = Answer.query.filter_by(session_id=session_id).all()
        cheats    = CheatLog.query.filter_by(session_id=session_id).all()
        candidate = User.query.get(session.candidate_id)

        qa_list = []
        for ans in answers:
            q = Question.query.get(ans.question_id)
            qa_list.append({
                "question":        q.question_text if q else "",
                "question_type":   q.question_type if q else "",
                "answer":          ans.answer_text,
                "ai_score":        ans.ai_score,
                "relevance_score": ans.relevance_score,
                "clarity_score":   ans.clarity_score,
                "depth_score":     ans.depth_score,
                "feedback":        ans.ai_feedback,
                "is_ai_generated": ans.is_ai_generated,
                "duration":        ans.duration_seconds
            })

        from app.services.scoring_engine import ScoringEngine
        se    = ScoringEngine()
        grade = se._calculate_grade(session.total_score or 0)

        return jsonify({
            "session":    session.to_dict(),
            "candidate":  candidate.to_dict() if candidate else {},
            "interview":  interview.to_dict() if interview else {},
            "report":     report.to_dict() if report else None,
            "qa_pairs":   qa_list,
            "cheat_logs": [c.to_dict() for c in cheats],
            "summary": {
                "total_score":   session.total_score,
                "grade":         grade,
                "percentile":    session.percentile,
                "cheat_score":   session.cheat_score,
                "total_answers": len(answers),
                "cheat_events":  len(cheats)
            }
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@report_bp.route("/session/<int:session_id>/generate", methods=["POST"])
@jwt_required()
def generate_report(session_id):
    try:
        from app.services.report_generator import get_report_generator
        from app.services.scoring_engine   import get_scoring_engine

        se = get_scoring_engine()
        se.calculate_session_score(session_id)

        rg     = get_report_generator()
        report, error = rg.generate_report(session_id)

        if error:
            return jsonify({"error": error}), 500

        return jsonify({
            "message": "Report generated",
            "report":  report.to_dict()
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@report_bp.route("/interview/<int:interview_id>/ranking", methods=["GET"])
@jwt_required()
def get_ranking(interview_id):
    try:
        from app.services.scoring_engine import get_scoring_engine
        se       = get_scoring_engine()
        rankings = se.get_interview_rankings(interview_id)
        return jsonify({"rankings": rankings, "total": len(rankings)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500