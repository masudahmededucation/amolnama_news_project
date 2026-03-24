# Rich Text Editor Plan — Quill.js Integration

## Goal
Replace plain textareas with Quill.js rich text editors for content fields (summary, description/body). Start with Travel Hub, then extend to newshub and other forms after testing.

## Phase 1: Travel Hub Only

### Fields to Convert
- **Short description** (`th-short-desc-bn`) — travel hub add/edit form
- **Detailed description** (`th-desc-bn`) — travel hub add/edit form

### Architecture

#### Storage
- DB columns stay as-is (NVARCHAR/TEXT) — now store HTML instead of plain text
- No schema changes needed
- Quill outputs clean HTML (`<p>`, `<strong>`, `<em>`, `<h2>`, `<h3>`, `<ul>`, `<ol>`, `<li>`, `<blockquote>`, `<a>`)

#### Quill.js Setup
- **CDN**: `https://cdn.quilljs.com/1.3.7/quill.min.js` + `quill.snow.css`
- **Theme**: Snow (toolbar visible)
- **Toolbar options**: Bold, Italic, Underline | Heading 2, Heading 3 | Ordered List, Bullet List | Blockquote | Link | Clean formatting
- No image upload in toolbar (handled separately)

#### Form Flow
1. Page loads → Quill initializes on container div (not textarea)
2. Hidden textarea stores the HTML content
3. On form submit → JS copies Quill HTML to hidden textarea → POST sends HTML
4. On edit load → JS sets Quill content from hidden textarea value

#### Display (Detail Page)
- Currently: `white-space: pre-line` renders plain text with line breaks
- Change to: `{{ dest.destination_description_bn|safe }}` — render HTML directly
- **XSS protection**: Sanitize on save (server-side) using bleach or manual tag whitelist
- Allowed tags: `p, br, strong, em, u, h2, h3, ul, ol, li, blockquote, a`
- Allowed attributes: `a[href, target, rel]`

### Files to Create
| File | Purpose |
|------|---------|
| `bangladesh/static/bangladesh/assets/js/components/quill-editor.js` | Reusable Quill initializer |

### Files to Modify
| File | Change |
|------|--------|
| `bangladesh/templates/bangladesh/pages/travel-hub-add.html` | Add Quill CDN, replace textareas with Quill containers + hidden inputs |
| `bangladesh/static/bangladesh/assets/js/pages/travel-hub-add.js` | Init Quill, sync to hidden input on submit, load from hidden on edit |
| `bangladesh/templates/bangladesh/pages/travel-hub-detail.html` | Change `white-space: pre-line` to render HTML with `|safe` |
| `bangladesh/static/bangladesh/assets/css/pages/travel-hub-detail.css` | Add `.thd-description` styles for rendered HTML (headings, lists, links) |
| `bangladesh/views_api.py` | Sanitize HTML on save (strip dangerous tags) |
| `core/templates/core/base.html` | Add `cdn.quilljs.com` to CSP `script-src` and `style-src` |

### CSP Changes
Current CSP needs to allow Quill CDN:
- `script-src`: add `https://cdn.quilljs.com`
- `style-src`: add `https://cdn.quilljs.com`

### Implementation Steps

1. **Update CSP** in `base.html` to allow Quill CDN
2. **Create `quill-editor.js`** — reusable function: `initQuillEditor(containerId, hiddenInputId, options)`
3. **Modify `travel-hub-add.html`**:
   - Add Quill CSS in `extra_css` block
   - Replace `<textarea>` with `<div id="quill-short-desc">` + `<textarea hidden>`
   - Replace `<textarea>` with `<div id="quill-desc">` + `<textarea hidden>`
   - Add Quill JS in `extra_js` block
4. **Modify `travel-hub-add.js`**:
   - Init Quill editors after DOM load
   - On submit: copy `.root.innerHTML` to hidden textareas
   - On edit load: set Quill content from edit data
5. **Add HTML sanitization** in `views_api.py` `api_destination_create()` and `api_destination_update()`
6. **Modify detail template** to render HTML with `|safe` filter
7. **Add CSS** for rendered HTML content (headings, lists, blockquotes inside `.thd-description`)

### Quill Toolbar Config
```javascript
var toolbarOptions = [
  ['bold', 'italic', 'underline'],
  [{ 'header': [2, 3, false] }],
  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
  ['blockquote'],
  ['link'],
  ['clean']
];
```

### HTML Sanitization (Server-Side)
```python
import re

ALLOWED_TAGS = {'p', 'br', 'strong', 'em', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a', 'span'}
ALLOWED_ATTRS = {'a': ['href', 'target', 'rel']}

def sanitize_html(html):
    """Strip all tags except whitelist. Basic sanitizer without bleach dependency."""
    if not html:
        return html
    # Remove script/style tags and content
    html = re.sub(r'<(script|style|iframe|object|embed)[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Remove on* event attributes
    html = re.sub(r'\s+on\w+\s*=\s*["\'][^"\']*["\']', '', html, flags=re.IGNORECASE)
    # Remove javascript: URLs
    html = re.sub(r'href\s*=\s*["\']javascript:[^"\']*["\']', 'href="#"', html, flags=re.IGNORECASE)
    return html.strip()
```

### Backward Compatibility
- Existing plain text in DB will render fine — browsers display plain text inside HTML containers
- Quill wraps plain text in `<p>` tags automatically
- No migration needed for existing data

---

## Phase 2: Newshub Forms (After Travel Hub Tested)
- Convert `news-summary-bn` textarea
- Convert `news-content-body-bn` textarea
- Update article detail template to render HTML
- Update `_handle_news_submission()` to sanitize

## Phase 3: Other Forms
- Poem description fields
- Beauty hub description
- Any other multi-line text fields

---

## Risk Areas
- **Bengali text + Quill**: Quill handles Unicode well, but test thoroughly with Bengali
- **Quill + BanglaInput hook**: May conflict — test Avro phonetic inside Quill editor
- **CSP**: Must whitelist Quill CDN domains
- **XSS**: Must sanitize on save — `|safe` in template trusts stored content
- **Form persist (localStorage)**: Currently saves textarea values — need to save Quill HTML instead
