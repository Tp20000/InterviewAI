import json
from datetime import datetime
from app import db
from app.models.question  import Question
from app.models.session   import InterviewSession
from app.models.interview import Interview, InterviewTopic
from app.models.user      import User


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

        # Return existing question if already generated
        existing = Question.query.filter_by(
            session_id=session_id,
            order_index=q_index
        ).first()
        if existing:
            return existing.to_dict(), None

        # Get data for question generation
        candidate   = User.query.get(session.candidate_id)
        resume_text = ""
        if candidate and hasattr(candidate, "resume_text"):
            resume_text = candidate.resume_text or ""

        topics = [t.to_dict() for t in interview.topics if t.is_approved]
        if not topics:
            topics = [t.to_dict() for t in interview.topics]

        current_topic = self._get_current_topic(topics, q_index, total)
        q_type        = self._get_question_type(q_index, total)

        # Get conversation history
        from app.models.answer import Answer
        prev_answers   = Answer.query.filter_by(
            session_id=session_id
        ).order_by(Answer.submitted_at).all()

        prev_questions = Question.query.filter_by(
            session_id=session_id
        ).order_by(Question.order_index).all()

        conversation = []
        for i, pq in enumerate(prev_questions):
            conversation.append({
                "role": "assistant", "content": pq.question_text
            })
            if i < len(prev_answers):
                conversation.append({
                    "role": "user",
                    "content": prev_answers[i].answer_text[:200]
                })

        last_answer = prev_answers[-1].answer_text if prev_answers else ""

        # Generate question
        try:
            from app.services.ai_interviewer import get_ai_interviewer
            ai = get_ai_interviewer()

            company_name = "the company"
            try:
                if interview.company:
                    company_name = interview.company.company_name
            except Exception:
                pass

            cname = "there"
            if candidate and candidate.full_name:
                cname = candidate.full_name.split()[0]

            if q_index == 0:
                # Greeting
                question_text = ai.generate_greeting(
                    candidate_name=cname,
                    role_name=interview.role_name,
                    company_name=company_name
                )
                q_type = "intro"

            elif q_index == total - 1:
                # Closing
                question_text = (
                    "We are nearing the end of our interview. "
                    "Do you have any questions for us about the role or the team?"
                )
                q_type = "closing"

            else:
                # Main question
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
                    resume_text=resume_text[:500],
                    jd_text=interview.job_description[:300]
                )

        except Exception as e:
            print("[QuestionEngine] AI error: " + str(e))
            # Fallback question
            ct_name = "the topic"
            if isinstance(current_topic, dict):
                ct_name = current_topic.get("topic_name", "the topic")
            question_text = self._fallback_question(
                q_index, total, ct_name,
                interview.role_name, interview.experience_level
            )

        # Determine difficulty
        diff = "medium"
        if isinstance(current_topic, dict):
            diff = current_topic.get("difficulty", "medium")

        # Save question
        try:
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

    def _fallback_question(self, q_index, total, topic,
                            role_name, experience_level):
        """Fallback questions when AI fails."""
        progress = q_index / max(total, 1)

        if q_index == 0:
            return (
                "Hello! Welcome to your interview. "
                "I'm Alex, your AI interviewer today. "
                "Could you please start by introducing yourself and "
                "telling me about your background?"
            )

        fallbacks = {
            "easy": [
                "Can you tell me about yourself and your experience with " + topic + "?",
                "What got you interested in " + role_name + " as a career?",
                "How would you describe your experience level with " + topic + "?",
                "What are your strengths as a " + role_name + "?"
            ],
            "medium": [
                "Can you explain a challenging project involving " + topic + "?",
                "How do you approach problem-solving in " + topic + "?",
                "Describe a situation where you used " + topic + " to solve a problem.",
                "What tools and technologies do you use in " + topic + "?"
            ],
            "hard": [
                "Can you explain the architecture of a system you designed using " + topic + "?",
                "How would you optimize performance in " + topic + "?",
                "Describe a complex technical challenge you solved involving " + topic + ".",
                "How do you stay updated with the latest developments in " + topic + "?"
            ]
        }

        level = "medium"
        if progress < 0.3:
            level = "easy"
        elif progress > 0.7:
            level = "hard"

        import random
        questions = fallbacks.get(level, fallbacks["medium"])
        return random.choice(questions)

    def _get_current_topic(self, topics, q_index, total):
        if not topics:
            return {"topic_name": "General", "difficulty": "medium"}
        if q_index == 0:
            return topics[0]
        progress = q_index / max(total, 1)
        idx = min(int(progress * len(topics)), len(topics) - 1)
        return topics[idx]

    def _get_question_type(self, q_index, total):
        if q_index == 0:
            return "intro"
        progress = q_index / max(total, 1)
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


_instance = None

def get_question_engine():
    global _instance
    if _instance is None:
        _instance = QuestionEngine()
    return _instance