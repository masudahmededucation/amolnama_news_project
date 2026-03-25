---
name: Never change global files without full impact check
description: Global files (news-form-lang.js, base.css, db_backend/base.py) affect ALL 13+ forms — never modify without verifying impact on every form
type: feedback
---

NEVER change global/shared files recklessly. These files affect the ENTIRE project:

- `news-form-lang.js` — loaded on EVERY page, controls language toggle for ALL forms
- `base.css` — loaded on EVERY page, CSS rules cascade to ALL elements
- `db_backend/base.py` — every single DB query goes through this

**What went wrong (2026-03-19/22):**
1. Changed `[data-bn][data-en]` query to `[data-en]` in news-form-lang.js — broke all 13 newshub forms because it started touching elements it shouldn't
2. Added `!important` display rules in base.css that overrode form-specific `display:flex` — broke poem create layout
3. Added MutationObserver without debounce — fired hundreds of times during page setup
4. Used `sizes.append(0)` in db_backend — caused Decimal precision error on extortion form

**Rules to follow:**
1. Before changing ANY global file, list ALL files/forms that use it
2. Use the MOST SPECIFIC selector possible — `[data-bn][data-en]` not `[data-en]`
3. Never use `!important` on display properties in global CSS
4. Never change query selectors in global JS to be broader — only narrower
5. Always add try/catch around new global code to prevent cascade failures
6. Debounce MutationObservers — never fire on every mutation
7. Test impact mentally on ALL 13 newshub forms + poem + marriage + bangladesh + tools before making the change
8. If unsure about impact, DON'T make the change — ask user first

**Why:** User has 13+ newshub forms, poem create/edit, marriage form/certificate, bangladesh forms, 10 tool pages — ONE bad global change breaks everything. User cannot test all forms every time.

**How to apply:** Before editing any global file, pause and ask: "Will this break existing forms?" If there's any doubt, don't do it.

**Core principle:** Every piece of code must be ISOLATED — it performs ONLY its intended job and CANNOT leak into or break other pages, forms, or components. Every function, selector, and query must be scoped as tightly as possible. If code touches the DOM, it must verify the element belongs to its scope before modifying it. No side effects. No assumptions about what else is on the page.
