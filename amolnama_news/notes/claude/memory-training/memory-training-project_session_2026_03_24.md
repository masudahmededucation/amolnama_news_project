---
name: Session 2026-03-24 work log
description: Full list of features built, bugs fixed, and documents updated on 2026-03-24
type: project
---

## Features Built (2026-03-24)

### Newshub — Edit Pre-Population (Phase 1: Extortion)
- Edit button on article view → `/newshub/news-collection/multistep/extortion/?edit=<id>`
- `helpers.py:build_edit_data()` reconstructs all form data from DB (contributor, news content, actors, extortion incident, legal, location, social sources, tags)
- BIT flag → status_id reverse maps for extortion (sector 427-436, affiliation 444-451, threat 452-460, consequence 461-470, context 472-473)
- `news-form-edit-load.js` runs before component scripts, sets hidden JSON inputs
- `news-form-persist.js` skips localStorage restore in edit mode (`window.__EDIT_MODE__`)
- `_handle_news_submission()` UPDATE mode: updates existing entry, delete+re-insert junctions
- Duplicate headline check excludes own entry in edit mode
- Redirect to article view after edit save
- Performance: 11 RefStatus queries → 1 batch. N+1 actor/social queries eliminated.

### Newshub — Article View Improvements
- Form type badge (চাঁদাবাজি) on article detail + landing cards (purple #6d5e9b)
- Status widget redesign: badge + ✎ Edit button toggle → dropdown (no duplication)
- Article owner can change publication status (not just admin/staff)
- All `alert()` replaced with inline messages (feedback_no_popups.md rule)
- Nav menu fix: সংবাদ and নাগরিক সংবাদ কেন্দ্র no longer both highlighted (was using namespace only, now uses url_name)
- Sidenote label: অবস্থান → স্থান

### Bangladesh — Travel Hub Community Features
- 3 new API endpoints: photo upload, YouTube link add, reference link add
- 2 new DB tables needed: `coll_destination_youtube_link`, `coll_destination_reference_link` (SQL in notes/)
- 2 new Django models: `CollDestinationYoutubeLink`, `CollDestinationReferenceLink`
- Destination edit: `/bangladesh/travel/add/?edit=<id>` with pre-population + update API
- Cancel button on edit page
- Breadcrumb navigation on detail page
- Quill.js rich text editor on short description + description fields
- HTML sanitization on save (`_sanitize_html()` in views_api.py)
- Paragraph rendering: strip block `<p>` tags, split by `\n`, render with `|safe` (preserves inline formatting)
- Card preview: `|striptags|truncatewords:25` (plain text only)
- YouTube: thumbnail + play button → opens in new tab (iframe embed removed due to restriction errors)
- CSP updated: `cdn.quilljs.com` added to script-src + style-src, `i.ytimg.com` already allowed
- Text sizes matched to news article styling (1.05rem body, 1.85 line-height)
- Textarea sizes increased: short desc rows=4, description rows=20

### Quill.js Rich Text Editor — Full Rollout
- **Beauty Hub upload**: description field (`bh-desc-bn`)
- **Newshub multistep (all 13 form types)**: summary (`news-summary-bn`) + body (`news-content-body-bn`) via shared `news-entry-form.html`
- **Newshub single-page form** (`news-collection.html`): same fields — was initially missed, then fixed
- **Travel Hub add/edit**: short description + description (done earlier)
- All use shared `quill-editor.js:initQuillEditor()` module
- Newshub init via `news-quill-init.js`, exposes `window.__quillNewsSummary` and `window.__quillNewsBody` for edit pre-population
- HTML sanitized on save: `_sanitize_rich_html()` in newshub/views.py, `_sanitize_html()` in bangladesh/views_api.py
- Article detail: body paragraphs render with `|safe` (inline formatting preserved)
- Quill CDN CSS + JS loaded in: `news-multistep-base.html`, `news-collection.html`, `beauty-hub-upload.html`, `travel-hub-add.html`
- CSP updated: `cdn.quilljs.com` in script-src + style-src

### Bangladesh — UI Polish
- Card hover: no jump (removed translateY), circle ✓ tick on top-right on hover (all 3 pages: landing, travel hub, beauty hub)
- No underline on hover: `main a { text-decoration: none }` on all 4 CSS files
- Colour picker added to Quill toolbar

## Bugs Fixed (2026-03-24)

1. `person.link_ref_status_gender_id` → `person.link_gender_id` (wrong field name, would crash)
2. `person.link_ref_status_religion_id` → `person.link_religion_id` (wrong field name)
3. `person.link_district_id` → `person.link_birth_district_id` (wrong field name)
4. DOM ID `contributor-name` → `contributor-full-name` (name wouldn't populate in edit mode)
5. Tag pre-population via checkboxes → `window.newshubTags.add()` chip API (wrong approach)
6. `from person.models import Person` → `from user_account.models import Person` (ImportError — also fixed in existing _actor_sidenotes)
7. `from media.models import SocialUrlLibrary` → `from multimedia.models import SocialUrlLibrary` (ImportError)
8. YouTube thumbnail CSP: `img.youtube.com` → `i.ytimg.com` (blocked by CSP)
9. Travel hub edit button: `href="#"` → actual edit URL with `?edit=<id>`
10. Status change API: only staff → now owner/staff/admin

## Documents Updated

- `newshub/field_mapping/db-mapping-article-view.txt` — edit pre-population, form type badge, status widget
- `newshub/field_mapping/db-mapping-common-steps.txt` — EDIT MODE section added
- `bangladesh/field_mapping/db-mapping-travel-hub.txt` — NEW: full travel hub documentation
- `notes/plan-edit-prepopulation.md` — edit pre-population architecture plan
- `notes/plan-rich-text-editor.md` — Quill.js integration plan
- `notes/travel-hub-community-tables.sql` — SQL DDL for 2 new tables
- `MEMORY.md` — updated Newshub App + added Bangladesh App section
- `feedback_no_popups.md` — NEW: no alert/confirm/prompt, always inline messages

### Case Standardisation — Project-Wide
- Removed ALL `.upper()` from Python: 10 in views.py, 2 in helpers.py
- Removed ALL `.toUpperCase()` from JS: 16 newshub + 3 poem + 11 tools = 30 total
- Lowercased 90+ UPPERCASE comparison constants in views.py
- Actor role codes: `'ACCUSED'`/`'VICTIM'`/`'WITNESS'` → `'accused'`/`'victim'`/`'witness'`
- `_FIELD_TO_ROLE` map: UPPERCASE → lowercase
- `_EXTORTION_LAW_BIT_TO_CODE`, `_EXTORTION_SUPPORT_BIT_TO_CODE`, `_EXTORTION_RETALIATION_BIT_TO_CODE`: UPPERCASE → lowercase
- Display-only uppercase (file extensions, language badges): CSS `text-transform: uppercase`
- **Zero `.upper()` / `.toUpperCase()` in entire project. No exceptions.**

### Descriptive Naming Rename (partial — in progress)
- `thd-` → `travel-hub-detail-` (CSS, HTML, JS) — done
- `th-` → `travel-hub-` (CSS, HTML, JS, add form) — done
- `bh-` → `beauty-hub-` (CSS, HTML, JS, upload form) — done
- `bd-` → `bangladesh-` (CSS, HTML) — done
- Remaining: article-detail short names, Python variables

## Additional Bug Fixes (late session)

11. Nav menu operator precedence: `or` without namespace check → any app's `article_detail` would highlight সংবাদ nav
12. `_sanitize_rich_html`: orphaned closing tags not removed → added catch-all regex for dangerous tag fragments
13. Quill internal tooltip `<input>` missing id+name → assigned in quill-editor.js init
14. Edit mode stepper starts at step 1 → added `__EDIT_MODE__` check to skip to step 2
15. localStorage draft overriding edit data → clear `newshub_draft` + `newshub_draft_tags` on edit load
16. Silent error swallowing in edit mode (`except: pass`) → now shows inline error message + logs traceback

## Pending

- User needs to run `notes/travel-hub-community-tables.sql` in SQL Server
- Edit pre-population Phase 2: extend to all 13 newshub form types (currently extortion only)
- Quill.js for poem create/edit forms (not yet requested)
- Service worker cache at v60

**Why:** Record of all work for continuity across sessions.
**How to apply:** Check this log when resuming work on edit pre-population or travel hub features.
