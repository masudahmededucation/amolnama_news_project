"""Messenger WebSocket consumer — real-time chat messages.

Replaces 3-second polling with persistent WebSocket connection.
Falls back to polling on client side if WebSocket fails.

Group name: messenger_conversation_{conversation_id}
"""
import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class MessengerConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for a single messenger conversation."""

    @database_sync_to_async
    def _is_conversation_participant(self, user, conversation_id):
        """Verify the authenticated user is an active participant in the conversation."""
        from .models import ConversationParticipant
        from amolnama_news.site_apps.user_account.models import UserProfile
        try:
            user_profile = UserProfile.objects.filter(link_user_account_user_id=user.pk).only('user_profile_id').first()
        except Exception:
            logger.exception('Failed to resolve user profile for messenger websocket')
            return False
        if not user_profile:
            return False
        return ConversationParticipant.objects.filter(
            link_conversation_id=conversation_id,
            link_user_profile_id=user_profile.user_profile_id,
            is_active=True,
        ).exists()

    async def connect(self):
        """Join the conversation group when WebSocket connects. Rejects non-participants."""
        user = self.scope['user']
        if not user.is_authenticated:
            await self.close()
            return

        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']

        is_participant = await self._is_conversation_participant(user, self.conversation_id)
        if not is_participant:
            await self.close()
            return

        self.group_name = f'messenger_conversation_{self.conversation_id}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        """Leave the conversation group on disconnect."""
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        """Handle incoming WebSocket messages (typing indicator, etc.)."""
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        message_type = data.get('type')

        if message_type == 'typing':
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'typing_indicator',
                    'user_id': self.scope['user'].pk,
                    'is_typing': data.get('is_typing', False),
                }
            )

    async def new_message(self, event):
        """Broadcast new message to all conversation participants."""
        await self.send(text_data=json.dumps({
            'type': 'new_message',
            'message': event['message'],
        }))

    async def typing_indicator(self, event):
        """Broadcast typing status to other participants."""
        if event['user_id'] != self.scope['user'].pk:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'is_typing': event['is_typing'],
            }))
