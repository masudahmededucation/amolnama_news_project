"""Mastermind quiz proctoring engine.

Records behavioral violations during a quiz session and updates the
session's running suspicion score. ZERO IMAGES policy — only text events
with severity points are stored. AI runs client-side in browser via
MediaPipe; only event types cross the network.

Public functions:
    log_violation(session_id, user_profile_id, type_code, ...)
        — record a single violation, update session running score
        — returns dict with new total score + status (clean/warned/flagged)
        — never raises; failures are logged and a safe response returned

    get_session_threshold(session_id)
        — resolves per-quiz override -> global default

    forgive_violation(violation_id, admin_user_profile_id)
        — soft-delete a violation row, recompute session score
"""
import logging

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import (
    CollQuiz,
    CollQuizProctoringLog,
    CollQuizSession,
)

logger = logging.getLogger(__name__)


def _resolve_severity_points(violation_type_code, fallback_points=1):
    """Look up severity points from settings; fall back to default if unknown type."""
    severity_map = getattr(settings, 'PROCTORING_SEVERITY_POINTS', {})
    return severity_map.get(violation_type_code, fallback_points)


def get_session_threshold(quiz_id):
    """Resolve the lockout threshold for a quiz: per-quiz override > global default."""
    per_quiz = (
        CollQuiz.objects
        .filter(mastermind_coll_quiz_id=quiz_id)
        .values_list('exam_proctoring_max_score', flat=True)
        .first()
    )
    if per_quiz:
        return per_quiz
    return getattr(settings, 'PROCTORING_GLOBAL_THRESHOLD', 15)


def _compute_status(total_score, threshold):
    """Map running score to status code: clean / warned / flagged."""
    if total_score >= threshold:
        return 'flagged'
    if total_score >= (threshold / 2):
        return 'warned'
    return 'clean'


def log_violation(session_id, user_profile_id, quiz_id, violation_type_code,
                  details=None, confidence_score=None, client_reported_at=None):
    """Record a violation and update the cached session score.

    Returns a dict:
        {
            'success': True,
            'violation_id': int,
            'session_score': int,    # new running total
            'threshold': int,         # configured lockout threshold
            'status': 'clean'|'warned'|'flagged',
            'should_terminate': bool, # threshold crossed this call
        }
    or
        {'success': False, 'error': '...'}
    """
    if not session_id or not user_profile_id or not quiz_id:
        return {'success': False, 'error': 'Missing required fields.'}
    if not violation_type_code:
        return {'success': False, 'error': 'violation_type_code is required.'}

    points = _resolve_severity_points(violation_type_code)
    parsed_client_time = None
    if client_reported_at:
        parsed_client_time = parse_datetime(str(client_reported_at))
        if parsed_client_time and timezone.is_naive(parsed_client_time):
            parsed_client_time = timezone.make_aware(parsed_client_time)

    try:
        with transaction.atomic():
            log_row = CollQuizProctoringLog.objects.create(
                link_mastermind_coll_quiz_session_id=session_id,
                link_user_profile_id=user_profile_id,
                link_mastermind_coll_quiz_id=quiz_id,
                violation_type_code=violation_type_code,
                violation_severity_points=points,
                violation_details=(details or '')[:500] or None,
                violation_confidence_score=confidence_score,
                violation_client_reported_at=parsed_client_time,
            )
            new_total = (
                CollQuizProctoringLog.objects
                .filter(link_mastermind_coll_quiz_session_id=session_id, is_active=True)
                .aggregate(total=Sum('violation_severity_points'))['total']
            ) or 0

            threshold = get_session_threshold(quiz_id)
            previous_status = (
                CollQuizSession.objects
                .filter(mastermind_coll_quiz_session_id=session_id)
                .values_list('session_proctoring_status_code', flat=True)
                .first()
            ) or 'clean'
            new_status = _compute_status(new_total, threshold)

            CollQuizSession.objects.filter(
                mastermind_coll_quiz_session_id=session_id,
            ).update(
                session_proctoring_score=new_total,
                session_proctoring_status_code=new_status,
            )
    except Exception:
        logger.exception('Failed to log proctoring violation for session %s', session_id)
        return {'success': False, 'error': 'Server error.'}

    should_terminate = (previous_status != 'flagged' and new_status == 'flagged')

    # Outbound webhook fan-out — soft-fail
    try:
        from .webhooks import fire_event
        fire_event('proctoring_violation_logged', {
            'violation_id': log_row.mastermind_coll_quiz_proctoring_log_id,
            'session_id': session_id,
            'quiz_id': quiz_id,
            'user_profile_id': user_profile_id,
            'violation_type_code': violation_type_code,
            'severity_points': severity_points,
            'session_score': new_total,
            'status': new_status,
        })
    except Exception:
        logger.exception('Webhook fire failed for proctoring violation')

    return {
        'success': True,
        'violation_id': log_row.mastermind_coll_quiz_proctoring_log_id,
        'session_score': new_total,
        'threshold': threshold,
        'status': new_status,
        'should_terminate': should_terminate,
    }


def forgive_violation(violation_id, admin_user_profile_id):
    """Soft-delete a violation and recompute the session's score."""
    if not violation_id:
        return {'success': False, 'error': 'violation_id required.'}

    try:
        with transaction.atomic():
            row = CollQuizProctoringLog.objects.filter(
                mastermind_coll_quiz_proctoring_log_id=violation_id,
                is_active=True,
            ).first()
            if not row:
                return {'success': False, 'error': 'Violation not found or already forgiven.'}

            CollQuizProctoringLog.objects.filter(
                mastermind_coll_quiz_proctoring_log_id=violation_id,
            ).update(
                is_active=False,
                forgiven_at=timezone.now(),
                link_forgiven_by_user_profile_id=admin_user_profile_id,
                updated_at=timezone.now(),
            )

            session_id = row.link_mastermind_coll_quiz_session_id
            quiz_id = row.link_mastermind_coll_quiz_id
            new_total = (
                CollQuizProctoringLog.objects
                .filter(link_mastermind_coll_quiz_session_id=session_id, is_active=True)
                .aggregate(total=Sum('violation_severity_points'))['total']
            ) or 0
            threshold = get_session_threshold(quiz_id)
            new_status = _compute_status(new_total, threshold)

            CollQuizSession.objects.filter(
                mastermind_coll_quiz_session_id=session_id,
            ).update(
                session_proctoring_score=new_total,
                session_proctoring_status_code=new_status,
            )
    except Exception:
        logger.exception('Failed to forgive violation %s', violation_id)
        return {'success': False, 'error': 'Server error.'}

    return {
        'success': True,
        'session_score': new_total,
        'status': new_status,
    }
