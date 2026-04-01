---
name: Universal language toggle for all forms
description: Make BN/EN language toggle control all form fields, labels, placeholders across every app — show only relevant language fields
type: project
---

**Goal:** When user selects বাংলা or English in the header toggle, ALL forms across ALL apps show only the relevant language fields.

**Current state:**
- BanglaInput (englishtobangla app) hooked globally via base.html ✅
- Language toggle exists in header (news-form-lang.js) ✅
- Newshub forms have data-bn/data-en attributes for label switching ✅
- Poem create/edit has poem-create-field-bn/en class toggling ✅
- Bangladesh, marriage, tools, evaluation_vote — NOT separated yet

**What needs to happen:**
1. Standardise CSS classes: `.field-bn` (visible when BN) / `.field-en` (visible when EN) — universal across all apps
2. Update news-form-lang.js to toggle `.field-bn`/`.field-en` visibility globally
3. Every form with dual-language fields gets the class markup
4. Labels get data-bn/data-en attributes for text switching
5. Placeholders get data-ph-bn/data-ph-en
6. BanglaInput auto-disables on EN fields, auto-enables on BN fields
7. Forms that only have one language (e.g. tools age calculator) — unaffected

**Apps to update:**
- newshub (13 forms) — already mostly done, standardise classes
- poem (create, edit) — already done with poem-specific classes, migrate to universal
- bangladesh (travel hub add, beauty upload) — needs BN/EN split
- marriage — needs BN/EN split
- evaluation_vote — needs BN/EN split
- core (home, articles) — display only, no forms to split

**Why:** Clean UX — users see only their language. No mixed Bengali+English clutter.
**How to apply:** Start fresh session, do one app at a time, test each before moving to next.
