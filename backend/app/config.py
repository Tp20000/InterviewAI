import os
from datetime import timedelta


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "interviewai-secret-2024")
    FLASK_ENV  = os.environ.get("FLASK_ENV", "development")

    # Database
    # In production (Render), use /tmp or instance folder
    _base_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "instance")
    )
    os.makedirs(_base_dir, exist_ok=True)

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "sqlite:///" + os.path.join(_base_dir, "interviewai.db")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping":  True,
        "pool_recycle":   300,
        "connect_args":   {"check_same_thread": False}
    }

    # JWT
    JWT_SECRET_KEY           = os.environ.get("JWT_SECRET_KEY", "jwt-secret-2024")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)

    # Files
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", 104857600))
    UPLOAD_FOLDER      = os.environ.get("UPLOAD_FOLDER", "uploads")

    # Groq AI
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
    GROQ_MODEL   = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

    # Interview
    DEFAULT_INTERVIEW_DURATION = 45
    DEFAULT_TOTAL_QUESTIONS    = 10
    MAX_CHEAT_SCORE            = 70


class DevelopmentConfig(Config):
    DEBUG   = True
    TESTING = False


class ProductionConfig(Config):
    DEBUG   = False
    TESTING = False


config_map = {
    "development": DevelopmentConfig,
    "production":  ProductionConfig,
    "default":     DevelopmentConfig
}