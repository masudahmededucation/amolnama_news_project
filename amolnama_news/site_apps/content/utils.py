"""Content utilities — shared helpers for content registry operations.
One source of truth for registering content across all apps."""

import logging

from django.db import connection
from django.utils import timezone

logger = logging.getLogger(__name__)


def register_content(content_category_id, user_profile_id, title_bn=None, title_en=None,
                     slug=None, summary_bn=None, content_url='', cover_image_url=None,
                     subcategory_id=None, form_type_id=None, is_published=False):
    """Register a new content item in the master content registry.
    Returns the content_registry_id or None on failure.

    Call this from every content create flow (post, poem, story, art, destination, debate, article).
    The returned ID should be stored in the source table's link_content_registry_id column.

    Args:
        content_category_id: FK to content.ref_content_category (1=article, 3=poem, 4=story, etc.)
        user_profile_id: Author's user_profile_id
        title_bn: Bengali title (or post text for posts)
        title_en: English title (optional)
        slug: URL slug (optional)
        summary_bn: Bengali summary/preview (optional)
        content_url: Full URL path (required)
        cover_image_url: Cover image URL (optional)
        subcategory_id: FK to content.ref_content_subcategory (optional)
        form_type_id: FK to newshub.ref_news_form_type (newshub only, optional)
        is_published: Whether content is published (default False)

    Returns:
        int: content_registry_id on success, None on failure
    """
    try:
        now = timezone.now()
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [content].[content_registry]
                    ([link_content_ref_content_category_id], [link_user_profile_id],
                     [content_title_bn], [content_title_en], [content_slug],
                     [content_summary_bn], [content_url], [content_cover_image_url],
                     [link_content_ref_content_subcategory_id], [link_newshub_ref_news_form_type_id],
                     [is_published], [is_active], [published_at], [created_at])
                OUTPUT INSERTED.[content_registry_id]
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1, %s, %s)
            """, [
                content_category_id, user_profile_id,
                (title_bn or '')[:1000] if title_bn else None,
                (title_en or '')[:1000] if title_en else None,
                slug,
                (summary_bn or '')[:500] if summary_bn else None,
                content_url,
                cover_image_url,
                subcategory_id,
                form_type_id,
                1 if is_published else 0,
                now if is_published else None,
                now,
            ])
            row = cursor.fetchone()
            return row[0] if row else None

    except Exception as register_error:
        logger.error('register_content failed for category %s, user %s — %s',
                     content_category_id, user_profile_id, register_error)
        return None


def update_content_registry(content_registry_id, **fields):
    """Update specific fields on an existing content registry entry.
    Only updates fields that are explicitly passed.

    Usage:
        update_content_registry(42, title_bn='New Title', is_published=True)
    """
    if not content_registry_id or not fields:
        return

    field_map = {
        'title_bn': 'content_title_bn',
        'title_en': 'content_title_en',
        'slug': 'content_slug',
        'summary_bn': 'content_summary_bn',
        'content_url': 'content_url',
        'cover_image_url': 'content_cover_image_url',
        'subcategory_id': 'link_content_ref_content_subcategory_id',
        'is_published': 'is_published',
    }

    set_clauses = []
    params = []
    for key, value in fields.items():
        db_column = field_map.get(key)
        if db_column:
            set_clauses.append(f'[{db_column}] = %s')
            params.append(value)

    if not set_clauses:
        return

    set_clauses.append('[updated_at] = %s')
    params.append(timezone.now())
    params.append(content_registry_id)

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                f"UPDATE [content].[content_registry] SET {', '.join(set_clauses)} WHERE [content_registry_id] = %s",
                params,
            )
    except Exception as update_error:
        logger.error('update_content_registry failed for ID %s — %s',
                     content_registry_id, update_error)


def get_unified_subcategory_id(group_code, category_code):
    """Look up the unified subcategory ID from a per-app category code.
    Returns content_ref_content_subcategory_id or None.

    Usage:
        subcategory_id = get_unified_subcategory_id('art', 'painting')
        subcategory_id = get_unified_subcategory_id('poem', 'love')
    """
    try:
        from amolnama_news.site_apps.content.models import RefContentSubcategory
        sub = RefContentSubcategory.objects.filter(
            group_code=group_code, subcategory_code=category_code,
        ).first()
        return sub.content_ref_content_subcategory_id if sub else None
    except Exception as lookup_error:
        logger.error('get_unified_subcategory_id failed for %s:%s — %s',
                     group_code, category_code, lookup_error)
        return None
