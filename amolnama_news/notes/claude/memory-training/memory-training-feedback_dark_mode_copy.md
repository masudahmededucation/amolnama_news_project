---
name: Dark mode copy-paste strips backgrounds
description: clipboard-clean-copy.js strips background colors from copied content so pasting into Word/Gmail is clean
type: feedback
---

## Rule
Dark mode copy must not carry background colors to clipboard. Formatting (bold, links, text color) preserved.

## Implementation
clipboard-clean-copy.js — global utility loaded in base.html (defer).
Intercepts document copy event, strips background/background-color from inline styles via regex, sets clean text/html + text/plain to clipboardData.

## Dark mode colors (2026-04-06)
--bg: #121212 (Material Design standard, not pure black)
--surface: #1a1f1c (green-tinted, matches brand)
--card: #1e2421
--border: #2d3830
