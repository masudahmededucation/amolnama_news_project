"""Mastermind — Quiz builder CRUD.

Creates and updates quizzes (coll_quiz rows) with their questions
(coll_question rows linked via map_quiz_question_pool).

Manual flow lives here. AI-generated flow goes through
mastermind.ai_generator.start_generation_job, then a question-pool hook
attaches the generated questions to an existing quiz.

All mutations are wrapped in a single DB transaction so a partial write
never leaves a quiz in a broken half-state.
"""
import logging
import unicodedata

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from .ai_generator import (
    BENGALI_OPTION_LABELS,
    _apply_options_to_question,
    _derive_option_label,
)
from .models import (
    CollQuiz,
    CollQuestion,
    CollQuestionOption,
    MapQuizQuestionPool,
    RefQuizBadge,
    CollBook,
    RefQuizDifficultyLevel,
    RefQuizQuestionType,
    CollQuizTopic,
)

logger = logging.getLogger(__name__)


REWARD_CRITERIA_CODES = ('top_n', 'threshold', 'speed')
QUESTION_STATUS_CODES = ('draft', 'review', 'published', 'archived')
EXAM_STATUS_CODES = ('draft', 'review', 'published', 'archived')


# ================================================================
# Slug helpers
# ================================================================

def _generate_quiz_slug(text_en=None, text_bn=None):
    """Generate English slug for a quiz, falling back to 'quiz' if empty."""
    from amolnama_news.site_apps.core.utils import english_slug_from_text
    candidate = english_slug_from_text(text_en=text_en, text_bn=text_bn) or 'quiz'
    return candidate[:240]


def _ensure_unique_slug(base_slug, exam_id_to_ignore=None):
    """Append -2, -3 ... until the slug is unique in coll_quiz."""
    candidate = base_slug
    suffix = 2
    while True:
        query = CollQuiz.objects.filter(exam_slug=candidate)
        if exam_id_to_ignore is not None:
            query = query.exclude(mastermind_coll_quiz_id=exam_id_to_ignore)
        if not query.exists():
            return candidate
        candidate = f'{base_slug}-{suffix}'
        suffix += 1


# ================================================================
# Create quiz
# ================================================================

def create_quiz_with_questions(payload, user_profile_id=None):
    """Create a coll_quiz row + all questions + pool links in one transaction.

    payload keys:
        exam_title_bn (required), exam_title_en, exam_description_bn
        link_mastermind_coll_quiz_topic_id, link_mastermind_coll_book_id
        exam_total_questions (auto-set from len(questions) if not provided)
        exam_time_limit_minutes, exam_pass_percentage (default 50),
        exam_negative_marking_per_wrong (default 0),
        exam_shuffle_questions (bool), exam_shuffle_options (bool),
        exam_show_explanation_code, exam_allow_review (bool),
        exam_max_attempts
        exam_status_code ('draft' default)
        Rewards block:
          exam_rewards_enabled (bool)
          exam_reward_criteria_code ('top_n' | 'threshold' | 'speed')
          exam_reward_threshold_percent
          exam_reward_top_n
          link_reward_badge_id
          exam_reward_description
        questions: list of per-question dicts (see _upsert_question_for_quiz).
    """
    exam_title_bn = (payload.get('exam_title_bn') or '').strip()
    if not exam_title_bn:
        return {'error': 'exam_title_bn is required.'}

    questions_payload = payload.get('questions') or []
    total_questions = len(questions_payload) or int(payload.get('exam_total_questions') or 0)
    if total_questions <= 0:
        return {'error': 'Quiz needs at least one question.'}

    base_slug = _generate_quiz_slug(text_en=payload.get('exam_title_en'), text_bn=payload.get('exam_title_en') or exam_title_bn)
    unique_slug = _ensure_unique_slug(base_slug)

    with transaction.atomic():
        exam = CollQuiz.objects.create(
            exam_title_bn=exam_title_bn,
            exam_title_en=(payload.get('exam_title_en') or None) or None,
            exam_description_bn=(payload.get('exam_description_bn') or None) or None,
            exam_slug=unique_slug,
            link_mastermind_coll_quiz_topic_id=payload.get('link_mastermind_coll_quiz_topic_id') or None,
            link_mastermind_coll_book_id=payload.get('link_mastermind_coll_book_id') or None,
            exam_total_questions=total_questions,
            exam_time_limit_minutes=payload.get('exam_time_limit_minutes') or None,
            exam_pass_percentage=payload.get('exam_pass_percentage') or 50,
            exam_negative_marking_per_wrong=payload.get('exam_negative_marking_per_wrong') or 0,
            exam_shuffle_questions=bool(payload.get('exam_shuffle_questions', True)),
            exam_shuffle_options=bool(payload.get('exam_shuffle_options', True)),
            exam_show_explanation_code=(
                payload.get('exam_show_explanation_code') or 'each_question'
            ),
            exam_allow_review=bool(payload.get('exam_allow_review', True)),
            exam_max_attempts=payload.get('exam_max_attempts') or None,
            exam_proctoring_level=int(payload.get('exam_proctoring_level') or 0),
            exam_proctoring_max_score=payload.get('exam_proctoring_max_score') or None,
            exam_rewards_enabled=bool(payload.get('exam_rewards_enabled', False)),
            exam_reward_criteria_code=(
                payload.get('exam_reward_criteria_code') or None
                if payload.get('exam_reward_criteria_code') in REWARD_CRITERIA_CODES else None
            ),
            exam_reward_threshold_percent=payload.get('exam_reward_threshold_percent') or None,
            exam_reward_top_n=payload.get('exam_reward_top_n') or None,
            link_reward_badge_id=payload.get('link_reward_badge_id') or None,
            exam_reward_description=(payload.get('exam_reward_description') or None) or None,
            exam_status_code=(
                payload.get('exam_status_code') or 'draft'
                if (payload.get('exam_status_code') or 'draft') in EXAM_STATUS_CODES else 'draft'
            ),
            link_created_by_user_profile_id=user_profile_id,
            created_at=timezone.now(),
        )
        for position_index, question_payload in enumerate(questions_payload):
            _upsert_question_for_quiz(
                exam=exam,
                question_payload=question_payload,
                position_index=position_index,
                user_profile_id=user_profile_id,
            )

    _log_workflow(exam.mastermind_coll_quiz_id, None, exam.exam_status_code, user_profile_id)

    return {
        'success': True,
        'exam_id': exam.mastermind_coll_quiz_id,
        'exam_slug': exam.exam_slug,
        'question_count': len(questions_payload),
    }


def _log_workflow(quiz_id, from_status, to_status, user_profile_id):
    """Record quiz status transition in audit log (best-effort, never fails the parent)."""
    try:
        from amolnama_news.site_apps.quizadmin.utils import log_quiz_workflow_transition
        log_quiz_workflow_transition(quiz_id, from_status, to_status, user_profile_id or 0)
    except Exception:
        pass


# ================================================================
# Update quiz
# ================================================================

def update_quiz_with_questions(exam_id, payload, user_profile_id=None):
    """Replace the quiz + its question set wholesale.

    Strategy: update the exam row; delete map_quiz_question_pool rows;
    for each submitted question, upsert its coll_question + options,
    then create the pool link. This matches the UX (one big form, one
    save). Orphaned CollQuestion rows that were linked only to this
    exam are left intact (soft delete via is_active=False) so their
    history is preserved.
    """
    exam = CollQuiz.objects.filter(mastermind_coll_quiz_id=exam_id).first()
    if not exam:
        return {'error': 'Quiz not found.'}

    exam_title_bn = (payload.get('exam_title_bn') or '').strip()
    if not exam_title_bn:
        return {'error': 'exam_title_bn is required.'}

    questions_payload = payload.get('questions') or []
    total_questions = len(questions_payload)
    if total_questions <= 0:
        return {'error': 'Quiz needs at least one question.'}

    base_slug = _generate_quiz_slug(text_en=payload.get('exam_title_en'), text_bn=payload.get('exam_title_en') or exam_title_bn)
    unique_slug = _ensure_unique_slug(base_slug, exam_id_to_ignore=exam_id)

    with transaction.atomic():
        CollQuiz.objects.filter(mastermind_coll_quiz_id=exam_id).update(
            exam_title_bn=exam_title_bn,
            exam_title_en=(payload.get('exam_title_en') or None) or None,
            exam_description_bn=(payload.get('exam_description_bn') or None) or None,
            exam_slug=unique_slug,
            link_mastermind_coll_quiz_topic_id=payload.get('link_mastermind_coll_quiz_topic_id') or None,
            link_mastermind_coll_book_id=payload.get('link_mastermind_coll_book_id') or None,
            exam_total_questions=total_questions,
            exam_time_limit_minutes=payload.get('exam_time_limit_minutes') or None,
            exam_pass_percentage=payload.get('exam_pass_percentage') or exam.exam_pass_percentage,
            exam_negative_marking_per_wrong=(
                payload.get('exam_negative_marking_per_wrong') or exam.exam_negative_marking_per_wrong
            ),
            exam_shuffle_questions=bool(payload.get('exam_shuffle_questions', exam.exam_shuffle_questions)),
            exam_shuffle_options=bool(payload.get('exam_shuffle_options', exam.exam_shuffle_options)),
            exam_show_explanation_code=(
                payload.get('exam_show_explanation_code') or exam.exam_show_explanation_code
            ),
            exam_allow_review=bool(payload.get('exam_allow_review', exam.exam_allow_review)),
            exam_max_attempts=payload.get('exam_max_attempts') or None,
            exam_proctoring_level=int(payload.get('exam_proctoring_level') or exam.exam_proctoring_level or 0),
            exam_proctoring_max_score=payload.get('exam_proctoring_max_score') or None,
            exam_rewards_enabled=bool(payload.get('exam_rewards_enabled', False)),
            exam_reward_criteria_code=(
                payload.get('exam_reward_criteria_code') or None
                if payload.get('exam_reward_criteria_code') in REWARD_CRITERIA_CODES else None
            ),
            exam_reward_threshold_percent=payload.get('exam_reward_threshold_percent') or None,
            exam_reward_top_n=payload.get('exam_reward_top_n') or None,
            link_reward_badge_id=payload.get('link_reward_badge_id') or None,
            exam_reward_description=(payload.get('exam_reward_description') or None) or None,
            exam_status_code=(
                payload.get('exam_status_code') or exam.exam_status_code
                if (payload.get('exam_status_code') or exam.exam_status_code) in EXAM_STATUS_CODES
                else exam.exam_status_code
            ),
            updated_at=timezone.now(),
        )

        # Wipe pool links so old order doesn't persist; we'll re-insert below.
        MapQuizQuestionPool.objects.filter(
            link_mastermind_coll_quiz_id=exam_id,
        ).delete()

        refreshed_exam = CollQuiz.objects.get(mastermind_coll_quiz_id=exam_id)
        for position_index, question_payload in enumerate(questions_payload):
            _upsert_question_for_quiz(
                exam=refreshed_exam,
                question_payload=question_payload,
                position_index=position_index,
                user_profile_id=user_profile_id,
            )

    old_status = exam.exam_status_code
    new_status = payload.get('exam_status_code') or old_status
    if old_status != new_status:
        _log_workflow(exam_id, old_status, new_status, user_profile_id)

    return {
        'success': True,
        'exam_id': exam_id,
        'exam_slug': unique_slug,
        'question_count': total_questions,
    }


# ================================================================
# Per-question upsert
# ================================================================

_QUESTION_TYPE_CACHE = {}


def _get_question_type_code(question_type_id):
    """Cached question_type_id → question_type_code lookup. Loaded once per process."""
    if not _QUESTION_TYPE_CACHE:
        for row in RefQuizQuestionType.objects.filter(is_active=True).values_list(
            'mastermind_ref_quiz_question_type_id', 'question_type_code',
        ):
            _QUESTION_TYPE_CACHE[row[0]] = row[1]
    return _QUESTION_TYPE_CACHE.get(question_type_id)


def _upsert_question_for_quiz(exam, question_payload, position_index, user_profile_id):
    """Create or update a single question row and its options, then link
    to the exam via map_quiz_question_pool."""
    question_type_id = question_payload.get('question_type_id')
    difficulty_id = question_payload.get('difficulty_id')
    topic_id = (
        question_payload.get('topic_id') or exam.link_mastermind_coll_quiz_topic_id
    )
    if not (question_type_id and difficulty_id and topic_id):
        raise ValueError(
            'question_type_id, difficulty_id and topic_id are required on every question.'
        )

    question_type_code = _get_question_type_code(question_type_id)
    if not question_type_code:
        raise ValueError(f'Unknown question_type_id: {question_type_id}')

    question_id = question_payload.get('question_id') or None
    question_text_bn = (question_payload.get('question_text_bn') or '').strip()
    if not question_text_bn:
        raise ValueError('question_text_bn is required for every question.')

    field_values = dict(
        link_mastermind_ref_quiz_question_type_id=question_type_id,
        link_mastermind_ref_quiz_difficulty_level_id=difficulty_id,
        link_mastermind_coll_quiz_topic_id=topic_id,
        question_text_bn=question_text_bn,
        question_text_en=(question_payload.get('question_text_en') or None) or None,
        question_explanation_bn=(question_payload.get('question_explanation_bn') or None) or None,
        question_hint_bn=(question_payload.get('question_hint_bn') or None) or None,
        question_image_url=(question_payload.get('question_image_url') or None) or None,
        question_points=int(question_payload.get('question_points') or 1),
        question_time_limit_seconds=(
            int(question_payload['question_time_limit_seconds'])
            if question_payload.get('question_time_limit_seconds') else None
        ),
        question_negative_marking_points=(
            question_payload.get('question_negative_marking_points') or 0
        ),
        link_mastermind_coll_book_id=(
            question_payload.get('link_mastermind_coll_book_id')
            or exam.link_mastermind_coll_book_id
            or None
        ),
        source_page_number=question_payload.get('source_page_number') or None,
        source_snippet_text=(question_payload.get('source_snippet_text') or None) or None,
        question_status_code=question_payload.get('question_status_code') or exam.exam_status_code,
    )

    if question_id:
        CollQuestion.objects.filter(mastermind_coll_question_id=question_id).update(
            updated_at=timezone.now(),
            **field_values,
        )
        CollQuestionOption.objects.filter(
            link_mastermind_coll_question_id=question_id, is_active=True,
        ).delete()
        question_instance = CollQuestion.objects.get(mastermind_coll_question_id=question_id)
    else:
        question_instance = CollQuestion.objects.create(
            link_created_by_user_profile_id=user_profile_id,
            question_generation_source_code='manual',
            created_at=timezone.now(),
            **field_values,
        )

    _apply_options_to_question(
        question_instance, question_type_code, question_payload,
    )

    MapQuizQuestionPool.objects.create(
        link_mastermind_coll_quiz_id=exam.mastermind_coll_quiz_id,
        link_mastermind_coll_question_id=question_instance.mastermind_coll_question_id,
        is_mandatory=False,
        created_at=timezone.now(),
    )


# ================================================================
# Badge auto-award hook (called by engine.complete_exam_session)
# ================================================================

def award_badge_if_qualified(session):
    """Award the quiz's reward badge to the session's user, if qualified.

    Called by engine.complete_exam_session after the score is final.
    Safe to call repeatedly — coll_user_badge has a unique constraint
    on (user_profile_id, ref_badge_id) so duplicate awards are no-ops.

    Qualification logic per criteria_code:
      - 'threshold': session_score_percentage >= exam_reward_threshold_percent
      - 'top_n':     user is in the top N scores across all completed sessions
                     of this exam (ordered by score desc, then time asc)
      - 'speed':     user has the fastest session_time_taken_seconds among
                     sessions with session_is_passed = 1
    """
    from .models import CollQuiz, CollQuizSession, CollUserQuizBadge

    exam = CollQuiz.objects.filter(mastermind_coll_quiz_id=session.link_mastermind_coll_quiz_id).first()
    if not exam or not exam.exam_rewards_enabled or not exam.link_reward_badge_id:
        return {'awarded': False, 'reason': 'rewards disabled or no badge set'}

    criteria_code = exam.exam_reward_criteria_code or 'threshold'
    qualifies = False
    reason = ''

    if criteria_code == 'threshold':
        threshold = exam.exam_reward_threshold_percent or exam.exam_pass_percentage
        if session.session_score_percentage is not None and float(session.session_score_percentage) >= float(threshold):
            qualifies = True
            reason = f'score {session.session_score_percentage} >= threshold {threshold}'

    elif criteria_code == 'top_n':
        top_n = int(exam.exam_reward_top_n or 1)
        ranked_user_ids = list(
            CollQuizSession.objects
            .filter(
                link_mastermind_coll_quiz_id=exam.mastermind_coll_quiz_id,
                session_status_code='completed',
            )
            .order_by('-session_score_percentage', 'session_time_taken_seconds')
            .values_list('link_user_profile_id', flat=True)[:top_n]
        )
        if session.link_user_profile_id in ranked_user_ids:
            qualifies = True
            reason = f'ranked top {top_n}'

    elif criteria_code == 'speed':
        if session.session_is_passed:
            fastest_time = (
                CollQuizSession.objects
                .filter(
                    link_mastermind_coll_quiz_id=exam.mastermind_coll_quiz_id,
                    session_status_code='completed',
                    session_is_passed=True,
                )
                .order_by('session_time_taken_seconds')
                .values_list('session_time_taken_seconds', flat=True)
                .first()
            )
            if fastest_time is not None and session.session_time_taken_seconds == fastest_time:
                qualifies = True
                reason = f'fastest pass ({fastest_time}s)'

    if not qualifies:
        return {'awarded': False, 'reason': reason or 'did not qualify'}

    badge_awarded, created = CollUserQuizBadge.objects.get_or_create(
        link_user_profile_id=session.link_user_profile_id,
        link_mastermind_ref_quiz_badge_id=exam.link_reward_badge_id,
        defaults={'earned_at': timezone.now(), 'is_active': True},
    )
    return {
        'awarded': bool(created),
        'badge_id': exam.link_reward_badge_id,
        'reason': reason,
    }
