"""Newsengine feed builder — assembles the complete home feed.
Collects user posts, promo cards, promotional boosts, sorts and merges into one feed.
This is the single source of truth for what appears on the home page."""

import logging

logger = logging.getLogger(__name__)


def build_home_feed(request):
    """Build the complete home feed for the given tab.
    Returns (feed_items, current_user_avatar_url, active_tab, following_count)."""
    active_tab = request.GET.get('tab', 'for_you')
    following_count = 0

    if active_tab == 'my_posts' and request.user.is_authenticated:
        from amolnama_news.site_apps.post.views import _build_my_posts
        feed_items, current_user_avatar_url = _build_my_posts(request)

    elif active_tab == 'following' and request.user.is_authenticated:
        from amolnama_news.site_apps.post.views import _build_following_posts
        from amolnama_news.site_apps.social.models import UserFollow
        from amolnama_news.site_apps.user_account.models import UserProfile
        feed_items, current_user_avatar_url = _build_following_posts(request)
        try:
            follow_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
            following_count = UserFollow.objects.filter(
                link_follower_user_profile_id=follow_profile.user_profile_id, is_active=True,
            ).count()
        except UserProfile.DoesNotExist:
            following_count = 0

    else:
        active_tab = 'for_you'
        from amolnama_news.site_apps.post.views import build_post_feed_items
        feed_items, current_user_avatar_url = build_post_feed_items(request)

    # Inject promo cards into "For You" tab only
    if active_tab == 'for_you':
        feed_items = _inject_promo_cards(feed_items)

    return feed_items, current_user_avatar_url, active_tab, following_count


def _inject_promo_cards(feed_items):
    """Inject promo cards from all content apps into the feed.
    Two types: (1) all published items at top sorted by date, (2) promotional boost lower in feed."""
    from .promo_builders import build_all_promo_items, build_promotional_boost_items

    # (1) All published items — appear at top, sorted by date (latest first)
    all_promo_items = build_all_promo_items()
    for index, promo in enumerate(all_promo_items):
        feed_items.insert(index, promo)

    # (2) Promotional boost — 2 per category, re-surfaced lower in feed
    promo_boost_items = build_promotional_boost_items()
    boost_start_position = max(len(all_promo_items) + 5, 10)
    for index, promo in enumerate(promo_boost_items):
        position = boost_start_position + (index * 5)
        if position < len(feed_items):
            feed_items.insert(position, promo)
        else:
            feed_items.append(promo)

    return feed_items
