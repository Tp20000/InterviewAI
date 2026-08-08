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
from app import create_app
app = create_app()

ok = 0
fail = 0

def check(name, cond, info=''):
    global ok, fail
    if cond:
        print('  PASS: ' + name)
        ok += 1
    else:
        print('  FAIL: ' + name + (' - ' + info if info else ''))
        fail += 1

with app.test_client() as c:
    print('\n=== AUTH TESTS ===')
    r = c.get('/api/health')
    check('Health endpoint', r.status_code == 200)

    r = c.post('/api/auth/login', json={'email':'admin@interviewai.com','password':'admin123'})
    check('Admin login', r.status_code == 200)
    admin_tok = r.get_json().get('access_token','') if r.status_code == 200 else ''

    r = c.post('/api/auth/login', json={'email':'company@demo.com','password':'demo123'})
    check('Company login', r.status_code == 200, str(r.get_json()))
    co_tok = r.get_json().get('access_token','') if r.status_code == 200 else ''

    r = c.post('/api/auth/login', json={'email':'candidate@demo.com','password':'demo123'})
    check('Candidate login', r.status_code == 200)
    ca_tok = r.get_json().get('access_token','') if r.status_code == 200 else ''

    r = c.get('/api/auth/me', headers={'Authorization':'Bearer '+admin_tok})
    check('Get me (admin)', r.status_code == 200)

    print('\n=== ADMIN TESTS ===')
    r = c.get('/api/admin/stats', headers={'Authorization':'Bearer '+admin_tok})
    check('Admin stats', r.status_code == 200)
    if r.status_code == 200:
        s = r.get_json().get('stats',{})
        print('    Users: ' + str(s.get('total_users',0)) + ', Interviews: ' + str(s.get('total_interviews',0)))

    r = c.get('/api/admin/users', headers={'Authorization':'Bearer '+admin_tok})
    check('Admin list users', r.status_code == 200)

    r = c.get('/api/admin/interviews', headers={'Authorization':'Bearer '+admin_tok})
    check('Admin list interviews', r.status_code == 200)

    print('\n=== COMPANY TESTS ===')
    r = c.get('/api/company/dashboard', headers={'Authorization':'Bearer '+co_tok})
    check('Company dashboard', r.status_code == 200)

    r = c.get('/api/company/interviews', headers={'Authorization':'Bearer '+co_tok})
    check('Company interviews list', r.status_code == 200)
    interviews = r.get_json().get('interviews',[]) if r.status_code == 200 else []
    iv_id = interviews[0]['id'] if interviews else None

    if iv_id:
        r = c.get('/api/company/interviews/'+str(iv_id), headers={'Authorization':'Bearer '+co_tok})
        check('Get single interview', r.status_code == 200)

        r = c.get('/api/company/interviews/'+str(iv_id)+'/candidates', headers={'Authorization':'Bearer '+co_tok})
        check('Get candidates', r.status_code == 200)
        candidates = r.get_json().get('candidates',[]) if r.status_code == 200 else []
        sess_tok = candidates[0]['session_token'] if candidates else None
        print('    Session token: ' + str(sess_tok))

    print('\n=== CANDIDATE TESTS ===')
    r = c.get('/api/candidate/dashboard', headers={'Authorization':'Bearer '+ca_tok})
    check('Candidate dashboard', r.status_code == 200)

    r = c.get('/api/candidate/my-interviews', headers={'Authorization':'Bearer '+ca_tok})
    check('My interviews', r.status_code == 200)
    my_ivs = r.get_json().get('interviews',[]) if r.status_code == 200 else []
    my_sess_tok = my_ivs[0]['session_token'] if my_ivs else None

    r = c.get('/api/candidate/mock/topics', headers={'Authorization':'Bearer '+ca_tok})
    check('Mock topics', r.status_code == 200)

    print('\n=== SESSION TESTS ===')
    if my_sess_tok:
        r = c.get('/api/interview/session/'+my_sess_tok, headers={'Authorization':'Bearer '+ca_tok})
        check('Get session', r.status_code == 200)

        r = c.post('/api/interview/session/start', headers={'Authorization':'Bearer '+ca_tok},
            json={'session_token': my_sess_tok})
        check('Start session', r.status_code in [200, 400], str(r.get_json()))

print()
print('=' * 45)
print('RESULTS: ' + str(ok) + ' passed, ' + str(fail) + ' failed out of ' + str(ok+fail))
if fail == 0:
    print('ALL TESTS PASSED!')
else:
    print('Check failures above')
print('=' * 45)