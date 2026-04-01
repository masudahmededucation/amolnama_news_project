"""Universal promo builders — collect latest content from all apps for the home feed.
Each builder returns a list of dicts with standardised keys for the content-promo-card template.
Add new apps by creating a build_*_promo_items() function and registering it in build_all_promo_items().
"""

import logging

logger = logging.getLogger(__name__)


def build_all_promo_items():
    """Collect promo items from all content apps. Returns a flat list sorted by date (latest first)."""
    all_promos = []

    # Debate — uses its own specialised card template
    try:
        from amolnama_news.site_apps.debate.views import build_debate_promo_items
        all_promos.extend(build_debate_promo_items())
    except Exception:
        logger.exception('Failed to build debate promo items')

    # Newshub articles
    try:
        all_promos.extend(_build_newshub_promo_items())
    except Exception:
        logger.exception('Failed to build newshub promo items')

    # Poems
    try:
        all_promos.extend(_build_poem_promo_items())
    except Exception:
        logger.exception('Failed to build poem promo items')

    # Stories
    try:
        all_promos.extend(_build_stories_promo_items())
    except Exception:
        logger.exception('Failed to build stories promo items')

    # Art
    try:
        all_promos.extend(_build_art_promo_items())
    except Exception:
        logger.exception('Failed to build art promo items')

    # Travel Hub (Bangladesh destinations)
    try:
        all_promos.extend(_build_travel_promo_items())
    except Exception:
        logger.exception('Failed to build travel promo items')

    # Sort all by date — latest first
    all_promos.sort(key=lambda item: item.get('promo_sort_date', ''), reverse=True)
    return all_promos


def _build_newshub_promo_items():
    """Latest published news articles."""
    from amolnama_news.site_apps.newshub.models import PubArticle

    articles = PubArticle.objects.filter(
        is_published=True,
    ).order_by('-created_at')[:2]

    items = []
    for article in articles:
        items.append({
            'item_type': 'content_promo',
            'promo_sort_date': article.created_at.isoformat() if article.created_at else '',
            'promo_id': article.pub_article_id,
            'promo_badge': 'NEWS',
            'promo_color': 'rose',
            'promo_title': article.pub_article_headline_bn or '',
            'promo_description': (article.pub_article_content_bn or '')[:200],
            'promo_url': f'/newshub/article/{article.pub_article_slug}/',
            'promo_author': None,
            'promo_date_formatted': article.created_at.strftime('%d %b %Y') if article.created_at else '',
            'promo_like_count': None,
            'promo_view_count': None,
            'promo_extra_stat': None,
            'promo_cta': 'পড়ুন',
        })
    return items


def _build_poem_promo_items():
    """Latest published poems."""
    from amolnama_news.site_apps.poem.models import CollPoemEntry

    poems = CollPoemEntry.objects.filter(
        poem_status_code='published',
    ).order_by('-created_at')[:2]

    items = []
    for poem in poems:
        items.append({
            'item_type': 'content_promo',
            'promo_sort_date': poem.created_at.isoformat() if poem.created_at else '',
            'promo_id': poem.poem_coll_poem_entry_id,
            'promo_badge': 'POEM',
            'promo_color': 'purple',
            'promo_title': poem.poem_title_bn or '',
            'promo_description': (poem.poem_body_bn or '')[:200],
            'promo_url': f'/bangla-kobita-gaan/{poem.poem_slug}/',
            'promo_author': getattr(poem, 'poem_author_display_name', None),
            'promo_date_formatted': poem.created_at.strftime('%d %b %Y') if poem.created_at else '',
            'promo_like_count': getattr(poem, 'like_count', None),
            'promo_view_count': getattr(poem, 'view_count', None),
            'promo_extra_stat': None,
            'promo_cta': 'পড়ুন',
        })
    return items


def _build_stories_promo_items():
    """Latest published stories."""
    from amolnama_news.site_apps.stories.models import CollStory

    stories = CollStory.objects.filter(
        is_published=True, is_active=True,
    ).order_by('-created_at')[:2]

    items = []
    for story in stories:
        reading_time = getattr(story, 'reading_time_minutes', None)
        items.append({
            'item_type': 'content_promo',
            'promo_sort_date': story.created_at.isoformat() if story.created_at else '',
            'promo_id': story.stories_coll_story_id,
            'promo_badge': 'STORY',
            'promo_color': 'amber',
            'promo_title': story.story_title_bn or '',
            'promo_description': (story.story_summary_bn or '')[:200] if hasattr(story, 'story_summary_bn') else '',
            'promo_url': f'/stories-for-kids/{story.story_slug}/',
            'promo_author': None,
            'promo_date_formatted': story.created_at.strftime('%d %b %Y') if story.created_at else '',
            'promo_like_count': getattr(story, 'like_count', None),
            'promo_view_count': getattr(story, 'view_count', None),
            'promo_extra_stat': f'📖 {reading_time} মিনিট' if reading_time else None,
            'promo_cta': 'পড়ুন',
        })
    return items


def _build_art_promo_items():
    """Latest published artworks."""
    from amolnama_news.site_apps.art.models import CollArtwork

    artworks = CollArtwork.objects.filter(
        is_published=True, is_active=True,
    ).order_by('-created_at')[:2]

    items = []
    for artwork in artworks:
        items.append({
            'item_type': 'content_promo',
            'promo_sort_date': artwork.created_at.isoformat() if artwork.created_at else '',
            'promo_id': artwork.art_coll_artwork_id,
            'promo_badge': 'ART',
            'promo_color': 'blue',
            'promo_title': artwork.artwork_title_bn or '',
            'promo_description': (artwork.artwork_description_bn or '')[:200],
            'promo_url': f'/art-and-craft/{artwork.artwork_slug}/',
            'promo_author': None,
            'promo_date_formatted': artwork.created_at.strftime('%d %b %Y') if artwork.created_at else '',
            'promo_like_count': getattr(artwork, 'like_count', None),
            'promo_view_count': getattr(artwork, 'view_count', None),
            'promo_extra_stat': None,
            'promo_cta': 'দেখুন',
        })
    return items


def _build_travel_promo_items():
    """Latest travel destinations."""
    from amolnama_news.site_apps.bangladesh.models import CollDestination

    destinations = CollDestination.objects.filter(
        destination_status='published',
    ).order_by('-created_at')[:2]

    items = []
    for destination in destinations:
        items.append({
            'item_type': 'content_promo',
            'promo_sort_date': destination.created_at.isoformat() if destination.created_at else '',
            'promo_id': destination.bangladesh_coll_destination_id,
            'promo_badge': 'TRAVEL',
            'promo_color': 'green',
            'promo_title': destination.destination_name_bn or destination.destination_name_en or '',
            'promo_description': (destination.destination_description_bn or destination.destination_description_en or '')[:200],
            'promo_url': f'/bangladesh-tourist-destinations/travel/{destination.destination_slug}/',
            'promo_author': None,
            'promo_date_formatted': destination.created_at.strftime('%d %b %Y') if destination.created_at else '',
            'promo_like_count': getattr(destination, 'like_count', None),
            'promo_view_count': getattr(destination, 'view_count', None),
            'promo_extra_stat': None,
            'promo_cta': 'ঘুরে আসুন',
        })
    return items
