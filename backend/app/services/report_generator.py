import os
import json
import requests
from datetime import datetime
from app import db
from app.models.report    import Report
from app.models.session   import InterviewSession
from app.models.answer    import Answer
from app.models.question  import Question
from app.models.interview import Interview
from app.models.cheat_log import CheatLog
from app.models.user      import User

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


def _call_groq(messages, model="llama-3.1-8b-instant",
               temperature=0.4, max_tokens=600, timeout=120):
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return None
    try:
        resp = requests.post(
            GROQ_API_URL,
            headers={
                "Authorization": "Bearer " + api_key,
                "Content-Type":  "application/json"
            },
            json={
                "model":       model,
                "messages":    messages,
                "temperature": temperature,
                "max_tokens":  max_tokens
            },
            timeout=timeout
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print("[ReportGenerator] Groq error: " + str(e))
        return None


class ReportGenerator:
    def generate_report(self, session_id):
        try:
            session    = InterviewSession.query.get(session_id)
            interview  = Interview.query.get(session.interview_id)
            candidate  = User.query.get(session.candidate_id)
            answers    = Answer.query.filter_by(session_id=session_id).all()
            cheat_logs = CheatLog.query.filter_by(session_id=session_id).all()

            if not session or not interview:
                return None, "Session or interview not found"

            qa_pairs = []
            for ans in answers:
                q = Question.query.get(ans.question_id)
                if q:
                    qa_pairs.append({
                        "question": q.question_text[:100],
                        "answer":   ans.answer_text[:150],
                        "score":    ans.ai_score
                    })

            analysis = self._analyze(
                candidate_name=candidate.full_name if candidate else "Candidate",
                role_name=interview.role_name,
                experience_level=interview.experience_level,
                qa_pairs=qa_pairs,
                total_score=session.total_score or 0,
                cheat_count=len(cheat_logs)
            )

            recommendation = self._recommend(
                score=session.total_score or 0,
                cheat_count=len(cheat_logs),
                is_disqualified=session.status == "disqualified"
            )

            existing = Report.query.filter_by(session_id=session_id).first()
            if existing:
                existing.summary           = analysis.get("summary", "")
                existing.strengths         = json.dumps(analysis.get("strengths", []))
                existing.weaknesses        = json.dumps(analysis.get("weaknesses", []))
                existing.recommendation    = recommendation
                existing.detailed_analysis = analysis.get("detailed_analysis", "")
                existing.generated_at      = datetime.utcnow()
                db.session.commit()
                return existing, None

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

    def _analyze(self, candidate_name, role_name, experience_level,
                 qa_pairs, total_score, cheat_count):
        qa_text = ""
        for i, qa in enumerate(qa_pairs[:5], 1):
            qa_text += (
                "Q" + str(i) + ": " + qa["question"] +
                "\nA: " + qa["answer"] +
                "\nScore: " + str(qa["score"]) + "/10\n\n"
            )

        prompt = (
            "Analyze interview for " + candidate_name +
            " applying for " + role_name + ".\n"
            "Score: " + str(round(total_score, 1)) + "/100 | "
            "Cheating: " + str(cheat_count) + " events\n\n"
            "Q&A:\n" + qa_text +
            "JSON only:\n"
            '{"summary":"3 sentence summary",'
            '"strengths":["strength1","strength2","strength3"],'
            '"weaknesses":["weakness1","weakness2"],'
            '"detailed_analysis":"4 sentence analysis"}'
        )

        content = _call_groq([
            {"role": "system", "content": "Interview evaluator. JSON only."},
            {"role": "user",   "content": prompt}
        ], max_tokens=500, timeout=120)

        if content:
            try:
                start = content.find("{")
                end   = content.rfind("}") + 1
                if start >= 0 and end > start:
                    return json.loads(content[start:end])
            except Exception:
                pass

        return self._fallback(total_score)

    def _fallback(self, score):
        if score >= 80:
            return {
                "summary":   "Strong performance demonstrated across all areas.",
                "strengths": ["Good technical knowledge", "Clear communication", "Relevant experience"],
                "weaknesses": ["Could provide more specific examples"],
                "detailed_analysis": "The candidate performed well across all evaluated dimensions."
            }
        elif score >= 60:
            return {
                "summary":   "Adequate performance with room for improvement.",
                "strengths": ["Basic knowledge demonstrated", "Good attitude"],
                "weaknesses": ["Needs deeper technical knowledge", "More examples needed"],
                "detailed_analysis": "Average performance with some gaps in technical depth."
            }
        else:
            return {
                "summary":   "Needs significant improvement for this role.",
                "strengths": ["Showed willingness to learn"],
                "weaknesses": ["Insufficient technical knowledge", "Lacks relevant experience"],
                "detailed_analysis": "Did not meet the minimum requirements for this position."
            }

    def _recommend(self, score, cheat_count, is_disqualified):
        if is_disqualified:             return "not_recommend"
        if score >= 80 and cheat_count == 0: return "strongly_recommend"
        if score >= 65:                 return "recommend"
        if score >= 50:                 return "neutral"
        return "not_recommend"


_instance = None

def get_report_generator():
    global _instance
    if _instance is None:
        _instance = ReportGenerator()
    return _instance