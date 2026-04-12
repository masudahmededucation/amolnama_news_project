"""Feed score caching — populates [newsengine].[fact_feed_content_score].

Design: "static partial on write, live recency on read"
========================================================

The final ranking formula is unchanged:

    total_score = recency × W_RECENCY
                + engagement × W_ENGAGEMENT
                + author_reputation × W_AUTHOR_REPUTATION
                + content_quality × W_CONTENT_QUALITY

But only the TIME-INDEPENDENT parts are cached to the DB. Recency (which is
literally `now - created_at`) and the brand-new-post freshness boost are
computed on READ by the caller. This means cached scores can never go stale
between engagement events — the time-sensitive piece is always current to
the microsecond because it's recomputed every time someone asks.

What the cache stores:
    feed_engagement_score   — from like/vote/view/repost/reply counts
    feed_trending_score     — engagement-weighted only (no recency component)
    feed_total_score        — static partial: engagement + author_rep + quality
                              (with their weights applied). NO recency. NO
                              freshness boost. Caller must combine with live
                              recency on read.
    feed_scored_at          — when this row was last refreshed

What callers do on read:

    live_recency = calculate_recency_score(post.created_at)
    live_total   = cache['feed_total_score'] + live_recency × W_RECENCY
    if age_seconds < 300:
        live_total += 10.0   # brand-new freshness boost, applied live

Usage:
    from newsengine.feed_cache import cache_content_score, get_cached_scores

    # On post create or engagement change:
    cache_content_score('post', post_id, post_item_dict)

    # On feed load — get cached static partials:
    scores = get_cached_scores(content_keys)  # [('post', 123), ('post', 456)]
    # caller must then add live recency per-item (see docstring on that function)
"""

import logging
from datetime import timedelta

from django.db import connection
from django.utils import timezone

from .ranking import (
    calculate_recency_score,
    calculate_engagement_score,
    calculate_author_reputation_score,
    calculate_content_quality_score,
    WEIGHT_RECENCY,
    WEIGHT_ENGAGEMENT,
    WEIGHT_AUTHOR_REPUTATION,
    WEIGHT_CONTENT_QUALITY,
)

logger = logging.getLogger(__name__)

# Scores older than this are considered stale and will be recalculated on read
SCORE_STALE_THRESHOLD_MINUTES = 30


def cache_content_score(content_type_code, content_id, post_item):
    """Calculate and upsert ranking score into fact_feed_content_score.

    Called after: post create, like, vote, repost, reply — any engagement change.
    Uses MERGE (SQL Server upsert) to insert or update.
    """
    recency_score = calculate_recency_score(post_item.get('created_at_raw'))
    engagement_score = calculate_engagement_score(
        post_item.get('like_count', 0),
        post_item.get('view_count', 0),
        post_item.get('reply_count', 0),
        post_item.get('repost_count', 0),
        post_item.get('vote_score_count', 0),
    )
    author_reputation_score = calculate_author_reputation_score(
        post_item.get('author_contribution_score', 0)
    )
    content_quality_score = calculate_content_quality_score(
        post_item.get('post_text', '')
    )

    # Trending = engagement weighted more heavily (engagement-only score for trending tab)
    trending_score = round(engagement_score * 0.7 + recency_score * 0.3, 4)

    total_score = round(
        recency_score * WEIGHT_RECENCY
        + engagement_score * WEIGHT_ENGAGEMENT
        + author_reputation_score * WEIGHT_AUTHOR_REPUTATION
        + content_quality_score * WEIGHT_CONTENT_QUALITY,
        4,
    )

    # Brand-new posts (< 5 minutes old) get massive boost
    created_at = post_item.get('created_at_raw')
    if created_at:
        if timezone.is_naive(created_at):
            created_at = timezone.make_aware(created_at)
        age_seconds = max((timezone.now() - created_at).total_seconds(), 0)
        if age_seconds < 300:
            total_score += 10.0

    now = timezone.now()

    # Recency is NOT written to the DB — it's computed on read so it can never
    # go stale between engagement events. The `recency_score` computed above is
    # still used to derive `trending_score` and `total_score` at write time,
    # but those will be recomputed on read in a follow-up change.
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                MERGE [newsengine].[fact_feed_content_score] AS target
                USING (SELECT %s AS feed_content_type_code, %s AS feed_content_id) AS source
                ON target.feed_content_type_code = source.feed_content_type_code
                   AND target.feed_content_id = source.feed_content_id
                WHEN MATCHED THEN
                    UPDATE SET
                        feed_engagement_score = %s,
                        feed_trending_score = %s,
                        feed_total_score = %s,
                        feed_scored_at = %s,
                        is_active = 1
                WHEN NOT MATCHED THEN
                    INSERT (feed_content_type_code, feed_content_id,
                            feed_engagement_score, feed_trending_score,
                            feed_total_score,
                            feed_scored_at, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s, 1);
            """, [
                content_type_code, content_id,
                engagement_score, trending_score, total_score, now,
                content_type_code, content_id,
                engagement_score, trending_score, total_score, now,
            ])
    except Exception as cache_error:
        logger.error('feed_cache: cache_content_score failed for %s:%s — %s',
                     content_type_code, content_id, cache_error)


def get_cached_scores(content_keys):
    """Read cached scores for a list of (content_type_code, content_id) tuples.

    Returns dict: {(type, id): {'total_score': float, 'trending_score': float, ...}, ...}
    Missing keys = no cached score (caller should compute live or skip).
    """
    if not content_keys:
        return {}

    # Build WHERE clause — SQL Server doesn't support tuple-IN, use OR pattern
    or_clauses = []
    params = []
    for content_type_code, content_id in content_keys:
        or_clauses.append(
            '(feed_content_type_code = %s AND feed_content_id = %s)'
        )
        params.extend([content_type_code, content_id])

    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT feed_content_type_code, feed_content_id,
                       feed_engagement_score, feed_trending_score,
                       feed_recency_score, feed_total_score, feed_scored_at
                FROM [newsengine].[fact_feed_content_score]
                WHERE is_active = 1
                  AND (""" + ' OR '.join(or_clauses) + """)
            """, params)
            rows = cursor.fetchall()
    except Exception as query_error:
        logger.error('feed_cache: get_cached_scores failed — %s', query_error)
        return {}

    stale_cutoff = timezone.now() - timedelta(minutes=SCORE_STALE_THRESHOLD_MINUTES)
    scores = {}
    for row in rows:
        key = (row[0], row[1])
        scored_at = row[6]
        if scored_at and timezone.is_naive(scored_at):
            scored_at = timezone.make_aware(scored_at)
        scores[key] = {
            'engagement_score': float(row[2] or 0),
            'trending_score': float(row[3] or 0),
            'recency_score': float(row[4] or 0),
            'total_score': float(row[5] or 0),
            'scored_at': scored_at,
            'is_stale': scored_at and scored_at < stale_cutoff,
        }
    return scores


def refresh_stale_scores(max_age_minutes=60, batch_size=100):
    """Refresh scores older than max_age_minutes. Call periodically (every 15-30 min).

    Recalculates scores from live post data. Designed for background task / management command.
    """
    from amolnama_news.site_apps.post.models import Post

    stale_cutoff = timezone.now() - timedelta(minutes=max_age_minutes)

    try:
        from .models import FactFeedContentScore
        stale_entries = FactFeedContentScore.objects.filter(
            is_active=True,
            feed_scored_at__lt=stale_cutoff,
        ).values_list('feed_content_type_code', 'feed_content_id')[:batch_size]

        post_ids = [entry[1] for entry in stale_entries if entry[0] == 'post']
        if not post_ids:
            return 0

        posts = Post.objects.filter(
            post_post_id__in=post_ids, is_active=True,
        )

        refreshed_count = 0
        for post in posts:
            post_item = {
                'created_at_raw': post.created_at,
                'like_count': post.like_count or 0,
                'view_count': post.view_count or 0,
                'reply_count': post.reply_count or 0,
                'repost_count': post.repost_count or 0,
                'vote_score_count': post.vote_score_count or 0,
                'post_text': post.post_text or '',
                'author_contribution_score': 0,
            }
            cache_content_score('post', post.post_post_id, post_item)
            refreshed_count += 1

        logger.info('feed_cache: refreshed %d stale scores', refreshed_count)
        return refreshed_count

    except Exception as refresh_error:
        logger.error('feed_cache: refresh_stale_scores failed — %s', refresh_error)
        return 0
