"""Student Life views — page views."""

import logging

from django.shortcuts import render, redirect
from django.http import Http404
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import ensure_csrf_cookie

from amolnama_news.site_apps.content.models import RefContentSubcategory
from amolnama_news.site_apps.core.utils import time_ago as _time_ago

from .models import CollCampusEntry

logger = logging.getLogger(__name__)

PAGE_SIZE = 12


def home(request):
    """Campus Life landing page — browse campus entries with category filter."""
    categories = list(
        RefContentSubcategory.objects.filter(
            group_code='blog_studentlife_category', is_active=True
        ).order_by('sort_order')
    )

    entries = list(
        CollCampusEntry.objects.filter(
            campus_entry_status_code='published', is_active=True
        ).order_by('-is_featured', '-created_at')[:PAGE_SIZE + 1]
    )
    has_next = len(entries) > PAGE_SIZE
    entries = entries[:PAGE_SIZE]

    subcategory_map = {c.content_ref_content_subcategory_id: c for c in categories}
    for entry in entries:
        subcategory = subcategory_map.get(entry.link_content_ref_content_subcategory_id)
        entry.category_name_bn = subcategory.subcategory_name_bn if subcategory else ''
        entry.category_icon = subcategory.subcategory_icon if subcategory else ''
        entry.time_ago = _time_ago(entry.created_at)

    return render(request, 'studentlife/pages/studentlife-home.html', {
        'categories': categories,
        'entries': entries,
        'has_next': has_next,
        'active_sidebar_nav_id': 'studentlife',
        'seo': {
            'title': 'ক্যাম্পাস লাইফ — আমলনামা নিউজ | Campus Life',
            'description': 'বিশ্ববিদ্যালয় ও স্কুল ক্যাম্পাসের গল্প, প্রতিভা, ভর্তি টিপস এবং ভ্রমণ গাইড।',
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'ক্যাম্পাস লাইফ', 'url': None},
            ],
        },
    })


def detail_by_slug(request, campus_entry_slug):
    """Campus entry detail page — by slug."""
    entry = CollCampusEntry.objects.filter(
        campus_entry_slug=campus_entry_slug,
        campus_entry_status_code='published',
        is_active=True,
    ).first()
    if not entry:
        raise Http404

    return _render_detail(request, entry)


def detail_by_id(request, campus_entry_id):
    """Campus entry detail — by ID, redirects to slug URL if available."""
    entry = CollCampusEntry.objects.filter(
        blog_studentlife_coll_campus_entry_id=campus_entry_id,
        is_active=True,
    ).first()
    if not entry:
        raise Http404

    if entry.campus_entry_slug:
        return redirect('studentlife:detail', campus_entry_slug=entry.campus_entry_slug, permanent=True)

    return _render_detail(request, entry)


def _render_detail(request, entry):
    """Shared detail page renderer."""
    from amolnama_news.site_apps.core.utils import get_user_profile_id

    entry.time_ago = _time_ago(entry.created_at)

    # Get category info
    category = None
    if entry.link_content_ref_content_subcategory_id:
        category = RefContentSubcategory.objects.filter(
            content_ref_content_subcategory_id=entry.link_content_ref_content_subcategory_id
        ).first()

    # Check user engagement
    user_profile_id = get_user_profile_id(request)
    user_liked = False
    user_bookmarked = False
    can_edit = False

    if user_profile_id:
        from .models import CollCampusEntry
        can_edit = (entry.link_user_profile_id == user_profile_id) or (
            request.user.is_staff or request.user.is_superuser
        )

    # Increment view count
    CollCampusEntry.objects.filter(
        blog_studentlife_coll_campus_entry_id=entry.blog_studentlife_coll_campus_entry_id
    ).update(view_count=entry.view_count + 1)

    # Get photos
    from django.db import connection
    photos = []
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT blog_studentlife_campus_entry_photo_id, photo_url, photo_thumbnail_url,
                       caption_bn, is_cover, like_count, view_count, link_user_profile_id, created_at
                FROM [blog_studentlife].[campus_entry_photo]
                WHERE link_blog_studentlife_coll_campus_entry_id = %s AND is_active = 1
                ORDER BY sort_order
            """, [entry.blog_studentlife_coll_campus_entry_id])
            for row in cursor.fetchall():
                photos.append({
                    'photo_id': row[0], 'photo_url': row[1], 'thumbnail_url': row[2],
                    'caption_bn': row[3], 'is_cover': row[4], 'like_count': row[5],
                    'view_count': row[6], 'uploader_id': row[7], 'created_at': row[8],
                })
    except Exception:
        logger.exception('Failed to load campus entry photos')

    # Get YouTube links
    youtube_links = []
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT blog_studentlife_campus_entry_youtube_link_id, youtube_url, youtube_video_id,
                       video_title_bn, video_platform, video_thumbnail_url, like_count, view_count
                FROM [blog_studentlife].[campus_entry_youtube_link]
                WHERE link_blog_studentlife_coll_campus_entry_id = %s AND is_active = 1
                ORDER BY sort_order
            """, [entry.blog_studentlife_coll_campus_entry_id])
            for row in cursor.fetchall():
                youtube_links.append({
                    'link_id': row[0], 'url': row[1], 'video_id': row[2],
                    'title_bn': row[3], 'platform': row[4], 'thumbnail_url': row[5],
                    'like_count': row[6], 'view_count': row[7],
                })
    except Exception:
        logger.exception('Failed to load campus entry YouTube links')

    # Author info
    author_display_name = 'ব্যবহারকারী'
    try:
        from amolnama_news.site_apps.user_account.models import UserProfile
        author_profile = UserProfile.objects.filter(
            user_profile_id=entry.link_user_profile_id
        ).only('display_name', 'username_handle').first()
        if author_profile:
            author_display_name = author_profile.display_name or 'ব্যবহারকারী'
    except Exception:
        pass

    return render(request, 'studentlife/pages/studentlife-detail.html', {
        'entry': entry,
        'category': category,
        'photos': photos,
        'youtube_links': youtube_links,
        'author_display_name': author_display_name,
        'user_liked': user_liked,
        'user_bookmarked': user_bookmarked,
        'can_edit': can_edit,
        'campus_entry_like_count': entry.like_count,
        'campus_entry_view_count': entry.view_count + 1,
        'bookmark_count': entry.bookmark_count,
        'active_sidebar_nav_id': 'studentlife',
        'seo': {
            'title': f'{entry.campus_entry_title_bn} — ক্যাম্পাস লাইফ | Campus Life',
            'description': entry.campus_entry_short_description_bn or entry.campus_entry_title_bn,
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'ক্যাম্পাস লাইফ', 'url': '/campus-life/'},
                {'name': entry.campus_entry_title_bn, 'url': None},
            ],
        },
    })


@login_required
@ensure_csrf_cookie
def add(request):
    """Add campus entry form page."""
    categories = list(
        RefContentSubcategory.objects.filter(
            group_code='blog_studentlife_category', is_active=True
        ).order_by('sort_order')
    )

    return render(request, 'studentlife/pages/studentlife-add.html', {
        'categories': categories,
        'active_sidebar_nav_id': 'studentlife',
        'seo': {
            'title': 'ক্যাম্পাস এন্ট্রি যোগ করুন — আমলনামা নিউজ',
            'description': 'আপনার ক্যাম্পাসের গল্প, প্রতিভা বা টিপস শেয়ার করুন।',
        },
    })
