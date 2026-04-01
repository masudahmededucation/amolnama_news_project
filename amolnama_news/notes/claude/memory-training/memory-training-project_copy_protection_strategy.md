---
name: Copy protection strategy for poems/lyrics
description: Poem text copy adds site attribution automatically now, canvas rendering deferred to production
type: project
---

**Phase 1 (Current — Growth):** When users copy poem/lyrics text, auto-append site attribution:
`— সূত্র: অমলনামা নিউজ (amolnama.news/poem/{id})`
This gives free organic marketing as users share content.

**Phase 2 (Production — Protection):** Switch to canvas rendering for poem body text. Text won't exist in DOM — can't be copied, inspected, or scraped. Also apply JS obfuscation to all client-side code.

**Why:** Early stage needs organic sharing for growth. Locking down content too early kills reach. Attribution in copied text is the best compromise.

**How to apply:** Implement copy-append on poem detail page via JS `copy` event listener. Defer canvas rendering until production deployment.

**Anti-scraping (implement now):**
- Rate limiting on poem API endpoints
- Bot user-agent blocking via middleware
- Require authentication for bulk access
- Honeypot hidden links that trigger IP ban for scrapers
- Consider Cloudflare in production for bot protection
