# Universal Language Toggle System

## Overview

Single language toggle in the header controls all forms across all apps.
Toggle: `বাংলা | English` (golden pill, visible to all users — logged in or not).

## Architecture

### 1. Header Toggle
- **Location**: `user_account/templates/user_account/partials/header_auth_controls.html`
- **Radio**: `input[name="form_lang"]` with values `bn` or `en`
- **CSS**: `user_account/static/user_account/assets/css/layout/header-auth.css` — `.header-lang-toggle`
- **Preference saved**: AJAX POST to `/account/api/language-pref/` on change

### 2. Global JS: news-form-lang.js
- **Location**: `newshub/static/newshub/assets/js/components/news-form-lang.js`
- **Loaded**: globally via `core/templates/core/base.html` (runs on every page)
- **What it does**:
  - Reads initial language from `input[name="form_lang"]:checked`
  - Sets `body[data-lang="bn"]` or `body[data-lang="en"]`
  - Switches text on all elements with `data-bn` / `data-en` attributes
  - Switches placeholders on all elements with `data-ph-bn` / `data-ph-en`
  - Toggles `.lang-hidden` class on `.lang-field-bn` / `.lang-field-en` divs
  - Auto-attaches BanglaInput to text fields
  - MutationObserver watches for dynamically added fields

### 3. CSS: base.css
- **Location**: `core/static/core/assets/css/base.css`
- **Rule**: `.lang-hidden { display: none !important; }`
- Uses a single class toggle — no display type conflicts with flex/block/inline

## How to Use in Templates

### Pattern A: Separate BN/EN input fields (poem create/edit)
```html
{# Bengali field — visible by default #}
<div class="poem-create-group lang-field-bn">
  <label data-bn="শিরোনাম *" data-en="Title (Bengali) *">শিরোনাম *</label>
  <input type="text" id="poem-title-bn" name="poem-title-bn">
</div>

{# English field — hidden by default #}
<div class="poem-create-group lang-field-en lang-hidden">
  <label>Title (English)</label>
  <input type="text" id="poem-title-en" name="poem-title-en">
</div>
```

### Pattern B: Single field with label switching (newshub, shared fields)
```html
<label data-bn="ধরন *" data-en="Category *">ধরন (Category) *</label>
<select id="my-field">
  <option value="" data-bn="-- বাছাই করুন --" data-en="-- Select --">-- বাছাই করুন (Select) --</option>
</select>
```

### Pattern C: Marriage style — .lbl-bn / .lbl-en spans
```html
<label>
  <span class="lbl-bn">কাজীর নাম</span>
  <span class="lbl-en" style="display:none">Kazi's Name</span>
</label>
<input type="text" data-placeholder-bn="কাজীর পূর্ণ নাম" data-placeholder-en="Kazi's full name">
```
Marriage JS (`marriage-form-stepper.js`) uses MutationObserver on `body[data-lang]`
to sync with the header toggle and run its own `setLang()`.

## BanglaInput (Avro Phonetic Transliteration)

### Files
- `englishtobangla/static/englishtobangla/assets/js/utilities/avro-phonetic.js` — Avro Phonetic engine (57KB)
- `englishtobangla/static/englishtobangla/assets/js/utilities/bangla-dictionary.json` — 159K Bengali words (4MB, ~570KB gzipped)
- `englishtobangla/static/englishtobangla/assets/js/utilities/bangla-input.js` — reusable module

### Global hook
Loaded in `core/templates/core/base.html` — runs on every page.
`news-form-lang.js` auto-attaches `BanglaInput` to all `input[type="text"]` and `textarea` elements.

### Skips
- Fields with `_en` in id/name (English-only)
- Fields with `data-no-bangla` attribute
- Already-attached fields (`data-bangla-attached="1"`)

### Manual attach
```js
BanglaInput.attach(document.getElementById("myInput"));
```

### How it works
1. User types English → Avro Phonetic converts instantly (client-side)
2. Dictionary lookup finds similar Bengali words (offline, 159K words)
3. Base word + suffix generation (e.g. একটা + ই = একটাই)
4. Google transliteration API enriches suggestions in background (optional, degrades gracefully)
5. Suggestion dropdown with keyboard navigation (Arrow Up/Down, Space to pick, Escape to dismiss)
6. First suggestion pre-selected (blue highlight like desktop Avro)

## Song Type Detection (Poem App)

When `?type=song` (create) or `data-poem-type="song"` (edit):
- JS overrides BOTH `textContent` AND `data-bn`/`data-en` attributes on labels
- So when language toggle fires `applyLanguage()`, it reads song-specific text

## What NOT to Touch
- **Tools/Software pages** — keep mixed Bengali+English labels. No language separation needed.

## App Coverage

| App | Toggle | Label System | BanglaInput |
|-----|--------|-------------|-------------|
| Poem create/edit | Header | Pattern A + B (data-bn/data-en + lang-field) | Auto-attached |
| Newshub (13 forms) | Header | Pattern B (data-bn/data-en) | Auto-attached |
| Marriage form | Header → MutationObserver | Pattern C (.lbl-bn/.lbl-en) | Auto-attached |
| Marriage certificate | Header → MutationObserver | Pattern C | Auto-attached |
| Bangladesh | Header | Single language (BN) | Auto-attached |
| Evaluation vote | Header | Minimal | Auto-attached |
| Tools | — | Mixed BN+EN (don't change) | Auto-attached |

## How to Add Language Toggle to a New Form

### Planning Checklist
1. Check if the form has duplicate BN/EN fields or single fields with mixed labels
2. If duplicate fields → use Pattern A (lang-field-bn / lang-field-en)
3. If single fields with mixed labels → use Pattern B (data-bn / data-en attributes)
4. Check if the form has its own language toggle → remove it, use header only
5. Check if the form JS reads a form-specific radio → rewire to `input[name="form_lang"]`

### Step-by-Step Implementation

**Step 1: Remove form-specific toggle**
Delete any `<div class="xxx-lang-toggle">` HTML from the template.

**Step 2: Add data-bn/data-en to all labels**
Every label, button, hint, option that shows mixed text like `শিরোনাম (Title)`:
```html
<!-- Before -->
<label>শিরোনাম (Title) *</label>

<!-- After -->
<label data-bn="শিরোনাম *" data-en="Title *">শিরোনাম (Title) *</label>
```

**Step 3: Add lang-field classes to duplicate field containers**
```html
<!-- BN field — no lang-hidden (visible by default) -->
<div class="my-form-group lang-field-bn">...</div>

<!-- EN field — add lang-hidden (hidden by default) -->
<div class="my-form-group lang-field-en lang-hidden">...</div>
```

**Step 4: Update form JS**
If the form JS has its own language detection:
```js
// Change from form-specific radio
var langRadios = document.querySelectorAll('input[name="my-form-lang"]');

// To header toggle
var langRadios = document.querySelectorAll('input[name="form_lang"]');
```

If the form uses `.lbl-bn`/`.lbl-en` pattern (like marriage), add MutationObserver:
```js
var langObserver = new MutationObserver(function () {
  var bodyLang = document.body.getAttribute('data-lang');
  if (bodyLang && bodyLang !== currentLang) setLang(bodyLang);
});
langObserver.observe(document.body, { attributes: true, attributeFilter: ['data-lang'] });
```

**Step 5: Verify**
- Default (BN): Only Bengali fields/labels visible
- Click English: Only English fields/labels visible
- Click Bengali: Back to Bengali
- Page reload with English saved: English shows on load
- BanglaInput: suggestion dropdown appears on Bengali text fields

## Troubleshooting

### Problem: English fields still showing when Bengali selected
**Cause**: `lang-hidden` class not on the EN div, or CSS specificity override.
**Fix**: Ensure `<div class="... lang-field-en lang-hidden">`. The CSS rule `.lang-hidden { display: none !important; }` in base.css overrides everything.

### Problem: Labels show mixed text (e.g. "শিরোনাম (Title)") instead of clean language
**Cause**: Missing `data-bn`/`data-en` attributes on the label element.
**Fix**: Add both attributes. `news-form-lang.js` scans all `[data-bn][data-en]` elements and sets `textContent`.

### Problem: CSS display type broken (flex layout becomes block)
**Cause**: Earlier we tried `.lang-field-bn { display: block !important }` which overwrote `display: flex` on poem-create-group.
**Solution**: NEVER set display type on lang-field classes. Only use `.lang-hidden { display: none !important }` to hide. When `lang-hidden` is removed, the element's original display type (flex, block, inline) is preserved automatically.

### Problem: Language toggle not working on a form page
**Cause**: Form JS listens to a removed form-specific radio (e.g. `input[name="marriage-lang"]`).
**Fix**: Change to `input[name="form_lang"]` and add MutationObserver on `body[data-lang]`.

### Problem: Song labels revert to poem labels after toggle click
**Cause**: `news-form-lang.js` reads `data-bn` attribute which still has poem text.
**Fix**: Song detection JS must update BOTH `textContent` AND `data-bn`/`data-en` attributes:
```js
el.setAttribute("data-bn", "গানের কথা লিখুন");
el.setAttribute("data-en", "Write Song Lyrics");
el.textContent = "গানের কথা লিখুন";
```

### Problem: Toggle only visible to logged-in users
**Cause**: Toggle was inside `{% if user.is_authenticated %}` block.
**Fix**: Moved toggle OUTSIDE the auth check in `header_auth_controls.html` (done 2026-03-19).

### Problem: BanglaInput attaches to English-only fields
**Cause**: Field doesn't have `_en` in id/name.
**Fix**: Add `data-no-bangla` attribute to the input, or ensure id/name contains `_en`.
