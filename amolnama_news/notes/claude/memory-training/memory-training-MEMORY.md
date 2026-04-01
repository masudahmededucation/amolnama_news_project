# Project Memory

## Troubleshooting Reference
See [troubleshooting.md](troubleshooting.md) for recurring problems and their fixes.
Key issues documented: Tom Select tiny cursor, Tom Select setValue pattern, CSS :root hijacking, radio-vs-select space issue, pyodbc ntext/UTF-8 collation fix, Flatpickr date label timing fix, edit pre-population blank form.

## Architecture
- Django project: `amolnama_news` with apps under `site_apps/` (core, evaluation_vote, election_vote, user_account, etc.)
- CSS architecture: `colors.css` is the single source of truth for `:root` variables. No other file should redefine `:root`.
- Static files: whitenoise with `CompressedManifestStaticFilesStorage` in production, `StaticFilesStorage` in dev.
- Custom User model (email-based, no username) in `user_account` app. `first_name`/`last_name` removed from User — names live in `[person].[person]` only.
- Names stored in `Person`: `first_name_en`, `last_name_en`, `first_name_bn`, `last_name_bn`. Alias field: `name_alias_en`, `name_alias_bn` (DB column was renamed from `nick_name_*` to `name_alias_*`). Parent names: `father_first_name_bn`, `father_last_name_bn`, `mother_first_name_bn`, `mother_last_name_bn`.
- `user_display_name` context processor injects display name from `UserProfile.display_name`.
- Settings chain: `local.py` → `dev.py` → `base.py`

## Key Lessons
- **CSS variable hijacking**: App-specific CSS files (e.g., evaluation_vote) had their own `:root` blocks that overwrote global `--primary`. Always check for duplicate `:root` definitions across all apps when colors misbehave.
- **Static file caching**: `collectstatic --clear` + browser cache clear needed after CSS changes. Dev server restart required after settings changes. Browser cache (Ctrl+Shift+Delete) is separate from server cache.
- **Global `a` color rule**: Changed from `a { color: var(--accent) }` to `a { color: inherit }` + `main a { color: var(--accent) }` to prevent blue bleed into header/nav/ticker.
- **Run `collectstatic --noinput`** after any static file edit if user reports stale CSS.
- **Django `null=True` sends explicit NULL**: On unmanaged models, `null=True` makes Django send NULL in INSERT, overriding SQL Server DB defaults (e.g., `GETDATE()`). For timestamp fields with DB defaults, use `default=timezone.now` without `null=True`.
- **Wrap signup in `transaction.atomic()`**: User + Person + Profile creation must be atomic to prevent orphan records on partial failure.
- **SQL Server NOT NULL columns**: Always check all NOT NULL columns before `Person.objects.create()`. Fields like `first_name_en` and `modified_at` are NOT NULL — must provide values or set Django `default`.
- **normalize_phone regex bug**: `^(\+\d{1,4})0+` backtracks and treats `+88` as country code + `0` as leading zero, corrupting `+8801...` → `+881...`. Fixed by removing the regex — forms already strip leading zeros via `lstrip("0")` before concatenation.
- **Phone storage**: `contact.phone` stores `country_calling_code` (e.g. `+880`) and `phone_number` (e.g. `1712345678`) separately. `account.user.phone` stores the full number (e.g. `+8801712345678`).
- **Non-mandatory TEXT columns → NULL not empty**: When saving forms, non-mandatory text columns must use `or None` so they store NULL instead of `""`. Empty strings break `IS NULL` queries. Mandatory text columns stay as-is (validation catches empty).
- **NEVER invent default values**: Don't add `default=...` to Django model fields. DB has its own defaults. Don't add `null=True` to model fields casually. Don't remove explicit values from `create()` calls. Always ask the user before making any schema-related decisions.
- **Don't modify Django model definitions** without explicit user approval. Unmanaged models map to SQL Server — changes can break DB defaults or NOT NULL constraints.
- **SQL Server computed columns**: `editable=False` does NOT prevent Django ORM from including the field in INSERT/UPDATE — it only affects forms. The correct fix is to **remove the field from the Django model entirely** (leave a comment). Never define computed columns as model fields. Example: `hash_headline_check` on `coll_news_entry`.
- **"Separate CSS" = NEW class**: When user says "separate CSS block" or "different class", create a completely new class (e.g. `.widget-location`) — do NOT override a shared class (`.widget`) with ID selectors. Don't change font sizes unless explicitly asked. Change only the exact property requested (height, padding, etc.).
- **Bengali columns rule**: `_bn` columns are ONLY for display and storage. Never use `_bn` in `order_by()` — always use `_en`. Never use `_bn` alone in `filter()` for cascade operations. For **search** APIs, use BOTH `_en` and `_bn` (`Q(_en__icontains=q) | Q(_bn__icontains=q)`) so users can type in either language. Cascade option text must include both Bengali and English (`name_bn (name_en)`) so Tom Select client-side search works for both.
- **pyodbc ntext/UTF-8 collation**: ODBC Driver 17 sends long strings as `SQL_WLONGVARCHAR` (→ `ntext`), which breaks UTF-8/`_SC` collations. Fixed with custom DB backend (`amolnama_news.db_backend`) that forces `SQL_WVARCHAR` via `setinputsizes()`. Use `TextField` normally in models — the backend handles it. See troubleshooting.md §5.
- **Custom DB backend**: `ENGINE` is `"amolnama_news.db_backend"` (not `"mssql"`) in both `base.py` and `local.py` settings. This extends the `mssql` backend with the ntext fix.
- **Tom Select `searchField` guideline**: Prefer English name fields (e.g. `name_en`, `status_name_en`) for Tom Select `searchField`. Use Bengali (`_bn`) only when English is not available. Bengali Unicode client-side matching in Tom Select is unreliable. This is a preference/clue, not a hard rule.
- **Case standardisation**: ALL status_code / code comparisons use lowercase. Zero `.upper()` in Python, zero `.toUpperCase()` in JS across entire project. Display-only uppercase uses CSS `text-transform: uppercase`. No exceptions.

## Newshub App
- 23 models mapped to `[newshub].*` + `[account].*` SQL Server tables (all `managed=False`). `ref_news_tag` removed — use `ref_news_category_tag` exclusively.
- **Article view**: Two-column sidenote layout at `/newshub/article/<slug>/`. Form type badge (চাঁদাবাজি etc.) shown in meta bar.
- **Edit pre-population**: `/newshub/news-collection/multistep/extortion/?edit=<id>`. `helpers.py:build_edit_data()` reconstructs all form data from DB. `news-form-edit-load.js` sets hidden inputs before component scripts init. Phase 1: extortion only.
- **Status widget**: Badge + pencil edit toggle → dropdown. Owner/admin can change. Inline messages, no popups.
- **Person model import**: `from user_account.models import Person` (NOT `person.models`).
- **SocialUrlLibrary import**: `from multimedia.models import SocialUrlLibrary` (NOT `media.models`).

## SEO & URL Structure
- See [project_seo_url_migration.md](project_seo_url_migration.md) — major URL prefix migration (2026-03-25). `/poem/` → `/bangla-kobita-gaan/`, `/bangladesh/` → `/bangladesh-tourist-destinations/`, `/marriage/` → `/bangladesh-marriage-registration/`. Bengali slugs, JSON-LD schemas, sitemaps, 301 redirects.
- **Newshub articles blocked** in robots.txt (anti-copy protection). All other apps are SEO-indexed.
- **SEO template tags**: `seo_meta_tags` and `seo_json_ld` in `seo/templatetags/seo_tags.py`. Views pass `seo` dict with: title, description, og_image, og_type, canonical, json_ld, breadcrumbs.
- **Community contributions**: Photos, YouTube links, reference links — edit/delete by contribution owner + destination owner + staff/admin.

## Bangladesh App
- Travel Hub: listing, add/edit, detail pages with community contributions (photos, YouTube, reference links).
- Beauty Hub: photo/video gallery with categories and filters.
- **URL prefix**: `/bangladesh-tourist-destinations/` (was `/bangladesh/`). 301 redirect from old URL.
- **Quill.js rich text editor**: Applied to travel hub short desc + description. CDN `cdn.quilljs.com`. CSP updated in `core/base.html`. Reusable via `quill-editor.js:initQuillEditor()`.
- **HTML sanitization**: `_sanitize_html()` in `views_api.py` strips dangerous tags on save. Templates use `|safe` for rendering.
- **Description rendering**: Strip block `<p>` tags, split by `\n`, render each as `<p>` with `|safe` (preserves inline formatting). Card previews use `|striptags|truncatewords:25`.
- **YouTube**: Thumbnail + play button → opens in new tab (no iframe embed due to restriction errors).
- **Card hover**: No jump. Circle ✓ tick on top-right. All 3 pages (landing, travel hub, beauty hub).
- **No underline**: `main a { text-decoration: none }` on all 4 CSS files.
- **New tables needed**: `coll_destination_youtube_link`, `coll_destination_reference_link` (SQL in `notes/travel-hub-community-tables.sql`).
- **Field mapping**: `bangladesh/field_mapping/db-mapping-travel-hub.txt`
- Data flow: References → Collection → Editorial → Publishing → Engagement → Monetization
- See [newshub-dataflow.md](newshub-dataflow.md) for full phase breakdown
- **Tom Select on dropdowns**: District and category selects are wrapped by Tom Select. Setting `.value` on native `<select>` won't update the UI — must use `element.tomselect.setValue(value, true)` then dispatch native `change` event for cascade.
- **Nominatim address fields (Bangladesh)**: `state_district` = district (জেলা), `county` = upazila (উপজেলা) for rural or city corporation (মহানগর) for urban. Use `extractNameBefore(text, keyword)` — take text before the keyword, not regex replace — to handle parenthesized extras like "শিবগঞ্জ উপজেলা (বগুড়া)".
- **No geo fallback for district matching**: Coordinate-based nearest-district matching was unreliable (wrong matches). Text matching via `state_district` + display_name parsing is sufficient.
- **Map search Enter key**: Search input is inside `<form>` — must `preventDefault()` on Enter to avoid form submission.

## User Preferences
- **Auto-accept**: User approved auto-accept mode — proceed with code changes without asking for confirmation.
- **Field mapping goes in text files**: Every field-to-DB mapping must be written into the appropriate file in `site_apps/newshub/field_mapping/`. One file per form. Common steps go in `db-mapping-common-steps.txt`. Do NOT keep mapping knowledge only in session memory.
- **Always use Bash tool description**: When running commands, always fill in the `description` parameter.
- **Reference files with filename and line/function**: When discussing code, cite the filename and relevant function names.
- **Split features into separate files**: Don't bundle multiple features into one monolithic JS/CSS file. Each distinct feature should be its own file (e.g., `news-auto-tag.js` separate from `news-category-tag-cascade.js`).
- **Descriptive naming convention**: Functions/variables must immediately tell you which table and what action. Pattern: `api_{table_name}_{action}` (e.g., `api_news_category_tags_search` not `api_tags_search`). No abbreviations like "fts" or "fulltext" — just the table name + action.
- **File naming for splits**: Use prefix grouping so related files sort together: `views.py`, `views_api.py` (not `api_views.py`). Same pattern for future splits.
- **Modularise large files**: Split when a file grows too big. `views.py` = page views + form handling; `views_api.py` = all JSON API endpoints.

## Feedback
- See [feedback_stop_arguing.md](feedback_stop_arguing.md) — STOP arguing. When user reports an issue, FIX IT immediately. No "false alarm", no "third-party", no "not real". Every warning the user reports is valid and fixable. ZERO warnings is the standard.
- See [feedback_read_clue_first.md](feedback_read_clue_first.md) — HARD RULE: When user gives a clue or says "follow X", STOP and READ that code FIRST before responding or coding. No exceptions. If user asks "did you read it?" = rule violated.
- See [feedback_follow_working_example.md](feedback_follow_working_example.md) — Before writing ANY code, find existing working example. Copy that pattern. Never build complex workarounds when simple proven pattern exists.
- See [feedback_empty_string_vs_null.md](feedback_empty_string_vs_null.md) — NEVER use empty string "" for non-mandatory fields. Always use NULL/None. Empty strings break IS NULL queries.
- See [feedback_no_half_done.md](feedback_no_half_done.md) — NEVER do half-done work and ask user to test. Complete ALL fixes, verify ALL forms, check ALL related code, bump cache, THEN report done. User is NOT a QA tester.
- See [feedback_service_worker_cache.md](feedback_service_worker_cache.md) — PWA service worker caches /static/ files. After ANY JS/CSS change, bump CACHE_NAME in seo/views.py. NEVER blame "browser cache" — check service worker first.
- See [feedback_check_all_forms.md](feedback_check_all_forms.md) — When fixing a bug, ALWAYS check ALL forms/models/JS across the ENTIRE project for the same pattern. Never fix just one place.
- See [feedback_no_lying.md](feedback_no_lying.md) — NEVER say "done" or "fixed" without full verification. Stop assuming changes work. Be honest about what's verified and what's not.
- See [feedback_global_file_safety.md](feedback_global_file_safety.md) — NEVER change global files (news-form-lang.js, base.css, db_backend) without verifying impact on ALL 13+ forms. Use most specific selectors. No broad query changes. No !important on display.
- See [feedback_implement_immediately.md](feedback_implement_immediately.md) — when user says "everywhere", implement fully across ALL forms in one session. No partial changes spread across conversations.
- See [feedback_universal_modularisation.md](feedback_universal_modularisation.md) — when modularising, apply universally across ALL rendering paths. No partial implementations. All paths must produce identical structure (only CSS classes differ).
- See [feedback_seo_auto.md](feedback_seo_auto.md) — auto-apply SEO (seo context, sitemap, robots, llms.txt) when creating new apps/pages.
- See [feedback_high_performance_ux.md](feedback_high_performance_ux.md) — benchmark professional apps, use Web Workers/async, progressive rendering, zero-lag UX for all new features.
- See [feedback_never_blame_cache.md](feedback_never_blame_cache.md) — NEVER blame cache. Investigate actual code first. Cache was wrongly blamed for 2 weeks on a 5-minute fix.
- See [feedback_form_element_rules.md](feedback_form_element_rules.md) — Every form element (static or dynamic JS) must have id + name. Labels must have for= or wrap input. Group labels use span. Check ALL files including JS createElement.
- See [feedback_no_popups.md](feedback_no_popups.md) — NEVER use alert()/confirm()/prompt(). Always use inline warning/success messages.
- See [feedback_no_silent_errors.md](feedback_no_silent_errors.md) — NEVER swallow errors silently (except: pass). Always show inline error message + log traceback.
- See [feedback_descriptive_naming.md](feedback_descriptive_naming.md) — ALL names must be fully descriptive. No abbreviations like `thd`, `bh`, `c`, `desc`, `btn`. Use full words.
- See [feedback_no_case_conversion.md](feedback_no_case_conversion.md) — NEVER use .upper()/.toUpperCase() anywhere. All data lowercase. Display uppercase via CSS `text-transform: uppercase`. Zero exceptions.

## Session Logs
- See [project_session_2026_03_25.md](project_session_2026_03_25.md) — community contribution edit/delete, SEO infrastructure, URL migration (bangla-kobita-gaan, bangladesh-tourist-destinations, bangladesh-marriage-registration), Bengali slugs, 8 bugs fixed.
- See [project_session_2026_03_24.md](project_session_2026_03_24.md) — features built, 10 bugs fixed, documents updated. Edit pre-population, travel hub community features, Quill editor, UI polish.

## Bengali Input System
- See [project_bangla_input_architecture.md](project_bangla_input_architecture.md) — BanglaInput (regular fields) + QuillAvro (Quill editors). Language toggle controls both. CSP requires external JS files, not inline scripts. Filenames must NOT contain "bangla-input".

## Pending Tasks
- See [project_universal_language_toggle.md](project_universal_language_toggle.md) — universal BN/EN field separation across all apps. BanglaInput hook done, field visibility toggle pending.

## Future Production Tasks
- See [project_copy_protection_strategy.md](project_copy_protection_strategy.md) — copy attribution now, canvas rendering + JS obfuscation for production. Anti-scraping middleware needed.

## File Locations
- CSS variables: `core/static/core/assets/css/utilities/colors.css`
- Nav/ticker/breaking: `core/static/core/assets/css/components/navigation.css`
- Header/auth controls: `core/static/core/assets/css/layout/header.css`
- Base template: `core/templates/core/base.html`
- Auth templates: `user_account/templates/user_account/login.html`, `signup.html`
