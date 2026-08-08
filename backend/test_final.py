import sys, os, warnings
warnings.filterwarnings('ignore')

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
with open(env_path, 'rb') as f:
    raw = f.read()
content = raw.decode('ascii', errors='ignore').replace('\r', '')
for line in content.split('\n'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ[k.strip()] = v.strip()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print('Loading app...')
from app import create_app
app = create_app()
print('App created OK')

passed = 0
failed = 0

def test(name, condition, detail=''):
    global passed, failed
    if condition:
        print(f'  PASS: {name}')
        passed += 1
    else:
        print(f'  FAIL: {name} - {detail}')
        failed += 1

with app.test_client() as c:

    # Test 1: Health check
    r = c.get('/api/health')
    test('Health check', r.status_code == 200, str(r.status_code))

    # Test 2: Register company
    r = c.post('/api/auth/register', json={
        'email': 'final_co@test.com',
        'password': 'test1234',
        'full_name': 'Final Company',
        'role': 'company',
        'company_name': 'Final Corp',
        'industry': 'Technology'
    })
    test('Company register', r.status_code in [201, 409], str(r.status_code))

    # Test 3: Company login
    r = c.post('/api/auth/login', json={'email': 'final_co@test.com', 'password': 'test1234'})
    test('Company login', r.status_code == 200, str(r.status_code))
    co_token = r.get_json().get('access_token', '') if r.status_code == 200 else ''

    # Test 4: Create interview
    if co_token:
        r = c.post('/api/company/interviews',
            headers={'Authorization': 'Bearer ' + co_token},
            json={
                'title': 'Final Test Interview',
                'job_description': 'Python Flask developer needed with REST API experience.',
                'role_name': 'Python Developer',
                'experience_level': 'mid'
            })
        test('Create interview', r.status_code == 201, str(r.status_code))
        iv_id = r.get_json().get('interview', {}).get('id', 0) if r.status_code == 201 else 0
    else:
        test('Create interview', False, 'No token')
        iv_id = 0

    # Test 5: Register candidate
    r = c.post('/api/auth/register', json={
        'email': 'final_cand@test.com',
        'password': 'test1234',
        'full_name': 'Final Candidate',
        'role': 'candidate'
    })
    test('Candidate register', r.status_code in [201, 409], str(r.status_code))

    # Test 6: Candidate login
    r = c.post('/api/auth/login', json={'email': 'final_cand@test.com', 'password': 'test1234'})
    test('Candidate login', r.status_code == 200, str(r.status_code))
    ca_token = r.get_json().get('access_token', '') if r.status_code == 200 else ''

    # Test 7: Admin login
    r = c.post('/api/auth/login', json={'email': 'admin@interviewai.com', 'password': 'admin123'})
    test('Admin login', r.status_code == 200, str(r.status_code))
    ad_token = r.get_json().get('access_token', '') if r.status_code == 200 else ''

    # Test 8: Admin stats
    if ad_token:
        r = c.get('/api/admin/stats', headers={'Authorization': 'Bearer ' + ad_token})
        test('Admin stats', r.status_code == 200, str(r.status_code))
        if r.status_code == 200:
            stats = r.get_json().get('stats', {})
            print('    Users:', stats.get('total_users', 0))
            print('    Interviews:', stats.get('total_interviews', 0))
    else:
        test('Admin stats', False, 'No admin token')

    # Test 9: Candidate dashboard
    if ca_token:
        r = c.get('/api/candidate/dashboard', headers={'Authorization': 'Bearer ' + ca_token})
        test('Candidate dashboard', r.status_code == 200, str(r.status_code))
    else:
        test('Candidate dashboard', False, 'No token')

    # Test 10: Company dashboard
    if co_token:
        r = c.get('/api/company/dashboard', headers={'Authorization': 'Bearer ' + co_token})
        test('Company dashboard', r.status_code == 200, str(r.status_code))
    else:
        test('Company dashboard', False, 'No token')

    # Test 11: Company interviews list
    if co_token:
        r = c.get('/api/company/interviews', headers={'Authorization': 'Bearer ' + co_token})
        test('List interviews', r.status_code == 200, str(r.status_code))
    else:
        test('List interviews', False, 'No token')

    # Test 12: Candidate my-interviews
    if ca_token:
        r = c.get('/api/candidate/my-interviews', headers={'Authorization': 'Bearer ' + ca_token})
        test('My interviews', r.status_code == 200, str(r.status_code))
    else:
        test('My interviews', False, 'No token')

print()
print('=' * 45)
print('RESULTS: ' + str(passed) + ' passed, ' + str(failed) + ' failed')
if failed == 0:
    print('ALL TESTS PASSED! InterviewAI is ready!')
else:
    print('Some tests failed - check output above')
print('=' * 45)