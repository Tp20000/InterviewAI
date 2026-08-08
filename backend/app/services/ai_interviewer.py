import os
import json
import random
import requests

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

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
FAST_MODEL   = "llama-3.1-8b-instant"
SCORE_MODEL  = "llama3-8b-8192"


def _call_groq(messages, model=FAST_MODEL,
               temperature=0.7, max_tokens=300, timeout=120):
    """Direct HTTP call to Groq - bypasses groq package issues."""
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set")

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
    except requests.exceptions.Timeout:
        raise Exception("Groq timeout after " + str(timeout) + "s")
    except Exception as e:
        raise Exception("Groq error: " + str(e))


class AIInterviewer:
    def __init__(self):
        self.api_key = os.environ.get("GROQ_API_KEY", "")
        if not self.api_key or len(self.api_key) < 20:
            raise ValueError("GROQ_API_KEY not set!")
        print("[AIInterviewer] Ready. Model: " + FAST_MODEL)

    def _chat(self, messages, temperature=0.7, max_tokens=200,
              model=None, timeout=120):
        return _call_groq(
            messages=messages,
            model=model or FAST_MODEL,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout
        )

    def generate_greeting(self, candidate_name, role_name, company_name):
        return self._chat([
            {"role": "system",
             "content": "You are Alex, a friendly AI interviewer. Be warm and professional."},
            {"role": "user",
             "content": (
                "Write a 2-3 sentence interview opening.\n"
                "Candidate: " + candidate_name + " | Role: " + role_name +
                " | Company: " + company_name + "\n"
                "Welcome them by first name, introduce yourself as Alex, "
                "ask them to introduce themselves."
             )}
        ], temperature=0.8, max_tokens=150)

    def generate_next_question(self, role_name, company_name, topics,
                                conversation_history, current_topic,
                                question_number, total_questions,
                                experience_level, last_answer="",
                                resume_text="", jd_text=""):
        progress = (question_number / max(total_questions, 1)) * 100
        phase = (
            "warmup (easy)" if progress < 20 else
            "technical"     if progress < 70 else
            "behavioral"    if progress < 90 else
            "closing"
        )

        ct_name = "General"
        if isinstance(current_topic, dict):
            ct_name = current_topic.get("topic_name", "General")
        elif isinstance(current_topic, str):
            ct_name = current_topic

        messages = [{
            "role": "system",
            "content": (
                "You are Alex, AI interviewer at " + company_name +
                " for " + role_name + " (" + experience_level + ").\n"
                "Topic: " + ct_name + " | Phase: " + phase +
                " | Q" + str(question_number) + "/" + str(total_questions) + "\n"
                "Ask ONE specific question. Sound human. Max 2 sentences. "
                "No preamble, just the question."
            )
        }]

        # Last 4 messages for context
        for msg in conversation_history[-4:]:
            messages.append(msg)

        user_msg = "Ask the next question."
        if last_answer:
            user_msg = (
                "Candidate just answered: " + last_answer[:200] +
                "\n\nAsk the next relevant question."
            )
        messages.append({"role": "user", "content": user_msg})

        return self._chat(messages, temperature=0.7, max_tokens=120)

    def generate_closing(self, candidate_name, role_name):
        return self._chat([
            {"role": "system", "content": "You are Alex, AI interviewer."},
            {"role": "user",   "content": (
                "2-sentence closing for " + candidate_name +
                " finishing interview for " + role_name +
                ". Thank them, say results will be shared soon."
            )}
        ], temperature=0.7, max_tokens=100)

    def evaluate_answer(self, question, answer, topic,
                        role_name, experience_level):
        if not answer or len(answer.strip()) < 5:
            return {
                "technical_score": 0, "relevance_score": 0,
                "clarity_score":   0, "depth_score":     0,
                "overall_score":   0,
                "feedback":        "No answer provided.",
                "is_ai_generated": False
            }

        try:
            result = self._chat([
                {"role": "system",
                 "content": "Score interview answers. Reply JSON only."},
                {"role": "user",
                 "content": (
                    "Role: " + role_name + " | Topic: " + topic + "\n"
                    "Q: " + question[:150] + "\n"
                    "A: " + answer[:300] + "\n\n"
                    "Score 0-10 each:\n"
                    '{"technical_score":7,"relevance_score":7,'
                    '"clarity_score":7,"depth_score":6,'
                    '"feedback":"2 sentence feedback.",'
                    '"is_ai_generated":false}'
                 )}
            ], temperature=0.2, max_tokens=180,
               model=SCORE_MODEL, timeout=90)

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
            "poor":    ["Thank you.", "Noted.", "I see."]
        }
        return random.choice(opts.get(quality, opts["average"]))


_instance = None

def get_ai_interviewer():
    global _instance
    if _instance is None:
        _instance = AIInterviewer()
    return _instance