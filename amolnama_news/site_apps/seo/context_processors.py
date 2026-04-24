"""SEO context processor — injects default meta data into every template.

Views can override any value by adding 'seo' dict to their context:
    context['seo'] = {
        'title': 'Page Title',
        'description': 'Page description for search engines.',
        'og_image': '/static/core/assets/img/logo.png',
        'og_type': 'website',
        'canonical': '/about/',
        'noindex': False,
        'json_ld': { ... },  # or list of dicts for multiple schemas
        'breadcrumbs': [{'name': 'Home', 'url': '/'}, ...],
    }

Also exposes `static_cache_buster` — the current cache version string,
read from the same source the service worker uses (seo.views.CACHE_NAME).
Templates append `?v={{ static_cache_buster }}` to <script> / <link>
URLs so the browser cache invalidates on every cache bump (the service
worker invalidation alone doesn't beat the browser's HTTP cache for
non-hashed asset paths in dev).
"""

import re

SITE_NAME = "Amolnama News"
SITE_NAME_BN = "আমলনামা নিউজ"
DEFAULT_DESCRIPTION = (
    "Amolnama News (আমলনামা নিউজ) — Bangladesh's independent news platform "
    "covering politics, crime, sports, entertainment, investigations, and community voices. "
    "সত্যই আমাদের শক্তি — Truth is our strength."
)
DEFAULT_OG_IMAGE_PATH = "/static/core/assets/img/logo.png"


def _read_current_static_cache_version():
    """Extract the CACHE_NAME literal from seo/views.py's service-
    worker source so the template cache-buster always matches the
    service-worker cache version. Reading the source file (cheap; the
    file lives in the same app) avoids duplicating the version in two
    places. Returns 'amolnama-vX' or '0' on any failure."""
    try:
        from . import views as _seo_views
        sw_source = _seo_views.service_worker_js.__doc__ or ''
        # The version literal is in the SW source string assigned inside
        # the view function. Re-read the file to find it.
        import inspect
        view_source = inspect.getsource(_seo_views.service_worker_js)
        match = re.search(r"CACHE_NAME\s*=\s*'(amolnama-v[\w.-]+)'", view_source)
        if match:
            return match.group(1)
    except Exception:  # noqa: BLE001 — purely cosmetic cache-buster
        pass
    return '0'


# Cache the version at import time — settings file is loaded once per
# process so this only runs at startup. A reload of seo/views.py will
# bump the version on next process restart.
_STATIC_CACHE_BUSTER_VERSION = _read_current_static_cache_version()


def seo_defaults(request):
    """Provide default SEO values; views override via context['seo']."""
    return {
        "seo_defaults": {
            "site_name": SITE_NAME,
            "site_name_bn": SITE_NAME_BN,
            "description": DEFAULT_DESCRIPTION,
            "og_image": request.build_absolute_uri(DEFAULT_OG_IMAGE_PATH),
            "og_type": "website",
            "canonical": request.build_absolute_uri(request.path),
            "noindex": False,
            "locale": "bn_BD",
            "locale_alternate": "en_US",
        },
        "static_cache_buster": _STATIC_CACHE_BUSTER_VERSION,
    }
