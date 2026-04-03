"""Newsengine feed builder — assembles the complete home feed.
Collects user posts, promo cards, promotional boosts, applies ranking, dedup, personalization.
This is the single source of truth for what appears on the home page."""

import hashlib
import logging

logger = logging.getLogger(__name__)


def build_home_feed(request):
    """Build the complete home feed for the given tab.
    Returns (feed_items, current_user_avatar_url, active_tab, following_count)."""
    active_tab = request.GET.get('tab', 'for_you')
    category_filter = request.GET.get('category', '')
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

    # Apply newsengine intelligence to "For You" tab only
    if active_tab == 'for_you':
        feed_items = _build_intelligent_feed(request, feed_items, category_filter)

    return feed_items, current_user_avatar_url, active_tab, following_count


def _build_intelligent_feed(request, feed_items, category_filter):
    """Apply full newsengine pipeline: promos → ranking → personalization → dedup → read history → category filter."""

    # Step 0: Auto-publish scheduled posts that are due
    try:
        _auto_publish_scheduled_posts()
    except Exception:
        logger.exception('Auto-publish scheduled posts failed')

    # Step 1: Inject promo cards
    feed_items = _inject_promo_cards(feed_items)

    # Step 2: Apply content ranking to posts (promos keep their position)
    try:
        from .ranking import rank_post_items
        feed_items = rank_post_items(feed_items)
    except Exception:
        logger.exception('Content ranking failed — falling back to default order')

    # Step 3: Apply personalization boost for authenticated users
    user_profile_id = _get_user_profile_id(request)
    if user_profile_id:
        try:
            from .personalization import apply_personalization_boost
            feed_items = apply_personalization_boost(feed_items, user_profile_id)
        except Exception:
            logger.exception('Personalization failed — continuing without boost')

    # Step 3b: Apply user feed preferences (hide categories user turned off)
    if user_profile_id:
        try:
            feed_items = _apply_user_feed_preferences(feed_items, user_profile_id)
        except Exception:
            logger.exception('Feed preferences filter failed — showing all content')

    # Step 4: Remove content user has already viewed (read history)
    if user_profile_id:
        try:
            feed_items = _exclude_viewed_content(feed_items, user_profile_id)
        except Exception:
            logger.exception('Read history filter failed — showing all content')

    # Step 4b: Exclude content from blocked users
    if user_profile_id:
        try:
            feed_items = _exclude_blocked_users(feed_items, user_profile_id)
        except Exception:
            logger.exception('Blocked user filter failed — showing all content')

    # Step 4c: Hide posts containing muted words
    if user_profile_id:
        try:
            feed_items = _exclude_muted_words(feed_items, user_profile_id)
        except Exception:
            logger.exception('Muted words filter failed — showing all content')

    # Step 5: Exclude auto-flagged content (classified as harmful)
    feed_items = [item for item in feed_items if not item.get('is_auto_flagged')]

    # Step 6: Deduplicate content (same content as published promo + boost)
    feed_items = _deduplicate_feed(feed_items)

    # Step 7: Category filter (if requested via ?category=poem)
    if category_filter:
        feed_items = _filter_by_category(feed_items, category_filter)

    return feed_items


def _inject_promo_cards(feed_items):
    """Sprinkle promo cards between posts — 1 promo every 5 posts, max 6 total.
    User's recent posts (< 5 min) stay at top untouched."""
    from django.utils import timezone as tz
    from datetime import timedelta
    from .promo_builders import build_all_promo_items

    # Find how many recent user posts are at the top (< 5 min old)
    recent_cutoff = tz.now() - timedelta(minutes=5)
    recent_post_count = 0
    for item in feed_items:
        created_at = item.get('created_at_raw')
        if created_at:
            if tz.is_naive(created_at):
                created_at = tz.make_aware(created_at)
            if created_at > recent_cutoff:
                recent_post_count += 1
                continue
        break

    # Get promos — cap at 6
    all_promo_items = build_all_promo_items()[:6]
    if not all_promo_items:
        return feed_items

    # Sprinkle 1 promo every 5 posts, starting after recent posts
    promo_index = 0
    insert_position = recent_post_count + 5
    while promo_index < len(all_promo_items) and insert_position <= len(feed_items):
        feed_items.insert(insert_position, all_promo_items[promo_index])
        promo_index += 1
        insert_position += 6  # 5 posts + 1 promo just inserted

    return feed_items


def _exclude_viewed_content(feed_items, user_profile_id):
    """Remove content the user has already viewed (last 200 views)."""
    from .models import FactFeedUserContentView

    recent_views = FactFeedUserContentView.objects.filter(
        link_user_profile_id=user_profile_id,
        is_active=True,
    ).order_by('-feed_viewed_at').values_list('feed_content_type_code', 'feed_content_id')[:200]

    viewed_keys = set()
    for content_type_code, content_id in recent_views:
        viewed_keys.add(f'{content_type_code}:{content_id}')

    if not viewed_keys:
        return feed_items

    filtered_items = []
    for item in feed_items:
        # Build a key for this item
        item_key = _get_content_key(item)
        if item_key and item_key in viewed_keys:
            continue  # Skip viewed content
        filtered_items.append(item)

    return filtered_items


def _deduplicate_feed(feed_items):
    """Remove duplicate content — same item appearing as published promo + boost."""
    seen_keys = set()
    deduplicated_items = []

    for item in feed_items:
        item_key = _get_content_key(item)
        if item_key:
            if item_key in seen_keys:
                continue  # Skip duplicate
            seen_keys.add(item_key)
        deduplicated_items.append(item)

    return deduplicated_items


def _filter_by_category(feed_items, category_filter):
    """Filter feed to show only items matching the category.
    Posts always pass through. Promo cards filtered by badge/type."""
    category_filter = category_filter.lower()

    # Map category filter values to badge/type matches
    category_map = {
        'news': ('NEWS', 'content_promo'),
        'poem': ('POEM', 'content_promo'),
        'story': ('STORY', 'content_promo'),
        'art': ('ART', 'content_promo'),
        'travel': ('TRAVEL', 'content_promo'),
        'debate': ('', 'debate_promo'),
        'tools': ('', 'tools_promo'),
    }

    if category_filter not in category_map:
        return feed_items

    target_badge, target_type = category_map[category_filter]

    filtered_items = []
    for item in feed_items:
        item_type = item.get('item_type', '')
        badge = item.get('promo_badge', '')

        # Always include regular posts
        if item_type not in ('debate_promo', 'content_promo', 'tools_promo'):
            filtered_items.append(item)
            continue

        # Filter promo cards by category
        if target_type and item_type == target_type:
            if target_badge and badge == target_badge:
                filtered_items.append(item)
            elif not target_badge:
                filtered_items.append(item)

    return filtered_items


def _auto_publish_scheduled_posts():
    """Auto-publish posts where scheduled_publish_at has passed and is_published is False."""
    from django.utils import timezone
    from amolnama_news.site_apps.post.models import Post

    now = timezone.now()
    Post.objects.filter(
        scheduled_publish_at__lte=now, is_published=False, is_active=True,
    ).exclude(scheduled_publish_at__isnull=True).update(is_published=True)


def _exclude_muted_words(feed_items, user_profile_id):
    """Hide posts containing any of the user's muted words."""
    from .models import MutedWordItem

    muted_words = list(MutedWordItem.objects.filter(
        link_user_profile_id=user_profile_id, is_active=True,
    ).values_list('muted_word_text', flat=True))

    if not muted_words:
        return feed_items

    filtered_items = []
    for item in feed_items:
        post_text = (item.get('post_text') or item.get('promo_title') or '').lower()
        is_muted = False
        for muted_word in muted_words:
            if muted_word in post_text:
                is_muted = True
                break
        if not is_muted:
            filtered_items.append(item)

    return filtered_items


def _exclude_blocked_users(feed_items, user_profile_id):
    """Remove posts from users that the current user has blocked."""
    from amolnama_news.site_apps.social.models import UserBlock

    blocked_ids = set(UserBlock.objects.filter(
        link_blocker_user_profile_id=user_profile_id, is_active=True,
    ).values_list('link_blocked_user_profile_id', flat=True))

    if not blocked_ids:
        return feed_items

    return [
        item for item in feed_items
        if item.get('author_user_profile_id') not in blocked_ids
    ]


def _apply_user_feed_preferences(feed_items, user_profile_id):
    """Filter out promo categories the user has disabled in their feed preferences."""
    try:
        from amolnama_news.site_apps.user_account.models import UserProfile
        profile = UserProfile.objects.get(user_profile_id=user_profile_id)
    except Exception:
        return feed_items

    # Map preference fields to promo badge/type
    preference_map = {
        'NEWS': profile.feed_preference_news,
        'POEM': profile.feed_preference_poem,
        'STORY': profile.feed_preference_story,
        'ART': profile.feed_preference_art,
        'TRAVEL': profile.feed_preference_travel,
    }
    debate_enabled = profile.feed_preference_debate
    tools_enabled = profile.feed_preference_tools

    filtered_items = []
    for item in feed_items:
        item_type = item.get('item_type', '')
        badge = item.get('promo_badge', '')

        # Regular posts always pass
        if item_type not in ('debate_promo', 'content_promo', 'tools_promo'):
            filtered_items.append(item)
            continue

        # Check preferences
        if item_type == 'debate_promo' and not debate_enabled:
            continue
        if item_type == 'tools_promo' and not tools_enabled:
            continue
        if item_type == 'content_promo' and badge in preference_map:
            if not preference_map[badge]:
                continue

        filtered_items.append(item)

    return filtered_items


def _get_content_key(item):
    """Generate a unique key for dedup and read history matching."""
    item_type = item.get('item_type', '')

    if item_type == 'debate_promo':
        return f'debate:{item.get("debate_coll_topic_id", "")}'
    elif item_type == 'content_promo':
        return f'{item.get("promo_badge", "").lower()}:{item.get("promo_id", "")}'
    elif item_type == 'tools_promo':
        return f'tools:{item.get("tool_name_en", "")}'
    elif item.get('post_post_id'):
        return f'post:{item.get("post_post_id", "")}'

    return None


def _get_user_profile_id(request):
    """Get current user's profile ID or None."""
    if not request.user.is_authenticated:
        return None
    try:
        from amolnama_news.site_apps.user_account.models import UserProfile
        return UserProfile.objects.get(link_user_account_user_id=request.user.pk).user_profile_id
    except Exception:
        return None
