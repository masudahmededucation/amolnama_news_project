---
name: No case conversion on status codes
description: NEVER use .upper()/.toUpperCase() on status_code values. DB stores lowercase. Compare lowercase to lowercase.
type: feedback
---

**RULE: All status_code comparisons use LOWERCASE. No .upper() or .toUpperCase() anywhere.**

The DB stores all `status_code` values in lowercase (e.g. `family_pressure`, `yes`, `police_refused`, `firearms`, `other`).

**Why:** Case mismatch caused legal checkboxes to silently not populate in edit mode — codes stored as `family_pressure` in DB but compared against `FAMILY_PRESSURE` in Python. Data loss on save.

**Fixed on 2026-03-24:**
- Python views.py: removed 8 `.upper()` calls, lowercased 90 UPPERCASE constants
- JS: removed 16 `.toUpperCase()` calls across 9 component files, lowercased all comparison constants
- helpers.py: BIT-to-code maps changed from UPPERCASE to lowercase

**Rule for all future code:**
1. In Python: `'family_pressure' in codes` — NOT `'FAMILY_PRESSURE' in codes`
2. In JS: `code === 'yes'` — NOT `code.toUpperCase() === 'YES'`
3. BIT-to-code maps: `'family_pressure'` — NOT `'FAMILY_PRESSURE'`
4. NEVER call `.upper()` or `.toUpperCase()` on `status_code` values
5. All comparison constants must be lowercase

**No exceptions. Zero `.upper()` in Python. Zero `.toUpperCase()` in JS. Entire project standardised.**

For display-only uppercase (file extensions, language badges), use CSS `text-transform: uppercase` — never JS conversion.
