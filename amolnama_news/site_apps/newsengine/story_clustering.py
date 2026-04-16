"""Story thread clustering — groups related news articles into developing stories.

100% local, zero API calls. Uses existing paraphrase-multilingual-MiniLM embeddings
(384-dim) for cosine similarity. Bengali + English supported natively.

Algorithm:
    1. On article publish, compute embedding (already done by article detail view)
    2. Compare article's embedding against all active story threads' centroid embeddings
    3. If similarity > THREAD_SIMILARITY_THRESHOLD → attach to that thread
    4. If no match → check if 2+ recent unattached articles cluster with this one → create new thread
    5. If still no match → leave unattached (not every article is part of a developing story)

Usage:
    from newsengine.story_clustering import assign_article_to_story_thread
    assign_article_to_story_thread(coll_news_entry_id)

    # Background version (non-blocking):
    from newsengine.story_clustering import assign_article_to_story_thread_background
    assign_article_to_story_thread_background(coll_news_entry_id)
"""

import json
import logging
import threading

from django.db import connection
from django.utils import timezone

logger = logging.getLogger(__name__)

# Minimum cosine similarity to attach an article to an existing thread
THREAD_SIMILARITY_THRESHOLD = 0.78

# Minimum similarity between two unattached articles to create a new thread
NEW_THREAD_SIMILARITY_THRESHOLD = 0.82

# Only consider articles from the last N days for new thread creation
NEW_THREAD_LOOKBACK_DAYS = 14

# Maximum articles to scan when looking for unattached clusters
MAX_UNATTACHED_SCAN = 50


def assign_article_to_story_thread(coll_news_entry_id):
    """Main entry point: try to attach an article to a story thread.

    Steps:
        1. Get this article's embedding
        2. Compare against active thread centroids → attach if match
        3. If no match, scan recent unattached articles → create thread if cluster found
        4. If still no match, article stays unattached (that's fine)
    """
    try:
        import numpy as np
    except ImportError:
        logger.warning('story_clustering: numpy not installed')
        return None

    # Step 1: get this article's embedding
    article_vector = _get_article_embedding(coll_news_entry_id)
    if article_vector is None:
        return None

    article_vector = np.array(article_vector, dtype=np.float32)

    # Step 2: compare against active threads
    matched_thread_id = _find_matching_thread(article_vector, coll_news_entry_id)
    if matched_thread_id:
        return matched_thread_id

    # Step 3: check for unattached cluster
    new_thread_id = _try_create_thread_from_unattached(
        article_vector, coll_news_entry_id
    )
    return new_thread_id


def assign_article_to_story_thread_background(coll_news_entry_id):
    """Non-blocking version — runs in background thread."""
    threading.Thread(
        target=assign_article_to_story_thread,
        args=(coll_news_entry_id,),
        daemon=True,
    ).start()


def _get_article_embedding(coll_news_entry_id):
    """Fetch the stored embedding vector for a news article.

    Articles are stored with content_type_code='article' and content_id=pub_article_id.
    But we receive coll_news_entry_id, so we need to look up the pub_article first,
    OR the embedding might be stored directly by coll_news_entry_id.
    We check both paths.
    """
    try:
        with connection.cursor() as cursor:
            # Try pub_article path first (article detail view stores with pub_article_id)
            cursor.execute("""
                SELECT e.embedding_vector_json
                FROM [newsengine].[fact_content_embedding] e
                JOIN [newshub].[pub_article] pa
                    ON pa.pub_article_id = e.embedding_content_id
                WHERE e.embedding_content_type_code = 'article'
                  AND pa.link_news_entry_id = %s
                  AND e.is_active = 1
            """, [coll_news_entry_id])
            row = cursor.fetchone()
            if row:
                return json.loads(row[0])

            # Fallback: try direct by coll_news_entry_id
            cursor.execute("""
                SELECT embedding_vector_json
                FROM [newsengine].[fact_content_embedding]
                WHERE embedding_content_type_code = 'article'
                  AND embedding_content_id = %s
                  AND is_active = 1
            """, [coll_news_entry_id])
            row = cursor.fetchone()
            if row:
                return json.loads(row[0])

    except Exception as embedding_error:
        logger.error('story_clustering: embedding lookup failed for entry %s — %s',
                     coll_news_entry_id, embedding_error)
    return None


def _get_thread_centroid_embeddings():
    """Get average embeddings for all active developing story threads.

    Centroid = average of all articles' embeddings in the thread.
    Returns list of (thread_id, centroid_vector_np).
    """
    try:
        import numpy as np
    except ImportError:
        return []

    try:
        with connection.cursor() as cursor:
            # Get all articles in active developing threads + their embeddings
            cursor.execute("""
                SELECT sta.link_story_thread_id, e.embedding_vector_json
                FROM [newsengine].[story_thread_article] sta
                JOIN [newsengine].[story_thread] st
                    ON st.newsengine_story_thread_id = sta.link_story_thread_id
                JOIN [newshub].[pub_article] pa
                    ON pa.link_news_entry_id = sta.link_newshub_coll_news_entry_id
                JOIN [newsengine].[fact_content_embedding] e
                    ON e.embedding_content_type_code = 'article'
                    AND e.embedding_content_id = pa.pub_article_id
                WHERE st.thread_status_code = 'developing'
                  AND st.is_active = 1
                  AND sta.is_active = 1
                  AND e.is_active = 1
            """)
            rows = cursor.fetchall()
    except Exception as centroid_error:
        logger.error('story_clustering: centroid query failed — %s', centroid_error)
        return []

    if not rows:
        return []

    # Group vectors by thread_id, compute centroid per thread
    thread_vectors = {}
    for thread_id, vector_json in rows:
        try:
            vector = json.loads(vector_json)
            if len(vector) == 384:
                thread_vectors.setdefault(thread_id, []).append(vector)
        except (json.JSONDecodeError, TypeError):
            continue

    centroids = []
    for thread_id, vectors in thread_vectors.items():
        centroid = np.mean(np.array(vectors, dtype=np.float32), axis=0)
        centroids.append((thread_id, centroid))

    return centroids


def _find_matching_thread(article_vector, coll_news_entry_id):
    """Compare article against active threads. Returns thread_id or None."""
    try:
        import numpy as np
    except ImportError:
        return None

    centroids = _get_thread_centroid_embeddings()
    if not centroids:
        return None

    best_thread_id = None
    best_similarity = 0.0

    article_norm = np.linalg.norm(article_vector)
    if article_norm == 0:
        return None

    for thread_id, centroid in centroids:
        centroid_norm = np.linalg.norm(centroid)
        if centroid_norm == 0:
            continue
        similarity = float(np.dot(article_vector, centroid) / (article_norm * centroid_norm))
        if similarity > best_similarity:
            best_similarity = similarity
            best_thread_id = thread_id

    if best_similarity >= THREAD_SIMILARITY_THRESHOLD and best_thread_id:
        _attach_article_to_thread(best_thread_id, coll_news_entry_id, best_similarity)
        logger.info('story_clustering: attached entry %s to thread %s (similarity=%.4f)',
                     coll_news_entry_id, best_thread_id, best_similarity)
        return best_thread_id

    return None


def _try_create_thread_from_unattached(article_vector, coll_news_entry_id):
    """Check if this article + any recent unattached article form a cluster.

    If we find at least 1 other unattached article with similarity > NEW_THREAD_SIMILARITY_THRESHOLD,
    create a new story thread with both articles.
    """
    try:
        import numpy as np
    except ImportError:
        return None

    # Find recent unattached articles with embeddings
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT TOP (%s) ne.newshub_coll_news_entry_id, e.embedding_vector_json,
                       ne.news_headline_bn, ne.news_headline_en
                FROM [newshub].[coll_news_entry] ne
                JOIN [newshub].[pub_article] pa
                    ON pa.link_news_entry_id = ne.newshub_coll_news_entry_id
                JOIN [newsengine].[fact_content_embedding] e
                    ON e.embedding_content_type_code = 'article'
                    AND e.embedding_content_id = pa.pub_article_id
                WHERE ne.created_at > DATEADD(DAY, -%s, GETDATE())
                  AND ne.newshub_coll_news_entry_id != %s
                  AND e.is_active = 1
                  AND NOT EXISTS (
                      SELECT 1 FROM [newsengine].[story_thread_article] sta
                      WHERE sta.link_newshub_coll_news_entry_id = ne.newshub_coll_news_entry_id
                        AND sta.is_active = 1
                  )
                ORDER BY ne.created_at DESC
            """, [MAX_UNATTACHED_SCAN, NEW_THREAD_LOOKBACK_DAYS, coll_news_entry_id])
            rows = cursor.fetchall()
    except Exception as scan_error:
        logger.error('story_clustering: unattached scan failed — %s', scan_error)
        return None

    if not rows:
        return None

    # Find the most similar unattached article
    article_norm = np.linalg.norm(article_vector)
    if article_norm == 0:
        return None

    best_match = None
    best_similarity = 0.0

    for entry_id, vector_json, headline_bn, headline_en in rows:
        try:
            other_vector = np.array(json.loads(vector_json), dtype=np.float32)
            if len(other_vector) != 384:
                continue
            other_norm = np.linalg.norm(other_vector)
            if other_norm == 0:
                continue
            similarity = float(np.dot(article_vector, other_vector) / (article_norm * other_norm))
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = (entry_id, headline_bn, headline_en)
        except (json.JSONDecodeError, TypeError):
            continue

    if best_similarity < NEW_THREAD_SIMILARITY_THRESHOLD or not best_match:
        return None

    # Create a new story thread from these two articles
    other_entry_id, other_headline_bn, other_headline_en = best_match

    # Get current article's headline for thread title
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT news_headline_bn, news_headline_en
                FROM [newshub].[coll_news_entry]
                WHERE newshub_coll_news_entry_id = %s
            """, [coll_news_entry_id])
            row = cursor.fetchone()
            current_headline_bn = (row[0] or '') if row else ''
            current_headline_en = (row[1] or '') if row else ''
    except Exception:
        current_headline_bn = ''
        current_headline_en = ''

    # Thread title = first article's headline (simple but effective)
    thread_title_bn = current_headline_bn[:300] or other_headline_bn[:300] or 'সম্পর্কিত সংবাদ'
    thread_title_en = current_headline_en[:300] or other_headline_en[:300] or 'Related News'

    # Generate slug from English title
    from amolnama_news.site_apps.core.utils import english_slug_from_text
    thread_slug = english_slug_from_text(text_bn=thread_title_en or thread_title_bn)[:200]
    if not thread_slug:
        thread_slug = f'thread-{coll_news_entry_id}'

    now = timezone.now()

    try:
        with connection.cursor() as cursor:
            # Create the thread
            cursor.execute("""
                INSERT INTO [newsengine].[story_thread]
                    ([thread_title_bn], [thread_title_en], [thread_slug],
                     [thread_status_code], [thread_article_count],
                     [is_active], [created_at])
                VALUES (%s, %s, %s, 'developing', 2, 1, %s)
            """, [thread_title_bn, thread_title_en, thread_slug, now])

            # Get the new thread ID
            cursor.execute("SELECT SCOPE_IDENTITY()")
            new_thread_id = int(cursor.fetchone()[0])

            # Attach both articles
            cursor.execute("""
                INSERT INTO [newsengine].[story_thread_article]
                    ([link_story_thread_id], [link_newshub_coll_news_entry_id],
                     [similarity_score], [is_active], [created_at])
                VALUES (%s, %s, %s, 1, %s), (%s, %s, %s, 1, %s)
            """, [
                new_thread_id, coll_news_entry_id, round(best_similarity, 4), now,
                new_thread_id, other_entry_id, round(best_similarity, 4), now,
            ])

        logger.info('story_clustering: created thread %s (%s) with entries %s + %s (similarity=%.4f)',
                     new_thread_id, thread_slug, coll_news_entry_id, other_entry_id, best_similarity)
        return new_thread_id

    except Exception as create_error:
        logger.error('story_clustering: thread creation failed — %s', create_error)
        return None


def _attach_article_to_thread(thread_id, coll_news_entry_id, similarity_score):
    """Attach an article to an existing story thread and increment count."""
    now = timezone.now()
    try:
        with connection.cursor() as cursor:
            # Insert the link (unique index prevents duplicates)
            cursor.execute("""
                INSERT INTO [newsengine].[story_thread_article]
                    ([link_story_thread_id], [link_newshub_coll_news_entry_id],
                     [similarity_score], [is_active], [created_at])
                VALUES (%s, %s, %s, 1, %s)
            """, [thread_id, coll_news_entry_id, round(similarity_score, 4), now])

            # Update article count
            cursor.execute("""
                UPDATE [newsengine].[story_thread]
                SET [thread_article_count] = [thread_article_count] + 1,
                    [updated_at] = %s
                WHERE [newsengine_story_thread_id] = %s
            """, [now, thread_id])
    except Exception as attach_error:
        # Unique constraint violation = already attached, ignore
        if '2601' in str(attach_error) or '2627' in str(attach_error):
            logger.debug('story_clustering: entry %s already in thread %s',
                         coll_news_entry_id, thread_id)
        else:
            logger.error('story_clustering: attach failed for entry %s to thread %s — %s',
                         coll_news_entry_id, thread_id, attach_error)


def get_story_thread_for_article(coll_news_entry_id):
    """Get the story thread(s) an article belongs to. Returns list of dicts."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT st.newsengine_story_thread_id, st.thread_title_bn,
                       st.thread_title_en, st.thread_slug,
                       st.thread_article_count, st.thread_status_code
                FROM [newsengine].[story_thread] st
                JOIN [newsengine].[story_thread_article] sta
                    ON sta.link_story_thread_id = st.newsengine_story_thread_id
                WHERE sta.link_newshub_coll_news_entry_id = %s
                  AND sta.is_active = 1
                  AND st.is_active = 1
                ORDER BY st.created_at DESC
            """, [coll_news_entry_id])
            rows = cursor.fetchall()
            return [
                {
                    'thread_id': row[0],
                    'title_bn': row[1],
                    'title_en': row[2],
                    'slug': row[3],
                    'article_count': row[4],
                    'status_code': row[5],
                }
                for row in rows
            ]
    except Exception as query_error:
        logger.error('story_clustering: thread lookup failed for entry %s — %s',
                     coll_news_entry_id, query_error)
        return []


def get_articles_in_thread(thread_id, limit=20, exclude_entry_id=None):
    """Get all articles in a story thread. For "Full Coverage" display."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT ne.newshub_coll_news_entry_id, ne.news_headline_bn,
                       ne.news_headline_en, pa.pub_article_slug, ne.created_at,
                       sta.similarity_score
                FROM [newsengine].[story_thread_article] sta
                JOIN [newshub].[coll_news_entry] ne
                    ON ne.newshub_coll_news_entry_id = sta.link_newshub_coll_news_entry_id
                JOIN [newshub].[pub_article] pa
                    ON pa.link_news_entry_id = ne.newshub_coll_news_entry_id
                WHERE sta.link_story_thread_id = %s
                  AND sta.is_active = 1
                  AND pa.is_active = 1
                  AND pa.is_published = 1
                ORDER BY ne.created_at DESC
                OFFSET 0 ROWS FETCH NEXT %s ROWS ONLY
            """, [thread_id, limit])
            rows = cursor.fetchall()
            return [
                {
                    'entry_id': row[0],
                    'headline_bn': row[1],
                    'headline_en': row[2],
                    'slug': row[3],
                    'created_at': row[4],
                    'similarity_score': float(row[5] or 0),
                    'url': f'/newshub/article/{row[3]}/' if row[3] else '/newshub/',
                }
                for row in rows
                if not exclude_entry_id or row[0] != exclude_entry_id
            ]
    except Exception as query_error:
        logger.error('story_clustering: articles_in_thread query failed for thread %s — %s',
                     thread_id, query_error)
        return []
