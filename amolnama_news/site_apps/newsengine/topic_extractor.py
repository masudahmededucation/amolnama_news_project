"""Topic extractor — auto-tag posts with topics for the interest graph.

Extracts topics from post text using:
1. Hashtags (#topic) — already extracted by hashtag system, synced to graph
2. Keyword matching — matches against existing topic nodes
3. Content category — uses content_category_code if set

Creates graph_post_belongs_to_topic edges for each extracted topic.

Usage:
    from newsengine.topic_extractor import extract_and_link_post_topics
    extract_and_link_post_topics(post_post_id, post_text, author_user_profile_id)
"""

import logging
import re
import unicodedata

from django.db import connection

logger = logging.getLogger(__name__)


def _normalize_topic_text(text):
    """NFC normalize + lowercase for consistent matching."""
    if not text:
        return ''
    return unicodedata.normalize('NFC', text.strip().lower())


def extract_and_link_post_topics(post_post_id, post_text, author_user_profile_id,
                                  content_category_code=None, created_at=None):
    """Extract topics from post text and create graph edges.

    1. Create post node in graph
    2. Extract hashtags → link to topic nodes
    3. Match existing topic nodes by keyword presence in text
    4. Link content category as a topic if set
    """
    from .interest_graph import create_post_node, link_post_to_topic

    # Step 1: Ensure post node exists
    create_post_node(post_post_id, author_user_profile_id, created_at)

    if not post_text:
        return

    extracted_topics = set()

    # Step 2: Extract hashtags
    hashtag_pattern = re.compile(r'#([\w\u0980-\u09FF]+)', re.UNICODE)
    hashtags = hashtag_pattern.findall(post_text)
    for hashtag in hashtags:
        normalized_hashtag = _normalize_topic_text(hashtag)
        if normalized_hashtag and len(normalized_hashtag) >= 2:
            extracted_topics.add(normalized_hashtag)

    # Step 3: Match existing topic nodes by keyword presence
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT topic_name_normalized
                FROM [newsengine].[graph_topic_node]
                WHERE is_active = 1
                  AND topic_post_count >= 2
            """)
            existing_topics = cursor.fetchall()

        normalized_post_text = _normalize_topic_text(post_text)
        for topic_row in existing_topics:
            topic_name = topic_row[0]
            if topic_name and topic_name in normalized_post_text:
                extracted_topics.add(topic_name)
    except Exception as match_error:
        logger.error('topic_extractor: keyword matching failed for post %s — %s',
                     post_post_id, match_error)

    # Step 4: Add content category as topic
    if content_category_code and content_category_code != 'safe':
        category_normalized = _normalize_topic_text(content_category_code)
        if category_normalized:
            extracted_topics.add(category_normalized)

    # Step 5: Create edges for all extracted topics
    for topic_name_normalized in extracted_topics:
        link_post_to_topic(post_post_id, topic_name_normalized, relevance_score=1.0)

    if extracted_topics:
        logger.info('topic_extractor: post %s linked to %d topics: %s',
                     post_post_id, len(extracted_topics), ', '.join(extracted_topics))


def extract_and_link_post_topics_background(post_post_id, post_text, author_user_profile_id,
                                             content_category_code=None, created_at=None):
    """Non-blocking version — runs extraction in background thread."""
    import threading
    threading.Thread(
        target=extract_and_link_post_topics,
        args=(post_post_id, post_text, author_user_profile_id),
        kwargs={'content_category_code': content_category_code, 'created_at': created_at},
        daemon=True,
    ).start()


def sync_hashtags_to_graph(post_post_id, hashtag_texts):
    """Sync already-extracted hashtags to the graph.
    Called after the existing hashtag extraction system runs."""
    from .interest_graph import ensure_topic_node_exists, link_post_to_topic

    for hashtag_text in hashtag_texts:
        normalized = _normalize_topic_text(hashtag_text)
        if normalized and len(normalized) >= 2:
            ensure_topic_node_exists(normalized, topic_name=hashtag_text)
            link_post_to_topic(post_post_id, normalized)
