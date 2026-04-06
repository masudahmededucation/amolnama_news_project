"""Content recommendations — "You liked X, you might like Y".
Two strategies:
1. Category-based collaborative filtering (fast, always works)
2. Vector similarity via sentence-transformers embeddings (semantic, requires model)
Falls back to category-based if embeddings are unavailable."""

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
            is_published=True, is_active=True,
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
            is_published=True, is_active=True,
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


def get_similar_posts(post_post_id, limit=5):
    """Get semantically similar posts using vector embeddings.
    Returns list of dicts with content_type, title, url, similarity score.
    Falls back to empty list if embeddings unavailable."""
    try:
        from .embeddings import find_similar_content
        similar_items = find_similar_content('post', post_post_id, limit=limit)

        if not similar_items:
            return []

        # Enrich with post data
        from amolnama_news.site_apps.post.models import Post
        post_ids = [item['content_id'] for item in similar_items]
        posts = {
            post.post_post_id: post
            for post in Post.objects.filter(
                post_post_id__in=post_ids, is_published=True, is_active=True,
            )
        }

        results = []
        for item in similar_items:
            post = posts.get(item['content_id'])
            if post:
                results.append({
                    'content_type': 'post',
                    'title': (post.post_text or '')[:80],
                    'url': f'/post/{post.post_post_id}/',
                    'like_count': post.like_count or 0,
                    'similarity': item['similarity'],
                })
        return results

    except Exception:
        logger.exception('Vector similarity search failed for post %s', post_post_id)
        return []


def get_recommendations_for_user_enhanced(user_profile_id, limit=5):
    """Enhanced recommendations: vector similarity + category fallback.
    Tries semantic search first using user's most-liked posts, falls back to category-based."""
    if not user_profile_id:
        return _get_global_popular(limit)

    # Try vector-based first: find user's most-liked post, get similar content
    try:
        from amolnama_news.site_apps.post.models import PostLike, Post
        recent_liked_post_ids = list(
            PostLike.objects.filter(
                link_user_profile_id=user_profile_id, is_active=True,
            ).order_by('-created_at').values_list('link_post_id', flat=True)[:3]
        )

        if recent_liked_post_ids:
            vector_results = []
            seen_post_ids = set()
            for liked_post_id in recent_liked_post_ids:
                similar = get_similar_posts(liked_post_id, limit=3)
                for item in similar:
                    # Extract post_id from URL
                    post_id = item.get('url', '').split('/post/')[1].rstrip('/') if '/post/' in item.get('url', '') else None
                    if post_id and post_id not in seen_post_ids:
                        seen_post_ids.add(post_id)
                        vector_results.append(item)

            if len(vector_results) >= limit:
                return vector_results[:limit]

            # Fill remaining with category-based
            category_results = get_recommendations_for_user(user_profile_id, limit - len(vector_results))
            return vector_results + category_results

    except Exception:
        logger.exception('Enhanced recommendations failed, falling back to category-based')

    # Fallback: original category-based
    return get_recommendations_for_user(user_profile_id, limit)
