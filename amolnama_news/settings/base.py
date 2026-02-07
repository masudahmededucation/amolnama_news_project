"""Shared Django settings (imported by env-specific modules)."""
from pathlib import Path
import environ

BASE_DIR = Path(__file__).resolve().parents[2]  # .../project_root
env = environ.Env(
    DEBUG=(bool, False),
)

# Optional .env support (local developer convenience)
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY", default="change-me-in-production")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# Application definition
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    # Social providers (enabled as needed)
    "allauth.socialaccount.providers.google",
    "allauth.socialaccount.providers.facebook",
    "allauth.socialaccount.providers.apple",
    "allauth.socialaccount.providers.github",
    "axes",
]

LOCAL_APPS = [
    "amolnama_news.site_apps.core",
    "amolnama_news.site_apps.evaluation_vote",
    "amolnama_news.site_apps.locations",
    "amolnama_news.site_apps.user_account",
    "amolnama_news.site_apps.user_portal_staff",
    "amolnama_news.site_apps.user_portal_visitor",
    "amolnama_news.site_apps.user_portal_journalists",
    "amolnama_news.site_apps.user_portal_moderator",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "axes.middleware.AxesMiddleware",
]

ROOT_URLCONF = "amolnama_news.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "amolnama_news.wsgi.application"
ASGI_APPLICATION = "amolnama_news.asgi.application"

# Database
# Support either SQL authentication (user/password) or Windows Trusted Connection
# Toggle with env var `DB_WINDOWS_AUTH` (true/false). When true, Django will use
# the ODBC driver's trusted connection (no DB user/password required).
PORT = env("DB_PORT", default="")

# Database configuration is driven by environment variables.
# Local-specific defaults (e.g., Windows Trusted Connection to SQLEXPRESS)
# should be set in `local.py` so production/dev configurations remain explicit.
db_options = {"driver": env("DB_DRIVER", default="ODBC Driver 17 for SQL Server")}

DATABASES = {
    "default": {
        "ENGINE": "mssql",
        "NAME": env("DB_NAME", default="news_magazine"),
        "HOST": env("DB_HOST", default="localhost"),
        "OPTIONS": db_options,
    }
}

# Optional credentials (SQL auth) are only used if provided via env vars.
db_user = env("DB_USER", default=None)
if db_user:
    DATABASES["default"].update({
        "USER": db_user,
        "PASSWORD": env("DB_PASSWORD", default=""),
    })

if PORT:
    DATABASES["default"]["PORT"] = PORT

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [
    BASE_DIR / "amolnama_news" / "project_static",
]
STATIC_ROOT = BASE_DIR / "amolnama_news" / "project_static_collected"
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    }
}

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "amolnama_news" / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Custom user model
AUTH_USER_MODEL = "user_account.User"

# django-allauth
AUTHENTICATION_BACKENDS = (
    "django.contrib.auth.backends.ModelBackend",
    "axes.backends.AxesStandaloneBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
    "amolnama_news.site_apps.user_account.backends.EmailAuthBackend",
)

ACCOUNT_USER_MODEL_USERNAME_FIELD = None
# Replace deprecated allauth settings with the newer names
# Use email as the login method
ACCOUNT_LOGIN_METHODS = {"email"}
# Fields required at signup: email and passwords
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_EMAIL_VERIFICATION = "optional"

# DRF / JWT
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

# django-axes
AXES_FAILURE_LIMIT = env.int("AXES_FAILURE_LIMIT", default=10)
AXES_COOLOFF_TIME = env.int("AXES_COOLOFF_TIME", default=1)  # hours

# Secure cookies toggled by env modules
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
