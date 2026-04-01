---
name: Always check all forms after any fix
description: When fixing a bug, always check ALL forms and ALL similar code across the entire project — not just the one reported. User should never have to tell me to check others.
type: feedback
---

When fixing any bug, ALWAYS check ALL forms, ALL models, ALL similar code across the entire project — not just the one place where the bug was reported.

**Why:** The user has repeatedly had to tell me "check all other forms" after I fix one. This wastes their time and shows I'm not thinking about the full impact. If a bug exists in one place, the same pattern likely exists elsewhere.

**How to apply:**
- After fixing a bug, immediately grep the entire project for the same pattern
- Fix ALL occurrences in one pass, not one at a time
- Report back: "Fixed in X places, checked Y files, no other occurrences"
- For model field issues: check ALL models in ALL apps
- For JS issues: check ALL JS files across ALL components
- For template issues: check ALL templates across ALL apps
- Never say "fixed" without confirming no other instances exist
