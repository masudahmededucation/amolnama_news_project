"""Student Life views — page views and form handling."""

from django.shortcuts import render


def home(request):
    """Student Life landing page."""
    seo = {
        'title': 'ক্যাম্পাস লাইফ — আমলনামা নিউজ | Campus Life',
        'description': 'বিশ্ববিদ্যালয় ও স্কুল ক্যাম্পাসের গল্প, প্রতিভা, এবং অভিজ্ঞতা শেয়ার করুন।',
    }
    return render(request, 'studentlife/pages/studentlife-home.html', {'seo': seo})
