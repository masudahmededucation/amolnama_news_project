"""Global notification helper — creates notifications from any app.
All apps call create_notification() to notify users about events."""

import logging

from django.db import connection

logger = logging.getLogger(__name__)


def create_notification(recipient_user_profile_id, actor_user_profile_id, event_code, source_app,
                        content_id=None, message='', url=None):
    """Create a global notification. Called from any app via background thread.
    Won't notify yourself (actor == recipient is silently skipped)."""
    if not recipient_user_profile_id or recipient_user_profile_id == actor_user_profile_id:
        return

    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [newsengine].[notification_item]
                    ([link_recipient_user_profile_id], [link_actor_user_profile_id],
                     [notification_event_code], [notification_source_app],
                     [link_notification_content_id], [notification_message], [notification_url])
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, [
                recipient_user_profile_id, actor_user_profile_id,
                event_code, source_app,
                content_id, message, url,
            ])
    except Exception:
        logger.exception('Failed to create notification for user %s', recipient_user_profile_id)

    # Broadcast via WebSocket to the recipient
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer:
            unread_count = get_unread_count(recipient_user_profile_id)
            async_to_sync(channel_layer.group_send)(
                f'notifications_user_{recipient_user_profile_id}',
                {
                    'type': 'new_notification',
                    'notification': {
                        'event_code': event_code,
                        'source_app': source_app,
                        'message': message,
                        'url': url or '',
                    },
                    'unread_count': unread_count,
                }
            )
    except Exception:
        logger.exception('WebSocket broadcast failed for notification to user %s', recipient_user_profile_id)


def get_unread_count(user_profile_id):
    """Get unread notification count for a user."""
    if not user_profile_id:
        return 0
    from .models import NotificationItem
    return NotificationItem.objects.filter(
        link_recipient_user_profile_id=user_profile_id,
        is_read=False, is_active=True,
    ).count()


def get_notifications_list(user_profile_id, limit=20):
    """Get latest notifications for a user."""
    if not user_profile_id:
        return []
    from .models import NotificationItem
    notifications = NotificationItem.objects.filter(
        link_recipient_user_profile_id=user_profile_id,
        is_active=True,
    ).order_by('-created_at')[:limit]

    return [{
        'notification_id': notification.newsengine_notification_item_id,
        'event_code': notification.notification_event_code,
        'source_app': notification.notification_source_app,
        'message': notification.notification_message,
        'url': notification.notification_url or '',
        'is_read': notification.is_read,
        'created_at': notification.created_at.strftime('%d %b %Y, %I:%M %p') if notification.created_at else '',
    } for notification in notifications]


def mark_all_read(user_profile_id):
    """Mark all notifications as read for a user."""
    if not user_profile_id:
        return
    from django.utils import timezone
    from .models import NotificationItem
    NotificationItem.objects.filter(
        link_recipient_user_profile_id=user_profile_id,
        is_read=False, is_active=True,
    ).update(is_read=True, read_at=timezone.now())
