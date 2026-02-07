import os
import pyodbc
import traceback

driver = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")
host = os.getenv("DB_HOST", "localhost")
port = os.getenv("DB_PORT", "1433")
user = os.getenv("DB_USER", "sa")
pwd = os.getenv("DB_PASSWORD", "000000")
db = os.getenv("DB_NAME", "news_magazine")
windows = os.getenv("DB_WINDOWS_AUTH", "false").lower() in ("1", "true", "yes")

def make_server(host, port):
    # If port is empty, return host as-is (supports named instances like 'localhost\\SQLEXPRESS')
    return f"{host},{port}" if port else host

server = make_server(host, port)

if windows:
    conn_str = f"DRIVER={{{driver}}};SERVER={server};DATABASE={db};Trusted_Connection=yes"
else:
    conn_str = f"DRIVER={{{driver}}};SERVER={server};UID={user};PWD={pwd};DATABASE={db}"

print("Trying:", conn_str)
try:
    cn = pyodbc.connect(conn_str, timeout=5)
    print("OK: connected")
    cn.close()
except Exception:
    print("ERROR:")
    traceback.print_exc()
