---
name: No popup messages
description: Never use alert() or popup boxes — always use inline warning/success messages
type: feedback
---

Ban all popup messages (alert(), confirm(), prompt()). Always use inline warning/success messages instead.

**Why:** User finds popups disruptive and unprofessional.

**How to apply:** Replace every `alert()` with an inline message element inserted near the relevant UI element. Auto-dismiss after a few seconds. Style with `.inline-msg`, `.inline-msg-error`, `.inline-msg-success`.
