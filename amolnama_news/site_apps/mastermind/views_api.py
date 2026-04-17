"""Mastermind API — internal endpoints for cross-app quiz intelligence."""

import json
import logging

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from amolnama_news.site_apps.core.utils import english_slug_from_text, get_user_profile_id, sanitize_user_html

from .engine import (
    complete_exam_session,
    get_session_review,
    get_user_stats,
    start_exam_session,
    submit_answer,
)
from .models import (
    CollQuiz,
    CollQuizSessionQuestion,
    CollQuestion,
    CollQuestionOption,
    CollQuizSourceRegistry,
    MapQuizQuestionPool,
    MapQuizQuestionSource,
    CollBook,
    CollBookChapter,
)

logger = logging.getLogger(__name__)


# ================================================================
# Book Management
# ================================================================

@login_required
@require_POST
def api_book_create(request):
    """Create a new source book."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    book_title_bn = (data.get('book_title_bn') or '').strip()
    if not book_title_bn:
        return JsonResponse({'error': 'book_title_bn is required.'}, status=400)

    book = CollBook.objects.create(
        book_title_bn=book_title_bn,
        book_title_en=(data.get('book_title_en') or '').strip() or None,
        book_author_bn=(data.get('book_author_bn') or '').strip() or None,
        book_author_en=(data.get('book_author_en') or '').strip() or None,
        book_edition=(data.get('book_edition') or '').strip() or None,
        book_publisher_bn=(data.get('book_publisher_bn') or '').strip() or None,
        book_publisher_en=(data.get('book_publisher_en') or '').strip() or None,
        book_isbn=(data.get('book_isbn') or '').strip() or None,
        book_cover_image_url=(data.get('book_cover_image_url') or '').strip() or None,
        book_description=(data.get('book_description') or '').strip() or None,
        book_language_code=data.get('book_language_code', 'bn'),
        book_total_pages=data.get('book_total_pages'),
        created_at=timezone.now(),
    )

    # Add to transparency ledger
    user_profile_id = get_user_profile_id(request)
    CollQuizSourceRegistry.objects.create(
        link_mastermind_coll_book_id=book.mastermind_coll_book_id,
        ledger_added_by_user_profile_id=user_profile_id,
        ledger_added_at=timezone.now(),
    )

    return JsonResponse({
        'success': True,
        'book_id': book.mastermind_coll_book_id,
        'book_title_bn': book.book_title_bn,
    })


@login_required
@require_POST
def api_book_chapter_create(request, book_id):
    """Add a chapter to an existing book."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    try:
        CollBook.objects.get(mastermind_coll_book_id=book_id, is_active=True)
    except CollBook.DoesNotExist:
        return JsonResponse({'error': 'Book not found.'}, status=404)

    chapter_title_bn = (data.get('chapter_title_bn') or '').strip()
    chapter_number = data.get('chapter_number')
    if not chapter_title_bn or chapter_number is None:
        return JsonResponse(
            {'error': 'chapter_title_bn and chapter_number are required.'},
            status=400,
        )

    # Check duplicate chapter number
    if CollBookChapter.objects.filter(
        link_mastermind_coll_book_id=book_id,
        chapter_number=chapter_number,
    ).exists():
        return JsonResponse(
            {'error': f'Chapter {chapter_number} already exists for this book.'},
            status=400,
        )

    chapter = CollBookChapter.objects.create(
        link_mastermind_coll_book_id=book_id,
        chapter_number=chapter_number,
        chapter_title_bn=chapter_title_bn,
        chapter_title_en=(data.get('chapter_title_en') or '').strip() or None,
        chapter_page_start=data.get('chapter_page_start'),
        chapter_page_end=data.get('chapter_page_end'),
        sort_order=chapter_number,
        created_at=timezone.now(),
    )

    return JsonResponse({
        'success': True,
        'chapter_id': chapter.mastermind_coll_book_chapter_id,
        'chapter_number': chapter.chapter_number,
        'chapter_title_bn': chapter.chapter_title_bn,
    })


# ================================================================
# Question Management
# ================================================================

@login_required
@require_POST
def api_question_create(request):
    """Create a question with answer options."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    question_text_bn = (data.get('question_text_bn') or '').strip()
    if not question_text_bn:
        return JsonResponse({'error': 'question_text_bn is required.'}, status=400)

    topic_id = data.get('topic_id')
    question_type_id = data.get('question_type_id')
    difficulty_id = data.get('difficulty_id')
    if not all([topic_id, question_type_id, difficulty_id]):
        return JsonResponse(
            {'error': 'topic_id, question_type_id, and difficulty_id are required.'},
            status=400,
        )

    user_profile_id = get_user_profile_id(request)

    # Sanitize explanation HTML
    explanation_bn = data.get('question_explanation_bn')
    if explanation_bn:
        explanation_bn = sanitize_user_html(explanation_bn)

    question = CollQuestion.objects.create(
        link_mastermind_ref_quiz_question_type_id=question_type_id,
        link_mastermind_ref_quiz_difficulty_level_id=difficulty_id,
        link_mastermind_coll_quiz_topic_id=topic_id,
        question_group_id=data.get('question_group_id'),
        question_variant_code=data.get('question_variant_code', 'affirmative'),
        question_text_bn=question_text_bn,
        question_text_en=(data.get('question_text_en') or '').strip() or None,
        question_explanation_bn=explanation_bn or None,
        question_explanation_en=(data.get('question_explanation_en') or '').strip() or None,
        question_hint_bn=(data.get('question_hint_bn') or '').strip() or None,
        question_hint_en=(data.get('question_hint_en') or '').strip() or None,
        question_image_url=(data.get('question_image_url') or '').strip() or None,
        question_points=data.get('question_points', 1),
        question_time_limit_seconds=data.get('question_time_limit_seconds'),
        question_negative_marking_points=data.get('question_negative_marking_points', 0),
        link_mastermind_coll_book_id=data.get('book_id'),
        link_mastermind_coll_book_chapter_id=data.get('chapter_id'),
        source_page_number=data.get('source_page_number'),
        source_snippet_text=(data.get('source_snippet_text') or '').strip() or None,
        link_created_by_user_profile_id=user_profile_id,
        question_generation_source_code=data.get('generation_source', 'manual'),
        question_status_code=data.get('status', 'published'),
        created_at=timezone.now(),
    )

    # Create answer options
    options_data = data.get('options', [])
    created_options = []
    for option in options_data:
        option_text_bn = (option.get('option_text_bn') or '').strip()
        if not option_text_bn:
            continue
        created_option = CollQuestionOption.objects.create(
            link_mastermind_coll_question_id=question.mastermind_coll_question_id,
            option_label=option.get('option_label', ''),
            option_text_bn=option_text_bn,
            option_text_en=(option.get('option_text_en') or '').strip() or None,
            option_image_url=(option.get('option_image_url') or '').strip() or None,
            is_correct=option.get('is_correct', False),
            option_explanation_bn=(option.get('option_explanation_bn') or '').strip() or None,
            sort_order=option.get('sort_order', 0),
            created_at=timezone.now(),
        )
        created_options.append(created_option.mastermind_coll_question_option_id)

    # Add to additional sources if provided
    additional_sources = data.get('additional_sources', [])
    for source in additional_sources:
        MapQuizQuestionSource.objects.create(
            link_mastermind_coll_question_id=question.mastermind_coll_question_id,
            link_mastermind_coll_book_id=source.get('book_id'),
            link_mastermind_coll_book_chapter_id=source.get('chapter_id'),
            source_page_number=source.get('page_number'),
            source_note=(source.get('note') or '').strip() or None,
            is_primary_source=source.get('is_primary', False),
            created_at=timezone.now(),
        )

    return JsonResponse({
        'success': True,
        'question_id': question.mastermind_coll_question_id,
        'option_ids': created_options,
    })


# ================================================================
# Exam Management
# ================================================================

@login_required
@require_POST
def api_exam_create(request):
    """Create an exam definition."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    exam_title_bn = (data.get('exam_title_bn') or '').strip()
    if not exam_title_bn:
        return JsonResponse({'error': 'exam_title_bn is required.'}, status=400)

    total_questions = data.get('exam_total_questions')
    if not total_questions or total_questions < 1:
        return JsonResponse({'error': 'exam_total_questions must be >= 1.'}, status=400)

    user_profile_id = get_user_profile_id(request)

    # Generate slug
    exam_slug = english_slug_from_text(text_bn=exam_title_bn)
    # Handle collision
    base_slug = exam_slug
    counter = 1
    while CollQuiz.objects.filter(exam_slug=exam_slug).exists():
        exam_slug = f"{base_slug}-{counter}"
        counter += 1

    exam = CollQuiz.objects.create(
        exam_title_bn=exam_title_bn,
        exam_title_en=(data.get('exam_title_en') or '').strip() or None,
        exam_description_bn=(data.get('exam_description_bn') or '').strip() or None,
        exam_slug=exam_slug,
        link_mastermind_coll_quiz_topic_id=data.get('topic_id'),
        link_mastermind_coll_book_id=data.get('book_id'),
        exam_total_questions=total_questions,
        exam_time_limit_minutes=data.get('time_limit_minutes'),
        exam_pass_percentage=data.get('pass_percentage', 50.00),
        exam_negative_marking_per_wrong=data.get('negative_marking', 0),
        exam_shuffle_questions=data.get('shuffle_questions', True),
        exam_shuffle_options=data.get('shuffle_options', True),
        exam_show_explanation_code=data.get('show_explanation', 'each_question'),
        exam_allow_review=data.get('allow_review', True),
        exam_max_attempts=data.get('max_attempts'),
        exam_status_code=data.get('status', 'published'),
        link_created_by_user_profile_id=user_profile_id,
        created_at=timezone.now(),
    )

    # Add questions to pool if provided
    question_ids = data.get('question_ids', [])
    for question_id in question_ids:
        MapQuizQuestionPool.objects.create(
            link_mastermind_coll_quiz_id=exam.mastermind_coll_quiz_id,
            link_mastermind_coll_question_id=question_id,
            is_mandatory=False,
            created_at=timezone.now(),
        )

    return JsonResponse({
        'success': True,
        'exam_id': exam.mastermind_coll_quiz_id,
        'exam_slug': exam.exam_slug,
    })


# ================================================================
# Exam Session (Quiz Taking)
# ================================================================

@login_required
@require_POST
def api_exam_start(request, exam_id):
    """Start a new exam session — returns randomized questions."""
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    result = start_exam_session(exam_id, user_profile_id)
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_exam_answer(request, exam_id):
    """Submit an answer for a question in an active session."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    session_question_id = data.get('session_question_id')
    if not session_question_id:
        return JsonResponse({'error': 'session_question_id is required.'}, status=400)

    result = submit_answer(
        session_question_id=session_question_id,
        user_profile_id=user_profile_id,
        selected_option_id=data.get('selected_option_id'),
        fill_blank_answer_text=data.get('fill_blank_answer_text'),
        short_answer_text=data.get('short_answer_text'),
        time_spent_seconds=data.get('time_spent_seconds'),
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_exam_submit(request, exam_id):
    """Finalize an exam session — compute score."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    session_id = data.get('session_id')
    if not session_id:
        return JsonResponse({'error': 'session_id is required.'}, status=400)

    result = complete_exam_session(session_id, user_profile_id)
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_GET
def api_exam_review(request, exam_id):
    """Review a completed exam — answers + explanations + source citations."""
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    session_id = request.GET.get('session_id')
    if not session_id:
        return JsonResponse({'error': 'session_id query param is required.'}, status=400)

    result = get_session_review(int(session_id), user_profile_id)
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


# ================================================================
# User Stats
# ================================================================

@login_required
@require_GET
def api_user_stats(request):
    """Get current user's quiz stats — streaks, mastery, badges."""
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    result = get_user_stats(user_profile_id)
    return JsonResponse(result)


# ================================================================
# Question Bookmark (during exam)
# ================================================================

@login_required
@require_POST
def api_question_bookmark_toggle(request):
    """Toggle bookmark flag on a session question (for review during exam)."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    session_question_id = data.get('session_question_id')
    if not session_question_id:
        return JsonResponse({'error': 'session_question_id is required.'}, status=400)

    try:
        session_question = CollQuizSessionQuestion.objects.get(
            mastermind_coll_quiz_session_question_id=session_question_id,
        )
    except CollQuizSessionQuestion.DoesNotExist:
        return JsonResponse({'error': 'Session question not found.'}, status=404)

    session_question.is_bookmarked = not session_question.is_bookmarked
    session_question.save()

    return JsonResponse({
        'success': True,
        'is_bookmarked': session_question.is_bookmarked,
    })


# ================================================================
# Leaderboard
# ================================================================

@login_required
@require_GET
def api_leaderboard(request):
    """Get leaderboard — ranked by accuracy."""
    from .engine_advanced import get_leaderboard, get_user_rank

    topic_id = request.GET.get('topic_id')
    period = request.GET.get('period', 'all_time')
    topic_id = int(topic_id) if topic_id else None

    user_profile_id = get_user_profile_id(request)
    leaderboard = get_leaderboard(topic_id=topic_id, period=period)
    user_rank = get_user_rank(user_profile_id, topic_id=topic_id, period=period)

    return JsonResponse({
        'leaderboard': leaderboard,
        'user_rank': user_rank,
        'period': period,
        'topic_id': topic_id,
    })


# ================================================================
# Retry Wrong Only
# ================================================================

@login_required
@require_POST
def api_retry_wrong(request):
    """Create a quiz from user's wrong answers and start it."""
    from .engine_advanced import create_retry_wrong_exam

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        data = {}

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    topic_id = data.get('topic_id')
    result = create_retry_wrong_exam(
        user_profile_id,
        topic_id=topic_id,
        max_questions=data.get('max_questions', 20),
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


# ================================================================
# Spaced Repetition
# ================================================================

@login_required
@require_GET
def api_due_cards(request):
    """Get SRS cards due for review."""
    from .engine_advanced import get_due_cards

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    topic_id = request.GET.get('topic_id')
    topic_id = int(topic_id) if topic_id else None

    result = get_due_cards(user_profile_id, topic_id=topic_id)
    return JsonResponse(result)


@login_required
@require_POST
def api_review_card(request):
    """Review a spaced repetition card (SM-2 algorithm)."""
    from .engine_advanced import review_card

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    card_id = data.get('card_id')
    quality_rating = data.get('quality_rating')
    if card_id is None or quality_rating is None:
        return JsonResponse({'error': 'card_id and quality_rating are required.'}, status=400)

    result = review_card(user_profile_id, card_id, quality_rating)
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


# ================================================================
# Readiness Gauge
# ================================================================

@login_required
@require_GET
def api_readiness_gauge(request):
    """Get readiness score for a topic (DVSA pattern)."""
    from .engine_advanced import get_readiness_gauge

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    topic_id = request.GET.get('topic_id')
    if not topic_id:
        return JsonResponse({'error': 'topic_id query param is required.'}, status=400)

    result = get_readiness_gauge(user_profile_id, int(topic_id))
    return JsonResponse(result)


# ================================================================
# Streak (with freeze support)
# ================================================================

@login_required
@require_GET
def api_streak_with_freeze(request):
    """Get streak count considering freeze days."""
    from .engine_advanced import get_streak_with_freeze

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    result = get_streak_with_freeze(user_profile_id)
    return JsonResponse(result)


# ================================================================
# Question Analytics
# ================================================================

@login_required
@require_GET
def api_question_analytics(request, question_id):
    """Get distractor analysis for a question."""
    from .engine_advanced import get_question_analytics

    result = get_question_analytics(question_id)
    return JsonResponse(result)


# ================================================================
# Question Report
# ================================================================

@login_required
@require_POST
def api_question_report(request):
    """Report a bad question."""
    from .engine_advanced import report_question

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    question_id = data.get('question_id')
    reason_code = data.get('reason_code')
    if not question_id or not reason_code:
        return JsonResponse({'error': 'question_id and reason_code are required.'}, status=400)

    result = report_question(
        user_profile_id, question_id, reason_code,
        description=data.get('description'),
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


# ================================================================
# Practice Mode
# ================================================================

@login_required
@require_POST
def api_practice_start(request):
    """Start an untimed practice session for a topic."""
    from .engine_advanced import start_practice_session

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    topic_id = data.get('topic_id')
    if not topic_id:
        return JsonResponse({'error': 'topic_id is required.'}, status=400)

    result = start_practice_session(
        topic_id, user_profile_id,
        question_count=data.get('question_count', 10),
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


# ================================================================
# Exam Attempt History
# ================================================================

@login_required
@require_GET
def api_attempt_history(request):
    """Get user's exam attempt history with improvement tracking."""
    from .engine_advanced import get_exam_attempt_history

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    exam_id = request.GET.get('exam_id')
    exam_id = int(exam_id) if exam_id else None

    result = get_exam_attempt_history(user_profile_id, exam_id=exam_id)
    return JsonResponse(result)


# ================================================================
# Bulk Import
# ================================================================

@login_required
@require_POST
def api_bulk_import_questions(request):
    """Bulk import questions from JSON payload."""
    from .engine_advanced import bulk_import_questions

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    # Only staff/admin can bulk import
    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)

    topic_id = data.get('topic_id')
    questions_data = data.get('questions', [])
    if not topic_id or not questions_data:
        return JsonResponse({'error': 'topic_id and questions array are required.'}, status=400)

    result = bulk_import_questions(
        questions_data,
        topic_id=topic_id,
        book_id=data.get('book_id'),
        chapter_id=data.get('chapter_id'),
        user_profile_id=user_profile_id,
    )
    return JsonResponse(result)


# ================================================================
# AI Generation (Phase 2)
# ================================================================

@login_required
@require_POST
def api_ingest_book_pdf(request, book_id):
    """Ingest a book PDF — extract text, create chunks."""
    from .ai_generator import ingest_book_from_pdf

    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)

    # File must be uploaded or path provided
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        data = {}

    file_path = data.get('file_path')
    if not file_path:
        return JsonResponse({'error': 'file_path is required.'}, status=400)

    result = ingest_book_from_pdf(book_id, file_path)
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_generate_questions(request, book_id):
    """Generate questions from book chunks using AI."""
    from .ai_generator import start_generation_job

    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    user_profile_id = get_user_profile_id(request)

    topic_id = data.get('topic_id')
    if not topic_id:
        return JsonResponse({'error': 'topic_id is required.'}, status=400)

    result = start_generation_job(
        book_id=book_id,
        topic_id=topic_id,
        chapter_id=data.get('chapter_id'),
        questions_per_chunk=data.get('questions_per_chunk', 3),
        prompt_template_code=data.get('prompt_template', 'mixed'),
        model_name=data.get('model_name'),
        user_profile_id=user_profile_id,
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_GET
def api_review_queue(request):
    """Get AI-generated questions pending review."""
    from .ai_generator import get_review_queue

    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)

    topic_id = request.GET.get('topic_id')
    topic_id = int(topic_id) if topic_id else None

    result = get_review_queue(topic_id=topic_id)
    return JsonResponse(result)


@login_required
@require_POST
def api_review_question_action(request):
    """Approve or reject a reviewed question."""
    from .ai_generator import approve_question, bulk_approve_questions, reject_question

    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    user_profile_id = get_user_profile_id(request)
    action = data.get('action')

    if action == 'approve':
        question_id = data.get('question_id')
        if not question_id:
            return JsonResponse({'error': 'question_id is required.'}, status=400)
        result = approve_question(question_id, user_profile_id)
    elif action == 'reject':
        question_id = data.get('question_id')
        if not question_id:
            return JsonResponse({'error': 'question_id is required.'}, status=400)
        result = reject_question(question_id, user_profile_id)
    elif action == 'bulk_approve':
        question_ids = data.get('question_ids', [])
        if not question_ids:
            return JsonResponse({'error': 'question_ids array is required.'}, status=400)
        result = bulk_approve_questions(question_ids)
    else:
        return JsonResponse({'error': 'action must be approve, reject, or bulk_approve.'}, status=400)

    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


# ================================================================
# Proctoring (Phase 1: lockdown event logging)
# ================================================================

@login_required
@require_POST
def api_proctoring_log_violation(request):
    """Log a single proctoring violation from a quiz session.

    Expected JSON body:
        {
            "session_id": 123,
            "quiz_id": 45,
            "violation_type_code": "tab_switch",
            "violation_details": "switched to mail tab",     // optional
            "violation_confidence_score": 0.92,               // optional (AI events only)
            "violation_client_reported_at": "2026-04-17T15:30:00"  // optional
        }
    Returns the new running score, status, and whether the threshold was just crossed.
    """
    import json as _json
    from .proctoring import log_violation

    try:
        payload = _json.loads(request.body or b'{}')
    except _json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON body.'}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({'error': 'JSON root must be an object.'}, status=400)

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=400)

    session_id = payload.get('session_id')
    quiz_id = payload.get('quiz_id')
    if not (isinstance(session_id, int) and isinstance(quiz_id, int)):
        return JsonResponse({'error': 'session_id and quiz_id must be integers.'}, status=400)

    # Verify the session belongs to the calling user (prevent IDOR)
    from .models import CollQuizSession
    session_owner = (
        CollQuizSession.objects
        .filter(mastermind_coll_quiz_session_id=session_id)
        .values_list('link_user_profile_id', flat=True)
        .first()
    )
    if session_owner != user_profile_id:
        return JsonResponse({'error': 'Session does not belong to user.'}, status=403)

    result = log_violation(
        session_id=session_id,
        user_profile_id=user_profile_id,
        quiz_id=quiz_id,
        violation_type_code=(payload.get('violation_type_code') or '').strip().lower(),
        details=payload.get('violation_details'),
        confidence_score=payload.get('violation_confidence_score'),
        client_reported_at=payload.get('violation_client_reported_at'),
    )
    if not result.get('success'):
        return JsonResponse({'error': result.get('error', 'Server error.')}, status=400)
    return JsonResponse(result)
