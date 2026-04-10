"""Social bookmarks page — `/social/bookmarks/`.

Renders the user's saved content (post bookmarks + universal content bookmarks).
Split out from social/views.py because it's an atomic, independent feature with
zero shared state with the profile / lists / follow pages.
"""

import logging

from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie

logger = logging.getLogger(__name__)

SEO_CONTEXT = {
    'title': 'সংরক্ষিত — আমলনামা নিউজ',
    'breadcrumbs': [{'name': 'হোম', 'url': '/'}, {'name': 'সংরক্ষিত'}],
}


def _fetch_post_bookmarks(request, user_profile_id):
    """Wall-post bookmarks (legacy [post].[post_bookmark] table). Returns enriched feed items list."""
    from amolnama_news.site_apps.post.models import PostBookmark, Post
    from amolnama_news.site_apps.post.views import build_post_feed_items

    try:
        bookmarked_post_ids = list(
            PostBookmark.objects.filter(link_user_profile_id=user_profile_id)
            .order_by('-created_at').values_list('link_post_id', flat=True)[:50]
        )
        if not bookmarked_post_ids:
            return []
        posts_map = {p.post_post_id: p for p in Post.objects.filter(post_post_id__in=bookmarked_post_ids, is_active=True)}
        posts = [posts_map[pid] for pid in bookmarked_post_ids if pid in posts_map]
        post_items, _ = build_post_feed_items(request, posts=posts)
        return post_items
    except Exception as post_bookmark_fetch_error:
        logger.error('Post bookmark fetch failed — %s', post_bookmark_fetch_error)
        return []


def _fetch_universal_bookmarks(user_profile_id):
    """Universal content bookmarks ([newsengine].[bookmark_content]). Returns promo-card-shaped dicts."""
    from amolnama_news.site_apps.newsengine.models import BookmarkContent
    from amolnama_news.site_apps.core.utils import get_content_type_metadata
    from amolnama_news.site_apps.content.cover_urls import get_cover_urls_for_content_refs

    try:
        bookmarks_qs = list(BookmarkContent.objects.filter(
            link_user_profile_id=user_profile_id, is_active=True,
        ).order_by('-created_at')[:50])
        if not bookmarks_qs:
            return []

        # One bulk call for cover URLs across all content types in this user's bookmarks
        content_refs = [(b.bookmark_content_type_code, b.bookmark_content_id) for b in bookmarks_qs]
        cover_url_map = get_cover_urls_for_content_refs(content_refs)

        items = []
        for bookmark in bookmarks_qs:
            type_code = bookmark.bookmark_content_type_code
            meta = get_content_type_metadata(type_code)
            items.append({
                'item_type': 'content_promo',
                'promo_id': bookmark.bookmark_content_id,
                'promo_badge': meta['badge'],
                'promo_color': meta['color'],
                'promo_cta': meta['cta'],
                'promo_title': bookmark.bookmark_content_title or '',
                'promo_description': '',
                'promo_url': bookmark.bookmark_content_url or '#',
                'promo_cover_image_url': cover_url_map.get((type_code, bookmark.bookmark_content_id), ''),
                'promo_author': None, 'promo_date_formatted': '',
                'promo_like_count': None, 'promo_view_count': None, 'promo_extra_stat': None,
            })
        return items
    except Exception as bookmark_fetch_error:
        logger.error('Universal bookmark fetch failed — %s', bookmark_fetch_error)
        return []


@login_required
@ensure_csrf_cookie
def bookmarks(request):
    """User's saved content — wall posts + universal content bookmarks (poems, art, stories, travel, news)."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return render(request, 'social/pages/bookmarks.html', {
            'posts': [], 'universal_bookmarks': [], 'seo': SEO_CONTEXT,
        })

    return render(request, 'social/pages/bookmarks.html', {
        'posts': _fetch_post_bookmarks(request, current_profile.user_profile_id),
        'universal_bookmarks': _fetch_universal_bookmarks(current_profile.user_profile_id),
        'seo': SEO_CONTEXT,
    })
