"""Mastermind test suite — bootstraps Django so tests can run standalone.

Run the full fast tier (no model loads):
    python -m unittest amolnama_news.site_apps.mastermind.tests.test_parser
    python -m unittest amolnama_news.site_apps.mastermind.tests.test_embedding_storage
    python -m unittest amolnama_news.site_apps.mastermind.tests.test_option_label_derivation

Run the slow tier (loads mDeBERTa + multilingual embedding models):
    python -m unittest amolnama_news.site_apps.mastermind.tests.test_nli_gate

Debug toolbar blocks manage.py test, so we boot Django manually instead.
"""
import os

import django
from django.apps import apps as _django_apps

if not os.environ.get('DJANGO_SETTINGS_MODULE'):
    os.environ['DJANGO_SETTINGS_MODULE'] = 'amolnama_news.settings.local'

if not _django_apps.ready:
    django.setup()
