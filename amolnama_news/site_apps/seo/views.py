"""SEO views — robots.txt, llms.txt, PWA manifest & service worker from root URLs."""

import json

from django.http import HttpResponse
from django.templatetags.static import static
from django.views.decorators.cache import cache_control


@cache_control(max_age=86400)  # cache 24h
def robots_txt(request):
    """Serve /robots.txt for search engine crawlers."""
    host = request.build_absolute_uri("/")
    lines = [
        "User-agent: *",
        "Allow: /",
        "",
        "# Disallow private/admin areas",
        "Disallow: /admin/",
        "Disallow: /account/",
        "Disallow: /accounts/",
        "Disallow: /api/",
        "",
        "# Newshub: blocked to prevent content copying",
        "Disallow: /newshub/",
        "",
        "# Bookwriter: per-user library + private editor surfaces",
        "Disallow: /bookwriter/",
        "Allow: /bookwriter/read/",
        "Allow: /bookwriter/marketplace/",
        "",
        "# Disallow API endpoints within apps",
        "Disallow: /evaluation_vote/api/",
        "Disallow: /election_vote/api/",
        "Disallow: /bangladesh-marriage-registration/api/",
        "Disallow: /tools/api/",
        "Disallow: /market/api/",
        "Disallow: /bangladesh-tourist-destinations/api/",
        "",
        f"Sitemap: {host}sitemap.xml",
        "",
        "# AI crawlers",
        f"# See {host}llms.txt for AI-readable site description",
    ]
    return HttpResponse("\n".join(lines), content_type="text/plain; charset=utf-8")


@cache_control(max_age=86400)
def llms_txt(request):
    """Serve /llms.txt — AI crawler guide (2025/2026 standard).

    Tells AI models (GPT, Gemini, Perplexity, Claude) what this site is about
    so they can cite and recommend it to users.
    """
    host = request.build_absolute_uri("/")
    content = f"""# Amolnama News (আমলনামা নিউজ)

> Bangladesh's independent news platform. Truth is our strength (সত্যই আমাদের শক্তি).

## About

Amolnama News is a Bangladeshi news and civic engagement platform covering:
- Politics and political accountability tracking
- Crime and violence reporting
- July Uprising documentation and martyr profiles
- Sports coverage
- Entertainment news
- Community voices and civic issues
- Global news with Bangladesh perspective
- Price hike and market monitoring
- Election and evaluation voting
- Marriage registration services
- Investigation journalism

The platform operates in both Bengali (বাংলা) and English.

## Sections

- [Home]({host})
- [About]({host}about/)
- [Contact]({host}contact/)
- [Community Voice]({host}communityvoice/)
- [Evaluation Vote]({host}evaluation_vote/)
- [Election Vote]({host}election_vote/)
- [Tools]({host}tools/)
- [Marriage Services]({host}marriage/)
- [বাংলা কবিতা ও গান (Poetry & Songs)]({host}bangla-kobita-gaan/)
- [Bangladesh Tourist Destinations]({host}bangladesh-tourist-destinations/) — Tourist attractions, destinations, and travel guides across Bangladesh
- [Bangladesh Photo Gallery]({host}bangladesh-tourist-destinations/beauty/) — Photo and video gallery of Bangladesh's natural beauty
- [Bangladesh Marriage Registration]({host}bangladesh-marriage-registration/) — Marriage registration services
- [শিল্পকলা (Art & Craft)]({host}art-and-craft/) — Bengali traditional and contemporary art gallery, tutorials, community uploads
- [গল্পের ঝুলি (Stories for Kids)]({host}stories-for-kids/) — Bengali children's stories — ঠাকুরমার ঝুলি, রূপকথা, নীতিকথা, ঘুমপাড়ানি গল্প
- [বিতর্ক (Debate)]({host}debate/) — Structured debate platform with blue/red sides, fact-checking, audience voting
- [কলম Marketplace]({host}bookwriter/marketplace/) — Every book published through কলম: free public reading of fiction, non-fiction, poetry, and serialised works by Bangladeshi writers

## শিল্পকলা (Art & Craft)

Bengali art and craft platform featuring:
- Traditional forms: নকশি কাঁথা, পটচিত্র, আলপনা, মৃৎশিল্প, রিকশা আর্ট, জামদানি
- Contemporary: painting, drawing, calligraphy, digital art, sculpture
- Community uploads with tutorials, materials, and backstories
- 21 categories covering Bengali heritage and modern art

## গল্পের ঝুলি (Stories for Kids)

Bengali children's story collection featuring:
- Heritage stories: ঠাকুরমার ঝুলি, পঞ্চতন্ত্র, জাতক কাহিনী, গোপাল ভাঁড়, টুনটুনির গল্প
- Categories: রূপকথা, নীতিকথা, ঘুমপাড়ানি গল্প, হাসির গল্প, অ্যাডভেঞ্চার
- Age groups: 3-5, 6-8, 9-12
- Paginated reading with illustrations

## Bangladesh Travel Hub

Community-driven travel guide for Bangladesh. Destinations include:
- Historical sites, natural landmarks, and scenic spots
- Transport routes, accommodation options, and travel tips
- User-uploaded photos, YouTube videos, and reference links
- Ratings and reviews from travellers
- Bengali (বাংলা) and English content for each destination

## Tools (Free, Client-Side)

- [File Compression]({host}tools/reduce-file-size/) — Reduce image, PDF, and document file sizes
- [File Conversion]({host}tools/file-conversion/) — Convert between file formats
- [ZIP Creator]({host}tools/zip-creator/) — Bundle files into ZIP archives
- [Passport Photo Resizer]({host}tools/passport-photo-resizer/) — Resize photos for passport/visa
- [Background Remover]({host}tools/background-remover/) — AI-powered image background removal
- [Document Merger]({host}tools/merge-documents/) — Merge PDFs and images into one PDF
- [PDF Splitter]({host}tools/split-pdf/) — Extract specific pages from a PDF file
- [Photo Album Maker]({host}tools/photo-album/) — Create printable photo album pages
- [Watermark Remover]({host}tools/watermark-remover/) — Remove watermarks, logos, and unwanted text from images

## Contact

- Website: {host}
- Contact page: {host}contact/
"""
    return HttpResponse(content, content_type="text/plain; charset=utf-8")


@cache_control(max_age=86400)
def manifest_json(request):
    """Serve /manifest.json for Progressive Web App (PWA) support."""
    icon_192 = request.build_absolute_uri(static("core/assets/img/pwa-icon-192.png"))
    icon_512 = request.build_absolute_uri(static("core/assets/img/pwa-icon-512.png"))

    manifest = {
        "name": "Amolnama News",
        "short_name": "Amolnama",
        "description": "বাংলাদেশের স্বাধীন সংবাদ মাধ্যম — সত্যই আমাদের শক্তি। Bangladesh's independent news platform.",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "orientation": "any",
        "theme_color": "#1a1a2e",
        "background_color": "#ffffff",
        "lang": "bn",
        "dir": "ltr",
        "categories": ["news", "media"],
        "icons": [
            {
                "src": icon_192,
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "any",
            },
            {
                "src": icon_512,
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "any",
            },
            {
                "src": icon_192,
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "maskable",
            },
            {
                "src": icon_512,
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "maskable",
            },
        ],
    }
    return HttpResponse(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        content_type="application/manifest+json; charset=utf-8",
    )


@cache_control(max_age=3600)
def service_worker_js(request):
    """Serve /sw.js — PWA service worker for offline caching.

    Must be at root URL for maximum scope (/).

    NOTE: The offline fallback HTML inside this script contains an inline
    <style> block and hardcoded hex colors. This is INTENTIONAL — the offline
    page must be fully self-contained because no external requests can be
    made when the user is offline. Do NOT extract these styles to an external
    CSS file. The hex colors in manifest_json (theme_color / background_color)
    are also intentional because the W3C Web App Manifest spec requires
    concrete color values and cannot reference CSS variables.
    """
    sw_code = """\
var CACHE_NAME = 'amolnama-v937';
var OFFLINE_URL = '/';

// Assets to pre-cache on install
var PRE_CACHE = [
  '/',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRE_CACHE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (CDN scripts, fonts, tiles)
  if (!request.url.startsWith(self.location.origin)) return;

  // Skip API and admin requests
  if (request.url.indexOf('/api/') !== -1) return;
  if (request.url.indexOf('/admin/') !== -1) return;

  var isStaticAsset = request.url.indexOf('/static/') !== -1 || request.url.indexOf('/manifest.json') !== -1;
  var isPageNavigation = request.mode === 'navigate';

  if (isStaticAsset) {
    // STATIC ASSETS: cache-first, network-fallback (fast, offline-safe)
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(request, clone); });
          }
          return response;
        }).catch(function () {
          return new Response('', { status: 503 });
        });
      })
    );
  } else if (isPageNavigation) {
    // PAGE HTML: network only, offline shows cached home or offline message
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match(OFFLINE_URL).then(function (cached) {
          return cached || new Response('<!DOCTYPE html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>অফলাইন — আমলনামা নিউজ</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#f5f5f5;color:#333;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem}.offline-box{background:#fff;padding:2.5rem;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:400px}.offline-icon{font-size:3.5rem;margin-bottom:1rem}.offline-title{font-size:1.3rem;font-weight:800;margin-bottom:.5rem}.offline-text{font-size:.9rem;color:#666;margin-bottom:1.5rem;line-height:1.5}.offline-button{display:inline-block;padding:.6rem 1.5rem;background:#1B6B4A;color:#fff;border:none;border-radius:20px;font-size:.9rem;font-weight:700;cursor:pointer;text-decoration:none}</style></head><body><div class="offline-box"><div class="offline-icon">📡</div><h1 class="offline-title">ইন্টারনেট সংযোগ নেই</h1><p class="offline-text">আপনি এই মুহূর্তে অফলাইন আছেন।<br>ইন্টারনেট সংযোগ পুনরুদ্ধার হলে আবার চেষ্টা করুন।</p><a href="javascript:location.reload()" class="offline-button">আবার চেষ্টা করুন</a></div></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        });
      })
    );
  }
});
"""
    return HttpResponse(sw_code, content_type="application/javascript; charset=utf-8")
