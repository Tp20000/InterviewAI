import os
import warnings
warnings.filterwarnings("ignore")

from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_socketio import SocketIO

db       = SQLAlchemy()
jwt      = JWTManager()
socketio = SocketIO()


def _load_env():
    env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
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
    """Detect which async mode is available."""
    # Check if already set by run.py
    mode = os.environ.get("SOCKETIO_ASYNC_MODE", "")
    if mode in ["eventlet", "gevent", "threading"]:
        return mode

    # Auto-detect
    try:
        import eventlet
        return "eventlet"
    except Exception:
        pass
    try:
        import gevent
        return "gevent"
    except Exception:
        pass
    return "threading"


def _get_cors_origins():
    """Get CORS origins from environment."""
    origins_env = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    )
    origins = [o.strip() for o in origins_env.split(",") if o.strip()]
    print("[CORS] Allowed origins: " + str(origins))
    return origins


def create_app():
    _load_env()

    app = Flask(__name__, instance_relative_config=True)

    # Load config
    from app.config import config_map
    env = os.environ.get("FLASK_ENV", "development")
    app.config.from_object(config_map.get(env, config_map["default"]))

    # Ensure folders exist
    os.makedirs(app.instance_path, exist_ok=True)
    os.makedirs("uploads/videos",     exist_ok=True)
    os.makedirs("uploads/audio",      exist_ok=True)
    os.makedirs("uploads/recordings", exist_ok=True)

    # Init extensions
    db.init_app(app)
    jwt.init_app(app)

    # ── CORS ─────────────────────────────────────────────────
    cors_origins = _get_cors_origins()
    CORS(
        app,
        origins=cors_origins,
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    )

    # ── SocketIO with dynamic async mode ─────────────────────
    async_mode = _get_async_mode()
    print("[SocketIO] Using async mode: " + async_mode)

    socketio.init_app(
        app,
        cors_allowed_origins=cors_origins,
        async_mode=async_mode,
        logger=False,
        engineio_logger=False,
        ping_timeout=60,
        ping_interval=25,
        max_http_buffer_size=10000000
    )

    # ── JWT error handlers ───────────────────────────────────
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

    # ── Socket handlers ──────────────────────────────────────
    try:
        from app.sockets import interview_socket  # noqa
    except Exception as e:
        print("[Warning] Socket handlers not loaded: " + str(e))

    # ── Health check ─────────────────────────────────────────
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
            "name":   "InterviewAI API",
            "status": "running",
            "health": "/api/health"
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
        _create_default_admin()

    return app


def _create_default_admin():
    from app.models.user import User
    try:
        existing = User.query.filter_by(role="admin").first()
        if not existing:
            admin = User(
                email="admin@interviewai.com",
                full_name="System Admin",
                role="admin"
            )
            admin.set_password("admin123")
            db.session.add(admin)
            db.session.commit()
            print("[InterviewAI] Admin created: admin@interviewai.com / admin123")
        else:
            print("[InterviewAI] Backend ready.")
    except Exception as e:
        print("[InterviewAI] Note: " + str(e))