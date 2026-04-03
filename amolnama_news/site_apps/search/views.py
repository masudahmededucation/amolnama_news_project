"""Search views — cross-app search page."""

from django.shortcuts import render


def home(request):
    """Search page — input field, results grouped by content type."""
    query = request.GET.get('q', '').strip()
    hashtag = request.GET.get('hashtag', '').strip()

    breadcrumbs = [{'name': 'হোম', 'url': '/'}]
    if hashtag:
        breadcrumbs.append({'name': '#' + hashtag})
    elif query:
        breadcrumbs.append({'name': 'সার্চ রেজাল্ট: ' + query})
    else:
        breadcrumbs.append({'name': 'সার্চ রেজাল্ট'})

    return render(request, 'search/pages/search-home.html', {
        'query': query,
        'hashtag': hashtag,
        'seo': {
            'title': ('#' + hashtag if hashtag else query or 'অনুসন্ধান') + ' — আমলনামা নিউজ',
            'description': 'সকল কন্টেন্ট অনুসন্ধান করুন — পোস্ট, কবিতা, সংবাদ, বিতর্ক, ভ্রমণ।',
            'breadcrumbs': breadcrumbs,
        },
    })
