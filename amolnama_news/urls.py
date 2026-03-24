from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView

urlpatterns = [
    path("", include("amolnama_news.site_apps.seo.urls")),  # SEO: robots.txt, sitemap.xml, llms.txt
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
    path("api/auth/", include("amolnama_news.site_apps.user_account.api.urls")),
    path("account/", include("amolnama_news.site_apps.user_account.urls")),
    path("", include("amolnama_news.site_apps.core.urls")),  # Core app as the homepage
    path("evaluation_vote/", include("amolnama_news.site_apps.evaluation_vote.urls")),  # Evaluation Vote app
    path("election_vote/", include("amolnama_news.site_apps.election_vote.urls")),  # Election Vote app
    path("newshub/", include("amolnama_news.site_apps.newshub.urls")),  # News Hub app
    path("market/", include("amolnama_news.site_apps.market.urls")),  # Market app
    path("investigation/", include("amolnama_news.site_apps.investigation.urls")),  # Investigation app
    path("tools/", include("amolnama_news.site_apps.tools.urls")),  # Tools app

    # SEO-friendly URL prefixes
    path("bangla-kobita-gaan/", include("amolnama_news.site_apps.poem.urls")),  # Poetry & Songs
    path("bangladesh-marriage-registration/", include("amolnama_news.site_apps.marriage.urls")),  # Marriage
    path("bangladesh-tourist-destinations/", include("amolnama_news.site_apps.bangladesh.urls")),  # Bangladesh (travel, beauty)
    path("englishtobangla/", include("amolnama_news.site_apps.englishtobangla.urls")),  # English to Bangla transliteration

    # 301 redirects from old URLs (preserve bookmarks + Google index)
    path("poem/", RedirectView.as_view(url="/bangla-kobita-gaan/", permanent=True)),
    path("poem/<path:rest>", RedirectView.as_view(url="/bangla-kobita-gaan/%(rest)s", permanent=True)),
    path("marriage/", RedirectView.as_view(url="/bangladesh-marriage-registration/", permanent=True)),
    path("marriage/<path:rest>", RedirectView.as_view(url="/bangladesh-marriage-registration/%(rest)s", permanent=True)),
    path("bangladesh/", RedirectView.as_view(url="/bangladesh-tourist-destinations/", permanent=True)),
    path("bangladesh/<path:rest>", RedirectView.as_view(url="/bangladesh-tourist-destinations/%(rest)s", permanent=True)),

]

if settings.DEBUG:
    # Add debug toolbar URLs when available to satisfy its reverse lookups
    if "debug_toolbar" in getattr(settings, "INSTALLED_APPS", []):
        # Register debug toolbar URLs under the 'djdt' namespace expected by the toolbar
        urlpatterns = [path("__debug__/", include("debug_toolbar.urls", namespace="djdt"))] + urlpatterns

    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
