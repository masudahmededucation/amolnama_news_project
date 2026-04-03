"""Search views — cross-app search page with home feed."""

from django.shortcuts import render

from amolnama_news.site_apps.newsengine.feed_builder import build_home_feed


def home(request):
    """Search page — search input + full post feed (no composer)."""
    query = request.GET.get('q', '').strip()
    hashtag = request.GET.get('hashtag', '').strip()

    breadcrumbs = [{'name': 'হোম', 'url': '/'}]
    if hashtag:
        breadcrumbs.append({'name': '#' + hashtag})
    elif query:
        breadcrumbs.append({'name': 'সার্চ রেজাল্ট: ' + query})
    else:
        breadcrumbs.append({'name': 'সার্চ রেজাল্ট'})

    # Build the same feed as home page (without composer)
    feed_items, current_user_avatar_url, _, _ = build_home_feed(request)

    return render(request, 'search/pages/search-home.html', {
        'query': query,
        'hashtag': hashtag,
        'posts': feed_items,
        'current_user_avatar_url': current_user_avatar_url,
        'seo': {
            'title': ('#' + hashtag if hashtag else query or 'সার্চ') + ' — আমলনামা নিউজ',
            'description': 'সকল কন্টেন্ট অনুসন্ধান করুন — পোস্ট, কবিতা, সংবাদ, বিতর্ক, ভ্রমণ।',
            'breadcrumbs': breadcrumbs,
        },
    })
