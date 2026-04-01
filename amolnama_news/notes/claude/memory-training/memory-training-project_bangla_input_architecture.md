---
name: Bengali input (Avro phonetic) architecture
description: How BanglaInput and QuillAvro work across all apps — regular fields and Quill rich text editors
type: project
---

## Bengali Input System Architecture

Two components work together to provide Bengali typing across the entire site:

### 1. BanglaInput — for regular `<input>` and `<textarea>` fields

**File:** `englishtobangla/static/englishtobangla/assets/js/utilities/bangla-input.js`
**Loaded in:** `core/base.html` (every page)

**How it works:**
- `BanglaInput.attach(inputElement)` hooks into an input/textarea
- Listens to `input` event — detects English words being typed
- Runs Avro phonetic transliteration (`OmicronLab.Avro.Phonetic.parse()`)
- Looks up Bengali dictionary (159K words, loaded once from `bangla-dictionary.json`)
- Shows suggestion dropdown near the input field
- Space = auto-pick best suggestion, Arrow keys = browse, Enter/Tab = pick, Escape = dismiss
- Also fetches Google transliteration suggestions in background for better quality

**Auto-attachment via `news-form-lang.js`:**
- Runs on every page (loaded in `base.html`)
- On page load + 300ms retry: attaches to ALL `input[type="text"]` and `textarea`
- Skips: `_en` fields, `data-no-bangla` fields, date/number/email/url/password/hidden/file inputs
- MutationObserver watches for DOM changes (new fields, step visibility changes)
- Observes `childList`, `attributes` (class/style) to catch step navigation

**Per-page hooks (external JS files, NOT inline scripts — CSP blocks inline):**
- `poem/assets/js/components/poem-avro-hook.js` — poem create + edit pages
- `bangladesh/assets/js/components/bangladesh-avro-hook.js` — travel hub add, beauty hub upload
- Each retries every 300ms until BanglaInput is loaded (it loads after `extra_js` block)

**Important: filename must NOT contain "bangla-input"** — `bangla-input.js` uses `querySelectorAll("script[src*='bangla-input']")` to find itself and resolve the dictionary path. Files with "bangla-input" in the name match this selector and break the dictionary path resolution.

### 2. QuillAvro — for Quill rich text editors

**File:** `englishtobangla/static/englishtobangla/assets/js/utilities/quill-avro.js`
**Loaded in:** `core/base.html` (every page)

**How it works:**
- `QuillAvro.attach(quillInstance)` hooks into a Quill editor
- `QuillAvro.setEnabled(true/false)` toggles Bengali mode
- Listens to Quill's `text-change` event (not DOM `input` event)
- Finds the English word being typed from cursor position in Quill's text
- Runs same Avro + dictionary lookup as BanglaInput
- Shows suggestion dropdown positioned at the Quill cursor (using `quill.getBounds()`)
- On pick: uses `quill.deleteText()` + `quill.insertText()` to replace English with Bengali
- Preserves active formatting (bold, color, etc.) via `quill.getFormat()`

**Integration with language toggle:**
- `news-form-lang.js` detects language toggle change (বাংলা / English radio buttons)
- When Bengali: `QuillAvro.setEnabled(true)` — typing in Quill shows Bengali suggestions
- When English: `QuillAvro.setEnabled(false)` — Quill works normally
- Auto-attaches to all known Quill editors: `__quillNewsSummary`, `__quillNewsBody`, `__quillShortDesc`, `__quillDesc`

**User experience:**
- Toggle language to বাংলা
- Click in any Quill editor
- Type English (e.g., "ami") → Bengali suggestions appear at cursor ("আমি", "আমির", etc.)
- Press Space to pick → Bengali text inserted with current formatting
- Can still use Quill toolbar (bold, color, lists) — formatting works alongside Bengali typing
- Toggle back to English → Quill works normally, no transliteration

### Script Loading Order (critical)

In `core/base.html`:
```
{% block extra_js %}     ← page-specific scripts (Quill init, form JS)
avro-phonetic.js         ← Avro transliteration engine
bangla-input.js          ← BanglaInput for regular fields + dictionary loader
quill-avro.js            ← QuillAvro for Quill editors
news-form-lang.js        ← language toggle + auto-attach both systems
```

All hook scripts use `setTimeout` retry because `BanglaInput` / `QuillAvro` may not be defined yet when `extra_js` scripts run.

### Known Limitations

- BanglaInput only works on `<input>` and `<textarea>` — uses `.value`, `.selectionStart`
- QuillAvro only works on Quill instances — uses Quill's Delta API
- Other rich text editors (TinyMCE, CKEditor) would need their own integration
- Dictionary loads once (~500KB), cached by browser (`force-cache`)
- Google transliteration API (`/tools/api/transliterate/`) enhances suggestions but works offline too

### CSP Considerations

- Inline `<script>` blocks are blocked by CSP `script-src` (no `unsafe-inline`)
- All BanglaInput hooks must be in external `.js` files, NOT inline scripts in templates
- External JS filenames must NOT contain "bangla-input" (breaks dictionary path resolution)
