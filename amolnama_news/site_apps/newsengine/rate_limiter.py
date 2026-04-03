"""Rate limiter — prevents spam by limiting actions per user per time window.
Call check_rate_limit() at the start of any API that needs protection."""

import logging
from datetime import timedelta

from django.db import connection
from django.utils import timezone

logger = logging.getLogger(__name__)

# Rate limit configuration: action_code → (max_count, window_minutes)
RATE_LIMITS = {
    'post_create': (10, 60),        # 10 posts per hour
    'post_reply': (30, 60),         # 30 replies per hour
    'vote': (50, 60),               # 50 votes per hour
    'flag': (5, 60),                # 5 flags per hour
    'debate_argument': (20, 60),    # 20 debate arguments per hour
    'debate_reply': (30, 60),       # 30 debate replies per hour
}


def check_rate_limit(user_profile_id, action_code):
    """Check if user has exceeded rate limit for the given action.
    Returns (is_allowed, error_message).
    If allowed, logs the action. If not, returns Bengali error message."""
    if not user_profile_id:
        return True, ''

    config = RATE_LIMITS.get(action_code)
    if not config:
        return True, ''

    max_count, window_minutes = config
    cutoff_time = timezone.now() - timedelta(minutes=window_minutes)

    from .models import FactRateLimitActionLog
    recent_count = FactRateLimitActionLog.objects.filter(
        link_user_profile_id=user_profile_id,
        rate_limit_action_code=action_code,
        action_at__gte=cutoff_time,
    ).count()

    if recent_count >= max_count:
        return False, 'অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন। আপনি সীমা অতিক্রম করেছেন।'

    # Log this action
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [newsengine].[fact_rate_limit_action_log]
                    ([link_user_profile_id], [rate_limit_action_code])
                VALUES (%s, %s)
            """, [user_profile_id, action_code])
    except Exception:
        logger.exception('Failed to log rate limit for user %s action %s', user_profile_id, action_code)

    return True, ''
