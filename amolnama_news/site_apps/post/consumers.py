"""Feed WebSocket consumer — live "new posts" indicator.

When a new post is created, broadcasts to the feed group.
Connected clients show "X new posts" pill at top of feed.
Falls back to polling on client side if WebSocket fails.

Group name: feed_global (all users share one feed channel)
"""
import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class FeedConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for live feed updates."""

    async def connect(self):
        """Join the global feed group when WebSocket connects."""
        self.group_name = 'feed_global'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        """Leave the feed group on disconnect."""
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def new_post(self, event):
        """Notify connected clients that a new post was created."""
        await self.send(text_data=json.dumps({
            'type': 'new_post',
            'post_id': event['post_id'],
            'author_display_name': event.get('author_display_name', ''),
            'timestamp': event.get('timestamp', ''),
        }))
