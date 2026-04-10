# CLAUDE.md — Pre-flight rules (hard-enforced, every session)

**This is not advice. Every rule here is mandatory. Read this file at the start of every task. Re-read before any non-trivial change.**

The user has caught violations of these rules many times. They are codified here so I have no excuse.

The rules are ordered as a workflow: think → research → plan → design → style → name → modularise → write → verify. Walk the gates in order. Don't skip.

---

# 📜 GATE 0 — Follow ALL the rules

This is the master rule. Every other rule in this file is mandatory. There is no "advisory". There is no "later". Adding more rules to a list I don't read is not a fix — the fix is reading and applying THIS file at the start of every task.

- **Don't lie about following rules.** Don't say "modularised", "shared everywhere", "tested" without grep-verifying.
- **Don't argue when the user reports an issue.** ACT immediately. If told twice, you already failed once.
- **Don't defend, don't explain, don't blame the cache/browser/environment.** Verify server-side first.
- **Don't ask the user to be a QA tester.** If you can run it via Django shell, RUN IT before saying done.
- **Don't half-do work then ask user to test.** Complete ALL fixes, verify ALL related code, bump cache, THEN report done.
- **Don't say "later" or "next session"** for things the user said to do now.
- **Don't add new memory files when caught.** The rule already exists in this file. Re-read it.

---

# 🔬 GATE 1 — Deep research FIRST

For any non-trivial feature or refactor:

1. **What does the gold standard product do?** Twitter, YouTube, Reddit, Pinterest, Pocket, Notion, Instagram, GitHub. Look at their API shape, table design, URL pattern.
2. **Cross-cutting features (bookmarks, saves, follow, share, search, feed, notifications) → ALWAYS universal, ONE endpoint with type discriminator.** Never N per-content-type endpoints.
3. **Per-content-type features (likes, comments, views) → per-app is fine** (semantics differ).
4. **Compare with competitive sites.** Use professional/scalable practices, not hobbyist patterns.
5. **No shortcut/dangerous practice.** No layer-on-layer code. Redesign cleanly, never patch on top.
6. **Read the user's clues first.** If user gave a code reference, READ that code BEFORE responding or coding. No exceptions.

If your design has N parallel anything for ONE conceptual feature, you're wrong. Restart.

---

# 📋 GATE 2 — Plan before code

For any multi-file change:

1. **Write the plan as text BEFORE any Edit/Write call.**
2. **Use TodoWrite** for multi-step work. Mark complete as you go, not in batches.
3. **Read existing code** before proposing changes. Never "improve" code you haven't read.
4. **Small chunks.** Complete one fully before moving to the next.
5. **Step-by-step plan + TodoWrite** for any multi-file work. Never rely on memory alone.
6. **DB script first**: give SQL → wait for user to run → THEN change Python. Never code before DB is ready.
7. **Ask blanket permission once** for a scope of work. Never per-file individual prompts.

---

# 🏛 GATE 3 — Architecture / where does it live?

**Logical home before convenience.** Bookmarks belong in social, not post. Search what app a feature semantically belongs in.

```
amolnama_news/site_apps/
├── core/           — display-only utilities, shared components, base templates
├── newsengine/     — brain: classification, ranking, feed, graph, embeddings
├── user_account/   — User, UserProfile, Person + auth (light)
├── social/         — UserFollow/Block/List, public profile, bookmarks (cross-cutting user features)
├── post/           — wall posts CRUD only
├── art/            — blog_art schema
├── stories/        — blog_stories schema
├── poem/           — blog_poem schema
├── bangladesh/     — blog_bangladesh schema (travel hub)
├── newshub/        — news articles + form access control
├── debate/         — debate platform
├── messenger/      — DMs
├── pulse/          — live notifications
├── portal/         — user dashboard
└── seo/            — robots.txt, llms.txt, manifest.json, sw.js
```

**Rules:**
- **`core` = display only.** No engine/processing/background logic. Those go in `newsengine`.
- **`newsengine` = all brain logic.** Classification, ranking, graph, feed, embeddings, BookmarkContent, recommendations.
- **Never modify `newsengine`** without explicit user permission. Ask first.
- **Cross-cutting user features** (bookmarks, follow, lists) → `social`, not the per-content app.
- **Background tasks**: ALL background threading MUST use `newsengine/utils.py:run_background_task()`. No raw `threading.Thread`.
- **Settings chain**: `local.py` → `dev.py` → `base.py`.

---

# 🎨 GATE 4 — Styling / CSS / UI standards

1. **External CSS files only.** No internal `<style>` blocks unless absolutely required.
2. **No inline `style=""`** — extract to CSS class.
3. **Use global tokens** from `colors.css`. Never hardcoded colors.
4. **`colors.css` is the single source of truth for `:root`.** No other file redefines `:root`.
5. **`hidden` HTML attribute**, not `display: none` CSS class. `.hidden = true/false` in JS. `:not([hidden])` in CSS.
6. **Mobile-first.** Touch targets ≥44px. Test 320px width. Responsive for all devices.
7. **`prefers-reduced-motion`** respected — disable transitions for users who set it.
8. **No layout thrashing.** Pre-position promo cards server-side.
9. **Skeleton screens** during load. Show UI immediately, fetch data in background.
10. **Virtual scrolling** + DOM cleanup for long feeds.
11. **Speculation rules** for SPA navigation. `defer` scripts, preload critical assets, `fetchpriority` on hero images.
12. **No hover underline.** `main a { text-decoration: none }` on all app CSS files. Cards, links, everything.
13. **Cards: no jump on hover.** Subtle transitions only.
14. **Bookmarks page = list rows, not boxes.** Borderless cards separated by hairline `border-bottom`. Like Twitter/Threads/Instagram saved.
15. **Polished, gen-z proof, full of life, professional, minimal.** No amateur look.
16. **Service worker cache version** = `seo/views.py:CACHE_NAME`. Bump after every JS/CSS change. Run `collectstatic --noinput`.
17. **Never blame "browser cache"** — check what server is actually serving (`curl` it).

---

# 🏷 GATE 5 — Naming conventions

### Functions / variables
- **Fully descriptive.** Pattern: `api_{table_name}_{action}` (e.g. `api_news_category_tags_search`, not `api_tags_search`).
- **No abbreviations**: no `thd`, `bh`, `c`, `desc`, `btn`, `fts`. Use full descriptive words.
- **No shortened DB column names** in variables. Full column name: `coll_news_entry_id`, not `entry_id`.

### Files
- **Prefix grouping** so related files sort together: `views.py`, `views_api.py` (NOT `api_views.py`).
- **Same pattern for all splits.**

### CSS classes
- `.app-component-element` pattern. No generic names that could collide.

### DB columns
- **`link_` prefix on every FK column.**
- **Entity prefix on grouped columns**: `blog_art_coll_artwork_id`, not `artwork_id`.
- **`_bn` / `_en` suffix only for display labels** needing both languages.
- **Single column (UTF-8)** for content/descriptions/extracted text/system values. No `_bn` suffix without a corresponding `_en`.
- **All status_code / code values lowercase.** Display uppercase via CSS `text-transform`.

### Form elements
- **Every form element** (static or JS-created) needs `id` + `name`.
- **Labels** need `for=` or wrap input. Group labels use `<span>`.

---

# 📦 GATE 6 — Modularise EVERYTHING

### Search existing FIRST
1. **Grep for the concept** before writing anything new (function name, table name, model, helper, template tag, API path).
2. If something similar exists → **MODIFY IT, never create a parallel new thing.**
3. **Re-use beats refactor. Refactor beats rewrite. Rewrite beats new file.**
4. **Before writing `BOOKMARK_SOURCES = [...4 entries...]`, ask: "why 4? Could there be 1?"**

### Modularise even single-use
1. **Even if used in one place.** Atomic features get their own module/file.
2. **Write once, reuse everywhere.** Zero copy-paste.
3. **Split files when feature is atomic and independent.** Don't split inter-related/co-related logic.
4. **N parallel implementations dressed up as a config dict is NOT modularisation.** True modular = 1 source of truth.
5. **Never claim "shared/modular/used everywhere"** without grep-verifying it's actually used in every place.

### When user says
- **"Modularise"** = collapse to ONE source of truth, not config-dict the duplication.
- **"Fix everywhere"** = find every instance of the pattern across the entire project, fix all in one session.
- **"Implement everywhere"** = no partial. All forms, all pages, all paths, in one go.
- **"Why N?"** = stop and rethink the design. The answer is probably 1.

### Stable patterns to copy from
- **Universal bookmark**: `core/bookmarks.py` + `newsengine/views_api.py:api_bookmark_toggle`. ONE endpoint, 4 content types. Adding a 5th = one line in `CONTENT_TYPE_METADATA`.
- **Shared actions bar**: `core/templates/core/components/actions-bar.html` + `core/templatetags/blog_tags.py:blog_actions_bar` + `core/static/core/assets/js/components/actions-bar.js`. Used by all blog detail pages.
- **Background tasks**: `newsengine/utils.py:run_background_task()`.
- **Bengali slug**: `core/utils.py:bangla_slugify()`. NEVER Django's `slugify(allow_unicode=True)`.
- **User profile id**: `core/utils.py:get_user_profile_id(request)`.

---

# 🗄 GATE 7 — DB rules (schema first)

1. **DB script first.** Give SQL to user → wait for them to run it → THEN change Python code.
2. **BIGINT** for growing tables. **INT** only for static ref FKs.
3. **NVARCHAR** always, never VARCHAR.
4. **`link_` prefix** on every FK column.
5. **Entity prefix** on grouped columns.
6. **Bengali columns** (`_bn`) ONLY for display + storage. **NEVER in `order_by()`**. Search uses BOTH `_en` and `_bn`.
7. **DB column standardisation** for engagement tables: `link_<entity>_id`, `link_user_profile_id`, `is_active`, `created_at`, `updated_at`. Nothing else.
8. **Asset/photo tables**: standard columns are `is_cover`, `is_active` (NOT `is_featured`).
9. **NFC normalize** both sides before comparing Bengali text. Strip chandrabindu/anusvara/visarga for fuzzy match.
10. **Custom DB backend** = `amolnama_news.db_backend` is a clean passthrough. **NEVER add setencoding/setdecoding/setinputsizes/AutoTranslate** — this corrupts ALL Bengali to `????`.
11. **For raw SQL with long Bengali text**, use `CAST(%s AS NVARCHAR(MAX))` to avoid `ntext`/`_SC` collation issues.
12. **Unmanaged models with `DateTimeField()` (no default)**: Django passes NULL even if SQL Server has a default. Either set `default=timezone.now` on the model OR explicitly pass `created_at=timezone.now()` in `.create()`. **Always test new create APIs via Django shell.**
13. **Never modify Django model definitions** without explicit user approval.
14. **Never empty string `""` for non-mandatory fields.** Always `None` / `NULL`. Empty strings break `IS NULL` queries.
15. **Mandatory text fields** stay as-is (validation catches empty).
16. **Wrap signup in `transaction.atomic()`** to prevent orphan records on partial failure.

---

# 📝 GATE 8 — Forms

1. **Every form element needs `id` + `name`** (static or dynamically created via JS).
2. **Labels** need `for=` or wrap input. Group labels use `<span>`.
3. **Tom Select**: prefer English `_en` fields for `searchField` (Bengali Unicode client-side matching is unreliable).
4. **Tom Select on cascading dropdowns**: must use `element.tomselect.setValue(value, true)` then dispatch native `change` event for cascade.
5. **Edit pre-population**: hidden inputs MUST be set BEFORE component scripts init.
6. **Field mapping** goes in `site_apps/newshub/field_mapping/` text files. One file per form. Common steps in `db-mapping-common-steps.txt`.
7. **No `alert()` / `confirm()` / `prompt()`.** Inline messages only.
8. **No popup confirms for delete actions.** Inline confirmation bar.

---

# ⚡ GATE 9 — Performance / SEO / Security

### Performance
1. **Show UI immediately**, load data in background. Never block user interaction with network requests.
2. **Proactive prefetch** during scroll dwell time (replies, profiles, related data).
3. **`defer` scripts**, preload critical assets, `fetchpriority` on hero images.
4. **Web Workers** for heavy compute. Async/progressive rendering. Zero-lag UX.
5. **Benchmark professional apps** for any new feature.

### SEO
1. **Every page passes `seo` context** with: `title`, `description`, `og_image`, `og_type`, `canonical`, `json_ld`, `breadcrumbs`.
2. **JSON-LD** for article/creativework/product schemas where applicable.
3. **Sitemap entry** for every public-indexed URL.
4. **robots.txt** updated for new disallowed sections.
5. **llms.txt** updated for new public sections.
6. **301 redirects** when URLs move. Never break old links.
7. **Newshub articles**: blocked in robots.txt for anti-copy protection.
8. **Auto-apply SEO** when creating new apps/pages.

### Security
1. **No SQL injection** — ORM only, parameterised queries for raw SQL.
2. **No XSS** — Django autoescape on, `|escapejs` for JS string literals, `|striptags` before truncation.
3. **CSP** headers respected.
4. **CSRF** on every POST.
5. **HTML sanitization** on rich text inputs (`_sanitize_html()` strips dangerous tags).

---

# 🐛 GATE 10 — Check for bugs (after every coding session)

Run through this 20-point scan after every change:

- **`alert()` / `confirm()` / `prompt()`** — banned anywhere
- **`console.log` / `console.debug`** — banned anywhere (only `console.error` inside `.catch()`)
- **Missing `.catch()` on `fetch()`** — fix
- **Duplicate event listeners** — consolidate
- **SQL injection risk** — review raw SQL
- **XSS via `|safe` on user input** — review
- **Dead code** — delete
- **Empty string `""` for non-mandatory fields** — fix to NULL
- **`.upper()` / `.toUpperCase()`** — remove (banned everywhere)
- **Internal `<style>` blocks** — extract to CSS file
- **Inline `style=""`** — extract to CSS class
- **Missing `id`/`name` on form elements** — add
- **`_bn` field used in `order_by()`** — switch to `_en`
- **`is_active=True` filter missing on engagement queries** — add
- **Stale cached counts** (`coll_*.bookmark_count`, etc) — remove writes, compute live
- **`!important` on display** — refactor
- **Broad query selectors** — make specific
- **Global file changes without verification** — audit impact
- **Silent error swallowing** (except `pass`) — add inline message + log
- **Missing CSP-allowed sources** for external scripts/fonts/tiles — add

---

# ✅ GATE 11 — Verify before saying "done"

1. **Run new create/insert APIs via Django shell** to confirm DB write works. Cleanup test row.
2. **Run the actual view function** via RequestFactory to see real rendered output. Don't ask user to click buttons to discover errors you could find in 10 seconds.
3. **Grep-verify modularisation claims.** "Used everywhere" must be true in every file.
4. **Bump cache version** in `seo/views.py` after any JS/CSS/static change. Run `collectstatic --noinput`.
5. **Check ALL forms across the project** when fixing a bug — never fix just one place.
6. **Check ALL data entry paths** when fixing one. Every model with the same pattern likely has the same bug.
7. **Test in browser only AFTER server-side verification passes.**
8. **Be honest** about what's verified vs assumed. Never say "it should work".

---

# 🚫 NEVER (universal)

- **Never lie** about completion
- **Never make user a QA tester** for things you can verify yourself
- **Never blame cache** without checking served files
- **Never blame browser/env** without server-side check
- **Never say "later"** for now-tasks
- **Never half-do work** and ask for testing
- **Never use `alert()` / `confirm()` / `prompt()`**
- **Never use `console.log` / `console.debug`**
- **Never `.upper()` / `.toUpperCase()`** anywhere
- **Never modify Django model definitions** without explicit user approval
- **Never modify `db_backend`** — it's a clean passthrough, period
- **Never modify `newsengine`** without explicit user permission
- **Never put processing logic in `core`** — core is display only
- **Never raw `threading.Thread`** — use `run_background_task()`
- **Never empty string `""`** for non-mandatory fields
- **Never `--no-verify`, `--amend`, `--force`** unless user explicitly asks
- **Never silent error swallowing** (except `pass`)
- **Never global file changes** without verifying impact on ALL forms
- **Never broad query selectors** — most specific only
- **Never `!important` on display**
- **Never abbreviations** in names
- **Never shortened DB column names** in variables
- **Never internal CSS** unless absolutely necessary
- **Never popup confirms** — inline confirmation bar
- **Never destructive git** without explicit user request
- **Never argue** with user reports — ACT immediately
- **Never patch on top** — find root cause, redesign cleanly
- **Never partial implementation** spread across sessions

---

# 💬 Communication style

- **Terse, direct, no preamble.** Lead with the answer.
- **No filler.** Don't restate what the user said.
- **No trailing summaries** ("I just did X, Y, Z") unless the user asked for status.
- **One sentence is better than three.**
- **File references**: `[filename:lineno](path#L<n>)` markdown links.
- **GitHub issues/PRs**: `owner/repo#123` format.
- **Bengali**: NFC-normalized everywhere.
- **Honesty**: be explicit about what's verified vs assumed.

---

# 🎯 When user reports an issue

1. **Don't defend, don't explain, don't suggest refresh, don't blame the environment.**
2. **Verify the issue server-side first** — does the data exist in DB? does the API actually fire? does the URL resolve? does the JS handler exist in the served file?
3. **Find the root cause**, not a symptom layer.
4. **Fix it cleanly**, not by adding a workaround.
5. **Test the fix yourself** before claiming done.
6. **If told twice, you already failed once.**

---

# 📁 Project-specific quick reference

### Stable architecture
- **Universal bookmark API**: `POST /newsengine/api/bookmark/toggle/` with `{content_type_code, content_id, content_title, content_url}`. ONE endpoint for all 4+ content types.
- **Bookmarks page**: `/social/bookmarks/` (NOT `/post/bookmarks/` — that has 301 redirect)
- **Service worker cache**: `seo/views.py:service_worker_js` → `CACHE_NAME` (bump after every JS/CSS change)
- **Sidebar nav**: `core/templates/core/partials/sidebar-navigation.html`

### Custom User model
- Email-based, no username
- Names live in `[person].[person]` only (not on User)
- `Person`: `first_name_en`, `last_name_en`, `first_name_bn`, `last_name_bn`, `name_alias_en`, `name_alias_bn`, parent name fields
- `user_display_name` context processor injects display name from `UserProfile.display_name`

### Content registry
- `[content].[content_registry]` — universal content ID for all blog + post content
- `[content].[ref_content_category]` — 10 content types
- `[content].[ref_content_subcategory]` — 85+ topics
- 18 FK constraints

### Phone storage
- `contact.phone`: `country_calling_code` + `phone_number` separately
- `account.user.phone`: full number (e.g. `+8801712345678`)

### Bookmark engagement schema (standard)
```
[newsengine].[bookmark_content]
  - newsengine_bookmark_content_id (BIGINT PK)
  - link_user_profile_id
  - bookmark_content_type_code  ('art', 'story', 'poem', 'destination', ...)
  - bookmark_content_id
  - bookmark_content_title (cached)
  - bookmark_content_url (cached)
  - is_active (default 1)
  - created_at (default sysdatetime())
```

### Memory system
Memory files at `C:\Users\mehfil\.claude\projects\d--GoogleDrive-personal-folder-Apps-amolnama-news-amolnama-news-project\memory\` are session-history and context, NOT rules. The rules are in THIS file (CLAUDE.md), which is auto-loaded every session. Memory files document past decisions, project state, incidents, troubleshooting — useful for context but not for enforcement.

When the user says "remember this" → memory file. When the user says "follow this rule" → CLAUDE.md.

---

# 🧠 If you violated a rule

1. **Acknowledge it explicitly.** Don't downplay.
2. **Don't promise to do better.** Just fix it now.
3. **Don't add a new memory file** unless the rule didn't already exist. Adding rules to a list you don't read isn't a fix.
4. **The fix is reading and applying THIS file at the start of every task.** That's the only thing that works.
