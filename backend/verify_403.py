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
    r = c.post('/api/auth/login', json={'email':'company@demo.com','password':'demo123'})
    print('Login: ' + str(r.status_code))
    if r.status_code == 200:
        tok = r.get_json()['access_token']
        r2 = c.get('/api/company/dashboard', headers={'Authorization':'Bearer '+tok})
        print('Dashboard: ' + str(r2.status_code))
        if r2.status_code == 200:
            d = r2.get_json()
            print('Company: ' + str(d.get('company',{}).get('company_name','???')))
            print('Interviews: ' + str(d.get('stats',{}).get('total_interviews',0)))
            print('403 FIX: SUCCESS!')
        else:
            print('Still broken: ' + str(r2.get_json()))
    else:
        print('Login failed: ' + str(r.get_json()))