"""Notification WebSocket consumer — real-time notification delivery.

Replaces 60-second polling with persistent WebSocket connection.
Falls back to polling on client side if WebSocket fails.

Group name: notifications_user_{user_id}
"""
import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for per-user notification delivery."""

    async def connect(self):
        """Join the user's notification group when WebSocket connects."""
        if not self.scope['user'].is_authenticated:
            await self.close()
            return

        self.user_id = self.scope['user'].pk
        self.group_name = f'notifications_user_{self.user_id}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        """Leave the user's notification group on disconnect."""
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def new_notification(self, event):
        """Push a new notification to the user."""
        await self.send(text_data=json.dumps({
            'type': 'new_notification',
            'notification': event['notification'],
            'unread_count': event.get('unread_count', 0),
        }))
