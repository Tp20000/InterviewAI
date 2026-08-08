from app import db
from datetime import datetime

class Answer(db.Model):
    __tablename__ = "answers"
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("interview_sessions.id"), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey("questions.id"), nullable=False)
    answer_text = db.Column(db.Text, nullable=False)
    answer_audio_path = db.Column(db.String(256), nullable=True)
    duration_seconds = db.Column(db.Integer, default=0)
    ai_score = db.Column(db.Float, default=0.0)
    relevance_score = db.Column(db.Float, default=0.0)
    clarity_score = db.Column(db.Float, default=0.0)
    depth_score = db.Column(db.Float, default=0.0)
    ai_feedback = db.Column(db.Text, nullable=True)
    is_ai_generated = db.Column(db.Boolean, default=False)
    similarity_score = db.Column(db.Float, nullable=True)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "question_id": self.question_id,
            "answer_text": self.answer_text,
            "duration_seconds": self.duration_seconds,
            "ai_score": self.ai_score,
            "relevance_score": self.relevance_score,
            "clarity_score": self.clarity_score,
            "depth_score": self.depth_score,
            "ai_feedback": self.ai_feedback,
            "is_ai_generated": self.is_ai_generated,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None
        }