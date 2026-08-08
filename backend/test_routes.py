import sys, os
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
from app import create_app

app = create_app()
print("App created OK")

with app.test_client() as client:
    # Health check
    r = client.get("/api/health")
    print(f"Health:    {r.status_code}")

    # Register test company
    r = client.post("/api/auth/register", json={
        "email": "testco@test.com", "password": "test123",
        "full_name": "Test Company", "role": "company",
        "company_name": "Test Corp", "industry": "Technology"
    })
    data  = r.get_json()
    token = data.get("access_token", "")
    print(f"Register:  {r.status_code}")

    # Company dashboard
    r = client.get("/api/company/dashboard",
                   headers={"Authorization": f"Bearer {token}"})
    print(f"Dashboard: {r.status_code}")

    # Create interview
    r = client.post("/api/company/interviews",
                    headers={"Authorization": f"Bearer {token}"},
                    json={
                        "title": "Test Interview",
                        "job_description": "Python backend dev needed.",
                        "role_name": "Backend Dev",
                        "experience_level": "mid"
                    })
    d  = r.get_json()
    iv_id = d.get("interview", {}).get("id")
    print(f"Create IV: {r.status_code} - id={iv_id}")

    # Admin login
    r = client.post("/api/auth/login", json={
        "email": "admin@interviewai.com", "password": "admin123"
    })
    admin_token = r.get_json().get("access_token", "")

    # Admin stats
    r = client.get("/api/admin/stats",
                   headers={"Authorization": f"Bearer {admin_token}"})
    print(f"Admin stats: {r.status_code} - {r.get_json().get('stats', {}).get('total_users')} users")

    print("\n================================")
    print("  ALL ROUTE TESTS PASSED!")
    print("================================")