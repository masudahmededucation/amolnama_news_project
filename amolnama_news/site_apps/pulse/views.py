"""Pulse views — redirects to homepage."""

from django.shortcuts import redirect


def home(request):
    """Redirect /pulse/ to / — homepage serves the pulse feed."""
    return redirect('core:home')
