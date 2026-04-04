"""Fact-check engine — 4 layers: pattern detection, duplicate claims, domain blacklist, Google Fact Check API.
Runs in background thread after content creation. All local except optional Google API call.
Phase 1: keyword + pattern. Phase 2 (future): AI + partnerships."""

import hashlib
from amolnama_news.site_apps.core.utils import normalize_text as _normalize_text
import logging
import re
import unicodedata
import urllib.parse
import urllib.request
import json

from django.db import connection

logger = logging.getLogger(__name__)

# Google Fact Check Tools API (free, no card)
# Get your key: https://console.cloud.google.com/apis/library/factchecktools.googleapis.com
GOOGLE_FACT_CHECK_API_KEY = None  # Set this in settings or environment variable
GOOGLE_FACT_CHECK_API_URL = 'https://factchecktools.googleapis.com/v1alpha1/claims:search'



def _hash_claim(text):
    """SHA-256 hash of normalized text for duplicate detection."""
    normalized = _normalize_text(text)
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()


# =========================================================
# LAYER 1: Misinformation Pattern Detection
# =========================================================

def _check_misinformation_patterns(normalized_text):
    """Check text against known misinformation patterns. Returns (score, matched_patterns)."""
    from .models import RefFactCheckMisinformationPattern

    patterns = RefFactCheckMisinformationPattern.objects.filter(is_active=True)

    total_score = 0.0
    matched_count = 0
    matched_patterns = []

    for pattern in patterns:
        if pattern.misinformation_pattern_text_normalized in normalized_text:
            total_score += float(pattern.misinformation_pattern_weight)
            matched_count += 1
            matched_patterns.append(pattern.misinformation_pattern_text)

    # Score: 1 match = 0.3, 2 = 0.5, 3+ = 0.7+
    if matched_count >= 3:
        normalized_score = max(min(total_score / 5.0, 1.0), 0.7)
    elif matched_count >= 2:
        normalized_score = max(min(total_score / 5.0, 1.0), 0.5)
    elif matched_count >= 1:
        normalized_score = max(min(total_score / 5.0, 1.0), 0.3)
    else:
        normalized_score = 0.0

    return normalized_score, matched_patterns


# =========================================================
# LAYER 2: Duplicate Claim Detection
# =========================================================

def _check_duplicate_claims(claim_hash):
    """Check if this claim has been fact-checked before. Returns previous verdict or None."""
    from .models import FactCheckResult

    previous_result = FactCheckResult.objects.filter(
        fact_check_claim_hash=claim_hash,
        is_active=True,
    ).exclude(fact_check_verdict__isnull=True).order_by('-created_at').first()

    if previous_result:
        return {
            'verdict': previous_result.fact_check_verdict,
            'source': previous_result.fact_check_verdict_source,
            'url': previous_result.fact_check_verdict_url,
            'confidence_score': float(previous_result.fact_check_confidence_score),
        }
    return None


# =========================================================
# LAYER 3: Domain Blacklist Check
# =========================================================

def _check_blacklisted_domains(text):
    """Check if text contains URLs from blacklisted domains. Returns list of matched domains."""
    from .models import RefFactCheckBlacklistedDomain

    urls = re.findall(r'https?://([^\s/]+)', text)
    if not urls:
        return []

    blacklisted_domains = set(
        RefFactCheckBlacklistedDomain.objects.filter(is_active=True)
        .values_list('blacklisted_domain_name', flat=True)
    )

    matched_domains = []
    for url_domain in urls:
        url_domain_clean = url_domain.lower().strip('/')
        for blacklisted_domain in blacklisted_domains:
            if blacklisted_domain in url_domain_clean:
                matched_domains.append(blacklisted_domain)

    return matched_domains


# =========================================================
# LAYER 4: Google Fact Check Tools API
# =========================================================

def _check_google_fact_check_api(claim_text):
    """Query Google Fact Check Tools API. Returns verdict dict or None.
    Free API, no card needed. Returns fact-check articles from 100+ organizations."""
    if not GOOGLE_FACT_CHECK_API_KEY:
        return None

    try:
        # Use first 200 chars as query (API limit)
        query_text = claim_text[:200]
        params = urllib.parse.urlencode({
            'query': query_text,
            'key': GOOGLE_FACT_CHECK_API_KEY,
            'languageCode': 'bn',
        })
        url = f'{GOOGLE_FACT_CHECK_API_URL}?{params}'

        request = urllib.request.Request(url, headers={
            'User-Agent': 'AmolnamaNews/1.0',
        })
        response = urllib.request.urlopen(request, timeout=5)
        data = json.loads(response.read().decode('utf-8'))

        claims = data.get('claims', [])
        if not claims:
            return None

        # Take the first (most relevant) claim review
        first_claim = claims[0]
        claim_review = first_claim.get('claimReview', [{}])[0]

        return {
            'verdict': claim_review.get('textualRating', ''),
            'source': claim_review.get('publisher', {}).get('name', ''),
            'url': claim_review.get('url', ''),
            'original_claim': first_claim.get('text', ''),
        }

    except Exception:
        logger.debug('Google Fact Check API call failed for: %s', claim_text[:50])
        return None


# =========================================================
# MAIN: Run all 4 layers
# =========================================================

def fact_check_content(source_app, content_id, text):
    """Run all fact-check layers on content. Called from background thread.
    Stores results in fact_check_result table. Updates post if flagged."""
    if not text or len(text.strip()) < 20:
        return

    try:
        normalized_text = _normalize_text(text)
        claim_hash = _hash_claim(text)

        # Layer 1: Misinformation patterns
        pattern_score, matched_patterns = _check_misinformation_patterns(normalized_text)

        # Layer 2: Duplicate claim check
        duplicate_result = _check_duplicate_claims(claim_hash)

        # Layer 3: Domain blacklist
        blacklisted_domains = _check_blacklisted_domains(text)

        # Layer 4: Google Fact Check API (if available)
        google_result = _check_google_fact_check_api(text)

        # Determine final verdict
        is_flagged = False
        verdict = None
        verdict_source = None
        verdict_url = None
        confidence_score = 0.0
        method = 'pattern'

        # Priority: Google API > Duplicate > Pattern > Domain
        if google_result and google_result.get('verdict'):
            verdict = google_result['verdict']
            verdict_source = google_result.get('source', '')
            verdict_url = google_result.get('url', '')
            confidence_score = 0.9
            method = 'google_fact_check_api'
            is_flagged = True

        elif duplicate_result:
            verdict = duplicate_result['verdict']
            verdict_source = duplicate_result.get('source', 'duplicate_claim')
            verdict_url = duplicate_result.get('url', '')
            confidence_score = duplicate_result.get('confidence_score', 0.7)
            method = 'duplicate_claim'
            is_flagged = True

        elif pattern_score > 0.5:
            verdict = 'needs_fact_check'
            verdict_source = 'pattern_detection'
            confidence_score = pattern_score
            method = 'pattern'
            is_flagged = True

        elif blacklisted_domains:
            verdict = 'unreliable_source'
            verdict_source = 'domain_blacklist'
            confidence_score = 0.8
            method = 'domain_blacklist'
            is_flagged = True

        # Store result
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [newsengine].[fact_check_result]
                    ([link_content_id], [fact_check_source_app],
                     [fact_check_claim_text], [fact_check_claim_text_normalized], [fact_check_claim_hash],
                     [fact_check_method], [fact_check_verdict], [fact_check_verdict_source], [fact_check_verdict_url],
                     [fact_check_confidence_score], [is_flagged])
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, [
                content_id, source_app,
                text[:500], normalized_text[:500], claim_hash,
                method, verdict, verdict_source, verdict_url,
                confidence_score, 1 if is_flagged else 0,
            ])

        # Update post if flagged as misinformation
        if is_flagged and source_app == 'post':
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE [post].[coll_post]
                    SET [content_category_code] = 'misinformation'
                    WHERE [post_post_id] = %s AND ([content_category_code] IS NULL OR [content_category_code] = 'safe')
                """, [content_id])

        logger.info(
            'Fact-check complete: app=%s id=%s method=%s verdict=%s score=%.4f flagged=%s',
            source_app, content_id, method, verdict, confidence_score, is_flagged,
        )

    except Exception:
        logger.exception('Fact-check failed for %s/%s', source_app, content_id)
