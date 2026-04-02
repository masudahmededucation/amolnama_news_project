"""Content ranking algorithm — scores content for feed ordering.
Score = (recency × 0.3) + (engagement × 0.4) + (author_reputation × 0.1) + (content_quality × 0.2)
Pure Python, no external API. Runs on post feed items."""

import math
import logging
from datetime import datetime

from django.utils import timezone

logger = logging.getLogger(__name__)

# Weight configuration
WEIGHT_RECENCY = 0.3
WEIGHT_ENGAGEMENT = 0.4
WEIGHT_AUTHOR_REPUTATION = 0.1
WEIGHT_CONTENT_QUALITY = 0.2

# Recency decay — half-life in hours (content loses half its recency score after this many hours)
RECENCY_HALF_LIFE_HOURS = 48


def calculate_recency_score(created_at):
    """Exponential decay based on age. Newer = higher (0.0 to 1.0)."""
    if not created_at:
        return 0.0
    now = timezone.now()
    if timezone.is_naive(created_at):
        created_at = timezone.make_aware(created_at)
    age_hours = max((now - created_at).total_seconds() / 3600, 0)
    decay = math.exp(-0.693 * age_hours / RECENCY_HALF_LIFE_HOURS)
    return round(min(decay, 1.0), 4)


def calculate_engagement_score(like_count, view_count, reply_count, repost_count, vote_score_count):
    """Normalized engagement score (0.0 to 1.0). Weighted by action value."""
    like_count = like_count or 0
    view_count = view_count or 0
    reply_count = reply_count or 0
    repost_count = repost_count or 0
    vote_score_count = vote_score_count or 0

    raw_score = (
        like_count * 1.0 +
        view_count * 0.1 +
        reply_count * 2.0 +
        repost_count * 1.5 +
        vote_score_count * 1.0
    )
    # Logarithmic normalization — prevents viral content from totally dominating
    if raw_score <= 0:
        return 0.0
    normalized = math.log1p(raw_score) / math.log1p(1000)
    return round(min(normalized, 1.0), 4)


def calculate_author_reputation_score(contribution_score_count):
    """Author reputation normalized (0.0 to 1.0)."""
    contribution_score_count = contribution_score_count or 0
    if contribution_score_count <= 0:
        return 0.0
    normalized = math.log1p(contribution_score_count) / math.log1p(10000)
    return round(min(normalized, 1.0), 4)


def calculate_content_quality_score(post_text):
    """Content quality based on length and vocabulary diversity (0.0 to 1.0)."""
    if not post_text:
        return 0.0

    words = post_text.split()
    word_count = len(words)

    # Length score (capped at 100 words)
    length_score = min(word_count, 100) / 100.0

    # Vocabulary diversity (unique / total)
    diversity_score = 0.0
    if word_count > 3:
        unique_words = set(words)
        diversity_score = len(unique_words) / word_count

    return round((length_score * 0.5 + diversity_score * 0.5), 4)


def calculate_total_score(post_item):
    """Calculate total ranking score for a single post feed item."""
    recency = calculate_recency_score(post_item.get('created_at_raw'))
    engagement = calculate_engagement_score(
        post_item.get('like_count', 0),
        post_item.get('view_count', 0),
        post_item.get('reply_count', 0),
        post_item.get('repost_count', 0),
        post_item.get('vote_score_count', 0),
    )
    author_reputation = calculate_author_reputation_score(
        post_item.get('author_contribution_score', 0)
    )
    content_quality = calculate_content_quality_score(
        post_item.get('post_text_bn', '')
    )

    total = (
        recency * WEIGHT_RECENCY +
        engagement * WEIGHT_ENGAGEMENT +
        author_reputation * WEIGHT_AUTHOR_REPUTATION +
        content_quality * WEIGHT_CONTENT_QUALITY
    )

    # Brand-new posts (< 5 minutes old) get massive boost — always on top
    created_at = post_item.get('created_at_raw')
    if created_at:
        from django.utils import timezone as tz
        if tz.is_naive(created_at):
            created_at = tz.make_aware(created_at)
        age_seconds = max((tz.now() - created_at).total_seconds(), 0)
        if age_seconds < 300:
            total += 10.0

    return round(total, 4)


def rank_post_items(post_items):
    """Sort post items chronologically (latest first). Promos keep their position.
    Ranking scores are stored for future 'Top' tab but NOT used for sorting in 'For You' feed."""
    for item in post_items:
        if item.get('item_type') in ('debate_promo', 'content_promo', 'tools_promo'):
            continue
        item['_ranking_score'] = calculate_total_score(item)

    # Separate promos and posts
    promo_items = [item for item in post_items if item.get('item_type') in ('debate_promo', 'content_promo', 'tools_promo')]
    regular_items = [item for item in post_items if item.get('item_type') not in ('debate_promo', 'content_promo', 'tools_promo')]

    # Sort by date — latest first. Always. No exceptions.
    regular_items.sort(key=lambda item: item.get('created_at_raw') or '', reverse=True)

    # Promos first (already sorted by date), then chronological posts
    return promo_items + regular_items
