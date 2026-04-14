"""Probash Barta views — page views."""

import logging

from django.shortcuts import render, redirect
from django.http import Http404
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import ensure_csrf_cookie

from amolnama_news.site_apps.content.models import RefContentSubcategory
from amolnama_news.site_apps.core.utils import time_ago as _time_ago

from .models import CollProbashEntry

logger = logging.getLogger(__name__)

PAGE_SIZE = 12


def home(request):
    """Probash Barta landing page — browse entries with topic + region filters."""
    topics = list(
        RefContentSubcategory.objects.filter(
            group_code='blog_probashbarta_topic', is_active=True
        ).order_by('sort_order')
    )
    regions = list(
        RefContentSubcategory.objects.filter(
            group_code='blog_probashbarta_region', is_active=True
        ).order_by('sort_order')
    )

    entries = list(
        CollProbashEntry.objects.filter(
            probash_entry_status_code='published', is_active=True
        ).order_by('-is_featured', '-created_at')[:PAGE_SIZE + 1]
    )
    has_next = len(entries) > PAGE_SIZE
    entries = entries[:PAGE_SIZE]

    topic_map = {c.content_ref_content_subcategory_id: c for c in topics}
    for entry in entries:
        topic = topic_map.get(entry.link_content_ref_content_subcategory_id)
        entry.topic_name_bn = topic.subcategory_name_bn if topic else ''
        entry.topic_icon = topic.subcategory_icon if topic else ''
        entry.time_ago = _time_ago(entry.created_at)

    return render(request, 'probashbarta/pages/probashbarta-home.html', {
        'topics': topics,
        'regions': regions,
        'entries': entries,
        'has_next': has_next,
        'active_sidebar_nav_id': 'probashbarta',
        'seo': {
            'title': 'প্রবাস বার্তা — আমলনামা নিউজ | Probash Barta',
            'description': 'প্রবাসী বাংলাদেশিদের গল্প, ভিসা টিপস, চাকরি, জীবনযাত্রা এবং সংগ্রামের অভিজ্ঞতা।',
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'প্রবাস বার্তা', 'url': None},
            ],
        },
    })


def detail_by_slug(request, probash_entry_slug):
    """Probash entry detail page — by slug."""
    entry = CollProbashEntry.objects.filter(
        probash_entry_slug=probash_entry_slug,
        probash_entry_status_code='published',
        is_active=True,
    ).first()
    if not entry:
        raise Http404
    return _render_detail(request, entry)


def detail_by_id(request, probash_entry_id):
    """Probash entry detail — by ID, redirects to slug URL."""
    entry = CollProbashEntry.objects.filter(
        blog_probashbarta_coll_probash_entry_id=probash_entry_id,
        is_active=True,
    ).first()
    if not entry:
        raise Http404
    if entry.probash_entry_slug:
        return redirect('probashbarta:detail', probash_entry_slug=entry.probash_entry_slug, permanent=True)
    return _render_detail(request, entry)


def _render_detail(request, entry):
    """Shared detail page renderer."""
    from amolnama_news.site_apps.core.utils import get_user_profile_id
    from django.db import connection

    entry.time_ago = _time_ago(entry.created_at)

    topic = None
    if entry.link_content_ref_content_subcategory_id:
        topic = RefContentSubcategory.objects.filter(
            content_ref_content_subcategory_id=entry.link_content_ref_content_subcategory_id
        ).first()

    user_profile_id = get_user_profile_id(request)
    can_edit = False
    if user_profile_id:
        can_edit = (entry.link_user_profile_id == user_profile_id) or (
            request.user.is_staff or request.user.is_superuser
        )

    CollProbashEntry.objects.filter(
        blog_probashbarta_coll_probash_entry_id=entry.blog_probashbarta_coll_probash_entry_id
    ).update(view_count=entry.view_count + 1)

    photos = []
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT blog_probashbarta_probash_entry_photo_id, photo_url, photo_thumbnail_url,
                       caption_bn, is_cover, like_count, view_count, link_user_profile_id, created_at
                FROM [blog_probashbarta].[probash_entry_photo]
                WHERE link_blog_probashbarta_coll_probash_entry_id = %s AND is_active = 1
                ORDER BY sort_order
            """, [entry.blog_probashbarta_coll_probash_entry_id])
            for row in cursor.fetchall():
                photos.append({
                    'photo_id': row[0], 'photo_url': row[1], 'thumbnail_url': row[2],
                    'caption_bn': row[3], 'is_cover': row[4], 'like_count': row[5],
                    'view_count': row[6], 'uploader_id': row[7], 'created_at': row[8],
                })
    except Exception:
        logger.exception('Failed to load probash entry photos')

    youtube_links = []
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT blog_probashbarta_probash_entry_youtube_link_id, youtube_url, youtube_video_id,
                       video_title_bn, video_platform, video_thumbnail_url, like_count, view_count
                FROM [blog_probashbarta].[probash_entry_youtube_link]
                WHERE link_blog_probashbarta_coll_probash_entry_id = %s AND is_active = 1
                ORDER BY sort_order
            """, [entry.blog_probashbarta_coll_probash_entry_id])
            for row in cursor.fetchall():
                youtube_links.append({
                    'link_id': row[0], 'url': row[1], 'video_id': row[2],
                    'title_bn': row[3], 'platform': row[4], 'thumbnail_url': row[5],
                    'like_count': row[6], 'view_count': row[7],
                })
    except Exception:
        logger.exception('Failed to load probash entry YouTube links')

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

    return render(request, 'probashbarta/pages/probashbarta-detail.html', {
        'entry': entry,
        'topic': topic,
        'photos': photos,
        'youtube_links': youtube_links,
        'author_display_name': author_display_name,
        'user_liked': False,
        'user_bookmarked': False,
        'can_edit': can_edit,
        'probash_entry_like_count': entry.like_count,
        'probash_entry_view_count': entry.view_count + 1,
        'bookmark_count': entry.bookmark_count,
        'active_sidebar_nav_id': 'probashbarta',
        'seo': {
            'title': f'{entry.probash_entry_title_bn} — প্রবাস বার্তা',
            'description': entry.probash_entry_short_description_bn or entry.probash_entry_title_bn,
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'প্রবাস বার্তা', 'url': '/probash-barta/'},
                {'name': entry.probash_entry_title_bn, 'url': None},
            ],
        },
    })


@login_required
@ensure_csrf_cookie
def add(request):
    """Add probash entry form page."""
    topics = list(
        RefContentSubcategory.objects.filter(
            group_code='blog_probashbarta_topic', is_active=True
        ).order_by('sort_order')
    )
    regions = list(
        RefContentSubcategory.objects.filter(
            group_code='blog_probashbarta_region', is_active=True
        ).order_by('sort_order')
    )

    return render(request, 'probashbarta/pages/probashbarta-add.html', {
        'topics': topics,
        'regions': regions,
        'active_sidebar_nav_id': 'probashbarta',
        'seo': {
            'title': 'প্রবাস বার্তা যোগ করুন — আমলনামা নিউজ',
            'description': 'আপনার প্রবাস জীবনের গল্প, অভিজ্ঞতা বা টিপস শেয়ার করুন।',
        },
    })
