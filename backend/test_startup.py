import sys, os
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
from app import create_app
app = create_app()
with app.test_client() as c:
    r = c.get('/api/health')
    print(f'Health check: {r.status_code}')
    d = r.get_json()
    print(f'Response: {d}')
print('BACKEND STARTUP OK')