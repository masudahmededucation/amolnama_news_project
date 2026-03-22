"""Development settings (default)."""
from .base import *  # noqa
import os

DEBUG = True

INSTALLED_APPS += ["debug_toolbar"]

MIDDLEWARE = ["debug_toolbar.middleware.DebugToolbarMiddleware"] + MIDDLEWARE

INTERNAL_IPS = ["127.0.0.1"]

# Dev: serve static files directly without filename hashing or caching.
# This ensures CSS/JS changes take effect immediately on refresh.
STORAGES = {
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    }
}

# Dev-friendly logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}

# Disable browser caching for static files in development
# Forces browser to always fetch fresh JS/CSS without manual cache clear
MIDDLEWARE += ["amolnama_news.middleware.no_cache_static.NoCacheStaticMiddleware"]

# Keep dev.py minimal; rely on environment variables or local.py for local-only defaults.
