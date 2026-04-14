"""Interest graph engine — MS SQL Graph edge CRUD for the Twitter-style interest engine.

Manages graph edges:
- graph_user_follows_user: synced when user follows/unfollows
- graph_user_interested_in_topic: updated from dwell time + engagement
- graph_post_belongs_to_topic: created when post is auto-tagged with topics
- graph_user_dwell_on_post: upserted on each dwell time report

All operations use raw SQL with MATCH syntax for graph traversal.
Django ORM cannot handle $node_id / $from_id / $to_id columns.
"""

import logging
import threading

from django.db import connection
from django.utils import timezone

logger = logging.getLogger(__name__)

# Interest weight increment per action
WEIGHT_INCREMENT_DWELL_PER_SECOND = 0.01    # 10s dwell = +0.1 weight
WEIGHT_INCREMENT_LIKE = 0.3
WEIGHT_INCREMENT_BOOKMARK = 0.4
WEIGHT_INCREMENT_REPOST = 0.5
WEIGHT_INCREMENT_REPLY = 0.2
WEIGHT_MAX = 10.0  # Cap to prevent runaway weights


# =========================================================
# USER NODE — ensure user exists in graph
# =========================================================

def ensure_user_node_exists(user_profile_id):
    """Create graph_user_node if not exists. Called on first interaction."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                IF NOT EXISTS (
                    SELECT 1 FROM [newsengine].[graph_user_node]
                    WHERE link_user_profile_id = %s
                )
                INSERT INTO [newsengine].[graph_user_node] (link_user_profile_id)
                VALUES (%s)
            """, [user_profile_id, user_profile_id])
    except Exception as node_error:
        logger.error('interest_graph: ensure_user_node failed for %s — %s',
                     user_profile_id, node_error)


# =========================================================
# POST NODE — create when post is published
# =========================================================

def create_post_node(post_post_id, author_user_profile_id, created_at=None):
    """Create graph_post_node for a new post."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                IF NOT EXISTS (
                    SELECT 1 FROM [newsengine].[graph_post_node]
                    WHERE link_post_id = %s
                )
                INSERT INTO [newsengine].[graph_post_node]
                    (link_post_id, link_author_user_profile_id, post_created_at)
                VALUES (%s, %s, %s)
            """, [post_post_id, post_post_id, author_user_profile_id,
                  created_at or timezone.now()])
    except Exception as node_error:
        logger.error('interest_graph: create_post_node failed for post %s — %s',
                     post_post_id, node_error)


# =========================================================
# TOPIC NODE — create or get topic
# =========================================================

def ensure_topic_node_exists(topic_name_normalized, topic_name=None, hashtag_item_id=None):
    """Create graph_topic_node if not exists. Returns True if created, False if existed."""
    if not topic_name:
        topic_name = topic_name_normalized
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                IF NOT EXISTS (
                    SELECT 1 FROM [newsengine].[graph_topic_node]
                    WHERE topic_name_normalized = %s
                )
                INSERT INTO [newsengine].[graph_topic_node]
                    (topic_name, topic_name_normalized, link_hashtag_item_id, created_at)
                VALUES (%s, %s, %s, GETDATE())
            """, [topic_name_normalized, topic_name, topic_name_normalized, hashtag_item_id])
        return True
    except Exception as topic_error:
        logger.error('interest_graph: ensure_topic_node failed for %s — %s',
                     topic_name_normalized, topic_error)
        return False


# =========================================================
# FOLLOW EDGE — sync with social.user_follow
# =========================================================

def create_follow_edge(follower_user_profile_id, following_user_profile_id):
    """Create graph_user_follows_user edge when user follows another."""
    ensure_user_node_exists(follower_user_profile_id)
    ensure_user_node_exists(following_user_profile_id)
    try:
        with connection.cursor() as cursor:
            # Check if edge already exists
            cursor.execute("""
                SELECT COUNT(1)
                FROM [newsengine].[graph_user_node] u1,
                     [newsengine].[graph_user_follows_user] f,
                     [newsengine].[graph_user_node] u2
                WHERE MATCH(u1-(f)->u2)
                  AND u1.link_user_profile_id = %s
                  AND u2.link_user_profile_id = %s
            """, [follower_user_profile_id, following_user_profile_id])
            if cursor.fetchone()[0] > 0:
                return  # Edge already exists

            cursor.execute("""
                INSERT INTO [newsengine].[graph_user_follows_user]
                    ($from_id, $to_id, followed_at)
                VALUES (
                    (SELECT $node_id FROM [newsengine].[graph_user_node]
                     WHERE link_user_profile_id = %s),
                    (SELECT $node_id FROM [newsengine].[graph_user_node]
                     WHERE link_user_profile_id = %s),
                    GETDATE()
                )
            """, [follower_user_profile_id, following_user_profile_id])
    except Exception as follow_error:
        logger.error('interest_graph: create_follow_edge failed %s→%s — %s',
                     follower_user_profile_id, following_user_profile_id, follow_error)


def remove_follow_edge(follower_user_profile_id, following_user_profile_id):
    """Remove graph_user_follows_user edge when user unfollows."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                DELETE f
                FROM [newsengine].[graph_user_node] u1,
                     [newsengine].[graph_user_follows_user] f,
                     [newsengine].[graph_user_node] u2
                WHERE MATCH(u1-(f)->u2)
                  AND u1.link_user_profile_id = %s
                  AND u2.link_user_profile_id = %s
            """, [follower_user_profile_id, following_user_profile_id])
    except Exception as unfollow_error:
        logger.error('interest_graph: remove_follow_edge failed %s→%s — %s',
                     follower_user_profile_id, following_user_profile_id, unfollow_error)


# =========================================================
# POST → TOPIC EDGE — link post to its topics
# =========================================================

def link_post_to_topic(post_post_id, topic_name_normalized, relevance_score=1.0):
    """Create graph_post_belongs_to_topic edge."""
    ensure_topic_node_exists(topic_name_normalized)
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [newsengine].[graph_post_belongs_to_topic]
                    ($from_id, $to_id, relevance_score, tagged_at)
                VALUES (
                    (SELECT $node_id FROM [newsengine].[graph_post_node]
                     WHERE link_post_id = %s),
                    (SELECT $node_id FROM [newsengine].[graph_topic_node]
                     WHERE topic_name_normalized = %s),
                    %s, GETDATE()
                )
            """, [post_post_id, topic_name_normalized, relevance_score])

            # Increment topic post count
            cursor.execute("""
                UPDATE [newsengine].[graph_topic_node]
                SET topic_post_count = topic_post_count + 1
                WHERE topic_name_normalized = %s
            """, [topic_name_normalized])
    except Exception as link_error:
        logger.error('interest_graph: link_post_to_topic failed post %s → topic %s — %s',
                     post_post_id, topic_name_normalized, link_error)


# =========================================================
# DWELL TIME → INTEREST WEIGHT
# =========================================================

def record_dwell_time(user_profile_id, post_post_id, dwell_duration_seconds):
    """Record dwell time and update interest weights for post's topics.

    1. Log raw dwell time
    2. Upsert graph_user_dwell_on_post edge (UPDATE if exists, INSERT if not)
    3. Increase graph_user_interested_in_topic weight for post's topics
    """
    if dwell_duration_seconds < 2:
        return  # Ignore very short views

    ensure_user_node_exists(user_profile_id)

    # Ensure post node exists (may not have been created if post predates graph)
    try:
        from amolnama_news.site_apps.post.models import Post
        post_record = Post.objects.filter(post_post_id=post_post_id).only('link_user_profile_id').first()
        if post_record:
            create_post_node(post_post_id, post_record.link_user_profile_id)
    except Exception:
        pass  # Non-critical — dwell edge insert will fail gracefully below

    # Step 1: Log raw dwell time
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [newsengine].[fact_user_dwell_time_log]
                    (link_user_profile_id, link_post_id, dwell_duration_seconds)
                VALUES (%s, %s, %s)
            """, [user_profile_id, post_post_id, dwell_duration_seconds])
    except Exception as log_error:
        logger.error('interest_graph: dwell log failed user %s post %s — %s',
                     user_profile_id, post_post_id, log_error)

    # Step 2: Upsert dwell edge (UPDATE existing, INSERT new)
    try:
        with connection.cursor() as cursor:
            # Check if edge exists
            cursor.execute("""
                SELECT COUNT(1)
                FROM [newsengine].[graph_user_node] u,
                     [newsengine].[graph_user_dwell_on_post] d,
                     [newsengine].[graph_post_node] p
                WHERE MATCH(u-(d)->p)
                  AND u.link_user_profile_id = %s
                  AND p.link_post_id = %s
            """, [user_profile_id, post_post_id])
            edge_exists = cursor.fetchone()[0] > 0

            if edge_exists:
                cursor.execute("""
                    UPDATE d
                    SET d.dwell_duration_seconds = d.dwell_duration_seconds + %s,
                        d.dwell_count = d.dwell_count + 1,
                        d.dwell_last_at = GETDATE()
                    FROM [newsengine].[graph_user_node] u,
                         [newsengine].[graph_user_dwell_on_post] d,
                         [newsengine].[graph_post_node] p
                    WHERE MATCH(u-(d)->p)
                      AND u.link_user_profile_id = %s
                      AND p.link_post_id = %s
                """, [dwell_duration_seconds, user_profile_id, post_post_id])
            else:
                cursor.execute("""
                    INSERT INTO [newsengine].[graph_user_dwell_on_post]
                        ($from_id, $to_id, dwell_duration_seconds, dwell_count, dwell_last_at)
                    VALUES (
                        (SELECT $node_id FROM [newsengine].[graph_user_node]
                         WHERE link_user_profile_id = %s),
                        (SELECT $node_id FROM [newsengine].[graph_post_node]
                         WHERE link_post_id = %s),
                        %s, 1, GETDATE()
                    )
                """, [user_profile_id, post_post_id, dwell_duration_seconds])
    except Exception as dwell_error:
        logger.error('interest_graph: dwell edge upsert failed user %s post %s — %s',
                     user_profile_id, post_post_id, dwell_error)

    # Step 3: Update interest weights for post's topics
    weight_increment = dwell_duration_seconds * WEIGHT_INCREMENT_DWELL_PER_SECOND
    _update_interest_weights_for_post_topics(user_profile_id, post_post_id, weight_increment)


def record_engagement_interest(user_profile_id, post_post_id, engagement_type):
    """Update interest weights when user likes/bookmarks/reposts/replies to a post.

    Args:
        engagement_type: 'like', 'bookmark', 'repost', 'reply'
    """
    weight_map = {
        'like': WEIGHT_INCREMENT_LIKE,
        'bookmark': WEIGHT_INCREMENT_BOOKMARK,
        'repost': WEIGHT_INCREMENT_REPOST,
        'reply': WEIGHT_INCREMENT_REPLY,
    }
    weight_increment = weight_map.get(engagement_type, 0.1)
    ensure_user_node_exists(user_profile_id)
    _update_interest_weights_for_post_topics(user_profile_id, post_post_id, weight_increment)


def _update_interest_weights_for_post_topics(user_profile_id, post_post_id, weight_increment):
    """Find all topics linked to a post and increase user's interest weight for each."""
    try:
        with connection.cursor() as cursor:
            # Get topics for this post via graph
            cursor.execute("""
                SELECT t.topic_name_normalized
                FROM [newsengine].[graph_post_node] p,
                     [newsengine].[graph_post_belongs_to_topic] pt,
                     [newsengine].[graph_topic_node] t
                WHERE MATCH(p-(pt)->t)
                  AND p.link_post_id = %s
                  AND t.is_active = 1
            """, [post_post_id])
            topic_rows = cursor.fetchall()

            if not topic_rows:
                return

            for topic_row in topic_rows:
                topic_name_normalized = topic_row[0]
                _upsert_interest_edge(user_profile_id, topic_name_normalized, weight_increment)

    except Exception as topic_error:
        logger.error('interest_graph: _update_interest_weights failed user %s post %s — %s',
                     user_profile_id, post_post_id, topic_error)


def _upsert_interest_edge(user_profile_id, topic_name_normalized, weight_increment):
    """Upsert graph_user_interested_in_topic edge — UPDATE weight if exists, INSERT if not."""
    try:
        with connection.cursor() as cursor:
            # Check if interest edge exists
            cursor.execute("""
                SELECT COUNT(1)
                FROM [newsengine].[graph_user_node] u,
                     [newsengine].[graph_user_interested_in_topic] i,
                     [newsengine].[graph_topic_node] t
                WHERE MATCH(u-(i)->t)
                  AND u.link_user_profile_id = %s
                  AND t.topic_name_normalized = %s
            """, [user_profile_id, topic_name_normalized])
            edge_exists = cursor.fetchone()[0] > 0

            if edge_exists:
                # Update — cap at WEIGHT_MAX
                cursor.execute("""
                    UPDATE i
                    SET i.interest_weight = CASE
                            WHEN i.interest_weight + %s > %s THEN %s
                            ELSE i.interest_weight + %s
                        END,
                        i.interest_last_updated_at = GETDATE()
                    FROM [newsengine].[graph_user_node] u,
                         [newsengine].[graph_user_interested_in_topic] i,
                         [newsengine].[graph_topic_node] t
                    WHERE MATCH(u-(i)->t)
                      AND u.link_user_profile_id = %s
                      AND t.topic_name_normalized = %s
                """, [weight_increment, WEIGHT_MAX, WEIGHT_MAX, weight_increment,
                      user_profile_id, topic_name_normalized])
            else:
                # Insert new interest edge
                cursor.execute("""
                    INSERT INTO [newsengine].[graph_user_interested_in_topic]
                        ($from_id, $to_id, interest_weight, interest_last_updated_at)
                    VALUES (
                        (SELECT $node_id FROM [newsengine].[graph_user_node]
                         WHERE link_user_profile_id = %s),
                        (SELECT $node_id FROM [newsengine].[graph_topic_node]
                         WHERE topic_name_normalized = %s),
                        %s, GETDATE()
                    )
                """, [user_profile_id, topic_name_normalized, weight_increment])
    except Exception as upsert_error:
        logger.error('interest_graph: _upsert_interest_edge failed user %s topic %s — %s',
                     user_profile_id, topic_name_normalized, upsert_error)


# =========================================================
# BACKGROUND THREAD WRAPPERS
# =========================================================

def record_dwell_time_background(user_profile_id, post_post_id, dwell_duration_seconds):
    """Non-blocking dwell time recording."""
    threading.Thread(
        target=record_dwell_time,
        args=(user_profile_id, post_post_id, dwell_duration_seconds),
        daemon=True,
    ).start()


def record_engagement_interest_background(user_profile_id, post_post_id, engagement_type):
    """Non-blocking engagement interest update."""
    threading.Thread(
        target=record_engagement_interest,
        args=(user_profile_id, post_post_id, engagement_type),
        daemon=True,
    ).start()


def sync_follow_to_graph_background(follower_user_profile_id, following_user_profile_id, is_following):
    """Non-blocking follow/unfollow graph sync."""
    if is_following:
        threading.Thread(
            target=create_follow_edge,
            args=(follower_user_profile_id, following_user_profile_id),
            daemon=True,
        ).start()
    else:
        threading.Thread(
            target=remove_follow_edge,
            args=(follower_user_profile_id, following_user_profile_id),
            daemon=True,
        ).start()
