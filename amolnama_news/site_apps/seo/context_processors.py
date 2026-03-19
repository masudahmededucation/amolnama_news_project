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
"""

SITE_NAME = "Amolnama News"
SITE_NAME_BN = "আমলনামা নিউজ"
DEFAULT_DESCRIPTION = (
    "Amolnama News (আমলনামা নিউজ) — Bangladesh's independent news platform "
    "covering politics, crime, sports, entertainment, investigations, and community voices. "
    "সত্যই আমাদের শক্তি — Truth is our strength."
)
DEFAULT_OG_IMAGE_PATH = "/static/core/assets/img/logo.png"


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
        }
    }
