"""History BD views — page views."""

import logging

from django.shortcuts import render, redirect
from django.http import Http404
from django.contrib.auth.decorators import login_required
from django.db import connection
from django.views.decorators.csrf import ensure_csrf_cookie

from amolnama_news.site_apps.content.models import RefContentSubcategory
from amolnama_news.site_apps.core.utils import time_ago as _time_ago

from .models import CollHistoryEvent

logger = logging.getLogger(__name__)

PAGE_SIZE = 12


def home(request):
    """History BD landing page — browse events by era."""
    eras = list(
        RefContentSubcategory.objects.filter(
            group_code='blog_historybd_era', is_active=True
        ).order_by('sort_order')
    )

    entries = list(
        CollHistoryEvent.objects.filter(
            history_event_status_code='published', is_active=True
        ).order_by('-is_featured', '-event_year', '-created_at')[:PAGE_SIZE + 1]
    )
    has_next = len(entries) > PAGE_SIZE
    entries = entries[:PAGE_SIZE]

    era_map = {c.content_ref_content_subcategory_id: c for c in eras}
    for entry in entries:
        era = era_map.get(entry.link_content_ref_content_subcategory_id)
        entry.era_name_bn = era.subcategory_name_bn if era else ''
        entry.era_icon = era.subcategory_icon if era else ''
        entry.time_ago = _time_ago(entry.created_at)

    return render(request, 'historybd/pages/historybd-home.html', {
        'eras': eras,
        'entries': entries,
        'has_next': has_next,
        'active_sidebar_nav_id': 'historybd',
        'seo': {
            'title': 'ইতিহাস — আমলনামা নিউজ | History of Bangladesh',
            'description': 'বাংলাদেশের ইতিহাস, ঐতিহাসিক ঘটনা, মুক্তিযুদ্ধ এবং সভ্যতার ধারা।',
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'ইতিহাস', 'url': None},
            ],
        },
    })


def detail_by_slug(request, history_event_slug):
    """History event detail — by slug."""
    entry = CollHistoryEvent.objects.filter(
        history_event_slug=history_event_slug,
        history_event_status_code='published',
        is_active=True,
    ).first()
    if not entry:
        raise Http404
    return _render_detail(request, entry)


def detail_by_id(request, history_event_id):
    """History event detail — by ID, redirects to slug."""
    entry = CollHistoryEvent.objects.filter(
        blog_historybd_coll_history_event_id=history_event_id,
        is_active=True,
    ).first()
    if not entry:
        raise Http404
    if entry.history_event_slug:
        return redirect('historybd:detail', history_event_slug=entry.history_event_slug, permanent=True)
    return _render_detail(request, entry)


def _render_detail(request, entry):
    """Shared detail renderer with photos, YouTube, documents, perspectives."""
    from amolnama_news.site_apps.core.utils import get_user_profile_id

    entry.time_ago = _time_ago(entry.created_at)

    era = None
    if entry.link_content_ref_content_subcategory_id:
        era = RefContentSubcategory.objects.filter(
            content_ref_content_subcategory_id=entry.link_content_ref_content_subcategory_id
        ).first()

    user_profile_id = get_user_profile_id(request)
    can_edit = False
    if user_profile_id:
        can_edit = (entry.link_user_profile_id == user_profile_id) or (
            request.user.is_staff or request.user.is_superuser
        )

    CollHistoryEvent.objects.filter(
        blog_historybd_coll_history_event_id=entry.blog_historybd_coll_history_event_id
    ).update(view_count=entry.view_count + 1)

    entry_id = entry.blog_historybd_coll_history_event_id

    # Photos
    photos = []
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT blog_historybd_history_event_photo_id, photo_url, photo_thumbnail_url,
                       caption_bn, photo_era_label_bn, is_cover, like_count, view_count
                FROM [blog_historybd].[history_event_photo]
                WHERE link_blog_historybd_coll_history_event_id = %s AND is_active = 1
                ORDER BY sort_order
            """, [entry_id])
            for row in cursor.fetchall():
                photos.append({
                    'photo_id': row[0], 'photo_url': row[1], 'thumbnail_url': row[2],
                    'caption_bn': row[3], 'era_label_bn': row[4], 'is_cover': row[5],
                    'like_count': row[6], 'view_count': row[7],
                })
    except Exception:
        logger.exception('Failed to load history event photos')

    # YouTube links
    youtube_links = []
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT blog_historybd_history_event_youtube_link_id, youtube_url, youtube_video_id,
                       video_title_bn, video_platform, video_thumbnail_url, like_count, view_count
                FROM [blog_historybd].[history_event_youtube_link]
                WHERE link_blog_historybd_coll_history_event_id = %s AND is_active = 1
                ORDER BY sort_order
            """, [entry_id])
            for row in cursor.fetchall():
                youtube_links.append({
                    'link_id': row[0], 'url': row[1], 'video_id': row[2],
                    'title_bn': row[3], 'platform': row[4], 'thumbnail_url': row[5],
                    'like_count': row[6], 'view_count': row[7],
                })
    except Exception:
        logger.exception('Failed to load history event YouTube links')

    # Documents
    documents = []
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT blog_historybd_history_event_document_id, document_url,
                       document_title_bn, document_description_bn, document_type_code
                FROM [blog_historybd].[history_event_document]
                WHERE link_blog_historybd_coll_history_event_id = %s AND is_active = 1
                ORDER BY sort_order
            """, [entry_id])
            for row in cursor.fetchall():
                documents.append({
                    'document_id': row[0], 'url': row[1], 'title_bn': row[2],
                    'description_bn': row[3], 'type_code': row[4],
                })
    except Exception:
        logger.exception('Failed to load history event documents')

    # Perspectives
    perspectives = []
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT blog_historybd_history_event_perspective_id, perspective_title_bn,
                       perspective_content_bn, perspective_source_bn
                FROM [blog_historybd].[history_event_perspective]
                WHERE link_blog_historybd_coll_history_event_id = %s AND is_active = 1
                ORDER BY sort_order
            """, [entry_id])
            for row in cursor.fetchall():
                perspectives.append({
                    'perspective_id': row[0], 'title_bn': row[1],
                    'content_bn': row[2], 'source_bn': row[3],
                })
    except Exception:
        logger.exception('Failed to load history event perspectives')

    # Author
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

    return render(request, 'historybd/pages/historybd-detail.html', {
        'entry': entry,
        'era': era,
        'photos': photos,
        'youtube_links': youtube_links,
        'documents': documents,
        'perspectives': perspectives,
        'author_display_name': author_display_name,
        'can_edit': can_edit,
        'history_event_like_count': entry.like_count,
        'history_event_view_count': entry.view_count + 1,
        'bookmark_count': entry.bookmark_count,
        'active_sidebar_nav_id': 'historybd',
        'seo': {
            'title': f'{entry.history_event_title_bn} — ইতিহাস',
            'description': entry.history_event_short_description_bn or entry.history_event_title_bn,
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'ইতিহাস', 'url': '/itihas/'},
                {'name': entry.history_event_title_bn, 'url': None},
            ],
        },
    })


def quiz_list(request):
    """List all published mastermind quizzes filed under topic 'bd_history'.

    Mastermind owns the quiz engine; historybd is just a presentation surface.
    Adding a new history quiz = create one in the Quiz Panel with topic=Bangladesh History.
    No code change needed in this app.
    """
    from amolnama_news.site_apps.mastermind.models import CollQuiz, CollQuizTopic

    topic = CollQuizTopic.objects.filter(topic_code='bd_history', is_active=True).first()
    quizzes = []
    if topic is not None:
        quizzes = list(
            CollQuiz.objects.filter(
                link_mastermind_coll_quiz_topic_id=topic.mastermind_coll_quiz_topic_id,
                exam_status_code='published',
                is_active=True,
            ).order_by('-created_at').values(
                'mastermind_coll_quiz_id',
                'exam_title_bn', 'exam_title_en',
                'exam_description_bn',
                'exam_total_questions',
                'exam_time_limit_minutes',
                'exam_pass_percentage',
                'exam_proctoring_level',
            )
        )

    return render(request, 'historybd/pages/historybd-quiz-list.html', {
        'topic': topic,
        'quizzes': quizzes,
        'active_sidebar_nav_id': 'historybd',
        'seo': {
            'title': 'ইতিহাস কুইজ — আমলনামা নিউজ | Bangladesh History Quiz',
            'description': 'বাংলাদেশের ইতিহাস নিয়ে কুইজ — মুক্তিযুদ্ধ, ভাষা আন্দোলন, রাজনীতি, সভ্যতা।',
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'ইতিহাস', 'url': '/itihas/'},
                {'name': 'কুইজ', 'url': None},
            ],
        },
    })


@login_required
@ensure_csrf_cookie
def quiz_take(request, quiz_id):
    """Render the mastermind take partial for a single bd_history quiz.

    Quiz must (a) exist, (b) be published, (c) be filed under topic 'bd_history' —
    we don't let an unrelated quiz get rendered through this URL.
    """
    from amolnama_news.site_apps.mastermind.models import CollQuiz, CollQuizTopic

    quiz = CollQuiz.objects.filter(
        mastermind_coll_quiz_id=quiz_id,
        exam_status_code='published',
        is_active=True,
    ).first()
    if not quiz:
        raise Http404

    topic = CollQuizTopic.objects.filter(topic_code='bd_history', is_active=True).first()
    if not topic or quiz.link_mastermind_coll_quiz_topic_id != topic.mastermind_coll_quiz_topic_id:
        raise Http404

    return render(request, 'historybd/pages/historybd-quiz-take.html', {
        'quiz': quiz,
        'active_sidebar_nav_id': 'historybd',
        'seo': {
            'title': f'{quiz.exam_title_bn} — ইতিহাস কুইজ',
            'description': quiz.exam_description_bn or quiz.exam_title_bn,
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'ইতিহাস', 'url': '/itihas/'},
                {'name': 'কুইজ', 'url': '/itihas/quiz/'},
                {'name': quiz.exam_title_bn, 'url': None},
            ],
        },
    })


@login_required
@ensure_csrf_cookie
def add(request):
    """Add history event form page."""
    eras = list(
        RefContentSubcategory.objects.filter(
            group_code='blog_historybd_era', is_active=True
        ).order_by('sort_order')
    )

    return render(request, 'historybd/pages/historybd-add.html', {
        'eras': eras,
        'active_sidebar_nav_id': 'historybd',
        'seo': {
            'title': 'ঐতিহাসিক ঘটনা যোগ করুন — আমলনামা নিউজ',
            'description': 'বাংলাদেশের ইতিহাসের একটি গুরুত্বপূর্ণ ঘটনা নথিবদ্ধ করুন।',
        },
    })
