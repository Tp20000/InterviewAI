import sys
import os

# Read .env manually - strip CR characters explicitly
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
print(f"Reading .env from: {env_path}")

with open(env_path, "rb") as f:
    raw = f.read()

# Decode and remove ALL carriage returns
content = raw.decode("ascii", errors="ignore").replace("\r", "")

for line in content.split("\n"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip()
        os.environ[k] = v
        if "GROQ" in k:
            print(f"Set {k} = [{v[:8]}...{v[-4:]}] len={len(v)}")

key = os.environ.get("GROQ_API_KEY", "")
print(f"\nKey retrieved: [{key[:8]}...{key[-4:]}]")
print(f"Key length: {len(key)}")

if len(key) < 20:
    print("ERROR: Key too short or not loaded!")
    sys.exit(1)

print("\nTesting Groq API directly...")
from groq import Groq
client = Groq(api_key=key)
resp = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": "Reply with exactly: GROQ_OK"}],
    max_tokens=20
)
reply = resp.choices[0].message.content.strip()
print(f"Groq replied: {reply}")

# Test Topic Generator
print("\n--- Topic Generator ---")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.services.topic_generator import TopicGenerator
gen = TopicGenerator()
result = gen.generate_topics(
    job_description="Hiring Python Backend Developer. Flask, REST API, SQL, Docker required.",
    role_name="Python Backend Developer",
    experience_level="mid",
    total_questions=8
)
print(f"Topics: {len(result['topics'])}")
for t in result["topics"]:
    print(f"  {t['order_index']}. {t['topic_name']} - {t['weightage']}% ({t['difficulty']})")

# Test AI Interviewer
print("\n--- AI Interviewer ---")
from app.services.ai_interviewer import AIInterviewer
ai = AIInterviewer()
greeting = ai.generate_greeting("Priya", "Python Backend Developer", "TechCorp")
print(f"Greeting: {greeting}")

# Test Evaluation
print("\n--- Answer Evaluation ---")
scores = ai.evaluate_answer(
    question="What is a REST API?",
    answer="A REST API uses HTTP methods like GET, POST, PUT, DELETE to perform CRUD operations on resources identified by URLs. I have built several REST APIs using Flask.",
    topic="API Design",
    role_name="Python Backend Developer",
    experience_level="mid"
)
print(f"Scores -> Technical:{scores['technical_score']} Relevance:{scores['relevance_score']} Overall:{scores['overall_score']}")
print(f"Feedback: {scores['feedback']}")

print("\n=============================")
print("  ALL GROQ TESTS PASSED!")
print("=============================")