# Troubleshooting — Recurring Problems & Solutions

## 1. Tom Select — Tiny/Invisible Cursor in Search Input

### Symptom
Tom Select search box renders but the text cursor (caret) is invisible or a 1px sliver. Typing still works but the user can't see the cursor.

### Root Cause
Tom Select's CDN CSS does NOT set an explicit `height` on the inner `<input>` element inside `.ts-control`. In a flex container with `align-items: center`, if the input has no explicit height, some browsers collapse it to ~0px height. The cursor is technically there but invisible because the input box has no height.

This affects any Tom Select instance that is NOT inside one of the styled wrapper classes (`.widget-location`, `.widget-category`). Specifically:
- Multistep form search inputs (inside `<div class="form-field">` — no widget class)
- `#news-location-search` in `news-location-administrative-cascade.html` (inside `.widget-field`, not `.widget-location`)
- Any future Tom Select added in a new form that doesn't have a styled wrapper

### Fix
Add explicit `height: 1.5rem` (or `height: 1.5em`) to the `.ts-control > input` rule. Must be scoped to the form context.

**For multistep forms** — in `news-collection-multistep.css`:
```css
.news-multistep-form .ts-control > input {
  height: 1.5rem;
  line-height: 1.5;
  font-size: inherit;
  /* ... */
}
```

**For single-page form** — in `news-collection.css`:
```css
.widget-location .ts-control > input,
.widget-category .ts-control > input,
.widget-field .ts-control > input {
  height: 1.5rem;
  /* ... */
}
```

**Rule of thumb**: Any time a new Tom Select instance is added, check that its parent class (`.widget-*` or form class) has a `.ts-control > input { height: 1.5rem }` rule covering it. If not, add one.

### Files Changed (first fix: 2026-03-09)
- `news-collection-multistep.css` — added `.news-multistep-form .ts-control > input { height: 1.5rem }`
- `news-collection.css` — added `height: 1.5rem` to existing `.widget-location/.widget-category` input rule + extended to `.widget-field`

---

## 2. Tom Select on `<select>` — `.value = x` Doesn't Update UI

### Symptom
Setting `selectElement.value = 'some_id'` programmatically doesn't update the Tom Select displayed value.

### Root Cause
Tom Select replaces the native `<select>` with its own DOM. The native `.value` setter doesn't notify Tom Select's internal state.

### Fix
```javascript
// Wrong:
selectElement.value = id;

// Correct:
if (selectElement.tomselect) {
  selectElement.tomselect.setValue(id, true);  // true = silent (no onChange)
} else {
  selectElement.value = id;
}
selectElement.dispatchEvent(new Event('change'));
```

---

## 3. CSS `:root` Variable Hijacking by App CSS Files

### Symptom
Global CSS color variable (e.g. `--primary`) changes unexpectedly on certain pages.

### Root Cause
App-specific CSS files redefined `:root` variables, overwriting the global values from `colors.css`.

### Fix
Never define `:root` variables in app-level CSS. All `:root` variables live exclusively in `core/static/core/assets/css/utilities/colors.css`. If app needs a value, use a local variable or override on a specific selector (`.my-widget { --primary: ... }`).

---

## 4. Radio Button Groups Taking Too Much Space

### Symptom
Radio pill groups (gender, religion, status) are too wide and look cramped.

### Fix
Switch to `<select>` dropdown instead. Use `form-row-half` to put two selects side by side (e.g. gender + religion).
Pattern used in July martyr form (Step 4) and WCV victim form (Step 4).

---

## 5. pyodbc ntext/UTF-8 Collation Conflict on SQL Server

### Symptom
`ProgrammingError: Cannot convert to text/ntext or collate to 'Latin1_General_100_CI_AS_SC_UTF8' because these legacy LOB types do not support UTF-8 or UTF-16 encodings.`

Happens on INSERT or UPDATE of any `NVARCHAR(MAX)` column that uses a UTF-8 or `_SC` collation (e.g. `Latin1_General_100_CI_AS_SC_UTF8`, `Bengali_100_CI_AS`). Typically triggered by `TextField` fields in Django models mapped to SQL Server.

### Root Cause
ODBC Driver 17 for SQL Server + pyodbc decides the SQL type for each parameter based on the Python value:
- Short strings → `SQL_WVARCHAR` → SQL Server maps to `nvarchar` ✓
- Long strings (typically >4000 chars, but threshold varies) → `SQL_WLONGVARCHAR` → SQL Server maps to `ntext` (legacy LOB type) ✗

The `ntext` legacy type does NOT support UTF-8 or `_SC` collations. This is a pyodbc/ODBC driver behavior — Django's `TextField` mapping to `nvarchar(max)` in the `mssql` backend's `data_types` dict is correct for DDL, but has no effect on parameter binding.

**What does NOT fix it:**
- Changing `TextField` to `CharField(max_length=N)` — pyodbc still decides based on actual string length, and `max_length > 4000` is invalid for NVARCHAR anyway
- `extra_params: "LongAsMax=Yes"` — not a valid ODBC Driver 17 keyword
- Clearing `__pycache__` — may temporarily help if stale `.pyc` was the issue, but doesn't fix the underlying problem

### Fix
Custom database backend wrapper at `amolnama_news/db_backend/base.py` that extends the `mssql` backend's `CursorWrapper`. Overrides `execute()` to call `cursor.setinputsizes()` right before the raw pyodbc `cursor.execute()`, forcing ALL string parameters to `SQL_WVARCHAR` (→ `nvarchar`) instead of letting pyodbc auto-promote to `SQL_WLONGVARCHAR` (→ `ntext`).

Key implementation details:
- `setinputsizes` must be called AFTER `format_params()` (which transforms booleans, etc.) but BEFORE the raw `cursor.execute()`
- Force ALL string params to `SQL_WVARCHAR`, not just long ones — the threshold is unpredictable
- Size tuple format: `(pyodbc.SQL_WVARCHAR, max(len(p), 1), 0)` for strings, `0` for non-strings

Settings change: `ENGINE` in `DATABASES` switched from `"mssql"` to `"amolnama_news.db_backend"`.

### Files
- `amolnama_news/db_backend/__init__.py` — empty package init
- `amolnama_news/db_backend/base.py` — custom `CursorWrapper` + `DatabaseWrapper`
- `amolnama_news/settings/base.py` — `ENGINE: "amolnama_news.db_backend"`
- `amolnama_news/settings/local.py` — `ENGINE: "amolnama_news.db_backend"`

---

## 6. Flatpickr Date Labels — "label for= doesn't match any element id"

### Symptom
Browser audit warns: `Incorrect use of <label for=FORM_ELEMENT>` on date input labels. The `for` attribute doesn't match any element id.

### Root Cause
Flatpickr replaces `<input type="date" id="X">` with:
- A **hidden** input (original, id stays `X` but type changes to `hidden`)
- A **visible** alt input (new, id set to `X-visible` by `news-date-picker.js`)

A `<label for="X">` pointed to the original input. After Flatpickr transforms it, `for="X"` points to a hidden input. The `news-date-picker.js` onReady updates it to `for="X-visible"`, but the browser audit runs BEFORE Flatpickr initializes — catching the brief moment when `for` points to nothing visible.

For **dynamically created** date inputs (repeater cards), the timing is worse — Flatpickr may not init until `newshubDatePicker.init()` is called after the card is appended.

### Fix
Do NOT use `<label for="...">` for date inputs. Instead:
- Use `<span class="form-field-label" id="X-label">` for the label text
- Add `aria-labelledby="X-label"` on the `<input type="date">`
- No timing dependency — `aria-labelledby` points to the span (always exists)

**In HTML templates:**
```html
<span class="form-field-label" id="my-date-label"
      data-bn="তারিখ" data-en="Date">তারিখ (Date)</span>
<input type="date" id="my-date" name="my_date" aria-labelledby="my-date-label">
```

**In JS (dynamic elements)** — `news-person-identity.js` `makeDomFormField()`:
```javascript
var isDate = inputEl.type === 'date';
var label = document.createElement(isDate ? 'span' : 'label');
if (isDate) {
  label.className = 'form-field-label';
  label.id = inputEl.id + '-label';
  inputEl.setAttribute('aria-labelledby', inputEl.id + '-label');
} else {
  label.setAttribute('for', inputEl.id);
}
```

### Important
- `news-date-picker.js` onReady still sets `for` on labels found by `id="X-label"` — this is a fallback for any labels that still use the old pattern
- Repeater cards (accused, victim, witness) must call `window.newshubDatePicker.init()` after appending a new card to initialize Flatpickr on the new date input

### Files Changed
- `person-personal-info-fields.html` — DOB label → span
- `wcv-victim-form.html` — marriage date label → span
- `entertainment-cast-release-form.html` — release date → span
- `sports-match-event-form.html` — match date → span
- 7 watchdog form templates — all date labels → span
- `news-person-identity.js` — `makeDomFormField()` uses span for date inputs
- `news-wcv-accused.js` — calls `newshubDatePicker.init()` after addCard()
- `news-date-picker.js` — onReady finds labels by both `for` and `id` pattern

---

## 7. Edit Pre-Population — Fields Empty / Blank Form

### Symptom
Edit button on article → opens multistep form with `?edit=<id>` → form shows form type selected but content fields empty.

### Root Causes
1. **localStorage draft override**: `news-form-persist.js` may restore stale empty draft over edit data
2. **Permission check failing silently**: User not owner/staff → `edit_data_json` never set → blank form
3. **Service worker caching old JS**: Stale `news-form-edit-load.js` without `localStorage.removeItem`
4. **Quill init timing**: Quill reads empty textarea before edit-load sets the value

### Fix
- `news-form-edit-load.js` clears `localStorage.removeItem('newshub_draft')` + `newshub_draft_tags`
- `window.__EDIT_MODE__ = true` before any field population
- Deferred phase calls `window.__quillNewsSummary.setContent()` after window.load
- Always bump service worker cache after JS changes

See [troubleshooting_edit_prepopulation.md](troubleshooting_edit_prepopulation.md) for full details.

---

## 8. Edit Mode — Stepper Shows Step 1 (Form Type Picker) Instead of Content

### Symptom
Clicking edit on article view opens the correct URL (`?edit=29`) but shows step 1 (form type picker) with the type selected. User has to manually click Next to reach the content.

### Root Cause
`news-form-stepper.js` always starts at step 1 (`var startStep = 1`). The `sessionStorage.getItem('newshub_advance')` mechanism only fires after a form-type redirect, not when coming from the article edit button.

### Fix
In `news-form-stepper.js`, check `window.__EDIT_MODE__` and skip to step 2:
```javascript
if (window.__EDIT_MODE__ && startStep === 1) {
  startStep = 2;
}
```

### Files Changed
- `news-form-stepper.js` — added `__EDIT_MODE__` check before `showStep(startStep)`

---

## 9. Edit Mode — localStorage Draft Overrides Edit Data

### Symptom
Edit form loads but fields are empty because an old localStorage draft from a previous visit overwrites the server-provided edit data.

### Root Cause
`news-form-persist.js` restore is skipped via `window.__EDIT_MODE__`, but the old draft still exists in localStorage. Some components (Quill, cascades) may read stale values.

### Fix
`news-form-edit-load.js` must clear localStorage before populating:
```javascript
localStorage.removeItem('newshub_draft');
localStorage.removeItem('newshub_draft_tags');
```

### Files Changed
- `news-form-edit-load.js` — added `localStorage.removeItem()` calls after setting `__EDIT_MODE__`

---

## 10. Edit Mode — Legal Checkboxes Not Populating (Case Mismatch)

### Symptom
Editing an article shows legal checkboxes (retaliation, applicable laws, support services) all unchecked, even though DB has values saved. Submitting overwrites saved selections with empty.

### Root Cause
`_bit_flags_to_ids_by_code()` in helpers.py used UPPERCASE codes (`FAMILY_PRESSURE`) from the BIT-to-code map, but `ref_status.status_code` stores lowercase (`family_pressure`). The `status_code__in=active_codes` query was case-sensitive — no match → empty IDs → checkboxes unchecked → user submits → saves empty.

### Fix
Convert active codes to lowercase before querying: `active_codes_lower = [c.lower() for c in active_codes]`

### Files Changed
- `helpers.py:_bit_flags_to_ids_by_code()` — lowercase conversion before DB lookup

---

## 11. Legal Checkboxes — Stale querySelectorAll in serialize()

### Symptom
Checking a legal checkbox (retaliation, applicable law, support service) doesn't save — always saves empty arrays.

### Root Cause
`querySelectorAll('input[name="ext_retaliation"]')` called ONCE at init time BEFORE `populateCheckboxes()` dynamically creates the actual checkboxes. The NodeList is stale/empty. `serialize()` calls `getCheckedIds()` on empty NodeList → always returns `[]`.

### Fix
Replace static `var` with functions that query fresh:
```javascript
// Before (broken):
var retaliationCheckboxes = document.querySelectorAll('input[name="ext_retaliation"]');
// After (fixed):
function getRetaliationCheckboxes() { return document.querySelectorAll('input[name="ext_retaliation"]'); }
```

### Files Changed
- `news-extortion-legal.js`, `news-crime-legal.js`, `news-land-grab-legal.js`, `news-wcv-legal.js` — all 4 legal JS files

---

## 12. Global Case Mismatch — .upper()/.toUpperCase() Across Entire Project

### Symptom
Any status_code comparison that uses .upper() or .toUpperCase() risks silent failure because DB stores lowercase codes but code compares against UPPERCASE constants.

### Root Cause
Original code pattern everywhere: `code_map[id] = row['status_code'].upper()` then `'UPPERCASE_CONSTANT' in codes`. DB stores `family_pressure`, code looks for `FAMILY_PRESSURE`. Works by accident when both sides are uppercased, but breaks when one side is missed (e.g. in helpers.py BIT-to-code maps).

### Fix (2026-03-24 — global cleanup)
- Python views.py: removed 8 `.upper()` calls, lowercased 90 comparison constants
- 9 JS component files: removed 16 `.toUpperCase()` calls, lowercased all constants
- helpers.py: BIT-to-code maps changed to lowercase
- Only exception: `incident_involved_actor_role_group_code` (stored UPPERCASE in DB)

### Rule
See [feedback_no_case_conversion.md](feedback_no_case_conversion.md)

---

## 12. SPA Double Flash / FOUC (Flash of Unstyled Content)

### Symptom
After moving from MPA to SPA, pages flash unstyled content for a split second during navigation. Content appears, then shifts/restyles when CSS loads. Also affects first page load on slow connections.

### Root Cause
SPA navigation swaps <main> innerHTML via fetch + DOMParser. New page may need different CSS files (page-specific CSS in {% block extra_css %}). If content is shown before CSS files finish loading, user sees FOUC.

This is NOT hydration mismatch (React/Vue concept). This is purely CSS loading timing.

### Fix (2026-04-05)
1. loadPageCss() returns Promise that resolves when all new <link> elements fire onload
2. Content hidden (opacity:0) before swap, revealed only after CSS Promise resolves
3. 500ms timeout fallback — never leaves page invisible
4. CSS prefetch on hover — parses prefetched HTML, injects <link rel="preload" as="style">
5. First-load cloak — inline CSS hides main, html.spa-ready class added on DOMContentLoaded
6. 150ms opacity transition (was 100ms) — masks micro-flashes
7. Scroll position restore on back/forward via history.state.scrollY

### Files
- spa-navigation.js: full SPA navigation with FOUC prevention
- base.html: inline cloak + DOMContentLoaded reveal
- base.css: main { transition: opacity .15s ease }

### Rule
See notes/spa-fouc-prevention-rules.txt for full rules.
NEVER use requestAnimationFrame alone to reveal SPA content.
NEVER show content before CSS is loaded.
ALWAYS have a timeout fallback.
