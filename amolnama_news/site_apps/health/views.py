"""Health views."""

from django.shortcuts import render


def home(request):
    """Health landing page."""
    return render(request, 'core/base.html')
