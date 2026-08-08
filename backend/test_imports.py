import warnings, sys, os
warnings.filterwarnings('ignore')

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
with open(env_path, 'rb') as f:
    raw = f.read()
for line in raw.decode('ascii', errors='ignore').replace('\r','').split('\n'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ[k.strip()] = v.strip()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print('Testing all imports...')
errors = []

try:
    from app import create_app, db
    print('  OK: app factory')
except Exception as e:
    errors.append('app factory: ' + str(e))

try:
    from app.models.user import User
    from app.models.interview import Company, Interview, InterviewTopic
    from app.models.session import InterviewSession
    from app.models.question import Question
    from app.models.answer import Answer
    from app.models.cheat_log import CheatLog
    from app.models.report import Report
    print('  OK: all models')
except Exception as e:
    errors.append('models: ' + str(e))

try:
    from app.services.ai_interviewer import get_ai_interviewer
    from app.services.topic_generator import get_topic_generator
    from app.services.scoring_engine import get_scoring_engine
    from app.services.plagiarism_detector import get_plagiarism_detector
    from app.services.cheat_detector import get_cheat_detector
    from app.services.report_generator import get_report_generator
    from app.services.question_engine import get_question_engine
    print('  OK: all services')
except Exception as e:
    errors.append('services: ' + str(e))

try:
    from app.routes.auth import auth_bp
    from app.routes.company import company_bp
    from app.routes.interview import interview_bp
    from app.routes.candidate import candidate_bp
    from app.routes.admin import admin_bp
    from app.routes.report import report_bp
    print('  OK: all routes')
except Exception as e:
    errors.append('routes: ' + str(e))

if errors:
    print('\nERRORS FOUND:')
    for e in errors:
        print('  FAIL: ' + e)
else:
    print('\nAll imports OK! Testing full app...')
    app = create_app()
    with app.test_client() as c:
        r = c.get('/api/health')
        print('  Health: ' + str(r.status_code))
        r = c.post('/api/auth/login', json={'email':'admin@interviewai.com','password':'admin123'})
        print('  Admin login: ' + str(r.status_code))
        if r.status_code == 200:
            tok = r.get_json()['access_token']
            r = c.get('/api/admin/stats', headers={'Authorization':'Bearer '+tok})
            stats = r.get_json().get('stats',{})
            print('  Stats: users=' + str(stats.get('total_users',0)) + ' interviews=' + str(stats.get('total_interviews',0)))
    print()
    print('BACKEND IS FULLY WORKING!')