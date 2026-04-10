"""Universal cover URL resolver for any list of content references.

Used by features that display mixed-content lists (bookmarks, feed cards,
recently-viewed widgets, search results) and need to bulk-fetch cover images
without N hardcoded if/else branches per content type.

Architecture: a registry of per-content-type resolver functions, each one
knows where its content type stores cover images (asset table vs coll column).
Adding a new content type = ONE entry in COVER_URL_RESOLVERS below.

Usage:
    from amolnama_news.site_apps.content.cover_urls import get_cover_urls_for_content_refs

    # Pass a list of (content_type_code, content_id) tuples
    refs = [('art', 1), ('story', 3), ('destination', 1), ('news', 42)]
    covers = get_cover_urls_for_content_refs(refs)
    # → {('art', 1): '/media/...', ('destination', 1): '/media/...', ...}
"""


def _resolve_art_covers(content_ids):
    """Cover URLs for art entries — pulled from blog_art.artwork_asset."""
    from amolnama_news.site_apps.newsengine.promo_builders import _bulk_cover_urls
    return _bulk_cover_urls('blog_art', 'artwork_asset', 'link_blog_art_coll_artwork_id', content_ids)


def _resolve_story_covers(content_ids):
    """Cover URLs for story entries — pulled from blog_stories.story_asset."""
    from amolnama_news.site_apps.newsengine.promo_builders import _bulk_cover_urls
    return _bulk_cover_urls('blog_stories', 'story_asset', 'link_blog_stories_coll_story_id', content_ids)


def _resolve_news_covers(pub_article_ids):
    """Cover URLs for news articles — joined through PubArticle → coll_news_entry → news_asset.
    Bookmarks store pub_article_id, but news_asset is keyed by coll_news_entry_id.
    """
    from amolnama_news.site_apps.newshub.models import PubArticle
    from amolnama_news.site_apps.newsengine.promo_builders import _bulk_cover_urls

    article_to_entry = dict(PubArticle.objects.filter(
        pub_article_id__in=pub_article_ids,
    ).values_list('pub_article_id', 'link_news_entry_id'))
    if not article_to_entry:
        return {}

    entry_covers = _bulk_cover_urls(
        'newshub', 'news_asset', 'link_newshub_coll_news_entry_id', list(article_to_entry.values()),
    )
    return {
        pub_id: entry_covers.get(entry_id, '')
        for pub_id, entry_id in article_to_entry.items()
        if entry_covers.get(entry_id)
    }


def _resolve_destination_covers(content_ids):
    """Cover URLs for travel destinations — stored directly on coll_destination row."""
    from amolnama_news.site_apps.bangladesh.models import CollDestination
    return dict(CollDestination.objects.filter(
        blog_bangladesh_coll_destination_id__in=content_ids,
    ).values_list('blog_bangladesh_coll_destination_id', 'cover_image_url'))


# Registry: content_type_code → resolver function
# Adding a new content type with covers = ONE entry here. No view code changes.
# Content types not in this map will simply have no cover (e.g. poems, debate topics).
COVER_URL_RESOLVERS = {
    'art':         _resolve_art_covers,
    'story':       _resolve_story_covers,
    'news':        _resolve_news_covers,
    'destination': _resolve_destination_covers,
}


def get_cover_urls_for_content_refs(content_refs):
    """Bulk-fetch cover URLs for a list of (content_type_code, content_id) references.

    Args:
        content_refs: iterable of (str, int) tuples — e.g. [('art', 1), ('story', 3)]

    Returns:
        dict: {(type_code, content_id): cover_url_str} — only entries that have a cover
    """
    if not content_refs:
        return {}

    # Group ids by type so each resolver gets one bulk call
    ids_by_type = {}
    for type_code, content_id in content_refs:
        ids_by_type.setdefault(type_code, []).append(content_id)

    result = {}
    for type_code, content_ids in ids_by_type.items():
        resolver = COVER_URL_RESOLVERS.get(type_code)
        if not resolver:
            continue  # content type without registered cover resolver — skip
        try:
            type_covers = resolver(content_ids) or {}
        except Exception:
            continue  # one type failing must not break the others
        for content_id, url in type_covers.items():
            if url:
                result[(type_code, content_id)] = url
    return result
