"""bookwriter template tags.

Currently exposes:
  {% bookwriter_random_book_promo %}
    Renders a single library-card-style promo for one randomly chosen
    publicly-published book. Cached for 5 minutes to avoid hitting the
    DB on every request once the corpus grows. Safe-no-op when zero
    books are published.

Usage:
  {% load bookwriter_tags %}
  {% bookwriter_random_book_promo %}

Reuses build_book_card_payload + the My Library palette so the promo
visually belongs to the same product as the rest of bookwriter.
"""

from django.core.cache import cache
from django.template import Library
from django.urls import reverse
from django.utils.safestring import mark_safe
from django.template.loader import render_to_string

from amolnama_news.site_apps.bookwriter.models import (
    CollBook,
    SerialRelease,
)
from amolnama_news.site_apps.bookwriter.views_api_helpers import (
    build_book_card_payload,
    prefetch_book_cover_designs,
)


register = Library()


# Cache key + TTL for the random-book pick. Five minutes balances
# "fresh enough" (rotation visible to repeat visitors) against DB
# load (a random pick on every request would be wasteful at scale).
_RANDOM_BOOK_PROMO_CACHE_KEY    = 'bookwriter_random_book_promo_payload_v1'
_RANDOM_BOOK_PROMO_CACHE_TTL_S  = 300


def _resolve_owner_display_name_for_book(owner_user_profile_id):
    """Return the owner's display name (UserProfile.display_name) for
    promo-card author rendering. Empty string on miss so the template
    falls through to its no-author branch silently."""
    if owner_user_profile_id is None:
        return ''
    from amolnama_news.site_apps.user_account.models import UserProfile
    profile_row = (
        UserProfile.objects
        .filter(user_profile_id=owner_user_profile_id)
        .values_list('display_name', flat=True)
        .first()
    )
    return profile_row or ''


def _pick_one_publicly_published_book_payload():
    """Pick ONE random publicly-published book + return a card payload.

    Returns a dict (build_book_card_payload + public_chapter_url +
    marketplace_url), or None when zero books are published.
    """
    cached_promo_payload = cache.get(_RANDOM_BOOK_PROMO_CACHE_KEY)
    if cached_promo_payload is not None:
        # cache.set stores the empty-marker as a sentinel string so we
        # can distinguish "cached as no-op" from "cache miss".
        if cached_promo_payload == '__bookwriter_no_published_books__':
            return None
        return cached_promo_payload

    eligible_release_row = (
        SerialRelease.objects
        .filter(
            serial_release_status_code='published',
            is_active=True,
            public_chapter_slug__isnull=False,
        )
        .order_by('?')
        .values('link_bookwriter_coll_book_id', 'public_chapter_slug')
        .first()
    )
    if eligible_release_row is None:
        cache.set(
            _RANDOM_BOOK_PROMO_CACHE_KEY,
            '__bookwriter_no_published_books__',
            _RANDOM_BOOK_PROMO_CACHE_TTL_S,
        )
        return None

    chosen_book = (
        CollBook.objects
        .filter(
            bookwriter_coll_book_id=eligible_release_row['link_bookwriter_coll_book_id'],
            is_active=True,
        )
        .first()
    )
    if chosen_book is None:
        return None

    cover_designs_by_book_id = prefetch_book_cover_designs([chosen_book])
    saved_cover_design = cover_designs_by_book_id.get(chosen_book.bookwriter_coll_book_id)
    promo_card_payload = build_book_card_payload(
        chosen_book,
        saved_cover_design,
        _resolve_owner_display_name_for_book(chosen_book.link_owner_user_profile_id),
    )
    # Promo card click → 3D book reader (the canonical public reading
    # surface). build_book_card_payload already emitted
    # `book_reader_canonical_url`; we keep `public_chapter_url` as the
    # field name the partial reads so we don't have to touch the
    # template — assigned here from the canonical URL.
    promo_card_payload['public_chapter_url'] = promo_card_payload['book_reader_canonical_url']
    promo_card_payload['marketplace_url'] = reverse('bookwriter:marketplace')
    cache.set(
        _RANDOM_BOOK_PROMO_CACHE_KEY,
        promo_card_payload,
        _RANDOM_BOOK_PROMO_CACHE_TTL_S,
    )
    return promo_card_payload


@register.simple_tag
def bookwriter_random_book_promo():
    """Render a single library-card-style promo for one randomly
    chosen publicly-published book. Returns an empty string when zero
    books are published (caller's template stays clean).

    Cached 5 minutes — see _pick_one_publicly_published_book_payload."""
    promo_book_payload = _pick_one_publicly_published_book_payload()
    if promo_book_payload is None:
        return ''
    rendered_html = render_to_string(
        'bookwriter/partials/_bookwriter_random_book_promo.html',
        {'book': promo_book_payload},
    )
    return mark_safe(rendered_html)
