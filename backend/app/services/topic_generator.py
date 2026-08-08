import os
import json
import requests
import time

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

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def _call_groq_raw(messages, model="llama-3.1-8b-instant",
                   temperature=0.3, max_tokens=600, timeout=60):
    """
    Direct HTTP to Groq. Very explicit error handling.
    """
    api_key = os.environ.get("GROQ_API_KEY", "")

    print("[Groq] API key set: " + str(bool(api_key and len(api_key) > 10)))
    print("[Groq] Model: " + model)
    print("[Groq] Calling API...")

    if not api_key or len(api_key) < 20:
        raise ValueError("GROQ_API_KEY not set or too short: '" + api_key[:5] + "'")

    start = time.time()
    try:
        resp = requests.post(
            GROQ_URL,
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
        elapsed = round(time.time() - start, 2)
        print("[Groq] Response in " + str(elapsed) + "s, status: " + str(resp.status_code))

        if resp.status_code != 200:
            print("[Groq] Error body: " + resp.text[:300])
            raise Exception(
                "Groq HTTP " + str(resp.status_code) + ": " + resp.text[:200]
            )

        data    = resp.json()
        content = data["choices"][0]["message"]["content"].strip()
        print("[Groq] Got content (" + str(len(content)) + " chars)")
        return content

    except requests.exceptions.Timeout:
        elapsed = round(time.time() - start, 2)
        print("[Groq] TIMEOUT after " + str(elapsed) + "s")
        raise Exception("Groq timed out after " + str(elapsed) + "s")
    except requests.exceptions.ConnectionError as e:
        print("[Groq] CONNECTION ERROR: " + str(e))
        raise Exception("Cannot reach Groq API: " + str(e))
    except requests.exceptions.RequestException as e:
        print("[Groq] REQUEST ERROR: " + str(e))
        raise Exception("Groq request failed: " + str(e))


class TopicGenerator:
    def __init__(self):
        self.api_key = os.environ.get("GROQ_API_KEY", "")
        self.model   = "llama-3.1-8b-instant"
        print("[TopicGenerator] Init. Key set: " + str(bool(self.api_key)))

    def generate_topics(self, job_description, role_name,
                        experience_level, total_questions=10):
        print("[TopicGenerator] Generating for: " + role_name)

        prompt = (
            "Role: " + role_name + " | Level: " + experience_level + "\n"
            "JD snippet: " + job_description[:800] + "\n\n"
            "Create exactly 5 interview topics. Total weightage = 100.\n"
            "Reply with ONLY this JSON, nothing else:\n"
            '{"topics":[{"topic_name":"Python Basics","weightage":20,'
            '"difficulty":"medium","order_index":1}],'
            '"summary":"Topics for ' + role_name + '"}'
        )

        try:
            content = _call_groq_raw(
                messages=[
                    {"role": "system",
                     "content": "You are a recruiter. Output valid JSON only. No markdown, no explanation."},
                    {"role": "user", "content": prompt}
                ],
                model=self.model,
                temperature=0.2,
                max_tokens=500,
                timeout=60
            )

            # Try to parse JSON
            start = content.find("{")
            end   = content.rfind("}") + 1
            if start < 0 or end <= start:
                print("[TopicGenerator] No JSON found in: " + content[:100])
                raise ValueError("No JSON in response")

            data   = json.loads(content[start:end])
            topics = data.get("topics", [])

            if not topics:
                print("[TopicGenerator] Empty topics list")
                raise ValueError("Empty topics")

            # Normalize to 100
            total_w = sum(t.get("weightage", 0) for t in topics)
            if total_w > 0 and total_w != 100:
                for t in topics:
                    t["weightage"] = round((t["weightage"] / total_w) * 100)
                diff = 100 - sum(t.get("weightage", 0) for t in topics)
                if diff != 0 and topics:
                    topics[0]["weightage"] += diff

            print("[TopicGenerator] AI SUCCESS - " + str(len(topics)) + " topics")
            return {
                "topics":  topics,
                "summary": data.get("summary", "Topics for " + role_name),
                "success": True
            }

        except Exception as e:
            print("[TopicGenerator] AI FAILED: " + str(e))
            print("[TopicGenerator] Using fallback topics")
            return self._fallback(role_name, experience_level)

    def _fallback(self, role_name, experience_level):
        """Return default topics when AI fails."""
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