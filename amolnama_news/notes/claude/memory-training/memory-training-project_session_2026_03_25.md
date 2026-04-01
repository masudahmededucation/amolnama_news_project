---
name: Session log 2026-03-25
description: Community contributions, SEO infrastructure, URL migration, media card redesign, likes, reviews, multi-platform video, Bengali keyboard hooks
type: project
---

## Session 2026-03-25

### Features Built

1. **Community contribution edit/delete** — 6 API endpoints (PATCH/DELETE) for photos, YouTube links, reference links. Permission: contribution owner + destination owner + staff/admin. Uploader attribution. Inline edit forms + delete confirmation.

2. **SEO infrastructure** — JSON-LD schemas (TouristAttraction, CreativeWork, NewsArticle, SoftwareApplication), OG tags, meta descriptions, sitemaps for all article types. Fully automatic.

3. **URL migration** — `/poem/` → `/bangla-kobita-gaan/`, `/bangladesh/` → `/bangladesh-tourist-destinations/`, `/marriage/` → `/bangladesh-marriage-registration/`. 301 redirects from old URLs. Bengali Unicode slugs.

4. **Tools SEO** — SoftwareApplication JSON-LD on all 10 tool pages. Bengali search keyword enrichment (রাশি, জিপিএ, পাসপোর্ট সাইজ ছবি, etc.).

5. **Media card redesign** — Photos and videos changed from background-image thumbs to proper card layout: image top → caption → footer bar (like, views, uploader, time ago, edit/delete).

6. **Like system** — ❤ toggle on photos and videos. DB tables: `eng_destination_photo_like`, `eng_destination_video_like`. Atomic F() increment/decrement. Bulk-fetch user likes to avoid N+1.

7. **View tracking** — 👁 count on photos (lightbox open) and videos (click). Shown in card footer.

8. **Review submission** — Inline form: rating 1-5, title, body, visited date. API creates review, auto-updates avg_rating + review_count. Duplicate prevention (1 review per user per destination).

9. **Multi-platform video** — YouTube, TikTok, Instagram, Facebook support. TikTok thumbnail via oEmbed API. YouTube URL auto-cleaned. Platform auto-detected. CSP updated for TikTok CDN.

10. **BanglaInput hooks** — Avro phonetic attached to all caption/title/description fields across travel-hub-detail, travel-hub-add, beauty-hub-upload. Retry mechanism for script loading order.

11. **Poem improvements** — Queue numbers hidden by default, shown only during autoplay. YouTube autoplay restored with smart retry (3 attempts). Card hover: thick border + pointer cursor.

12. **Nav menu SEO** — Bilingual title attributes on all nav links.

### Bugs Fixed

- `<slug:>` cannot match Bengali Unicode → `<str:>` with static routes first
- poem-card.html passed poem_id instead of poem_slug
- Sitemap referenced non-existent `poem:poem` route
- `_poem_url()` triggered DB writes on every API list call
- Numeric slugs (old ID URLs) → auto-redirect to slug URL (poem + travel hub)
- Django template parentheses in `{% if %}` → expanded to `and`/`or`
- `form_type_name_bn` → `form_name_bn` on RefNewsFormType
- Quill editor IDs mismatched (`th-` vs `travel-hub-`) → empty on edit
- Quill CDN loading race → retry mechanism
- YouTube URL truncation (>500 chars) → clean URL + expand column to 1000
- TikTok thumbnail blocked by CSP → added `*.tiktokcdn.com` to `img-src`
- Like count going negative → `like_count__gt=0` filter on decrement
- Double-click on like button → `disabled` during request
- Duplicate reviews allowed → existence check before create
- Photo upload missing media-card wrapper → proper nested DOM structure
- `.closest()` wrong selector for photo cards → `media-card` not `photo-thumb`
- BanglaInput not attaching → `bangla-input.js` loads after `extra_js` block, added retry
- Travel hub card hover shrink → removed transform, inset box-shadow on image only
- Caption edit not updating in new card layout → search `.media-card-caption` not old `.photo-caption`
- Video title edit not updating → adapted to new card DOM structure
- View count not incrementing → `data-photo-id` on card wrapper, not thumb; DOM count now updated after API
- Photo save/delete selectors wrong → `.media-card[data-photo-id]` not `.photo-thumb[data-photo-id]`
- CSP blocking inline BanglaInput scripts → moved to external JS files (`poem-avro-hook.js`, `bangladesh-avro-hook.js`)
- Dictionary 404 → renamed files to remove "bangla-input" from filename (matched wrong script tag selector)
- BanglaInput not working on newshub step 3 → MutationObserver now watches `attributes` (class/style changes)
- `news-form-lang.js` BanglaInput attach silently failing → added retry if BanglaInput undefined

### Known Limitation
- Quill editor fields (summary, body) can't use BanglaInput — Quill uses `contenteditable` divs, not `<input>`/`<textarea>`. Only regular text inputs get Avro phonetic.

### Service Worker Cache
v77

### DB Changes
- `[poem].[coll_poem_entry].poem_slug` NVARCHAR(500) — added
- `[bangladesh].[coll_destination_youtube_link].video_platform` NVARCHAR(20) — added
- `[bangladesh].[coll_destination_youtube_link].video_thumbnail_url` NVARCHAR(1000) — added
- `[bangladesh].[coll_destination_youtube_link].youtube_url` expanded 500 → 1000
- `[bangladesh].[coll_destination_reference_link].reference_url` expanded 1000 → 2000
- `[bangladesh].[coll_destination_photo].view_count` INT — added
- `[bangladesh].[coll_destination_photo].like_count` INT — added
- `[bangladesh].[coll_destination_youtube_link].view_count` INT — added
- `[bangladesh].[coll_destination_youtube_link].like_count` INT — added
- `[bangladesh].[eng_destination_photo_like]` — new table
- `[bangladesh].[eng_destination_video_like]` — new table
