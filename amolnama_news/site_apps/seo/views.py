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
    """
    sw_code = """\
var CACHE_NAME = 'amolnama-v68';
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

  // Network-first strategy: try network, fall back to cache
  event.respondWith(
    fetch(request).then(function (response) {
      // Cache successful responses for static assets
      if (response.ok && (
        request.url.indexOf('/static/') !== -1 ||
        request.url.indexOf('/manifest.json') !== -1
      )) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, clone);
        });
      }
      return response;
    }).catch(function () {
      // Offline: serve from cache
      return caches.match(request).then(function (cached) {
        if (cached) return cached;
        // For navigation requests, show cached home page
        if (request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
"""
    return HttpResponse(sw_code, content_type="application/javascript; charset=utf-8")
