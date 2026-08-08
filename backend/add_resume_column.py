import warnings, sys, os, sqlite3
warnings.filterwarnings('ignore')

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', 'interviewai.db')
print('DB path: ' + db_path)

if not os.path.exists(db_path):
    print('DB does not exist yet - will be created on next run')
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.execute('PRAGMA table_info(users)')
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'resume_text' not in columns:
        conn.execute('ALTER TABLE users ADD COLUMN resume_text TEXT')
        conn.commit()
        print('Added resume_text column to users table!')
    else:
        print('resume_text column already exists')
    
    conn.close()