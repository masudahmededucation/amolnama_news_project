---
name: No silent error swallowing
description: NEVER use bare except/pass — always show inline error messages to user without breaking page
type: feedback
---

NEVER silently swallow errors with `except: pass` or `except SomeError: pass`.

**Why:** Silent failures waste hours of debugging. The user sees a blank/wrong state with no clue what went wrong.

**How to apply:**
1. Catch specific exceptions, not broad `except Exception`
2. Always show a user-visible inline error message (Bengali + English)
3. Log the traceback to terminal for developer debugging
4. Never break the page — render it with the error message, not a 500
5. Pattern:
```python
try:
    # risky operation
except SpecificError as exc:
    import traceback
    traceback.print_exc()
    extra['error_message'] = f'বর্ণনামূলক ত্রুটি বার্তা: {exc}'
```
6. In JS: use inline messages (showMsg/showInlineMessage), never alert()
7. In API endpoints: always return `{"success": false, "error": "descriptive message"}`
