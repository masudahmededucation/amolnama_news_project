"""Search API — cross-app search with Bengali NFC normalization."""

import logging
import unicodedata

from django.http import JsonResponse

logger = logging.getLogger(__name__)


def _normalize_query(query):
    """NFC normalize Bengali text for consistent matching."""
    if not query:
        return ''
    return unicodedata.normalize('NFC', query.strip())


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
            post_text_bn__icontains=query, is_published=True, is_deleted=False,
        ).order_by('-created_at')[:10]
        for post in posts:
            results.append({
                'content_type': 'post',
                'content_type_label': 'POST',
                'content_type_color': 'blue',
                'title': (post.post_text_bn or '')[:100],
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
                'content_type_label': 'POEM',
                'content_type_color': 'purple',
                'title': poem.poem_title_bn or '',
                'url': f'/bangla-kobita-gaan/{poem.poem_slug}/',
                'date': poem.created_at.strftime('%d %b %Y') if poem.created_at else '',
            })
    except Exception:
        logger.exception('Search failed for poems')

    # Search news articles
    try:
        from amolnama_news.site_apps.newshub.models import PubArticle
        articles = PubArticle.objects.filter(
            pub_article_headline_bn__icontains=query, is_published=True,
        ).order_by('-created_at')[:10]
        for article in articles:
            results.append({
                'content_type': 'news',
                'content_type_label': 'NEWS',
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
                'content_type_label': 'DEBATE',
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
                'content_type_label': 'TRAVEL',
                'content_type_color': 'green',
                'title': destination.destination_name_bn or destination.destination_name_en or '',
                'url': f'/bangladesh-tourist-destinations/travel/{destination.destination_slug}/',
                'date': destination.created_at.strftime('%d %b %Y') if destination.created_at else '',
            })
    except Exception:
        logger.exception('Search failed for travel')

    return JsonResponse({'success': True, 'results': results, 'total': len(results), 'query': raw_query})
