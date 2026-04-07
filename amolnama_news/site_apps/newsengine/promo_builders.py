"""Universal promo builders — collect latest content from all apps for the home feed.
Each builder returns a list of dicts with standardised keys for the content-promo-card template.
Add new apps by creating a build_*_promo_items() function and registering it in build_all_promo_items().
"""

import logging
import random

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
    all_promos.sort(key=lambda item: item.get('created_at_raw') or '', reverse=True)
    return all_promos


def build_promotional_boost_items():
    """Promotional boost — picks 2 best items per category for periodic re-surfacing.
    Uses engagement (likes, views) to pick the most popular content.
    These appear lower in the feed, separate from the chronological published items."""
    boost_items = []

    builders = [
        _build_newshub_promo_items,
        _build_poem_promo_items,
        _build_stories_promo_items,
        _build_art_promo_items,
        _build_travel_promo_items,
    ]

    for builder in builders:
        try:
            items = builder()
            if items:
                # Randomly pick 2 from all published items — exposes all content over time
                selected = random.sample(items, min(2, len(items)))
                for promo in selected:
                    promo['is_promotional_boost'] = True
                    boost_items.append(promo)
        except Exception:
            logger.exception('Failed to build promotional boost')

    # Also boost top debate
    try:
        from amolnama_news.site_apps.debate.views import build_debate_promo_items
        debate_items = build_debate_promo_items()
        for promo in debate_items[:2]:
            promo['is_promotional_boost'] = True
            boost_items.append(promo)
    except Exception:
        logger.exception('Failed to build debate promotional boost')

    # Tools — randomly pick 2 tools to promote
    try:
        boost_items.extend(_build_tools_promo_items())
    except Exception:
        logger.exception('Failed to build tools promotional boost')

    return boost_items


# =========================================================
# TOOLS — static tool pages, randomly promoted
# =========================================================

TOOLS_CATALOG = [
    {
        'tool_name_bn': 'ফাইল কম্প্রেশন',
        'tool_name_en': 'Reduce File Size',
        'tool_description': 'ছবি, PDF ও ডকুমেন্টের ফাইল সাইজ কমান — সম্পূর্ণ বিনামূল্যে।',
        'tool_url': '/tools/reduce-file-size/',
        'tool_icon': '📦',
    },
    {
        'tool_name_bn': 'ফাইল রূপান্তর',
        'tool_name_en': 'File Conversion',
        'tool_description': 'ছবি, ডকুমেন্ট, অডিও, ভিডিও ফরম্যাট রূপান্তর করুন।',
        'tool_url': '/tools/file-conversion/',
        'tool_icon': '🔄',
    },
    {
        'tool_name_bn': 'জিপ ক্রিয়েটর',
        'tool_name_en': 'ZIP Creator',
        'tool_description': 'একাধিক ফাইল একটি ZIP আর্কাইভে বান্ডেল করুন।',
        'tool_url': '/tools/zip-creator/',
        'tool_icon': '🗜️',
    },
    {
        'tool_name_bn': 'পাসপোর্ট ফটো রিসাইজার',
        'tool_name_en': 'Passport Photo Resizer',
        'tool_description': 'পাসপোর্ট, ভিসা, NID ছবি ও স্বাক্ষর রিসাইজ করুন।',
        'tool_url': '/tools/passport-photo-resizer/',
        'tool_icon': '📷',
    },
    {
        'tool_name_bn': 'ব্যাকগ্রাউন্ড রিমুভার',
        'tool_name_en': 'Background Remover',
        'tool_description': 'AI দিয়ে ছবির ব্যাকগ্রাউন্ড সরান — ব্রাউজারেই।',
        'tool_url': '/tools/background-remover/',
        'tool_icon': '🪄',
    },
    {
        'tool_name_bn': 'ডকুমেন্ট মার্জ',
        'tool_name_en': 'Merge Documents',
        'tool_description': 'একাধিক PDF ও ছবি একটি PDF-এ একত্রিত করুন।',
        'tool_url': '/tools/merge-documents/',
        'tool_icon': '📑',
    },
    {
        'tool_name_bn': 'পিডিএফ স্প্লিট',
        'tool_name_en': 'Split PDF',
        'tool_description': 'পিডিএফ থেকে নির্দিষ্ট পাতা আলাদা করুন।',
        'tool_url': '/tools/split-pdf/',
        'tool_icon': '✂️',
    },
    {
        'tool_name_bn': 'ফটো অ্যালবাম মেকার',
        'tool_name_en': 'Photo Album Maker',
        'tool_description': 'প্রিন্ট-রেডি ফটো অ্যালবাম পেজ তৈরি করুন।',
        'tool_url': '/tools/photo-album/',
        'tool_icon': '🖼️',
    },
    {
        'tool_name_bn': 'জিপিএ ক্যালকুলেটর',
        'tool_name_en': 'GPA Calculator',
        'tool_description': 'এসএসসি, এইচএসসি জিপিএ ও বিশ্ববিদ্যালয় সিজিপিএ হিসাব করুন।',
        'tool_url': '/tools/gpa-calculator/',
        'tool_icon': '🎓',
    },
    {
        'tool_name_bn': 'বয়স ক্যালকুলেটর',
        'tool_name_en': 'Age Calculator',
        'tool_description': 'জন্মতারিখ থেকে বয়স, রাশি, হৃদপিণ্ডের স্পন্দন ও মজার তথ্য জানুন।',
        'tool_url': '/tools/age-calculator/',
        'tool_icon': '🎂',
    },
]


def _build_tools_promo_items():
    """Randomly pick 2 tools to promote in the feed."""
    selected_tools = random.sample(TOOLS_CATALOG, min(2, len(TOOLS_CATALOG)))
    items = []
    for tool in selected_tools:
        items.append({
            'item_type': 'tools_promo',
            'tool_icon': tool['tool_icon'],
            'tool_name_bn': tool['tool_name_bn'],
            'tool_name_en': tool['tool_name_en'],
            'tool_description': tool['tool_description'],
            'tool_url': tool['tool_url'],
        })
    return items


def _build_newshub_promo_items():
    """Latest published news articles — pulls summary from linked CollNewsEntry."""
    from amolnama_news.site_apps.newshub.models import PubArticle, CollNewsEntry

    articles = PubArticle.objects.filter(
        is_published=True,
    ).order_by('-created_at')

    # Bulk-fetch linked news entries for summaries
    entry_ids = [article.link_news_entry_id for article in articles if article.link_news_entry_id]
    entry_map = {}
    if entry_ids:
        for entry in CollNewsEntry.objects.filter(newshub_coll_news_entry_id__in=entry_ids):
            entry_map[entry.newshub_coll_news_entry_id] = entry

    items = []
    for article in articles:
        entry = entry_map.get(article.link_news_entry_id)
        description = ''
        if entry:
            description = entry.news_summary_bn or entry.news_content_body_bn or ''

        items.append({
            'item_type': 'content_promo',
            'created_at_raw': article.created_at,
            'promo_id': article.pub_article_id,
            'promo_badge': 'NEWS',
            'promo_color': 'rose',
            'promo_title': article.pub_article_headline_bn or '',
            'promo_description': description[:300],
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
    ).order_by('-created_at')

    items = []
    for poem in poems:
        items.append({
            'item_type': 'content_promo',
            'created_at_raw': poem.created_at,
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
    ).order_by('-created_at')

    items = []
    for story in stories:
        reading_time = getattr(story, 'reading_time_minutes', None)
        items.append({
            'item_type': 'content_promo',
            'created_at_raw': story.created_at,
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
    ).order_by('-created_at')

    items = []
    for artwork in artworks:
        items.append({
            'item_type': 'content_promo',
            'created_at_raw': artwork.created_at,
            'promo_id': artwork.blog_art_coll_artwork_id,
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
    ).order_by('-created_at')

    items = []
    for destination in destinations:
        items.append({
            'item_type': 'content_promo',
            'created_at_raw': destination.created_at,
            'promo_id': destination.blog_bangladesh_coll_destination_id,
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
