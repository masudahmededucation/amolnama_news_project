"""Call signaling WebSocket consumer — WebRTC offer/answer/ICE relay.

Group name: messenger_call_{call_id}

Signaling flow:
  1. Caller creates CallLog (via REST API), gets call_id
  2. Both parties connect to ws/call/{call_id}/
  3. Caller sends 'offer' → relayed to callee
  4. Callee sends 'answer' → relayed to caller
  5. Both exchange 'ice_candidate' messages
  6. 'call_accepted' / 'call_rejected' / 'call_ended' manage state

No media touches the server — only signaling messages pass through.
"""
import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone

logger = logging.getLogger(__name__)


class CallSignalingConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for 1-on-1 call signaling."""

    @database_sync_to_async
    def _get_user_profile_id(self, user):
        from amolnama_news.site_apps.user_account.models import UserProfile
        user_profile = UserProfile.objects.filter(
            link_user_account_user_id=user.pk
        ).only('user_profile_id').first()
        return user_profile.user_profile_id if user_profile else None

    @database_sync_to_async
    def _get_call_log(self, call_id):
        from .models import CallLog
        return CallLog.objects.filter(
            messenger_call_log_id=call_id, is_active=True
        ).first()

    @database_sync_to_async
    def _is_call_participant(self, call_log, user_profile_id):
        return user_profile_id in (
            call_log.link_caller_user_profile_id,
            call_log.link_callee_user_profile_id,
        )

    def _insert_call_system_message(self, call_log, status_code):
        """Insert a system message into the conversation showing call outcome."""
        from django.db import connection
        call_type_label = 'ভিডিও কল' if call_log.call_type_code == 'video' else 'অডিও কল'

        if status_code == 'ended' and call_log.duration_seconds:
            minutes = call_log.duration_seconds // 60
            seconds = call_log.duration_seconds % 60
            duration_text = f'{minutes}:{seconds:02d}'
            message_text = f'{call_type_label} শেষ হয়েছে — {duration_text}'
        elif status_code == 'missed':
            message_text = f'মিসড {call_type_label}'
        elif status_code == 'rejected':
            message_text = f'{call_type_label} প্রত্যাখ্যান হয়েছে'
        elif status_code == 'failed':
            message_text = f'{call_type_label} ব্যর্থ হয়েছে'
        else:
            message_text = f'{call_type_label} শেষ হয়েছে'

        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO [messenger].[message]
                        ([link_conversation_id], [link_sender_user_profile_id],
                         [message_text], [content_type_code], [is_system_message])
                    VALUES (%s, %s, %s, 'call_log', 1)
                """, [
                    call_log.link_conversation_id,
                    call_log.link_caller_user_profile_id,
                    message_text,
                ])
        except Exception:
            logger.exception('Failed to insert call log system message')

    @database_sync_to_async
    def _update_call_status(self, call_id, status_code, end_reason=None):
        from .models import CallLog
        call_log = CallLog.objects.filter(messenger_call_log_id=call_id).first()
        if not call_log:
            return
        call_log.call_status_code = status_code
        update_fields = ['call_status_code']

        if status_code == 'answered' and not call_log.answered_at:
            call_log.answered_at = timezone.now()
            update_fields.append('answered_at')
        elif status_code in ('ended', 'missed', 'rejected', 'failed'):
            call_log.ended_at = timezone.now()
            update_fields.append('ended_at')
            if call_log.answered_at:
                delta = call_log.ended_at - call_log.answered_at
                call_log.duration_seconds = max(0, int(delta.total_seconds()))
                update_fields.append('duration_seconds')
            if end_reason:
                call_log.end_reason_code = end_reason
                update_fields.append('end_reason_code')

        call_log.save(update_fields=update_fields)

        # Insert system message for call log in conversation
        if status_code in ('ended', 'missed', 'rejected', 'failed'):
            self._insert_call_system_message(call_log, status_code)

    async def connect(self):
        user = self.scope['user']
        if not user.is_authenticated:
            await self.close()
            return

        self.call_id = self.scope['url_route']['kwargs']['call_id']
        self.user_profile_id = await self._get_user_profile_id(user)
        if not self.user_profile_id:
            await self.close()
            return

        call_log = await self._get_call_log(self.call_id)
        if not call_log:
            await self.close()
            return

        is_participant = await self._is_call_participant(call_log, self.user_profile_id)
        if not is_participant:
            await self.close()
            return

        self.group_name = f'messenger_call_{self.call_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            logger.warning('CallSignaling: malformed JSON received')
            return

        message_type = data.get('type')
        if not message_type:
            return

        if message_type == 'offer':
            await self.channel_layer.group_send(self.group_name, {
                'type': 'relay_offer',
                'sdp': data.get('sdp'),
                'sender_profile_id': self.user_profile_id,
            })
        elif message_type == 'answer':
            await self.channel_layer.group_send(self.group_name, {
                'type': 'relay_answer',
                'sdp': data.get('sdp'),
                'sender_profile_id': self.user_profile_id,
            })
        elif message_type == 'ice_candidate':
            await self.channel_layer.group_send(self.group_name, {
                'type': 'relay_ice_candidate',
                'candidate': data.get('candidate'),
                'sender_profile_id': self.user_profile_id,
            })
        elif message_type == 'call_accepted':
            await self._update_call_status(self.call_id, 'answered')
            await self.channel_layer.group_send(self.group_name, {
                'type': 'relay_call_accepted',
                'sender_profile_id': self.user_profile_id,
            })
        elif message_type == 'call_rejected':
            await self._update_call_status(self.call_id, 'rejected', 'callee_rejected')
            await self.channel_layer.group_send(self.group_name, {
                'type': 'relay_call_rejected',
                'sender_profile_id': self.user_profile_id,
            })
        elif message_type == 'call_ended':
            end_reason = data.get('reason', 'caller_ended')
            await self._update_call_status(self.call_id, 'ended', end_reason)
            await self.channel_layer.group_send(self.group_name, {
                'type': 'relay_call_ended',
                'sender_profile_id': self.user_profile_id,
                'reason': end_reason,
            })

    # ── Relay handlers (send to all group members except sender) ──

    async def relay_offer(self, event):
        if event['sender_profile_id'] != self.user_profile_id:
            await self.send(text_data=json.dumps({
                'type': 'offer',
                'sdp': event['sdp'],
            }))

    async def relay_answer(self, event):
        if event['sender_profile_id'] != self.user_profile_id:
            await self.send(text_data=json.dumps({
                'type': 'answer',
                'sdp': event['sdp'],
            }))

    async def relay_ice_candidate(self, event):
        if event['sender_profile_id'] != self.user_profile_id:
            await self.send(text_data=json.dumps({
                'type': 'ice_candidate',
                'candidate': event['candidate'],
            }))

    async def relay_call_accepted(self, event):
        if event['sender_profile_id'] != self.user_profile_id:
            await self.send(text_data=json.dumps({
                'type': 'call_accepted',
            }))

    async def relay_call_rejected(self, event):
        if event['sender_profile_id'] != self.user_profile_id:
            await self.send(text_data=json.dumps({
                'type': 'call_rejected',
            }))

    async def relay_call_ended(self, event):
        if event['sender_profile_id'] != self.user_profile_id:
            await self.send(text_data=json.dumps({
                'type': 'call_ended',
                'reason': event.get('reason') or None,
            }))

    async def relay_incoming_call(self, event):
        """Sent to callee's personal notification channel to ring them."""
        await self.send(text_data=json.dumps({
            'type': 'incoming_call',
            'call_id': event['call_id'],
            'call_type_code': event['call_type_code'],
            'caller_name': event['caller_name'],
            'caller_profile_id': event['caller_profile_id'],
            'conversation_id': event['conversation_id'],
        }))
