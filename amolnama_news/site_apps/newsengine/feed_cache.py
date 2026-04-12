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
    calculate_engagement_score,
    calculate_author_reputation_score,
    calculate_content_quality_score,
    WEIGHT_ENGAGEMENT,
    WEIGHT_AUTHOR_REPUTATION,
    WEIGHT_CONTENT_QUALITY,
)
# NOTE: calculate_recency_score and WEIGHT_RECENCY are intentionally NOT imported.
# Recency is computed on read by callers (always current to the microsecond).

logger = logging.getLogger(__name__)

# Scores older than this are considered stale and will be recalculated on read
SCORE_STALE_THRESHOLD_MINUTES = 30


def cache_content_score(content_type_code, content_id, post_item):
    """Calculate and upsert the STATIC PARTIAL ranking score.

    Called after: post create, like, vote, repost, reply — any engagement change.
    Uses MERGE (SQL Server upsert) to insert or update.

    IMPORTANT: recency is NOT included in the cached total_score. It changes
    every second, so caching it is always wrong. Callers must add live recency
    on read via: live_total = cached_total + calculate_recency_score(created_at) * WEIGHT_RECENCY
    The brand-new-post freshness boost (+10.0 for <5 min old) is also applied
    on read, not here, because it's time-dependent.
    """
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

    # Trending = engagement-only (no recency — trending should reflect momentum,
    # not how recently the post was created)
    trending_score = round(engagement_score, 4)

    # Static partial = everything EXCEPT recency and freshness boost.
    # The caller adds recency on read so it's always accurate to the microsecond.
    static_partial_score = round(
        engagement_score * WEIGHT_ENGAGEMENT
        + author_reputation_score * WEIGHT_AUTHOR_REPUTATION
        + content_quality_score * WEIGHT_CONTENT_QUALITY,
        4,
    )

    now = timezone.now()
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
                engagement_score, trending_score, static_partial_score, now,
                content_type_code, content_id,
                engagement_score, trending_score, static_partial_score, now,
            ])
    except Exception as cache_error:
        logger.error('feed_cache: cache_content_score failed for %s:%s — %s',
                     content_type_code, content_id, cache_error)


def get_cached_scores(content_keys):
    """Read cached STATIC PARTIAL scores for a list of (content_type_code, content_id) tuples.

    Returns dict: {(type, id): {'static_partial_score': float, 'trending_score': float, ...}}
    Missing keys = no cached score (caller should compute live or skip).

    IMPORTANT: the returned 'static_partial_score' does NOT include recency.
    Callers must add live recency themselves:

        from newsengine.ranking import calculate_recency_score, WEIGHT_RECENCY
        live_total = score['static_partial_score'] + calculate_recency_score(created_at) * WEIGHT_RECENCY
        if age_seconds < 300:
            live_total += 10.0  # brand-new freshness boost
    """
    if not content_keys:
        return {}

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
                       feed_total_score, feed_scored_at
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
        scored_at = row[5]
        if scored_at and timezone.is_naive(scored_at):
            scored_at = timezone.make_aware(scored_at)
        scores[key] = {
            'engagement_score': float(row[2] or 0),
            'trending_score': float(row[3] or 0),
            'static_partial_score': float(row[4] or 0),
            'scored_at': scored_at,
            'is_stale': scored_at and scored_at < stale_cutoff,
        }
    return scores



# refresh_stale_scores() removed — the periodic-scheduler pattern is explicitly
# not used. Recency is computed live on read (always current). Engagement scores
# are refreshed via fan-out (fact_user_feed_cache) on write events, not via
# a polling loop on fact_feed_content_score. Zero scheduler, zero cron.
