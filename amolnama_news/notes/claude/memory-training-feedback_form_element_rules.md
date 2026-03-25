---
name: Form element rules — id, name, label
description: Every form element must have id + name. Every label must have for= or wrap its input. Group labels use span not label. Check ALL files, not just the one being edited.
type: feedback
---

When creating ANY form element (input, select, textarea, radio, checkbox):
1. ALWAYS add both `id` and `name` attributes
2. `id` uses hyphens: `poem-title-bn`
3. `name` uses underscores: `poem_title_bn`
4. Every `<label>` MUST either have `for="matching-id"` or wrap the input inside it
5. Group labels (describing multiple checkboxes/radios) use `<span class="form-field-label">` NOT `<label>`
6. Cloned/template rows: inputs use class selectors but still need `name` attribute
7. **DYNAMIC elements (JS createElement)**: SAME rules apply. Every `createElement('input')`, `createElement('select')`, `createElement('textarea')` in JS MUST set `.id` and `.name`. Pattern: `input.id = prefix + '-' + statusId`, `input.name = prefix_name`. Check ALL JS files, not just HTML templates.
8. Check JS files: `grep -rn "createElement.*input\|createElement.*select" --include="*.js"` to find all dynamic elements

**Why:** The user spent 8+ rounds reporting warnings because I kept fixing HTML templates but ignoring JS files that dynamically create form elements. Zero warnings is the standard. Every warning — static or dynamic — is valid and fixable.

**How to apply:** Before saying "done" on any form/template work:
1. Run full project grep on HTML: `grep -rn '<label' --include="*.html" | grep -v 'for=' | grep -v '<label><input'`
2. Run full project grep on JS: `grep -rn "createElement.*input\|createElement.*select" --include="*.js"`
3. Verify BOTH static and dynamic elements have id + name
4. Check ALL files, not just the one being edited
