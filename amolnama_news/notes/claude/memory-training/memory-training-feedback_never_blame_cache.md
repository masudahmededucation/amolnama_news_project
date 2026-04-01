---
name: Never blame cache — investigate the actual code
description: When user reports a warning/bug, NEVER blame browser cache or service worker. Always investigate the actual DOM and code first. Cache was wrongly blamed for 2 weeks on a 5-minute label fix.
type: feedback
---

NEVER blame browser cache when user reports a bug or warning.

**Why:** User reported Flatpickr date label warnings for 2 weeks (~200 times). Every time I said "clear cache", "clear service worker", "hard refresh". The real issue was `<label for>` pointing to elements that Flatpickr transformed — a 5-minute code fix. Cache was never the problem.

**How to apply:**
1. When user reports a warning/bug — investigate the actual code FIRST
2. Open the template/JS file, read the HTML, check if the element IDs match
3. If the warning says "for doesn't match" — check if the `for` value actually exists as an `id` in the rendered DOM
4. NEVER say "clear cache" as a first response
5. Only suggest cache clearing AFTER verifying the code fix is correct AND the collected static files have the fix
6. If "clear cache" doesn't work the FIRST time — it's NOT a cache issue. Stop suggesting it and investigate the code.
