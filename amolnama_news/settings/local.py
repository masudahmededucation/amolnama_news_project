"""Local developer overrides (optional; do not commit secrets).

This file applies local-only defaults such as Windows-trusted DB connection
to a local SQLEXPRESS instance. Keep secrets out of version control.
"""
import os

# Local dev: prefer Windows trusted connection to local SQLEXPRESS.
# Set safe defaults early so they are available when settings modules import.
# These can be overridden by a real `.env` file or environment variables.
os.environ.setdefault("DB_WINDOWS_AUTH", "true")
os.environ.setdefault("DB_HOST", "localhost\\SQLEXPRESS")
os.environ.setdefault("DB_PORT", "")
os.environ.setdefault("DB_NAME", "news_magazine")
os.environ.setdefault("DB_DRIVER", "ODBC Driver 17 for SQL Server")

from .dev import *  # noqa

# Rebuild DATABASES using the base logic driven by environment variables.
PORT = env("DB_PORT", default="")
db_options = {"driver": env("DB_DRIVER")}

DATABASES = {
	"default": {
		"ENGINE": "mssql",
		"NAME": env("DB_NAME"),
		"HOST": env("DB_HOST"),
		"OPTIONS": db_options,
	}
}

if env.bool("DB_WINDOWS_AUTH", default=True):
	DATABASES["default"]["OPTIONS"]["trusted_connection"] = "yes"
else:
	# Use SQL auth if DB_USER provided
	db_user = env("DB_USER", default=None)
	if db_user:
		DATABASES["default"].update({
			"USER": db_user,
			"PASSWORD": env("DB_PASSWORD", default=""),
		})

if PORT:
	DATABASES["default"]["PORT"] = PORT

# Attempt a lightweight SQL Server connectivity check; if it fails, fall back
# to a local sqlite DB for developer convenience so `runserver` won't error.
try:
	import sys
	try:
		import pyodbc

		def _mssql_connect_ok():
			driver = db_options.get("driver", "ODBC Driver 17 for SQL Server")
			server = DATABASES["default"].get("HOST")
			dbname = DATABASES["default"].get("NAME")
			port = DATABASES["default"].get("PORT", "")
			if port:
				server = f"{server},{port}"
			if env.bool("DB_WINDOWS_AUTH", default=True):
				conn_str = f"DRIVER={{{driver}}};SERVER={server};DATABASE={dbname};Trusted_Connection=yes"
			else:
				user = DATABASES["default"].get("USER") or env("DB_USER", default="sa")
				pwd = DATABASES["default"].get("PASSWORD") or env("DB_PASSWORD", default="")
				conn_str = f"DRIVER={{{driver}}};SERVER={server};UID={user};PWD={pwd};DATABASE={dbname}"
			# short timeout
			cn = pyodbc.connect(conn_str, timeout=3)
			cn.close()

		try:
			_mssql_connect_ok()
		except Exception:
			DATABASES = {
				"default": {
					"ENGINE": "django.db.backends.sqlite3",
					"NAME": str(BASE_DIR / "db.sqlite3"),
				}
			}
			print("WARNING: SQL Server not reachable; using sqlite fallback (db.sqlite3) for local development.", file=sys.stderr)
	except Exception:
		# pyodbc import failed
		DATABASES = {
			"default": {
				"ENGINE": "django.db.backends.sqlite3",
				"NAME": str(BASE_DIR / "db.sqlite3"),
			}
		}
		print("WARNING: pyodbc not available; using sqlite fallback (db.sqlite3) for local development.", file=sys.stderr)
except Exception:
	# Any unexpected error: ensure we at least have sqlite configured
	DATABASES = {
		"default": {
			"ENGINE": "django.db.backends.sqlite3",
			"NAME": "db.sqlite3",
		}
	}
