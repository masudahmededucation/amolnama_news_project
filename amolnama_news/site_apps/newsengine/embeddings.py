"""Content embeddings — encode text as vectors for AI-driven discovery.

Uses sentence-transformers (paraphrase-multilingual-MiniLM-L12-v2) for Bengali + English support.
Vectors stored in [newsengine].[fact_content_embedding] as JSON arrays.
Similarity computed via numpy cosine similarity — no external vector DB needed.

Usage:
    from newsengine.embeddings import encode_and_store_embedding, find_similar_content

    # On post create (background thread):
    encode_and_store_embedding('post', post_id, post_text)

    # For recommendations:
    similar = find_similar_content('post', post_id, limit=5)
"""

import json
import logging
import threading

from django.db import connection
from django.utils import timezone

logger = logging.getLogger(__name__)

# Lazy-loaded model — heavy import (~500MB first time, ~150MB RAM after)
_embedding_model = None
_embedding_model_lock = threading.Lock()

MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'
EMBEDDING_DIMENSION = 384


def _get_embedding_model():
    """Lazy-load the sentence-transformers model. Thread-safe singleton."""
    global _embedding_model
    if _embedding_model is not None:
        return _embedding_model

    with _embedding_model_lock:
        if _embedding_model is not None:
            return _embedding_model
        # The model is small enough to ship cached in ~/.cache/huggingface
        # — once it's downloaded the first time, all further loads only
        # need to re-read the local cache. Set HF_HUB_OFFLINE=1 for the
        # process so huggingface_hub doesn't issue HEAD requests against
        # the public Hub on every load (which both adds latency AND emits
        # the "unauthenticated requests to the HF Hub" rate-limit warning
        # users were seeing on every chapter autosave). Safe because we
        # already pinned to a single MODEL_NAME — we never need to fetch
        # a new model at runtime. If the cache is missing, the user can
        # toggle this off briefly to re-download.
        import os
        os.environ.setdefault('HF_HUB_OFFLINE', '1')
        try:
            from sentence_transformers import SentenceTransformer
            _embedding_model = SentenceTransformer(MODEL_NAME)
            logger.info('embeddings: loaded model %s', MODEL_NAME)
        except ImportError:
            logger.warning(
                'embeddings: sentence-transformers not installed. '
                'Run: pip install sentence-transformers'
            )
            return None
        except Exception as model_error:
            logger.error('embeddings: failed to load model — %s', model_error)
            return None
    return _embedding_model


def encode_text(text):
    """Encode text to a 384-dimensional float vector. Returns list of floats or None."""
    if not text or not text.strip():
        return None

    model = _get_embedding_model()
    if model is None:
        return None

    try:
        vector = model.encode(text, show_progress_bar=False)
        return vector.tolist()
    except Exception as encode_error:
        logger.error('embeddings: encode_text failed — %s', encode_error)
        return None


def encode_and_store_embedding(content_type_code, content_id, text):
    """Encode text and store vector in fact_content_embedding. Upsert pattern."""
    vector = encode_text(text)
    if vector is None:
        return False

    vector_json = json.dumps(vector)
    now = timezone.now()

    # The vector_json string is ~7 KB (384 floats). pyodbc auto-promotes
    # any string >2000 chars to SQL_WLONGVARCHAR (→ ntext on the wire),
    # and SQL Server rejects that against the DB-default UTF-8 collation
    # (Latin1_General_100_CI_AS_SC_UTF8) at the parameter-binding stage —
    # BEFORE the CAST inside the query runs. The CAST workaround can't
    # save us. Documented in memory/troubleshooting.md §5b.
    #
    # Fix: bypass the Django cursor wrapper and use raw pyodbc with
    # setinputsizes() to force SQL_WVARCHAR for the vector_json param.
    # Use ? placeholders (pyodbc native) instead of %s.
    try:
        import pyodbc  # local import — keeps the no-pyodbc fallback path open
        connection.ensure_connection()
        raw_cursor = connection.connection.cursor()
        try:
            raw_cursor.setinputsizes([
                (pyodbc.SQL_WVARCHAR, 0, 0),  # vector_json — long Bengali-safe text
                None,                          # MODEL_NAME
                None,                          # EMBEDDING_DIMENSION
                None,                          # now
                None,                          # content_type_code
                None,                          # content_id
            ])
            raw_cursor.execute("""
                UPDATE [newsengine].[fact_content_embedding]
                SET embedding_vector_json = ?,
                    embedding_model_name = ?,
                    embedding_dimension_count = ?,
                    modified_at = ?,
                    is_active = 1
                WHERE embedding_content_type_code = ?
                  AND embedding_content_id = ?
            """, [vector_json, MODEL_NAME, EMBEDDING_DIMENSION, now,
                  content_type_code, content_id])

            if raw_cursor.rowcount == 0:
                raw_cursor.setinputsizes([
                    None,                          # content_type_code
                    None,                          # content_id
                    (pyodbc.SQL_WVARCHAR, 0, 0),  # vector_json
                    None,                          # MODEL_NAME
                    None,                          # EMBEDDING_DIMENSION
                    None,                          # now
                    None,                          # now
                ])
                raw_cursor.execute("""
                    INSERT INTO [newsengine].[fact_content_embedding]
                        (embedding_content_type_code, embedding_content_id,
                         embedding_vector_json, embedding_model_name,
                         embedding_dimension_count, is_active, created_at, modified_at)
                    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
                """, [content_type_code, content_id,
                      vector_json, MODEL_NAME, EMBEDDING_DIMENSION, now, now])
            connection.connection.commit()
        finally:
            raw_cursor.close()
        return True
    except Exception as store_error:
        logger.error('embeddings: store failed for %s:%s — %s',
                     content_type_code, content_id, store_error)
        return False


def encode_and_store_embedding_background(content_type_code, content_id, text):
    """Non-blocking version — runs encoding in background thread."""
    thread = threading.Thread(
        target=encode_and_store_embedding,
        args=(content_type_code, content_id, text),
        daemon=True,
    )
    thread.start()


def _cosine_similarity_top_n(target_vector, vectors, content_keys, limit, min_similarity=0.1):
    """Compute cosine similarity between target and matrix, return top N results.

    Args:
        target_vector: numpy array (384,)
        vectors: list of lists (N x 384)
        content_keys: list of (content_type_code, content_id) tuples, same order as vectors
        limit: max results to return
        min_similarity: minimum threshold (default 0.1)

    Returns list of dicts: [{'content_type_code', 'content_id', 'similarity'}, ...]
    """
    import numpy as np

    if not vectors:
        return []

    matrix = np.array(vectors, dtype=np.float32)
    target_norm = np.linalg.norm(target_vector)
    if target_norm == 0:
        return []

    matrix_norms = np.linalg.norm(matrix, axis=1)
    matrix_norms = np.where(matrix_norms == 0, 1, matrix_norms)
    similarities = np.dot(matrix, target_vector) / (matrix_norms * target_norm)

    top_indices = np.argsort(similarities)[::-1][:limit]

    results = []
    for index in top_indices:
        if similarities[index] > min_similarity:
            results.append({
                'content_type_code': content_keys[index][0] if isinstance(content_keys[index], tuple) else content_keys[index],
                'content_id': int(content_keys[index][1] if isinstance(content_keys[index], tuple) else content_keys[index]),
                'similarity': round(float(similarities[index]), 4),
            })
    return results


def find_similar_content(content_type_code, content_id, limit=5):
    """Find content similar to a given item using cosine similarity.

    Loads all embeddings of the same type, computes similarity in numpy.
    Returns list of dicts: [{'content_type_code': str, 'content_id': int, 'similarity': float}, ...]
    """
    try:
        import numpy as np
    except ImportError:
        logger.warning('embeddings: numpy not installed. Run: pip install numpy')
        return []

    # Get the target vector
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT embedding_vector_json
                FROM [newsengine].[fact_content_embedding]
                WHERE embedding_content_type_code = %s
                  AND embedding_content_id = %s
                  AND is_active = 1
            """, [content_type_code, content_id])
            row = cursor.fetchone()
    except Exception as query_error:
        logger.error('embeddings: find_similar query failed — %s', query_error)
        return []

    if not row:
        return []

    target_vector = np.array(json.loads(row[0]), dtype=np.float32)

    # Load all other embeddings of the same type
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT embedding_content_id, embedding_vector_json
                FROM [newsengine].[fact_content_embedding]
                WHERE embedding_content_type_code = %s
                  AND embedding_content_id != %s
                  AND is_active = 1
            """, [content_type_code, content_id])
            rows = cursor.fetchall()
    except Exception as query_error:
        logger.error('embeddings: find_similar bulk query failed — %s', query_error)
        return []

    if not rows:
        return []

    # Parse vectors and compute similarity via shared helper
    content_keys = []
    vectors = []
    for row in rows:
        try:
            vector = json.loads(row[1])
            if len(vector) == EMBEDDING_DIMENSION:
                content_keys.append((content_type_code, row[0]))
                vectors.append(vector)
        except (json.JSONDecodeError, TypeError):
            continue

    return _cosine_similarity_top_n(target_vector, vectors, content_keys, limit)


def find_similar_content_cross_type(text, limit=5, exclude_type=None, exclude_id=None):
    """Find similar content across ALL types by encoding a text query.

    Useful for: "related posts" on article pages, cross-app recommendations.
    """
    try:
        import numpy as np
    except ImportError:
        return []

    query_vector = encode_text(text)
    if query_vector is None:
        return []

    query_vector = np.array(query_vector, dtype=np.float32)

    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT embedding_content_type_code, embedding_content_id, embedding_vector_json
                FROM [newsengine].[fact_content_embedding]
                WHERE is_active = 1
            """)
            rows = cursor.fetchall()
    except Exception as query_error:
        logger.error('embeddings: cross-type query failed — %s', query_error)
        return []

    if not rows:
        return []

    content_keys = []
    vectors = []
    for row in rows:
        if exclude_type and exclude_id and row[0] == exclude_type and row[1] == exclude_id:
            continue
        try:
            vector = json.loads(row[2])
            if len(vector) == EMBEDDING_DIMENSION:
                content_keys.append((row[0], row[1]))
                vectors.append(vector)
        except (json.JSONDecodeError, TypeError):
            continue

    results = _cosine_similarity_top_n(query_vector, vectors, content_keys, limit)
    return results
