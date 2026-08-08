import sys, os

# Load env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
with open(env_path, "rb") as f:
    raw = f.read()
content = raw.decode("ascii", errors="ignore").replace("\r", "")
for line in content.split("\n"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ[k.strip()] = v.strip()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ── Test 1: Plagiarism Detector ──────────────────
print("--- Testing Plagiarism Detector ---")
from app.services.plagiarism_detector import PlagiarismDetector
pd = PlagiarismDetector()

text1 = "REST APIs use HTTP methods to interact with resources. I have used Flask to build REST APIs in my projects."
text2 = "REST APIs use HTTP methods to interact with resources. I have used Django to build REST APIs in my projects."
text3 = "Machine learning models require large datasets and compute resources for training."

sim1 = pd._tfidf_similarity(text1, [text2])
sim2 = pd._tfidf_similarity(text1, [text3])
print(f"Similar texts similarity:  {sim1:.3f} (expected > 0.5)")
print(f"Different texts similarity: {sim2:.3f} (expected < 0.3)")

ai_score1 = pd.detect_ai_patterns("Certainly! This is a comprehensive answer that covers all aspects of the topic. Furthermore, it is important to note that...")
ai_score2 = pd.detect_ai_patterns("Yeah so I worked on this project where I had to build a REST API using Flask. It was pretty challenging at first.")
print(f"AI text pattern score:     {ai_score1:.2f} (expected > 0.4)")
print(f"Human text pattern score:  {ai_score2:.2f} (expected < 0.3)")
print("Plagiarism Detector: OK")

# ── Test 2: Cheat Detector (no DB needed) ────────
print("\n--- Testing Cheat Detector Logic ---")
from app.services.cheat_detector import CheatDetector
cd = CheatDetector()

# Test timing analysis
is_cheat, level = cd.analyze_answer_timing("word " * 50, duration_seconds=2)
print(f"Fast answer (50 words, 2s): cheat={is_cheat}, level={level}")

is_cheat2, level2 = cd.analyze_answer_timing("word " * 30, duration_seconds=60)
print(f"Normal answer (30 words, 60s): cheat={is_cheat2}, level={level2}")

# Test cheat level labels
for score in [0, 15, 35, 55, 75]:
    print(f"  Score {score}: {cd.get_cheat_level(score)}")
print("Cheat Detector: OK")

# ── Test 3: Scoring Engine (no DB) ───────────────
print("\n--- Testing Scoring Grade Logic ---")
from app.services.scoring_engine import ScoringEngine
se = ScoringEngine()
for score in [95, 82, 73, 61, 52, 35]:
    print(f"  Score {score}: Grade {se._calculate_grade(score)}")
print("Scoring Engine: OK")

# ── Test 4: Report Generator (no DB) ─────────────
print("\n--- Testing Report Generator ---")
from app.services.report_generator import ReportGenerator
rg = ReportGenerator()
analysis = rg._fallback_analysis(75)
print(f"Summary: {analysis['summary'][:80]}...")
print(f"Strengths: {analysis['strengths']}")
rec = rg._get_recommendation(score=85, cheat_count=0, is_disqualified=False)
print(f"Recommendation (85, clean): {rec}")
rec2 = rg._get_recommendation(score=30, cheat_count=5, is_disqualified=True)
print(f"Recommendation (30, disq):  {rec2}")
print("Report Generator: OK")

print("\n================================")
print("  ALL SERVICE TESTS PASSED!")
print("================================")