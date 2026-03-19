"""
Anti-scraper middleware — blocks automated text grabbers, bots, and scrapers.
Allows legitimate browsers and search engine crawlers (Google, Bing, etc.).
"""

import time
import re
from django.http import HttpResponseForbidden

# Known bot/scraper user-agent patterns (block these)
BLOCKED_UA_PATTERNS = [
    r"(?i)scrapy",
    r"(?i)python-requests",
    r"(?i)python-urllib",
    r"(?i)python-httpx",
    r"(?i)httpx",
    r"(?i)aiohttp",
    r"(?i)curl/",
    r"(?i)wget/",
    r"(?i)httrack",
    r"(?i)offline\s*explorer",
    r"(?i)website\s*copier",
    r"(?i)teleport\s*pro",
    r"(?i)webcopier",
    r"(?i)webzip",
    r"(?i)grab",
    r"(?i)harvest",
    r"(?i)extract",
    r"(?i)sitesucker",
    r"(?i)blackwidow",
    r"(?i)webstripper",
    r"(?i)netspider",
    r"(?i)go-http-client",
    r"(?i)java/",
    r"(?i)libwww-perl",
    r"(?i)mechanize",
    r"(?i)phantomjs",
    r"(?i)headlesschrome",
    r"(?i)selenium",
    r"(?i)webdriver",
    r"(?i)puppeteer",
    r"(?i)playwright",
    r"(?i)node-fetch",
    r"(?i)axios/",
    r"(?i)okhttp",
    r"(?i)apache-httpclient",
    r"(?i)colly",
    r"(?i)fasthttp",
]

# Allowed bots (search engines, social media previews)
ALLOWED_UA_PATTERNS = [
    r"(?i)googlebot",
    r"(?i)bingbot",
    r"(?i)slurp",        # Yahoo
    r"(?i)duckduckbot",
    r"(?i)baiduspider",
    r"(?i)yandexbot",
    r"(?i)facebot",      # Facebook
    r"(?i)twitterbot",
    r"(?i)linkedinbot",
    r"(?i)whatsapp",
    r"(?i)telegrambot",
    r"(?i)discordbot",
    r"(?i)applebot",
    r"(?i)msnbot",
]

# Compile patterns once
_blocked_re = [re.compile(p) for p in BLOCKED_UA_PATTERNS]
_allowed_re = [re.compile(p) for p in ALLOWED_UA_PATTERNS]

# Simple in-memory rate limiter per IP (reset every 60 seconds)
_rate_store = {}  # {ip: [timestamp, count]}
RATE_LIMIT = 60          # max requests per window
RATE_WINDOW = 60          # seconds


class AntiScraperMiddleware:
    """Block automated scrapers and rate-limit suspicious traffic."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Skip static files and admin
        path = request.path
        if path.startswith("/static/") or path.startswith("/admin/") or path.startswith("/__debug__/") or path.endswith("/og-image.png"):
            return self.get_response(request)

        ua = request.META.get("HTTP_USER_AGENT", "")

        # 1. No user-agent = likely a bot
        if not ua:
            return HttpResponseForbidden("Access denied.")

        # 2. Check if it's an allowed bot (search engines)
        for pattern in _allowed_re:
            if pattern.search(ua):
                return self.get_response(request)

        # 3. Block known scraper user-agents
        for pattern in _blocked_re:
            if pattern.search(ua):
                return HttpResponseForbidden("Access denied.")

        # 4. Rate limiting per IP
        ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
        if not ip:
            ip = request.META.get("REMOTE_ADDR", "")

        now = time.time()
        if ip in _rate_store:
            entry = _rate_store[ip]
            if now - entry[0] > RATE_WINDOW:
                # Reset window
                _rate_store[ip] = [now, 1]
            else:
                entry[1] += 1
                if entry[1] > RATE_LIMIT:
                    return HttpResponseForbidden(
                        "Rate limit exceeded. Please slow down."
                    )
        else:
            _rate_store[ip] = [now, 1]

        # 5. Periodically clean old entries (every ~100 requests)
        if len(_rate_store) > 1000:
            cutoff = now - RATE_WINDOW * 2
            _rate_store.clear()

        return self.get_response(request)
