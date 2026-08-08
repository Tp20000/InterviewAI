from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app import db
from app.models.user      import User
from app.models.interview import Company, Interview, InterviewTopic
from app.models.session   import InterviewSession

company_bp = Blueprint("company", __name__)


def get_company_for_user(user_id):
    """
    Get company profile for user.
    Auto-creates it if missing (handles production DB resets).
    """
    user = User.query.get(user_id)
    if not user:
        return None, None, "User not found", 404
    if user.role != "company":
        return None, None, "Company access required. Your role is: " + user.role, 403

    company = Company.query.filter_by(user_id=user_id).first()
    if not company:
        # Auto-create company profile
        company = Company(
            user_id=user_id,
            company_name=user.full_name + " Company",
            industry="Technology",
            website=""
        )
        db.session.add(company)
        try:
            db.session.commit()
            print("[Company] Auto-created profile for user: " + user.email)
        except Exception as e:
            db.session.rollback()
            return None, None, "Failed to create company profile: " + str(e), 500

    return user, company, None, None


# ── DASHBOARD ────────────────────────────────────────────────
@company_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard():
    try:
        user_id = int(get_jwt_identity())
        user, company, err, code = get_company_for_user(user_id)
        if err:
            return jsonify({"error": err}), code

        interviews = Interview.query.filter_by(company_id=company.id).all()
        total_sessions = 0
        completed      = 0
        for iv in interviews:
            sessions        = InterviewSession.query.filter_by(interview_id=iv.id).all()
            total_sessions += len(sessions)
            completed      += len([s for s in sessions if s.status == "completed"])

        return jsonify({
            "company": company.to_dict(),
            "stats": {
                "total_interviews":    len(interviews),
                "active_interviews":   len([i for i in interviews if i.status == "active"]),
                "total_candidates":    total_sessions,
                "completed_interviews": completed
            },
            "recent_interviews": [i.to_dict() for i in interviews[-5:]]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── LIST INTERVIEWS ──────────────────────────────────────────
@company_bp.route("/interviews", methods=["GET"])
@jwt_required()
def list_interviews():
    try:
        user_id = int(get_jwt_identity())
        user, company, err, code = get_company_for_user(user_id)
        if err:
            return jsonify({"error": err}), code

        interviews = Interview.query.filter_by(
            company_id=company.id
        ).order_by(Interview.created_at.desc()).all()

        result = []
        for iv in interviews:
            d          = iv.to_dict()
            sessions   = InterviewSession.query.filter_by(interview_id=iv.id).all()
            d["candidate_count"] = len(sessions)
            d["completed_count"] = len([s for s in sessions if s.status == "completed"])
            result.append(d)

        return jsonify({"interviews": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── CREATE INTERVIEW ─────────────────────────────────────────
@company_bp.route("/interviews", methods=["POST"])
@jwt_required()
def create_interview():
    try:
        user_id = int(get_jwt_identity())
        user, company, err, code = get_company_for_user(user_id)
        if err:
            return jsonify({"error": err}), code

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        required = ["title", "job_description", "role_name"]
        missing  = [f for f in required if not data.get(f)]
        if missing:
            return jsonify({"error": "Missing fields: " + str(missing)}), 400

        interview = Interview(
            company_id=company.id,
            title=data["title"].strip(),
            job_description=data["job_description"].strip(),
            role_name=data["role_name"].strip(),
            experience_level=data.get("experience_level", "mid"),
            duration_minutes=int(data.get("duration_minutes", 45)),
            total_questions=int(data.get("total_questions", 10)),
            status="draft",
            created_at=datetime.utcnow()
        )
        db.session.add(interview)
        db.session.commit()

        return jsonify({
            "message":   "Interview created",
            "interview": interview.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── GET SINGLE INTERVIEW ─────────────────────────────────────
@company_bp.route("/interviews/<int:interview_id>", methods=["GET"])
@jwt_required()
def get_interview(interview_id):
    try:
        user_id   = int(get_jwt_identity())
        user      = User.query.get(user_id)
        interview = Interview.query.get(interview_id)

        if not interview:
            return jsonify({"error": "Interview not found"}), 404

        if user.role == "company":
            company = Company.query.filter_by(user_id=user_id).first()
            if not company or interview.company_id != company.id:
                return jsonify({"error": "Forbidden"}), 403

        return jsonify({"interview": interview.to_dict()}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── UPDATE INTERVIEW ─────────────────────────────────────────
@company_bp.route("/interviews/<int:interview_id>", methods=["PUT"])
@jwt_required()
def update_interview(interview_id):
    try:
        user_id  = int(get_jwt_identity())
        user, company, err, code = get_company_for_user(user_id)
        if err:
            return jsonify({"error": err}), code

        interview = Interview.query.get(interview_id)
        if not interview:
            return jsonify({"error": "Not found"}), 404
        if interview.company_id != company.id:
            return jsonify({"error": "Forbidden"}), 403
        if interview.status not in ["draft", "topics_review"]:
            return jsonify({"error": "Cannot edit active interview"}), 400

        data = request.get_json() or {}
        if data.get("title"):            interview.title            = data["title"]
        if data.get("job_description"):  interview.job_description  = data["job_description"]
        if data.get("role_name"):        interview.role_name        = data["role_name"]
        if data.get("experience_level"): interview.experience_level = data["experience_level"]
        if data.get("duration_minutes"): interview.duration_minutes = int(data["duration_minutes"])
        if data.get("total_questions"):  interview.total_questions  = int(data["total_questions"])

        db.session.commit()
        return jsonify({"message": "Updated", "interview": interview.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── DELETE INTERVIEW ─────────────────────────────────────────
@company_bp.route("/interviews/<int:interview_id>", methods=["DELETE"])
@jwt_required()
def delete_interview(interview_id):
    try:
        user_id  = int(get_jwt_identity())
        user, company, err, code = get_company_for_user(user_id)
        if err:
            return jsonify({"error": err}), code

        interview = Interview.query.get(interview_id)
        if not interview:
            return jsonify({"error": "Not found"}), 404
        if interview.company_id != company.id:
            return jsonify({"error": "Forbidden"}), 403
        if interview.status != "draft":
            return jsonify({"error": "Only draft interviews can be deleted"}), 400

        db.session.delete(interview)
        db.session.commit()
        return jsonify({"message": "Deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── GENERATE TOPICS ──────────────────────────────────────────
@company_bp.route("/interviews/<int:interview_id>/generate-topics", methods=["POST"])
@jwt_required()
def generate_topics(interview_id):
    try:
        user_id  = int(get_jwt_identity())
        user, company, err, code = get_company_for_user(user_id)
        if err:
            return jsonify({"error": err}), code

        interview = Interview.query.get(interview_id)
        if not interview or interview.company_id != company.id:
            return jsonify({"error": "Not found or forbidden"}), 403

        from app.services.topic_generator import get_topic_generator
        gen    = get_topic_generator()
        result = gen.generate_topics(
            job_description=interview.job_description,
            role_name=interview.role_name,
            experience_level=interview.experience_level,
            total_questions=interview.total_questions
        )

        # Delete old topics
        InterviewTopic.query.filter_by(interview_id=interview_id).delete()

        # Save new topics
        saved = []
        for t in result["topics"]:
            topic = InterviewTopic(
                interview_id=interview_id,
                topic_name=t.get("topic_name", "General"),
                weightage=int(t.get("weightage", 10)),
                difficulty=t.get("difficulty", "medium"),
                is_approved=False,
                order_index=int(t.get("order_index", 0))
            )
            db.session.add(topic)
            saved.append(topic)

        interview.status = "topics_review"
        db.session.commit()

        return jsonify({
            "message": "Topics generated",
            "topics":  [t.to_dict() for t in saved],
            "summary": result.get("summary", "")
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── UPDATE TOPICS ────────────────────────────────────────────
@company_bp.route("/interviews/<int:interview_id>/topics", methods=["PUT"])
@jwt_required()
def update_topics(interview_id):
    try:
        user_id  = int(get_jwt_identity())
        user, company, err, code = get_company_for_user(user_id)
        if err:
            return jsonify({"error": err}), code

        interview = Interview.query.get(interview_id)
        if not interview or interview.company_id != company.id:
            return jsonify({"error": "Not found or forbidden"}), 403

        data   = request.get_json() or {}
        topics = data.get("topics", [])

        for t_data in topics:
            topic = InterviewTopic.query.get(t_data.get("id"))
            if topic and topic.interview_id == interview_id:
                if t_data.get("topic_name"):
                    topic.topic_name = t_data["topic_name"]
                if t_data.get("weightage") is not None:
                    topic.weightage = int(t_data["weightage"])
                if t_data.get("difficulty"):
                    topic.difficulty = t_data["difficulty"]
                if "is_approved" in t_data:
                    topic.is_approved = t_data["is_approved"]

        db.session.commit()
        updated = InterviewTopic.query.filter_by(interview_id=interview_id).all()
        return jsonify({"topics": [t.to_dict() for t in updated]}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── APPROVE INTERVIEW ────────────────────────────────────────
@company_bp.route("/interviews/<int:interview_id>/approve", methods=["POST"])
@jwt_required()
def approve_interview(interview_id):
    try:
        user_id  = int(get_jwt_identity())
        user, company, err, code = get_company_for_user(user_id)
        if err:
            return jsonify({"error": err}), code

        interview = Interview.query.get(interview_id)
        if not interview or interview.company_id != company.id:
            return jsonify({"error": "Not found or forbidden"}), 403

        topics = InterviewTopic.query.filter_by(interview_id=interview_id).all()
        if not topics:
            return jsonify({"error": "Generate topics first"}), 400

        for t in topics:
            t.is_approved = True

        interview.status      = "active"
        interview.approved_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            "message":   "Interview activated",
            "interview": interview.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── INVITE CANDIDATE ─────────────────────────────────────────
@company_bp.route("/interviews/<int:interview_id>/invite", methods=["POST"])
@jwt_required()
def invite_candidate(interview_id):
    try:
        user_id  = int(get_jwt_identity())
        user, company, err, code = get_company_for_user(user_id)
        if err:
            return jsonify({"error": err}), code

        interview = Interview.query.get(interview_id)
        if not interview or interview.company_id != company.id:
            return jsonify({"error": "Not found or forbidden"}), 403
        if interview.status != "active":
            return jsonify({"error": "Interview must be active to invite candidates"}), 400

        data  = request.get_json() or {}
        email = data.get("email", "").strip().lower()
        if not email:
            return jsonify({"error": "Candidate email required"}), 400

        candidate = User.query.filter_by(email=email, role="candidate").first()
        if not candidate:
            return jsonify({"error": "No candidate found with email: " + email}), 404

        existing = InterviewSession.query.filter_by(
            interview_id=interview_id,
            candidate_id=candidate.id
        ).first()
        if existing:
            return jsonify({
                "message":       "Already invited",
                "session_token": existing.session_token
            }), 200

        session = InterviewSession(
            interview_id=interview_id,
            candidate_id=candidate.id,
            status="scheduled"
        )
        db.session.add(session)
        db.session.commit()

        # Notify candidate
        try:
            from app import socketio
            socketio.emit("new_invitation", {
                "interview_title": interview.title,
                "role_name":       interview.role_name,
                "session_token":   session.session_token,
                "company_name":    company.company_name
            }, room="user_" + str(candidate.id))
        except Exception:
            pass

        return jsonify({
            "message":       "Invited " + candidate.full_name,
            "session_token": session.session_token,
            "candidate":     candidate.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── GET CANDIDATES ───────────────────────────────────────────
@company_bp.route("/interviews/<int:interview_id>/candidates", methods=["GET"])
@jwt_required()
def get_candidates(interview_id):
    try:
        user_id  = int(get_jwt_identity())
        user, company, err, code = get_company_for_user(user_id)
        if err:
            return jsonify({"error": err}), code

        interview = Interview.query.get(interview_id)
        if not interview or interview.company_id != company.id:
            return jsonify({"error": "Not found or forbidden"}), 403

        sessions   = InterviewSession.query.filter_by(interview_id=interview_id).all()
        candidates = []
        for s in sessions:
            candidate = User.query.get(s.candidate_id)
            candidates.append({
                "session_id":    s.id,
                "session_token": s.session_token,
                "status":        s.status,
                "total_score":   s.total_score,
                "cheat_score":   s.cheat_score,
                "started_at":    s.started_at.isoformat() if s.started_at else None,
                "ended_at":      s.ended_at.isoformat() if s.ended_at else None,
                "candidate":     candidate.to_dict() if candidate else {}
            })

        return jsonify({"candidates": candidates}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── GET RANKINGS ─────────────────────────────────────────────
@company_bp.route("/interviews/<int:interview_id>/rankings", methods=["GET"])
@jwt_required()
def get_rankings(interview_id):
    try:
        from app.services.scoring_engine import get_scoring_engine
        se       = get_scoring_engine()
        rankings = se.get_interview_rankings(interview_id)
        return jsonify({"rankings": rankings}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── UPDATE COMPANY PROFILE ───────────────────────────────────
@company_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    try:
        user_id  = int(get_jwt_identity())
        user, company, err, code = get_company_for_user(user_id)
        if err:
            return jsonify({"error": err}), code

        data = request.get_json() or {}
        if data.get("company_name"): company.company_name = data["company_name"]
        if data.get("industry"):     company.industry     = data["industry"]
        if data.get("website"):      company.website      = data["website"]

        db.session.commit()
        return jsonify({"message": "Updated", "company": company.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── DEBUG ENDPOINT (remove in production) ───────────────────
@company_bp.route("/debug/me", methods=["GET"])
@jwt_required()
def debug_me():
    """Debug endpoint to check user + company status."""
    try:
        user_id = int(get_jwt_identity())
        user    = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found", "user_id": user_id}), 404

        company = Company.query.filter_by(user_id=user_id).first()
        return jsonify({
            "user_id":      user_id,
            "email":        user.email,
            "role":         user.role,
            "is_active":    user.is_active,
            "has_company":  company is not None,
            "company_id":   company.id if company else None,
            "company_name": company.company_name if company else None
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500