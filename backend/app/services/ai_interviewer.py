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
    """
    Create Groq client compatible with any version.
    Handles the 'proxies' argument issue in newer versions.
    """
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key or len(api_key) < 20:
        raise ValueError("GROQ_API_KEY not set or invalid!")

    # Try different import/init methods for compatibility
    try:
        from groq import Groq
        # Try simple init first (works with most versions)
        try:
            client = Groq(api_key=api_key)
            # Test it works
            return client
        except TypeError as e:
            if "proxies" in str(e):
                # Newer groq version - use httpx directly
                import httpx
                client = Groq(
                    api_key=api_key,
                    http_client=httpx.Client()
                )
                return client
            raise e
    except Exception as e:
        raise Exception("Failed to create Groq client: " + str(e))


class AIInterviewer:
    def __init__(self):
        self.client = _create_groq_client()
        self.model  = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
        print("[AIInterviewer] Initialized with model: " + self.model)

    def _chat(self, messages, temperature=0.7, max_tokens=1024):
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            error_str = str(e)
            # Handle proxies error at runtime too
            if "proxies" in error_str:
                try:
                    import httpx
                    from groq import Groq
                    self.client = Groq(
                        api_key=os.environ.get("GROQ_API_KEY", ""),
                        http_client=httpx.Client()
                    )
                    response = self.client.chat.completions.create(
                        model=self.model,
                        messages=messages,
                        temperature=temperature,
                        max_tokens=max_tokens
                    )
                    return response.choices[0].message.content.strip()
                except Exception as e2:
                    raise Exception("Groq API error: " + str(e2))
            raise Exception("Groq API error: " + error_str)

    def generate_greeting(self, candidate_name, role_name, company_name):
        messages = [
            {"role": "system", "content": "You are Alex, a professional friendly AI interviewer. Keep responses concise and warm."},
            {"role": "user",   "content": (
                "Generate a warm professional interview opening.\n"
                "Candidate: " + candidate_name + "\n"
                "Role: " + role_name + "\n"
                "Company: " + company_name + "\n\n"
                "Welcome by first name, introduce yourself as Alex, mention role, "
                "ask them to introduce themselves. 3-4 sentences max."
            )}
        ]
        return self._chat(messages, temperature=0.8, max_tokens=200)

    def generate_next_question(self, role_name, company_name, topics,
                                conversation_history, current_topic,
                                question_number, total_questions,
                                experience_level, last_answer="",
                                resume_text="", jd_text=""):
        topics_str = ", ".join([t.get("topic_name", "") for t in topics])
        progress   = (question_number / max(total_questions, 1)) * 100

        if progress < 20:
            phase = "warmup - easy comfortable questions"
        elif progress < 70:
            phase = "core technical - detailed technical questions"
        elif progress < 90:
            phase = "behavioral - past experiences"
        else:
            phase = "closing - wrap up"

        ct_name = "General"
        if isinstance(current_topic, dict):
            ct_name = current_topic.get("topic_name", "General")
        elif isinstance(current_topic, str):
            ct_name = current_topic

        system_prompt = (
            "You are Alex, a professional AI interviewer at " + company_name +
            " interviewing for " + role_name + " (" + experience_level + " level).\n"
            "Topics: " + topics_str + "\n"
            "Current topic: " + ct_name + "\n"
            "Phase: " + phase + " | Q" + str(question_number) + "/" + str(total_questions) + "\n"
            "Rules:\n"
            "- Ask ONE clear specific question\n"
            "- Sound like a real human interviewer\n"
            "- Base follow-up on what candidate just said\n"
            "- Be concise (1-3 sentences max)\n"
        )

        messages = [{"role": "system", "content": system_prompt}]
        for msg in conversation_history[-12:]:
            messages.append(msg)

        user_content = "Generate the next interview question only. No preamble."
        if last_answer:
            user_content = "Candidate said: " + last_answer[:500] + "\n\n" + user_content
        if resume_text:
            user_content += "\n\nCandidate Resume:\n" + resume_text[:1000]
        if jd_text:
            user_content += "\n\nJob Description:\n" + jd_text[:500]

        messages.append({"role": "user", "content": user_content})
        return self._chat(messages, temperature=0.7, max_tokens=200)

    def generate_closing(self, candidate_name, role_name):
        messages = [
            {"role": "system", "content": "You are Alex, a professional AI interviewer."},
            {"role": "user",   "content": (
                "Generate 2-3 sentence closing for " + candidate_name +
                " who finished interviewing for " + role_name +
                ". Thank them, mention results will be shared."
            )}
        ]
        return self._chat(messages, temperature=0.7, max_tokens=150)

    def evaluate_answer(self, question, answer, topic, role_name, experience_level):
        if not answer or len(answer.strip()) < 10:
            return {
                "technical_score": 0, "relevance_score": 0,
                "clarity_score": 0, "depth_score": 0,
                "overall_score": 0, "feedback": "No meaningful answer.",
                "is_ai_generated": False
            }

        prompt = (
            "Role: " + role_name + " (" + experience_level + ")\n"
            "Topic: " + topic + "\n"
            "Question: " + question + "\n"
            "Answer: " + answer + "\n\n"
            "Score 0-10 each. Reply JSON only:\n"
            '{"technical_score":<0-10>,"relevance_score":<0-10>,'
            '"clarity_score":<0-10>,"depth_score":<0-10>,'
            '"feedback":"<2 sentences>","is_ai_generated":<true/false>}'
        )
        messages = [
            {"role": "system", "content": "Expert evaluator. Valid JSON only."},
            {"role": "user",   "content": prompt}
        ]
        try:
            result = self._chat(messages, temperature=0.3, max_tokens=300)
            start  = result.find("{")
            end    = result.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(result[start:end])
                ts   = float(data.get("technical_score", 5))
                rs   = float(data.get("relevance_score", 5))
                cs   = float(data.get("clarity_score",   5))
                ds   = float(data.get("depth_score",     5))
                data["overall_score"] = round(
                    (ts * 0.40) + (rs * 0.25) + (cs * 0.20) + (ds * 0.15), 2
                )
                return data
        except Exception as e:
            print("[AI] evaluate_answer error: " + str(e))

        return {
            "technical_score": 5, "relevance_score": 5,
            "clarity_score": 5, "depth_score": 5,
            "overall_score": 5, "feedback": "Evaluated.",
            "is_ai_generated": False
        }

    def generate_transition(self, quality="good"):
        opts = {
            "good":    ["Great answer!", "Excellent!", "Very insightful!"],
            "average": ["I see, thank you.", "Good.", "Alright."],
            "poor":    ["Thank you.", "I see.", "Alright."]
        }
        return random.choice(opts.get(quality, opts["average"]))


# Singleton
_ai_interviewer = None

def get_ai_interviewer():
    global _ai_interviewer
    if _ai_interviewer is None:
        _ai_interviewer = AIInterviewer()
    return _ai_interviewer