---
name: Use descriptive variable names everywhere
description: Never use short/cryptic variable names like ext, cl, el, ll, lg. Use descriptive names like extortion_data, crime_legal_data. This applies to variables, functions, files, and CSS classes.
type: feedback
---

Never use short/cryptic variable names. Every name must immediately tell you what it represents.

**Why:** Short names like `ext`, `cl`, `el`, `ll`, `lg` caused a bug — `ext_json` was used instead of `ext` because the developer couldn't tell what `ext` meant. Descriptive names prevent this class of errors entirely.

**How to apply:**
- Variables: `extortion_incident_data` not `ext`, `crime_legal_data` not `cl`, `extortion_legal_data` not `el`
- Functions: `api_news_category_tags_search` not `api_tags_search`
- Files: `news-extortion-incident.js` not `news-ext-inc.js`
- Pattern: `{table_name}_{action}` or `{context}_{purpose}`
- No single-letter variables except loop counters (`i`, `j`, `k`)
- No abbreviations: `extortion` not `ext`, `legal` not `lg`, `conflict` not `cfl`
