"""
Minimal Django settings for the GPT-6 Astra landing page clone.
No database is needed: the site is a single page.
"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "dev-only-change-me"
DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]"]

INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "landing",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": ["django.template.context_processors.request"]},
    }
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {}  # not needed

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Page + galaxy animation settings (passed to the template / JavaScript)
# ---------------------------------------------------------------------------
SITE_BRAND = "OpenAI"  # change this before publishing anywhere

GALAXY = {
    "particles": 12000,     # total stars for the 6 and the 9 (auto-reduced on phones)
    "repelRadius": 140,     # cursor influence radius in px
    "repelStrength": 1.6,   # how hard the cursor pushes stars away
    "spring": 0.03,         # how fast stars return to the "6" shape
    "damping": 0.86,        # 0..1, lower = stops sooner
    "tilt": 0.42,           # max 3D tilt (radians) following the cursor
}
