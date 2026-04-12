"""Newsengine middleware — lightweight hooks that run on every request.

Currently: UpdateLastActiveMiddleware — stamps user_profile.last_active_at
so fan-out can skip dormant users.
"""

import logging

from django.utils import timezone

logger = logging.getLogger(__name__)

# Debounce interval: don't UPDATE the DB more than once per 5 minutes per user.
# The session stores the last stamp, so repeated page loads within 5 min
# are free (no DB hit). This keeps the middleware cost near-zero for
# active browsing sessions while still catching returning dormant users.
LAST_ACTIVE_DEBOUNCE_SECONDS = 300


class UpdateLastActiveMiddleware:
    """Stamp user_profile.last_active_at on every authenticated request.

    Debounced to 5 min via session to avoid hammering the DB on every click.
    Uses raw SQL (single-row UPDATE by PK with filtered index) — ~1ms.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Only for authenticated users
        if not getattr(request, 'user', None) or not request.user.is_authenticated:
            return response

        # Debounce: skip if we already stamped this session recently
        session = getattr(request, 'session', None)
        if session:
            last_stamp = session.get('_last_active_stamp')
            if last_stamp:
                try:
                    from django.utils.dateparse import parse_datetime
                    last_stamp_dt = parse_datetime(last_stamp)
                    if last_stamp_dt and (timezone.now() - last_stamp_dt).total_seconds() < LAST_ACTIVE_DEBOUNCE_SECONDS:
                        return response
                except (ValueError, TypeError):
                    pass

        # Stamp it
        try:
            from django.db import connection
            now = timezone.now()
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE [account].[user_profile]
                    SET [last_active_at] = %s
                    WHERE [link_user_account_user_id] = %s
                """, [now, request.user.pk])

            # Record in session so we don't re-stamp for 5 min
            if session is not None:
                session['_last_active_stamp'] = now.isoformat()
        except Exception:
            # Non-fatal — if this fails, fan-out just treats the user as dormant.
            # Don't block the response over a timestamp update.
            logger.debug('UpdateLastActiveMiddleware: stamp failed for user %s', request.user.pk, exc_info=True)

        return response
