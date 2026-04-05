"""Messenger WebSocket URL routing."""
from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path('ws/messenger/<int:conversation_id>/', consumers.MessengerConsumer.as_asgi()),
]
