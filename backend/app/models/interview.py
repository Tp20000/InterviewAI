from app import db
from datetime import datetime

class Company(db.Model):
    __tablename__ = "companies"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    company_name = db.Column(db.String(200), nullable=False)
    industry = db.Column(db.String(100))
    website = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    interviews = db.relationship("Interview", backref="company", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "company_name": self.company_name,
            "industry": self.industry,
            "website": self.website
        }

class Interview(db.Model):
    __tablename__ = "interviews"
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    job_description = db.Column(db.Text, nullable=False)
    role_name = db.Column(db.String(100))
    experience_level = db.Column(db.String(20), default="mid")
    status = db.Column(db.String(20), default="draft")
    duration_minutes = db.Column(db.Integer, default=45)
    total_questions = db.Column(db.Integer, default=10)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    approved_at = db.Column(db.DateTime, nullable=True)
    topics = db.relationship("InterviewTopic", backref="interview", lazy=True, cascade="all, delete-orphan")
    sessions = db.relationship("InterviewSession", backref="interview", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "job_description": self.job_description,
            "role_name": self.role_name,
            "experience_level": self.experience_level,
            "status": self.status,
            "duration_minutes": self.duration_minutes,
            "total_questions": self.total_questions,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "topics": [t.to_dict() for t in self.topics]
        }

class InterviewTopic(db.Model):
    __tablename__ = "interview_topics"
    id = db.Column(db.Integer, primary_key=True)
    interview_id = db.Column(db.Integer, db.ForeignKey("interviews.id"), nullable=False)
    topic_name = db.Column(db.String(200), nullable=False)
    weightage = db.Column(db.Integer, default=10)
    difficulty = db.Column(db.String(10), default="medium")
    is_approved = db.Column(db.Boolean, default=False)
    order_index = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "topic_name": self.topic_name,
            "weightage": self.weightage,
            "difficulty": self.difficulty,
            "is_approved": self.is_approved,
            "order_index": self.order_index
        }