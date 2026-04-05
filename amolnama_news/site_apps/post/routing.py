"""Post feed WebSocket URL routing — live new posts indicator."""
from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path('ws/feed/', consumers.FeedConsumer.as_asgi()),
]
