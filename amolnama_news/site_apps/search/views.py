"""Search views — cross-app search page."""

from django.shortcuts import render


def home(request):
    """Search page — input field, results grouped by content type."""
    query = request.GET.get('q', '').strip()
    hashtag = request.GET.get('hashtag', '').strip()

    return render(request, 'search/pages/search-home.html', {
        'query': query,
        'hashtag': hashtag,
        'seo': {
            'title': 'অনুসন্ধান — আমলনামা নিউজ | Search',
            'description': 'সকল কন্টেন্ট অনুসন্ধান করুন — পোস্ট, কবিতা, সংবাদ, বিতর্ক, ভ্রমণ।',
            'breadcrumbs': [{'name': 'হোম', 'url': '/'}, {'name': 'অনুসন্ধান'}],
        },
    })
