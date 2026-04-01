---
name: Empty string vs NULL rule
description: Never use empty string "" for non-mandatory fields — always use NULL (or None in Python). Empty strings break IS NULL queries and are not the same as empty.
type: feedback
---

Non-mandatory text fields must store NULL, never empty string "".

**Why:** Empty strings `""` break `IS NULL` queries and are semantically different from NULL. The user has corrected this multiple times. `""` means "a value was provided and it's blank" — NULL means "no value was provided".

**How to apply:**
- Python: always use `or None` when saving non-mandatory text fields (e.g. `value.strip() or None`)
- HTML: hidden inputs for optional fields should not have `value=""` — omit the value attribute or use no default
- JS: send `null` not `""` for empty optional fields in JSON payloads
- DB: non-mandatory TEXT/NVARCHAR columns should accept NULL, not default to `""`
- Never use `default=""` on Django model fields for optional text columns
