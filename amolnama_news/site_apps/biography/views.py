"""Biography views — page views and form handling."""

from django.shortcuts import render


def home(request):
    """Biography landing page."""
    seo = {
        'title': 'জীবনকথা — আমলনামা নিউজ | Biography',
        'description': 'মহান ব্যক্তিদের জীবনী, অনুপ্রেরণামূলক গল্প এবং জীবনের শিক্ষা।',
    }
    return render(request, 'biography/pages/biography-home.html', {
        'seo': seo,
        'active_sidebar_nav_id': 'biography',
    })
