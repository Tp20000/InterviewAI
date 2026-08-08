import os
import json
from datetime import datetime
from app import db
from app.models.answer  import Answer
from app.models.session import InterviewSession
from app.models.question import Question
from app.models.interview import Interview, InterviewTopic
from app.models.cheat_log import CheatLog
from app.services.ai_interviewer import get_ai_interviewer


def _load_env():
    env_file = os.path.normpath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env")
    )
    if not os.path.exists(env_file):
        return
    with open(env_file, "rb") as f:
        raw = f.read()
    content = raw.decode("ascii", errors="ignore").replace("\r", "")
    for line in content.split("\n"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip()
            if k not in os.environ:
                os.environ[k] = v

_load_env()


class ScoringEngine:
    """
    Calculates per-answer scores and overall session scores.
    Applies cheat penalties and generates final rankings.
    """

    # Cheat penalty weights
    CHEAT_PENALTIES = {
        "critical": 10.0,
        "high":      5.0,
        "medium":    2.0,
        "low":       0.5
    }

    def score_answer(self, session_id, question_id, answer_text):
        """
        Score a single answer using AI evaluation.
        Saves scores to DB and returns score dict.
        """
        try:
            session  = InterviewSession.query.get(session_id)
            question = Question.query.get(question_id)
            interview = Interview.query.get(session.interview_id)

            if not session or not question or not interview:
                return None, "Invalid session/question/interview"

            # Get topic for this question
            topic_name = "General"
            if question.topic_id:
                topic = InterviewTopic.query.get(question.topic_id)
                if topic:
                    topic_name = topic.topic_name

            # Skip scoring for intro/closing questions
            if question.question_type in ["intro", "closing"]:
                answer = Answer(
                    session_id=session_id,
                    question_id=question_id,
                    answer_text=answer_text,
                    ai_score=5.0,
                    relevance_score=5.0,
                    clarity_score=5.0,
                    depth_score=5.0,
                    ai_feedback="Introduction/closing response noted.",
                    submitted_at=datetime.utcnow()
                )
                db.session.add(answer)
                db.session.commit()
                return answer.to_dict(), None

            # Get AI evaluation
            ai = get_ai_interviewer()
            scores = ai.evaluate_answer(
                question=question.question_text,
                answer=answer_text,
                topic=topic_name,
                role_name=interview.role_name,
                experience_level=interview.experience_level
            )

            # Check plagiarism if multiple candidates
            similarity_score = None
            try:
                from app.services.plagiarism_detector import get_plagiarism_detector
                pd = get_plagiarism_detector()
                similarity_score = pd.check_answer_similarity(
                    answer_text=answer_text,
                    interview_id=interview.id,
                    exclude_session_id=session_id
                )
            except Exception:
                pass

            # Save answer with scores
            answer = Answer(
                session_id=session_id,
                question_id=question_id,
                answer_text=answer_text,
                ai_score=scores.get("overall_score", 5.0),
                relevance_score=scores.get("relevance_score", 5.0),
                clarity_score=scores.get("clarity_score", 5.0),
                depth_score=scores.get("depth_score", 5.0),
                ai_feedback=scores.get("feedback", ""),
                is_ai_generated=scores.get("is_ai_generated", False),
                similarity_score=similarity_score,
                submitted_at=datetime.utcnow()
            )
            db.session.add(answer)

            # Flag AI-generated answers
            if scores.get("is_ai_generated", False):
                from app.models.cheat_log import CheatLog
                cheat = CheatLog(
                    session_id=session_id,
                    cheat_type="ai_generated_answer",
                    severity="critical",
                    description="AI detected this answer may be AI-generated.",
                    detected_at=datetime.utcnow()
                )
                db.session.add(cheat)

            db.session.commit()
            return answer.to_dict(), None

        except Exception as e:
            db.session.rollback()
            return None, str(e)

    def calculate_session_score(self, session_id):
        """
        Calculate the final score for a completed interview session.
        Applies topic weightages and cheat penalties.
        Returns final_score (0-100), grade, and breakdown.
        """
        try:
            session   = InterviewSession.query.get(session_id)
            interview = Interview.query.get(session.interview_id)
            answers   = Answer.query.filter_by(session_id=session_id).all()
            topics    = InterviewTopic.query.filter_by(interview_id=interview.id).all()

            if not answers:
                return 0.0, "F", {}

            # Build topic weightage map
            topic_weights = {}
            for t in topics:
                topic_weights[t.id] = t.weightage

            # Calculate weighted score
            total_weight  = 0
            weighted_sum  = 0
            answer_scores = []

            for ans in answers:
                question = Question.query.get(ans.question_id)
                if not question:
                    continue

                score = ans.ai_score or 0.0
                # Convert 0-10 to 0-100
                score_100 = score * 10

                weight = 1.0
                if question.topic_id and question.topic_id in topic_weights:
                    weight = topic_weights[question.topic_id] / 10.0

                weighted_sum  += score_100 * weight
                total_weight  += weight
                answer_scores.append({
                    "question_id": question.id,
                    "question":    question.question_text[:80],
                    "score":       score_100,
                    "weight":      weight,
                    "feedback":    ans.ai_feedback
                })

            # Base score
            base_score = (weighted_sum / total_weight) if total_weight > 0 else 0

            # Apply cheat penalties
            cheat_logs   = CheatLog.query.filter_by(session_id=session_id).all()
            total_penalty = 0.0
            cheat_breakdown = {}

            for log in cheat_logs:
                penalty = self.CHEAT_PENALTIES.get(log.severity, 0)
                total_penalty += penalty
                cheat_breakdown[log.cheat_type] = cheat_breakdown.get(log.cheat_type, 0) + 1

            # Cap penalty at 50%
            total_penalty = min(total_penalty, 50.0)
            final_score   = max(0.0, base_score - total_penalty)
            final_score   = round(final_score, 2)

            # Calculate grade
            grade = self._calculate_grade(final_score)

            # Save to session
            session.total_score = final_score
            db.session.commit()

            breakdown = {
                "base_score":      round(base_score, 2),
                "cheat_penalty":   round(total_penalty, 2),
                "final_score":     final_score,
                "grade":           grade,
                "total_answers":   len(answers),
                "cheat_events":    len(cheat_logs),
                "cheat_breakdown": cheat_breakdown,
                "answer_scores":   answer_scores
            }

            return final_score, grade, breakdown

        except Exception as e:
            print(f"Scoring error: {e}")
            return 0.0, "F", {"error": str(e)}

    def calculate_percentile(self, session_id):
        """
        Calculate percentile rank among all candidates for same interview.
        """
        try:
            session   = InterviewSession.query.get(session_id)
            interview = Interview.query.get(session.interview_id)

            # Get all completed sessions for this interview
            all_sessions = InterviewSession.query.filter_by(
                interview_id=interview.id,
                status="completed"
            ).filter(
                InterviewSession.total_score.isnot(None)
            ).all()

            if len(all_sessions) <= 1:
                return 100.0

            scores = [s.total_score for s in all_sessions]
            scores.sort()

            my_score = session.total_score or 0
            rank     = sum(1 for s in scores if s <= my_score)
            percentile = (rank / len(scores)) * 100

            session.percentile = round(percentile, 1)
            db.session.commit()

            return session.percentile

        except Exception as e:
            print(f"Percentile error: {e}")
            return 0.0

    def _calculate_grade(self, score):
        if score >= 90: return "A+"
        if score >= 80: return "A"
        if score >= 70: return "B+"
        if score >= 60: return "B"
        if score >= 50: return "C"
        return "F"

    def get_interview_rankings(self, interview_id):
        """
        Get ranked list of all candidates for an interview.
        """
        try:
            sessions = InterviewSession.query.filter_by(
                interview_id=interview_id,
                status="completed"
            ).filter(
                InterviewSession.total_score.isnot(None)
            ).order_by(
                InterviewSession.total_score.desc()
            ).all()

            rankings = []
            for rank, session in enumerate(sessions, 1):
                from app.models.user import User
                candidate = User.query.get(session.candidate_id)
                rankings.append({
                    "rank":          rank,
                    "candidate_id":  session.candidate_id,
                    "candidate_name": candidate.full_name if candidate else "Unknown",
                    "candidate_email": candidate.email if candidate else "",
                    "session_id":    session.id,
                    "total_score":   session.total_score,
                    "grade":         self._calculate_grade(session.total_score),
                    "percentile":    session.percentile,
                    "cheat_score":   session.cheat_score,
                    "status":        session.status,
                    "completed_at":  session.ended_at.isoformat() if session.ended_at else None
                })

            return rankings

        except Exception as e:
            print(f"Rankings error: {e}")
            return []


# Singleton
_scoring_engine = None

def get_scoring_engine():
    global _scoring_engine
    if _scoring_engine is None:
        _scoring_engine = ScoringEngine()
    return _scoring_engine