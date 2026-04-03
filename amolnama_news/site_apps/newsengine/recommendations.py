"""Content recommendations — "You liked X, you might like Y".
Simple collaborative filtering: same category + popular with similar users.
No external API, pure SQL queries on existing engagement data."""

import logging

logger = logging.getLogger(__name__)


def get_recommendations_for_user(user_profile_id, limit=5):
    """Get recommended content items for a user based on their engagement history.
    Returns list of promo-formatted dicts."""
    if not user_profile_id:
        return _get_global_popular(limit)

    # Step 1: Find what categories user engages with most
    from .models import FactFeedUserContentView
    user_views = FactFeedUserContentView.objects.filter(
        link_user_profile_id=user_profile_id, is_active=True,
    ).values_list('feed_content_type_code', flat=True)

    if not user_views:
        return _get_global_popular(limit)

    # Count category preferences
    from collections import Counter
    category_counts = Counter(user_views)
    top_categories = [category for category, count in category_counts.most_common(3)]

    # Step 2: Find popular content in those categories that user hasn't seen
    viewed_keys = set()
    for view in FactFeedUserContentView.objects.filter(
        link_user_profile_id=user_profile_id, is_active=True,
    ).values_list('feed_content_type_code', 'feed_content_id'):
        viewed_keys.add(f'{view[0]}:{view[1]}')

    recommendations = []

    for category in top_categories:
        try:
            items = _get_popular_in_category(category, viewed_keys, limit=2)
            recommendations.extend(items)
        except Exception:
            logger.exception('Failed to get recommendations for category %s', category)

    # Fill remaining with global popular
    if len(recommendations) < limit:
        global_items = _get_global_popular(limit - len(recommendations))
        recommendations.extend(global_items)

    return recommendations[:limit]


def _get_popular_in_category(category, viewed_keys, limit=2):
    """Get popular content in a category that user hasn't seen."""
    items = []

    if category == 'post':
        from amolnama_news.site_apps.post.models import Post
        posts = Post.objects.filter(
            is_published=True, is_deleted=False,
        ).order_by('-like_count', '-view_count')[:limit * 3]
        for post in posts:
            key = f'post:{post.post_post_id}'
            if key not in viewed_keys:
                items.append({
                    'content_type': 'post',
                    'title': (post.post_text or '')[:80],
                    'url': f'/post/{post.post_post_id}/',
                    'like_count': post.like_count or 0,
                })
                if len(items) >= limit:
                    break

    elif category == 'poem':
        from amolnama_news.site_apps.poem.models import CollPoemEntry
        poems = CollPoemEntry.objects.filter(
            poem_status_code='published',
        ).order_by('-like_count', '-view_count')[:limit * 3]
        for poem in poems:
            key = f'poem:{poem.poem_coll_poem_entry_id}'
            if key not in viewed_keys:
                items.append({
                    'content_type': 'poem',
                    'title': poem.poem_title_bn or '',
                    'url': f'/bangla-kobita-gaan/{poem.poem_slug}/',
                    'like_count': getattr(poem, 'like_count', 0) or 0,
                })
                if len(items) >= limit:
                    break

    elif category == 'debate':
        from amolnama_news.site_apps.debate.models import CollTopic
        topics = CollTopic.objects.filter(
            is_active=True,
        ).order_by('-total_post_count')[:limit * 3]
        for topic in topics:
            key = f'debate:{topic.debate_coll_topic_id}'
            if key not in viewed_keys:
                items.append({
                    'content_type': 'debate',
                    'title': topic.topic_title or '',
                    'url': f'/debate/topic/{topic.debate_coll_topic_id}/',
                    'like_count': topic.total_post_count or 0,
                })
                if len(items) >= limit:
                    break

    return items


def _get_global_popular(limit=5):
    """Fallback: globally popular content across all apps."""
    items = []

    try:
        from amolnama_news.site_apps.post.models import Post
        posts = Post.objects.filter(
            is_published=True, is_deleted=False,
        ).order_by('-like_count')[:limit]
        for post in posts:
            items.append({
                'content_type': 'post',
                'title': (post.post_text or '')[:80],
                'url': f'/post/{post.post_post_id}/',
                'like_count': post.like_count or 0,
            })
    except Exception:
        logger.exception('Failed to get global popular posts')

    return items[:limit]
