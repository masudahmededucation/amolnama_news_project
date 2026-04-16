"""Quizadmin AJAX endpoints — approve/reject/skip + quiz/question CRUD.

All mutations delegate to mastermind engine functions so business logic
stays in the engine. Quizadmin API is a thin staff-gated wrapper.
"""
import csv
import io
import json

from django.contrib.admin.views.decorators import staff_member_required
from django.http import HttpResponse, JsonResponse
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
    """Shared handler for approve/reject — validate, call engine, return next id."""
    is_valid, payload = validate_question_action_payload(request.body)
    if not is_valid:
        return JsonResponse({'error': payload}, status=400)

    user_profile_id, error_response = _get_user_profile_id_or_error(request)
    if error_response is not None:
        return error_response

    result = action_function(
        question_id=payload['question_id'],
        reviewer_user_profile_id=user_profile_id,
    )
    if result.get('error'):
        return JsonResponse({'error': result['error']}, status=400)

    next_id = _next_id_after(payload['question_id'], _extract_queue_filters(request))
    return JsonResponse({'success': True, 'next_question_id': next_id})


def _handle_engine_mutation(request, engine_function, **engine_kwargs):
    """Shared handler for quiz/question create/update — parse JSON, call engine."""
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

@staff_member_required
@require_POST
def api_coll_exam_create(request):
    from amolnama_news.site_apps.mastermind.quiz_builder import create_quiz_with_questions
    return _handle_engine_mutation(request, create_quiz_with_questions)


@staff_member_required
@require_POST
def api_coll_exam_update(request, exam_id):
    from amolnama_news.site_apps.mastermind.quiz_builder import update_quiz_with_questions
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

    if not all(isinstance(question_id, int) and question_id > 0 for question_id in question_ids):
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

@staff_member_required
@require_POST
def api_coll_exam_clone(request, exam_id):
    """Deep-clone a quiz: metadata + question pool → new draft."""
    from amolnama_news.site_apps.mastermind.models import CollQuiz, MapQuizQuestionPool
    from amolnama_news.site_apps.core.utils import english_slug_from_text
    from django.utils import timezone

    exam = (
        CollQuiz.objects
        .filter(mastermind_coll_quiz_id=exam_id, is_active=True)
        .first()
    )
    if not exam:
        return JsonResponse({'error': 'Quiz not found.'}, status=404)

    user_profile_id, profile_error = _get_user_profile_id_or_error(request)
    if profile_error is not None:
        return profile_error

    original_title_bn = exam.exam_title_bn or ''
    cloned_title_bn = f'{original_title_bn} (copy)'
    cloned_title_en = f'{exam.exam_title_en} (copy)' if exam.exam_title_en else None

    clone = CollQuiz(
        exam_title_bn=cloned_title_bn,
        exam_title_en=cloned_title_en,
        exam_description_bn=exam.exam_description_bn,
        exam_slug=english_slug_from_text(cloned_title_en, cloned_title_bn) + f'-{int(timezone.now().timestamp())}',
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
        .filter(link_mastermind_coll_quiz_id=exam_id)
        .values('link_mastermind_coll_question_id', 'is_mandatory')
    )
    for entry in pool_entries:
        MapQuizQuestionPool.objects.create(
            link_mastermind_coll_quiz_id=clone.mastermind_coll_quiz_id,
            link_mastermind_coll_question_id=entry['link_mastermind_coll_question_id'],
            is_mandatory=entry['is_mandatory'],
        )

    return JsonResponse({
        'success': True,
        'exam_id': clone.mastermind_coll_quiz_id,
        'exam_slug': clone.exam_slug,
    })


@staff_member_required
@require_POST
def api_coll_exam_delete(request, exam_id):
    """Soft-delete a quiz (set is_active=0)."""
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
    if topic_id and topic_id.isdigit():
        filters['link_mastermind_coll_quiz_topic_id'] = int(topic_id)
    if book_id and book_id.isdigit():
        filters['link_mastermind_coll_book_id'] = int(book_id)
    if status_code and status_code in VALID_QUESTION_STATUS_CODES:
        filters['question_status_code'] = status_code

    questions = list(
        CollQuestion.objects.filter(**filters)
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

    question_ids = [q['mastermind_coll_question_id'] for q in questions]
    options_by_question = {}
    for opt in (
        CollQuestionOption.objects
        .filter(link_mastermind_coll_question_id__in=question_ids, is_active=True)
        .order_by('sort_order')
        .values('link_mastermind_coll_question_id', 'option_label', 'option_text_bn', 'is_correct')
    ):
        options_by_question.setdefault(opt['link_mastermind_coll_question_id'], []).append(opt)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'question_id', 'question_text_bn', 'question_text_en', 'explanation_bn',
        'status', 'source', 'points', 'type_id', 'difficulty_id', 'topic_id',
        'page_number', 'created_at',
        'option_a', 'option_a_label', 'option_a_correct',
        'option_b', 'option_b_label', 'option_b_correct',
        'option_c', 'option_c_label', 'option_c_correct',
        'option_d', 'option_d_label', 'option_d_correct',
        'option_e', 'option_e_label', 'option_e_correct',
    ])

    for question in questions:
        question_id = question['mastermind_coll_question_id']
        opts = options_by_question.get(question_id, [])
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

    response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8-sig')
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

        try:
            question = CollQuestion.objects.create(
                question_text_bn=question_text_bn,
                question_text_en=(row.get('question_text_en') or '').strip() or None,
                question_explanation_bn=(row.get('explanation_bn') or '').strip() or None,
                link_mastermind_ref_quiz_question_type_id=type_id,
                link_mastermind_ref_quiz_difficulty_level_id=difficulty_id,
                link_mastermind_coll_quiz_topic_id=topic_id,
                question_points=int(row.get('points', '1') or '1'),
                question_status_code=row.get('status', 'draft') or 'draft',
                question_generation_source_code='imported',
                link_created_by_user_profile_id=user_profile_id,
                source_page_number=int(row['page_number']) if (row.get('page_number') or '').strip().isdigit() else None,
            )
        except Exception as create_error:
            errors.append(f'Row {row_number}: {create_error}')
            continue

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
        if expires_at and expires_at < timezone.now():
            return JsonResponse({'error': 'Expiry date must be in the future.'}, status=400)

    granter_profile_id, profile_error = _get_user_profile_id_or_error(request)
    if profile_error is not None:
        return profile_error

    existing = CollQuizCreatorPermission.objects.filter(
        link_user_profile_id=target_user_profile_id,
    ).first()

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
    expires_at = parse_datetime(str(expires_at_raw)) if expires_at_raw else None

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
