from app import db
from datetime import datetime
import secrets

class InterviewSession(db.Model):
    __tablename__ = "interview_sessions"
    id                      = db.Column(db.Integer, primary_key=True)
    interview_id            = db.Column(db.Integer, db.ForeignKey("interviews.id"), nullable=False)
    candidate_id            = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    session_token           = db.Column(db.String(64), unique=True, default=lambda: secrets.token_urlsafe(32))
    status                  = db.Column(db.String(20), default="scheduled")
    started_at              = db.Column(db.DateTime, nullable=True)
    ended_at                = db.Column(db.DateTime, nullable=True)
    current_question_index  = db.Column(db.Integer, default=0)
    total_score             = db.Column(db.Float, nullable=True)
    percentile              = db.Column(db.Float, nullable=True)
    is_mock                 = db.Column(db.Boolean, default=False)
    recording_path          = db.Column(db.String(256), nullable=True)
    cheat_score             = db.Column(db.Float, default=0.0)
    disqualification_reason = db.Column(db.String(256), nullable=True)

    answers    = db.relationship("Answer",    backref="session", lazy=True, cascade="all, delete-orphan")
    cheat_logs = db.relationship("CheatLog",  backref="session", lazy=True, cascade="all, delete-orphan")
    questions  = db.relationship("Question",  backref="session", lazy=True, cascade="all, delete-orphan",
                                  foreign_keys="Question.session_id")

    def to_dict(self):
        return {
            "id":                     self.id,
            "interview_id":           self.interview_id,
            "candidate_id":           self.candidate_id,
            "session_token":          self.session_token,
            "status":                 self.status,
            "started_at":             self.started_at.isoformat() if self.started_at else None,
            "ended_at":               self.ended_at.isoformat() if self.ended_at else None,
            "current_question_index": self.current_question_index,
            "total_score":            self.total_score,
            "percentile":             self.percentile,
            "is_mock":                self.is_mock,
            "cheat_score":            self.cheat_score,
            "disqualification_reason": self.disqualification_reason
        }