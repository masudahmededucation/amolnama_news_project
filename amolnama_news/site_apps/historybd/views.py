"""History BD views — page views and form handling."""

from django.shortcuts import render


def home(request):
    """History BD landing page."""
    seo = {
        'title': 'ইতিহাস — আমলনামা নিউজ | History of Bangladesh',
        'description': 'বাংলাদেশের ইতিহাস, ঐতিহাসিক ঘটনা, মুক্তিযুদ্ধ এবং সভ্যতার ধারা।',
    }
    return render(request, 'historybd/pages/historybd-home.html', {
        'seo': seo,
        'active_sidebar_nav_id': 'historybd',
    })
