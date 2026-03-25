---
name: STOP arguing — fix what the user reports immediately
description: When user reports an issue or warning, FIX IT immediately. Do NOT argue it's "not a real issue", "false alarm", "third-party", "timing artifact", or "by design". Every issue the user reports is valid and fixable. Just fix it.
type: feedback
---

STOP arguing with the user. Fix what they report IMMEDIATELY.

**The pattern that keeps repeating:**
1. User reports a warning/issue
2. I say "it's not a real issue" / "false alarm" / "third-party element" / "timing artifact"
3. User insists
4. I argue more
5. User gets frustrated
6. I finally fix it — turns out it WAS fixable all along
7. Time wasted: 10+ messages instead of 1

**The rule:**
- User reports issue → FIX IT. No discussion, no "it's not real", no "it's by design"
- If the user says there's a warning → the warning needs to go to ZERO
- "Third-party" is not an excuse — we can patch third-party elements in onReady/callbacks
- "Timing artifact" is not an excuse — restructure the code so timing doesn't cause warnings
- "False alarm" does not exist in the user's vocabulary — every alarm is real

**This overrides my own technical judgment.** The user's standard is ZERO warnings. Meet that standard without arguing.
