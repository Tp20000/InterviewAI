from app import db
from datetime import datetime

class Report(db.Model):
    __tablename__ = "reports"
    id = db.Column(db.Integer, primary_key=True)
    interview_id = db.Column(db.Integer, db.ForeignKey("interviews.id"), nullable=False)
    session_id = db.Column(db.Integer, db.ForeignKey("interview_sessions.id"), nullable=False)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)
    summary = db.Column(db.Text)
    strengths = db.Column(db.Text, default="[]")
    weaknesses = db.Column(db.Text, default="[]")
    recommendation = db.Column(db.String(30), default="neutral")
    detailed_analysis = db.Column(db.Text)
    pdf_path = db.Column(db.String(256), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "interview_id": self.interview_id,
            "session_id": self.session_id,
            "generated_at": self.generated_at.isoformat() if self.generated_at else None,
            "summary": self.summary,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "recommendation": self.recommendation,
            "detailed_analysis": self.detailed_analysis
        }