"""Quizadmin models — intentionally empty.

Quizadmin is a staff-only admin/review layer on top of the mastermind engine.
It does not own any tables — it reads and writes mastermind's CollQuestion,
CollBookChunk, etc. via Django Admin + custom views.
"""

from django.db import models  # noqa: F401  (kept for Django app discovery)
