---
name: Edit pre-population troubleshooting
description: Issues and fixes when editing news articles via ?edit=<id> on multistep form
type: reference
---

## 7. Edit Pre-Population — Fields Empty on Edit Form

### Symptom
Clicking "Edit" on article view opens the multistep form at `/newshub/news-collection/multistep/extortion/?edit=29` but fields appear empty. Form type (extortion) is selected on step 1 but content fields on step 3 are blank.

### Root Causes & Fixes

**A. localStorage draft overriding edit data**
`news-form-persist.js` restores a saved draft from localStorage. Even though `window.__EDIT_MODE__` skips the restore, a stale draft may have been saved by a previous visit.
**Fix:** `news-form-edit-load.js` must clear localStorage drafts:
```javascript
localStorage.removeItem('newshub_draft');
localStorage.removeItem('newshub_draft_tags');
```

**B. Permission check failing silently**
If the logged-in user is NOT the article owner AND NOT staff/admin, `can_edit` is False and `edit_data_json` is never set. The form loads blank with no error.
**Fix:** Always check which user is logged in. Entry owner's `user_profile_id` must match the logged-in user's profile ID.

**C. Service worker caching old JS**
After code changes, the service worker may serve stale JS files.
**Fix:** Bump `CACHE_NAME` in `seo/views.py` and hard refresh.

**D. Quill editors not receiving content**
`news-quill-init.js` inits Quill editors and reads from hidden textareas. If edit-load.js sets textarea values AFTER Quill init, Quill shows empty.
**Fix:** Deferred phase in edit-load.js explicitly calls `window.__quillNewsSummary.setContent()` and `window.__quillNewsBody.setContent()` after window.load.

### Key Files
- `news-form-edit-load.js` — sets hidden inputs + `window.__EDIT_MODE__`
- `news-form-persist.js` — skips restore when `__EDIT_MODE__` is true
- `news-quill-init.js` — inits Quill, reads from hidden textarea on init
- `helpers.py:build_edit_data()` — server-side data reconstruction
- `views.py:news_collection_multistep_extortion()` — `?edit=` handling
