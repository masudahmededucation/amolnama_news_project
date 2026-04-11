# Phase 3 Audit — Final Report

**Date:** 2026-04-11
**Branch:** newshub-multiform
**Scope:** 30 apps, code-only sweep against CLAUDE.md gates 0–11
**Excluded:** newsengine, db_backend (own session), DB schema renames (own session — see `db_schema_audit_report.md`)
**Commits:** `9947e3b` (228 files, +3654/-1984), `8d131e6` (10 files, +162/-14)

## What was fixed across all 30 apps

### Cross-cutting (every app touched)
- Removed banned abbreviations (`btn` → `button`, `desc` → `description`, `fts`, `thd`, `c`)
- Removed `.upper()` / `.toUpperCase()` — display via CSS `text-transform`
- Replaced `display:none` with `hidden` HTML attribute
- Tokenized hardcoded hex colors via `colors.css` variables
- Added 44px touch targets, `prefers-reduced-motion` support
- Added `console.error` to silent `.catch()` handlers (no more swallowed errors)
- Switched `_bn` columns to `_en` in `order_by()` (Bengali ordering is unreliable)
- Added `id`+`name` on dynamically-created form elements
- Bumped service worker cache (`seo/views.py:CACHE_NAME`) → `amolnama-v546`

### Per-app highlights
| App | Notable fixes |
|-----|---------------|
| **art** | File upload validation (10MB cap, MIME whitelist), 13 hex → tokens, dead `reverse('art:edit')` removed, fixed `youtube_link.art_coll_artwork_youtube_link_id` → `blog_art_artwork_youtube_link_id` |
| **bangladesh** | Fixed travel-hub.js stray paren `!data.has_next)`, .catch logging |
| **content** | 44px buttons, scoped CSS, `console.exception` logging in cover_urls |
| **core** | `console.error` in 6 silent .catch handlers (sidebar-navigation, notification-bell, like-button, right-panel-trending, photo-card, pwa-register-sw) |
| **debate** | Fixed missing `>` on opening div tag in debate-arena.html line 27 (was breaking layout) |
| **election_vote** | Scoped tokens, og_type/canonical/json_ld added, fixed broken breadcrumb URL |
| **englishtobangla** | Removed broken page route from main urls.py + app urls.py + views.py (kept JS utilities) |
| **evaluation_vote** | voting-submission.js full rewrite (~195 lines), `_bn` → `_en` in order_by, scoped tokens |
| **investigation** | Removed empty URL include from main urls.py |
| **live** | Added missing `seo` context to home view |
| **locations** | address.js display style → `hidden` attr, removed invalid `name` attrs from divs, removed debug print |
| **market** | Switched `order_by` from `commodity_name_bn` to `commodity_name_en` |
| **marriage** | Renamed `btn` → `button` across templates and JS (~70 lines, 11 files) |
| **messenger** | WebSocket auth check in consumers.py (verify ConversationParticipant), 8 hex → tokens, scoped CSS custom properties |
| **multimedia** | Fixed apps.py typo `verbose` → `verbose_name` |
| **newshub** | 212 hex colors → CSS variables across 7 CSS files, fixed silent except in views.py:1588 |
| **poem** | Removed `\|upper` filter, replaced `style="display:none"` with `hidden`, added canonical/og_type/json_ld |
| **portal** | Extracted 5 inline scripts to external JS files (~560 lines), staff_member_required decorators, helpers (`_collect_content_dashboard_items`, `_parse_json_body`), fixed XSS via createTextNode |
| **post** | Removed 13 lines dead code, .catch logging, extracted hex `#059669` → CSS class, fixed inline `style="width"` |
| **pulse** | Added `console.error` to silent .catch |
| **search** | Lowercased content_type_label, .catch logging, 44px touch targets, prefers-reduced-motion |
| **seo** | Switched to `django.utils.html.escape`, documented intentional inline style in service_worker_js |
| **social** | Extracted social-lists.js, fixed `var(--text-muted)` → `var(--muted)` (8 occurrences), 44px buttons |
| **stories** | File upload validation, hex → tokens, `min-height: 44px`, deleted dead `.stories-detail-actions*` block, `fetchpriority="high"` on hero |
| **textextractor** | Replaced raw `threading.Thread` with `newsengine.utils.run_background_task`, scoped tokens, .catch logging |
| **tools** | Removed inline style on disabled year button (267 hex → tokens deferred — large design pass with regression risk) |
| **user_account** | 12 hex colors → tokens in forms.css, 44px touch targets, header-auth.css `#c8960c` → `var(--warning)` |
| **health, security, person** | Empty scaffolds — no fixes needed |

### Bonus fixes (not in original scope)
- **Profile articles page** — `/social/@joes/articles/` now uses shared content-promo-card with per-type colors and live cover URL lookup via `get_cover_urls_for_content_refs` registry. View at [social/views.py:172-272](amolnama_news/site_apps/social/views.py#L172-L272).
- **Universal cover URL resolver** — `content/cover_urls.py` with `COVER_URL_RESOLVERS` registry mapping content_type_code → resolver function.
- **Share dropdown bug** — verified identical across all 4 detail pages (poem/art/story/travel) after user's DB backfill of `link_content_registry_id`.
- **Tools promo cards** — added `tool_sample_image_url` infrastructure (10 tools), template + CSS + README. Drop screenshots at `static/tools/assets/img/promo-samples/{slug}.webp` to activate.
- **Dual-active sidebar nav (final fix)** — server-side fix from prior session was incomplete; SPA navigation JS rebuilt the same `url.startsWith()` bug client-side. Now `<main data-active-sidebar-nav-id="X">` is the single source of truth, JS reads it from parsed response after swap. Verified single-id resolution end-to-end with authenticated test client.

## Deferred items (intentional)

| Item | Reason |
|------|--------|
| **DB schema renames (47 violations / 13 apps)** | HIGH RISK — content has 18 dependent FK constraints; user_account is auth-critical. Documented in `notes/db_schema_audit_report.md` for dedicated session. |
| **newsengine + db_backend** | User explicitly excluded — own dedicated session. |
| **`art:edit` route** | Never created (placeholder `edit_url = ''`). Edit form needs design pass. |
| **Newshub views.py modularisation (3605 lines)** | Candidate split: views_admin.py / views_article.py / views_collection.py — flagged but not split. |
| **Tools 267 hex colors → tokens** | Large design pass with regression risk. |
| **`travel-hub-detail.js` (919 lines) split** | Flagged for future modularisation. |

## Verification

- All 30 apps audited file-by-file via parallel subagents
- Authenticated test client used to verify dual-active fix and profile articles render
- Service worker cache version: **`amolnama-v546`**
- All changes committed and pushed to `newshub-multiform`

## Files of note (created/added this session)

- [content/cover_urls.py](amolnama_news/site_apps/content/cover_urls.py) — universal cover URL registry
- [content/bookmarks.py](amolnama_news/site_apps/content/bookmarks.py) — moved from core/, content type metadata + toggle helpers
- [core/context_processors.py](amolnama_news/site_apps/core/context_processors.py) — `active_sidebar_nav` SIDEBAR_NAV_RULES
- [portal/static/portal/assets/js/pages/analytics-dashboard.js](amolnama_news/site_apps/portal/static/portal/assets/js/pages/analytics-dashboard.js) — extracted from inline
- [portal/static/portal/assets/js/pages/composer-placeholders-admin.js](amolnama_news/site_apps/portal/static/portal/assets/js/pages/composer-placeholders-admin.js)
- [portal/static/portal/assets/js/pages/moderation-queue.js](amolnama_news/site_apps/portal/static/portal/assets/js/pages/moderation-queue.js)
- [portal/static/portal/assets/js/pages/profile-settings.js](amolnama_news/site_apps/portal/static/portal/assets/js/pages/profile-settings.js)
- [social/static/social/assets/js/pages/social-lists.js](amolnama_news/site_apps/social/static/social/assets/js/pages/social-lists.js)
- [election_vote/static/election_vote/assets/js/pages/past-results-drillthrough.js](amolnama_news/site_apps/election_vote/static/election_vote/assets/js/pages/past-results-drillthrough.js)
- [tools/static/tools/assets/img/promo-samples/README.txt](amolnama_news/site_apps/tools/static/tools/assets/img/promo-samples/README.txt)
- [notes/db_schema_audit_report.md](amolnama_news/notes/db_schema_audit_report.md) — DB rename plan
