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
    "django.contrib.sites",
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
    "amolnama_news.site_apps.election_vote",
    "amolnama_news.site_apps.locations",
    "amolnama_news.site_apps.multimedia",
    "amolnama_news.site_apps.newshub",
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
                "amolnama_news.site_apps.user_account.context_processors.user_display_name",
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

# Newshub file uploads — relative to MEDIA_ROOT
# Final path: MEDIA_ROOT / upload / newshub / <asset_type_category_name> /
# Subfolders: audio, files, image, video
NEWSHUB_UPLOAD_DIR = "upload/newshub"

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

SITE_ID = 1

ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_EMAIL_VERIFICATION = "optional"

# Social account settings
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_LOGIN_ON_GET = True
SOCIALACCOUNT_ADAPTER = (
    "amolnama_news.site_apps.user_account.adapters.CustomSocialAccountAdapter"
)

SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APP": {
            "client_id": env("GOOGLE_CLIENT_ID", default=""),
            "secret": env("GOOGLE_CLIENT_SECRET", default=""),
        },
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
    },
    "facebook": {
        "APP": {
            "client_id": env("FACEBOOK_APP_ID", default=""),
            "secret": env("FACEBOOK_APP_SECRET", default=""),
        },
        "METHOD": "oauth2",
        "SCOPE": ["email", "public_profile"],
        "FIELDS": ["id", "email", "name", "first_name", "last_name"],
    },
}

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

# Login/logout redirects
LOGIN_URL = "/account/login/"
LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/"

# Secure cookies toggled by env modules
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
