"""Personalized feed — boost content matching user's interest profile.
Builds interest weights from user's engagement history. Pure Python, no external API."""

import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

# Default interest weights for new users (cold start)
DEFAULT_INTEREST_WEIGHTS = {
    'content_promo': 0.15,
    'debate_promo': 0.15,
    'tools_promo': 0.10,
    'post': 0.60,
}

# Map promo_badge to content category
BADGE_TO_CATEGORY = {
    'NEWS': 'news',
    'POEM': 'poem',
    'STORY': 'story',
    'ART': 'art',
    'TRAVEL': 'travel',
}


def build_user_interest_profile(user_profile_id):
    """Build interest profile from user's view history.
    Returns dict of {category: weight} where weights sum to ~1.0."""
    if not user_profile_id:
        return DEFAULT_INTEREST_WEIGHTS

    from .models import FactFeedUserContentView

    views = FactFeedUserContentView.objects.filter(
        link_user_profile_id=user_profile_id,
        is_active=True,
    ).values_list('feed_content_type_code', flat=True)

    if not views:
        return DEFAULT_INTEREST_WEIGHTS

    # Count views per category
    category_counts = defaultdict(int)
    for content_type_code in views:
        category_counts[content_type_code] += 1

    total_views = sum(category_counts.values())
    if total_views == 0:
        return DEFAULT_INTEREST_WEIGHTS

    # Normalize to weights
    interest_weights = {}
    for category, count in category_counts.items():
        interest_weights[category] = round(count / total_views, 4)

    return interest_weights


def apply_personalization_boost(feed_items, user_profile_id):
    """Boost feed items matching user's interest profile.
    Adds a personalization multiplier to promo items' sort position."""
    if not user_profile_id:
        return feed_items

    interest_weights = build_user_interest_profile(user_profile_id)

    for item in feed_items:
        item_type = item.get('item_type', '')
        badge = item.get('promo_badge', '')

        # Determine category
        category = None
        if badge in BADGE_TO_CATEGORY:
            category = BADGE_TO_CATEGORY[badge]
        elif item_type == 'debate_promo':
            category = 'debate'
        elif item_type == 'tools_promo':
            category = 'tools'

        if category and category in interest_weights:
            boost = interest_weights[category]
            existing_score = item.get('_ranking_score', 0.5)
            item['_ranking_score'] = existing_score + (boost * 0.3)

    return feed_items


def record_content_view(user_profile_id, content_type_code, content_id):
    """Record that a user viewed a piece of content. Called from view APIs."""
    if not user_profile_id or not content_type_code or not content_id:
        return

    from django.db import connection
    from django.utils import timezone

    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [newsengine].[fact_feed_user_content_view]
                    ([link_user_profile_id], [feed_content_type_code], [feed_content_id])
                VALUES (%s, %s, %s)
            """, [user_profile_id, content_type_code, content_id])
    except Exception:
        logger.exception('Failed to record content view for user %s', user_profile_id)
