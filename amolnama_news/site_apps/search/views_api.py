"""Search API — cross-app search with Bengali NFC normalization."""

import logging
import unicodedata

from django.http import JsonResponse

logger = logging.getLogger(__name__)


def _normalize_query(query):
    """NFC normalize Bengali text, collapse multiple spaces."""
    if not query:
        return ''
    import re
    cleaned = re.sub(r'\s+', ' ', query).strip()
    return unicodedata.normalize('NFC', cleaned)


def api_search(request):
    """GET ?q=... — search across all content apps. Returns grouped results."""
    raw_query = request.GET.get('q', '').strip()
    hashtag_query = request.GET.get('hashtag', '').strip()

    if not raw_query and not hashtag_query:
        return JsonResponse({'success': True, 'results': [], 'total': 0})

    query = _normalize_query(raw_query or hashtag_query)
    if len(query) < 2:
        return JsonResponse({'success': True, 'results': [], 'total': 0})

    results = []

    # Search posts
    try:
        from amolnama_news.site_apps.post.models import Post
        posts = Post.objects.filter(
            post_text__icontains=query, is_published=True, is_active=True,
            link_parent_post_id__isnull=True,
        ).order_by('-created_at')[:20]
        for post in posts:
            results.append({
                'content_type': 'post',
                'content_type_label': 'post',
                'content_type_color': 'blue',
                'title': (post.post_text or '')[:100],
                'url': f'/post/{post.post_post_id}/',
                'date': post.created_at.strftime('%d %b %Y') if post.created_at else '',
            })
    except Exception:
        logger.exception('Search failed for posts')

    # Search poems
    try:
        from amolnama_news.site_apps.poem.models import CollPoemEntry
        from django.db.models import Q
        poems = CollPoemEntry.objects.filter(
            Q(poem_title_bn__icontains=query) | Q(poem_body_bn__icontains=query),
            poem_status_code='published',
        ).order_by('-created_at')[:10]
        for poem in poems:
            results.append({
                'content_type': 'poem',
                'content_type_label': 'poem',
                'content_type_color': 'purple',
                'title': poem.poem_title_bn or '',
                'url': f'/bangla-kobita-gaan/{poem.poem_slug}/',
                'date': poem.created_at.strftime('%d %b %Y') if poem.created_at else '',
            })
    except Exception:
        logger.exception('Search failed for poems')

    # Search news articles (headline only — summary lives on CollNewsEntry, not PubArticle)
    try:
        from amolnama_news.site_apps.newshub.models import PubArticle
        articles = PubArticle.objects.filter(
            pub_article_headline_bn__icontains=query, is_published=True,
        ).order_by('-created_at')[:10]
        for article in articles:
            results.append({
                'content_type': 'news',
                'content_type_label': 'news',
                'content_type_color': 'rose',
                'title': article.pub_article_headline_bn or '',
                'url': f'/newshub/article/{article.pub_article_slug}/',
                'date': article.created_at.strftime('%d %b %Y') if article.created_at else '',
            })
    except Exception:
        logger.exception('Search failed for news')

    # Search debates
    try:
        from amolnama_news.site_apps.debate.models import CollTopic
        topics = CollTopic.objects.filter(
            topic_title__icontains=query, is_active=True,
        ).order_by('-scheduled_start_at')[:10]
        for topic in topics:
            results.append({
                'content_type': 'debate',
                'content_type_label': 'debate',
                'content_type_color': 'amber',
                'title': topic.topic_title or '',
                'url': f'/debate/topic/{topic.debate_coll_topic_id}/',
                'date': topic.scheduled_start_at.strftime('%d %b %Y') if topic.scheduled_start_at else '',
            })
    except Exception:
        logger.exception('Search failed for debates')

    # Search travel destinations
    try:
        from amolnama_news.site_apps.bangladesh.models import CollDestination
        from django.db.models import Q as TravelQ
        destinations = CollDestination.objects.filter(
            TravelQ(destination_name_bn__icontains=query) | TravelQ(destination_name_en__icontains=query),
            destination_status='published',
        ).order_by('-created_at')[:10]
        for destination in destinations:
            results.append({
                'content_type': 'travel',
                'content_type_label': 'travel',
                'content_type_color': 'green',
                'title': destination.destination_name_bn or destination.destination_name_en or '',
                'url': f'/bangladesh-tourist-destinations/travel/{destination.destination_slug}/',
                'date': destination.created_at.strftime('%d %b %Y') if destination.created_at else '',
            })
    except Exception:
        logger.exception('Search failed for travel')

    # Get hashtag stats if searching by hashtag
    hashtag_post_count = None
    hashtag_user_count = None
    if hashtag_query:
        from amolnama_news.site_apps.newsengine.models import HashtagItem, HashtagPostLink
        hashtag_item = HashtagItem.objects.filter(hashtag_text=hashtag_query, is_active=True).first()
        if hashtag_item:
            hashtag_post_count = hashtag_item.hashtag_post_count
            # Count unique users who used this hashtag
            from amolnama_news.site_apps.post.models import Post
            post_ids = list(HashtagPostLink.objects.filter(
                link_hashtag_id=hashtag_item.newsengine_hashtag_item_id, is_active=True,
            ).values_list('link_post_id', flat=True))
            if post_ids:
                hashtag_user_count = Post.objects.filter(
                    post_post_id__in=post_ids, is_active=True,
                ).values('link_user_profile_id').distinct().count()

    return JsonResponse({
        'success': True,
        'results': results,
        'total': len(results),
        'query': raw_query,
        'hashtag': hashtag_query or None,
        'hashtag_post_count': hashtag_post_count,
        'hashtag_user_count': hashtag_user_count,
    })
