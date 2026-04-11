"""Universal bookmarks — single source of truth for all blog content bookmarking.

Architecture: ONE universal API endpoint at /newsengine/api/bookmark/toggle/ handles
all bookmarking. The shared actions-bar.js component reads `data-content-type` and
`data-content-id` from the bookmark button and POSTs to that endpoint. Adding a new
content type requires only one entry in CONTENT_TYPE_METADATA below.

Industry-standard pattern: matches Twitter/Reddit/Pinterest/Pocket bookmark APIs —
one endpoint, content_type discriminator, single source of truth.

Module API:
    - toggle_bookmark()           — write/toggle (called by the universal endpoint)
    - is_bookmarked()             — has-this-user-bookmarked-X check
    - get_bookmark_count()        — count active bookmarks for content
    - get_content_type_metadata() — badge/color/cta lookup for any content type

Storage: [newsengine].[bookmark_content] (BookmarkContent model).
Per-app `engagement_*_bookmark` tables are deprecated and unused.
"""

from django.utils import timezone


# =========================================================
# Content type metadata — thin adapter over content_type_registry.
# Kept for backwards compatibility with existing callers; the single
# source of truth lives in content/content_type_registry.py.
# =========================================================
# 'news' is not in the registry (PubArticle has a split schema that
# doesn't fit the shared shape yet) — keep it here so newshub consumers
# still resolve badge/color/cta through this module.
_NEWS_PRESENTATION = {'badge': 'NEWS', 'color': 'rose', 'cta': 'পড়ুন'}


def get_content_type_metadata(content_type_code):
    """Return {'badge', 'color', 'cta'} for a content_type_code.

    Reads from content_type_registry for all registered blog types. Falls
    back to the _NEWS_PRESENTATION override for 'news' (not in registry),
    and to a generic default for anything else.
    """
    if content_type_code == 'news':
        return _NEWS_PRESENTATION
    from amolnama_news.site_apps.content.content_type_registry import get_spec
    spec = get_spec(content_type_code)
    if spec:
        return {'badge': spec['badge'], 'color': spec['color'], 'cta': spec['cta']}
    return {'badge': 'CONTENT', 'color': 'blue', 'cta': 'দেখুন'}


# Backwards-compat alias — some views import CONTENT_TYPE_METADATA as a dict
# and iterate over it. Build it lazily on first access so the registry stays
# the canonical source.
def _build_content_type_metadata_dict():
    from amolnama_news.site_apps.content.content_type_registry import CONTENT_TYPE_REGISTRY
    data = {'news': _NEWS_PRESENTATION}
    for code, spec in CONTENT_TYPE_REGISTRY.items():
        data[code] = {'badge': spec['badge'], 'color': spec['color'], 'cta': spec['cta']}
    return data


CONTENT_TYPE_METADATA = _build_content_type_metadata_dict()


# =========================================================
# Bookmark CRUD — single source of truth, writes to [newsengine].[bookmark_content]
# =========================================================

def toggle_bookmark(user_profile_id, content_type_code, content_id, content_title, content_url):
    """Toggle a bookmark on any content type.

    Args:
        user_profile_id: int
        content_type_code: str (e.g. 'art', 'story', 'destination', 'poem', 'news')
        content_id: int — the coll table primary key
        content_title: str — cached title for the bookmark list
        content_url: str — cached URL for the bookmark list

    Returns: (bookmarked: bool, count: int)
    """
    from amolnama_news.site_apps.newsengine.models import BookmarkContent

    existing = BookmarkContent.objects.filter(
        link_user_profile_id=user_profile_id,
        bookmark_content_type_code=content_type_code,
        bookmark_content_id=content_id,
    ).first()

    if existing and existing.is_active:
        existing.is_active = False
        existing.save(update_fields=['is_active'])
        bookmarked = False
    elif existing and not existing.is_active:
        existing.is_active = True
        existing.save(update_fields=['is_active'])
        bookmarked = True
    else:
        BookmarkContent.objects.create(
            link_user_profile_id=user_profile_id,
            bookmark_content_type_code=content_type_code,
            bookmark_content_id=content_id,
            bookmark_content_title=content_title,
            bookmark_content_url=content_url,
            is_active=True,
            created_at=timezone.now(),
        )
        bookmarked = True

    count = BookmarkContent.objects.filter(
        bookmark_content_type_code=content_type_code,
        bookmark_content_id=content_id,
        is_active=True,
    ).count()
    return bookmarked, count


def is_bookmarked(user_profile_id, content_type_code, content_id):
    """Check if a user has bookmarked a piece of content. Returns bool."""
    if not user_profile_id:
        return False
    from amolnama_news.site_apps.newsengine.models import BookmarkContent
    return BookmarkContent.objects.filter(
        link_user_profile_id=user_profile_id,
        bookmark_content_type_code=content_type_code,
        bookmark_content_id=content_id,
        is_active=True,
    ).exists()


def get_bookmark_count(content_type_code, content_id):
    """Get total active bookmark count for a piece of content. Returns int."""
    from amolnama_news.site_apps.newsengine.models import BookmarkContent
    return BookmarkContent.objects.filter(
        bookmark_content_type_code=content_type_code,
        bookmark_content_id=content_id,
        is_active=True,
    ).count()


