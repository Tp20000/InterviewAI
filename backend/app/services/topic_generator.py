import os
import json

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
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key or len(api_key) < 20:
        raise ValueError("GROQ_API_KEY not set!")
    try:
        from groq import Groq
        try:
            return Groq(api_key=api_key)
        except TypeError as e:
            if "proxies" in str(e):
                import httpx
                return Groq(api_key=api_key, http_client=httpx.Client())
            raise e
    except Exception as e:
        raise Exception("Groq client error: " + str(e))


class TopicGenerator:
    def __init__(self):
        self.client = _create_groq_client()
        self.model  = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

    def _chat(self, messages, temperature=0.4, max_tokens=1500):
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            if "proxies" in str(e):
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
            raise e

    def generate_topics(self, job_description, role_name,
                        experience_level, total_questions=10):
        prompt = (
            "You are an expert technical recruiter.\n"
            "Job Role: " + role_name + "\n"
            "Experience Level: " + experience_level + "\n"
            "Total Questions: " + str(total_questions) + "\n"
            "Job Description:\n" + job_description[:3000] + "\n\n"
            "Generate 5-8 interview topics. Weightages must sum to 100.\n"
            "Reply in JSON only:\n"
            '{"topics":[{"topic_name":"...","weightage":20,'
            '"difficulty":"medium","order_index":1,"description":"..."}],'
            '"summary":"..."}'
        )
        try:
            content = self._chat([
                {"role": "system", "content": "Expert recruiter. Reply JSON only."},
                {"role": "user",   "content": prompt}
            ])
            start = content.find("{")
            end   = content.rfind("}") + 1
            if start >= 0 and end > start:
                data   = json.loads(content[start:end])
                topics = data.get("topics", [])
                total_w = sum(t.get("weightage", 0) for t in topics)
                if total_w != 100 and total_w > 0:
                    for t in topics:
                        t["weightage"] = round((t["weightage"] / total_w) * 100)
                return {
                    "topics":  topics,
                    "summary": data.get("summary", ""),
                    "success": True
                }
        except Exception as e:
            print("[TopicGenerator] Error: " + str(e))

        return self._fallback_topics(role_name, experience_level)

    def _fallback_topics(self, role_name, experience_level):
        return {
            "topics": [
                {"topic_name": "Introduction & Background", "weightage": 15,
                 "difficulty": "easy",   "order_index": 1, "description": "Background"},
                {"topic_name": "Technical Fundamentals",    "weightage": 25,
                 "difficulty": "medium", "order_index": 2, "description": "Core concepts"},
                {"topic_name": "Problem Solving",           "weightage": 20,
                 "difficulty": "medium", "order_index": 3, "description": "Analytical"},
                {"topic_name": "Past Projects",             "weightage": 20,
                 "difficulty": "medium", "order_index": 4, "description": "Experience"},
                {"topic_name": "Behavioral & Soft Skills",  "weightage": 10,
                 "difficulty": "easy",   "order_index": 5, "description": "Soft skills"},
                {"topic_name": "Role-Specific Knowledge",   "weightage": 10,
                 "difficulty": "hard",   "order_index": 6, "description": "Specialized"},
            ],
            "summary": "Standard topics for " + role_name,
            "success": False
        }

    def generate_topic_questions(self, topic_name, role_name,
                                  experience_level, count=2):
        try:
            content = self._chat([
                {"role": "system", "content": "Generate interview questions only."},
                {"role": "user",   "content": (
                    "Generate " + str(count) + " interview questions for topic '" +
                    topic_name + "', role '" + role_name +
                    "', level '" + experience_level + "'. Number them."
                )}
            ], temperature=0.6, max_tokens=400)
            questions = []
            for line in content.split("\n"):
                line = line.strip()
                if line and (line[0].isdigit() or line.startswith("-")):
                    q = line.lstrip("0123456789.-) ").strip()
                    if q:
                        questions.append(q)
            return questions[:count]
        except Exception:
            return ["Tell me about your experience with " + topic_name + "."]


_topic_generator = None

def get_topic_generator():
    global _topic_generator
    if _topic_generator is None:
        _topic_generator = TopicGenerator()
    return _topic_generator