"""Trending detection — finds content with fastest engagement growth in last 24h.
Pure SQL aggregation, no external API."""

import logging

from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)


def get_trending_posts(limit=5):
    """Find top trending posts — highest engagement in last 24h.
    Returns list of dicts with post_id, title preview, engagement metrics."""
    from amolnama_news.site_apps.post.models import Post

    cutoff_24h = timezone.now() - timedelta(hours=24)

    # Posts created or engaged with in last 24h, sorted by combined engagement
    trending_posts = Post.objects.filter(
        is_published=True, is_deleted=False,
        created_at__gte=cutoff_24h - timedelta(days=7),  # Look at last 7 days of content
    ).order_by('-like_count', '-view_count', '-reply_count')[:limit]

    items = []
    for post in trending_posts:
        trending_score = (
            (post.like_count or 0) * 3.0 +
            (post.reply_count or 0) * 5.0 +
            (post.repost_count or 0) * 4.0 +
            (post.view_count or 0) * 0.1
        )
        if trending_score > 0:
            items.append({
                'item_type': 'trending_post',
                'post_post_id': post.post_post_id,
                'post_text': post.post_text or '',
                'like_count': post.like_count or 0,
                'view_count': post.view_count or 0,
                'reply_count': post.reply_count or 0,
                'trending_score': trending_score,
            })

    items.sort(key=lambda item: item['trending_score'], reverse=True)
    return items[:limit]


def get_trending_promo_items(limit=5):
    """Find trending content across all apps for the feed. Returns promo-formatted dicts."""
    from amolnama_news.site_apps.newsengine.promo_builders import build_all_promo_items

    all_promos = build_all_promo_items()

    # Score each promo by engagement
    for promo in all_promos:
        like_count = promo.get('promo_like_count') or 0
        view_count = promo.get('promo_view_count') or 0
        promo['_trending_score'] = like_count * 3 + view_count * 0.1

    all_promos.sort(key=lambda item: item.get('_trending_score', 0), reverse=True)

    trending_items = []
    for promo in all_promos[:limit]:
        if promo.get('_trending_score', 0) > 0:
            promo['is_trending'] = True
            trending_items.append(promo)

    return trending_items
