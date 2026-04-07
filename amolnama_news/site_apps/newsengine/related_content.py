"""Newsengine related content — cache-first read + background compute.

Pre-computes related content for each content item using vector embeddings.
Stores results in [newsengine].[fact_related_content_cache] so page views
read a single cached row instead of running expensive vector similarity.

Usage:
    from newsengine.related_content import get_cached_related_content
    items = get_cached_related_content('post', post_id)

    from newsengine.related_content import compute_and_cache_related_content_background
    compute_and_cache_related_content_background('post', post_id, post_text)
"""

import json
import logging

from django.db import connection
from django.utils import timezone

logger = logging.getLogger(__name__)

# Cache is valid for 24 hours — after that, treat as miss
RELATED_CONTENT_CACHE_MAX_AGE_HOURS = 24

# Content type labels — Bengali display names
CONTENT_TYPE_LABELS = {
    'post': 'পোস্ট',
    'poem': 'কবিতা',
    'story': 'গল্প',
    'art': 'শিল্পকলা',
    'article': 'নিবন্ধ',
    'debate': 'বিতর্ক',
    'destination': 'ভ্রমণ',
}

# Data-driven config for enrichment — one source of truth
_ENRICHMENT_MAP = {
    'post': {
        'query': "SELECT post_text, post_post_id FROM [post].[coll_post] WHERE post_post_id = %s AND is_active = 1",
        'title_index': 0,
        'slug_index': 1,
        'url_template': '/post/{slug}/',
        'author_index': None,
        'title_max_length': 80,
    },
    'poem': {
        'query': "SELECT poem_title_bn, poem_slug, poem_author_display_name FROM [poem].[coll_poem_entry] WHERE poem_coll_poem_entry_id = %s AND is_active = 1",
        'title_index': 0,
        'slug_index': 1,
        'url_template': '/bangla-kobita-gaan/{slug}/',
        'url_fallback': '/bangla-kobita-gaan/',
        'author_index': 2,
    },
    'story': {
        'query': "SELECT story_title_bn, story_slug FROM [stories].[coll_story] WHERE story_coll_story_id = %s AND is_active = 1",
        'title_index': 0,
        'slug_index': 1,
        'url_template': '/stories-for-kids/{slug}/',
        'url_fallback': '/stories-for-kids/',
    },
    'art': {
        'query': "SELECT artwork_title_bn, artwork_slug FROM [blog_art].[coll_artwork] WHERE art_coll_artwork_id = %s AND is_active = 1",
        'title_index': 0,
        'slug_index': 1,
        'url_template': '/art/{slug}/',
        'url_fallback': '/art/',
    },
    'destination': {
        'query': "SELECT destination_name_bn, destination_slug FROM [bangladesh].[coll_destination] WHERE bangladesh_coll_destination_id = %s AND is_active = 1",
        'title_index': 0,
        'slug_index': 1,
        'url_template': '/bangladesh-tourist-destinations/travel/{slug}/',
        'url_fallback': '/bangladesh-tourist-destinations/travel/',
    },
}


def get_cached_related_content(content_type_code, content_id):
    """Read pre-computed related content from cache. Returns list of dicts
    ready for the related-content.html template, or [] on cache miss.

    Single SQL read — zero vector compute, zero embedding load.
    Cache miss returns [] so page renders instantly without blocking.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT related_items_json, computed_at
                FROM [newsengine].[fact_related_content_cache]
                WHERE content_type_code = %s
                  AND content_id = %s
                  AND is_active = 1
            """, [content_type_code, content_id])
            row = cursor.fetchone()

        if not row:
            return []

        # Check staleness
        computed_at = row[1]
        age_hours = (timezone.now() - computed_at).total_seconds() / 3600
        if age_hours > RELATED_CONTENT_CACHE_MAX_AGE_HOURS:
            return []

        return json.loads(row[0])

    except Exception as cache_read_error:
        logger.error('get_cached_related_content failed for %s:%s — %s',
                     content_type_code, content_id, cache_read_error)
        return []


def compute_and_cache_related_content(content_type_code, content_id, text, limit=5):
    """Compute related content using vector embeddings and store in cache.

    Heavy operation — call from background thread only, never inline in view.
    Loads sentence-transformer model, encodes text, computes cosine similarity,
    enriches results with titles/URLs, then writes to cache table.
    """
    try:
        from amolnama_news.site_apps.newsengine.embeddings import find_similar_content_cross_type

        similar_items = find_similar_content_cross_type(
            text, limit=limit,
            exclude_type=content_type_code, exclude_id=content_id,
        )

        if not similar_items:
            # Cache empty result so we don't retry on every page view
            _write_cache(content_type_code, content_id, [])
            return []

        # Enrich with titles and URLs
        results = []
        for item in similar_items:
            item_type = item['content_type_code']
            item_id = item['content_id']
            enriched = _enrich_related_content_item(item_type, item_id)
            if enriched:
                enriched['content_type_label'] = CONTENT_TYPE_LABELS.get(item_type, item_type)
                enriched['similarity'] = item['similarity']
                results.append(enriched)

        _write_cache(content_type_code, content_id, results)
        return results

    except Exception as compute_error:
        logger.error('compute_and_cache_related_content failed for %s:%s — %s',
                     content_type_code, content_id, compute_error)
        return []


def compute_and_cache_related_content_background(content_type_code, content_id, text, limit=5):
    """Background thread wrapper — fire and forget. Call this from views."""
    import threading
    threading.Thread(
        target=compute_and_cache_related_content,
        args=(content_type_code, content_id, text, limit),
        daemon=True,
    ).start()


def invalidate_related_content_cache(content_type_code, content_id):
    """Invalidate cache for a specific content item — call when content is updated/deleted."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE [newsengine].[fact_related_content_cache]
                SET is_active = 0
                WHERE content_type_code = %s AND content_id = %s
            """, [content_type_code, content_id])
    except Exception as invalidate_error:
        logger.error('invalidate_related_content_cache failed for %s:%s — %s',
                     content_type_code, content_id, invalidate_error)


def _write_cache(content_type_code, content_id, related_items):
    """Upsert cache row — MERGE pattern for SQL Server."""
    try:
        related_items_json = json.dumps(related_items, ensure_ascii=False)
        with connection.cursor() as cursor:
            cursor.execute("""
                MERGE [newsengine].[fact_related_content_cache] AS target
                USING (SELECT %s AS content_type_code, %s AS content_id) AS source
                ON target.content_type_code = source.content_type_code
                   AND target.content_id = source.content_id
                   AND target.is_active = 1
                WHEN MATCHED THEN
                    UPDATE SET related_items_json = %s, computed_at = SYSDATETIME()
                WHEN NOT MATCHED THEN
                    INSERT (content_type_code, content_id, related_items_json, computed_at, is_active)
                    VALUES (%s, %s, %s, SYSDATETIME(), 1);
            """, [
                content_type_code, content_id, related_items_json,
                content_type_code, content_id, related_items_json,
            ])
    except Exception as write_error:
        logger.error('_write_cache failed for %s:%s — %s',
                     content_type_code, content_id, write_error)


def _enrich_related_content_item(content_type_code, content_id):
    """Fetch title, URL, author name for a related content item.
    Uses data-driven config map — zero duplication."""
    enrichment_config = _ENRICHMENT_MAP.get(content_type_code)
    if not enrichment_config:
        return None

    try:
        with connection.cursor() as cursor:
            cursor.execute(enrichment_config['query'], [content_id])
            row = cursor.fetchone()

        if not row:
            return None

        title = (row[enrichment_config['title_index']] or '')
        if enrichment_config.get('title_max_length'):
            title = title[:enrichment_config['title_max_length']]

        slug = row[enrichment_config['slug_index']]
        url = enrichment_config['url_template'].format(slug=slug) if slug else enrichment_config.get('url_fallback', '/')

        author_name = None
        if enrichment_config.get('author_index') is not None and len(row) > enrichment_config['author_index']:
            author_name = row[enrichment_config['author_index']] or None

        return {
            'title': title,
            'url': url,
            'author_name': author_name,
        }

    except Exception as enrich_error:
        logger.error('_enrich_related_content_item failed for %s:%s — %s',
                     content_type_code, content_id, enrich_error)
        return None
