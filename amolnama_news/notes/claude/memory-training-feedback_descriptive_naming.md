---
name: Descriptive naming convention
description: All variables, filenames, IDs, names, CSS classes must be fully descriptive — no abbreviations or short names
type: feedback
---

Every name must immediately tell you what it is. No abbreviations, no partial names, no short names.

**Why:** Short names like `thd`, `bh`, `c`, `d`, `n`, `fd`, `btn`, `desc`, `loc` force the reader to guess. Wastes time, causes bugs.

**How to apply:**
- **Variables**: `contributorData` not `c` or `cd`. `destinationDescription` not `desc`. `formData` not `fd`.
- **DOM IDs**: `travel-hub-detail-photo-upload-button` not `thd-photo-upload-btn`. `article-publication-status-select` not `art-pub-stat-sel`.
- **CSS classes**: `travel-hub-detail-action-button` not `thd-action-btn`.
- **File names**: `travel-hub-detail.js` not `thd.js`. Already good — keep this standard.
- **Function names**: `buildExtortionEditData` not `_bld_ext_ed`.
- **AJAX endpoints**: `/bangladesh/api/destination/<id>/youtube-link/add/` not `/api/dest/<id>/yt/`.
- **Template variables**: `destination_description_paragraphs` not `desc_paragraphs`.
- **Hidden inputs**: `name="travel_hub_photo_caption"` not `name="thd_photo_caption"`.

**SEO-friendly naming:**
- URL paths must include keywords users search for (Bengali transliterated + English)
- Examples: `/bangla-kobita-gaan/` not `/poem/`, `/bangladesh-tourist-destinations/` not `/bangladesh/`
- Slug URLs: include location, topic, author — e.g., `/bangla-kobita-gaan/রবীন্দ্রনাথ-ঠাকুর-গীতাঞ্জলি/`
- Tool titles: include exact Bengali search phrases — "আপনার রাশি জেনে নিন" not just "বয়স ক্যালকুলেটর"

**Exceptions:**
- Industry-standard abbreviations OK: `id`, `url`, `html`, `css`, `js`, `api`, `btn` (in UI text only, not code), `img`, `src`.
- Loop counters: `i`, `j` OK.
- Django conventions: `pk`, `qs`, `ctx` OK.
- Repeated per-item buttons (edit/delete/like) use class-based delegation — static `id` not required. Use `data-type` + `data-id` attributes for identification.
