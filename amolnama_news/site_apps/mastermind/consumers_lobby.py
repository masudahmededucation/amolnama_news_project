"""Mastermind lobby WebSocket consumer — Kahoot-style live group quiz transport.

This consumer is intentionally a thin wrapper around mastermind.lobby.* engine
functions. The same engine functions are also callable from HTTP endpoints so
the UI can bootstrap state before the WebSocket connects (and so the system
keeps working if the WebSocket layer is ever swapped out).

Group naming: lobby_{lobby_id}
Endpoint:     /ws/mastermind/lobby/<int:lobby_id>/

Message types (client → server):
    {"type": "ready",            "is_ready": true}
    {"type": "leave"}
    {"type": "advance_question", "expected_index": 3}      # host only
    {"type": "submit_answer",    "question_index": 3, "answer": {...}}
    {"type": "request_state"}                              # explicit refresh

Message types (server → client):
    {"type": "lobby_state",  "state": {...}}
    {"type": "answer_result", "is_correct": bool, "points_earned": float, "state": {...}}
    {"type": "error",        "message": "..."}
"""
import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class LobbyConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for one multi-player lobby."""

    @database_sync_to_async
    def _resolve_user_profile_id(self, user):
        from amolnama_news.site_apps.user_account.models import UserProfile
        try:
            profile = UserProfile.objects.filter(
                link_user_account_user_id=user.pk
            ).only('user_profile_id').first()
            return profile.user_profile_id if profile else None
        except Exception:
            logger.exception('Lobby consumer: user profile lookup failed')
            return None

    @database_sync_to_async
    def _is_lobby_member(self, lobby_id, user_profile_id):
        """True if the user is the host OR an active joined player."""
        from .models import CollQuizLobby, CollQuizLobbyPlayer
        lobby = CollQuizLobby.objects.filter(
            mastermind_coll_quiz_lobby_id=lobby_id, is_active=True,
        ).first()
        if not lobby:
            return False
        if lobby.link_host_user_profile_id == user_profile_id:
            return True
        return CollQuizLobbyPlayer.objects.filter(
            link_mastermind_coll_quiz_lobby_id=lobby_id,
            link_user_profile_id=user_profile_id,
            is_active=True,
        ).exists()

    @database_sync_to_async
    def _join_lobby(self, lobby_id, user_profile_id):
        """Auto-join via the engine when the user opens the WebSocket directly.

        For the player flow the HTTP /play/<code>/ page will have already called
        join_lobby. For the host flow they're already implicitly a member. This
        is a safety net so opening a stale WS still resyncs.
        """
        from .lobby import join_lobby, get_lobby_state, CollQuizLobby
        from .models import CollQuizLobby as _CollQuizLobby
        lobby = _CollQuizLobby.objects.filter(
            mastermind_coll_quiz_lobby_id=lobby_id, is_active=True,
        ).first()
        if not lobby:
            return None
        # If host, just return state — host doesn't need to "join" as a player
        if lobby.link_host_user_profile_id == user_profile_id:
            return get_lobby_state(lobby_id)
        return join_lobby(lobby.lobby_join_code, user_profile_id)

    @database_sync_to_async
    def _engine_call(self, fn, *args, **kwargs):
        """Run any sync engine function from the async consumer."""
        return fn(*args, **kwargs)

    async def connect(self):
        user = self.scope['user']
        if not user.is_authenticated:
            await self.close(code=4001)
            return

        self.lobby_id = self.scope['url_route']['kwargs']['lobby_id']
        self.user_profile_id = await self._resolve_user_profile_id(user)
        if not self.user_profile_id:
            await self.close(code=4001)
            return

        is_member = await self._is_lobby_member(self.lobby_id, self.user_profile_id)
        if not is_member:
            # Try to auto-join (e.g. the player just navigated directly)
            join_state = await self._join_lobby(self.lobby_id, self.user_profile_id)
            if not join_state or 'error' in join_state:
                await self.close(code=4003)
                return

        self.group_name = f'lobby_{self.lobby_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send the joining client the current state immediately
        from .lobby import get_lobby_state
        state = await self._engine_call(get_lobby_state, self.lobby_id)
        await self._send_personal('lobby_state', {'state': state})

        # Broadcast to everyone else that someone joined / refreshed
        await self.channel_layer.group_send(self.group_name, {
            'type': 'broadcast_state',
            'reason': 'member_connected',
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            payload = json.loads(text_data or '{}')
        except json.JSONDecodeError:
            return await self._send_personal('error', {'message': 'Invalid JSON.'})

        message_type = payload.get('type')
        if message_type == 'ready':
            from .lobby import mark_ready
            await self._engine_call(
                mark_ready,
                self.lobby_id, self.user_profile_id,
                bool(payload.get('is_ready', True)),
            )
            await self.channel_layer.group_send(self.group_name, {
                'type': 'broadcast_state',
                'reason': 'ready_changed',
            })

        elif message_type == 'start_lobby':
            from .lobby import start_lobby
            result = await self._engine_call(start_lobby, self.lobby_id, self.user_profile_id)
            if 'error' in result:
                await self._send_personal('error', {'message': result['error']})
                return
            await self.channel_layer.group_send(self.group_name, {
                'type': 'broadcast_state',
                'reason': 'lobby_started',
            })

        elif message_type == 'advance_question':
            from .lobby import advance_question
            expected_index = payload.get('expected_index')
            result = await self._engine_call(
                advance_question, self.lobby_id, self.user_profile_id,
                expected_index if isinstance(expected_index, int) else None,
            )
            if 'error' in result:
                await self._send_personal('error', {'message': result['error']})
                return
            await self.channel_layer.group_send(self.group_name, {
                'type': 'broadcast_state',
                'reason': 'question_advanced',
            })

        elif message_type == 'submit_answer':
            from .lobby import submit_lobby_answer
            question_index = payload.get('question_index')
            answer = payload.get('answer') or {}
            if not isinstance(question_index, int):
                return await self._send_personal('error', {'message': 'question_index required.'})
            result = await self._engine_call(
                submit_lobby_answer,
                self.lobby_id, self.user_profile_id, question_index, answer,
            )
            if 'error' in result:
                await self._send_personal('error', {'message': result['error']})
                return
            # Tell the answering player how they did (private)
            await self._send_personal('answer_result', result)
            # Tell everyone the leaderboard moved (broadcast — no per-player answer info)
            await self.channel_layer.group_send(self.group_name, {
                'type': 'broadcast_state',
                'reason': 'answer_submitted',
            })

        elif message_type == 'leave':
            from .lobby import leave_lobby
            await self._engine_call(leave_lobby, self.lobby_id, self.user_profile_id)
            await self.channel_layer.group_send(self.group_name, {
                'type': 'broadcast_state',
                'reason': 'player_left',
            })
            await self.close(code=1000)

        elif message_type == 'request_state':
            from .lobby import get_lobby_state
            state = await self._engine_call(get_lobby_state, self.lobby_id)
            await self._send_personal('lobby_state', {'state': state})

        else:
            await self._send_personal('error', {'message': f'Unknown type: {message_type}'})

    async def broadcast_state(self, event):
        """Group → client: every member receives the latest snapshot."""
        from .lobby import get_lobby_state
        state = await self._engine_call(get_lobby_state, self.lobby_id)
        await self._send_personal('lobby_state', {
            'state': state,
            'reason': event.get('reason'),
        })

    async def _send_personal(self, msg_type, payload):
        body = {'type': msg_type}
        body.update(payload or {})
        await self.send(text_data=json.dumps(body, default=str))
