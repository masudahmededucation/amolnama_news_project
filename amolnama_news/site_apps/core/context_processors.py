"""Core context processors — inject global data into every template.

`active_sidebar_nav` resolves the SINGLE active sidebar nav item from the
current request path. This is the single source of truth for nav highlighting —
prevents dual-active bugs by structurally guaranteeing exactly one item is active.

Adding a new sidebar item = one entry in SIDEBAR_NAV_RULES below. The order
matters: more specific paths must come BEFORE more general namespace prefixes.
"""

from django.urls import resolve, Resolver404

# Ordered list of (nav_id, matcher) tuples.
# matcher is either:
#   - a string starting with '=' for exact path match (e.g. '=/' or '=/social/bookmarks/')
#   - a string starting with '^' for path prefix match (e.g. '^/portal/content/')
#   - a string starting with 'ns:' for URL namespace match (e.g. 'ns:debate')
#
# IMPORTANT: order matters. Exact + specific prefix matches MUST come before
# the broader namespace fallback so the right item wins. The first matching
# rule wins, then we stop. This is what makes dual-active impossible.
SIDEBAR_NAV_RULES = [
    # ---- Exact paths (highest priority — these are children that share a namespace with their parent) ----
    ('home',                  '=/'),
    ('bookmarks',             '=/social/bookmarks/'),
    ('content-dashboard',     '=/portal/content/'),
    ('analytics-dashboard',   '=/portal/analytics/'),
    ('moderation-queue',      '=/portal/moderation/'),
    ('placeholders',          '=/portal/admin/placeholders/'),
    ('form-access',           '=/newshub/admin/form-access/'),

    # ---- Specific prefix matches ----
    ('news',                  '^/newshub/article'),  # /newshub/articles/ AND /newshub/article/<slug>/

    # ---- Namespace fallbacks (catch everything else under that app) ----
    ('debate',                'ns:debate'),
    ('search',                'ns:search'),
    ('messenger',             'ns:messenger'),
    ('social',                'ns:social'),
    ('live',                  'ns:live'),
    ('tools',                 'ns:tools'),
    ('portal',                'ns:portal'),
    ('citizen-journalism',    'ns:newshub'),  # all other newshub URLs (forms, etc.)
    ('election',              'ns:election_vote'),
    ('poetry',                'ns:poem'),
    ('art',                   'ns:art'),
    ('stories',               'ns:stories'),
    ('bangladesh',            'ns:bangladesh'),
    ('marriage',              'ns:marriage'),
    ('health',                'ns:health'),
    ('textextractor',         'ns:textextractor'),
    ('quizadmin',             'ns:quizadmin'),
    ('bookwriter',            'ns:bookwriter'),
]


def _resolve_active_sidebar_nav(request):
    """Walk SIDEBAR_NAV_RULES in order and return the first matching nav id (or empty string)."""
    path = request.path

    # Resolve namespace once for ns: rules
    try:
        match = resolve(path)
        namespace = match.namespace
    except Resolver404:
        namespace = None

    for nav_id, matcher in SIDEBAR_NAV_RULES:
        if matcher.startswith('='):
            if path == matcher[1:]:
                return nav_id
        elif matcher.startswith('^'):
            if path.startswith(matcher[1:]):
                return nav_id
        elif matcher.startswith('ns:'):
            if namespace == matcher[3:]:
                return nav_id

    return ''


def active_sidebar_nav(request):
    """Return {'active_sidebar_nav_id': '<id>'} for use by sidebar-navigation.html."""
    return {'active_sidebar_nav_id': _resolve_active_sidebar_nav(request)}
