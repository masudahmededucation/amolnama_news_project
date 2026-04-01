---
name: Never do half-done work and ask user to test
description: Complete ALL work fully, verify ALL forms, check ALL related code BEFORE telling the user to test. Never push incomplete fixes and ask the user to be the tester.
type: feedback
---

Never do a partial fix and ask the user to test. Complete the full fix, verify it works across ALL forms and ALL related code, THEN tell the user it's ready.

**Why:** The user has been repeatedly burned by half-done fixes that break other things or only work in one place. Testing is MY job, not the user's. The user should only test the final, verified result — not intermediate broken states.

**How to apply:**
- Before saying "restart and test": have I checked ALL forms that use this code? Have I verified the fix is in the collected static files? Have I bumped the service worker cache version?
- Before saying "fixed" or "done": have I actually verified the change works, not just assumed it does?
- If a fix touches shared code (JS modules, middleware, base templates): check EVERY form/page that uses it
- If a fix requires multiple steps (code change + collectstatic + cache bump + server restart): do ALL steps before telling the user
- Never make one fix and immediately ask the user to check — batch related fixes together, verify, then report
- The user is NOT a QA tester. I am responsible for verification.
