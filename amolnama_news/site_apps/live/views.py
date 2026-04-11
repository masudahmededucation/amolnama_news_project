from django.shortcuts import render


def home(request):
    """Live app landing page — real-time updates & live coverage (skeleton)."""
    seo = {
        "title": "Live Coverage — Amolnama",
        "description": "Real-time live coverage and updates on Amolnama.",
        "canonical": request.build_absolute_uri(),
        "breadcrumbs": [
            {"name": "Home", "url": "/"},
            {"name": "Live", "url": request.path},
        ],
    }
    return render(request, "core/base.html", {"seo": seo})
