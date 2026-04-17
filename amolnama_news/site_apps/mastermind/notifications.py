"""Mastermind notifications — email triggers for quiz lifecycle events.

Soft-fail design: every public function logs + returns early if email is
disabled or unconfigured, so callers never have to wrap in try/except.
Activates automatically once EMAIL_BACKEND + DEFAULT_FROM_EMAIL are set in
settings/base.py and MASTERMIND_NOTIFICATIONS_ENABLED is True.

All sends run via newsengine.utils.run_background_task — never blocking the
request thread.

Public events:
  notify_quiz_results_ready(session_id)
  notify_quiz_creator_permission_granted(permission_id)
  notify_ai_generation_completed(generation_job_id)
"""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


# ================================================================
# Soft-fail send wrapper
# ================================================================

def _send_mail_safely(subject, body, recipient_email):
    """Single source of truth for actually putting an email on the wire.

    Returns True on success, False on misconfiguration / failure. Never
    raises — callers can fire-and-forget.
    """
    if not getattr(settings, 'MASTERMIND_NOTIFICATIONS_ENABLED', False):
        logger.info('Mastermind notifications disabled (skipped: %s)', subject)
        return False

    if not recipient_email:
        logger.info('No recipient email — skipping notification: %s', subject)
        return False

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None)
    if not from_email:
        logger.warning('DEFAULT_FROM_EMAIL not set — skipping notification: %s', subject)
        return False

    try:
        from django.core.mail import send_mail
        send_mail(
            subject=subject,
            message=body,
            from_email=from_email,
            recipient_list=[recipient_email],
            fail_silently=False,
        )
        return True
    except Exception:
        logger.exception('Mastermind notification send failed: %s -> %s', subject, recipient_email)
        return False


def _resolve_user_email(user_profile_id):
    """Look up the User account email for a UserProfile id. Returns str or None."""
    if not user_profile_id:
        return None
    try:
        from amolnama_news.site_apps.user_account.models import UserProfile
        profile = (
            UserProfile.objects
            .filter(user_profile_id=user_profile_id)
            .select_related('link_user_account_user')
            .first()
        )
        if profile and profile.link_user_account_user:
            return profile.link_user_account_user.email
    except Exception:
        logger.exception('Failed to resolve email for user_profile_id=%s', user_profile_id)
    return None


# ================================================================
# Public event triggers — call from request flows
# ================================================================

def notify_quiz_results_ready(session_id):
    """Email the student that their quiz session has been graded."""
    if not session_id:
        return
    _enqueue(_send_quiz_results_email, session_id)


def notify_quiz_creator_permission_granted(permission_id):
    """Email a non-staff user that they have been granted quiz creation rights."""
    if not permission_id:
        return
    _enqueue(_send_quiz_creator_permission_email, permission_id)


def notify_ai_generation_completed(generation_job_id):
    """Email the staff member who started an AI generation job that it finished."""
    if not generation_job_id:
        return
    _enqueue(_send_ai_generation_completed_email, generation_job_id)


# ================================================================
# Background dispatch — wraps newsengine.run_background_task
# ================================================================

def _enqueue(handler_function, *handler_args):
    """Dispatch a notification handler off the request thread."""
    try:
        from amolnama_news.site_apps.newsengine.utils import run_background_task
        run_background_task(handler_function, *handler_args)
    except Exception:
        # Fallback: still try inline so a missing util never silently drops mails
        logger.exception('Falling back to inline notification dispatch')
        try:
            handler_function(*handler_args)
        except Exception:
            logger.exception('Inline notification dispatch also failed')


# ================================================================
# Per-event handlers — pure functions, no request access
# ================================================================

def _send_quiz_results_email(session_id):
    from .models import CollQuiz, CollQuizSession

    session = CollQuizSession.objects.filter(mastermind_coll_quiz_session_id=session_id).first()
    if not session:
        return
    quiz = CollQuiz.objects.filter(mastermind_coll_quiz_id=session.link_mastermind_coll_quiz_id).first()
    if not quiz:
        return

    recipient_email = _resolve_user_email(session.link_user_profile_id)
    quiz_title = quiz.exam_title_en or quiz.exam_title_bn or f'Quiz #{quiz.mastermind_coll_quiz_id}'
    score_percentage = float(session.session_score_percentage) if session.session_score_percentage is not None else None
    pass_text = 'Passed' if session.session_is_passed else ('Did not pass' if session.session_is_passed is False else 'Result pending')

    subject = f'Your quiz results are ready: {quiz_title}'
    body_lines = [
        f'Hello,',
        '',
        f'Your results for "{quiz_title}" are now available.',
        '',
        f'Score: {score_percentage:.1f}%' if score_percentage is not None else 'Score: pending',
        f'Status: {pass_text}',
        f'Questions correct: {session.session_total_correct} / {session.session_total_questions}',
        '',
        'You can review your answers and explanations on the quiz page.',
        '',
        '— Mastermind, Amolnama News',
    ]
    _send_mail_safely(subject, '\n'.join(body_lines), recipient_email)


def _send_quiz_creator_permission_email(permission_id):
    from .models import CollQuizCreatorPermission

    permission = CollQuizCreatorPermission.objects.filter(
        mastermind_coll_quiz_creator_permission_id=permission_id, is_active=True,
    ).first()
    if not permission:
        return

    recipient_email = _resolve_user_email(permission.link_user_profile_id)
    expiry_text = (
        permission.expires_at.strftime('%Y-%m-%d') if permission.expires_at else 'no expiry'
    )

    subject = 'You can now create quizzes on Amolnama'
    body_lines = [
        'Hello,',
        '',
        'A staff member has granted you permission to create quizzes on the Mastermind quiz platform.',
        '',
        f'Permission status: {permission.permission_status_code}',
        f'Expires: {expiry_text}',
        '',
        'Visit the Quiz Panel to start creating quizzes.',
        '',
        '— Mastermind, Amolnama News',
    ]
    _send_mail_safely(subject, '\n'.join(body_lines), recipient_email)


def _send_ai_generation_completed_email(generation_job_id):
    from .models import CollGenerationJob

    job = CollGenerationJob.objects.filter(mastermind_coll_generation_job_id=generation_job_id).first()
    if not job:
        return

    recipient_email = _resolve_user_email(job.link_started_by_user_profile_id)
    book_label = f'Book #{job.link_mastermind_coll_book_id}' if job.link_mastermind_coll_book_id else 'unknown book'
    questions_generated = getattr(job, 'job_questions_generated', None)
    questions_text = (
        f'{questions_generated} question(s) ready for review' if questions_generated is not None
        else 'Questions are ready for review'
    )

    subject = f'AI question generation finished — {book_label}'
    body_lines = [
        'Hello,',
        '',
        f'The AI question generation job for {book_label} has finished.',
        '',
        f'Status: {job.job_status_code}',
        questions_text,
        '',
        'Review them in the Quiz Panel review queue when you have a moment.',
        '',
        '— Mastermind, Amolnama News',
    ]
    _send_mail_safely(subject, '\n'.join(body_lines), recipient_email)
