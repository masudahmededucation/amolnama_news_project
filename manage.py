#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys

def main():
    # Prefer `local` settings if present for developer convenience; otherwise use `dev`.
    project_root = os.path.dirname(__file__)
    local_settings = os.path.join(project_root, "amolnama_news", "settings", "local.py")
    if os.path.exists(local_settings):
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'amolnama_news.settings.local')
    else:
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'amolnama_news.settings.dev')

    # If running the built-in dev server with no address:port, default to 127.0.0.1:8001
    # to avoid conflicts with system services that may bind port 8000.
    if len(sys.argv) >= 2 and sys.argv[1] == 'runserver' and len(sys.argv) == 2:
        sys.argv.append('127.0.0.1:8001')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
