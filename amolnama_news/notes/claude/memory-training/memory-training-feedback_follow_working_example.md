---
name: Always follow existing working code — never invent new approaches
description: Before writing ANY code, find an existing working example in the project that does the same thing. Copy that pattern exactly. When user says "follow X", read X's code FIRST, then replicate. Never build complex workarounds when a simple proven pattern exists.
type: feedback
---

BEFORE writing any code, ALWAYS find an existing working example in the project.

**Why:** User repeatedly said "step 3 works — follow that for other steps" but I kept building complex JSON serialize/restore systems across 47 files instead of looking at how step 3 actually works (simple name-based save/restore in news-form-persist.js). The real fix was 30 lines in one file. I wasted hours on unnecessary complexity.

**How to apply:**
1. When user says "X works, do the same for Y" — IMMEDIATELY read X's code. Understand exactly how it works. Then replicate for Y.
2. Before building ANY new system — search the project for an existing solution to the same problem
3. If a simple pattern exists (like persist saving inputs by name), USE IT — don't build a parallel complex system
4. Never add 47 files when 1 file change would do
5. The simplest approach that already works is ALWAYS the right answer
6. Complex = wrong. If your solution requires timing hacks (setTimeout), multiple moving parts, or coordination between scripts — step back and find the simple way
