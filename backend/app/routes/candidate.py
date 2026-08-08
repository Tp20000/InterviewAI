from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user      import User
from app.models.session   import InterviewSession
from app.models.interview import Interview, Company
from app.models.answer    import Answer
from app.models.report    import Report

candidate_bp = Blueprint("candidate", __name__)


def _grade(score):
    if score is None: return "N/A"
    if score >= 90:   return "A+"
    if score >= 80:   return "A"
    if score >= 70:   return "B+"
    if score >= 60:   return "B"
    if score >= 50:   return "C"
    return "F"


@candidate_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard():
    try:
        user_id  = int(get_jwt_identity())
        user     = User.query.get(user_id)
        if not user or user.role != "candidate":
            return jsonify({"error": "Forbidden"}), 403

        # Single optimized query
        sessions = InterviewSession.query.filter_by(
            candidate_id=user_id
        ).order_by(InterviewSession.id.desc()).limit(20).all()

        scheduled = [s for s in sessions if s.status == "scheduled"]
        completed  = [s for s in sessions if s.status == "completed"]
        in_prog    = [s for s in sessions if s.status == "in_progress"]

        scores     = [s.total_score for s in completed if s.total_score is not None]
        avg_score  = round(sum(scores) / len(scores), 1) if scores else 0

        # Recent results - limit to 5
        recent_results = []
        for s in completed[:5]:
            iv = Interview.query.get(s.interview_id)
            if iv:
                company_name = ""
                try:
                    if iv.company:
                        company_name = iv.company.company_name
                except Exception:
                    pass
                recent_results.append({
                    "session_id":   s.id,
                    "interview":    iv.title,
                    "role":         iv.role_name,
                    "company":      company_name,
                    "score":        s.total_score,
                    "grade":        _grade(s.total_score),
                    "completed_at": s.ended_at.isoformat() if s.ended_at else None
                })

        return jsonify({
            "user": user.to_dict(),
            "stats": {
                "total_interviews": len(sessions),
                "scheduled":        len(scheduled),
                "completed":        len(completed),
                "in_progress":      len(in_prog),
                "average_score":    avg_score
            },
            "recent_results": recent_results
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@candidate_bp.route("/my-interviews", methods=["GET"])
@jwt_required()
def my_interviews():
    try:
        user_id  = int(get_jwt_identity())
        sessions = InterviewSession.query.filter_by(
            candidate_id=user_id
        ).order_by(InterviewSession.id.desc()).all()

        result = []
        for s in sessions:
            iv = Interview.query.get(s.interview_id)
            if iv:
                result.append({
                    "session_id":    s.id,
                    "session_token": s.session_token,
                    "status":        s.status,
                    "total_score":   s.total_score,
                    "grade":         _grade(s.total_score),
                    "cheat_score":   s.cheat_score,
                    "is_mock":       s.is_mock,
                    "started_at":    s.started_at.isoformat() if s.started_at else None,
                    "ended_at":      s.ended_at.isoformat() if s.ended_at else None,
                    "interview": {
                        "id":               iv.id,
                        "title":            iv.title,
                        "role_name":        iv.role_name,
                        "experience_level": iv.experience_level,
                        "duration_minutes": iv.duration_minutes,
                        "total_questions":  iv.total_questions
                    }
                })

        return jsonify({"interviews": result}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@candidate_bp.route("/my-results", methods=["GET"])
@jwt_required()
def my_results():
    try:
        user_id  = int(get_jwt_identity())
        sessions = InterviewSession.query.filter_by(
            candidate_id=user_id,
            status="completed"
        ).order_by(InterviewSession.id.desc()).all()

        results = []
        for s in sessions:
            iv     = Interview.query.get(s.interview_id)
            report = Report.query.filter_by(session_id=s.id).first()

            company_name = ""
            try:
                if iv and iv.company:
                    company_name = iv.company.company_name
            except Exception:
                pass

            results.append({
                "session_id":  s.id,
                "score":       s.total_score,
                "grade":       _grade(s.total_score),
                "percentile":  s.percentile,
                "cheat_score": s.cheat_score,
                "ended_at":    s.ended_at.isoformat() if s.ended_at else None,
                "interview": {
                    "title":   iv.title if iv else "",
                    "role":    iv.role_name if iv else "",
                    "company": company_name
                },
                "has_report":    report is not None,
                "total_answers": Answer.query.filter_by(session_id=s.id).count()
            })

        return jsonify({"results": results}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@candidate_bp.route("/mock/start", methods=["POST"])
@jwt_required()
def start_mock():
    try:
        user_id = int(get_jwt_identity())
        user    = User.query.get(user_id)
        data    = request.get_json() or {}

        role   = data.get("role_name", "Software Engineer")
        level  = data.get("experience_level", "mid")

        from app import db
        from app.models.interview import Interview, InterviewTopic
        from app.models.session   import InterviewSession
        from datetime             import datetime

        mock_company = Company.query.filter_by(
            company_name="Mock Interview Co."
        ).first()
        if not mock_company:
            mock_user = User.query.filter_by(
                email="mock@interviewai.com"
            ).first()
            if not mock_user:
                mock_user = User(
                    email="mock@interviewai.com",
                    full_name="Mock System",
                    role="company"
                )
                mock_user.set_password("mock_internal_123")
                db.session.add(mock_user)
                db.session.flush()

            mock_company = Company(
                user_id=mock_user.id,
                company_name="Mock Interview Co.",
                industry="Practice"
            )
            db.session.add(mock_company)
            db.session.flush()

        interview = Interview(
            company_id=mock_company.id,
            title="Mock Interview - " + role,
            job_description="Practice interview for " + role + " at " + level + " level.",
            role_name=role,
            experience_level=level,
            duration_minutes=30,
            total_questions=8,
            status="active",
            created_at=datetime.utcnow(),
            approved_at=datetime.utcnow()
        )
        db.session.add(interview)
        db.session.flush()

        default_topics = [
            {"topic_name": "Technical Fundamentals", "weightage": 40, "difficulty": "medium"},
            {"topic_name": "Problem Solving",         "weightage": 30, "difficulty": "medium"},
            {"topic_name": "Past Experience",         "weightage": 20, "difficulty": "easy"},
            {"topic_name": "Behavioral",              "weightage": 10, "difficulty": "easy"}
        ]
        for i, t in enumerate(default_topics):
            db.session.add(InterviewTopic(
                interview_id=interview.id,
                topic_name=t["topic_name"],
                weightage=t["weightage"],
                difficulty=t["difficulty"],
                is_approved=True,
                order_index=i + 1
            ))

        session = InterviewSession(
            interview_id=interview.id,
            candidate_id=user_id,
            status="scheduled",
            is_mock=True
        )
        db.session.add(session)
        db.session.commit()

        return jsonify({
            "message":       "Mock interview created",
            "session_token": session.session_token,
            "interview_id":  interview.id
        }), 201

    except Exception as e:
        from app import db
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@candidate_bp.route("/mock/topics", methods=["GET"])
@jwt_required()
def mock_topics():
    return jsonify({
        "topics": [
            "Data Structures & Algorithms",
            "System Design",
            "Python / JavaScript",
            "Databases & SQL",
            "REST APIs",
            "Cloud & DevOps",
            "Machine Learning Basics",
            "Behavioral & Soft Skills"
        ]
    }), 200