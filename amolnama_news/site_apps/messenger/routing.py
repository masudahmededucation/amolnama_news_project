"""Messenger WebSocket URL routing."""
from django.urls import path
from . import consumers
from . import consumers_call

websocket_urlpatterns = [
    path('ws/messenger/<int:conversation_id>/', consumers.MessengerConsumer.as_asgi()),
    path('ws/call/<int:call_id>/', consumers_call.CallSignalingConsumer.as_asgi()),
]
