from app import db
from datetime import datetime

class Question(db.Model):
    __tablename__ = "questions"
    id = db.Column(db.Integer, primary_key=True)
    interview_id = db.Column(db.Integer, db.ForeignKey("interviews.id"), nullable=False)
    session_id = db.Column(db.Integer, db.ForeignKey("interview_sessions.id"), nullable=True)
    topic_id = db.Column(db.Integer, db.ForeignKey("interview_topics.id"), nullable=True)
    question_text = db.Column(db.Text, nullable=False)
    question_type = db.Column(db.String(20), default="technical")
    difficulty = db.Column(db.String(10), default="medium")
    expected_keywords = db.Column(db.Text, default="[]")
    order_index = db.Column(db.Integer, default=0)
    asked_at = db.Column(db.DateTime, nullable=True)
    answers = db.relationship("Answer", backref="question", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "question_text": self.question_text,
            "question_type": self.question_type,
            "difficulty": self.difficulty,
            "order_index": self.order_index,
            "asked_at": self.asked_at.isoformat() if self.asked_at else None
        }