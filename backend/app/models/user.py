from app import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash


class User(db.Model):
    __tablename__ = "users"
    id             = db.Column(db.Integer, primary_key=True)
    email          = db.Column(db.String(150), unique=True, nullable=False)
    password_hash  = db.Column(db.String(256), nullable=False)
    full_name      = db.Column(db.String(150), nullable=False)
    role           = db.Column(db.String(20), nullable=False, default="candidate")
    is_active      = db.Column(db.Boolean, default=True)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)
    profile_photo  = db.Column(db.String(256), nullable=True)
    resume_text    = db.Column(db.Text, nullable=True)

    company  = db.relationship("Company", backref="user", uselist=False)
    sessions = db.relationship("InterviewSession", backref="candidate", lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id":            self.id,
            "email":         self.email,
            "full_name":     self.full_name,
            "role":          self.role,
            "is_active":     self.is_active,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
            "profile_photo": self.profile_photo,
            "has_resume":    bool(self.resume_text and len(self.resume_text) > 30)
        }