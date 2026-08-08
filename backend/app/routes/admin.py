from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user      import User
from app.models.interview import Interview, Company
from app.models.session   import InterviewSession
from app.models.cheat_log import CheatLog

admin_bp = Blueprint("admin", __name__)

def require_admin():
    user_id = int(get_jwt_identity())
    user    = User.query.get(user_id)
    if not user or user.role != "admin":
        return None, jsonify({"error": "Admin access required"}), 403
    return user, None, None


@admin_bp.route("/stats", methods=["GET"])
@jwt_required()
def stats():
    try:
        user_id = int(get_jwt_identity())
        user    = User.query.get(user_id)
        if not user or user.role != "admin":
            return jsonify({"error": "Forbidden"}), 403

        return jsonify({
            "stats": {
                "total_users":       User.query.count(),
                "total_companies":   Company.query.count(),
                "total_candidates":  User.query.filter_by(role="candidate").count(),
                "total_interviews":  Interview.query.count(),
                "active_interviews": Interview.query.filter_by(status="active").count(),
                "total_sessions":    InterviewSession.query.count(),
                "completed_sessions": InterviewSession.query.filter_by(status="completed").count(),
                "cheat_events":      CheatLog.query.count()
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/users", methods=["GET"])
@jwt_required()
def list_users():
    try:
        user_id = int(get_jwt_identity())
        user    = User.query.get(user_id)
        if not user or user.role != "admin":
            return jsonify({"error": "Forbidden"}), 403

        role  = request.args.get("role")
        query = User.query
        if role:
            query = query.filter_by(role=role)

        users = query.order_by(User.created_at.desc()).all()
        return jsonify({"users": [u.to_dict() for u in users]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/users/<int:uid>/status", methods=["PUT"])
@jwt_required()
def toggle_user(uid):
    try:
        user_id = int(get_jwt_identity())
        admin   = User.query.get(user_id)
        if not admin or admin.role != "admin":
            return jsonify({"error": "Forbidden"}), 403

        target = User.query.get(uid)
        if not target:
            return jsonify({"error": "User not found"}), 404

        data          = request.get_json()
        target.is_active = data.get("is_active", not target.is_active)
        db.session.commit()

        return jsonify({
            "message":   f"User {'activated' if target.is_active else 'deactivated'}",
            "user":      target.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/interviews", methods=["GET"])
@jwt_required()
def all_interviews():
    try:
        user_id = int(get_jwt_identity())
        user    = User.query.get(user_id)
        if not user or user.role != "admin":
            return jsonify({"error": "Forbidden"}), 403

        interviews = Interview.query.order_by(Interview.created_at.desc()).all()
        result     = []
        for iv in interviews:
            d                    = iv.to_dict()
            d["session_count"]   = InterviewSession.query.filter_by(interview_id=iv.id).count()
            d["company_name"]    = iv.company.company_name if iv.company else "N/A"
            result.append(d)

        return jsonify({"interviews": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/sessions/<int:sid>", methods=["DELETE"])
@jwt_required()
def delete_session(sid):
    try:
        user_id = int(get_jwt_identity())
        user    = User.query.get(user_id)
        if not user or user.role != "admin":
            return jsonify({"error": "Forbidden"}), 403

        session = InterviewSession.query.get(sid)
        if not session:
            return jsonify({"error": "Not found"}), 404

        db.session.delete(session)
        db.session.commit()
        return jsonify({"message": "Session deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500