from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
    path("api/auth/", include("amolnama_news.site_apps.user_account.api.urls")),
    path("", include("amolnama_news.site_apps.core.urls")),  # Core app as the homepage
    path("evaluation_vote/", include("amolnama_news.site_apps.evaluation_vote.urls")),  # Evaluation Vote app
    path("election_vote/", include("amolnama_news.site_apps.election_vote.urls")),  # Election Vote app

]

if settings.DEBUG:
    # Add debug toolbar URLs when available to satisfy its reverse lookups
    if "debug_toolbar" in getattr(settings, "INSTALLED_APPS", []):
        # Register debug toolbar URLs under the 'djdt' namespace expected by the toolbar
        urlpatterns = [path("__debug__/", include("debug_toolbar.urls", namespace="djdt"))] + urlpatterns

    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
