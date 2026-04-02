"""Newsengine API views — global notifications, universal bookmarks, feed pagination."""

import json
import logging

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

logger = logging.getLogger(__name__)


def _get_user_profile_id(request):
    """Get current user's profile ID or None."""
    if not request.user.is_authenticated:
        return None
    try:
        from amolnama_news.site_apps.user_account.models import UserProfile
        return UserProfile.objects.get(link_user_account_user_id=request.user.pk).user_profile_id
    except Exception:
        return None


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
    """Toggle bookmark for any content type. POST {content_type_code, content_id, content_title, content_url}."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'Profile not found'}, status=400)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    content_type_code = data.get('content_type_code', '')
    content_id = data.get('content_id')
    content_title = data.get('content_title', '') or None
    content_url = data.get('content_url', '') or None

    if not content_type_code or not content_id:
        return JsonResponse({'success': False, 'error': 'Missing content_type_code or content_id'}, status=400)

    from .models import CollContentBookmark

    existing = CollContentBookmark.objects.filter(
        link_user_profile_id=user_profile_id,
        content_type_code=content_type_code,
        content_id=content_id,
        is_active=True,
    ).first()

    if existing:
        existing.delete()
        return JsonResponse({'success': True, 'action': 'removed'})
    else:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [newsengine].[coll_content_bookmark]
                    ([link_user_profile_id], [content_type_code], [content_id], [content_title], [content_url])
                VALUES (?, ?, ?, ?, ?)
            """, [user_profile_id, content_type_code, content_id, content_title, content_url])
        return JsonResponse({'success': True, 'action': 'bookmarked'})


# =========================================================
# FEED PAGINATION
# =========================================================

@login_required
def api_feed_page(request):
    """GET — paginated feed items. ?page=2&page_size=20&category=poem."""
    page = int(request.GET.get('page', 1))
    page_size = min(int(request.GET.get('page_size', 20)), 50)
    category_filter = request.GET.get('category', '')

    from .feed_builder import build_home_feed
    feed_items, current_user_avatar_url, active_tab, following_count = build_home_feed(request)

    # Paginate
    start_index = (page - 1) * page_size
    end_index = start_index + page_size
    page_items = feed_items[start_index:end_index]
    has_more = end_index < len(feed_items)

    # Render each item to HTML for infinite scroll
    from django.template.loader import render_to_string
    rendered_items = []
    for item in page_items:
        item_type = item.get('item_type', '')
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
        except Exception:
            logger.exception('Failed to render feed item')

    return JsonResponse({
        'success': True,
        'items_html': rendered_items,
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

    from .recommendations import get_recommendations_for_user
    items = get_recommendations_for_user(user_profile_id, limit=5)

    return JsonResponse({'success': True, 'recommendations': items})


# =========================================================
# TRENDING HASHTAGS
# =========================================================

def api_trending_hashtags(request):
    """GET — top 10 hashtags by post count."""
    from .models import CollHashtag
    hashtags = CollHashtag.objects.filter(
        is_active=True, post_count__gt=0,
    ).order_by('-post_count')[:10]

    items = [{
        'hashtag_id': hashtag.newsengine_coll_hashtag_id,
        'hashtag_text': hashtag.hashtag_text,
        'post_count': hashtag.post_count,
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

    from .models import CollMutedWord
    existing = CollMutedWord.objects.filter(
        link_user_profile_id=user_profile_id, muted_word=muted_word, is_active=True,
    ).first()
    if existing:
        return JsonResponse({'success': False, 'error': 'এই শব্দটি ইতিমধ্যে মিউট করা আছে'}, status=400)

    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [newsengine].[coll_muted_word] ([link_user_profile_id], [muted_word])
            VALUES (?, ?)
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

    from .models import CollMutedWord
    CollMutedWord.objects.filter(
        link_user_profile_id=user_profile_id, muted_word=muted_word, is_active=True,
    ).delete()

    return JsonResponse({'success': True})


@login_required
def api_muted_words_list(request):
    """Get all muted words for current user."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': True, 'muted_words': []})

    from .models import CollMutedWord
    words = list(CollMutedWord.objects.filter(
        link_user_profile_id=user_profile_id, is_active=True,
    ).values_list('muted_word', flat=True))

    return JsonResponse({'success': True, 'muted_words': words})


# =========================================================
# LINK PREVIEW (shared — used by post + debate)
# =========================================================

def api_link_preview(request):
    """Fetch og:title, og:description, og:image for a URL. GET ?url=..."""
    import urllib.request
    from html.parser import HTMLParser

    target_url = request.GET.get('url', '').strip()
    if not target_url or not target_url.startswith('http'):
        return JsonResponse({'success': False, 'error': 'Invalid URL'}, status=400)

    try:
        headers = {'User-Agent': 'Mozilla/5.0 (compatible; AmolnamaBot/1.0)'}
        url_request = urllib.request.Request(target_url, headers=headers)
        response = urllib.request.urlopen(url_request, timeout=5)
        html_content = response.read(50000).decode('utf-8', errors='ignore')
    except Exception:
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
    except Exception:
        pass

    return JsonResponse({
        'success': True,
        'title': og_data.get('title', title_text or ''),
        'description': og_data.get('description', '')[:300],
        'image': og_data.get('image', ''),
        'url': target_url,
    })
