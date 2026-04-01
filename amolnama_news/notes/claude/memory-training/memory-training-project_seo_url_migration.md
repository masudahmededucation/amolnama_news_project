---
name: SEO URL migration (2026-03-25)
description: Major URL prefix changes for SEO — poem, bangladesh, marriage apps. Bengali slugs, sitemaps, JSON-LD schemas, 301 redirects from old URLs.
type: project
---

## URL Prefix Migration (2026-03-25)

All old URLs 301-redirect to new URLs via `RedirectView` in project `urls.py`.

| Old Prefix | New Prefix | App |
|---|---|---|
| `/poem/` | `/bangla-kobita-gaan/` | poem |
| `/bangladesh/` | `/bangladesh-tourist-destinations/` | bangladesh |
| `/marriage/` | `/bangladesh-marriage-registration/` | marriage |

**Why:** SEO — keyword-rich URL prefixes match how Bangladeshi users search on Google. Bengali transliteration keywords in URLs improve ranking.

**How to apply:** When adding new apps or changing URLs, use keyword-rich prefixes relevant to the target audience's search behavior. Always add 301 redirects from old URLs.

## Bengali Slug URLs

### Poems
- URL: `/bangla-kobita-gaan/<slug>/` (e.g., `/bangla-kobita-gaan/রবীন্দ্রনাথ-ঠাকুর-গীতাঞ্জলি/`)
- Slug auto-generated from: `author_display_name` + `poem_title_bn`
- DB column: `[poem].[coll_poem_entry].poem_slug` (NVARCHAR(500), added 2026-03-25)
- Legacy: `/bangla-kobita-gaan/id/<int>/` → 301 redirect to slug URL
- Generator: `_ensure_poem_slug()` in `poem/views.py`

### Travel Hub Destinations
- URL: `/bangladesh-tourist-destinations/travel/<slug>/`
- Slug auto-generated from: `destination_name_en` (with `allow_unicode=True`)
- DB column: `[bangladesh].[coll_destination].destination_slug` (already existed)
- Legacy: `/bangladesh-tourist-destinations/travel/id/<int>/` → 301 redirect to slug URL
- Generator: `_ensure_destination_slug()` in `bangladesh/views.py`, `_generate_destination_slug()` in `views_api.py`

## SEO Infrastructure Added

| Feature | Poem | Travel Hub | Newshub |
|---|---|---|---|
| Sitemap | PoemDetailSitemap (slug-based) | TravelHubSitemap (slug-based) | NewshubArticleSitemap (slug-based) |
| JSON-LD | CreativeWork schema | TouristAttraction schema | NewsArticle schema (headline, author, datePublished, articleSection) |
| OG tags | og_image (generated PNG), og_type, canonical | og_image (cover photo), og_type, canonical | og_type, canonical (no og_image yet) |
| robots.txt | Allowed | Allowed, /api/ blocked | Blocked (anti-copy) — ready to unblock |
| llms.txt | Listed as "বাংলা কবিতা ও গান" | Listed as "Bangladesh Tourist Destinations" | Not listed (blocked) |

## Newshub Article SEO

- **JSON-LD**: `NewsArticle` schema with headline, author (contributor), datePublished, dateModified, articleSection (form type like চাঁদাবাজি)
- **Meta description**: Auto-generated from `news_summary_bn` or first paragraph (HTML stripped, max 160 chars)
- **Breadcrumbs**: হোম → সংবাদ → [Category] → [Headline]
- **Slug enrichment function**: `build_article_seo_slug()` in `newshub/helpers.py` — builds keyword-rich slug from `form_type + district + headline + year`. Ready to use when PubArticle creation is moved to Python.
- **Sitemap**: `NewshubArticleSitemap` lists all published PubArticle entries. Will be crawled when robots.txt unblocked.

## Hardcoded Path References

When changing URL prefixes, these types of references need updating:
1. **Python views** — breadcrumb URLs, canonical URLs, og_image paths
2. **JavaScript files** — fetch() API calls, `window.location.href` redirects, card link generation
3. **seo/views.py** — robots.txt Disallow paths, llms.txt section links
4. **Documentation** — field mapping files

Django `reverse()` and `{% url %}` template tags auto-update — no manual changes needed for those.

## Tools SEO (10 tool pages)

Every tool page now has:
- **Bilingual title**: Bengali keywords first, English second (e.g., "ফাইলের সাইজ কমান | Reduce File Size")
- **Bilingual description**: Feature-specific Bengali search phrases + English
- **SoftwareApplication JSON-LD schema**: name, description, price (free), applicationCategory (BrowserApplication)
- **OG type**: website
- **Landing page**: CollectionPage JSON-LD schema

**SEO keyword strategy**: Use exact Bengali phrases people type into Google, not generic translations:
- Age calculator: "আপনার রাশি জেনে নিন", "হৃদপিণ্ডের স্পন্দন", "চীনা রাশি", "মজার তথ্য"
- Passport photo: "পাসপোর্ট সাইজ ছবি", "NID ছবি", "স্বাক্ষর", "300x300 পিক্সেল"
- GPA: "এসএসসি জিপিএ", "এইচএসসি জিপিএ", "গ্রেড পয়েন্ট গণনা", "সেমিস্টার ভিত্তিক"
- File compression: "ছবির সাইজ কমান", "PDF ছোট করুন"
- Background remover: "পাসপোর্ট ছবি", "প্রোডাক্ট ফটো", "প্রোফাইল পিকচার"

**How to apply to new tools**: Add `_tool_json_ld()` call in seo dict + think about what Bengali phrases a user would type into Google to find this tool.

## Bug Fixes During Implementation

1. **`<slug:>` cannot match Bengali Unicode** — Django's `<slug:>` only matches `[-a-zA-Z0-9_]+`. Changed to `<str:>` for poem and bangladesh URLs. Static routes (create/, api/, id/) ordered BEFORE the catch-all `<str:slug>/` pattern.
2. **poem-card.html** passed `poem_id` instead of `poem_slug` to `{% url %}` tag — would crash with NoReverseMatch.
3. **Sitemap** referenced `poem:poem` (non-existent) instead of `poem:poem_landing`.
4. **`_poem_url()` performance** — was calling `_ensure_poem_slug()` (DB write) on every API list call. Changed to fall back to ID-redirect URL if no slug exists.

## Service Worker Cache

Bumped to `amolnama-v66` after all changes.

## Files Changed (this migration)

- `urls.py` (project) — new prefixes + 301 redirects
- `poem/models.py` — added `poem_slug` field
- `poem/urls.py` — slug-based routes
- `poem/views.py` — slug generator, slug-based views
- `poem/views_api.py` — `_poem_url()` helper, slug in API responses
- `poem/views_og.py` — slug-based + ID-based OG image views
- 5 poem JS files — updated paths
- 5 bangladesh JS files — updated paths
- `bangladesh/views.py` — slug views, SEO context (JSON-LD, OG)
- `bangladesh/views_api.py` — slug generator, slug in API responses
- `marriage/views.py` — breadcrumb paths
- `marriage/.../marriage-saved-office.js` — API paths
- `seo/views.py` — robots.txt, llms.txt, cache bump
- `seo/sitemaps.py` — new sitemap classes
- `core/templates/core/menu.html` — bilingual title attributes on nav links
