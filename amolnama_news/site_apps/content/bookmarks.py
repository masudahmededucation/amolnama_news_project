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
# Content type metadata — single source of truth for badge / color / CTA mapping
# used by promo cards, bookmarks list, feed cards, search results, etc.
# Add a new content type here once — every consumer picks it up automatically.
# =========================================================
CONTENT_TYPE_METADATA = {
    'news':        {'badge': 'NEWS',   'color': 'rose',   'cta': 'পড়ুন'},
    'poem':        {'badge': 'POEM',   'color': 'purple', 'cta': 'পড়ুন'},
    'story':       {'badge': 'STORY',  'color': 'amber',  'cta': 'পড়ুন'},
    'art':         {'badge': 'ART',    'color': 'blue',   'cta': 'দেখুন'},
    'destination': {'badge': 'TRAVEL', 'color': 'green',  'cta': 'ঘুরে আসুন'},
    'debate':      {'badge': 'DEBATE', 'color': 'amber',  'cta': 'দেখুন'},
}

_CONTENT_TYPE_DEFAULT = {'badge': 'CONTENT', 'color': 'blue', 'cta': 'দেখুন'}


def get_content_type_metadata(content_type_code):
    """Return {'badge', 'color', 'cta'} for a content_type_code. Falls back to a generic default."""
    return CONTENT_TYPE_METADATA.get(content_type_code, _CONTENT_TYPE_DEFAULT)


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


