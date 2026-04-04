"""Messenger models — maps to [messenger].* SQL Server tables (all unmanaged)."""

from django.db import models


class Conversation(models.Model):
    messenger_conversation_id = models.BigAutoField(primary_key=True)
    conversation_type_code = models.CharField(max_length=20, default='direct')
    conversation_title = models.CharField(max_length=255, blank=True, null=True)
    last_message_text = models.CharField(max_length=500, blank=True, null=True)
    last_message_at = models.DateTimeField(blank=True, null=True)
    last_message_sender_user_profile_id = models.BigIntegerField(blank=True, null=True)
    auto_delete_after_seconds = models.IntegerField(blank=True, null=True)
    auto_delete_set_by_user_profile_id = models.BigIntegerField(blank=True, null=True)
    auto_delete_set_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()
    link_created_by_user_profile_id = models.BigIntegerField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[messenger].[conversation]'

    def __str__(self):
        return f'Conversation {self.messenger_conversation_id} ({self.conversation_type_code})'


class ConversationParticipant(models.Model):
    messenger_conversation_participant_id = models.BigAutoField(primary_key=True)
    link_conversation_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    participant_role_code = models.CharField(max_length=20, default='member')
    unread_count = models.IntegerField(default=0)
    last_read_message_id = models.BigIntegerField(blank=True, null=True)
    is_muted = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField()
    left_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[messenger].[conversation_participant]'

    def __str__(self):
        return f'Participant {self.link_user_profile_id} in conversation {self.link_conversation_id}'


class Message(models.Model):
    messenger_message_id = models.BigAutoField(primary_key=True)
    link_conversation_id = models.BigIntegerField()
    link_sender_user_profile_id = models.BigIntegerField()
    message_text = models.CharField(max_length=4000)
    content_type_code = models.CharField(max_length=20, default='text')
    message_status_code = models.CharField(max_length=20, default='sent')
    link_reply_to_message_id = models.BigIntegerField(blank=True, null=True)
    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(blank=True, null=True)
    is_deleted_for_everyone = models.BooleanField(default=False)
    deleted_for_everyone_at = models.DateTimeField(blank=True, null=True)
    is_system_message = models.BooleanField(default=False)
    auto_delete_expires_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()
    delivered_at = models.DateTimeField(blank=True, null=True)
    read_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[messenger].[message]'

    def __str__(self):
        return f'Message {self.messenger_message_id} in conversation {self.link_conversation_id}'


class MessageDeletion(models.Model):
    messenger_message_deletion_id = models.BigAutoField(primary_key=True)
    link_message_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    deleted_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[messenger].[message_deletion]'


class TypingIndicator(models.Model):
    messenger_typing_indicator_id = models.BigAutoField(primary_key=True)
    link_conversation_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    last_typed_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[messenger].[typing_indicator]'
