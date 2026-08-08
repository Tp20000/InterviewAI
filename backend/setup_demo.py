"""
Run this once to create demo accounts for testing.
Usage: python setup_demo.py
"""
import warnings
warnings.filterwarnings("ignore")
import os, sys

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(env_path):
    with open(env_path, 'rb') as f:
        raw = f.read()
    content = raw.decode('ascii', errors='ignore').replace('\r', '')
    for line in content.split('\n'):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ[k.strip()] = v.strip()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from app.models.user import User
from app.models.interview import Company, Interview, InterviewTopic
from app.models.session import InterviewSession

app = create_app()

with app.app_context():
    print("Setting up demo accounts...")

    # Create demo company user
    co_user = User.query.filter_by(email='company@demo.com').first()
    if not co_user:
        co_user = User(
            email='company@demo.com',
            full_name='Demo Company HR',
            role='company'
        )
        co_user.set_password('demo123')
        db.session.add(co_user)
        db.session.flush()

        company = Company(
            user_id=co_user.id,
            company_name='Demo Tech Corp',
            industry='Technology',
            website='https://demo.com'
        )
        db.session.add(company)
        db.session.flush()
        print("  Created: company@demo.com / demo123")
    else:
        company = co_user.company
        print("  Exists:  company@demo.com")

    # Create demo candidate
    ca_user = User.query.filter_by(email='candidate@demo.com').first()
    if not ca_user:
        ca_user = User(
            email='candidate@demo.com',
            full_name='Demo Candidate',
            role='candidate'
        )
        ca_user.set_password('demo123')
        db.session.add(ca_user)
        db.session.flush()
        print("  Created: candidate@demo.com / demo123")
    else:
        print("  Exists:  candidate@demo.com")

    # Create a demo interview if none exists
    existing_iv = Interview.query.filter_by(company_id=company.id).first()
    if not existing_iv:
        interview = Interview(
            company_id=company.id,
            title='Python Backend Developer Interview',
            job_description='''We are looking for a skilled Python Backend Developer.

Requirements:
- 3+ years of Python development experience
- Strong knowledge of Flask or Django frameworks
- Experience with REST API design and development
- Database design with SQL (PostgreSQL/MySQL/SQLite)
- Understanding of Git version control
- Docker and containerization basics
- Problem-solving and analytical skills

Responsibilities:
- Design and implement scalable backend services
- Build and maintain REST APIs
- Write clean, maintainable code with proper documentation
- Collaborate with frontend team on API contracts
- Optimize application performance
- Participate in code reviews
''',
            role_name='Python Backend Developer',
            experience_level='mid',
            duration_minutes=45,
            total_questions=10,
            status='active'
        )
        db.session.add(interview)
        db.session.flush()

        topics = [
            InterviewTopic(interview_id=interview.id, topic_name='Python Fundamentals',    weightage=20, difficulty='medium', is_approved=True, order_index=1),
            InterviewTopic(interview_id=interview.id, topic_name='Flask & REST APIs',       weightage=25, difficulty='medium', is_approved=True, order_index=2),
            InterviewTopic(interview_id=interview.id, topic_name='Database & SQL',          weightage=20, difficulty='medium', is_approved=True, order_index=3),
            InterviewTopic(interview_id=interview.id, topic_name='System Design',           weightage=15, difficulty='hard',   is_approved=True, order_index=4),
            InterviewTopic(interview_id=interview.id, topic_name='Problem Solving',         weightage=10, difficulty='hard',   is_approved=True, order_index=5),
            InterviewTopic(interview_id=interview.id, topic_name='Behavioral & Teamwork',   weightage=10, difficulty='easy',   is_approved=True, order_index=6),
        ]
        for t in topics:
            db.session.add(t)
        db.session.flush()

        # Invite demo candidate
        session = InterviewSession(
            interview_id=interview.id,
            candidate_id=ca_user.id,
            status='scheduled'
        )
        db.session.add(session)
        db.session.commit()

        print("  Created: Demo Interview 'Python Backend Developer'")
        print("  Invited: candidate@demo.com to interview")
        print("  Session Token:", session.session_token)
    else:
        print("  Exists:  Demo interview already created")
        sess = InterviewSession.query.filter_by(
            interview_id=existing_iv.id,
            candidate_id=ca_user.id
        ).first()
        if sess:
            print("  Session Token:", sess.session_token)

    db.session.commit()

    print()
    print("=" * 50)
    print("Demo Setup Complete!")
    print("=" * 50)
    print()
    print("Test Accounts:")
    print("  Admin:     admin@interviewai.com / admin123")
    print("  Company:   company@demo.com / demo123")
    print("  Candidate: candidate@demo.com / demo123")
    print()
    print("Test Flow:")
    print("  1. Login as candidate@demo.com")
    print("  2. Go to Dashboard -> See scheduled interview")
    print("  3. Click 'Start Interview'")
    print("  4. AI will conduct the interview!")
    print()
    print("OR Login as company@demo.com to:")
    print("  - See the interview you created")
    print("  - View candidate list")
    print("  - See results after candidate completes")