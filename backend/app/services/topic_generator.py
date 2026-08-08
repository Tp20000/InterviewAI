import os
import json
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


def _call_groq(messages, model="llama-3.1-8b-instant",
               temperature=0.4, max_tokens=800, timeout=240):
    """
    Direct HTTP call to Groq API using requests.
    Bypasses the groq package to avoid proxy/timeout issues.
    """
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set")

    headers = {
        "Authorization": "Bearer " + api_key,
        "Content-Type":  "application/json"
    }
    payload = {
        "model":       model,
        "messages":    messages,
        "temperature": temperature,
        "max_tokens":  max_tokens
    }

    try:
        resp = requests.post(
            GROQ_API_URL,
            headers=headers,
            json=payload,
            timeout=timeout
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()
    except requests.exceptions.Timeout:
        raise Exception("Groq API timeout after " + str(timeout) + "s")
    except requests.exceptions.RequestException as e:
        raise Exception("Groq HTTP error: " + str(e))
    except (KeyError, IndexError) as e:
        raise Exception("Groq response parse error: " + str(e))


class TopicGenerator:
    def __init__(self):
        self.api_key = os.environ.get("GROQ_API_KEY", "")
        self.model   = "llama-3.1-8b-instant"
        print("[TopicGenerator] Ready. Model: " + self.model)

    def generate_topics(self, job_description, role_name,
                        experience_level, total_questions=10):
        prompt = (
            "Role: " + role_name + " | Level: " + experience_level + "\n"
            "Job Description:\n" + job_description[:1500] + "\n\n"
            "Generate 5-6 interview topics. Weightages must sum to 100.\n"
            "Reply with valid JSON only:\n"
            '{"topics":[{"topic_name":"Python Basics","weightage":20,'
            '"difficulty":"medium","order_index":1}],'
            '"summary":"Brief summary"}'
        )

        try:
            print("[TopicGenerator] Calling Groq API...")
            content = _call_groq(
                messages=[
                    {"role": "system",
                     "content": "You are a recruiter. Reply with valid JSON only. No extra text."},
                    {"role": "user", "content": prompt}
                ],
                model=self.model,
                temperature=0.3,
                max_tokens=600,
                timeout=180
            )
            print("[TopicGenerator] Got response: " + content[:100])

            # Parse JSON
            start = content.find("{")
            end   = content.rfind("}") + 1
            if start >= 0 and end > start:
                data   = json.loads(content[start:end])
                topics = data.get("topics", [])

                if topics:
                    # Normalize to 100%
                    total_w = sum(t.get("weightage", 0) for t in topics)
                    if total_w > 0 and total_w != 100:
                        for t in topics:
                            t["weightage"] = round(
                                (t["weightage"] / total_w) * 100
                            )
                        # Fix rounding
                        diff = 100 - sum(t.get("weightage", 0) for t in topics)
                        if diff != 0:
                            topics[0]["weightage"] += diff

                    print("[TopicGenerator] Generated " + str(len(topics)) + " topics")
                    return {
                        "topics":  topics,
                        "summary": data.get("summary", "AI-generated topics"),
                        "success": True
                    }
        except Exception as e:
            print("[TopicGenerator] Error: " + str(e))

        # Fallback topics
        print("[TopicGenerator] Using fallback topics")
        return self._fallback(role_name, experience_level)

    def _fallback(self, role_name, experience_level):
        return {
            "topics": [
                {"topic_name": "Introduction & Background",
                 "weightage": 15, "difficulty": "easy",   "order_index": 1},
                {"topic_name": "Technical Fundamentals",
                 "weightage": 25, "difficulty": "medium", "order_index": 2},
                {"topic_name": "Problem Solving",
                 "weightage": 20, "difficulty": "medium", "order_index": 3},
                {"topic_name": "Past Projects & Experience",
                 "weightage": 20, "difficulty": "medium", "order_index": 4},
                {"topic_name": "Behavioral & Teamwork",
                 "weightage": 10, "difficulty": "easy",   "order_index": 5},
                {"topic_name": "Role-Specific Knowledge",
                 "weightage": 10, "difficulty": "hard",   "order_index": 6},
            ],
            "summary": "Standard interview topics for " + role_name,
            "success": False
        }


_instance = None

def get_topic_generator():
    global _instance
    if _instance is None:
        _instance = TopicGenerator()
    return _instance