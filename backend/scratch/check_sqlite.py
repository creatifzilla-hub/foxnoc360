import sqlite3
import os

db_path = "isp_monitor.db"
if not os.path.exists(db_path):
    print(f"File {db_path} does not exist.")
else:
    print(f"File {db_path} exists. Size: {os.path.getsize(db_path)} bytes")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables:", tables)
    for t in tables:
        tname = t[0]
        try:
            cursor.execute(f"SELECT count(*) FROM {tname};")
            count = cursor.fetchone()[0]
            print(f"Table {tname}: {count} rows")
            if tname == "devices":
                cursor.execute(f"SELECT * FROM {tname} LIMIT 5;")
                print(f"Sample devices:", cursor.fetchall())
            elif tname == "users":
                cursor.execute(f"SELECT * FROM {tname} LIMIT 5;")
                print(f"Sample users:", cursor.fetchall())
        except Exception as e:
            print(f"Error reading {tname}: {e}")
    conn.close()
