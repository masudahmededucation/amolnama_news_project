"""Quizadmin AJAX endpoints — approve/reject/skip + quiz/question CRUD.

All mutations delegate to mastermind engine functions so business logic
stays in the engine. Quizadmin API is a thin staff-gated wrapper.
"""
import csv
import io
import json

from django.contrib.admin.views.decorators import staff_member_required
from django.http import HttpResponse, JsonResponse, StreamingHttpResponse
from django.views.decorators.http import require_POST

from amolnama_news.site_apps.core.utils import get_user_profile_id
from amolnama_news.site_apps.mastermind.ai_generator import (
    approve_question, reject_question,
)

from . import utils
from .validators import validate_question_action_payload

MAX_CSV_FILE_SIZE_BYTES = 5 * 1024 * 1024
MAX_CSV_IMPORT_ROWS = 2000
MAX_BULK_QUESTION_IDS = 500
VALID_QUESTION_STATUS_CODES = frozenset({'draft', 'review', 'published', 'archived'})


def _normalized_status_or_draft(raw):
    """Strip whitespace + lowercase + validate, fall back to 'draft'."""
    candidate = (raw or '').strip().lower()
    return candidate if candidate in VALID_QUESTION_STATUS_CODES else 'draft'


# ================================================================
# Shared helpers — eliminate repeated boilerplate across endpoints.
# ================================================================

def _parse_json_body(request):
    """Parse request.body as JSON dict. Returns (payload, error_response)."""
    try:
        payload = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return None, JsonResponse({'error': 'Invalid JSON body.'}, status=400)
    if not isinstance(payload, dict):
        return None, JsonResponse({'error': 'JSON root must be an object.'}, status=400)
    return payload, None


def _extract_queue_filters(request):
    """Extract review-queue filter params from GET query string."""
    return {
        'topic_id': int(request.GET['topic_id']) if request.GET.get('topic_id', '').isdigit() else None,
        'book_id': int(request.GET['book_id']) if request.GET.get('book_id', '').isdigit() else None,
        'confidence_level': request.GET.get('confidence_level') or None,
        'verdict_code': request.GET.get('verdict_code') or None,
        'search_query': request.GET.get('search') or None,
    }


def _next_id_after(question_id, filters):
    """Find the next pending question ID after the one we just acted on."""
    ordered_ids = utils.get_review_queue_ids(**filters)
    if not ordered_ids:
        return None
    try:
        index = ordered_ids.index(question_id)
        return ordered_ids[index + 1] if index + 1 < len(ordered_ids) else None
    except ValueError:
        return ordered_ids[0]


def _get_user_profile_id_or_error(request):
    """Get user_profile_id with null safety. Returns (id, error_response)."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return None, JsonResponse({'error': 'User profile not found. Please complete your profile first.'}, status=400)
    return user_profile_id, None


def _handle_review_action(request, action_function):
    """Shared handler for approve/reject — validate, call engine, return next id.

    Important: compute next_id BEFORE the action mutates the queue. Otherwise
    the just-acted-on question is no longer in the pending list, so .index()
    fails and we'd send the reviewer back to position 0 every time.
    """
    is_valid, payload = validate_question_action_payload(request.body)
    if not is_valid:
        return JsonResponse({'error': payload}, status=400)

    user_profile_id, error_response = _get_user_profile_id_or_error(request)
    if error_response is not None:
        return error_response

    import logging
    logger = logging.getLogger(__name__)

    next_id = _next_id_after(payload['question_id'], _extract_queue_filters(request))

    try:
        result = action_function(
            question_id=payload['question_id'],
            reviewer_user_profile_id=user_profile_id,
        )
    except Exception:
        logger.exception('Review action failed: %s', action_function.__name__)
        return JsonResponse({'error': 'Server error. Please try again.'}, status=500)
    if not isinstance(result, dict):
        return JsonResponse({'error': 'Engine returned invalid response.'}, status=500)
    if result.get('error'):
        return JsonResponse({'error': result['error']}, status=400)

    return JsonResponse({'success': True, 'next_question_id': next_id})


def _handle_engine_mutation(request, engine_function, **engine_kwargs):
    """Shared handler for quiz/question create/update — parse JSON, call engine."""
    import logging
    logger = logging.getLogger(__name__)

    payload, error_response = _parse_json_body(request)
    if error_response is not None:
        return error_response

    user_profile_id, profile_error = _get_user_profile_id_or_error(request)
    if profile_error is not None:
        return profile_error

    try:
        result = engine_function(payload=payload, user_profile_id=user_profile_id, **engine_kwargs)
    except ValueError as validation_error:
        return JsonResponse({'error': str(validation_error)}, status=400)
    except Exception as engine_error:
        logger.exception('Engine call failed: %s', engine_function.__name__)
        return JsonResponse({'error': 'Server error. Please try again.'}, status=500)
    if not isinstance(result, dict):
        return JsonResponse({'error': 'Engine returned invalid response.'}, status=500)
    if result.get('error'):
        return JsonResponse({'error': result['error']}, status=400)
    return JsonResponse(result)


# ================================================================
# Review queue actions
# ================================================================

@staff_member_required
@require_POST
def api_coll_question_approve(request):
    return _handle_review_action(request, approve_question)


@staff_member_required
@require_POST
def api_coll_question_reject(request):
    return _handle_review_action(request, reject_question)


@staff_member_required
@require_POST
def api_coll_question_skip(request):
    is_valid, payload = validate_question_action_payload(request.body)
    if not is_valid:
        return JsonResponse({'error': payload}, status=400)
    next_id = _next_id_after(payload['question_id'], _extract_queue_filters(request))
    return JsonResponse({'success': True, 'next_question_id': next_id})


# ================================================================
# Quiz CRUD
# ================================================================

@utils.staff_or_quiz_creator_required
@require_POST
def api_coll_exam_create(request):
    from amolnama_news.site_apps.mastermind.quiz_builder import create_quiz_with_questions
    return _handle_engine_mutation(request, create_quiz_with_questions)


@utils.staff_or_quiz_creator_required
@require_POST
def api_coll_exam_update(request, exam_id):
    from amolnama_news.site_apps.mastermind.quiz_builder import update_quiz_with_questions
    if not _user_can_modify_quiz(request, exam_id):
        return JsonResponse({'error': 'You can only edit quizzes you created.'}, status=403)
    return _handle_engine_mutation(request, update_quiz_with_questions, exam_id=int(exam_id))


# ================================================================
# Question CRUD
# ================================================================

@staff_member_required
@require_POST
def api_coll_question_create(request):
    from amolnama_news.site_apps.mastermind.ai_generator import create_question_manual
    return _handle_engine_mutation(request, create_question_manual)


@staff_member_required
@require_POST
def api_coll_question_update(request, question_id):
    from amolnama_news.site_apps.mastermind.ai_generator import update_question_manual
    return _handle_engine_mutation(request, update_question_manual, question_id=int(question_id))


@staff_member_required
@require_POST
def api_coll_question_delete(request, question_id):
    """Soft-delete a question (set is_active=0)."""
    from amolnama_news.site_apps.mastermind.models import CollQuestion
    updated = CollQuestion.objects.filter(
        mastermind_coll_question_id=int(question_id), is_active=True,
    ).update(is_active=False)
    if not updated:
        return JsonResponse({'error': 'Question not found or already deleted.'}, status=404)
    return JsonResponse({'success': True})


# ================================================================
# Bulk operations
# ================================================================

@staff_member_required
@require_POST
def api_coll_question_bulk_status(request):
    """Change status of multiple questions at once."""
    payload, error_response = _parse_json_body(request)
    if error_response is not None:
        return error_response

    question_ids = payload.get('question_ids', [])
    new_status = payload.get('status_code', '')

    if not question_ids or not isinstance(question_ids, list):
        return JsonResponse({'error': 'Select at least one question.'}, status=400)

    if len(question_ids) > MAX_BULK_QUESTION_IDS:
        return JsonResponse({'error': f'Maximum {MAX_BULK_QUESTION_IDS} questions per batch.'}, status=400)

    if not all(isinstance(question_id, int) and not isinstance(question_id, bool) and question_id > 0 for question_id in question_ids):
        return JsonResponse({'error': 'All question IDs must be positive integers.'}, status=400)

    if new_status not in VALID_QUESTION_STATUS_CODES:
        return JsonResponse({'error': f'Invalid status. Must be one of: {", ".join(sorted(VALID_QUESTION_STATUS_CODES))}'}, status=400)

    from amolnama_news.site_apps.mastermind.models import CollQuestion
    updated_count = (
        CollQuestion.objects
        .filter(mastermind_coll_question_id__in=question_ids, is_active=True)
        .update(question_status_code=new_status)
    )
    return JsonResponse({'success': True, 'updated_count': updated_count})


# ================================================================
# Quiz clone + delete
# ================================================================

def _user_can_modify_quiz(request, exam_id):
    """Staff can modify any quiz; creators only their own."""
    if request.user.is_staff or request.user.is_superuser:
        return True
    from amolnama_news.site_apps.mastermind.models import CollQuiz
    from amolnama_news.site_apps.core.utils import get_user_profile_id
    owner = (
        CollQuiz.objects.filter(mastermind_coll_quiz_id=exam_id, is_active=True)
        .values_list('link_created_by_user_profile_id', flat=True).first()
    )
    return owner == get_user_profile_id(request)


@utils.staff_or_quiz_creator_required
@require_POST
def api_coll_exam_clone(request, exam_id):
    """Deep-clone a quiz: metadata + question pool → new draft."""
    from amolnama_news.site_apps.mastermind.models import CollQuiz, MapQuizQuestionPool
    from amolnama_news.site_apps.core.utils import english_slug_from_text
    from django.db import transaction
    from django.utils import timezone

    exam = (
        CollQuiz.objects
        .filter(mastermind_coll_quiz_id=exam_id, is_active=True)
        .first()
    )
    if not exam:
        return JsonResponse({'error': 'Quiz not found.'}, status=404)
    if not _user_can_modify_quiz(request, exam_id):
        return JsonResponse({'error': 'You can only clone quizzes you created.'}, status=403)

    user_profile_id, profile_error = _get_user_profile_id_or_error(request)
    if profile_error is not None:
        return profile_error

    original_title_bn = exam.exam_title_bn or ''
    # exam_title_bn is NVARCHAR(500). Truncate base to leave room for ' (copy)'.
    cloned_title_bn = f'{original_title_bn[:493]} (copy)'
    cloned_title_en = f'{(exam.exam_title_en or "")[:493]} (copy)' if exam.exam_title_en else None

    with transaction.atomic():
        clone = _clone_exam_atomic(exam, cloned_title_bn, cloned_title_en, user_profile_id, exam_id)

    return JsonResponse({
        'success': True,
        'exam_id': clone.mastermind_coll_quiz_id,
        'exam_slug': clone.exam_slug,
    })


def _clone_exam_atomic(exam, cloned_title_bn, cloned_title_en, user_profile_id, source_exam_id):
    """Inner clone helper — runs under transaction.atomic()."""
    import uuid
    from amolnama_news.site_apps.mastermind.models import CollQuiz, MapQuizQuestionPool
    from amolnama_news.site_apps.core.utils import english_slug_from_text
    from django.utils import timezone

    base_slug = english_slug_from_text(cloned_title_en, cloned_title_bn) or 'quiz'
    # exam_slug is NVARCHAR(300). Reserve 10 chars for '-' + 8-char uuid suffix.
    cloned_slug = f'{base_slug[:280]}-{uuid.uuid4().hex[:8]}'

    clone = CollQuiz(
        exam_title_bn=cloned_title_bn,
        exam_title_en=cloned_title_en,
        exam_description_bn=exam.exam_description_bn,
        exam_slug=cloned_slug,
        link_mastermind_coll_quiz_topic_id=exam.link_mastermind_coll_quiz_topic_id,
        link_mastermind_coll_book_id=exam.link_mastermind_coll_book_id,
        exam_total_questions=exam.exam_total_questions,
        exam_time_limit_minutes=exam.exam_time_limit_minutes,
        exam_pass_percentage=exam.exam_pass_percentage,
        exam_negative_marking_per_wrong=exam.exam_negative_marking_per_wrong,
        exam_shuffle_questions=exam.exam_shuffle_questions,
        exam_shuffle_options=exam.exam_shuffle_options,
        exam_show_explanation_code=exam.exam_show_explanation_code,
        exam_allow_review=exam.exam_allow_review,
        exam_max_attempts=exam.exam_max_attempts,
        exam_rewards_enabled=exam.exam_rewards_enabled,
        exam_reward_criteria_code=exam.exam_reward_criteria_code,
        exam_reward_threshold_percent=exam.exam_reward_threshold_percent,
        exam_reward_top_n=exam.exam_reward_top_n,
        link_reward_badge_id=exam.link_reward_badge_id,
        exam_reward_description=exam.exam_reward_description,
        exam_status_code='draft',
        link_created_by_user_profile_id=user_profile_id,
        created_at=timezone.now(),
    )
    clone.save()

    pool_entries = list(
        MapQuizQuestionPool.objects
        .filter(link_mastermind_coll_quiz_id=source_exam_id)
        .order_by('mastermind_map_quiz_question_pool_id')
        .values('link_mastermind_coll_question_id', 'is_mandatory')
    )
    new_pool_rows = [
        MapQuizQuestionPool(
            link_mastermind_coll_quiz_id=clone.mastermind_coll_quiz_id,
            link_mastermind_coll_question_id=entry['link_mastermind_coll_question_id'],
            is_mandatory=entry['is_mandatory'],
        )
        for entry in pool_entries
    ]
    if new_pool_rows:
        MapQuizQuestionPool.objects.bulk_create(new_pool_rows)
    return clone


@utils.staff_or_quiz_creator_required
@require_POST
def api_coll_exam_delete(request, exam_id):
    """Soft-delete a quiz (set is_active=0)."""
    if not _user_can_modify_quiz(request, exam_id):
        return JsonResponse({'error': 'You can only delete quizzes you created.'}, status=403)
    from amolnama_news.site_apps.mastermind.models import CollQuiz
    updated = CollQuiz.objects.filter(
        mastermind_coll_quiz_id=exam_id, is_active=True,
    ).update(is_active=False)

    if not updated:
        return JsonResponse({'error': 'Quiz not found or already deleted.'}, status=404)
    return JsonResponse({'success': True})


# ================================================================
# CSV export
# ================================================================

@staff_member_required
def api_coll_question_export_csv(request):
    """Export filtered question bank to CSV download."""
    from amolnama_news.site_apps.mastermind.models import CollQuestion, CollQuestionOption

    filters = {'is_active': True}
    topic_id = request.GET.get('topic_id')
    book_id = request.GET.get('book_id')
    status_code = request.GET.get('status_code')
    question_type_id = request.GET.get('question_type_id')
    difficulty_id = request.GET.get('difficulty_id')
    source_code = request.GET.get('source_code')
    search_query = (request.GET.get('q') or '').strip() or None

    if topic_id and topic_id.isdigit():
        filters['link_mastermind_coll_quiz_topic_id'] = int(topic_id)
    if book_id and book_id.isdigit():
        filters['link_mastermind_coll_book_id'] = int(book_id)
    if status_code and status_code in VALID_QUESTION_STATUS_CODES:
        filters['question_status_code'] = status_code
    if question_type_id and question_type_id.isdigit():
        filters['link_mastermind_ref_quiz_question_type_id'] = int(question_type_id)
    if difficulty_id and difficulty_id.isdigit():
        filters['link_mastermind_ref_quiz_difficulty_level_id'] = int(difficulty_id)
    if source_code:
        filters['question_generation_source_code'] = source_code

    from django.db.models import Q
    questions_queryset = CollQuestion.objects.filter(**filters)
    if search_query:
        questions_queryset = questions_queryset.filter(
            Q(question_text_bn__icontains=search_query) |
            Q(question_text_en__icontains=search_query)
        )
    questions_queryset = (
        questions_queryset
        .order_by('mastermind_coll_question_id')
        .values(
            'mastermind_coll_question_id', 'question_text_bn', 'question_text_en',
            'question_explanation_bn', 'question_status_code',
            'question_generation_source_code', 'question_points',
            'link_mastermind_ref_quiz_question_type_id',
            'link_mastermind_ref_quiz_difficulty_level_id',
            'link_mastermind_coll_quiz_topic_id',
            'source_page_number', 'created_at',
        )
    )

    csv_header = [
        'question_id', 'question_text_bn', 'question_text_en', 'explanation_bn',
        'status', 'source', 'points', 'type_id', 'difficulty_id', 'topic_id',
        'page_number', 'created_at',
        'option_a', 'option_a_label', 'option_a_correct',
        'option_b', 'option_b_label', 'option_b_correct',
        'option_c', 'option_c_label', 'option_c_correct',
        'option_d', 'option_d_label', 'option_d_correct',
        'option_e', 'option_e_label', 'option_e_correct',
    ]

    def _row_iterator():
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(csv_header)
        yield buffer.getvalue()
        buffer.seek(0); buffer.truncate(0)

        chunk_size = 200
        for question in questions_queryset.iterator(chunk_size=chunk_size):
            question_id = question['mastermind_coll_question_id']
            opts = list(
                CollQuestionOption.objects
                .filter(link_mastermind_coll_question_id=question_id, is_active=True)
                .order_by('sort_order')
                .values('option_label', 'option_text_bn', 'is_correct')[:5]
            )
            row = [
                question_id, question['question_text_bn'], question['question_text_en'] or '',
                question['question_explanation_bn'] or '',
                question['question_status_code'], question['question_generation_source_code'],
                question['question_points'],
                question['link_mastermind_ref_quiz_question_type_id'],
                question['link_mastermind_ref_quiz_difficulty_level_id'],
                question['link_mastermind_coll_quiz_topic_id'],
                question['source_page_number'] or '',
                str(question['created_at'] or ''),
            ]
            for option_index in range(5):
                if option_index < len(opts):
                    row.append(opts[option_index]['option_text_bn'])
                    row.append(opts[option_index]['option_label'])
                    row.append('1' if opts[option_index]['is_correct'] else '0')
                else:
                    row.extend(['', '', ''])
            writer.writerow(row)
            yield buffer.getvalue()
            buffer.seek(0); buffer.truncate(0)

    response = StreamingHttpResponse(_row_iterator(), content_type='text/csv; charset=utf-8-sig')
    response['Content-Disposition'] = 'attachment; filename="question_bank_export.csv"'
    return response


# ================================================================
# CSV import
# ================================================================

@staff_member_required
@require_POST
def api_coll_question_import_csv(request):
    """Import questions from uploaded CSV file."""
    uploaded_file = request.FILES.get('csv_file')
    if not uploaded_file:
        return JsonResponse({'error': 'No CSV file uploaded.'}, status=400)

    if uploaded_file.size > MAX_CSV_FILE_SIZE_BYTES:
        return JsonResponse({'error': 'File too large. Max 5 MB.'}, status=400)

    content_type = getattr(uploaded_file, 'content_type', '')
    if content_type and 'csv' not in content_type and 'text' not in content_type:
        return JsonResponse({'error': 'File must be a CSV file.'}, status=400)

    from amolnama_news.site_apps.mastermind.models import (
        CollQuestion, CollQuestionOption, CollQuizTopic,
        RefQuizQuestionType, RefQuizDifficultyLevel,
    )
    from django.db import transaction

    mcq_type_codes = set(
        RefQuizQuestionType.objects
        .filter(question_type_code__in=('mcq_single', 'mcq_multi'))
        .values_list('mastermind_ref_quiz_question_type_id', flat=True)
    )

    try:
        content = uploaded_file.read().decode('utf-8-sig')
    except UnicodeDecodeError:
        return JsonResponse({'error': 'File must be UTF-8 encoded.'}, status=400)

    reader = csv.DictReader(io.StringIO(content))
    fieldnames_lower = {(f or '').strip().lower() for f in (reader.fieldnames or [])}
    required_columns = {'question_text_bn', 'type_id', 'difficulty_id', 'topic_id'}
    if not required_columns.issubset(fieldnames_lower):
        return JsonResponse({
            'error': f'CSV must have columns: {", ".join(sorted(required_columns))}',
        }, status=400)

    valid_type_ids = set(
        RefQuizQuestionType.objects.filter(is_active=True)
        .values_list('mastermind_ref_quiz_question_type_id', flat=True)
    )
    valid_difficulty_ids = set(
        RefQuizDifficultyLevel.objects.filter(is_active=True)
        .values_list('mastermind_ref_quiz_difficulty_level_id', flat=True)
    )
    valid_topic_ids = set(
        CollQuizTopic.objects.filter(is_active=True)
        .values_list('mastermind_coll_quiz_topic_id', flat=True)
    )

    user_profile_id, profile_error = _get_user_profile_id_or_error(request)
    if profile_error is not None:
        return profile_error

    created_count = 0
    errors = []

    for row_number, row in enumerate(reader, start=2):
        if row_number - 1 > MAX_CSV_IMPORT_ROWS:
            errors.append(f'Row limit reached ({MAX_CSV_IMPORT_ROWS}). Remaining rows skipped.')
            break

        question_text_bn = (row.get('question_text_bn') or '').strip()
        if not question_text_bn:
            errors.append(f'Row {row_number}: empty question_text_bn')
            continue

        type_id_raw = (row.get('type_id') or '').strip()
        difficulty_id_raw = (row.get('difficulty_id') or '').strip()
        topic_id_raw = (row.get('topic_id') or '').strip()

        if not (type_id_raw.isdigit() and difficulty_id_raw.isdigit() and topic_id_raw.isdigit()):
            errors.append(f'Row {row_number}: type_id, difficulty_id, topic_id must be integers')
            continue

        type_id = int(type_id_raw)
        difficulty_id = int(difficulty_id_raw)
        topic_id = int(topic_id_raw)

        if type_id not in valid_type_ids:
            errors.append(f'Row {row_number}: unknown type_id {type_id}')
            continue
        if difficulty_id not in valid_difficulty_ids:
            errors.append(f'Row {row_number}: unknown difficulty_id {difficulty_id}')
            continue
        if topic_id not in valid_topic_ids:
            errors.append(f'Row {row_number}: unknown topic_id {topic_id}')
            continue

        if type_id in mcq_type_codes:
            mcq_options = []
            option_labels = ['a', 'b', 'c', 'd', 'e']
            for label in option_labels:
                option_text = (row.get(f'option_{label}') or '').strip()
                if option_text:
                    is_correct = (row.get(f'option_{label}_correct') or '0').strip() == '1'
                    mcq_options.append((label, option_text, is_correct))
            if not mcq_options:
                errors.append(f'Row {row_number}: MCQ question requires at least one option')
                continue
            if not any(is_correct for _, _, is_correct in mcq_options):
                errors.append(f'Row {row_number}: MCQ question requires at least one correct option')
                continue

        try:
            with transaction.atomic():
                question = CollQuestion.objects.create(
                    question_text_bn=question_text_bn,
                    question_text_en=(row.get('question_text_en') or '').strip() or None,
                    question_explanation_bn=(row.get('explanation_bn') or '').strip() or None,
                    link_mastermind_ref_quiz_question_type_id=type_id,
                    link_mastermind_ref_quiz_difficulty_level_id=difficulty_id,
                    link_mastermind_coll_quiz_topic_id=topic_id,
                    question_points=int(row.get('points', '1') or '1'),
                    question_status_code=_normalized_status_or_draft(row.get('status')),
                    question_generation_source_code='imported',
                    link_created_by_user_profile_id=user_profile_id,
                    source_page_number=int(row['page_number']) if (row.get('page_number') or '').strip().isdigit() else None,
                )

                option_labels = ['a', 'b', 'c', 'd', 'e']
                for option_index, label in enumerate(option_labels):
                    option_text = (row.get(f'option_{label}') or '').strip()
                    if not option_text:
                        continue
                    is_correct = (row.get(f'option_{label}_correct') or '0').strip() == '1'
                    CollQuestionOption.objects.create(
                        link_mastermind_coll_question_id=question.mastermind_coll_question_id,
                        option_label=label,
                        option_text_bn=option_text,
                        is_correct=is_correct,
                        sort_order=option_index,
                    )
        except Exception as create_error:
            errors.append(f'Row {row_number}: {create_error}')
            continue

        created_count += 1

    result = {'success': True, 'created_count': created_count}
    if errors:
        result['errors'] = errors[:20]
    return JsonResponse(result)


# ================================================================
# Quiz creator permission management (staff only)
# ================================================================

@staff_member_required
@require_POST
def api_quiz_creator_grant(request):
    """Grant quiz creator permission to a non-staff user."""
    payload, error_response = _parse_json_body(request)
    if error_response is not None:
        return error_response

    target_user_profile_id = payload.get('user_profile_id')
    expires_at_raw = payload.get('expires_at')
    permission_notes = (payload.get('permission_notes') or '').strip() or None

    if not target_user_profile_id or not isinstance(target_user_profile_id, int):
        return JsonResponse({'error': 'user_profile_id is required.'}, status=400)

    from amolnama_news.site_apps.user_account.models import UserProfile
    if not UserProfile.objects.filter(user_profile_id=target_user_profile_id).exists():
        return JsonResponse({'error': 'User not found.'}, status=404)

    from amolnama_news.site_apps.mastermind.models import CollQuizCreatorPermission
    from django.utils import timezone
    from django.utils.dateparse import parse_datetime

    expires_at = None
    if expires_at_raw:
        expires_at = parse_datetime(str(expires_at_raw))
        if expires_at is None:
            return JsonResponse({'error': 'Invalid expiry date format.'}, status=400)
        if timezone.is_naive(expires_at):
            expires_at = timezone.make_aware(expires_at)
        if expires_at < timezone.now():
            return JsonResponse({'error': 'Expiry date must be in the future.'}, status=400)

    granter_profile_id, profile_error = _get_user_profile_id_or_error(request)
    if profile_error is not None:
        return profile_error

    from django.db import transaction
    with transaction.atomic():
        existing = (
            CollQuizCreatorPermission.objects
            .select_for_update()
            .filter(link_user_profile_id=target_user_profile_id)
            .first()
        )

        if existing:
            CollQuizCreatorPermission.objects.filter(
                mastermind_coll_quiz_creator_permission_id=existing.mastermind_coll_quiz_creator_permission_id,
            ).update(
                permission_status_code='active',
                link_granted_by_user_profile_id=granter_profile_id,
                expires_at=expires_at,
                revoked_at=None,
                permission_notes=permission_notes,
                is_active=True,
                updated_at=timezone.now(),
            )
            return JsonResponse({'success': True, 'action': 'reactivated'})

        CollQuizCreatorPermission.objects.create(
            link_user_profile_id=target_user_profile_id,
            link_granted_by_user_profile_id=granter_profile_id,
            permission_status_code='active',
            expires_at=expires_at,
            permission_notes=permission_notes,
        )
    return JsonResponse({'success': True, 'action': 'granted'})


@staff_member_required
@require_POST
def api_quiz_creator_revoke(request, permission_id):
    """Revoke quiz creator permission."""
    from amolnama_news.site_apps.mastermind.models import CollQuizCreatorPermission
    from django.utils import timezone

    updated = CollQuizCreatorPermission.objects.filter(
        mastermind_coll_quiz_creator_permission_id=permission_id,
        is_active=True,
    ).update(
        permission_status_code='revoked',
        revoked_at=timezone.now(),
        updated_at=timezone.now(),
    )
    if not updated:
        return JsonResponse({'error': 'Permission not found.'}, status=404)
    return JsonResponse({'success': True})


@staff_member_required
@require_POST
def api_quiz_creator_update_expiry(request, permission_id):
    """Update the expiry date of a quiz creator permission."""
    payload, error_response = _parse_json_body(request)
    if error_response is not None:
        return error_response

    from amolnama_news.site_apps.mastermind.models import CollQuizCreatorPermission
    from django.utils import timezone
    from django.utils.dateparse import parse_datetime

    expires_at_raw = payload.get('expires_at')
    expires_at = None
    if expires_at_raw:
        expires_at = parse_datetime(str(expires_at_raw))
        if expires_at is None:
            return JsonResponse({'error': 'Invalid expiry date format.'}, status=400)
        if timezone.is_naive(expires_at):
            expires_at = timezone.make_aware(expires_at)

    updated = CollQuizCreatorPermission.objects.filter(
        mastermind_coll_quiz_creator_permission_id=permission_id,
        is_active=True,
    ).update(
        expires_at=expires_at,
        updated_at=timezone.now(),
    )
    if not updated:
        return JsonResponse({'error': 'Permission not found.'}, status=404)
    return JsonResponse({'success': True})


@staff_member_required
def api_quiz_creator_search_users(request):
    """Search users by email for the grant form."""
    query = request.GET.get('q', '')
    results = utils.search_users_by_email_or_name(query, limit=10)
    return JsonResponse({'results': results})
