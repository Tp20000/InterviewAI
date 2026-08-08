from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity
)
from datetime import datetime
from app import db
from app.models.user      import User
from app.models.interview import Company
from app.utils.validators import validate_email, validate_password, validate_role

auth_bp = Blueprint("auth", __name__)


def _ensure_company_profile(user):
    """Ensure company user has a company profile. Create if missing."""
    if user.role != "company":
        return None
    company = Company.query.filter_by(user_id=user.id).first()
    if not company:
        company = Company(
            user_id=user.id,
            company_name=user.full_name + " Company",
            industry="Technology",
            website=""
        )
        db.session.add(company)
        db.session.commit()
        print("[Auth] Auto-created company profile for: " + user.email)
    return company


def _build_user_response(user):
    """Build user dict with company info if applicable."""
    data = user.to_dict()
    if user.role == "company":
        company = _ensure_company_profile(user)
        if company:
            data["company_id"]   = company.id
            data["company_name"] = company.company_name
            data["industry"]     = company.industry
    return data


# ── REGISTER ─────────────────────────────────────────────────
@auth_bp.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        required = ["email", "password", "full_name", "role"]
        missing  = [f for f in required if not data.get(f)]
        if missing:
            return jsonify({"error": "Missing fields: " + str(missing)}), 400

        email    = data["email"].strip().lower()
        password = data["password"]
        name     = data["full_name"].strip()
        role     = data["role"].strip().lower()

        if not validate_email(email):
            return jsonify({"error": "Invalid email format"}), 400

        valid_pw, pw_msg = validate_password(password)
        if not valid_pw:
            return jsonify({"error": pw_msg}), 400

        if not validate_role(role):
            return jsonify({"error": "Role must be: company or candidate"}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already registered"}), 409

        user = User(email=email, full_name=name, role=role)
        user.set_password(password)
        db.session.add(user)
        db.session.flush()

        if role == "company":
            company_name = data.get("company_name", name + " Company").strip()
            industry     = data.get("industry", "Technology").strip()
            website      = data.get("website", "").strip()
            company = Company(
                user_id=user.id,
                company_name=company_name,
                industry=industry,
                website=website
            )
            db.session.add(company)

        db.session.commit()

        token     = create_access_token(identity=str(user.id))
        user_data = _build_user_response(user)

        return jsonify({
            "message":      "Registration successful",
            "access_token": token,
            "user":         user_data
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── LOGIN ─────────────────────────────────────────────────────
@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        email    = data.get("email", "").strip().lower()
        password = data.get("password", "")

        if not email or not password:
            return jsonify({"error": "Email and password required"}), 400

        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            return jsonify({"error": "Invalid email or password"}), 401
        if not user.is_active:
            return jsonify({"error": "Account deactivated. Contact admin."}), 403

        # Ensure company profile exists
        if user.role == "company":
            _ensure_company_profile(user)

        token     = create_access_token(identity=str(user.id))
        user_data = _build_user_response(user)

        return jsonify({
            "message":      "Login successful",
            "access_token": token,
            "user":         user_data
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── GET CURRENT USER ─────────────────────────────────────────
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    try:
        user_id = int(get_jwt_identity())
        user    = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        if user.role == "company":
            _ensure_company_profile(user)

        user_data = _build_user_response(user)
        return jsonify({"user": user_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── LOGOUT ───────────────────────────────────────────────────
@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    return jsonify({"message": "Logged out successfully"}), 200


# ── CHANGE PASSWORD ──────────────────────────────────────────
@auth_bp.route("/change-password", methods=["PUT"])
@jwt_required()
def change_password():
    try:
        user_id = int(get_jwt_identity())
        user    = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        data   = request.get_json() or {}
        old_pw = data.get("old_password", "")
        new_pw = data.get("new_password", "")

        if not user.check_password(old_pw):
            return jsonify({"error": "Current password is incorrect"}), 400

        valid, msg = validate_password(new_pw)
        if not valid:
            return jsonify({"error": msg}), 400

        user.set_password(new_pw)
        db.session.commit()
        return jsonify({"message": "Password changed successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── UPLOAD RESUME ─────────────────────────────────────────────
@auth_bp.route("/upload-resume", methods=["POST"])
@jwt_required()
def upload_resume():
    try:
        user_id = int(get_jwt_identity())
        user    = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        data        = request.get_json() or {}
        resume_text = data.get("resume_text", "").strip()

        if not resume_text or len(resume_text) < 30:
            return jsonify({"error": "Resume text too short (min 30 chars)"}), 400

        user.resume_text = resume_text[:10000]
        db.session.commit()

        return jsonify({
            "message":       "Resume uploaded successfully",
            "resume_length": len(resume_text)
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── PING ─────────────────────────────────────────────────────
@auth_bp.route("/ping", methods=["GET"])
def ping():
    return jsonify({
        "status":    "auth ok",
        "timestamp": datetime.utcnow().isoformat()
    }), 200

# ── TEST GROQ (Debug) ─────────────────────────────────────────
@auth_bp.route("/test-groq", methods=["GET"])
def test_groq():
    """Test Groq API connectivity from the server."""
    import os
    import requests as req
    import time

    api_key = os.environ.get("GROQ_API_KEY", "")
    result  = {
        "api_key_set":    bool(api_key and len(api_key) > 20),
        "api_key_prefix": api_key[:8] + "..." if api_key else "NOT SET",
        "groq_url":       "https://api.groq.com/openai/v1/chat/completions",
        "model":          "llama-3.1-8b-instant"
    }

    if not api_key:
        result["error"] = "GROQ_API_KEY not set in environment"
        return jsonify(result), 500

    start = time.time()
    try:
        resp = req.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": "Bearer " + api_key,
                "Content-Type":  "application/json"
            },
            json={
                "model":       "llama-3.1-8b-instant",
                "messages":    [{"role": "user", "content": "Say: OK"}],
                "max_tokens":  5,
                "temperature": 0
            },
            timeout=30
        )
        elapsed = round(time.time() - start, 2)

        if resp.status_code == 200:
            data    = resp.json()
            content = data["choices"][0]["message"]["content"]
            result["success"]      = True
            result["response"]     = content
            result["elapsed_sec"]  = elapsed
            result["status_code"]  = 200
            return jsonify(result), 200
        else:
            result["success"]     = False
            result["status_code"] = resp.status_code
            result["error"]       = resp.text[:500]
            result["elapsed_sec"] = elapsed
            return jsonify(result), 500

    except req.exceptions.Timeout:
        result["success"] = False
        result["error"]   = "Timeout after 30s - Groq unreachable from Render"
        result["elapsed_sec"] = round(time.time() - start, 2)
        return jsonify(result), 504
    except Exception as e:
        result["success"] = False
        result["error"]   = str(e)
        result["elapsed_sec"] = round(time.time() - start, 2)
        return jsonify(result), 500