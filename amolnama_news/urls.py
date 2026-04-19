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
    path("newsroom/", include("amolnama_news.site_apps.newsroom.urls")),  # Newsroom — editorial & layout engine
    path("search/", include("amolnama_news.site_apps.search.urls")),  # Search — cross-app search engine
    path("newsengine/", include("amolnama_news.site_apps.newsengine.urls")),  # Newsengine — content distribution & push
    path("portal/", include("amolnama_news.site_apps.portal.urls")),  # Portal — unified user dashboard
    path("security/", include("amolnama_news.site_apps.security.urls")),  # Security — access control, audit, permissions
    path("social/", include("amolnama_news.site_apps.social.urls")),  # Social — community interactions & sharing
    path("pulse/", include("amolnama_news.site_apps.pulse.urls")),  # Pulse — analytics, trends & real-time metrics
    path("messenger/", include("amolnama_news.site_apps.messenger.urls")),  # Messenger — internal messaging & notifications
    path("live/", include("amolnama_news.site_apps.live.urls")),  # Live — real-time updates & live coverage
    path("post/", include("amolnama_news.site_apps.post.urls")),  # Post — user posts (Twitter-style short content)
    path("market/", include("amolnama_news.site_apps.market.urls")),  # Market app
    # investigation app URL include removed — urls.py is empty (dead route). Models retained for data import scripts.
    path("tools/", include("amolnama_news.site_apps.tools.urls")),  # Tools app

    # SEO-friendly URL prefixes
    path("bangla-kobita-gaan/", include("amolnama_news.site_apps.poem.urls")),  # Poetry & Songs
    path("art-and-craft/", include("amolnama_news.site_apps.art.urls")),  # Art & Craft
    path("stories-for-kids/", include("amolnama_news.site_apps.stories.urls")),  # Stories for Kids
    path("bangladesh-marriage-registration/", include("amolnama_news.site_apps.marriage.urls")),  # Marriage
    path("health/", include("amolnama_news.site_apps.health.urls")),  # Health
    path("debate/", include("amolnama_news.site_apps.debate.urls")),  # Debate — discussion & argumentation platform
    path("campus-life/", include("amolnama_news.site_apps.studentlife.urls")),  # Student Life — campus experiences & talent
    path("probash-barta/", include("amolnama_news.site_apps.probashbarta.urls")),  # Probash Barta — diaspora stories & experiences
    path("jibonkotha/", include("amolnama_news.site_apps.biography.urls")),  # Biography — জীবনকথা, inspirational life stories
    path("songbidhan/", include("amolnama_news.site_apps.constitutionbd.urls")),  # Constitution BD — সংবিধান
    path("itihas/", include("amolnama_news.site_apps.historybd.urls")),  # History BD — ইতিহাস
    path("mastermind/", include("amolnama_news.site_apps.mastermind.urls")),  # Mastermind — quiz/exam engine + multiplayer pages
    # Friendly top-level alias for shareable multiplayer join URLs.
    path("play/<str:join_code>/", RedirectView.as_view(url="/mastermind/play/%(join_code)s/", permanent=False)),
    path("quizadmin/", include("amolnama_news.site_apps.quizadmin.urls")),  # Quiz Panel — staff-only admin dashboard
    path("bookwriter/", include("amolnama_news.site_apps.bookwriter.urls")),  # Bookwriter — কলম, original book writing
    path("text-extractor/", include("amolnama_news.site_apps.textextractor.urls")),  # Text Extractor
    path("bangladesh-tourist-destinations/", include("amolnama_news.site_apps.bangladesh.urls")),  # Bangladesh (travel, beauty)
    # englishtobangla: no URL routes — app ships JS utilities only (static/englishtobangla/...)

    # 301 redirects from old URLs (preserve bookmarks + Google index)
    path("poem/", RedirectView.as_view(url="/bangla-kobita-gaan/", permanent=True)),
    path("poem/<path:rest>", RedirectView.as_view(url="/bangla-kobita-gaan/%(rest)s", permanent=True)),
    path("marriage/", RedirectView.as_view(url="/bangladesh-marriage-registration/", permanent=True)),
    path("marriage/<path:rest>", RedirectView.as_view(url="/bangladesh-marriage-registration/%(rest)s", permanent=True)),
    path("bangladesh/", RedirectView.as_view(url="/bangladesh-tourist-destinations/", permanent=True)),
    path("bangladesh/<path:rest>", RedirectView.as_view(url="/bangladesh-tourist-destinations/%(rest)s", permanent=True)),

    # 301 redirects from old Bengali slugs → new English slugs (slug migration 2026-04-16)
    # Poem (6 records)
    path("bangla-kobita-gaan/দর্পন-কবির-বসন্ত-নয়-অবহেলা/", RedirectView.as_view(url="/bangla-kobita-gaan/bosonto-noyo-obhela/", permanent=True)),
    path("bangla-kobita-gaan/ইমরান-কায়েস-একটাই-জীবন/", RedirectView.as_view(url="/bangla-kobita-gaan/ektai-jibon/", permanent=True)),
    path("bangla-kobita-gaan/নির্মলেন্দু-গুণ-তোমার-চোখ-এতো-লাল-কেনো/", RedirectView.as_view(url="/bangla-kobita-gaan/tomar-chokh-eto-lal-keno/", permanent=True)),
    path("bangla-kobita-gaan/সুনীল-গঙ্গোপাধ্যায়-কেউ-কথা-রাখেনি/", RedirectView.as_view(url="/bangla-kobita-gaan/keu-kotha-rakheni/", permanent=True)),
    path("bangla-kobita-gaan/জীবনানন্দ-দাশ-আবার-আসিব-ফিরে/", RedirectView.as_view(url="/bangla-kobita-gaan/abar-asib-fire/", permanent=True)),
    path("bangla-kobita-gaan/পাগল-হাসান-না-জ্বালাইলে-লাগে-আমার-কি-জানি-কি-নাই/", RedirectView.as_view(url="/bangla-kobita-gaan/na-jbalaile-lage-amar-ki-jani-ki-nai/", permanent=True)),
    # Debate (1 record)
    path("debate/topic/৭২-এর-সংবিধান-কি-ছুঁড়ে-ফেলা-উচিত/", RedirectView.as_view(url="/debate/topic/72-er-songbidhan-ki-chunre-fela-uchit/", permanent=True)),
    # Newshub (1 record)
    path("newshub/article/chandabaji-dhaka-সড়কে-চাঁদাবাজির-বর্তমান-চিত্র-2026/", RedirectView.as_view(url="/newshub/article/sorke-chandabajir-bortman-chitro/", permanent=True)),

]

if settings.DEBUG:
    # Add debug toolbar URLs when available to satisfy its reverse lookups
    if "debug_toolbar" in getattr(settings, "INSTALLED_APPS", []):
        # Register debug toolbar URLs under the 'djdt' namespace expected by the toolbar
        urlpatterns = [path("__debug__/", include("debug_toolbar.urls", namespace="djdt"))] + urlpatterns

    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
