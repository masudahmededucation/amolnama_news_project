"""Named Entity Recognition — extracts entities from news article text.

100% local, zero API cost. Uses Davlan/bert-base-multilingual-cased-ner-hrl
which handles Bengali + English natively (tested: score ~1.0 on both).

Extracts: PER (people), ORG (organizations), LOC (locations/countries).
Stores results as JSON in coll_news_entry.article_topic_auto_tags_json.

Usage:
    from newsengine.entity_extractor import extract_and_store_entities
    extract_and_store_entities(coll_news_entry_id)

    # Background (non-blocking):
    from newsengine.entity_extractor import extract_and_store_entities_background
    extract_and_store_entities_background(coll_news_entry_id)
"""

import json
import logging
import threading
import unicodedata

from django.db import connection
from django.utils import timezone

logger = logging.getLogger(__name__)

# Lazy-loaded NER pipeline — ~200MB model, loads once per process
_ner_pipeline = None
_ner_pipeline_lock = threading.Lock()

NER_MODEL_NAME = 'Davlan/bert-base-multilingual-cased-ner-hrl'

# Entity types we extract (model also detects DATE etc — we skip those)
ENTITY_TYPES_TO_EXTRACT = {'PER', 'ORG', 'LOC'}

# Minimum confidence score to include an entity
MIN_ENTITY_SCORE = 0.7

# Maximum text length to process (truncate to avoid OOM on very long articles)
MAX_TEXT_LENGTH = 2000


def _get_ner_pipeline():
    """Lazy-load the NER model. Thread-safe singleton."""
    global _ner_pipeline
    if _ner_pipeline is not None:
        return _ner_pipeline

    with _ner_pipeline_lock:
        if _ner_pipeline is not None:
            return _ner_pipeline
        try:
            from transformers import pipeline
            _ner_pipeline = pipeline(
                'ner',
                model=NER_MODEL_NAME,
                aggregation_strategy='simple',
            )
            logger.info('entity_extractor: loaded NER model %s', NER_MODEL_NAME)
        except ImportError:
            logger.warning('entity_extractor: transformers not installed')
            return None
        except Exception as model_error:
            logger.error('entity_extractor: failed to load NER model — %s', model_error)
            return None
    return _ner_pipeline


def extract_entities_from_text(text):
    """Extract named entities from text. Returns deduplicated list of dicts.

    Each entity: {'name': str, 'type': 'PER'|'ORG'|'LOC', 'salience': float}
    Sorted by salience (highest first). Bengali text is NFC-normalized.
    """
    if not text or len(text.strip()) < 10:
        return []

    ner = _get_ner_pipeline()
    if ner is None:
        return []

    # NFC normalize Bengali text + truncate
    text = unicodedata.normalize('NFC', text)[:MAX_TEXT_LENGTH]

    try:
        raw_entities = ner(text)
    except Exception as ner_error:
        logger.error('entity_extractor: NER inference failed — %s', ner_error)
        return []

    # Deduplicate by normalized name + type, keep highest score
    seen = {}
    for entity in raw_entities:
        entity_type = entity.get('entity_group', '')
        if entity_type not in ENTITY_TYPES_TO_EXTRACT:
            continue

        score = float(entity.get('score', 0))
        if score < MIN_ENTITY_SCORE:
            continue

        # Clean entity name: strip whitespace, NFC normalize
        name = unicodedata.normalize('NFC', (entity.get('word', '') or '').strip())
        if not name or len(name) < 2:
            continue

        # Remove leading ## (BERT subword artifact)
        name = name.replace('##', '').strip()
        if not name:
            continue

        # Dedup key: lowercased name + type
        dedup_key = (name.lower(), entity_type)
        if dedup_key in seen:
            if score > seen[dedup_key]['salience']:
                seen[dedup_key]['salience'] = round(score, 4)
        else:
            seen[dedup_key] = {
                'name': name,
                'type': entity_type,
                'salience': round(score, 4),
            }

    # Sort by salience descending, cap at 15 entities
    entities = sorted(seen.values(), key=lambda entity: entity['salience'], reverse=True)[:15]
    return entities


def _generate_topic_tags(entities):
    """Generate topic tags from extracted entities.

    Groups entities by type and returns a flat list of topic strings.
    Example: ['যুক্তরাষ্ট্র', 'ইরান', 'পেন্টাগন']
    """
    return [entity['name'] for entity in entities]


def extract_and_store_entities(coll_news_entry_id):
    """Extract entities from a news article and store in article_topic_auto_tags_json.

    Reads headline + body, runs NER, stores structured JSON.
    Idempotent — overwrites previous results.
    """
    # Fetch article text
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT [news_headline_bn], [news_content_body_bn],
                       [news_headline_en], [news_content_body_en]
                FROM [newshub].[coll_news_entry]
                WHERE [newshub_coll_news_entry_id] = %s
            """, [coll_news_entry_id])
            row = cursor.fetchone()
    except Exception as fetch_error:
        logger.error('entity_extractor: fetch failed for entry %s — %s',
                     coll_news_entry_id, fetch_error)
        return False

    if not row:
        return False

    # Combine headline + body for both languages
    text_parts = [part for part in [row[0], row[1], row[2], row[3]] if part]
    combined_text = ' '.join(text_parts)

    if len(combined_text.strip()) < 20:
        return False

    # Extract entities
    entities = extract_entities_from_text(combined_text)
    topic_tags = _generate_topic_tags(entities)

    # Build the JSON structure
    auto_tags_data = {
        'entities': entities,
        'topics': topic_tags,
        'extracted_at': timezone.now().isoformat(),
        'model': NER_MODEL_NAME,
    }

    auto_tags_json = json.dumps(auto_tags_data, ensure_ascii=False)

    # Store in DB
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE [newshub].[coll_news_entry]
                SET [article_topic_auto_tags_json] = %s
                WHERE [newshub_coll_news_entry_id] = %s
            """, [auto_tags_json, coll_news_entry_id])
        logger.info('entity_extractor: extracted %d entities for entry %s',
                     len(entities), coll_news_entry_id)
        return True
    except Exception as store_error:
        logger.error('entity_extractor: store failed for entry %s — %s',
                     coll_news_entry_id, store_error)
        return False


def extract_and_store_entities_background(coll_news_entry_id):
    """Non-blocking version — runs extraction in background thread."""
    threading.Thread(
        target=extract_and_store_entities,
        args=(coll_news_entry_id,),
        daemon=True,
    ).start()
