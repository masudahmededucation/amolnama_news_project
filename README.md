# Amolnama News (Django + Microsoft SQL Server)

## Quick start (local)
1. Create and activate a virtualenv
2. Install dependencies:
   - `pip install -r amolnama_news/requirements/dev.txt`
3. Ensure SQL Server is running and reachable (default localhost:1433)
4. Optional: copy `.env.example` to `.env` and edit
5. Run migrations:
   - `python manage.py makemigrations`
   - `python manage.py migrate`
6. Create admin:
   - `python manage.py createsuperuser`
7. Run:
   - `python manage.py runserver`

## Settings modules
- Default: `amolnama_news.settings.dev`
- Prod: `amolnama_news.settings.prod`
- Optional local overrides: `amolnama_news.settings.local`
