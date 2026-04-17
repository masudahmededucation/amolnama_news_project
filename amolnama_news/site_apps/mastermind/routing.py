"""Mastermind WebSocket URL routing — multi-player lobby transport."""
from django.urls import path

from . import consumers_lobby

websocket_urlpatterns = [
    path('ws/mastermind/lobby/<int:lobby_id>/', consumers_lobby.LobbyConsumer.as_asgi()),
]
