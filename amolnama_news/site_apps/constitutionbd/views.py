"""Constitution BD views — page views and form handling."""

from django.shortcuts import render


def home(request):
    """Constitution BD landing page."""
    seo = {
        'title': 'সংবিধান — আমলনামা নিউজ | Constitution of Bangladesh',
        'description': 'বাংলাদেশের সংবিধান, অনুচ্ছেদ, সংশোধনী এবং আইনি ব্যাখ্যা।',
    }
    return render(request, 'constitutionbd/pages/constitutionbd-home.html', {
        'seo': seo,
        'active_sidebar_nav_id': 'constitutionbd',
    })
