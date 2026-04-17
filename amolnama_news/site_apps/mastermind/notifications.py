"""Mastermind notifications — in-house, free, zero third-party dependencies.

Two delivery channels per event:
  1. Pulse notification badge on the user's homepage (newsengine.NotificationItem,
     real-time via WebSocket if Channels is configured).
  2. Direct message in the messenger inbox from a designated system sender
     account (skipped if MASTERMIND_SYSTEM_SENDER_PROFILE_ID is not set).

Both channels are soft-fail: a delivery error logs but never raises, so the
parent flow (quiz submit, permission grant, AI gen complete) is never blocked.

All sends run via newsengine.utils.run_background_task — never blocking the
request thread.

Public events:
  notify_quiz_results_ready(session_id)
  notify_quiz_creator_permission_granted(permission_id)
  notify_ai_generation_completed(generation_job_id)
"""
import logging

from django.conf import settings
from django.db import connection

logger = logging.getLogger(__name__)


# ================================================================
# Public event triggers — call from request flows
# ================================================================

def notify_quiz_results_ready(session_id):
    """Notify a student that their quiz session has been graded."""
    if not session_id:
        return
    _enqueue(_deliver_quiz_results, session_id)


def notify_quiz_creator_permission_granted(permission_id):
    """Notify a non-staff user that they have been granted quiz creation rights."""
    if not permission_id:
        return
    _enqueue(_deliver_quiz_creator_permission, permission_id)


def notify_ai_generation_completed(generation_job_id):
    """Notify the staff member who started an AI generation job that it finished."""
    if not generation_job_id:
        return
    _enqueue(_deliver_ai_generation_completed, generation_job_id)


# ================================================================
# Background dispatch — wraps newsengine.run_background_task
# ================================================================

def _enqueue(handler_function, *handler_args):
    """Dispatch a notification handler off the request thread."""
    try:
        from amolnama_news.site_apps.newsengine.utils import run_background_task
        run_background_task(handler_function, *handler_args)
    except Exception:
        logger.exception('Falling back to inline notification dispatch')
        try:
            handler_function(*handler_args)
        except Exception:
            logger.exception('Inline notification dispatch also failed')


# ================================================================
# Per-event handlers — pure functions, no request access
# ================================================================

def _deliver_quiz_results(session_id):
    from .models import CollQuiz, CollQuizSession

    session = CollQuizSession.objects.filter(mastermind_coll_quiz_session_id=session_id).first()
    if not session:
        return
    quiz = CollQuiz.objects.filter(mastermind_coll_quiz_id=session.link_mastermind_coll_quiz_id).first()
    if not quiz:
        return

    quiz_title = quiz.exam_title_bn or quiz.exam_title_en or f'Quiz #{quiz.mastermind_coll_quiz_id}'
    score_percentage = (
        f'{float(session.session_score_percentage):.1f}%'
        if session.session_score_percentage is not None else 'pending'
    )
    pass_text = (
        'উত্তীর্ণ' if session.session_is_passed
        else ('অনুত্তীর্ণ' if session.session_is_passed is False else 'ফলাফল প্রক্রিয়াধীন')
    )

    pulse_message = f'কুইজ ফলাফল প্রস্তুত: {quiz_title} — {score_percentage}'
    dm_message = (
        f'আপনার কুইজ "{quiz_title}" এর ফলাফল প্রস্তুত।\n\n'
        f'স্কোর: {score_percentage}\n'
        f'অবস্থা: {pass_text}\n'
        f'সঠিক উত্তর: {session.session_total_correct} / {session.session_total_questions}\n\n'
        f'বিস্তারিত দেখতে কুইজ পেজে যান।'
    )
    target_url = f'/quizadmin/quiz/{quiz.mastermind_coll_quiz_id}/leaderboard/'

    _send_pulse_notification(
        recipient_user_profile_id=session.link_user_profile_id,
        event_code='quiz_results_ready',
        message=pulse_message,
        url=target_url,
        content_id=session.mastermind_coll_quiz_session_id,
    )
    _send_system_direct_message(
        recipient_user_profile_id=session.link_user_profile_id,
        message_text=dm_message,
    )


def _deliver_quiz_creator_permission(permission_id):
    from .models import CollQuizCreatorPermission

    permission = CollQuizCreatorPermission.objects.filter(
        mastermind_coll_quiz_creator_permission_id=permission_id, is_active=True,
    ).first()
    if not permission:
        return

    expiry_text = (
        permission.expires_at.strftime('%Y-%m-%d') if permission.expires_at else 'কোনো মেয়াদ নেই'
    )
    pulse_message = 'আপনি এখন কুইজ তৈরি করতে পারবেন!'
    dm_message = (
        'অভিনন্দন! একজন স্টাফ আপনাকে আমলনামার Mastermind প্ল্যাটফর্মে কুইজ তৈরি করার অনুমতি দিয়েছেন।\n\n'
        f'অবস্থা: {permission.permission_status_code}\n'
        f'মেয়াদ শেষ: {expiry_text}\n\n'
        'কুইজ তৈরি শুরু করতে Quiz Panel এ যান।'
    )
    target_url = '/quizadmin/'

    _send_pulse_notification(
        recipient_user_profile_id=permission.link_user_profile_id,
        event_code='quiz_creator_permission_granted',
        message=pulse_message,
        url=target_url,
        content_id=permission.mastermind_coll_quiz_creator_permission_id,
    )
    _send_system_direct_message(
        recipient_user_profile_id=permission.link_user_profile_id,
        message_text=dm_message,
    )


def _deliver_ai_generation_completed(generation_job_id):
    from .models import CollGenerationJob

    job = CollGenerationJob.objects.filter(mastermind_coll_generation_job_id=generation_job_id).first()
    if not job:
        return

    book_label = (
        f'Book #{job.link_mastermind_coll_book_id}' if job.link_mastermind_coll_book_id else 'unknown book'
    )
    questions_created = getattr(job, 'generation_questions_created', None)
    questions_text = (
        f'{questions_created} টি প্রশ্ন রিভিউয়ের জন্য প্রস্তুত'
        if questions_created is not None else 'প্রশ্ন রিভিউয়ের জন্য প্রস্তুত'
    )
    pulse_message = f'AI প্রশ্ন প্রজন্ম সম্পূর্ণ ({book_label}) — {questions_text}'
    dm_message = (
        f'{book_label} এর জন্য AI প্রশ্ন প্রজন্মের কাজ সম্পূর্ণ হয়েছে।\n\n'
        f'অবস্থা: {job.generation_status_code}\n'
        f'{questions_text}\n\n'
        'Quiz Panel এর review queue থেকে রিভিউ করুন।'
    )
    target_url = '/quizadmin/review-queue/'

    _send_pulse_notification(
        recipient_user_profile_id=job.link_started_by_user_profile_id,
        event_code='ai_generation_completed',
        message=pulse_message,
        url=target_url,
        content_id=job.mastermind_coll_generation_job_id,
    )
    _send_system_direct_message(
        recipient_user_profile_id=job.link_started_by_user_profile_id,
        message_text=dm_message,
    )


# ================================================================
# Channel 1 — pulse notification (badge + WebSocket broadcast)
# ================================================================

def _send_pulse_notification(recipient_user_profile_id, event_code, message, url, content_id=None):
    """Insert a NotificationItem row + WebSocket broadcast. Soft-fail."""
    if not recipient_user_profile_id:
        return
    try:
        from amolnama_news.site_apps.newsengine.notifications import create_notification
        create_notification(
            recipient_user_profile_id=recipient_user_profile_id,
            actor_user_profile_id=None,  # system-issued, no human actor
            event_code=event_code,
            source_app='mastermind',
            content_id=content_id,
            message=(message or '')[:300],
            url=url,
        )
    except Exception:
        logger.exception('Mastermind pulse notification failed for user %s (event=%s)',
                         recipient_user_profile_id, event_code)


# ================================================================
# Channel 2 — direct message from system sender to recipient
# ================================================================

def _send_system_direct_message(recipient_user_profile_id, message_text):
    """Post a system message into a 1:1 conversation between system sender and recipient.

    Skipped silently when MASTERMIND_SYSTEM_SENDER_PROFILE_ID is unset — the
    pulse notification still goes through, so the user is never left in the dark.
    """
    if not recipient_user_profile_id or not message_text:
        return

    system_sender_profile_id = getattr(settings, 'MASTERMIND_SYSTEM_SENDER_PROFILE_ID', None)
    if not system_sender_profile_id:
        logger.info('MASTERMIND_SYSTEM_SENDER_PROFILE_ID unset — skipping system DM')
        return

    if int(system_sender_profile_id) == int(recipient_user_profile_id):
        return  # don't DM the system account itself

    try:
        conversation_id = _find_or_create_direct_conversation(
            system_sender_profile_id, recipient_user_profile_id,
        )
        if not conversation_id:
            return
        _insert_system_message(
            conversation_id=conversation_id,
            sender_profile_id=system_sender_profile_id,
            message_text=message_text,
        )
    except Exception:
        logger.exception('Mastermind system DM failed for user %s', recipient_user_profile_id)


def _find_or_create_direct_conversation(profile_a_id, profile_b_id):
    """Return the messenger_conversation_id for the 1:1 thread between two users.

    Reuses the existing conversation if one already exists; otherwise creates
    a new direct conversation + both participant rows in one transaction.
    """
    from amolnama_news.site_apps.messenger.models import Conversation, ConversationParticipant

    # Pull all conversations the system sender is part of, then look for one
    # that also has the recipient — that's the existing 1:1 thread to reuse.
    candidate_conversation_ids = list(
        ConversationParticipant.objects
        .filter(link_user_profile_id=profile_a_id, is_active=True)
        .values_list('link_conversation_id', flat=True)
    )
    matched = (
        ConversationParticipant.objects
        .filter(
            link_conversation_id__in=candidate_conversation_ids,
            link_user_profile_id=profile_b_id,
            is_active=True,
        )
        .values_list('link_conversation_id', flat=True)
        .first()
    )
    if matched:
        # Make sure it's a direct conversation (not group)
        is_direct = Conversation.objects.filter(
            messenger_conversation_id=matched,
            conversation_type_code='direct',
            is_active=True,
        ).exists()
        if is_direct:
            return matched

    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO [messenger].[conversation]
                ([conversation_type_code], [link_created_by_user_profile_id])
            OUTPUT INSERTED.messenger_conversation_id
            VALUES (%s, %s)
            """,
            ['direct', profile_a_id],
        )
        new_conversation_id = cursor.fetchone()[0]
        cursor.execute(
            """
            INSERT INTO [messenger].[conversation_participant]
                ([link_conversation_id], [link_user_profile_id], [participant_role_code])
            VALUES (%s, %s, %s), (%s, %s, %s)
            """,
            [new_conversation_id, profile_a_id, 'member',
             new_conversation_id, profile_b_id, 'member'],
        )
    return new_conversation_id


def _insert_system_message(conversation_id, sender_profile_id, message_text):
    """Write the message + bump conversation denorm + recipient unread counter."""
    from django.utils import timezone
    truncated_message_text = (message_text or '')[:4000]
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO [messenger].[message]
                ([link_conversation_id], [link_sender_user_profile_id], [message_text], [is_system_message])
            OUTPUT INSERTED.messenger_message_id, INSERTED.created_at
            VALUES (%s, %s, %s, %s)
            """,
            [conversation_id, sender_profile_id, truncated_message_text, 1],
        )
        message_id, created_at = cursor.fetchone()

        cursor.execute(
            """
            UPDATE [messenger].[conversation]
            SET    [last_message_text] = %s,
                   [last_message_at] = %s,
                   [last_message_sender_user_profile_id] = %s
            WHERE  [messenger_conversation_id] = %s
            """,
            [truncated_message_text[:500], created_at, sender_profile_id, conversation_id],
        )

        cursor.execute(
            """
            UPDATE [messenger].[conversation_participant]
            SET    [unread_count] = [unread_count] + 1
            WHERE  [link_conversation_id] = %s
            AND    [link_user_profile_id] != %s
            AND    [is_active] = 1
            """,
            [conversation_id, sender_profile_id],
        )

    # Best-effort live broadcast — uses the same group name the messenger app listens on
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f'messenger_conversation_{conversation_id}',
                {
                    'type': 'new_message',
                    'message': {
                        'message_id': message_id,
                        'sender_id': sender_profile_id,
                        'text': truncated_message_text,
                        'is_system_message': True,
                        'created_at': created_at.isoformat() if hasattr(created_at, 'isoformat') else str(created_at),
                    },
                },
            )
    except Exception:
        logger.exception('Messenger WebSocket broadcast failed for conversation %s', conversation_id)
