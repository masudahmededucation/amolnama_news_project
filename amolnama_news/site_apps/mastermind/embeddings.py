"""Mastermind semantic embeddings — multilingual (Bengali + English) sentence vectors.

Storage: varbinary(max) — 32-bit floats packed as bytes (1536 bytes per 384-dim vector).
Rationale: Avoids pyodbc ntext/UTF-8 collation bug entirely. See CLAUDE.md / troubleshooting.md.
"""

import logging
import unicodedata

import numpy as np
from django.utils import timezone

from .models import CollBookChunk, CollQuestion, EngQuizSemanticEmbedding

logger = logging.getLogger(__name__)

# Multilingual embedding model — supports 50+ languages including Bengali
EMBEDDING_MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'
EMBEDDING_DIMENSION = 384

# Multilingual NLI cross-encoder — for faithfulness/entailment verification.
# mDeBERTa-v3-base-xnli-multilingual-nli-2mil7 is trained on 2.7M NLI pairs across 27 languages
# including Bengali. Labels: 0=entailment, 1=neutral, 2=contradiction. Max 512 tokens.
NLI_MODEL_NAME = 'MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7'
NLI_MAX_TOKENS = 512

# NLI label positions from the model config
NLI_LABEL_ENTAILMENT = 0
NLI_LABEL_NEUTRAL = 1
NLI_LABEL_CONTRADICTION = 2

# Lazy-loaded singletons
_model_cache = [None]
_nli_tokenizer_cache = [None]
_nli_model_cache = [None]


def _get_model():
    """Load sentence-transformers embedding model (cached)."""
    if _model_cache[0] is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading embedding model: %s", EMBEDDING_MODEL_NAME)
        _model_cache[0] = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _model_cache[0]


def _get_nli_model():
    """Load multilingual NLI model + tokenizer (cached). Returns (tokenizer, model)."""
    if _nli_model_cache[0] is None:
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        logger.info("Loading NLI model: %s (~1.5GB, first-run downloads)", NLI_MODEL_NAME)
        _nli_tokenizer_cache[0] = AutoTokenizer.from_pretrained(NLI_MODEL_NAME)
        _nli_model_cache[0] = AutoModelForSequenceClassification.from_pretrained(NLI_MODEL_NAME)
        _nli_model_cache[0].eval()
    return (_nli_tokenizer_cache[0], _nli_model_cache[0])


def nli_classify(premise, hypothesis):
    """Run NLI on a premise-hypothesis pair.

    Returns dict with entailment/neutral/contradiction probabilities (softmax).
    """
    import torch

    tokenizer, model = _get_nli_model()
    inputs = tokenizer(
        premise, hypothesis,
        return_tensors='pt',
        truncation=True,
        max_length=NLI_MAX_TOKENS,
    )
    with torch.no_grad():
        logits = model(**inputs).logits
    probabilities = torch.softmax(logits, dim=-1)[0].tolist()
    return {
        'entailment': float(probabilities[NLI_LABEL_ENTAILMENT]),
        'neutral': float(probabilities[NLI_LABEL_NEUTRAL]),
        'contradiction': float(probabilities[NLI_LABEL_CONTRADICTION]),
    }


def _normalize_text(text):
    """NFC-normalize Bengali text for consistent embeddings."""
    return unicodedata.normalize('NFC', (text or '').strip())


# ================================================================
# Binary serialization — float32 list <-> bytes
# ================================================================

def vector_to_bytes(vector):
    """Pack numpy array or list of floats into float32 bytes (4 bytes per element).

    384 floats -> 1536 bytes. Uses numpy.tobytes() for zero-copy serialization.
    """
    if vector is None or (hasattr(vector, '__len__') and len(vector) == 0):
        return b''
    if not isinstance(vector, np.ndarray):
        vector = np.asarray(vector, dtype=np.float32)
    elif vector.dtype != np.float32:
        vector = vector.astype(np.float32)
    return vector.tobytes()


def bytes_to_vector(binary_data):
    """Unpack bytes back into numpy float32 array (zero-copy view via frombuffer)."""
    if not binary_data:
        return np.array([], dtype=np.float32)
    if isinstance(binary_data, memoryview):
        binary_data = binary_data.tobytes()
    # np.frombuffer creates an immutable view. Copy so consumers can mutate safely.
    return np.frombuffer(binary_data, dtype=np.float32).copy()


# ================================================================
# Core embedding operations
# ================================================================

def compute_embedding(text):
    """Compute 384-dim normalized embedding vector as float32 numpy array."""
    text = _normalize_text(text)
    if not text:
        return None

    model = _get_model()
    vector = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    return vector.astype(np.float32)


def compute_embeddings_batch(texts):
    """Compute embeddings for multiple texts in one batch (returns list of np.float32 arrays)."""
    normalized = [_normalize_text(text) for text in texts]
    non_empty_indices = [index for index, text in enumerate(normalized) if text]
    if not non_empty_indices:
        return [None] * len(texts)

    model = _get_model()
    non_empty_texts = [normalized[index] for index in non_empty_indices]
    vectors = model.encode(
        non_empty_texts,
        convert_to_numpy=True,
        normalize_embeddings=True,
        batch_size=32,
    ).astype(np.float32)

    results = [None] * len(texts)
    for output_index, original_index in enumerate(non_empty_indices):
        results[original_index] = vectors[output_index]
    return results


def cosine_similarity(vector_a, vector_b):
    """Cosine similarity between two normalized vectors (float in [-1, 1]).

    Since embeddings are always normalized, this is just dot product.
    Works with lists or numpy arrays.
    """
    if vector_a is None or vector_b is None:
        return 0.0
    if hasattr(vector_a, '__len__') and len(vector_a) == 0:
        return 0.0
    if hasattr(vector_b, '__len__') and len(vector_b) == 0:
        return 0.0
    # Use numpy for C-speed dot product
    a = vector_a if isinstance(vector_a, np.ndarray) else np.asarray(vector_a, dtype=np.float32)
    b = vector_b if isinstance(vector_b, np.ndarray) else np.asarray(vector_b, dtype=np.float32)
    return float(np.dot(a, b))


# ================================================================
# Storage operations
# ================================================================

def save_embedding(target_type_code, target_id, vector):
    """Save or update an embedding in the DB as binary bytes."""
    if _is_empty_vector(vector):
        return False

    binary_data = vector_to_bytes(vector)
    now = timezone.now()

    existing_id = EngQuizSemanticEmbedding.objects.filter(
        embedding_target_type_code=target_type_code,
        embedding_target_id=target_id,
    ).values_list('mastermind_eng_quiz_semantic_embedding_id', flat=True).first()

    try:
        if existing_id:
            EngQuizSemanticEmbedding.objects.filter(
                mastermind_eng_quiz_semantic_embedding_id=existing_id
            ).update(
                embedding_vector_bytes=binary_data,
                embedding_model_name=EMBEDDING_MODEL_NAME,
                embedding_dimension=EMBEDDING_DIMENSION,
                updated_at=now,
                is_active=True,
            )
            return True

        EngQuizSemanticEmbedding.objects.create(
            embedding_target_type_code=target_type_code,
            embedding_target_id=target_id,
            embedding_model_name=EMBEDDING_MODEL_NAME,
            embedding_vector_bytes=binary_data,
            embedding_dimension=EMBEDDING_DIMENSION,
            created_at=now,
        )
        return True
    except Exception as store_error:
        logger.error(
            'Failed to save embedding for %s:%s — %s',
            target_type_code, target_id, store_error,
        )
        return False


def load_embedding(target_type_code, target_id):
    """Load an embedding vector from DB. Returns list of floats or None."""
    row = EngQuizSemanticEmbedding.objects.filter(
        embedding_target_type_code=target_type_code,
        embedding_target_id=target_id,
        is_active=True,
    ).values('embedding_vector_bytes').first()

    if not row:
        return None

    return bytes_to_vector(row['embedding_vector_bytes'])


def load_embeddings_batch(target_type_code, target_ids):
    """Load multiple embeddings by target IDs. Returns dict {id: vector}."""
    rows = EngQuizSemanticEmbedding.objects.filter(
        embedding_target_type_code=target_type_code,
        embedding_target_id__in=target_ids,
        is_active=True,
    ).values('embedding_target_id', 'embedding_vector_bytes')

    return {
        row['embedding_target_id']: bytes_to_vector(row['embedding_vector_bytes'])
        for row in rows
    }


# ================================================================
# Chunk embedding — batch process all chunks for a book
# ================================================================

def embed_book_chunks(book_id, batch_size=32):
    """Generate embeddings for all chunks of a book."""
    chunks = list(
        CollBookChunk.objects.filter(
            link_mastermind_coll_book_id=book_id,
            is_active=True,
        ).values(
            'mastermind_coll_book_chunk_id',
            'chunk_text',
        )
    )

    if not chunks:
        return {'embedded': 0, 'total': 0}

    existing_ids = set(
        EngQuizSemanticEmbedding.objects.filter(
            embedding_target_type_code='chunk',
            embedding_target_id__in=[chunk['mastermind_coll_book_chunk_id'] for chunk in chunks],
            is_active=True,
        ).values_list('embedding_target_id', flat=True)
    )

    chunks_to_embed = [chunk for chunk in chunks if chunk['mastermind_coll_book_chunk_id'] not in existing_ids]

    if not chunks_to_embed:
        return {'embedded': 0, 'total': len(chunks), 'skipped': len(chunks)}

    embedded_count = 0
    for batch_start in range(0, len(chunks_to_embed), batch_size):
        batch = chunks_to_embed[batch_start:batch_start + batch_size]
        texts = [chunk['chunk_text'] for chunk in batch]
        vectors = compute_embeddings_batch(texts)

        for chunk, vector in zip(batch, vectors):
            if vector:
                save_embedding('chunk', chunk['mastermind_coll_book_chunk_id'], vector)
                embedded_count += 1

    return {
        'embedded': embedded_count,
        'total': len(chunks),
        'skipped': len(existing_ids),
    }


def embed_question(question_id, question_text):
    """Generate and save embedding for a question. Returns True on success."""
    vector = compute_embedding(question_text)
    if _is_empty_vector(vector):
        return False
    return save_embedding('question', question_id, vector)


# ================================================================
# Semantic anti-hallucination — replaces strict word match
# ================================================================

def _is_empty_vector(vector):
    """Check if a vector is None or empty (safe for numpy arrays and lists)."""
    if vector is None:
        return True
    if hasattr(vector, '__len__'):
        return len(vector) == 0
    return False


def verify_answer_semantically(answer_text, chunk_text, threshold=0.45):
    """Verify an answer is semantically grounded in the source chunk."""
    if not answer_text or not chunk_text:
        return (False, 0.0)

    answer_vector = compute_embedding(answer_text)
    chunk_vector = compute_embedding(chunk_text)

    if _is_empty_vector(answer_vector) or _is_empty_vector(chunk_vector):
        return (False, 0.0)

    similarity = cosine_similarity(answer_vector, chunk_vector)
    return (similarity >= threshold, similarity)


def verify_answer_against_chunk_sentences(answer_text, chunk_text, threshold=0.55):
    """Sentence-level max similarity — kept for backward compatibility + Tier 1 of tiered gate."""
    import re

    if not answer_text or not chunk_text:
        return (False, 0.0)

    sentences = [
        sentence.strip()
        for sentence in re.split(r'(?<=[।.!?])\s+', chunk_text)
        if sentence.strip() and len(sentence.strip()) > 10
    ]

    if not sentences:
        return verify_answer_semantically(answer_text, chunk_text, threshold=threshold - 0.1)

    answer_vector = compute_embedding(answer_text)
    if _is_empty_vector(answer_vector):
        return (False, 0.0)

    sentence_vectors = compute_embeddings_batch(sentences)

    max_similarity = 0.0
    for sentence_vector in sentence_vectors:
        if not _is_empty_vector(sentence_vector):
            similarity = cosine_similarity(answer_vector, sentence_vector)
            if similarity > max_similarity:
                max_similarity = similarity

    return (max_similarity >= threshold, max_similarity)


# ================================================================
# Tiered faithfulness verification — similarity + NLI entailment
# ================================================================

def verify_faithfulness(chunk_text, answer_text,
                        similarity_reject_below=0.30,
                        nli_entailment_min=0.50):
    """Tiered write-barrier gate: similarity filter + NLI entailment check.

    Tier 1 — Bi-encoder max sentence similarity (fast, ~50ms):
        similarity < 0.30  ->  auto-reject (too unrelated)
        similarity >= 0.30 ->  proceed to Tier 2 (ALWAYS — no auto-pass
                               shortcut, because negation pairs have sim >0.95
                               but are semantically opposite)

    Tier 2 — mDeBERTa NLI (accurate, ~200-500ms on CPU):
        Premise = chunk_text, Hypothesis = answer_text
        Pass iff entailment > contradiction AND entailment >= nli_entailment_min

    Returns dict:
        verdict: 'pass' | 'reject'
        reason: human-readable explanation
        similarity: Tier 1 score (always present)
        nli_scores: {entailment, neutral, contradiction} or None if Tier 2 skipped
    """
    if not answer_text or not chunk_text:
        return {
            'verdict': 'reject',
            'reason': 'empty input',
            'similarity': 0.0,
            'nli_scores': None,
        }

    # --- Tier 1: max-sentence similarity (reject-only gate) ---
    _, similarity = verify_answer_against_chunk_sentences(
        answer_text, chunk_text, threshold=0.0
    )

    if similarity < similarity_reject_below:
        return {
            'verdict': 'reject',
            'reason': f'too unrelated (sim={similarity:.3f} < {similarity_reject_below})',
            'similarity': similarity,
            'nli_scores': None,
        }

    # --- Tier 2: NLI entailment (the grey zone) ---
    try:
        nli_scores = nli_classify(premise=chunk_text, hypothesis=answer_text)
    except Exception as nli_error:
        logger.warning("NLI check failed, falling back to similarity: %s", nli_error)
        # Fallback: stricter similarity threshold if NLI unavailable
        verdict = 'pass' if similarity > 0.65 else 'reject'
        return {
            'verdict': verdict,
            'reason': f'NLI unavailable, similarity fallback (sim={similarity:.3f})',
            'similarity': similarity,
            'nli_scores': None,
        }

    entailment = nli_scores['entailment']
    contradiction = nli_scores['contradiction']

    if entailment > contradiction and entailment >= nli_entailment_min:
        return {
            'verdict': 'pass',
            'reason': f'NLI entailment (entail={entailment:.3f}, contra={contradiction:.3f})',
            'similarity': similarity,
            'nli_scores': nli_scores,
        }

    return {
        'verdict': 'reject',
        'reason': f'NLI contradiction/neutral (entail={entailment:.3f}, contra={contradiction:.3f})',
        'similarity': similarity,
        'nli_scores': nli_scores,
    }


# ================================================================
# Semantic deduplication — detect similar questions
# ================================================================

def find_similar_questions(question_text, topic_id=None, threshold=0.85, limit=5):
    """Find existing questions similar to a given text."""
    query_vector = compute_embedding(question_text)
    if _is_empty_vector(query_vector):
        return []

    question_filter = {
        'is_active': True,
        'question_status_code__in': ['published', 'review'],
    }
    if topic_id:
        question_filter['link_mastermind_coll_quiz_topic_id'] = topic_id

    candidate_question_ids = list(
        CollQuestion.objects.filter(**question_filter).values_list(
            'mastermind_coll_question_id', flat=True
        )
    )

    if not candidate_question_ids:
        return []

    embeddings_map = load_embeddings_batch('question', candidate_question_ids)
    if not embeddings_map:
        return []

    similarities = []
    for question_id, question_vector in embeddings_map.items():
        similarity = cosine_similarity(query_vector, question_vector)
        if similarity >= threshold:
            similarities.append((question_id, similarity))

    similarities.sort(key=lambda item: item[1], reverse=True)
    top_matches = similarities[:limit]

    if not top_matches:
        return []

    top_ids = [match[0] for match in top_matches]
    question_texts = {
        question['mastermind_coll_question_id']: question['question_text_bn']
        for question in CollQuestion.objects.filter(
            mastermind_coll_question_id__in=top_ids
        ).values('mastermind_coll_question_id', 'question_text_bn')
    }

    return [
        {
            'question_id': question_id,
            'similarity': round(similarity, 4),
            'question_text_bn': question_texts.get(question_id, ''),
        }
        for question_id, similarity in top_matches
    ]


def is_duplicate_question(question_text, topic_id=None, threshold=0.90):
    """Check if a question is a near-duplicate of an existing one."""
    similar = find_similar_questions(question_text, topic_id=topic_id, threshold=threshold, limit=1)
    if similar:
        return True, similar[0]
    return False, None


# ================================================================
# Semantic chunk retrieval (for RAG-style generation)
# ================================================================

def find_relevant_chunks(query_text, book_id=None, chapter_id=None, limit=5, threshold=0.3):
    """Find chunks most semantically relevant to a query."""
    query_vector = compute_embedding(query_text)
    if _is_empty_vector(query_vector):
        return []

    chunk_filter = {'is_active': True}
    if book_id:
        chunk_filter['link_mastermind_coll_book_id'] = book_id
    if chapter_id:
        chunk_filter['link_mastermind_coll_book_chapter_id'] = chapter_id

    candidate_chunk_ids = list(
        CollBookChunk.objects.filter(**chunk_filter).values_list(
            'mastermind_coll_book_chunk_id', flat=True
        )
    )

    if not candidate_chunk_ids:
        return []

    embeddings_map = load_embeddings_batch('chunk', candidate_chunk_ids)
    if not embeddings_map:
        return []

    similarities = []
    for chunk_id, chunk_vector in embeddings_map.items():
        similarity = cosine_similarity(query_vector, chunk_vector)
        if similarity >= threshold:
            similarities.append((chunk_id, similarity))

    similarities.sort(key=lambda item: item[1], reverse=True)
    top_matches = similarities[:limit]

    if not top_matches:
        return []

    top_ids = [match[0] for match in top_matches]
    chunk_data = {
        chunk['mastermind_coll_book_chunk_id']: chunk
        for chunk in CollBookChunk.objects.filter(
            mastermind_coll_book_chunk_id__in=top_ids
        ).values(
            'mastermind_coll_book_chunk_id',
            'chunk_text',
            'chunk_page_number',
            'link_mastermind_coll_book_id',
            'link_mastermind_coll_book_chapter_id',
        )
    }

    return [
        {
            'chunk_id': chunk_id,
            'similarity': round(similarity, 4),
            'chunk_text': chunk_data.get(chunk_id, {}).get('chunk_text', ''),
            'page_number': chunk_data.get(chunk_id, {}).get('chunk_page_number'),
            'book_id': chunk_data.get(chunk_id, {}).get('link_mastermind_coll_book_id'),
            'chapter_id': chunk_data.get(chunk_id, {}).get('link_mastermind_coll_book_chapter_id'),
        }
        for chunk_id, similarity in top_matches
    ]
