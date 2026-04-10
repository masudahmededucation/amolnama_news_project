"""Newsengine feed builder — assembles the complete home feed.
Collects user posts, promo cards, promotional boosts, applies ranking, dedup, personalization.
This is the single source of truth for what appears on the home page."""

import logging
import random
from amolnama_news.site_apps.core.utils import get_user_profile_id as _get_user_profile_id

logger = logging.getLogger(__name__)


def build_home_feed(request):
    """Build the complete home feed for the given tab.
    Returns (feed_items, current_user_avatar_url, active_tab, following_count)."""
    active_tab = request.GET.get('tab', 'for_you')
    category_filter = request.GET.get('category', '')
    following_count = 0
    cache_used = False

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
        # Cache-first: try pre-computed feed from fact_user_feed_cache
        cache_used = False
        user_profile_id = _get_user_profile_id(request)
        if user_profile_id and not request.GET.get('fresh'):
            try:
                from .feed_fanout import get_cached_feed_for_user
                cached_rows = get_cached_feed_for_user(user_profile_id, limit=20)
                if cached_rows:
                    cached_post_ids = [row[0] for row in cached_rows]
                    from amolnama_news.site_apps.post.models import Post
                    cached_posts = Post.objects.filter(
                        post_post_id__in=cached_post_ids, is_active=True,
                    )
                    from amolnama_news.site_apps.post.views import build_post_feed_items
                    feed_items, current_user_avatar_url = build_post_feed_items(request, posts=cached_posts)
                    cache_used = True
            except Exception:
                logger.exception('Cache-first feed read failed — falling back to full pipeline')

        if not cache_used:
            from amolnama_news.site_apps.post.views import build_post_feed_items
            feed_items, current_user_avatar_url = build_post_feed_items(request)

    # Apply newsengine intelligence to "For You" tab only
    if active_tab == 'for_you':
        feed_items = _build_intelligent_feed(request, feed_items, category_filter)

    # cache_used flag tells template to trigger background refresh via JS
    feed_cache_used = active_tab == 'for_you' and cache_used
    return feed_items, current_user_avatar_url, active_tab, following_count, feed_cache_used


def _build_intelligent_feed(request, feed_items, category_filter):
    """Apply full newsengine pipeline: promos → ranking → personalization → dedup → read history → category filter."""

    # Step 0: Auto-publish scheduled posts that are due
    try:
        _auto_publish_scheduled_posts()
    except Exception:
        logger.exception('Auto-publish scheduled posts failed')

    # Step 1: Apply content ranking to posts BEFORE promo injection
    try:
        from .ranking import rank_post_items
        feed_items = rank_post_items(feed_items)
    except Exception:
        logger.exception('Content ranking failed — falling back to default order')

    # Step 2: Inject unified promo cards (single source — no boost, no trending overlap)
    feed_items = _inject_promo_cards(feed_items, request=request)

    # Steps 3-4: User-specific filters (only for authenticated users)
    user_profile_id = _get_user_profile_id(request)
    if user_profile_id:
        try:
            from .personalization import apply_personalization_boost
            feed_items = apply_personalization_boost(feed_items, user_profile_id)
        except Exception:
            logger.exception('Personalization failed')
        try:
            feed_items = _apply_user_feed_preferences(feed_items, user_profile_id)
            feed_items = _exclude_viewed_content(feed_items, user_profile_id)
            feed_items = _exclude_blocked_users(feed_items, user_profile_id)
            feed_items = _exclude_muted_words(feed_items, user_profile_id)
        except Exception:
            logger.exception('User feed filter failed')

    # Step 4b: Inject graph-ranked discovery posts (interest graph recommendations)
    if user_profile_id:
        try:
            from .feed_fanout import get_graph_ranked_feed
            graph_posts = get_graph_ranked_feed(user_profile_id, limit=3)
            if graph_posts:
                import random
                existing_post_ids = {item.get('post_post_id') for item in feed_items if item.get('post_post_id')}
                for graph_post in graph_posts:
                    graph_post_id = graph_post.get('link_post_id') or graph_post.get('post_post_id')
                    if graph_post_id and graph_post_id not in existing_post_ids:
                        graph_post['item_type'] = 'graph_discovery'
                        position = random.randint(4, min(12, len(feed_items)))
                        feed_items.insert(position, graph_post)
        except Exception:
            logger.exception('Graph-ranked discovery injection failed')

    # Step 5: Exclude auto-flagged content (classified as harmful)
    feed_items = [item for item in feed_items if not item.get('is_auto_flagged')]

    # Step 6: Deduplicate content (same content as published promo + boost)
    feed_items = _deduplicate_feed(feed_items)

    # Step 7: Category filter (if requested via ?category=poem)
    if category_filter:
        feed_items = _filter_by_category(feed_items, category_filter)

    return feed_items


def _inject_promo_cards(feed_items, request=None):
    """Single unified promo injection system.

    Algorithm:
      1. Pull ALL promo items from all category builders ONCE
      2. Apply user feed preferences (if logged in)
      3. Group by category, shuffle each group
      4. Round-robin pick to guarantee category diversity
      5. Inject at random positions spread across the feed

    No popularity bias. No session memory. Fresh on every page load.
    Replaces the old triple-system (promo + boost + trending) that caused
    the same popular content to repeat repeatedly."""
    from .promo_builders import build_all_promo_items

    if len(feed_items) < 6:
        return feed_items

    all_promos = build_all_promo_items()
    if not all_promos:
        return feed_items

    # Filter by user preferences (if logged in)
    user_profile_id = _get_user_profile_id(request) if request else None
    if user_profile_id:
        all_promos = _apply_user_feed_preferences(all_promos, user_profile_id)
        if not all_promos:
            return feed_items

    # Group promos by category for balanced selection
    category_buckets = {}
    for promo in all_promos:
        category_key = promo.get('promo_badge') or promo.get('item_type') or 'other'
        category_buckets.setdefault(category_key, []).append(promo)

    # Shuffle bucket order + shuffle within each bucket
    bucket_keys = list(category_buckets.keys())
    random.shuffle(bucket_keys)
    for key in bucket_keys:
        random.shuffle(category_buckets[key])

    # How many promos to inject — cap at 5 for variety, scale by feed length
    feed_length = len(feed_items)
    promo_slot_count = min(5, max(3, feed_length // 8))

    # Round-robin pick from buckets until we have enough or run out
    selected = []
    bucket_index = 0
    while len(selected) < promo_slot_count and bucket_keys:
        key = bucket_keys[bucket_index % len(bucket_keys)]
        bucket = category_buckets[key]
        if bucket:
            selected.append(bucket.pop(0))
            bucket_index += 1
        else:
            bucket_keys.remove(key)
            if not bucket_keys:
                break

    if not selected:
        return feed_items

    # Shuffle selected order — no predictable rhythm
    random.shuffle(selected)

    # Spread promos across the feed at random positions within evenly-spaced slots
    slot_count = len(selected)
    slot_size = max(4, feed_length // (slot_count + 1))
    for slot_index, promo in enumerate(selected):
        slot_start = (slot_index + 1) * slot_size - 2
        slot_end = (slot_index + 1) * slot_size + 2
        slot_start = max(2, slot_start)
        slot_end = min(feed_length, slot_end)
        if slot_start >= feed_length:
            break
        position = random.randint(slot_start, max(slot_start, slot_end))
        feed_items.insert(position, promo)

    return feed_items


def _exclude_viewed_content(feed_items, user_profile_id):
    """Remove POSTS the user has already viewed (last 200 views).
    Does NOT exclude promo cards — promos are meant to re-surface content
    regardless of view history."""
    from .models import FactFeedUserContentView

    recent_views = FactFeedUserContentView.objects.filter(
        link_user_profile_id=user_profile_id,
        is_active=True,
    ).order_by('-feed_viewed_at').values_list('feed_content_type_code', 'feed_content_id')[:200]

    viewed_keys = {f'{code}:{cid}' for code, cid in recent_views}
    if not viewed_keys:
        return feed_items

    promo_types = ('debate_promo', 'content_promo', 'tools_promo')
    return [
        item for item in feed_items
        if item.get('item_type') in promo_types or _get_content_key(item) not in viewed_keys
    ]


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

    return [
        item for item in feed_items
        if not any(word in (item.get('post_text') or item.get('promo_title') or '').lower() for word in muted_words)
    ]


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
    except Exception as preference_error:
        logger.error('Feed preference lookup failed for user %s — %s', user_profile_id, preference_error)
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


