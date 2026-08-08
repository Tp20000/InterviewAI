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
    users = User.query.all()
    print('  Users in DB: ' + str(len(users)))
    for u in users:
        co = Company.query.filter_by(user_id=u.id).first()
        print('    ' + u.email + ' | ' + u.role + ' | company=' + (co.company_name if co else 'NONE'))
    
    # Check if resume_text column exists
    import sqlite3
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', 'interviewai.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.execute('PRAGMA table_info(users)')
    columns = [row[1] for row in cursor.fetchall()]
    conn.close()
    print('  Users table columns: ' + str(columns))
    if 'resume_text' in columns:
        print('  resume_text column: EXISTS')
    else:
        print('  resume_text column: MISSING!')