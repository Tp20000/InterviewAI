import os
import warnings
warnings.filterwarnings("ignore")

from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_socketio import SocketIO

db       = SQLAlchemy()
jwt      = JWTManager()
socketio = SocketIO()


def _load_env():
    env_file = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", ".env"
    )
    env_file = os.path.normpath(env_file)
    if not os.path.exists(env_file):
        return
    with open(env_file, "rb") as f:
        raw = f.read()
    content = raw.decode("ascii", errors="ignore").replace("\r", "")
    for line in content.split("\n"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip()
            if k not in os.environ:
                os.environ[k] = v


def _get_async_mode():
    """Get async mode - prefer threading in production."""
    # Check if explicitly set
    mode = os.environ.get("SOCKETIO_ASYNC_MODE", "")
    if mode in ["eventlet", "gevent", "threading"]:
        return mode
    # Default to threading (safest for production)
    return "threading"


def create_app():
    _load_env()

    app = Flask(__name__, instance_relative_config=True)

    from app.config import config_map
    env = os.environ.get("FLASK_ENV", "development")
    app.config.from_object(config_map.get(env, config_map["default"]))

    os.makedirs(app.instance_path, exist_ok=True)
    for folder in ["uploads/videos", "uploads/audio", "uploads/recordings"]:
        os.makedirs(folder, exist_ok=True)

    db.init_app(app)
    jwt.init_app(app)

    # ── CORS ─────────────────────────────────────────────────
    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            resp = app.make_default_options_response()
            origin = request.headers.get("Origin", "*")
            resp.headers["Access-Control-Allow-Origin"]      = origin
            resp.headers["Access-Control-Allow-Headers"]     = "Content-Type, Authorization, Accept"
            resp.headers["Access-Control-Allow-Methods"]     = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            resp.headers["Access-Control-Allow-Credentials"] = "true"
            resp.headers["Access-Control-Max-Age"]           = "86400"
            return resp

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin", "")
        if origin:
            response.headers["Access-Control-Allow-Origin"]      = origin
            response.headers["Access-Control-Allow-Headers"]     = "Content-Type, Authorization, Accept"
            response.headers["Access-Control-Allow-Methods"]     = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    CORS(app,
         origins="*",
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization", "Accept"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])

    # ── SocketIO ─────────────────────────────────────────────
    async_mode = _get_async_mode()
    print("[SocketIO] async_mode: " + async_mode)

    socketio.init_app(
        app,
        cors_allowed_origins="*",
        async_mode=async_mode,
        logger=False,
        engineio_logger=False,
        ping_timeout=60,
        ping_interval=25,
        max_http_buffer_size=10000000
    )

    # ── JWT handlers ─────────────────────────────────────────
    @jwt.unauthorized_loader
    def unauthorized_callback(reason):
        return jsonify({"error": "Missing or invalid token"}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(reason):
        return jsonify({"error": "Invalid token"}), 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_data):
        return jsonify({"error": "Token expired. Please login again."}), 401

    # ── Blueprints ───────────────────────────────────────────
    from app.routes.auth      import auth_bp
    from app.routes.company   import company_bp
    from app.routes.interview import interview_bp
    from app.routes.candidate import candidate_bp
    from app.routes.admin     import admin_bp
    from app.routes.report    import report_bp

    app.register_blueprint(auth_bp,      url_prefix="/api/auth")
    app.register_blueprint(company_bp,   url_prefix="/api/company")
    app.register_blueprint(interview_bp, url_prefix="/api/interview")
    app.register_blueprint(candidate_bp, url_prefix="/api/candidate")
    app.register_blueprint(admin_bp,     url_prefix="/api/admin")
    app.register_blueprint(report_bp,    url_prefix="/api/report")

    # ── Sockets ──────────────────────────────────────────────
    try:
        from app.sockets import interview_socket  # noqa
    except Exception as e:
        print("[Warning] Sockets not loaded: " + str(e))

    # ── Routes ───────────────────────────────────────────────
    @app.route("/api/health")
    def health():
        return jsonify({
            "status":     "ok",
            "message":    "InterviewAI Backend Running",
            "version":    "1.0.0",
            "env":        os.environ.get("FLASK_ENV", "development"),
            "async_mode": async_mode
        }), 200

    @app.route("/")
    def root():
        return jsonify({
            "name":    "InterviewAI API",
            "status":  "running",
            "health":  "/api/health"
        }), 200

    # ── Database ─────────────────────────────────────────────
    with app.app_context():
        from app.models.user      import User
        from app.models.interview import Company, Interview, InterviewTopic
        from app.models.session   import InterviewSession
        from app.models.question  import Question
        from app.models.answer    import Answer
        from app.models.cheat_log import CheatLog
        from app.models.report    import Report
        db.create_all()
        _seed_all()

        # Warm up Groq on startup (prevents first-call slowness)
    try:
        import threading
        threading.Thread(target=_warmup_groq, daemon=True).start()
    except Exception:
        pass

    return app


def _seed_all():
    from app.models.user      import User
    from app.models.interview import Company
    created = []
    try:
        # Admin
        if not User.query.filter_by(email="admin@interviewai.com").first():
            u = User(email="admin@interviewai.com",
                     full_name="System Admin", role="admin")
            u.set_password("admin123")
            db.session.add(u)
            db.session.flush()
            created.append("admin")

        # Demo company
        comp_user = User.query.filter_by(email="company@demo.com").first()
        if not comp_user:
            comp_user = User(email="company@demo.com",
                             full_name="Demo Company", role="company")
            comp_user.set_password("demo123")
            db.session.add(comp_user)
            db.session.flush()

        if not Company.query.filter_by(user_id=comp_user.id).first():
            db.session.add(Company(
                user_id=comp_user.id,
                company_name="TechCorp Demo",
                industry="Technology",
                website="https://techcorp.demo"
            ))
            created.append("company profile")

        # Demo candidate
        if not User.query.filter_by(email="candidate@demo.com").first():
            u = User(email="candidate@demo.com",
                     full_name="Demo Candidate", role="candidate")
            u.set_password("demo123")
            db.session.add(u)
            created.append("candidate")

        db.session.commit()
        if created:
            print("[InterviewAI] Created: " + ", ".join(created))
        else:
            print("[InterviewAI] Ready.")
    except Exception as e:
        db.session.rollback()
        print("[InterviewAI] Seed note: " + str(e))

def _warmup_groq():
    """Pre-warm Groq connection on startup."""
    import time
    import requests as req
    import os
    time.sleep(3)  # Wait for app to fully start

    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return

    try:
        resp = req.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": "Bearer " + api_key,
                "Content-Type":  "application/json"
            },
            json={
                "model":       "llama-3.1-8b-instant",
                "messages":    [{"role": "user", "content": "Hi"}],
                "max_tokens":  3,
                "temperature": 0
            },
            timeout=20
        )
        if resp.status_code == 200:
            print("[InterviewAI] Groq pre-warmed successfully!")
        else:
            print("[InterviewAI] Groq warmup status: " + str(resp.status_code))
    except Exception as e:
        print("[InterviewAI] Groq warmup note: " + str(e))