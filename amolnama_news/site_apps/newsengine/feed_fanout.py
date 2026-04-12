"""Feed fanout — pre-compute personalized feed using MS SQL Graph.

When a post is created, fan it out to interested users' feed caches.
Uses the GetPersonalizedFeed stored procedure for graph-based ranking,
plus direct fan-out for followers and breaking news.

Usage:
    from newsengine.feed_fanout import fanout_post_to_interested_users
    fanout_post_to_interested_users(post_post_id, author_user_profile_id)
"""

import logging
import threading

from django.db import connection

logger = logging.getLogger(__name__)

# Feed cache reason IDs (match ref_feed_cache_reason)
REASON_INTEREST = 1
REASON_FOLLOWING = 2
REASON_BREAKING = 3
REASON_TRENDING = 4

# Max users to fan out to per post (prevent runaway on viral posts)
MAX_FANOUT_USERS = 5000


def fanout_post_to_interested_users(post_post_id, author_user_profile_id, is_breaking=False):
    """Fan out a new post to interested users' feed caches.

    Strategy:
    1. Followers: all users who follow the author get the post
    2. Interest match: users interested in the post's topics get the post
    3. Breaking: if flagged, push to all active users
    """
    _fanout_to_followers(post_post_id, author_user_profile_id)
    _fanout_to_interested_users_by_topic(post_post_id, author_user_profile_id)
    _notify_followers_of_new_content(post_post_id, author_user_profile_id)

    if is_breaking:
        _fanout_breaking_news(post_post_id)


def _fanout_to_followers(post_post_id, author_user_profile_id):
    """Insert post into feed cache for ACTIVE followers of the author.

    Dormant followers (last_active_at > 14 days ago or NULL) are skipped.
    When they return, the fallback pipeline in feed_builder.py builds their
    feed from scratch — zero wasted writes for users who aren't watching.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [newsengine].[fact_user_feed_cache]
                    (link_user_profile_id, link_post_id, feed_cache_score,
                     link_feed_cache_reason_id, is_active, created_at)
                SELECT TOP (%s)
                    uf.link_follower_user_profile_id,
                    %s,
                    1.0,
                    %s,
                    1,
                    GETDATE()
                FROM [social].[user_follow] uf
                JOIN [account].[user_profile] up
                    ON up.user_profile_id = uf.link_follower_user_profile_id
                WHERE uf.link_following_user_profile_id = %s
                  AND uf.is_active = 1
                  AND up.last_active_at > DATEADD(DAY, -14, GETDATE())
                  AND NOT EXISTS (
                      SELECT 1 FROM [newsengine].[fact_user_feed_cache] fc
                      WHERE fc.link_user_profile_id = uf.link_follower_user_profile_id
                        AND fc.link_post_id = %s
                  )
            """, [MAX_FANOUT_USERS, post_post_id, REASON_FOLLOWING,
                  author_user_profile_id, post_post_id])
            follower_count = cursor.rowcount
            if follower_count > 0:
                logger.info('feed_fanout: post %s fanned out to %d active followers',
                             post_post_id, follower_count)
    except Exception as follower_error:
        logger.error('feed_fanout: follower fanout failed for post %s — %s',
                     post_post_id, follower_error)


def _notify_followers_of_new_content(post_post_id, author_user_profile_id):
    """Send in-app notification to all followers when author publishes new content.
    Notification includes writer name and post title/text preview."""
    try:
        from amolnama_news.site_apps.user_account.models import UserProfile
        from amolnama_news.site_apps.post.models import Post

        author_profile = UserProfile.objects.filter(
            user_profile_id=author_user_profile_id
        ).first()
        if not author_profile:
            return

        post = Post.objects.filter(post_post_id=post_post_id).first()
        if not post:
            return

        author_display_name = author_profile.display_name or 'ব্যবহারকারী'
        post_title = (post.post_text or '')[:80]
        notification_message = f'{author_display_name} নতুন পোস্ট করেছেন: {post_title}'
        notification_url = f'/post/{post_post_id}/'

        # Bulk insert notifications for ACTIVE followers only
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [newsengine].[notification_item]
                    (link_recipient_user_profile_id, link_actor_user_profile_id,
                     notification_event_code, notification_source_app,
                     link_notification_content_id, notification_message,
                     notification_url, is_read, is_active, created_at)
                SELECT
                    uf.link_follower_user_profile_id,
                    %s,
                    'new_post',
                    'post',
                    %s,
                    %s,
                    %s,
                    0,
                    1,
                    GETDATE()
                FROM [social].[user_follow] uf
                JOIN [account].[user_profile] up
                    ON up.user_profile_id = uf.link_follower_user_profile_id
                WHERE uf.link_following_user_profile_id = %s
                  AND uf.is_active = 1
                  AND up.last_active_at > DATEADD(DAY, -14, GETDATE())
            """, [
                author_user_profile_id, post_post_id,
                notification_message, notification_url,
                author_user_profile_id,
            ])
            notification_count = cursor.rowcount
            if notification_count > 0:
                logger.info('feed_fanout: sent %d notifications for post %s by %s',
                             notification_count, post_post_id, author_display_name)
    except Exception as notification_error:
        logger.error('feed_fanout: notification failed for post %s — %s',
                     post_post_id, notification_error)


def _fanout_to_interested_users_by_topic(post_post_id, author_user_profile_id):
    """Find ACTIVE users interested in this post's topics via graph MATCH and insert into feed cache."""
    try:
        with connection.cursor() as cursor:
            # Graph traversal: post → topic ← interested_in ← user
            # Gated by last_active_at — dormant users are skipped.
            cursor.execute("""
                INSERT INTO [newsengine].[fact_user_feed_cache]
                    (link_user_profile_id, link_post_id, feed_cache_score,
                     link_feed_cache_reason_id, is_active, created_at)
                SELECT DISTINCT TOP (%s)
                    u.link_user_profile_id,
                    %s,
                    i.interest_weight,
                    %s,
                    1,
                    GETDATE()
                FROM
                    [newsengine].[graph_post_node] p,
                    [newsengine].[graph_post_belongs_to_topic] pt,
                    [newsengine].[graph_topic_node] t,
                    [newsengine].[graph_user_interested_in_topic] i,
                    [newsengine].[graph_user_node] u
                JOIN [account].[user_profile] up
                    ON up.user_profile_id = u.link_user_profile_id
                WHERE MATCH(p-(pt)->t<-(i)-u)
                  AND p.link_post_id = %s
                  AND t.is_active = 1
                  AND u.link_user_profile_id != %s
                  AND i.interest_weight >= 0.3
                  AND up.last_active_at > DATEADD(DAY, -14, GETDATE())
                  AND NOT EXISTS (
                      SELECT 1 FROM [newsengine].[fact_user_feed_cache] fc
                      WHERE fc.link_user_profile_id = u.link_user_profile_id
                        AND fc.link_post_id = %s
                  )
            """, [MAX_FANOUT_USERS, post_post_id, REASON_INTEREST,
                  post_post_id, author_user_profile_id, post_post_id])
            interest_count = cursor.rowcount
            if interest_count > 0:
                logger.info('feed_fanout: post %s fanned out to %d active interested users',
                             post_post_id, interest_count)
    except Exception as interest_error:
        logger.error('feed_fanout: interest fanout failed for post %s — %s',
                     post_post_id, interest_error)


def _fanout_breaking_news(post_post_id):
    """Push breaking news to ACTIVE users' feed caches only."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [newsengine].[fact_user_feed_cache]
                    (link_user_profile_id, link_post_id, feed_cache_score,
                     link_feed_cache_reason_id, is_active, created_at)
                SELECT TOP (%s)
                    gu.link_user_profile_id,
                    %s,
                    10.0,
                    %s,
                    1,
                    GETDATE()
                FROM [newsengine].[graph_user_node] gu
                JOIN [account].[user_profile] up
                    ON up.user_profile_id = gu.link_user_profile_id
                WHERE up.last_active_at > DATEADD(DAY, -14, GETDATE())
                  AND NOT EXISTS (
                    SELECT 1 FROM [newsengine].[fact_user_feed_cache] fc
                    WHERE fc.link_user_profile_id = gu.link_user_profile_id
                      AND fc.link_post_id = %s
                )
            """, [MAX_FANOUT_USERS, post_post_id, REASON_BREAKING, post_post_id])
            breaking_count = cursor.rowcount
            if breaking_count > 0:
                logger.info('feed_fanout: breaking news post %s pushed to %d active users',
                             post_post_id, breaking_count)
    except Exception as breaking_error:
        logger.error('feed_fanout: breaking news fanout failed for post %s — %s',
                     post_post_id, breaking_error)


def get_cached_feed_for_user(user_profile_id, limit=20, offset=0):
    """Read pre-computed feed from cache for a user.
    Returns list of (post_id, score, reason_code) tuples."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT fc.link_post_id, fc.feed_cache_score, r.feed_cache_reason_code
                FROM [newsengine].[fact_user_feed_cache] fc
                JOIN [newsengine].[ref_feed_cache_reason] r
                    ON fc.link_feed_cache_reason_id = r.feed_cache_reason_id
                WHERE fc.link_user_profile_id = %s
                  AND fc.is_active = 1
                ORDER BY fc.feed_cache_score DESC, fc.created_at DESC
                OFFSET %s ROWS FETCH NEXT %s ROWS ONLY
            """, [user_profile_id, offset, limit])
            return cursor.fetchall()
    except Exception as cache_error:
        logger.error('feed_fanout: get_cached_feed failed for user %s — %s',
                     user_profile_id, cache_error)
        return []


def get_graph_ranked_feed(user_profile_id, limit=20):
    """Call the GetPersonalizedFeed stored procedure for graph-ranked results.
    Returns list of dicts."""
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "EXEC [newsengine].[GetPersonalizedFeed] @UserId=%s, @Limit=%s",
                [user_profile_id, limit],
            )
            columns = [col[0] for col in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
    except Exception as graph_error:
        logger.error('feed_fanout: GetPersonalizedFeed failed for user %s — %s',
                     user_profile_id, graph_error)
        return []


def discover_topics_for_user(user_profile_id, limit=10):
    """Call the DiscoverTopicsFromFriends stored procedure.
    Returns list of dicts."""
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "EXEC [newsengine].[DiscoverTopicsFromFriends] @UserId=%s, @Limit=%s",
                [user_profile_id, limit],
            )
            columns = [col[0] for col in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
    except Exception as discover_error:
        logger.error('feed_fanout: DiscoverTopicsFromFriends failed for user %s — %s',
                     user_profile_id, discover_error)
        return []


def fanout_post_to_interested_users_background(post_post_id, author_user_profile_id,
                                                 is_breaking=False):
    """Non-blocking fan-out — runs in background thread."""
    threading.Thread(
        target=fanout_post_to_interested_users,
        args=(post_post_id, author_user_profile_id),
        kwargs={'is_breaking': is_breaking},
        daemon=True,
    ).start()


def cleanup_old_feed_cache(days_old=7):
    """Remove feed cache entries older than N days. Call periodically."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                DELETE FROM [newsengine].[fact_user_feed_cache]
                WHERE created_at < DATEADD(DAY, -%s, GETDATE())
            """, [days_old])
            deleted_count = cursor.rowcount
            if deleted_count > 0:
                logger.info('feed_fanout: cleaned up %d old feed cache entries', deleted_count)
    except Exception as cleanup_error:
        logger.error('feed_fanout: cleanup failed — %s', cleanup_error)
