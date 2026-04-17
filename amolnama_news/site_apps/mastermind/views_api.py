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
        matching_pairs=data.get('matching_pairs'),
        ordering_option_ids=data.get('ordering_option_ids'),
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


# ================================================================
# Quiz lifecycle — clone, archive, delete
# ================================================================

def _get_quiz_or_403(request, quiz_id):
    """Return (quiz, error_response). If error_response is not None, return it directly."""
    from .quiz_builder import can_user_manage_quiz
    quiz = CollQuiz.objects.filter(mastermind_coll_quiz_id=quiz_id, is_active=True).first()
    if not quiz:
        return None, JsonResponse({'error': 'Quiz not found.'}, status=404)
    if not can_user_manage_quiz(quiz, request.user):
        return None, JsonResponse({'error': 'Permission denied.'}, status=403)
    return quiz, None


@login_required
@require_POST
def api_quiz_clone(request, quiz_id):
    """Duplicate a quiz + every question + every option. Returns new quiz_id."""
    from .quiz_builder import clone_quiz
    quiz, error_response = _get_quiz_or_403(request, quiz_id)
    if error_response is not None:
        return error_response
    user_profile_id = get_user_profile_id(request)
    result = clone_quiz(quiz_id, user_profile_id)
    if not result.get('success'):
        return JsonResponse({'error': result.get('error', 'Server error.')}, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_quiz_archive(request, quiz_id):
    """Soft-archive (status=archived) — quiz hidden from default lists, restorable."""
    from .quiz_builder import archive_quiz
    quiz, error_response = _get_quiz_or_403(request, quiz_id)
    if error_response is not None:
        return error_response
    user_profile_id = get_user_profile_id(request)
    result = archive_quiz(quiz_id, user_profile_id, unarchive=False)
    if not result.get('success'):
        return JsonResponse({'error': result.get('error', 'Server error.')}, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_quiz_unarchive(request, quiz_id):
    """Restore an archived quiz back to draft."""
    from .quiz_builder import archive_quiz
    quiz, error_response = _get_quiz_or_403(request, quiz_id)
    if error_response is not None:
        return error_response
    user_profile_id = get_user_profile_id(request)
    result = archive_quiz(quiz_id, user_profile_id, unarchive=True)
    if not result.get('success'):
        return JsonResponse({'error': result.get('error', 'Server error.')}, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_quiz_delete(request, quiz_id):
    """Soft-delete (is_active=False) + drop pool links. Questions remain reusable."""
    from .quiz_builder import delete_quiz
    quiz, error_response = _get_quiz_or_403(request, quiz_id)
    if error_response is not None:
        return error_response
    user_profile_id = get_user_profile_id(request)
    result = delete_quiz(quiz_id, user_profile_id)
    if not result.get('success'):
        return JsonResponse({'error': result.get('error', 'Server error.')}, status=400)
    return JsonResponse(result)


# ================================================================
# Bulk export — questions + quizzes (CSV + JSON)
# ================================================================

@login_required
@require_GET
def api_export_questions(request):
    """Export questions as JSON or CSV.

    Query params:
      format=json (default) | csv
      topic_id=<int>     optional
      book_id=<int>      optional
      question_ids=<csv> optional (comma-separated IDs)
    """
    from django.http import HttpResponse
    from .exporters import export_questions_to_dicts, export_questions_to_csv_bytes

    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)

    export_format = (request.GET.get('format') or 'json').lower()
    topic_id_raw = request.GET.get('topic_id')
    book_id_raw = request.GET.get('book_id')
    question_ids_raw = request.GET.get('question_ids')

    topic_id = int(topic_id_raw) if topic_id_raw and topic_id_raw.isdigit() else None
    book_id = int(book_id_raw) if book_id_raw and book_id_raw.isdigit() else None
    question_id_list = None
    if question_ids_raw:
        question_id_list = [int(part) for part in question_ids_raw.split(',') if part.strip().isdigit()]

    timestamp_suffix = timezone.now().strftime('%Y%m%d-%H%M%S')

    if export_format == 'csv':
        body_bytes = export_questions_to_csv_bytes(
            question_id_list=question_id_list, topic_id=topic_id, book_id=book_id,
        )
        response = HttpResponse(body_bytes, content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="mastermind-questions-{timestamp_suffix}.csv"'
        return response

    rows = export_questions_to_dicts(
        question_id_list=question_id_list, topic_id=topic_id, book_id=book_id,
    )
    response = JsonResponse({
        'success': True,
        'export_format_version': '1.0',
        'exported_at': timezone.now().isoformat(),
        'question_count': len(rows),
        'questions': rows,
    })
    response['Content-Disposition'] = f'attachment; filename="mastermind-questions-{timestamp_suffix}.json"'
    return response


# ================================================================
# Per-quiz comments / discussion
# ================================================================

@login_required
@require_GET
def api_quiz_comments_list(request, quiz_id):
    """List all active comments for a quiz, tree-shaped."""
    from .comments import list_comments
    user_profile_id = get_user_profile_id(request)
    return JsonResponse({
        'comments': list_comments(quiz_id, viewer_user_profile_id=user_profile_id),
    })


@login_required
@require_POST
def api_quiz_comment_create(request, quiz_id):
    """Create a comment (or reply if parent_comment_id is given)."""
    from .comments import create_comment
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)
    result = create_comment(
        quiz_id=quiz_id,
        user_profile_id=user_profile_id,
        text_html=payload.get('comment_text_html') or '',
        parent_comment_id=payload.get('parent_comment_id'),
    )
    if not result.get('success'):
        return JsonResponse({'error': result.get('error', 'Server error.')}, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_quiz_comment_delete(request, comment_id):
    """Soft-delete a comment (owner OR staff)."""
    from .comments import delete_comment
    user_profile_id = get_user_profile_id(request)
    is_staff = bool(request.user.is_staff or request.user.is_superuser)
    result = delete_comment(comment_id, user_profile_id, is_staff=is_staff)
    if not result.get('success'):
        status = 403 if 'denied' in result.get('error', '').lower() else 404
        return JsonResponse({'error': result.get('error', 'Server error.')}, status=status)
    return JsonResponse(result)


@login_required
@require_POST
def api_quiz_comment_pin(request, comment_id):
    """Staff-only pin/unpin (?unpin=true to unpin)."""
    from .comments import pin_comment
    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)
    user_profile_id = get_user_profile_id(request)
    unpin = request.GET.get('unpin') == 'true'
    result = pin_comment(comment_id, user_profile_id, unpin=unpin)
    if not result.get('success'):
        return JsonResponse({'error': result.get('error', 'Server error.')}, status=404)
    return JsonResponse(result)


@login_required
@require_POST
def api_quiz_comment_reaction_toggle(request, comment_id):
    """Toggle the caller's like on a comment."""
    from .comments import toggle_reaction
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)
    result = toggle_reaction(comment_id, user_profile_id, reaction_type='like')
    if not result.get('success'):
        return JsonResponse({'error': result.get('error', 'Server error.')}, status=400)
    return JsonResponse(result)


@login_required
@require_GET
def api_analytics_quiz_score_distribution(request, quiz_id):
    """Histogram of completed-session score percentages for one quiz."""
    from .analytics import per_quiz_score_distribution
    quiz, error_response = _get_quiz_or_403(request, quiz_id)
    if error_response is not None:
        return error_response
    return JsonResponse(per_quiz_score_distribution(quiz_id))


@login_required
@require_GET
def api_analytics_quiz_pass_rate(request, quiz_id):
    """Daily passed/failed/in-progress counts for one quiz over last N days (?days=)."""
    from .analytics import per_quiz_pass_rate_over_time
    quiz, error_response = _get_quiz_or_403(request, quiz_id)
    if error_response is not None:
        return error_response
    days_raw = request.GET.get('days') or '30'
    days = int(days_raw) if days_raw.isdigit() else 30
    return JsonResponse(per_quiz_pass_rate_over_time(quiz_id, days=days))


@login_required
@require_GET
def api_analytics_quiz_question_difficulty(request, quiz_id):
    """Per-question correct-answer rate for one quiz."""
    from .analytics import per_quiz_question_difficulty
    quiz, error_response = _get_quiz_or_403(request, quiz_id)
    if error_response is not None:
        return error_response
    return JsonResponse(per_quiz_question_difficulty(quiz_id))


@login_required
@require_GET
def api_analytics_topic_engagement(request):
    """Sessions started per topic over last N days (?days=). Staff only."""
    from .analytics import topic_engagement_overview
    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)
    days_raw = request.GET.get('days') or '30'
    days = int(days_raw) if days_raw.isdigit() else 30
    return JsonResponse(topic_engagement_overview(days=days))


@login_required
@require_GET
def api_analytics_user_performance(request):
    """All-time per-topic stats for the calling user."""
    from .analytics import per_user_performance_summary
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)
    return JsonResponse(per_user_performance_summary(user_profile_id))


@login_required
@require_GET
def api_webhook_subscription_list(request):
    """List active webhook subscriptions (staff only)."""
    from .models import CollWebhookSubscription
    from .webhooks import list_supported_event_codes
    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)
    subscriptions = list(
        CollWebhookSubscription.objects
        .filter(is_active=True)
        .order_by('-created_at')
        .values(
            'mastermind_coll_webhook_subscription_id',
            'webhook_event_code', 'webhook_target_url', 'webhook_label',
            'last_dispatch_at', 'last_dispatch_status_code',
            'last_dispatch_response_code', 'last_dispatch_error_message',
            'dispatch_success_count', 'dispatch_failure_count', 'created_at',
        )
    )
    return JsonResponse({
        'subscriptions': subscriptions,
        'supported_event_codes': list_supported_event_codes(),
    })


@login_required
@require_POST
def api_webhook_subscription_create(request):
    """Register a new webhook subscription (staff only)."""
    from .models import CollWebhookSubscription
    from .webhooks import SUPPORTED_EVENT_CODES
    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)
    event_code = (payload.get('webhook_event_code') or '').strip()
    target_url = (payload.get('webhook_target_url') or '').strip()
    label = (payload.get('webhook_label') or '').strip() or None
    secret = (payload.get('webhook_secret') or '').strip() or None

    if event_code not in SUPPORTED_EVENT_CODES:
        return JsonResponse({'error': f'Unsupported event_code. Allowed: {list(SUPPORTED_EVENT_CODES)}'}, status=400)
    if not target_url.startswith(('http://', 'https://')):
        return JsonResponse({'error': 'webhook_target_url must start with http:// or https://'}, status=400)

    granted_by = get_user_profile_id(request)
    subscription = CollWebhookSubscription.objects.create(
        webhook_event_code=event_code,
        webhook_target_url=target_url,
        webhook_secret=secret,
        webhook_label=label,
        link_created_by_user_profile_id=granted_by,
    )
    return JsonResponse({
        'success': True,
        'subscription_id': subscription.mastermind_coll_webhook_subscription_id,
    })


@login_required
@require_POST
def api_webhook_subscription_delete(request, subscription_id):
    """Soft-delete (is_active=False) a webhook subscription."""
    from .models import CollWebhookSubscription
    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)
    updated = CollWebhookSubscription.objects.filter(
        mastermind_coll_webhook_subscription_id=subscription_id, is_active=True,
    ).update(is_active=False, updated_at=timezone.now())
    if not updated:
        return JsonResponse({'error': 'Subscription not found.'}, status=404)
    return JsonResponse({'success': True})


@login_required
@require_POST
def api_grant_session_accommodation(request, session_id):
    """Apply extra-time / no-time-limit accommodation to a single quiz session."""
    from .engine import grant_session_accommodation

    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)

    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    granted_by = get_user_profile_id(request)
    extra_minutes_raw = payload.get('extra_time_minutes')
    extra_minutes = int(extra_minutes_raw) if extra_minutes_raw not in (None, '') else None
    no_time_limit = bool(payload.get('no_time_limit', False))
    notes = (payload.get('notes') or '').strip() or None

    result = grant_session_accommodation(
        session_id=session_id,
        granted_by_user_profile_id=granted_by,
        extra_time_minutes=extra_minutes,
        no_time_limit=no_time_limit,
        notes=notes,
    )
    if not result.get('success'):
        return JsonResponse({'error': result.get('error', 'Server error.')}, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_upload_question_image(request):
    """Accept a multipart image, store it, return its public URL.

    Multipart fields:
      file:  the image (required)
      scope: 'question' (default) or 'option'
    """
    from .image_uploads import upload_question_image

    uploaded_file = request.FILES.get('file')
    scope = (request.POST.get('scope') or 'question').strip().lower()
    result = upload_question_image(uploaded_file, scope=scope)
    if not result.get('success'):
        return JsonResponse({'error': result.get('error', 'Upload failed.')}, status=400)
    return JsonResponse(result)


@login_required
@require_GET
def api_session_certificate(request, session_id):
    """Look up the certificate for a completed session owned by the caller.

    Returns {certificate_serial, verify_url, issued_at} when present, or
    {certificate_serial: null} when no cert exists. Used by the take page to
    surface a download link on the results screen.
    """
    from .models import CollCertificate, CollQuizSession

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    session_owner = (
        CollQuizSession.objects
        .filter(mastermind_coll_quiz_session_id=session_id)
        .values_list('link_user_profile_id', flat=True)
        .first()
    )
    if session_owner is None:
        return JsonResponse({'error': 'Session not found.'}, status=404)
    if session_owner != user_profile_id:
        return JsonResponse({'error': 'Session does not belong to user.'}, status=403)

    certificate = (
        CollCertificate.objects
        .filter(link_mastermind_coll_quiz_session_id=session_id, is_active=True)
        .first()
    )
    if not certificate:
        return JsonResponse({'certificate_serial': None})

    verify_url = request.build_absolute_uri(
        f'/mastermind/certificate/{certificate.certificate_serial}/'
    )
    return JsonResponse({
        'certificate_serial': certificate.certificate_serial,
        'verify_url': verify_url,
        'issued_at': certificate.certificate_issued_at.isoformat() if certificate.certificate_issued_at else None,
    })


@login_required
@require_GET
def api_session_resume_check(request, exam_id):
    """Return the user's open in-progress session for this quiz, if any.

    Lets the take page offer "Resume" instead of starting fresh. Returns
    {in_progress_session_id} or {in_progress_session_id: null}.
    """
    from .models import CollQuizSession

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    open_session_id = (
        CollQuizSession.objects
        .filter(
            link_mastermind_coll_quiz_id=exam_id,
            link_user_profile_id=user_profile_id,
            session_status_code='in_progress',
        )
        .order_by('-session_started_at')
        .values_list('mastermind_coll_quiz_session_id', flat=True)
        .first()
    )
    return JsonResponse({'in_progress_session_id': open_session_id})


@login_required
@require_POST
def api_session_resume(request, session_id):
    """Rebuild the start-session payload for an existing in-progress session.

    Used to resume a partially-completed quiz. Skips already-answered
    questions on the client side via the included answered_at hints.
    """
    from .engine import _build_session_response, _get_question_type_code  # noqa
    from .models import CollQuiz, CollQuizSession, CollQuizSessionQuestion

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    try:
        session = CollQuizSession.objects.get(
            mastermind_coll_quiz_session_id=session_id,
            link_user_profile_id=user_profile_id,
            session_status_code='in_progress',
        )
    except CollQuizSession.DoesNotExist:
        return JsonResponse({'error': 'Session not found or not in progress.'}, status=404)

    try:
        exam = CollQuiz.objects.get(mastermind_coll_quiz_id=session.link_mastermind_coll_quiz_id)
    except CollQuiz.DoesNotExist:
        return JsonResponse({'error': 'Exam not found.'}, status=404)

    session_questions = list(
        CollQuizSessionQuestion.objects
        .filter(link_mastermind_coll_quiz_session_id=session_id)
        .order_by('question_display_order')
    )
    response = _build_session_response(session, exam, session_questions)

    # Mark which questions are already answered so the client skips them
    answered_session_question_ids = {
        sq.mastermind_coll_quiz_session_question_id: sq.answered_at
        for sq in session_questions if sq.answered_at is not None
    }
    for question_payload in response.get('questions', []):
        sq_id = question_payload['session_question_id']
        question_payload['already_answered'] = sq_id in answered_session_question_ids

    response['resumed'] = True
    return JsonResponse(response)


@login_required
@require_GET
def api_question_report_list(request):
    """Staff inbox: list reports filed against questions (?status=pending|resolved|invalid|all)."""
    from .engine_advanced import list_question_reports

    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)

    status_code = (request.GET.get('status') or 'pending').strip().lower()
    if status_code not in ('pending', 'resolved', 'invalid', 'all'):
        return JsonResponse({'error': 'status must be pending, resolved, invalid, or all.'}, status=400)
    rows = list_question_reports(status_code=status_code)
    return JsonResponse({'reports': rows, 'status': status_code})


@login_required
@require_POST
def api_question_report_review(request, report_id):
    """Staff resolves or rejects a single question report.

    Body: {"action": "resolve"|"reject"}
    """
    from .engine_advanced import review_question_report

    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    action_code = (payload.get('action') or '').strip().lower()
    reviewer_user_profile_id = get_user_profile_id(request)
    result = review_question_report(report_id, reviewer_user_profile_id, action_code)
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_book_create_from_paste(request):
    """Create a CollBook + first chapter + chunks from pasted plain text.

    Body: {title_bn, title_en?, description?, language_code?, paste_text,
           chapter_title_bn?, chapter_title_en?}
    """
    from .book_editor import create_book_from_paste
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)
    result = create_book_from_paste(
        title_bn=(payload.get('title_bn') or '').strip(),
        owner_user_profile_id=user_profile_id,
        paste_text=payload.get('paste_text') or '',
        title_en=payload.get('title_en'),
        language_code=payload.get('language_code') or 'bn',
        description=payload.get('description'),
        cover_image_url=payload.get('cover_image_url'),
        chapter_title_bn=(payload.get('chapter_title_bn') or '').strip() or 'অধ্যায় ১',
        chapter_title_en=(payload.get('chapter_title_en') or '').strip() or 'Chapter 1',
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_book_create_blank_authored(request):
    """Create an empty user-authored book (write-from-scratch flow).

    Body: {title_bn, title_en?, description?, language_code?}
    """
    from .book_editor import create_blank_authored_book
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)
    result = create_blank_authored_book(
        title_bn=(payload.get('title_bn') or '').strip(),
        owner_user_profile_id=user_profile_id,
        title_en=payload.get('title_en'),
        language_code=payload.get('language_code') or 'bn',
        description=payload.get('description'),
        cover_image_url=payload.get('cover_image_url'),
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_book_chapter_add(request, book_id):
    """Append a new (empty) chapter at the end of a book."""
    from .book_editor import add_chapter_to_book
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)
    is_staff_user = bool(request.user.is_staff or request.user.is_superuser)
    result = add_chapter_to_book(
        book_id=book_id,
        owner_user_profile_id=user_profile_id,
        chapter_title_bn=payload.get('chapter_title_bn'),
        chapter_title_en=payload.get('chapter_title_en'),
        is_staff_user=is_staff_user,
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_book_chapter_save_text(request, book_id, chapter_id):
    """Replace a chapter's text — chunks are rebuilt from the supplied plain_text.

    Body: {plain_text, chapter_title_bn?, chapter_title_en?, chapter_number?}
    """
    from .book_editor import (
        replace_chapter_chunks, update_chapter_metadata,
        _user_can_edit_book,
    )
    from .models import CollBook, CollBookChapter
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)
    is_staff_user = bool(request.user.is_staff or request.user.is_superuser)

    chapter = CollBookChapter.objects.filter(
        mastermind_coll_book_chapter_id=chapter_id,
        link_mastermind_coll_book_id=book_id,
        is_active=True,
    ).first()
    if not chapter:
        return JsonResponse({'error': 'Chapter not found.'}, status=404)
    book = CollBook.objects.filter(mastermind_coll_book_id=book_id).first()
    if not book or not _user_can_edit_book(book, user_profile_id, is_staff_user):
        return JsonResponse({'error': 'Permission denied.'}, status=403)

    metadata_result = update_chapter_metadata(
        chapter_id=chapter_id,
        owner_user_profile_id=user_profile_id,
        is_staff_user=is_staff_user,
        chapter_title_bn=payload.get('chapter_title_bn'),
        chapter_title_en=payload.get('chapter_title_en'),
        chapter_number=payload.get('chapter_number')
            if isinstance(payload.get('chapter_number'), int) else None,
    )
    if 'error' in metadata_result:
        return JsonResponse(metadata_result, status=400)

    plain_text = payload.get('plain_text') or ''
    chunk_result = replace_chapter_chunks(chapter_id, plain_text)
    if 'error' in chunk_result:
        return JsonResponse(chunk_result, status=400)
    return JsonResponse({
        'success': True,
        'chapter_id': chapter_id,
        'chunk_count': chunk_result.get('chunk_count', 0),
    })


@login_required
@require_GET
def api_book_chapter_get_text(request, book_id, chapter_id):
    """Return chapter metadata + concatenated text for the editor (auth required)."""
    from .book_editor import get_chapter_with_text, _user_can_edit_book
    from .models import CollBook
    user_profile_id = get_user_profile_id(request)
    is_staff_user = bool(request.user.is_staff or request.user.is_superuser)
    book = CollBook.objects.filter(
        mastermind_coll_book_id=book_id, is_active=True,
    ).first()
    if not book:
        return JsonResponse({'error': 'Book not found.'}, status=404)
    if not _user_can_edit_book(book, user_profile_id, is_staff_user):
        return JsonResponse({'error': 'Permission denied.'}, status=403)
    result = get_chapter_with_text(chapter_id)
    if 'error' in result:
        return JsonResponse(result, status=404)
    return JsonResponse(result)


@require_GET
def api_book_chapter_get_text_public(request, book_id, chapter_id):
    """Public chapter-text fetch for PUBLISHED books only (no auth required).

    Used by the public reader to lazy-load chapters as the visitor clicks
    through the table of contents. Strictly read-only and strictly limited
    to status='published' books — drafts + reviews + archives 404.
    """
    from .book_editor import get_chapter_with_text
    from .models import CollBook, CollBookChapter
    book_is_public = CollBook.objects.filter(
        mastermind_coll_book_id=book_id,
        book_status_code='published',
        is_active=True,
    ).exists()
    if not book_is_public:
        return JsonResponse({'error': 'Book not found or not published.'}, status=404)
    chapter_belongs_to_book = CollBookChapter.objects.filter(
        mastermind_coll_book_chapter_id=chapter_id,
        link_mastermind_coll_book_id=book_id,
        is_active=True,
    ).exists()
    if not chapter_belongs_to_book:
        return JsonResponse({'error': 'Chapter not found.'}, status=404)
    result = get_chapter_with_text(chapter_id)
    if 'error' in result:
        return JsonResponse(result, status=404)
    return JsonResponse(result)


@login_required
@require_POST
def api_book_update_metadata(request, book_id):
    """Update CollBook metadata fields (cover, author, publisher, ISBN, etc).

    Body: any subset of {book_title_bn, book_title_en, book_author_bn,
    book_author_en, book_publisher_bn, book_publisher_en, book_edition,
    book_isbn, book_cover_image_url, book_description, book_language_code,
    book_total_pages}. Unknown keys silently ignored. Required field
    book_title_bn cannot be cleared (empty string ignored).
    """
    from .book_editor import update_book_metadata
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)
    is_staff_user = bool(request.user.is_staff or request.user.is_superuser)
    result = update_book_metadata(
        book_id=book_id,
        owner_user_profile_id=user_profile_id,
        is_staff_user=is_staff_user,
        metadata=payload,
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_book_chapter_delete(request, book_id, chapter_id):
    """Soft-delete a chapter (is_active=False) plus its chunks."""
    from .book_editor import delete_chapter
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)
    is_staff_user = bool(request.user.is_staff or request.user.is_superuser)
    result = delete_chapter(
        chapter_id=chapter_id,
        owner_user_profile_id=user_profile_id,
        is_staff_user=is_staff_user,
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_book_chapter_move(request, book_id, chapter_id):
    """Swap chapter with its neighbour. Body: {direction: 'up'|'down'}."""
    from .book_editor import reorder_chapter
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)
    is_staff_user = bool(request.user.is_staff or request.user.is_superuser)
    result = reorder_chapter(
        chapter_id=chapter_id,
        owner_user_profile_id=user_profile_id,
        is_staff_user=is_staff_user,
        direction=(payload.get('direction') or '').strip().lower(),
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_book_publish(request, book_id):
    """Mark a book as published — visible at /mastermind/book/<id>/<slug>/."""
    from .book_editor import publish_book
    user_profile_id = get_user_profile_id(request)
    is_staff_user = bool(request.user.is_staff or request.user.is_superuser)
    result = publish_book(
        book_id=book_id,
        owner_user_profile_id=user_profile_id,
        is_staff_user=is_staff_user,
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_book_archive(request, book_id):
    """Soft-archive a book — hides from public reader but recoverable."""
    from .book_editor import archive_book
    user_profile_id = get_user_profile_id(request)
    is_staff_user = bool(request.user.is_staff or request.user.is_superuser)
    result = archive_book(
        book_id=book_id,
        owner_user_profile_id=user_profile_id,
        is_staff_user=is_staff_user,
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_question_mark_needs_edit(request, question_id):
    """Reviewer marks a question as 'needs_edit' (recoverable mid-state)."""
    from .ai_generator import mark_question_needs_edit
    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        payload = {}
    user_profile_id = get_user_profile_id(request)
    result = mark_question_needs_edit(
        question_id=question_id,
        reviewer_user_profile_id=user_profile_id,
        note=(payload.get('note') or '').strip() or None,
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_question_recover(request, question_id):
    """One-shot recovery — moves an archived question to 'needs_edit'."""
    from .ai_generator import recover_archived_question
    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)
    user_profile_id = get_user_profile_id(request)
    result = recover_archived_question(
        question_id=question_id,
        reviewer_user_profile_id=user_profile_id,
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_lobby_create(request):
    """Create a new multi-player lobby for a quiz. Caller becomes the host."""
    from .lobby import create_lobby
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)

    quiz_id = payload.get('quiz_id')
    if not isinstance(quiz_id, int):
        return JsonResponse({'error': 'quiz_id (int) is required.'}, status=400)

    mode_code = (payload.get('mode_code') or 'host_advances').strip().lower()
    max_players_raw = payload.get('max_players')
    max_players = int(max_players_raw) if isinstance(max_players_raw, int) and max_players_raw > 0 else 50
    question_seconds_raw = payload.get('question_seconds')
    question_seconds = int(question_seconds_raw) if isinstance(question_seconds_raw, int) and question_seconds_raw > 0 else None

    result = create_lobby(
        host_user_profile_id=user_profile_id,
        quiz_id=quiz_id,
        mode_code=mode_code,
        max_players=max_players,
        question_seconds=question_seconds,
    )
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_POST
def api_lobby_join(request):
    """Join a lobby by 6-char join_code (POST body)."""
    from .lobby import join_lobby
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'error': 'User profile not found.'}, status=403)
    join_code = (payload.get('join_code') or '').strip()
    if not join_code:
        return JsonResponse({'error': 'join_code is required.'}, status=400)

    result = join_lobby(join_code, user_profile_id)
    if 'error' in result:
        return JsonResponse(result, status=400)
    return JsonResponse(result)


@login_required
@require_GET
def api_lobby_state(request, lobby_id):
    """Bootstrap state for an existing lobby (used before WebSocket connects)."""
    from .lobby import get_lobby_state
    result = get_lobby_state(int(lobby_id))
    if 'error' in result:
        return JsonResponse(result, status=404)
    return JsonResponse(result)


@login_required
@require_GET
def api_lobby_state_by_code(request, join_code):
    """Resolve lobby_id (and full state) from a join_code so /play/<code>/ can render."""
    from .lobby import get_lobby_state
    result = get_lobby_state(join_code)
    if 'error' in result:
        return JsonResponse(result, status=404)
    return JsonResponse(result)


@login_required
@require_GET
def api_export_gradebook_csv(request, quiz_id):
    """Stream gradebook (one row per session) for a quiz as CSV.

    Includes UTF-8 BOM so Excel renders Bengali display names correctly.
    Query params:
      include_in_progress=1  → include sessions still in_progress (default off)
    """
    from django.http import HttpResponse
    from .exporters import export_gradebook_to_csv_bytes

    quiz, error_response = _get_quiz_or_403(request, quiz_id)
    if error_response is not None:
        return error_response

    include_in_progress = request.GET.get('include_in_progress') == '1'
    body_bytes = export_gradebook_to_csv_bytes(
        quiz_id, include_in_progress=include_in_progress,
    )
    timestamp_suffix = timezone.now().strftime('%Y%m%d-%H%M%S')
    response = HttpResponse(body_bytes, content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = (
        f'attachment; filename="mastermind-gradebook-{quiz_id}-{timestamp_suffix}.csv"'
    )
    return response


@login_required
@require_GET
def api_export_full_backup(request):
    """Stream the entire mastermind authored content tree as one giant JSON.

    Cron-friendly off-site backup endpoint. Includes books, chapters, topics,
    questions (with options + match-pairs), and quizzes (with pool entries).
    Sessions / certificates / comments / webhooks are excluded — those are
    run-state, not authored content.
    """
    from django.http import HttpResponse
    from .exporters import export_full_backup_to_dict

    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Staff access required.'}, status=403)

    bundle = export_full_backup_to_dict()
    body = json.dumps(bundle, ensure_ascii=False, indent=2).encode('utf-8')
    timestamp_suffix = timezone.now().strftime('%Y%m%d-%H%M%S')
    response = HttpResponse(body, content_type='application/json; charset=utf-8')
    response['Content-Disposition'] = (
        f'attachment; filename="mastermind-full-backup-{timestamp_suffix}.json"'
    )
    return response


@login_required
@require_GET
def api_export_quiz(request, quiz_id):
    """Export a single quiz + its question pool as a round-trip-safe JSON bundle."""
    from django.http import HttpResponse
    from .exporters import export_quiz_to_dict

    quiz, error_response = _get_quiz_or_403(request, quiz_id)
    if error_response is not None:
        return error_response
    bundle = export_quiz_to_dict(quiz_id)
    if not bundle:
        return JsonResponse({'error': 'Quiz not found.'}, status=404)
    timestamp_suffix = timezone.now().strftime('%Y%m%d-%H%M%S')
    body = json.dumps(bundle, ensure_ascii=False, indent=2).encode('utf-8')
    response = HttpResponse(body, content_type='application/json; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="mastermind-quiz-{quiz_id}-{timestamp_suffix}.json"'
    return response
