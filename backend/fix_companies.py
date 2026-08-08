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
    print("Fixing company profiles...")
    
    company_users = User.query.filter_by(role='company').all()
    fixed = 0
    
    for user in company_users:
        existing = Company.query.filter_by(user_id=user.id).first()
        if not existing:
            # Create missing company profile
            if 'demo' in user.email:
                cname = 'Demo Tech Corp'
                industry = 'Technology'
            else:
                cname = user.full_name + ' Company'
                industry = 'Technology'
            
            company = Company(
                user_id=user.id,
                company_name=cname,
                industry=industry,
                website=''
            )
            db.session.add(company)
            fixed += 1
            print(f"  Created company profile for: {user.email} -> {cname}")
        else:
            print(f"  OK: {user.email} -> {existing.company_name}")
    
    db.session.commit()
    print(f"\nFixed {fixed} missing company profiles!")
    
    # Verify
    print("\n=== VERIFICATION ===")
    for user in company_users:
        company = Company.query.filter_by(user_id=user.id).first()
        print(f"  {user.email}: {company.company_name if company else 'STILL MISSING!'}")
    
    print("\nDone! Try logging in as company@demo.com now.")