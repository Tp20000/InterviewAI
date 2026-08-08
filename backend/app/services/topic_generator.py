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
    """Create Groq client with extended timeout."""
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key or len(api_key) < 20:
        raise ValueError("GROQ_API_KEY not set!")

    try:
        import httpx
        from groq import Groq

        # Use httpx with 240 second timeout
        http_client = httpx.Client(
            timeout=httpx.Timeout(
                connect=30.0,
                read=240.0,
                write=30.0,
                pool=30.0
            )
        )
        try:
            client = Groq(api_key=api_key, http_client=http_client)
            return client
        except TypeError:
            client = Groq(api_key=api_key)
            return client
    except Exception as e:
        try:
            from groq import Groq
            return Groq(api_key=api_key)
        except Exception as e2:
            raise Exception("Groq client error: " + str(e2))


class TopicGenerator:
    def __init__(self):
        self.client = _create_groq_client()
        # Use fastest model for topic generation
        self.model = "llama-3.1-8b-instant"  # Much faster than 70b!
        print("[TopicGenerator] Using model: " + self.model)

    def _chat(self, messages, temperature=0.4, max_tokens=1000):
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            error_msg = str(e)
            print("[TopicGenerator] Chat error: " + error_msg)
            # Try with fallback model
            try:
                response = self.client.chat.completions.create(
                    model="llama3-8b-8192",
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                return response.choices[0].message.content.strip()
            except Exception as e2:
                raise Exception("Groq API failed: " + str(e2))

    def generate_topics(self, job_description, role_name,
                        experience_level, total_questions=10):
        # Shorter, more focused prompt for faster response
        prompt = (
            "Role: " + role_name + " | Level: " + experience_level + "\n"
            "JD: " + job_description[:1500] + "\n\n"
            "Create 5-6 interview topics. Weightages sum to 100.\n"
            "JSON only, no other text:\n"
            '{"topics":[{"topic_name":"...","weightage":20,'
            '"difficulty":"medium","order_index":1}],'
            '"summary":"..."}'
        )

        try:
            content = self._chat([
                {"role": "system",
                 "content": "You are a recruiter. Reply with valid JSON only."},
                {"role": "user", "content": prompt}
            ], max_tokens=600)

            start = content.find("{")
            end   = content.rfind("}") + 1
            if start >= 0 and end > start:
                data   = json.loads(content[start:end])
                topics = data.get("topics", [])

                # Normalize weightages to 100
                total_w = sum(t.get("weightage", 0) for t in topics)
                if total_w > 0 and total_w != 100:
                    for t in topics:
                        t["weightage"] = round((t["weightage"] / total_w) * 100)

                # Fix if still not 100
                if topics:
                    current = sum(t.get("weightage", 0) for t in topics)
                    if current != 100:
                        topics[0]["weightage"] += (100 - current)

                if topics:
                    return {
                        "topics":  topics,
                        "summary": data.get("summary", "Topics generated for " + role_name),
                        "success": True
                    }
        except Exception as e:
            print("[TopicGenerator] Generation error: " + str(e))

        # Return fallback topics
        print("[TopicGenerator] Using fallback topics")
        return self._fallback_topics(role_name, experience_level)

    def _fallback_topics(self, role_name, experience_level):
        return {
            "topics": [
                {"topic_name": "Introduction & Background",
                 "weightage": 15, "difficulty": "easy",   "order_index": 1},
                {"topic_name": "Technical Fundamentals",
                 "weightage": 25, "difficulty": "medium", "order_index": 2},
                {"topic_name": "Problem Solving & Algorithms",
                 "weightage": 20, "difficulty": "medium", "order_index": 3},
                {"topic_name": "Past Projects & Experience",
                 "weightage": 20, "difficulty": "medium", "order_index": 4},
                {"topic_name": "Behavioral & Teamwork",
                 "weightage": 10, "difficulty": "easy",   "order_index": 5},
                {"topic_name": "Role-Specific Skills",
                 "weightage": 10, "difficulty": "hard",   "order_index": 6},
            ],
            "summary": "Standard interview topics for " + role_name + " (" + experience_level + ")",
            "success": False
        }


_topic_generator = None

def get_topic_generator():
    global _topic_generator
    if _topic_generator is None:
        _topic_generator = TopicGenerator()
    return _topic_generator