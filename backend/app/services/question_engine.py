import json
from datetime import datetime
from app import db
from app.models.question  import Question
from app.models.session   import InterviewSession
from app.models.interview import Interview, InterviewTopic
from app.models.user      import User
from app.services.ai_interviewer import get_ai_interviewer


class QuestionEngine:
    def get_next_question(self, session_id):
        session   = InterviewSession.query.get(session_id)
        if not session:
            return None, "Session not found"
        interview = Interview.query.get(session.interview_id)
        if not interview:
            return None, "Interview not found"

        q_index = session.current_question_index
        total   = interview.total_questions

        if q_index >= total:
            return None, "Interview complete"

        # Check if question already generated
        existing = Question.query.filter_by(session_id=session_id, order_index=q_index).first()
        if existing:
            return existing.to_dict(), None

        # Get candidate resume
        candidate = User.query.get(session.candidate_id)
        resume_text = candidate.resume_text if candidate and candidate.resume_text else ""

        topics = [t.to_dict() for t in interview.topics if t.is_approved]
        if not topics:
            topics = [t.to_dict() for t in interview.topics]

        current_topic = self._get_current_topic(topics, q_index, total)

        from app.models.answer import Answer
        prev_answers   = Answer.query.filter_by(session_id=session_id).order_by(Answer.submitted_at).all()
        last_answer    = prev_answers[-1].answer_text if prev_answers else ""
        prev_questions = Question.query.filter_by(session_id=session_id).order_by(Question.order_index).all()

        conversation = []
        for i, pq in enumerate(prev_questions):
            conversation.append({"role": "assistant", "content": pq.question_text})
            if i < len(prev_answers):
                conversation.append({"role": "user", "content": prev_answers[i].answer_text})

        q_type = self._get_question_type(q_index, total)

        try:
            ai = get_ai_interviewer()
            company_name = "our company"
            try:
                if interview.company:
                    company_name = interview.company.company_name
            except Exception:
                pass

            if q_index == 0:
                # Greeting + intro question
                cname = candidate.full_name.split()[0] if candidate else "there"
                question_text = ai.generate_greeting(
                    candidate_name=cname,
                    role_name=interview.role_name,
                    company_name=company_name
                )
                q_type = "intro"

            elif q_index == total - 1:
                # Closing question
                question_text = (
                    "We are nearing the end of our interview. "
                    "Do you have any questions for us about the role, the team, or the company?"
                )
                q_type = "closing"

            else:
                # Main question - pass resume context
                question_text = ai.generate_next_question(
                    role_name=interview.role_name,
                    company_name=company_name,
                    topics=topics,
                    conversation_history=conversation,
                    current_topic=current_topic,
                    question_number=q_index + 1,
                    total_questions=total,
                    experience_level=interview.experience_level,
                    last_answer=last_answer,
                    resume_text=resume_text,
                    jd_text=interview.job_description
                )

            diff = "medium"
            if isinstance(current_topic, dict):
                diff = current_topic.get("difficulty", "medium")

            question = Question(
                interview_id=interview.id,
                session_id=session_id,
                question_text=question_text,
                question_type=q_type,
                difficulty=diff,
                order_index=q_index,
                asked_at=datetime.utcnow()
            )
            db.session.add(question)
            db.session.commit()
            return question.to_dict(), None

        except Exception as e:
            db.session.rollback()
            return None, str(e)

    def _get_current_topic(self, topics, q_index, total):
        if not topics:
            return {"topic_name": "General", "difficulty": "medium"}
        if q_index == 0:
            return topics[0]
        progress = q_index / max(total, 1)
        # Decide if we should ask a resume-based or DSA question
        # Every 4th question can be resume/DSA based
        if q_index % 4 == 3:
            return {"topic_name": "Resume & Projects", "difficulty": "medium"}
        if q_index % 5 == 4:
            return {"topic_name": "Problem Solving & DSA", "difficulty": "hard"}
        idx = min(int(progress * len(topics)), len(topics) - 1)
        return topics[idx]

    def _get_question_type(self, q_index, total):
        if q_index == 0:
            return "intro"
        progress = q_index / max(total, 1)
        if q_index % 4 == 3:
            return "resume_based"
        if q_index % 5 == 4:
            return "technical"
        if progress < 0.20: return "behavioral"
        if progress < 0.75: return "technical"
        if progress < 0.90: return "behavioral"
        return "closing"

    def advance_question(self, session_id):
        session = InterviewSession.query.get(session_id)
        if not session:
            return False
        session.current_question_index += 1
        db.session.commit()
        return True

    def is_interview_complete(self, session_id):
        session   = InterviewSession.query.get(session_id)
        interview = Interview.query.get(session.interview_id)
        return session.current_question_index >= interview.total_questions


_question_engine = None

def get_question_engine():
    global _question_engine
    if _question_engine is None:
        _question_engine = QuestionEngine()
    return _question_engine