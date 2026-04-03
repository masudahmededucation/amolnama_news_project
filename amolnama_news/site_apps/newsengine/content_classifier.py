"""Content classifier — keyword-based auto-categorisation of posts and arguments.
Classifies text into categories (safe, spam, adult, politics, etc.) using flagged keywords.
Phase 1: keyword matching. Phase 2 (future): AI classification.
All local, no external API."""

import logging
import re
import unicodedata

from django.db import connection

logger = logging.getLogger(__name__)

# Spam pattern signals — phone numbers, money, URLs, repeated chars
SPAM_PATTERNS = [
    re.compile(r'(\+?\d[\d\-\s]{8,15})'),                    # phone numbers
    re.compile(r'(টাকা|taka|bdt|৳)\s*\d+', re.IGNORECASE),  # money mentions
    re.compile(r'https?://\S+'),                               # URLs
    re.compile(r'(www\.\S+)'),                                 # www links
    re.compile(r'(.)\1{5,}'),                                  # repeated chars (6+)
]


def _normalize_text(text):
    """NFC normalize + lowercase for consistent matching."""
    if not text:
        return ''
    return unicodedata.normalize('NFC', text.strip().lower())


def _load_flagged_keywords():
    """Load all active flagged keywords grouped by category. Cached per request."""
    from .models import RefContentClassificationFlaggedKeyword, RefContentClassificationCategory

    categories = {}
    for category in RefContentClassificationCategory.objects.filter(is_active=True):
        categories[category.newsengine_ref_content_classification_category_id] = {
            'category_code': category.category_code,
            'category_action': category.category_action,
            'category_severity_level': category.category_severity_level,
            'keywords': [],
        }

    for keyword in RefContentClassificationFlaggedKeyword.objects.filter(is_active=True):
        category_id = keyword.link_content_classification_category_id
        if category_id in categories:
            categories[category_id]['keywords'].append({
                'text_normalized': keyword.flagged_keyword_text_normalized,
                'weight': float(keyword.flagged_keyword_weight),
            })

    return categories


def _calculate_spam_score(text):
    """Score text for spam patterns (0.0 to 1.0)."""
    if not text:
        return 0.0
    score = 0.0
    for pattern in SPAM_PATTERNS:
        matches = pattern.findall(text)
        score += len(matches) * 0.2

    # Excessive emoji ratio
    emoji_count = sum(1 for character in text if ord(character) > 0x1F600)
    if len(text) > 0 and emoji_count / len(text) > 0.3:
        score += 0.3

    # Very short text with URL (likely spam link)
    words = text.split()
    if len(words) < 5 and re.search(r'https?://', text):
        score += 0.4

    return min(score, 1.0)


def classify_text(text):
    """Classify text into content categories. Returns list of (category_code, score, action) tuples.
    Only returns categories with score > 0. Sorted by score descending."""
    if not text:
        return [('safe', 1.0, 'allow')]

    normalized_text = _normalize_text(text)
    categories = _load_flagged_keywords()

    results = []

    for category_id, category_data in categories.items():
        category_code = category_data['category_code']
        keywords = category_data['keywords']

        if not keywords:
            continue

        # Count keyword matches × weight
        total_score = 0.0
        matched_keyword_count = 0
        for keyword in keywords:
            if keyword['text_normalized'] in normalized_text:
                total_score += keyword['weight']
                matched_keyword_count += 1

        # Score based on matched weight — 1 match = 0.3, 2 = 0.5, 3+ = 0.7+
        if matched_keyword_count > 0:
            normalized_score = min(total_score / 5.0, 1.0)
            # Minimum floor based on match count
            if matched_keyword_count >= 3:
                normalized_score = max(normalized_score, 0.7)
            elif matched_keyword_count >= 2:
                normalized_score = max(normalized_score, 0.5)
            elif matched_keyword_count >= 1:
                normalized_score = max(normalized_score, 0.3)

            if normalized_score > 0.1:
                results.append((
                    category_code,
                    round(normalized_score, 4),
                    category_data['category_action'],
                ))

    # Check spam patterns separately
    spam_score = _calculate_spam_score(normalized_text)
    if spam_score > 0.3:
        results.append(('spam', round(spam_score, 4), 'auto_hide'))

    # Sort by score descending — highest confidence first
    results.sort(key=lambda result: result[1], reverse=True)

    # If no matches, classify as safe
    if not results:
        return [('safe', 1.0, 'allow')]

    return results


def classify_and_store(content_source_app, content_id, text):
    """Classify text and store the result in the audit table + update the content record.
    Called from background thread after post/argument creation."""
    try:
        classification_results = classify_text(text)

        if not classification_results:
            return

        top_category_code = classification_results[0][0]
        top_score = classification_results[0][1]
        top_action = classification_results[0][2]

        # Determine if auto-flagging is needed
        is_auto_flagged = top_action in ('auto_hide',) and top_score > 0.5

        # Get category ID for audit record
        from .models import RefContentClassificationCategory
        category = RefContentClassificationCategory.objects.filter(category_code=top_category_code, is_active=True).first()
        category_id = category.newsengine_ref_content_classification_category_id if category else 1

        # Store classification audit
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [newsengine].[fact_content_classification_result]
                    ([content_classification_source_app], [link_content_id], [link_content_classification_category_id],
                     [content_classification_score], [content_classification_method],
                     [content_classification_action_taken], [is_auto_flagged])
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, [
                content_source_app, content_id, category_id,
                top_score, 'keyword',
                top_action if is_auto_flagged else None,
                1 if is_auto_flagged else 0,
            ])

        # Update the content record
        if content_source_app == 'post':
            with connection.cursor() as cursor:
                if is_auto_flagged:
                    cursor.execute("""
                        UPDATE [post].[post]
                        SET [content_category_code] = %s, [is_auto_flagged] = 1, [is_published] = 0
                        WHERE [post_post_id] = %s
                    """, [top_category_code, content_id])
                else:
                    cursor.execute("""
                        UPDATE [post].[post]
                        SET [content_category_code] = %s
                        WHERE [post_post_id] = %s
                    """, [top_category_code, content_id])

        logger.info(
            'Content classified: app=%s id=%s category=%s score=%.4f action=%s auto_flagged=%s',
            content_source_app, content_id, top_category_code, top_score, top_action, is_auto_flagged,
        )

    except Exception:
        logger.exception('Content classification failed for %s/%s', content_source_app, content_id)
