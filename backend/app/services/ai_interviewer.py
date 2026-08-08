import os
import json
import random

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


def _create_groq_client():
    """Create Groq client with extended timeout."""
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key or len(api_key) < 20:
        raise ValueError("GROQ_API_KEY not set!")

    try:
        import httpx
        from groq import Groq
        http_client = httpx.Client(
            timeout=httpx.Timeout(
                connect=30.0,
                read=240.0,
                write=30.0,
                pool=30.0
            )
        )
        try:
            return Groq(api_key=api_key, http_client=http_client)
        except TypeError:
            return Groq(api_key=api_key)
    except ImportError:
        from groq import Groq
        return Groq(api_key=api_key)
    except Exception as e:
        raise Exception("Groq client error: " + str(e))


# Model selection - use fast model for interviewing
INTERVIEW_MODEL  = "llama-3.1-8b-instant"   # Fast for interviews
EVALUATE_MODEL   = "llama3-8b-8192"          # Fast for scoring
FALLBACK_MODEL   = "llama-3.3-70b-versatile" # Accurate but slow


class AIInterviewer:
    def __init__(self):
        self.client = _create_groq_client()
        # Use fast model - 8b is much quicker than 70b
        self.model  = os.environ.get("GROQ_MODEL", INTERVIEW_MODEL)
        print("[AIInterviewer] Model: " + self.model)

    def _chat(self, messages, temperature=0.7, max_tokens=512,
              model=None):
        use_model = model or self.model
        try:
            response = self.client.chat.completions.create(
                model=use_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            error_str = str(e)
            print("[AIInterviewer] Error with " + use_model + ": " + error_str[:100])
            # Try fallback model
            if use_model != FALLBACK_MODEL:
                try:
                    response = self.client.chat.completions.create(
                        model=FALLBACK_MODEL,
                        messages=messages,
                        temperature=temperature,
                        max_tokens=max_tokens
                    )
                    return response.choices[0].message.content.strip()
                except Exception as e2:
                    raise Exception("All models failed: " + str(e2))
            raise Exception("Groq error: " + error_str)

    def generate_greeting(self, candidate_name, role_name, company_name):
        messages = [
            {"role": "system",
             "content": "You are Alex, a friendly AI interviewer. Be warm and professional."},
            {"role": "user",
             "content": (
                "Generate interview opening for:\n"
                "Candidate: " + candidate_name + "\n"
                "Role: " + role_name + "\n"
                "Company: " + company_name + "\n\n"
                "Welcome them, introduce yourself as Alex, ask them to introduce themselves. "
                "Keep it to 2-3 sentences."
             )}
        ]
        return self._chat(messages, temperature=0.8, max_tokens=150)

    def generate_next_question(self, role_name, company_name, topics,
                                conversation_history, current_topic,
                                question_number, total_questions,
                                experience_level, last_answer="",
                                resume_text="", jd_text=""):
        topics_str = ", ".join([t.get("topic_name", "") for t in topics[:5]])
        progress   = (question_number / max(total_questions, 1)) * 100

        phase = (
            "warmup" if progress < 20 else
            "core technical" if progress < 70 else
            "behavioral" if progress < 90 else
            "closing"
        )

        ct_name = "General"
        if isinstance(current_topic, dict):
            ct_name = current_topic.get("topic_name", "General")
        elif isinstance(current_topic, str):
            ct_name = current_topic

        system_prompt = (
            "You are Alex, AI interviewer at " + company_name +
            " for " + role_name + " (" + experience_level + ").\n"
            "Topic: " + ct_name + " | Phase: " + phase +
            " | Q" + str(question_number) + "/" + str(total_questions) + "\n"
            "Ask ONE specific question. Sound human. Max 2 sentences."
        )

        messages = [{"role": "system", "content": system_prompt}]

        # Only keep last 6 messages for speed
        for msg in conversation_history[-6:]:
            messages.append(msg)

        user_content = "Ask the next interview question."
        if last_answer:
            user_content = "Candidate said: " + last_answer[:300] + "\n\nAsk the next question."
        if resume_text and question_number <= 3:
            user_content += "\nResume: " + resume_text[:500]

        messages.append({"role": "user", "content": user_content})
        return self._chat(messages, temperature=0.7, max_tokens=150)

    def generate_closing(self, candidate_name, role_name):
        messages = [
            {"role": "system", "content": "You are Alex, AI interviewer."},
            {"role": "user",   "content": (
                "2-sentence closing for " + candidate_name +
                " who just finished interviewing for " + role_name +
                ". Thank them, say results will be shared soon."
            )}
        ]
        return self._chat(messages, temperature=0.7, max_tokens=100)

    def evaluate_answer(self, question, answer, topic,
                        role_name, experience_level):
        if not answer or len(answer.strip()) < 10:
            return {
                "technical_score": 0, "relevance_score": 0,
                "clarity_score":   0, "depth_score":     0,
                "overall_score":   0,
                "feedback":        "No meaningful answer provided.",
                "is_ai_generated": False
            }

        prompt = (
            "Score this interview answer.\n"
            "Role: " + role_name + " | Topic: " + topic + "\n"
            "Q: " + question[:200] + "\n"
            "A: " + answer[:400] + "\n\n"
            "JSON only:\n"
            '{"technical_score":7,"relevance_score":7,'
            '"clarity_score":7,"depth_score":7,'
            '"feedback":"2 sentence feedback","is_ai_generated":false}'
        )
        try:
            result = self._chat(
                [{"role": "system", "content": "Evaluator. JSON only."},
                 {"role": "user",   "content": prompt}],
                temperature=0.2,
                max_tokens=200,
                model=EVALUATE_MODEL
            )
            start = result.find("{")
            end   = result.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(result[start:end])
                ts   = float(data.get("technical_score", 5))
                rs   = float(data.get("relevance_score", 5))
                cs   = float(data.get("clarity_score",   5))
                ds   = float(data.get("depth_score",     5))
                data["overall_score"] = round(
                    ts * 0.40 + rs * 0.25 + cs * 0.20 + ds * 0.15, 2
                )
                return data
        except Exception as e:
            print("[AIInterviewer] Evaluate error: " + str(e))

        return {
            "technical_score": 5, "relevance_score": 5,
            "clarity_score":   5, "depth_score":     5,
            "overall_score":   5,
            "feedback":        "Answer evaluated.",
            "is_ai_generated": False
        }

    def generate_transition(self, quality="good"):
        opts = {
            "good":    ["Great answer!", "Excellent!", "Very insightful!"],
            "average": ["I see, thank you.", "Good.", "Alright."],
            "poor":    ["Thank you.", "I see.", "Noted."]
        }
        return random.choice(opts.get(quality, opts["average"]))


_ai_interviewer = None

def get_ai_interviewer():
    global _ai_interviewer
    if _ai_interviewer is None:
        _ai_interviewer = AIInterviewer()
    return _ai_interviewer