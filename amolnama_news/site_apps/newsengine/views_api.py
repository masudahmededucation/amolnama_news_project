"""Newsengine API views — global notifications, universal bookmarks, feed pagination."""

import json
from amolnama_news.site_apps.core.utils import get_user_profile_id as _get_user_profile_id
import logging

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

logger = logging.getLogger(__name__)



# =========================================================
# GLOBAL NOTIFICATIONS
# =========================================================

@login_required
def api_notifications_list(request):
    """GET — latest 20 notifications + unread count for current user."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'Profile not found'}, status=400)

    from .notifications import get_notifications_list, get_unread_count
    notifications = get_notifications_list(user_profile_id)
    unread_count = get_unread_count(user_profile_id)

    return JsonResponse({'success': True, 'notifications': notifications, 'unread_count': unread_count})


@login_required
@require_POST
def api_notifications_mark_read(request):
    """POST — mark all notifications as read for current user."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'Profile not found'}, status=400)

    from .notifications import mark_all_read
    mark_all_read(user_profile_id)

    return JsonResponse({'success': True})


# =========================================================
# UNIVERSAL BOOKMARKS
# =========================================================

@login_required
@require_POST
def api_bookmark_toggle(request):
    """Toggle bookmark for any content type. POST {content_type_code, content_id, content_title, content_url}.

    This is the universal bookmark endpoint. Per-app endpoints (art/story/poem/destination)
    are thin wrappers around the same shared toggle_bookmark() helper, so this and they all
    write to the same [newsengine].[bookmark_content] table — one source of truth.
    """
    from amolnama_news.site_apps.core.utils import toggle_bookmark, get_user_profile_id

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'Profile not found'}, status=400)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    content_type_code = data.get('content_type_code', '')
    content_id = data.get('content_id')
    content_title = data.get('content_title', '') or ''
    content_url = data.get('content_url', '') or ''

    if not content_type_code or not content_id:
        return JsonResponse({'success': False, 'error': 'Missing content_type_code or content_id'}, status=400)

    bookmarked, count = toggle_bookmark(
        user_profile_id=user_profile_id,
        content_type_code=content_type_code,
        content_id=content_id,
        content_title=content_title,
        content_url=content_url,
    )
    return JsonResponse({'success': True, 'bookmarked': bookmarked, 'bookmark_count': count})


# =========================================================
# FEED PAGINATION
# =========================================================

@login_required
def api_feed_page(request):
    """GET — paginated feed items. ?page=2&page_size=20&category=poem."""
    try:
        page = int(request.GET.get('page', 1))
    except (ValueError, TypeError):
        page = 1
    try:
        page_size = min(int(request.GET.get('page_size', 20)), 50)
    except (ValueError, TypeError):
        page_size = 20
    category_filter = request.GET.get('category', '')

    from .feed_builder import build_home_feed
    feed_items, current_user_avatar_url, active_tab, following_count, _ = build_home_feed(request)

    # Paginate
    start_index = (page - 1) * page_size
    end_index = start_index + page_size
    page_items = feed_items[start_index:end_index]
    has_more = end_index < len(feed_items)

    # Render each item to HTML for infinite scroll
    from django.template.loader import render_to_string
    rendered_items = []
    rendered_items_with_ids = []
    for item in page_items:
        item_type = item.get('item_type', '')
        post_id = item.get('post_post_id')
        try:
            if item_type == 'debate_promo':
                html = render_to_string('debate/components/debate-promo-card.html', {'promo': item, 'request': request})
            elif item_type == 'content_promo':
                html = render_to_string('core/components/content-promo-card.html', {'promo': item, 'request': request})
            elif item_type == 'tools_promo':
                html = render_to_string('tools/components/tools-promo-card.html', {'promo': item, 'request': request})
            else:
                html = render_to_string('post/components/post-card.html', {'post_item': item, 'request': request})
            rendered_items.append(html)
            rendered_items_with_ids.append({'post_id': post_id, 'html': html})
        except Exception:
            logger.exception('Failed to render feed item')

    return JsonResponse({
        'success': True,
        'items_html': rendered_items,
        'items': rendered_items_with_ids,
        'has_more': has_more,
        'page': page,
    })


# =========================================================
# CONTENT RECOMMENDATIONS
# =========================================================

@login_required
def api_recommendations(request):
    """GET — personalized content recommendations for current user."""
    user_profile_id = _get_user_profile_id(request)

    from .recommendations import get_recommendations_for_user_enhanced
    items = get_recommendations_for_user_enhanced(user_profile_id, limit=5)

    # Include topic discovery from graph (topics friends like that user doesn't follow)
    discovered_topics = []
    if user_profile_id:
        try:
            from .feed_fanout import discover_topics_for_user
            discovered_topics = discover_topics_for_user(user_profile_id, limit=5)
        except Exception:
            logger.exception('Topic discovery failed for user %s', user_profile_id)

    return JsonResponse({'success': True, 'recommendations': items, 'discovered_topics': discovered_topics})


# =========================================================
# TRENDING HASHTAGS
# =========================================================

def api_trending_hashtags(request):
    """GET — top 10 hashtags by post count."""
    from .models import HashtagItem
    hashtags = HashtagItem.objects.filter(
        is_active=True, hashtag_post_count__gt=0,
    ).order_by('-hashtag_post_count')[:10]

    items = [{
        'hashtag_id': hashtag.newsengine_hashtag_item_id,
        'hashtag_text': hashtag.hashtag_text,
        'post_count': hashtag.hashtag_post_count,
    } for hashtag in hashtags]

    return JsonResponse({'success': True, 'hashtags': items})


# =========================================================
# MUTED WORDS
# =========================================================

@login_required
@require_POST
def api_muted_word_add(request):
    """Add a muted word for the current user."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'Profile not found'}, status=400)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    muted_word = (data.get('muted_word') or '').strip().lower()
    if not muted_word or len(muted_word) < 2:
        return JsonResponse({'success': False, 'error': 'শব্দটি কমপক্ষে ২ অক্ষর হতে হবে'}, status=400)

    from .models import MutedWordItem
    existing = MutedWordItem.objects.filter(
        link_user_profile_id=user_profile_id, muted_word_text=muted_word, is_active=True,
    ).first()
    if existing:
        return JsonResponse({'success': False, 'error': 'এই শব্দটি ইতিমধ্যে মিউট করা আছে'}, status=400)

    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [newsengine].[muted_word_item] ([link_user_profile_id], [muted_word_text])
            VALUES (%s, %s)
        """, [user_profile_id, muted_word])

    return JsonResponse({'success': True})


@login_required
@require_POST
def api_muted_word_remove(request):
    """Remove a muted word for the current user."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'Profile not found'}, status=400)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    muted_word = (data.get('muted_word') or '').strip().lower()

    from .models import MutedWordItem
    MutedWordItem.objects.filter(
        link_user_profile_id=user_profile_id, muted_word_text=muted_word, is_active=True,
    ).delete()

    return JsonResponse({'success': True})


@login_required
def api_muted_words_list(request):
    """Get all muted words for current user."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': True, 'muted_words': []})

    from .models import MutedWordItem
    words = list(MutedWordItem.objects.filter(
        link_user_profile_id=user_profile_id, is_active=True,
    ).values_list('muted_word_text', flat=True))

    return JsonResponse({'success': True, 'muted_words': words})


# =========================================================
# LINK PREVIEW (shared — used by post + debate)
# =========================================================

@login_required
def api_link_preview(request):
    """Fetch og:title, og:description, og:image for a URL. GET ?url=..."""
    import urllib.request
    import ipaddress
    from html.parser import HTMLParser
    from urllib.parse import urlparse

    target_url = request.GET.get('url', '').strip()
    if not target_url or not target_url.startswith('http'):
        return JsonResponse({'success': False, 'error': 'Invalid URL'}, status=400)

    # SSRF protection — block internal/private IPs
    try:
        parsed_hostname = urlparse(target_url).hostname or ''
        if parsed_hostname.lower() in ('localhost', '127.0.0.1', '::1', '0.0.0.0'):
            return JsonResponse({'success': False, 'error': 'Invalid URL'}, status=400)
        import socket
        resolved_ip = socket.getaddrinfo(parsed_hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)[0][4][0]
        if ipaddress.ip_address(resolved_ip).is_private:
            return JsonResponse({'success': False, 'error': 'Invalid URL'}, status=400)
    except Exception as url_validation_error:
        logger.warning('Link preview URL validation failed for %s — %s', target_url, url_validation_error)
        return JsonResponse({'success': False, 'error': 'Invalid URL'}, status=400)

    try:
        headers = {'User-Agent': 'Mozilla/5.0 (compatible; AmolnamaBot/1.0)'}
        url_request = urllib.request.Request(target_url, headers=headers)
        response = urllib.request.urlopen(url_request, timeout=5)
        html_content = response.read(50000).decode('utf-8', errors='ignore')
    except Exception as url_fetch_error:
        logger.warning('Link preview fetch failed for %s — %s', target_url, url_fetch_error)
        return JsonResponse({'success': False, 'error': 'Could not fetch URL'}, status=400)

    og_data = {}
    title_text = ''

    class OgParser(HTMLParser):
        def handle_starttag(self, tag, attrs):
            nonlocal title_text
            if tag == 'meta':
                attr_dict = dict(attrs)
                property_name = attr_dict.get('property', '').lower()
                content_value = attr_dict.get('content', '')
                if property_name == 'og:title':
                    og_data['title'] = content_value
                elif property_name == 'og:description':
                    og_data['description'] = content_value
                elif property_name == 'og:image':
                    og_data['image'] = content_value

        def handle_data(self, data):
            nonlocal title_text
            if self.lasttag == 'title' and not title_text:
                title_text = data.strip()

    try:
        OgParser().feed(html_content)
    except Exception as og_parser_error:
        logger.warning('OG metadata parse failed for %s — %s', target_url, og_parser_error)

    return JsonResponse({
        'success': True,
        'title': og_data.get('title', title_text or ''),
        'description': og_data.get('description', '')[:300],
        'image': og_data.get('image', ''),
        'url': target_url,
    })


# =========================================================
# RELATED CONTENT (cache-first + background compute on miss)
# =========================================================

def api_related_content(request):
    """GET /newsengine/api/related-content/?type=post&id=123&text=...
    Returns cached related content. If cache miss and text provided,
    triggers background compute and returns [] immediately."""
    content_type_code = request.GET.get('type', '')
    content_id = request.GET.get('id', '')
    text = request.GET.get('text', '')

    if not content_type_code or not content_id:
        return JsonResponse({'success': False, 'error': 'Missing type or id'}, status=400)

    try:
        content_id = int(content_id)
    except (ValueError, TypeError):
        return JsonResponse({'success': False, 'error': 'Invalid id'}, status=400)

    from amolnama_news.site_apps.newsengine.related_content import (
        get_cached_related_content,
        compute_and_cache_related_content_background,
    )

    cached_items = get_cached_related_content(content_type_code, content_id)

    if cached_items:
        return JsonResponse({'success': True, 'items': cached_items})

    # Cache miss — trigger background compute only for authenticated users
    # (prevents unauthenticated spam of expensive sentence-transformer compute)
    if text and len(text) >= 10 and request.user.is_authenticated:
        compute_and_cache_related_content_background(content_type_code, content_id, text)

    return JsonResponse({'success': True, 'items': []})


# =========================================================
# STORY THREAD — articles in a developing story
# =========================================================

@require_GET
def api_story_thread_articles(request, thread_id):
    """GET /newsengine/api/story-thread/<id>/articles/ — articles in a story thread."""
    from .story_clustering import get_articles_in_thread

    exclude_entry_id = None
    try:
        exclude_entry_id = int(request.GET.get('exclude', 0)) or None
    except (ValueError, TypeError):
        pass

    articles = get_articles_in_thread(thread_id, limit=10, exclude_entry_id=exclude_entry_id)

    return JsonResponse({
        'success': True,
        'articles': articles,
    })
