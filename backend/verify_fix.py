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

with app.test_client() as c:
    print("Testing 403 fix...")
    
    # Login as company
    r = c.post('/api/auth/login', json={'email': 'company@demo.com', 'password': 'demo123'})
    print(f"  Company login: {r.status_code}")
    
    if r.status_code == 200:
        tok = r.get_json()['access_token']
        user_data = r.get_json().get('user', {})
        print(f"  Company name: {user_data.get('company_name', 'MISSING!')}")
        
        # Test dashboard
        r2 = c.get('/api/company/dashboard', headers={'Authorization': 'Bearer ' + tok})
        print(f"  Dashboard: {r2.status_code}")
        
        if r2.status_code == 200:
            print("  403 FIX SUCCESSFUL!")
        else:
            print(f"  Still getting: {r2.status_code} - {r2.get_json()}")
    
    # Test candidate
    r = c.post('/api/auth/login', json={'email': 'candidate@demo.com', 'password': 'demo123'})
    print(f"  Candidate login: {r.status_code}")
    
    if r.status_code == 200:
        tok = r.get_json()['access_token']
        r2 = c.get('/api/candidate/dashboard', headers={'Authorization': 'Bearer ' + tok})
        print(f"  Candidate dashboard: {r2.status_code}")

print()
print("All tests complete!")