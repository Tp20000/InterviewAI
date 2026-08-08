from app import db
from datetime import datetime

class CheatLog(db.Model):
    __tablename__ = "cheat_logs"
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("interview_sessions.id"), nullable=False)
    cheat_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(10), default="low")
    detected_at = db.Column(db.DateTime, default=datetime.utcnow)
    snapshot_path = db.Column(db.String(256), nullable=True)
    description = db.Column(db.String(256))

    def to_dict(self):
        return {
            "id": self.id,
            "cheat_type": self.cheat_type,
            "severity": self.severity,
            "detected_at": self.detected_at.isoformat() if self.detected_at else None,
            "description": self.description
        }