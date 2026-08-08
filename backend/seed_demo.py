"""
Seed demo accounts for InterviewAI.
Run: python seed_demo.py
Creates: company@demo.com / demo123 and candidate@demo.com / demo123
"""
import os
import sys
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

from app import create_app, db
from app.models.user import User
from app.models.interview import Company

app = create_app()

with app.app_context():
    db.create_all()

    # Demo company
    company_user = User.query.filter_by(email="company@demo.com").first()
    if not company_user:
        company_user = User(email="company@demo.com", full_name="Demo Company", role="company")
        company_user.set_password("demo123")
        db.session.add(company_user)
        db.session.flush()
        company = Company(user_id=company_user.id, company_name="TechCorp Demo",
                          industry="Technology", website="https://techcorp.demo")
        db.session.add(company)
        print("Created: company@demo.com / demo123")
    else:
        print("Already exists: company@demo.com")

    # Demo candidate
    cand_user = User.query.filter_by(email="candidate@demo.com").first()
    if not cand_user:
        cand_user = User(email="candidate@demo.com", full_name="Demo Candidate", role="candidate")
        cand_user.set_password("demo123")
        db.session.add(cand_user)
        print("Created: candidate@demo.com / demo123")
    else:
        print("Already exists: candidate@demo.com")

    db.session.commit()
    print("\nDemo accounts ready!")
    print("Admin:     admin@interviewai.com / admin123")
    print("Company:   company@demo.com / demo123")
    print("Candidate: candidate@demo.com / demo123")