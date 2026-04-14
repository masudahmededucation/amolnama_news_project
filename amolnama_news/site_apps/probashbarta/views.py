"""Probash Barta views — page views and form handling."""

from django.shortcuts import render


def home(request):
    """Probash Barta landing page."""
    seo = {
        'title': 'প্রবাস বার্তা — আমলনামা নিউজ | Probash Barta',
        'description': 'প্রবাসী বাংলাদেশিদের গল্প, অভিজ্ঞতা, টিপস এবং সংবাদ।',
    }
    return render(request, 'probashbarta/pages/probashbarta-home.html', {
        'seo': seo,
        'active_sidebar_nav_id': 'probashbarta',
    })
