---
name: Service worker caches old JS — bump version after every static file change
description: PWA service worker caches /static/ files. After any JS/CSS change, bump CACHE_NAME version in seo/views.py or browser will serve stale files. This was the root cause of repeated "cache issues" — not browser cache.
type: feedback
---

The PWA service worker (seo/views.py → service_worker_js) caches ALL `/static/` files. After updating any JS or CSS file, the browser may still serve the OLD cached version because the service worker intercepts the request.

**Why:** This caused hours of wasted time. Fixes to repeater auto-add, GD/FIR case sensitivity, and news-form-lang.js were all correct but never reached the browser. I kept telling the user to "clear browser cache" when the real problem was the service worker cache I built myself.

**How to apply:**
1. After ANY static file change (JS, CSS), bump `CACHE_NAME` version in `seo/views.py` (e.g. `amolnama-v3` → `amolnama-v4`)
2. NEVER blame "browser cache" without first checking if the service worker is serving stale files
3. The no-cache middleware does NOT help — service workers intercept requests BEFORE they reach the server
4. In development, consider disabling the service worker entirely (don't register sw.js)
5. When debugging "fix not working", first check: is the FIX actually in the file the browser is loading? Use F12 → Network → click the JS file → check Response tab content
6. `collectstatic` copies files to disk but the service worker serves from its own cache — two separate layers
