"""Messenger API — conversation list, send/receive messages, read receipts, typing."""

import json
from amolnama_news.site_apps.core.utils import get_user_profile_id as _get_user_profile_id
import logging

from django.contrib.auth.decorators import login_required
from django.db import connection
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

from .models import Conversation, ConversationParticipant, Message, MessageDeletion, TypingIndicator

logger = logging.getLogger(__name__)



def _is_blocked(user_profile_id_1, user_profile_id_2):
    """Check if either user has blocked the other."""
    from amolnama_news.site_apps.social.models import UserBlock
    return UserBlock.objects.filter(
        Q(link_blocker_user_profile_id=user_profile_id_1, link_blocked_user_profile_id=user_profile_id_2) |
        Q(link_blocker_user_profile_id=user_profile_id_2, link_blocked_user_profile_id=user_profile_id_1),
        is_active=True,
    ).exists()


def _get_other_participant_info(conversation_id, current_user_profile_id):
    """Get the other user's display info for a direct conversation."""
    other_participant = ConversationParticipant.objects.filter(
        link_conversation_id=conversation_id, is_active=True,
    ).exclude(link_user_profile_id=current_user_profile_id).first()

    if not other_participant:
        return None

    from amolnama_news.site_apps.user_account.models import UserProfile
    from amolnama_news.site_apps.core.utils import get_user_avatar_url
    try:
        profile = UserProfile.objects.get(user_profile_id=other_participant.link_user_profile_id)
        return {
            'user_profile_id': profile.user_profile_id,
            'display_name': profile.display_name or 'Unknown',
            'username_handle': profile.username_handle or '',
            'avatar_url': get_user_avatar_url(profile),
        }
    except UserProfile.DoesNotExist:
        return None


# =========================================================
# CONVERSATION LIST
# =========================================================

@login_required
def api_unread_count(request):
    """GET — total unread message count across all conversations. Polled by sidebar."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': True, 'unread_count': 0})

    from django.db.models import Sum
    total = ConversationParticipant.objects.filter(
        link_user_profile_id=user_profile_id, is_active=True,
    ).aggregate(total=Sum('unread_count'))['total'] or 0

    return JsonResponse({'success': True, 'unread_count': total})


@login_required
def api_conversation_list(request):
    """GET — list current user's conversations with last message and unread count."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    participants = ConversationParticipant.objects.filter(
        link_user_profile_id=user_profile_id, is_active=True,
    ).values_list('link_conversation_id', 'unread_count', 'is_pinned', 'is_muted')

    conversation_ids = [row[0] for row in participants]
    participant_map = {row[0]: {'unread_count': row[1], 'is_pinned': row[2], 'is_muted': row[3]} for row in participants}

    conversations = Conversation.objects.filter(
        messenger_conversation_id__in=conversation_ids, is_active=True,
    ).order_by('-last_message_at')

    results = []
    for conversation in conversations:
        other_user = _get_other_participant_info(conversation.messenger_conversation_id, user_profile_id)
        participant_data = participant_map.get(conversation.messenger_conversation_id, {})

        results.append({
            'conversation_id': conversation.messenger_conversation_id,
            'conversation_type_code': conversation.conversation_type_code,
            'title': conversation.conversation_title if conversation.conversation_type_code == 'group' else (other_user['display_name'] if other_user else 'Unknown'),
            'avatar_url': other_user['avatar_url'] if other_user else '',
            'other_user_profile_id': other_user['user_profile_id'] if other_user else None,
            'other_username_handle': other_user['username_handle'] if other_user else '',
            'last_message_text': conversation.last_message_text or '',
            'last_message_at': conversation.last_message_at.isoformat() if conversation.last_message_at else '',
            'unread_count': participant_data.get('unread_count', 0),
            'is_pinned': participant_data.get('is_pinned', False),
            'is_muted': participant_data.get('is_muted', False),
        })

    # Sort: pinned first, then by last_message_at
    results.sort(key=lambda conversation_item: (not conversation_item['is_pinned'], conversation_item['last_message_at'] or ''), reverse=False)
    results.sort(key=lambda conversation_item: conversation_item['is_pinned'], reverse=True)

    return JsonResponse({'success': True, 'conversations': results})


# =========================================================
# START / FIND CONVERSATION
# =========================================================

@require_POST
@login_required
def api_conversation_start(request):
    """POST — start a new direct conversation or return existing one."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    other_user_profile_id = data.get('other_user_profile_id')
    if not other_user_profile_id or other_user_profile_id == user_profile_id:
        return JsonResponse({'success': False, 'error': 'Invalid recipient'}, status=400)

    # Block check
    if _is_blocked(user_profile_id, other_user_profile_id):
        return JsonResponse({'success': False, 'error': 'এই ব্যবহারকারীকে মেসেজ পাঠানো যাচ্ছে না'}, status=403)

    # Check if conversation already exists between these two users
    existing_conversation_ids = set(
        ConversationParticipant.objects.filter(
            link_user_profile_id=user_profile_id, is_active=True,
        ).values_list('link_conversation_id', flat=True)
    )
    other_conversation_ids = set(
        ConversationParticipant.objects.filter(
            link_user_profile_id=other_user_profile_id, is_active=True,
        ).values_list('link_conversation_id', flat=True)
    )
    shared_conversation_ids = existing_conversation_ids & other_conversation_ids

    if shared_conversation_ids:
        # Find direct conversation (not group)
        existing = Conversation.objects.filter(
            messenger_conversation_id__in=shared_conversation_ids,
            conversation_type_code='direct', is_active=True,
        ).first()
        if existing:
            return JsonResponse({'success': True, 'conversation_id': existing.messenger_conversation_id, 'is_new': False})

    # Create new conversation
    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [messenger].[conversation] ([conversation_type_code], [link_created_by_user_profile_id])
            OUTPUT INSERTED.messenger_conversation_id
            VALUES (%s, %s)
        """, ['direct', user_profile_id])
        conversation_id = cursor.fetchone()[0]

        # Add both participants
        cursor.execute("""
            INSERT INTO [messenger].[conversation_participant] ([link_conversation_id], [link_user_profile_id], [participant_role_code])
            VALUES (%s, %s, %s)
        """, [conversation_id, user_profile_id, 'member'])
        cursor.execute("""
            INSERT INTO [messenger].[conversation_participant] ([link_conversation_id], [link_user_profile_id], [participant_role_code])
            VALUES (%s, %s, %s)
        """, [conversation_id, other_user_profile_id, 'member'])

    return JsonResponse({'success': True, 'conversation_id': conversation_id, 'is_new': True})


# =========================================================
# MESSAGES — FETCH + SEND
# =========================================================

@login_required
def api_message_list(request, conversation_id):
    """GET — fetch messages for a conversation. Paginated, newest first.
    ?before=<message_id> for loading older messages (scroll up)."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    # Verify user is participant
    is_participant = ConversationParticipant.objects.filter(
        link_conversation_id=conversation_id, link_user_profile_id=user_profile_id, is_active=True,
    ).exists()
    if not is_participant:
        return JsonResponse({'success': False, 'error': 'এই কথোপকথনে আপনি অংশগ্রহণকারী নন'}, status=403)

    # Get messages user hasn't deleted for themselves
    deleted_message_ids = set(MessageDeletion.objects.filter(
        link_user_profile_id=user_profile_id,
    ).values_list('link_message_id', flat=True))

    messages_query = Message.objects.filter(
        link_conversation_id=conversation_id, is_active=True,
    ).exclude(messenger_message_id__in=deleted_message_ids)

    # Cursor-based pagination: load older messages before a given message ID
    before_message_id = request.GET.get('before')
    if before_message_id:
        try:
            before_message_id = int(before_message_id)
            messages_query = messages_query.filter(messenger_message_id__lt=before_message_id)
        except (ValueError, TypeError):
            pass

    messages = messages_query.order_by('-created_at')[:30]

    results = []
    for message in reversed(list(messages)):  # Reverse to show oldest first
        results.append({
            'message_id': message.messenger_message_id,
            'sender_user_profile_id': message.link_sender_user_profile_id,
            'message_text': message.message_text if not message.is_deleted_for_everyone else '',
            'content_type_code': message.content_type_code,
            'message_status_code': message.message_status_code,
            'is_deleted_for_everyone': message.is_deleted_for_everyone,
            'is_edited': message.is_edited,
            'is_system_message': message.is_system_message,
            'reply_to_message_id': message.link_reply_to_message_id,
            'created_at': message.created_at.isoformat() if message.created_at else '',
        })

    has_more = messages_query.count() > 30

    return JsonResponse({'success': True, 'messages': results, 'has_more': has_more})


@require_POST
@login_required
def api_message_send(request, conversation_id):
    """POST — send a message. Returns the created message for optimistic UI confirmation."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    # Verify participant
    is_participant = ConversationParticipant.objects.filter(
        link_conversation_id=conversation_id, link_user_profile_id=user_profile_id, is_active=True,
    ).exists()
    if not is_participant:
        return JsonResponse({'success': False, 'error': 'এই কথোপকথনে আপনি অংশগ্রহণকারী নন'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    message_text = (data.get('message_text') or '').strip()
    if not message_text:
        return JsonResponse({'success': False, 'error': 'মেসেজ খালি হতে পারে না'}, status=400)

    if len(message_text) > 4000:
        return JsonResponse({'success': False, 'error': 'মেসেজ ৪০০০ অক্ষরের বেশি হতে পারে না'}, status=400)

    reply_to_message_id = data.get('reply_to_message_id') or None

    # Block check — get other participant
    other_participant = ConversationParticipant.objects.filter(
        link_conversation_id=conversation_id, is_active=True,
    ).exclude(link_user_profile_id=user_profile_id).first()

    if other_participant and _is_blocked(user_profile_id, other_participant.link_user_profile_id):
        return JsonResponse({'success': False, 'error': 'এই ব্যবহারকারীকে মেসেজ পাঠানো যাচ্ছে না'}, status=403)

    # Insert message
    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [messenger].[message]
                ([link_conversation_id], [link_sender_user_profile_id], [message_text], [link_reply_to_message_id])
            OUTPUT INSERTED.messenger_message_id, INSERTED.created_at
            VALUES (%s, %s, %s, %s)
        """, [conversation_id, user_profile_id, message_text, reply_to_message_id])
        row = cursor.fetchone()
        message_id = row[0]
        created_at = row[1]

        # Update conversation denormalized fields
        cursor.execute("""
            UPDATE [messenger].[conversation]
            SET [last_message_text] = %s, [last_message_at] = %s, [last_message_sender_user_profile_id] = %s
            WHERE [messenger_conversation_id] = %s
        """, [message_text[:500], created_at, user_profile_id, conversation_id])

        # Increment unread count for all other participants
        cursor.execute("""
            UPDATE [messenger].[conversation_participant]
            SET [unread_count] = [unread_count] + 1
            WHERE [link_conversation_id] = %s AND [link_user_profile_id] != %s AND [is_active] = 1
        """, [conversation_id, user_profile_id])

    # Send notification to other participant (background)
    if other_participant:
        try:
            from amolnama_news.site_apps.newsengine.notifications import create_notification
            from amolnama_news.site_apps.user_account.models import UserProfile
            sender_profile = UserProfile.objects.get(user_profile_id=user_profile_id)
            sender_name = sender_profile.display_name or 'কেউ'
            create_notification(
                recipient_user_profile_id=other_participant.link_user_profile_id,
                actor_user_profile_id=user_profile_id,
                event_code='new_message',
                source_app='messenger',
                content_id=message_id,
                message=f'{sender_name}: {message_text[:100]}',
                url=f'/messenger/?conversation={conversation_id}',
            )
        except Exception:
            logger.exception('Failed to send message notification')

    return JsonResponse({
        'success': True,
        'message_id': message_id,
        'created_at': created_at.isoformat() if created_at else '',
    })


# =========================================================
# POLL — NEW MESSAGES SINCE TIMESTAMP
# =========================================================

@login_required
def api_message_poll(request, conversation_id):
    """GET ?after=<message_id> — get new messages since the given message ID."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    # Verify participant
    is_participant = ConversationParticipant.objects.filter(
        link_conversation_id=conversation_id, link_user_profile_id=user_profile_id, is_active=True,
    ).exists()
    if not is_participant:
        return JsonResponse({'success': True, 'messages': []})

    after_message_id = request.GET.get('after', '0')
    try:
        after_message_id = int(after_message_id)
    except (ValueError, TypeError):
        after_message_id = 0

    deleted_message_ids = set(MessageDeletion.objects.filter(
        link_user_profile_id=user_profile_id,
    ).values_list('link_message_id', flat=True))

    new_messages = Message.objects.filter(
        link_conversation_id=conversation_id,
        messenger_message_id__gt=after_message_id,
        is_active=True,
    ).exclude(
        messenger_message_id__in=deleted_message_ids,
    ).order_by('created_at')[:50]

    results = []
    for message in new_messages:
        results.append({
            'message_id': message.messenger_message_id,
            'sender_user_profile_id': message.link_sender_user_profile_id,
            'message_text': message.message_text if not message.is_deleted_for_everyone else '',
            'content_type_code': message.content_type_code,
            'message_status_code': message.message_status_code,
            'is_deleted_for_everyone': message.is_deleted_for_everyone,
            'is_edited': message.is_edited,
            'is_system_message': message.is_system_message,
            'reply_to_message_id': message.link_reply_to_message_id,
            'created_at': message.created_at.isoformat() if message.created_at else '',
        })

    return JsonResponse({'success': True, 'messages': results})


# =========================================================
# MARK AS READ
# =========================================================

@require_POST
@login_required
def api_message_mark_read(request, conversation_id):
    """POST — mark all messages in conversation as read for current user."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    now = timezone.now()

    with connection.cursor() as cursor:
        # Update unread messages sent by others → mark as read
        cursor.execute("""
            UPDATE [messenger].[message]
            SET [message_status_code] = 'read', [read_at] = %s
            WHERE [link_conversation_id] = %s
              AND [link_sender_user_profile_id] != %s
              AND [message_status_code] != 'read'
              AND [is_active] = 1
        """, [now, conversation_id, user_profile_id])

        # Reset unread count for this participant
        cursor.execute("""
            UPDATE [messenger].[conversation_participant]
            SET [unread_count] = 0
            WHERE [link_conversation_id] = %s AND [link_user_profile_id] = %s
        """, [conversation_id, user_profile_id])

    return JsonResponse({'success': True})


# =========================================================
# TYPING INDICATOR
# =========================================================

@require_POST
@login_required
def api_typing_indicator(request, conversation_id):
    """POST — update typing indicator for current user."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': True})

    now = timezone.now()

    # Upsert typing indicator
    with connection.cursor() as cursor:
        cursor.execute("""
            MERGE [messenger].[typing_indicator] AS target
            USING (SELECT %s AS link_conversation_id, %s AS link_user_profile_id) AS source
            ON target.[link_conversation_id] = source.[link_conversation_id]
               AND target.[link_user_profile_id] = source.[link_user_profile_id]
            WHEN MATCHED THEN UPDATE SET [last_typed_at] = %s
            WHEN NOT MATCHED THEN INSERT ([link_conversation_id], [link_user_profile_id], [last_typed_at])
                VALUES (source.[link_conversation_id], source.[link_user_profile_id], %s);
        """, [conversation_id, user_profile_id, now, now])

    return JsonResponse({'success': True})


@login_required
def api_typing_status(request, conversation_id):
    """GET — check if other user is typing (last 5 seconds)."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': True, 'is_typing': False})

    five_seconds_ago = timezone.now() - timezone.timedelta(seconds=5)

    typing_user = TypingIndicator.objects.filter(
        link_conversation_id=conversation_id,
        last_typed_at__gte=five_seconds_ago,
    ).exclude(link_user_profile_id=user_profile_id).first()

    is_typing = typing_user is not None

    return JsonResponse({'success': True, 'is_typing': is_typing})


# =========================================================
# DELETE MESSAGE
# =========================================================

@require_POST
@login_required
def api_message_delete_for_me(request, conversation_id, message_id):
    """POST — delete a message for the current user only."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    # Verify participant
    if not ConversationParticipant.objects.filter(
        link_conversation_id=conversation_id, link_user_profile_id=user_profile_id, is_active=True,
    ).exists():
        return JsonResponse({'success': False, 'error': 'অনুমতি নেই'}, status=403)

    # Insert deletion record
    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [messenger].[message_deletion] ([link_message_id], [link_user_profile_id])
            VALUES (%s, %s)
        """, [message_id, user_profile_id])

    return JsonResponse({'success': True})


@require_POST
@login_required
def api_message_delete_for_everyone(request, conversation_id, message_id):
    """POST — delete a message for everyone. Only sender, within 1 hour."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    message = Message.objects.filter(
        messenger_message_id=message_id, link_conversation_id=conversation_id,
        link_sender_user_profile_id=user_profile_id, is_active=True,
    ).first()

    if not message:
        return JsonResponse({'success': False, 'error': 'মেসেজ পাওয়া যায়নি বা অনুমতি নেই'}, status=404)

    # Check time limit (1 hour)
    if (timezone.now() - message.created_at).total_seconds() > 3600:
        return JsonResponse({'success': False, 'error': '১ ঘণ্টার বেশি সময় হয়ে গেছে — মুছে ফেলা যাবে না'}, status=400)

    with connection.cursor() as cursor:
        cursor.execute("""
            UPDATE [messenger].[message]
            SET [is_deleted_for_everyone] = 1, [deleted_for_everyone_at] = %s
            WHERE [messenger_message_id] = %s
        """, [timezone.now(), message_id])

    return JsonResponse({'success': True})


# =========================================================
# EDIT MESSAGE
# =========================================================

@require_POST
@login_required
def api_message_edit(request, conversation_id, message_id):
    """POST — edit a message. Only sender, within 15 minutes."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    new_text = (data.get('message_text') or '').strip()
    if not new_text:
        return JsonResponse({'success': False, 'error': 'মেসেজ খালি হতে পারে না'}, status=400)

    message = Message.objects.filter(
        messenger_message_id=message_id, link_conversation_id=conversation_id,
        link_sender_user_profile_id=user_profile_id, is_active=True,
        is_deleted_for_everyone=False,
    ).first()

    if not message:
        return JsonResponse({'success': False, 'error': 'মেসেজ পাওয়া যায়নি বা অনুমতি নেই'}, status=404)

    # Check time limit (15 minutes)
    if (timezone.now() - message.created_at).total_seconds() > 900:
        return JsonResponse({'success': False, 'error': '১৫ মিনিটের বেশি সময় হয়ে গেছে — সম্পাদনা করা যাবে না'}, status=400)

    with connection.cursor() as cursor:
        cursor.execute("""
            UPDATE [messenger].[message]
            SET [message_text] = %s, [is_edited] = 1, [edited_at] = %s
            WHERE [messenger_message_id] = %s
        """, [new_text, timezone.now(), message_id])

    return JsonResponse({'success': True})


# =========================================================
# PIN / MUTE CONVERSATION
# =========================================================

@require_POST
@login_required
def api_conversation_pin(request, conversation_id):
    """POST — toggle pin on a conversation."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    participant = ConversationParticipant.objects.filter(
        link_conversation_id=conversation_id, link_user_profile_id=user_profile_id, is_active=True,
    ).first()
    if not participant:
        return JsonResponse({'success': False, 'error': 'কথোপকথন পাওয়া যায়নি'}, status=404)

    new_value = not participant.is_pinned
    with connection.cursor() as cursor:
        cursor.execute("""
            UPDATE [messenger].[conversation_participant]
            SET [is_pinned] = %s
            WHERE [messenger_conversation_participant_id] = %s
        """, [new_value, participant.messenger_conversation_participant_id])

    return JsonResponse({'success': True, 'is_pinned': new_value})


@require_POST
@login_required
def api_conversation_mute(request, conversation_id):
    """POST — toggle mute on a conversation."""
    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    participant = ConversationParticipant.objects.filter(
        link_conversation_id=conversation_id, link_user_profile_id=user_profile_id, is_active=True,
    ).first()
    if not participant:
        return JsonResponse({'success': False, 'error': 'কথোপকথন পাওয়া যায়নি'}, status=404)

    new_value = not participant.is_muted
    with connection.cursor() as cursor:
        cursor.execute("""
            UPDATE [messenger].[conversation_participant]
            SET [is_muted] = %s
            WHERE [messenger_conversation_participant_id] = %s
        """, [new_value, participant.messenger_conversation_participant_id])

    return JsonResponse({'success': True, 'is_muted': new_value})
