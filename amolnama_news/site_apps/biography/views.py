"""Biography views — page views."""

import logging

from django.shortcuts import render, redirect
from django.http import Http404
from django.contrib.auth.decorators import login_required
from django.db import connection
from django.views.decorators.csrf import ensure_csrf_cookie

from amolnama_news.site_apps.content.models import RefContentSubcategory
from amolnama_news.site_apps.core.utils import time_ago as _time_ago

from .models import CollBiographyEntry

logger = logging.getLogger(__name__)

PAGE_SIZE = 12


def home(request):
    """Biography landing page."""
    categories = list(
        RefContentSubcategory.objects.filter(
            group_code='blog_biography_category', is_active=True
        ).order_by('sort_order')
    )

    entries = list(
        CollBiographyEntry.objects.filter(
            biography_entry_status_code='published', is_active=True
        ).order_by('-is_featured', '-created_at')[:PAGE_SIZE + 1]
    )
    has_next = len(entries) > PAGE_SIZE
    entries = entries[:PAGE_SIZE]

    category_map = {c.content_ref_content_subcategory_id: c for c in categories}
    for entry in entries:
        category = category_map.get(entry.link_content_ref_content_subcategory_id)
        entry.category_name_bn = category.subcategory_name_bn if category else ''
        entry.category_icon = category.subcategory_icon if category else ''
        entry.time_ago = _time_ago(entry.created_at)

    return render(request, 'biography/pages/biography-home.html', {
        'categories': categories,
        'entries': entries,
        'has_next': has_next,
        'active_sidebar_nav_id': 'biography',
        'seo': {
            'title': 'জীবনকথা — আমলনামা নিউজ | Biography',
            'description': 'মহান ব্যক্তিদের জীবনী, অনুপ্রেরণামূলক গল্প এবং জীবনের শিক্ষা।',
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'জীবনকথা', 'url': None},
            ],
        },
    })


def detail_by_slug(request, biography_entry_slug):
    """Biography detail page — by slug."""
    entry = CollBiographyEntry.objects.filter(
        biography_entry_slug=biography_entry_slug,
        biography_entry_status_code='published',
        is_active=True,
    ).first()
    if not entry:
        raise Http404
    return _render_detail(request, entry)


def detail_by_id(request, biography_entry_id):
    """Biography detail — by ID, redirects to slug."""
    entry = CollBiographyEntry.objects.filter(
        blog_biography_coll_biography_entry_id=biography_entry_id,
        is_active=True,
    ).first()
    if not entry:
        raise Http404
    if entry.biography_entry_slug:
        return redirect('biography:detail', biography_entry_slug=entry.biography_entry_slug, permanent=True)
    return _render_detail(request, entry)


def _render_detail(request, entry):
    """Shared detail page renderer with life sections, quotes, photos, YouTube, tributes."""
    from amolnama_news.site_apps.core.utils import get_user_profile_id

    entry.time_ago = _time_ago(entry.created_at)

    category = None
    if entry.link_content_ref_content_subcategory_id:
        category = RefContentSubcategory.objects.filter(
            content_ref_content_subcategory_id=entry.link_content_ref_content_subcategory_id
        ).first()

    user_profile_id = get_user_profile_id(request)
    can_edit = False
    if user_profile_id:
        can_edit = (entry.link_user_profile_id == user_profile_id) or (
            request.user.is_staff or request.user.is_superuser
        )

    CollBiographyEntry.objects.filter(
        blog_biography_coll_biography_entry_id=entry.blog_biography_coll_biography_entry_id
    ).update(view_count=entry.view_count + 1)

    entry_id = entry.blog_biography_coll_biography_entry_id

    # Life sections
    life_sections = []
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT blog_biography_biography_life_section_id, section_title_bn, section_title_en,
                       section_content_bn, section_start_year, section_end_year
                FROM [blog_biography].[biography_life_section]
                WHERE link_blog_biography_coll_biography_entry_id = %s AND is_active = 1
                ORDER BY sort_order
            """, [entry_id])
            for row in cursor.fetchall():
                life_sections.append({
                    'section_id': row[0], 'title_bn': row[1], 'title_en': row[2],
                    'content_bn': row[3], 'start_year': row[4], 'end_year': row[5],
                })
    except Exception:
        logger.exception('Failed to load biography life sections')

    # Quotes
    quotes = []
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT blog_biography_biography_quote_id, quote_title_bn, quote_text_bn,
                       quote_text_en, quote_explanation_bn, quote_source_bn
                FROM [blog_biography].[biography_quote]
                WHERE link_blog_biography_coll_biography_entry_id = %s AND is_active = 1
                ORDER BY sort_order
            """, [entry_id])
            for row in cursor.fetchall():
                quotes.append({
                    'quote_id': row[0], 'title_bn': row[1], 'text_bn': row[2],
                    'text_en': row[3], 'explanation_bn': row[4], 'source_bn': row[5],
                })
    except Exception:
        logger.exception('Failed to load biography quotes')

    # Photos
    photos = []
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT blog_biography_biography_entry_photo_id, photo_url, photo_thumbnail_url,
                       caption_bn, photo_era_label_bn, is_cover, like_count, view_count
                FROM [blog_biography].[biography_entry_photo]
                WHERE link_blog_biography_coll_biography_entry_id = %s AND is_active = 1
                ORDER BY sort_order
            """, [entry_id])
            for row in cursor.fetchall():
                photos.append({
                    'photo_id': row[0], 'photo_url': row[1], 'thumbnail_url': row[2],
                    'caption_bn': row[3], 'era_label_bn': row[4], 'is_cover': row[5],
                    'like_count': row[6], 'view_count': row[7],
                })
    except Exception:
        logger.exception('Failed to load biography photos')

    # YouTube links
    youtube_links = []
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT blog_biography_biography_entry_youtube_link_id, youtube_url, youtube_video_id,
                       video_title_bn, video_platform, video_thumbnail_url, like_count, view_count
                FROM [blog_biography].[biography_entry_youtube_link]
                WHERE link_blog_biography_coll_biography_entry_id = %s AND is_active = 1
                ORDER BY sort_order
            """, [entry_id])
            for row in cursor.fetchall():
                youtube_links.append({
                    'link_id': row[0], 'url': row[1], 'video_id': row[2],
                    'title_bn': row[3], 'platform': row[4], 'thumbnail_url': row[5],
                    'like_count': row[6], 'view_count': row[7],
                })
    except Exception:
        logger.exception('Failed to load biography YouTube links')

    # Tributes (memoriam only)
    tributes = []
    if entry.is_memoriam:
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT blog_biography_biography_tribute_id, tribute_text_bn,
                           tribute_relationship_bn, link_user_profile_id, created_at
                    FROM [blog_biography].[biography_tribute]
                    WHERE link_blog_biography_coll_biography_entry_id = %s AND is_active = 1
                    ORDER BY created_at DESC
                """, [entry_id])
                for row in cursor.fetchall():
                    tributes.append({
                        'tribute_id': row[0], 'text_bn': row[1],
                        'relationship_bn': row[2], 'user_profile_id': row[3], 'created_at': row[4],
                    })
        except Exception:
            logger.exception('Failed to load biography tributes')

    # Author info
    author_display_name = 'ব্যবহারকারী'
    try:
        from amolnama_news.site_apps.user_account.models import UserProfile
        author_profile = UserProfile.objects.filter(
            user_profile_id=entry.link_user_profile_id
        ).only('display_name').first()
        if author_profile:
            author_display_name = author_profile.display_name or 'ব্যবহারকারী'
    except Exception:
        pass

    return render(request, 'biography/pages/biography-detail.html', {
        'entry': entry,
        'category': category,
        'life_sections': life_sections,
        'quotes': quotes,
        'photos': photos,
        'youtube_links': youtube_links,
        'tributes': tributes,
        'author_display_name': author_display_name,
        'can_edit': can_edit,
        'biography_entry_like_count': entry.like_count,
        'biography_entry_view_count': entry.view_count + 1,
        'bookmark_count': entry.bookmark_count,
        'active_sidebar_nav_id': 'biography',
        'seo': {
            'title': f'{entry.biography_entry_title_bn} — জীবনকথা',
            'description': entry.biography_entry_short_description_bn or entry.biography_entry_title_bn,
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'জীবনকথা', 'url': '/jibonkotha/'},
                {'name': entry.biography_entry_title_bn, 'url': None},
            ],
        },
    })


@login_required
@ensure_csrf_cookie
def add(request):
    """Add biography form page."""
    categories = list(
        RefContentSubcategory.objects.filter(
            group_code='blog_biography_category', is_active=True
        ).order_by('sort_order')
    )

    return render(request, 'biography/pages/biography-add.html', {
        'categories': categories,
        'active_sidebar_nav_id': 'biography',
        'seo': {
            'title': 'জীবনকথা যোগ করুন — আমলনামা নিউজ',
            'description': 'একজন মহান ব্যক্তির জীবনকথা লিখুন এবং শেয়ার করুন।',
        },
    })
