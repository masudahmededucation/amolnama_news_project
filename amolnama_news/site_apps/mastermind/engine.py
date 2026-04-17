"""Mastermind quiz engine — start session, submit answers, compute scores."""

import json
import logging
import random
from datetime import date
from decimal import Decimal

from django.db import connection
from django.utils import timezone

from .models import (
    CollQuiz,
    CollQuizSession,
    CollQuizSessionQuestion,
    CollQuestion,
    CollQuestionOption,
    CollUserStreak,
    EngUserQuizTopicMastery,
    MapQuizQuestionPool,
)

logger = logging.getLogger(__name__)


# ================================================================
# Session Management
# ================================================================

def start_exam_session(exam_id, user_profile_id):
    """Start a new exam session — select questions, randomize, snapshot.

    Returns dict with session_id, questions (with randomized options),
    exam config, or error dict.
    """
    try:
        exam = CollQuiz.objects.get(
            mastermind_coll_quiz_id=exam_id,
            exam_status_code='published',
            is_active=True,
        )
    except CollQuiz.DoesNotExist:
        return {'error': 'Exam not found or not published.'}

    # Check max attempts
    if exam.exam_max_attempts:
        attempt_count = CollQuizSession.objects.filter(
            link_mastermind_coll_quiz_id=exam_id,
            link_user_profile_id=user_profile_id,
            session_status_code='completed',
        ).count()
        if attempt_count >= exam.exam_max_attempts:
            return {'error': 'Maximum attempts reached.'}

    # Select questions from pool
    pool_entries = list(
        MapQuizQuestionPool.objects.filter(
            link_mastermind_coll_quiz_id=exam_id
        ).values_list(
            'link_mastermind_coll_question_id', 'is_mandatory'
        )
    )

    if not pool_entries:
        # No explicit pool — auto-select from topic/book
        question_filter = {
            'question_status_code': 'published',
            'is_active': True,
        }
        if exam.link_mastermind_coll_quiz_topic_id:
            question_filter['link_mastermind_coll_quiz_topic_id'] = exam.link_mastermind_coll_quiz_topic_id
        if exam.link_mastermind_coll_book_id:
            question_filter['link_mastermind_coll_book_id'] = exam.link_mastermind_coll_book_id

        all_question_ids = list(
            CollQuestion.objects.filter(**question_filter).values_list(
                'mastermind_coll_question_id', flat=True
            )
        )
        # Handle affirmative/negative groups — pick one variant per group
        all_question_ids = _deduplicate_question_groups(all_question_ids)

        if len(all_question_ids) < exam.exam_total_questions:
            return {
                'error': f'Not enough questions. Need {exam.exam_total_questions}, '
                         f'found {len(all_question_ids)}.'
            }

        selected_ids = random.sample(all_question_ids, exam.exam_total_questions)
    else:
        mandatory_ids = [qid for qid, mandatory in pool_entries if mandatory]
        optional_ids = [qid for qid, mandatory in pool_entries if not mandatory]

        # Deduplicate groups within optional pool
        optional_ids = _deduplicate_question_groups(optional_ids)

        remaining_needed = exam.exam_total_questions - len(mandatory_ids)
        if remaining_needed < 0:
            mandatory_ids = random.sample(mandatory_ids, exam.exam_total_questions)
            optional_selected = []
        elif remaining_needed > len(optional_ids):
            return {
                'error': f'Not enough questions in pool. Need {remaining_needed} '
                         f'optional, found {len(optional_ids)}.'
            }
        else:
            optional_selected = random.sample(optional_ids, remaining_needed)

        selected_ids = mandatory_ids + (optional_selected if remaining_needed >= 0 else [])

    # Randomize question order if configured
    if exam.exam_shuffle_questions:
        random.shuffle(selected_ids)

    # Calculate max score
    questions_data = list(
        CollQuestion.objects.filter(
            mastermind_coll_question_id__in=selected_ids
        ).values(
            'mastermind_coll_question_id',
            'question_points',
            'link_mastermind_ref_quiz_difficulty_level_id',
        )
    )
    questions_points_map = {
        question_row['mastermind_coll_question_id']: question_row['question_points']
        for question_row in questions_data
    }
    score_max = sum(questions_points_map.get(qid, 1) for qid in selected_ids)

    # Determine attempt number
    previous_attempts = CollQuizSession.objects.filter(
        link_mastermind_coll_quiz_id=exam_id,
        link_user_profile_id=user_profile_id,
    ).count()

    # Create session
    session = CollQuizSession.objects.create(
        link_mastermind_coll_quiz_id=exam_id,
        link_user_profile_id=user_profile_id,
        session_total_questions=len(selected_ids),
        session_score_max=Decimal(str(score_max)),
        session_attempt_number=previous_attempts + 1,
        session_started_at=timezone.now(),
        created_at=timezone.now(),
    )

    # Batch-load all options for selected questions (avoid N+1)
    all_option_ids = list(
        CollQuestionOption.objects.filter(
            link_mastermind_coll_question_id__in=selected_ids,
            is_active=True,
        ).values_list('link_mastermind_coll_question_id', 'mastermind_coll_question_option_id')
    )
    options_by_question_id = {}
    for question_id, option_id in all_option_ids:
        options_by_question_id.setdefault(question_id, []).append(option_id)

    # Create session question snapshots with randomized option order
    session_questions = []
    for display_order, question_id in enumerate(selected_ids, start=1):
        options = list(options_by_question_id.get(question_id, []))

        # Randomize option order if configured
        if exam.exam_shuffle_options and options:
            random.shuffle(options)

        option_display_order = ','.join(str(oid) for oid in options) if options else None

        session_question = CollQuizSessionQuestion.objects.create(
            link_mastermind_coll_quiz_session_id=session.mastermind_coll_quiz_session_id,
            link_mastermind_coll_question_id=question_id,
            question_display_order=display_order,
            option_display_order=option_display_order,
            created_at=timezone.now(),
        )
        session_questions.append(session_question)

    # Build response
    return _build_session_response(session, exam, session_questions)


def _deduplicate_question_groups(question_ids):
    """For questions sharing a question_group_id, pick one variant randomly."""
    if not question_ids:
        return []

    questions_with_groups = list(
        CollQuestion.objects.filter(
            mastermind_coll_question_id__in=question_ids
        ).values('mastermind_coll_question_id', 'question_group_id')
    )

    ungrouped = []
    groups = {}
    for question in questions_with_groups:
        group_id = question['question_group_id']
        question_id = question['mastermind_coll_question_id']
        if group_id is None:
            ungrouped.append(question_id)
        else:
            groups.setdefault(group_id, []).append(question_id)

    # Pick one from each group
    selected_from_groups = [random.choice(members) for members in groups.values()]
    return ungrouped + selected_from_groups


def _build_session_response(session, exam, session_questions):
    """Build the JSON-serializable response for a session."""
    from .models import CollQuestionMatchPair

    # Load all question data
    question_ids = [session_item.link_mastermind_coll_question_id for session_item in session_questions]
    questions = {
        question_obj.mastermind_coll_question_id: question_obj
        for question_obj in CollQuestion.objects.filter(
            mastermind_coll_question_id__in=question_ids
        )
    }

    # Load all options
    all_options = list(
        CollQuestionOption.objects.filter(
            link_mastermind_coll_question_id__in=question_ids,
            is_active=True,
        )
    )
    options_by_question = {}
    for option in all_options:
        options_by_question.setdefault(
            option.link_mastermind_coll_question_id, []
        ).append(option)

    # Load all match pairs (one query for all matching questions in the session)
    match_pairs_by_question = {}
    all_match_pairs = list(
        CollQuestionMatchPair.objects.filter(
            link_mastermind_coll_question_id__in=question_ids,
            is_active=True,
        ).order_by('sort_order', 'mastermind_coll_question_match_pair_id')
    )
    for pair in all_match_pairs:
        match_pairs_by_question.setdefault(
            pair.link_mastermind_coll_question_id, []
        ).append(pair)

    # Build questions list respecting display order
    questions_list = []
    for session_question in sorted(session_questions, key=lambda item: item.question_display_order):
        question = questions.get(session_question.link_mastermind_coll_question_id)
        if not question:
            continue

        # Get options in the randomized order
        question_options = options_by_question.get(
            question.mastermind_coll_question_id, []
        )
        if session_question.option_display_order:
            order_ids = [
                int(oid) for oid in session_question.option_display_order.split(',')
            ]
            options_map = {
                option.mastermind_coll_question_option_id: option
                for option in question_options
            }
            ordered_options = [
                options_map[oid] for oid in order_ids if oid in options_map
            ]
        else:
            ordered_options = sorted(question_options, key=lambda option: option.sort_order)

        question_type_code = _get_question_type_code(
            question.link_mastermind_ref_quiz_question_type_id
        )

        # Matching: split rows into stems (left column) and shuffled responses (right column)
        match_stems = None
        match_responses = None
        if question_type_code == 'matching':
            pairs_for_question = match_pairs_by_question.get(
                question.mastermind_coll_question_id, []
            )
            match_stems = [
                {
                    'pair_id': pair.mastermind_coll_question_match_pair_id,
                    'stem_text_bn': pair.stem_text_bn,
                    'stem_text_en': pair.stem_text_en,
                }
                for pair in pairs_for_question if pair.stem_text_bn or pair.stem_text_en
            ]
            response_pool = [
                {
                    'pair_id': pair.mastermind_coll_question_match_pair_id,
                    'response_text_bn': pair.response_text_bn,
                    'response_text_en': pair.response_text_en,
                }
                for pair in pairs_for_question if pair.response_text_bn or pair.response_text_en
            ]
            if exam.exam_shuffle_options and response_pool:
                random.shuffle(response_pool)
            match_responses = response_pool

        questions_list.append({
            'session_question_id': session_question.mastermind_coll_quiz_session_question_id,
            'question_id': question.mastermind_coll_question_id,
            'display_order': session_question.question_display_order,
            'question_text_bn': question.question_text_bn,
            'question_text_en': question.question_text_en,
            'question_image_url': question.question_image_url,
            'question_hint_bn': question.question_hint_bn,
            'question_hint_en': question.question_hint_en,
            'question_points': question.question_points,
            'question_type_code': question_type_code,
            'options': [
                {
                    'option_id': option.mastermind_coll_question_option_id,
                    'option_label': option.option_label,
                    'option_text_bn': option.option_text_bn,
                    'option_text_en': option.option_text_en,
                    'option_image_url': option.option_image_url,
                }
                for option in ordered_options
            ],
            'match_stems': match_stems,
            'match_responses': match_responses,
        })

    return {
        'session_id': session.mastermind_coll_quiz_session_id,
        'exam_id': exam.mastermind_coll_quiz_id,
        'exam_title_bn': exam.exam_title_bn,
        'exam_title_en': exam.exam_title_en,
        'exam_time_limit_minutes': _effective_time_limit_minutes(exam, session),
        'exam_time_limit_minutes_base': exam.exam_time_limit_minutes,
        'session_no_time_limit': bool(getattr(session, 'session_no_time_limit', False)),
        'session_extra_time_minutes': getattr(session, 'session_extra_time_minutes', None),
        'exam_show_explanation_code': exam.exam_show_explanation_code,
        'exam_allow_review': exam.exam_allow_review,
        'total_questions': session.session_total_questions,
        'attempt_number': session.session_attempt_number,
        'questions': questions_list,
    }


# ================================================================
# Answer Submission
# ================================================================

def submit_answer(session_question_id, user_profile_id, selected_option_id=None,
                  fill_blank_answer_text=None, short_answer_text=None,
                  matching_pairs=None, ordering_option_ids=None,
                  time_spent_seconds=None):
    """Submit an answer for a single question in an active session.

    Returns dict with is_correct, points_earned, explanation (if configured),
    source citation, or error dict.

    Per-type response payload:
      mcq_single / true_false:  selected_option_id (int)
      mcq_multi:                selected_option_id (comma-separated str of ints)
      fill_blank:               fill_blank_answer_text (str)
      short_answer / essay:     short_answer_text (str) — manual grading, is_correct=None
      matching:                 matching_pairs (list of {stem_pair_id, response_pair_id})
      ordering:                 ordering_option_ids (list of option_id ints in user's order)
    """
    try:
        session_question = CollQuizSessionQuestion.objects.get(
            mastermind_coll_quiz_session_question_id=session_question_id
        )
    except CollQuizSessionQuestion.DoesNotExist:
        return {'error': 'Session question not found.'}

    # Verify session belongs to user and is in progress
    try:
        session = CollQuizSession.objects.get(
            mastermind_coll_quiz_session_id=session_question.link_mastermind_coll_quiz_session_id,
            link_user_profile_id=user_profile_id,
            session_status_code='in_progress',
        )
    except CollQuizSession.DoesNotExist:
        return {'error': 'Session not found or not in progress.'}

    # Already answered?
    if session_question.answered_at is not None:
        return {'error': 'Question already answered.'}

    # Load question
    try:
        question = CollQuestion.objects.get(
            mastermind_coll_question_id=session_question.link_mastermind_coll_question_id
        )
    except CollQuestion.DoesNotExist:
        return {'error': 'Question not found.'}

    # Load exam for config
    exam = CollQuiz.objects.get(
        mastermind_coll_quiz_id=session.link_mastermind_coll_quiz_id
    )

    # Grade the answer
    question_type_code = _get_question_type_code(
        question.link_mastermind_ref_quiz_question_type_id
    )
    is_correct = None
    points_earned = Decimal('0')

    if question_type_code in ('mcq_single', 'true_false'):
        if selected_option_id:
            correct_option = CollQuestionOption.objects.filter(
                link_mastermind_coll_question_id=question.mastermind_coll_question_id,
                is_correct=True,
                is_active=True,
            ).first()
            is_correct = (
                correct_option is not None
                and selected_option_id == correct_option.mastermind_coll_question_option_id
            )
        else:
            is_correct = False

    elif question_type_code == 'mcq_multi':
        # For multi-select: all correct options must be selected, no incorrect ones
        if selected_option_id:
            # selected_option_id is comma-separated for multi-select
            is_correct = _grade_multi_select(
                question.mastermind_coll_question_id,
                selected_option_id,
            )
        else:
            is_correct = False

    elif question_type_code == 'fill_blank':
        if fill_blank_answer_text:
            is_correct = _grade_fill_blank(
                question.mastermind_coll_question_id,
                fill_blank_answer_text,
            )
        else:
            is_correct = False

    elif question_type_code in ('short_answer', 'essay'):
        # Long-form text answers need a human grader; engine cannot decide.
        is_correct = None

    elif question_type_code == 'matching':
        if matching_pairs:
            is_correct = _grade_matching(
                question.mastermind_coll_question_id,
                matching_pairs,
            )
        else:
            is_correct = False

    elif question_type_code == 'ordering':
        if ordering_option_ids:
            is_correct = _grade_ordering(
                question.mastermind_coll_question_id,
                ordering_option_ids,
            )
        else:
            is_correct = False

    # Calculate points
    if is_correct is True:
        points_earned = Decimal(str(question.question_points))
    elif is_correct is False and exam.exam_negative_marking_per_wrong > 0:
        points_earned = -exam.exam_negative_marking_per_wrong

    # Update session question
    session_question.link_selected_option_id = (
        selected_option_id if isinstance(selected_option_id, int) else None
    )
    session_question.fill_blank_answer_text = fill_blank_answer_text or None
    session_question.short_answer_text = short_answer_text or None
    session_question.matching_pairs_json = (
        json.dumps(matching_pairs, ensure_ascii=False) if matching_pairs else None
    )
    session_question.ordering_option_ids_json = (
        json.dumps(ordering_option_ids) if ordering_option_ids else None
    )
    session_question.is_correct = is_correct
    session_question.points_earned = points_earned
    session_question.time_spent_seconds = time_spent_seconds
    session_question.answered_at = timezone.now()
    session_question.save()

    # Update session counters
    session.session_total_answered += 1
    if is_correct is True:
        session.session_total_correct += 1
    elif is_correct is False:
        session.session_total_wrong += 1
    session.session_score_raw += points_earned
    session.save()

    # Build response
    response = {
        'is_correct': is_correct,
        'points_earned': float(points_earned),
        'session_total_answered': session.session_total_answered,
        'session_total_correct': session.session_total_correct,
        'session_score_raw': float(session.session_score_raw),
    }

    # Show explanation if configured for each_question
    if exam.exam_show_explanation_code == 'each_question':
        response['explanation_bn'] = question.question_explanation_bn
        response['explanation_en'] = question.question_explanation_en

        # Correct answer
        correct_options = list(
            CollQuestionOption.objects.filter(
                link_mastermind_coll_question_id=question.mastermind_coll_question_id,
                is_correct=True,
                is_active=True,
            ).values('mastermind_coll_question_option_id', 'option_label',
                     'option_text_bn', 'option_explanation_bn')
        )
        response['correct_options'] = correct_options

        # Source citation (the anti-lying clue)
        if question.source_page_number or question.source_snippet_text:
            response['source_citation'] = {
                'book_id': question.link_mastermind_coll_book_id,
                'chapter_id': question.link_mastermind_coll_book_chapter_id,
                'page_number': question.source_page_number,
                'snippet_text': question.source_snippet_text,
            }

    return response


def _grade_multi_select(question_id, selected_option_id):
    """Grade multi-select: selected_option_id is comma-separated string."""
    if isinstance(selected_option_id, str):
        selected_ids = set(int(oid) for oid in selected_option_id.split(',') if oid.strip())
    elif isinstance(selected_option_id, (list, set)):
        selected_ids = set(int(oid) for oid in selected_option_id)
    else:
        selected_ids = {int(selected_option_id)}

    correct_ids = set(
        CollQuestionOption.objects.filter(
            link_mastermind_coll_question_id=question_id,
            is_correct=True,
            is_active=True,
        ).values_list('mastermind_coll_question_option_id', flat=True)
    )
    return selected_ids == correct_ids


def _grade_fill_blank(question_id, answer_text):
    """Grade fill-in-blank: compare with correct options (NFC normalized)."""
    import unicodedata
    normalized_answer = unicodedata.normalize('NFC', answer_text.strip().lower())

    correct_options = CollQuestionOption.objects.filter(
        link_mastermind_coll_question_id=question_id,
        is_correct=True,
        is_active=True,
    )
    for option in correct_options:
        normalized_correct = unicodedata.normalize(
            'NFC', option.option_text_bn.strip().lower()
        )
        if normalized_answer == normalized_correct:
            return True
        # Also check English variant
        if option.option_text_en:
            normalized_correct_en = unicodedata.normalize(
                'NFC', option.option_text_en.strip().lower()
            )
            if normalized_answer == normalized_correct_en:
                return True
    return False


def _grade_matching(question_id, matching_pairs):
    """Grade a matching question — every stem must be paired with its own response.

    matching_pairs is a list of {stem_pair_id, response_pair_id} dicts
    referencing rows in coll_question_match_pair. Correct iff every stem's
    chosen response_pair_id equals its own primary key (stems and responses
    share the same row in match_pair — sort_order pairs them by index).
    """
    from .models import CollQuestionMatchPair

    if not matching_pairs:
        return False

    pairs_by_id = {
        pair.mastermind_coll_question_match_pair_id: pair
        for pair in CollQuestionMatchPair.objects.filter(
            link_mastermind_coll_question_id=question_id, is_active=True,
        )
    }
    if not pairs_by_id:
        return False

    stem_pairs = [pair for pair in pairs_by_id.values() if pair.stem_text_bn or pair.stem_text_en]
    if len(matching_pairs) != len(stem_pairs):
        return False

    for entry in matching_pairs:
        stem_pair_id = entry.get('stem_pair_id')
        response_pair_id = entry.get('response_pair_id')
        if stem_pair_id is None or response_pair_id is None:
            return False
        if stem_pair_id not in pairs_by_id:
            return False
        # Correct pairing: the response chosen for this stem must be the same row
        # (i.e. the response that lives on the same match_pair record as the stem).
        if stem_pair_id != response_pair_id:
            return False
    return True


def _grade_ordering(question_id, ordering_option_ids):
    """Grade an ordering question — student arranged options must match sort_order.

    ordering_option_ids is the list of CollQuestionOption ids in the order the
    student picked. Correct iff that list equals the active options sorted by
    sort_order (ascending).
    """
    canonical_order = list(
        CollQuestionOption.objects
        .filter(link_mastermind_coll_question_id=question_id, is_active=True)
        .order_by('sort_order', 'mastermind_coll_question_option_id')
        .values_list('mastermind_coll_question_option_id', flat=True)
    )
    if not canonical_order:
        return False
    if len(ordering_option_ids) != len(canonical_order):
        return False
    try:
        student_order = [int(option_id) for option_id in ordering_option_ids]
    except (TypeError, ValueError):
        return False
    return student_order == canonical_order


# ================================================================
# Accommodation overrides (extra time / no time limit per session)
# ================================================================

def _effective_time_limit_minutes(exam, session):
    """Resolve the time limit a single session should display + enforce.

    Order of precedence:
      1. session_no_time_limit=True → returns None (untimed for this student)
      2. exam_time_limit_minutes is None → returns None (untimed quiz)
      3. exam_time_limit_minutes + session_extra_time_minutes (if any)
    """
    if getattr(session, 'session_no_time_limit', False):
        return None
    base_minutes = exam.exam_time_limit_minutes
    if base_minutes is None:
        return None
    extra_minutes = getattr(session, 'session_extra_time_minutes', None) or 0
    return base_minutes + extra_minutes


def grant_session_accommodation(session_id, granted_by_user_profile_id,
                                extra_time_minutes=None, no_time_limit=False, notes=None):
    """Apply a per-session accommodation override.

    Either grants extra minutes on top of the quiz time limit, OR removes the
    time limit entirely for this student's attempt. notes is a short rationale
    (e.g. 'documented dyslexia — 50% extra time'). Returns dict with
    success/error and the resolved effective_time_limit_minutes.
    """
    if not session_id:
        return {'success': False, 'error': 'session_id required.'}
    if not granted_by_user_profile_id:
        return {'success': False, 'error': 'granted_by_user_profile_id required.'}
    if not no_time_limit and (extra_time_minutes is None or extra_time_minutes < 0):
        return {'success': False, 'error': 'extra_time_minutes must be a non-negative integer (or set no_time_limit=True).'}

    session = CollQuizSession.objects.filter(mastermind_coll_quiz_session_id=session_id).first()
    if not session:
        return {'success': False, 'error': 'Session not found.'}
    if session.session_status_code != 'in_progress':
        return {'success': False, 'error': 'Session is not in progress; accommodation cannot be applied retroactively.'}

    CollQuizSession.objects.filter(mastermind_coll_quiz_session_id=session_id).update(
        session_extra_time_minutes=(None if no_time_limit else extra_time_minutes),
        session_no_time_limit=bool(no_time_limit),
        session_accommodation_notes=(notes or None),
        link_accommodation_granted_by_user_profile_id=granted_by_user_profile_id,
    )

    refreshed_session = CollQuizSession.objects.get(mastermind_coll_quiz_session_id=session_id)
    exam = CollQuiz.objects.get(mastermind_coll_quiz_id=refreshed_session.link_mastermind_coll_quiz_id)
    return {
        'success': True,
        'session_id': session_id,
        'no_time_limit': bool(no_time_limit),
        'extra_time_minutes': (None if no_time_limit else extra_time_minutes),
        'effective_time_limit_minutes': _effective_time_limit_minutes(exam, refreshed_session),
    }


# ================================================================
# Session Completion
# ================================================================

def complete_exam_session(session_id, user_profile_id):
    """Finalize an exam session — compute final score, update mastery.

    Returns dict with score summary, or error dict.
    """
    try:
        session = CollQuizSession.objects.get(
            mastermind_coll_quiz_session_id=session_id,
            link_user_profile_id=user_profile_id,
            session_status_code='in_progress',
        )
    except CollQuizSession.DoesNotExist:
        return {'error': 'Session not found or already completed.'}

    exam = CollQuiz.objects.get(
        mastermind_coll_quiz_id=session.link_mastermind_coll_quiz_id
    )

    # Count skipped questions
    unanswered = CollQuizSessionQuestion.objects.filter(
        link_mastermind_coll_quiz_session_id=session_id,
        answered_at__isnull=True,
    ).count()

    # Finalize session
    now = timezone.now()
    session.session_total_skipped = unanswered
    session.session_completed_at = now
    session.session_status_code = 'completed'

    if session.session_score_max > 0:
        session.session_score_percentage = (
            (session.session_score_raw / session.session_score_max) * 100
        )
    else:
        session.session_score_percentage = Decimal('0')

    session.session_is_passed = (
        session.session_score_percentage >= exam.exam_pass_percentage
    )

    # Calculate time taken
    if session.session_started_at:
        time_delta = now - session.session_started_at
        session.session_time_taken_seconds = int(time_delta.total_seconds())

    session.save()

    # Update mastery + streak (pass exam to avoid re-fetch)
    _update_user_mastery(user_profile_id, session, exam)
    _update_user_streak(user_profile_id)

    # Advanced post-session processing (SRS cards, analytics, badges, streak freeze)
    from .engine_advanced import post_session_processing
    post_result = post_session_processing(user_profile_id, session.mastermind_coll_quiz_session_id)

    # Auto-issue certificate if quiz has template + session passed (idempotent)
    try:
        from .certificates import issue_certificate_for_session
        issue_certificate_for_session(session)
    except Exception:
        logger.exception('Certificate issue failed for session %s', session.mastermind_coll_quiz_session_id)

    # In-app notification (pulse + messenger DM) — soft-fail
    from .notifications import notify_quiz_results_ready
    notify_quiz_results_ready(session.mastermind_coll_quiz_session_id)

    # Outbound webhook fan-out — soft-fail, runs on background thread
    from .webhooks import fire_event
    webhook_payload = {
        'session_id': session.mastermind_coll_quiz_session_id,
        'quiz_id': session.link_mastermind_coll_quiz_id,
        'user_profile_id': user_profile_id,
        'score_percentage': float(session.session_score_percentage or 0),
        'is_passed': bool(session.session_is_passed),
        'time_taken_seconds': session.session_time_taken_seconds,
    }
    fire_event('quiz_session_completed', webhook_payload)
    if session.session_is_passed is True:
        fire_event('quiz_session_passed', webhook_payload)
    elif session.session_is_passed is False:
        fire_event('quiz_session_failed', webhook_payload)

    return {
        'session_id': session.mastermind_coll_quiz_session_id,
        'status': 'completed',
        'total_questions': session.session_total_questions,
        'total_answered': session.session_total_answered,
        'total_correct': session.session_total_correct,
        'total_wrong': session.session_total_wrong,
        'total_skipped': session.session_total_skipped,
        'score_raw': float(session.session_score_raw),
        'score_max': float(session.session_score_max),
        'score_percentage': float(session.session_score_percentage or 0),
        'is_passed': session.session_is_passed,
        'pass_percentage': float(exam.exam_pass_percentage),
        'time_taken_seconds': session.session_time_taken_seconds,
        'attempt_number': session.session_attempt_number,
        'cards_created': post_result.get('cards_created', 0),
        'new_badges': post_result.get('new_badges', []),
        'freeze_awarded': post_result.get('freeze_awarded', False),
    }


def get_session_review(session_id, user_profile_id):
    """Get full review of a completed session — answers + explanations + sources.

    Returns dict with all questions, user answers, correct answers, and source citations.
    """
    try:
        session = CollQuizSession.objects.get(
            mastermind_coll_quiz_session_id=session_id,
            link_user_profile_id=user_profile_id,
            session_status_code='completed',
        )
    except CollQuizSession.DoesNotExist:
        return {'error': 'Session not found or not completed.'}

    exam = CollQuiz.objects.get(
        mastermind_coll_quiz_id=session.link_mastermind_coll_quiz_id
    )

    if not exam.exam_allow_review:
        return {'error': 'Review not allowed for this exam.'}

    session_questions = list(
        CollQuizSessionQuestion.objects.filter(
            link_mastermind_coll_quiz_session_id=session_id
        ).order_by('question_display_order')
    )

    question_ids = [session_item.link_mastermind_coll_question_id for session_item in session_questions]
    questions = {
        question_obj.mastermind_coll_question_id: question_obj
        for question_obj in CollQuestion.objects.filter(
            mastermind_coll_question_id__in=question_ids
        )
    }

    all_options = list(
        CollQuestionOption.objects.filter(
            link_mastermind_coll_question_id__in=question_ids,
            is_active=True,
        )
    )
    options_by_question = {}
    for option in all_options:
        options_by_question.setdefault(
            option.link_mastermind_coll_question_id, []
        ).append(option)

    review_items = []
    for session_question in session_questions:
        question = questions.get(session_question.link_mastermind_coll_question_id)
        if not question:
            continue

        question_options = options_by_question.get(
            question.mastermind_coll_question_id, []
        )

        review_items.append({
            'display_order': session_question.question_display_order,
            'question_text_bn': question.question_text_bn,
            'question_text_en': question.question_text_en,
            'question_type_code': _get_question_type_code(
                question.link_mastermind_ref_quiz_question_type_id
            ),
            'selected_option_id': session_question.link_selected_option_id,
            'fill_blank_answer': session_question.fill_blank_answer_text,
            'short_answer': session_question.short_answer_text,
            'is_correct': session_question.is_correct,
            'points_earned': float(session_question.points_earned),
            'is_bookmarked': session_question.is_bookmarked,
            'explanation_bn': question.question_explanation_bn,
            'explanation_en': question.question_explanation_en,
            'options': [
                {
                    'option_id': option.mastermind_coll_question_option_id,
                    'option_label': option.option_label,
                    'option_text_bn': option.option_text_bn,
                    'is_correct': option.is_correct,
                    'option_explanation_bn': option.option_explanation_bn,
                }
                for option in sorted(question_options, key=lambda item: item.sort_order)
            ],
            'source_citation': {
                'book_id': question.link_mastermind_coll_book_id,
                'chapter_id': question.link_mastermind_coll_book_chapter_id,
                'page_number': question.source_page_number,
                'snippet_text': question.source_snippet_text,
            } if question.source_page_number or question.source_snippet_text else None,
        })

    return {
        'session_id': session.mastermind_coll_quiz_session_id,
        'exam_title_bn': exam.exam_title_bn,
        'score_percentage': float(session.session_score_percentage or 0),
        'is_passed': session.session_is_passed,
        'questions': review_items,
    }


# ================================================================
# Mastery + Streaks
# ================================================================

def _update_user_mastery(user_profile_id, session, exam):
    """Update user's topic mastery after completing a session."""
    topic_id = exam.link_mastermind_coll_quiz_topic_id
    if not topic_id:
        return

    mastery, created = EngUserQuizTopicMastery.objects.get_or_create(
        link_user_profile_id=user_profile_id,
        link_mastermind_coll_quiz_topic_id=topic_id,
        defaults={
            'created_at': timezone.now(),
        }
    )

    mastery.total_questions_attempted += session.session_total_answered
    mastery.total_questions_correct += session.session_total_correct
    if mastery.total_questions_attempted > 0:
        mastery.accuracy_percentage = Decimal(str(
            (mastery.total_questions_correct / mastery.total_questions_attempted) * 100
        ))
    mastery.last_practiced_at = timezone.now()

    # Update mastery level based on accuracy + volume
    if mastery.total_questions_attempted >= 50 and mastery.accuracy_percentage >= 90:
        mastery.mastery_level_code = 'mastered'
    elif mastery.total_questions_attempted >= 20 and mastery.accuracy_percentage >= 70:
        mastery.mastery_level_code = 'proficient'
    elif mastery.total_questions_attempted >= 5:
        mastery.mastery_level_code = 'familiar'

    mastery.updated_at = timezone.now()
    mastery.save()


def _update_user_streak(user_profile_id):
    """Record today's quiz activity for streak tracking."""
    today = date.today()
    streak, created = CollUserStreak.objects.get_or_create(
        link_user_profile_id=user_profile_id,
        streak_date=today,
        defaults={
            'session_count': 1,
            'created_at': timezone.now(),
        }
    )
    if not created:
        streak.session_count += 1
        streak.save()


def get_user_streak_count(user_profile_id):
    """Calculate current consecutive day streak for a user."""
    streak_dates = list(
        CollUserStreak.objects.filter(
            link_user_profile_id=user_profile_id,
        ).order_by('-streak_date').values_list('streak_date', flat=True)[:365]
    )

    if not streak_dates:
        return 0

    today = date.today()
    # Streak must include today or yesterday
    if streak_dates[0] != today and (today - streak_dates[0]).days > 1:
        return 0

    count = 1
    for i in range(1, len(streak_dates)):
        if (streak_dates[i - 1] - streak_dates[i]).days == 1:
            count += 1
        else:
            break
    return count


# ================================================================
# Helpers
# ================================================================

_QUESTION_TYPE_CACHE = {}


def _get_question_type_code(question_type_id):
    """Resolve question type ID to code (cached)."""
    if not _QUESTION_TYPE_CACHE:
        from .models import RefQuizQuestionType
        for question_type in RefQuizQuestionType.objects.filter(is_active=True):
            _QUESTION_TYPE_CACHE[question_type.mastermind_ref_quiz_question_type_id] = question_type.question_type_code
    return _QUESTION_TYPE_CACHE.get(question_type_id, 'mcq_single')


def get_user_stats(user_profile_id):
    """Get user's overall quiz stats — streaks, mastery, badges, scores."""
    from .models import CollUserQuizBadge, RefQuizBadge

    # Streak
    streak_count = get_user_streak_count(user_profile_id)

    # Mastery per topic
    mastery_entries = list(
        EngUserQuizTopicMastery.objects.filter(
            link_user_profile_id=user_profile_id,
        ).values(
            'link_mastermind_coll_quiz_topic_id',
            'mastery_level_code',
            'total_questions_attempted',
            'total_questions_correct',
            'accuracy_percentage',
            'last_practiced_at',
        )
    )

    # Badges
    earned_badge_ids = list(
        CollUserQuizBadge.objects.filter(
            link_user_profile_id=user_profile_id,
            is_active=True,
        ).values_list('link_mastermind_ref_quiz_badge_id', flat=True)
    )
    badges = list(
        RefQuizBadge.objects.filter(
            mastermind_ref_quiz_badge_id__in=earned_badge_ids,
            is_active=True,
        ).values('badge_code', 'badge_name_bn', 'badge_icon')
    )

    # Recent sessions
    recent_sessions = list(
        CollQuizSession.objects.filter(
            link_user_profile_id=user_profile_id,
            session_status_code='completed',
        ).order_by('-session_completed_at')[:10].values(
            'mastermind_coll_quiz_session_id',
            'link_mastermind_coll_quiz_id',
            'session_score_percentage',
            'session_is_passed',
            'session_completed_at',
            'session_attempt_number',
        )
    )

    return {
        'streak_count': streak_count,
        'mastery': mastery_entries,
        'badges': badges,
        'recent_sessions': recent_sessions,
    }
