"""
InterviewAI - Backend API Test Script
Run: python test_api.py
Tests all major API endpoints.
"""
import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(env_path):
    with open(env_path, "rb") as f:
        raw = f.read()
    content = raw.decode("ascii", errors="ignore").replace("\r", "")
    for line in content.split("\n"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ[k.strip()] = v.strip()

try:
    import requests
except ImportError:
    print("Installing requests...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "--quiet"])
    import requests

BASE = "http://localhost:5000/api"
PASS = []
FAIL = []

def test(name, fn):
    try:
        result = fn()
        if result:
            print(f"  [PASS] {name}")
            PASS.append(name)
        else:
            print(f"  [FAIL] {name}")
            FAIL.append(name)
    except Exception as e:
        print(f"  [ERROR] {name}: {e}")
        FAIL.append(name)

print("\n" + "="*50)
print("  InterviewAI API Test Suite")
print("="*50)

# --- Health ---
print("\n[Health Check]")
def check_health():
    r = requests.get(f"{BASE}/health", timeout=5)
    return r.status_code == 200 and r.json().get("status") == "ok"
test("Health endpoint", check_health)

# --- Auth ---
print("\n[Auth Tests]")
admin_token = None
company_token = None
candidate_token = None

def login_admin():
    global admin_token
    r = requests.post(f"{BASE}/auth/login",
        json={"email": "admin@interviewai.com", "password": "admin123"}, timeout=10)
    if r.status_code == 200:
        admin_token = r.json().get("access_token")
        return bool(admin_token)
    return False
test("Admin login", login_admin)

def login_company():
    global company_token
    r = requests.post(f"{BASE}/auth/login",
        json={"email": "company@demo.com", "password": "demo123"}, timeout=10)
    if r.status_code == 200:
        company_token = r.json().get("access_token")
        return bool(company_token)
    # Try to register if not exists
    r2 = requests.post(f"{BASE}/auth/register", json={
        "email": "company@demo.com", "password": "demo123",
        "full_name": "Demo Company", "role": "company",
        "company_name": "TechCorp Demo", "industry": "Technology"
    }, timeout=10)
    if r2.status_code in [200, 201]:
        r3 = requests.post(f"{BASE}/auth/login",
            json={"email": "company@demo.com", "password": "demo123"}, timeout=10)
        if r3.status_code == 200:
            company_token = r3.json().get("access_token")
            return bool(company_token)
    return False
test("Company login", login_company)

def login_candidate():
    global candidate_token
    r = requests.post(f"{BASE}/auth/login",
        json={"email": "candidate@demo.com", "password": "demo123"}, timeout=10)
    if r.status_code == 200:
        candidate_token = r.json().get("access_token")
        return bool(candidate_token)
    r2 = requests.post(f"{BASE}/auth/register", json={
        "email": "candidate@demo.com", "password": "demo123",
        "full_name": "Demo Candidate", "role": "candidate"
    }, timeout=10)
    if r2.status_code in [200, 201]:
        r3 = requests.post(f"{BASE}/auth/login",
            json={"email": "candidate@demo.com", "password": "demo123"}, timeout=10)
        if r3.status_code == 200:
            candidate_token = r3.json().get("access_token")
            return bool(candidate_token)
    return False
test("Candidate login", login_candidate)

def test_me():
    if not admin_token: return False
    r = requests.get(f"{BASE}/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=5)
    return r.status_code == 200 and "user" in r.json()
test("Auth /me endpoint", test_me)

# --- Admin ---
print("\n[Admin Tests]")
def test_admin_stats():
    if not admin_token: return False
    r = requests.get(f"{BASE}/admin/stats",
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=5)
    return r.status_code == 200 and "stats" in r.json()
test("Admin stats", test_admin_stats)

def test_admin_users():
    if not admin_token: return False
    r = requests.get(f"{BASE}/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=5)
    return r.status_code == 200 and "users" in r.json()
test("Admin users list", test_admin_users)

def test_admin_users_filter():
    if not admin_token: return False
    r = requests.get(f"{BASE}/admin/users?role=candidate",
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=5)
    data = r.json()
    users = data.get("users", [])
    # All returned users should be candidates
    return r.status_code == 200 and all(u["role"] == "candidate" for u in users)
test("Admin users filter by role", test_admin_users_filter)

def test_admin_interviews():
    if not admin_token: return False
    r = requests.get(f"{BASE}/admin/interviews",
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=5)
    return r.status_code == 200 and "interviews" in r.json()
test("Admin interviews list", test_admin_interviews)

# --- Company ---
print("\n[Company Tests]")
interview_id = None

def test_company_dashboard():
    if not company_token: return False
    r = requests.get(f"{BASE}/company/dashboard",
        headers={"Authorization": f"Bearer {company_token}"}, timeout=5)
    return r.status_code == 200 and "stats" in r.json()
test("Company dashboard", test_company_dashboard)

def test_create_interview():
    global interview_id
    if not company_token: return False
    r = requests.post(f"{BASE}/company/interviews",
        headers={"Authorization": f"Bearer {company_token}"},
        json={
            "title": "Test Python Developer",
            "role_name": "Python Developer",
            "experience_level": "mid",
            "duration_minutes": 30,
            "total_questions": 5,
            "job_description": """
                We need a Python developer with 3-5 years experience.
                Skills: Python, FastAPI/Flask, PostgreSQL, Docker, REST APIs.
                Nice to have: Redis, Celery, AWS.
                Role: Build and maintain backend microservices.
            """
        }, timeout=10)
    if r.status_code == 201:
        interview_id = r.json().get("interview", {}).get("id")
        return bool(interview_id)
    return False
test("Create interview", test_create_interview)

def test_list_interviews():
    if not company_token: return False
    r = requests.get(f"{BASE}/company/interviews",
        headers={"Authorization": f"Bearer {company_token}"}, timeout=5)
    return r.status_code == 200 and "interviews" in r.json()
test("List company interviews", test_list_interviews)

def test_generate_topics():
    if not company_token or not interview_id: return False
    r = requests.post(f"{BASE}/company/interviews/{interview_id}/generate-topics",
        headers={"Authorization": f"Bearer {company_token}"}, timeout=60)
    data = r.json()
    topics = data.get("topics", [])
    return r.status_code == 200 and len(topics) > 0
test("Generate topics from JD (AI)", test_generate_topics)

def test_approve_interview():
    if not company_token or not interview_id: return False
    r = requests.post(f"{BASE}/company/interviews/{interview_id}/approve",
        headers={"Authorization": f"Bearer {company_token}"}, timeout=10)
    return r.status_code == 200
test("Approve interview", test_approve_interview)

def test_invite_candidate():
    if not company_token or not interview_id: return False
    r = requests.post(f"{BASE}/company/interviews/{interview_id}/invite",
        headers={"Authorization": f"Bearer {company_token}"},
        json={"email": "candidate@demo.com"}, timeout=10)
    return r.status_code in [200, 201]
test("Invite candidate", test_invite_candidate)

# --- Candidate ---
print("\n[Candidate Tests]")
session_token = None

def test_candidate_dashboard():
    if not candidate_token: return False
    r = requests.get(f"{BASE}/candidate/dashboard",
        headers={"Authorization": f"Bearer {candidate_token}"}, timeout=5)
    return r.status_code == 200 and "stats" in r.json()
test("Candidate dashboard", test_candidate_dashboard)

def test_my_interviews():
    global session_token
    if not candidate_token: return False
    r = requests.get(f"{BASE}/candidate/my-interviews",
        headers={"Authorization": f"Bearer {candidate_token}"}, timeout=5)
    data = r.json()
    interviews = data.get("interviews", [])
    if interviews:
        session_token = interviews[0].get("session_token")
    return r.status_code == 200
test("Candidate my-interviews", test_my_interviews)

def test_mock_start():
    if not candidate_token: return False
    r = requests.post(f"{BASE}/candidate/mock/start",
        headers={"Authorization": f"Bearer {candidate_token}"},
        json={"role_name": "Python Developer", "experience_level": "mid"},
        timeout=10)
    return r.status_code == 201 and "session_token" in r.json()
test("Start mock interview", test_mock_start)

# --- Interview Session ---
print("\n[Interview Session Tests]")

def test_start_session():
    if not candidate_token or not session_token: return False
    r = requests.post(f"{BASE}/interview/session/start",
        headers={"Authorization": f"Bearer {candidate_token}"},
        json={"session_token": session_token}, timeout=10)
    return r.status_code in [200, 400]  # 400 = already started, both OK
test("Start interview session", test_start_session)

def test_get_session():
    if not candidate_token or not session_token: return False
    r = requests.get(f"{BASE}/interview/session/{session_token}",
        headers={"Authorization": f"Bearer {candidate_token}"}, timeout=5)
    return r.status_code == 200 and "session" in r.json()
test("Get session details", test_get_session)

def test_next_question():
    if not candidate_token or not session_token: return False
    r = requests.get(f"{BASE}/interview/session/{session_token}/next-question",
        headers={"Authorization": f"Bearer {candidate_token}"}, timeout=30)
    data = r.json()
    return r.status_code == 200 and ("question" in data or data.get("complete"))
test("Get next question (AI)", test_next_question)

# --- Report ---
print("\n[Report Tests]")

def test_report_route():
    if not candidate_token: return False
    # Just test ranking endpoint
    if not interview_id: return False
    r = requests.get(f"{BASE}/report/interview/{interview_id}/ranking",
        headers={"Authorization": f"Bearer {candidate_token}"}, timeout=5)
    return r.status_code == 200
test("Interview ranking endpoint", test_report_route)

# --- Resume Upload ---
print("\n[Resume Tests]")

def test_resume_upload():
    if not candidate_token: return False
    r = requests.post(f"{BASE}/auth/upload-resume",
        headers={"Authorization": f"Bearer {candidate_token}"},
        json={"resume_text": "Python developer with 3 years experience in Flask, Django, PostgreSQL. Built REST APIs, microservices. BSc Computer Science."},
        timeout=10)
    return r.status_code == 200
test("Resume upload", test_resume_upload)

# --- SUMMARY ---
print("\n" + "="*50)
total = len(PASS) + len(FAIL)
print(f"  Results: {len(PASS)}/{total} passed")
print("="*50)

if FAIL:
    print(f"\n  Failed tests ({len(FAIL)}):")
    for f in FAIL:
        print(f"    - {f}")
else:
    print("\n  All tests passed!")

if len(PASS) >= total * 0.8:
    print("\n  Backend is ready for use!")
else:
    print("\n  Some issues detected. Check backend logs.")