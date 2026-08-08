import os
import json
from datetime import datetime
from app import db
from app.models.report   import Report
from app.models.session  import InterviewSession
from app.models.answer   import Answer
from app.models.question import Question
from app.models.interview import Interview
from app.models.cheat_log import CheatLog
from app.models.user      import User


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


class ReportGenerator:
    """
    Generates comprehensive interview reports using AI analysis.
    """

    def generate_report(self, session_id):
        """
        Generate a full interview report for a session.
        Returns Report object.
        """
        try:
            session   = InterviewSession.query.get(session_id)
            interview = Interview.query.get(session.interview_id)
            candidate = User.query.get(session.candidate_id)
            answers   = Answer.query.filter_by(session_id=session_id).all()
            cheat_logs = CheatLog.query.filter_by(session_id=session_id).all()

            if not session or not interview:
                return None, "Session or interview not found"

            # Build Q&A summary
            qa_pairs = []
            for ans in answers:
                question = Question.query.get(ans.question_id)
                if question:
                    qa_pairs.append({
                        "question": question.question_text,
                        "answer":   ans.answer_text[:300],
                        "score":    ans.ai_score,
                        "feedback": ans.ai_feedback
                    })

            # Generate AI analysis
            analysis = self._generate_ai_analysis(
                candidate_name=candidate.full_name if candidate else "Candidate",
                role_name=interview.role_name,
                experience_level=interview.experience_level,
                qa_pairs=qa_pairs,
                total_score=session.total_score or 0,
                cheat_count=len(cheat_logs)
            )

            # Determine recommendation
            recommendation = self._get_recommendation(
                score=session.total_score or 0,
                cheat_count=len(cheat_logs),
                is_disqualified=session.status == "disqualified"
            )

            # Check for existing report
            existing = Report.query.filter_by(session_id=session_id).first()
            if existing:
                existing.summary          = analysis.get("summary", "")
                existing.strengths        = json.dumps(analysis.get("strengths", []))
                existing.weaknesses       = json.dumps(analysis.get("weaknesses", []))
                existing.recommendation   = recommendation
                existing.detailed_analysis = analysis.get("detailed_analysis", "")
                existing.generated_at     = datetime.utcnow()
                db.session.commit()
                return existing, None

            # Create new report
            report = Report(
                interview_id=interview.id,
                session_id=session_id,
                summary=analysis.get("summary", ""),
                strengths=json.dumps(analysis.get("strengths", [])),
                weaknesses=json.dumps(analysis.get("weaknesses", [])),
                recommendation=recommendation,
                detailed_analysis=analysis.get("detailed_analysis", ""),
                generated_at=datetime.utcnow()
            )
            db.session.add(report)
            db.session.commit()
            return report, None

        except Exception as e:
            db.session.rollback()
            return None, str(e)

    def _generate_ai_analysis(self, candidate_name, role_name, experience_level,
                               qa_pairs, total_score, cheat_count):
        """Use Groq AI to generate detailed analysis."""
        try:
            from groq import Groq
            api_key = os.environ.get("GROQ_API_KEY", "")
            model   = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

            if not api_key or len(api_key) < 20:
                return self._fallback_analysis(total_score)

            client = Groq(api_key=api_key)

            qa_text = ""
            for i, qa in enumerate(qa_pairs[:8], 1):
                qa_text += f"\nQ{i}: {qa['question']}\nA: {qa['answer'][:200]}\nScore: {qa['score']}/10\n"

            prompt = (
                f"Analyze this interview for {candidate_name} applying for {role_name} ({experience_level}).\n"
                f"Overall Score: {total_score}/100\n"
                f"Cheat Events: {cheat_count}\n\n"
                f"Interview Q&A:\n{qa_text}\n\n"
                f"Provide analysis in JSON:\n"
                f'{{"summary":"<3 sentence overall summary>",'
                f'"strengths":["<strength 1>","<strength 2>","<strength 3>"],'
                f'"weaknesses":["<weakness 1>","<weakness 2>"],'
                f'"detailed_analysis":"<5-6 sentence detailed analysis of performance>"}}'
            )

            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "Expert interview evaluator. Reply with valid JSON only."},
                    {"role": "user",   "content": prompt}
                ],
                temperature=0.4,
                max_tokens=800
            )

            content = response.choices[0].message.content.strip()
            start   = content.find("{")
            end     = content.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(content[start:end])

        except Exception as e:
            print(f"AI analysis error: {e}")

        return self._fallback_analysis(total_score)

    def _fallback_analysis(self, score):
        """Fallback analysis when AI is unavailable."""
        if score >= 80:
            return {
                "summary": "The candidate demonstrated strong technical knowledge and communication skills throughout the interview.",
                "strengths": ["Good technical knowledge", "Clear communication", "Relevant experience"],
                "weaknesses": ["Could provide more specific examples"],
                "detailed_analysis": "The candidate performed well across all evaluated dimensions."
            }
        elif score >= 60:
            return {
                "summary": "The candidate showed adequate knowledge with room for improvement in technical depth.",
                "strengths": ["Basic knowledge demonstrated", "Good communication"],
                "weaknesses": ["Needs deeper technical knowledge", "More real-world examples needed"],
                "detailed_analysis": "The candidate showed average performance with some gaps in technical depth."
            }
        else:
            return {
                "summary": "The candidate needs significant improvement in technical skills for this role.",
                "strengths": ["Showed willingness to learn"],
                "weaknesses": ["Insufficient technical knowledge", "Lacks relevant experience", "Needs improvement in communication"],
                "detailed_analysis": "The candidate did not meet the minimum requirements for this position."
            }

    def _get_recommendation(self, score, cheat_count, is_disqualified):
        """Determine hiring recommendation."""
        if is_disqualified:
            return "not_recommend"
        if score >= 80 and cheat_count == 0:
            return "strongly_recommend"
        if score >= 65:
            return "recommend"
        if score >= 50:
            return "neutral"
        return "not_recommend"


# Singleton
_report_generator = None

def get_report_generator():
    global _report_generator
    if _report_generator is None:
        _report_generator = ReportGenerator()
    return _report_generator