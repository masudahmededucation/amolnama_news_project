"""Management command: delete expired auto-delete messages. Run via cron hourly."""

import logging

from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Delete messages that have passed their auto_delete_expires_at timestamp.'

    def handle(self, *args, **options):
        now = timezone.now()

        with connection.cursor() as cursor:
            # Delete message_deletions for expired messages first (FK constraint)
            cursor.execute("""
                DELETE FROM [messenger].[message_deletion]
                WHERE [link_message_id] IN (
                    SELECT [messenger_message_id] FROM [messenger].[message]
                    WHERE [auto_delete_expires_at] IS NOT NULL AND [auto_delete_expires_at] <= %s
                )
            """, [now])
            deletions_removed = cursor.rowcount

            # Hard delete expired messages
            cursor.execute("""
                DELETE FROM [messenger].[message]
                WHERE [auto_delete_expires_at] IS NOT NULL AND [auto_delete_expires_at] <= %s
            """, [now])
            messages_removed = cursor.rowcount

        if messages_removed > 0:
            logger.info('Cleaned up %d expired messages (%d deletion records)', messages_removed, deletions_removed)
            self.stdout.write(self.style.SUCCESS(f'Deleted {messages_removed} expired messages.'))
        else:
            self.stdout.write('No expired messages found.')
