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
from app import create_app, db
from app.models.user import User
from app.models.interview import Company

app = create_app()
with app.app_context():
    print("=== DATABASE STATE ===")
    users = User.query.all()
    for u in users:
        company = Company.query.filter_by(user_id=u.id).first()
        print(f"User: {u.email} | Role: {u.role} | Active: {u.is_active} | Company: {company.company_name if company else 'NO COMPANY PROFILE'}")
    
    print()
    print("=== COMPANY TABLE ===")
    companies = Company.query.all()
    for c in companies:
        print(f"Company: {c.company_name} | user_id: {c.user_id}")
    
    if not companies:
        print("NO COMPANIES IN DATABASE!")