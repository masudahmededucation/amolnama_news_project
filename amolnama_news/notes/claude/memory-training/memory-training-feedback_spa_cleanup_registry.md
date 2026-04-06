---
name: SPA cleanup registry for third-party libraries
description: Page scripts must register cleanup via spaCleanupRegister(). SPA calls destroy() before swap.
type: feedback
---

## Rule
Every third-party library instance (Flatpickr, Tom Select, Quill, Leaflet, Cropper.js) MUST register a cleanup function via `window.spaCleanupRegister()`. SPA navigation calls all cleanups before swapping content.

## Why
Third-party libraries inject elements into `<body>` (outside `<main>`). SPA only swaps `<main>`. Without proper destroy(), orphaned elements (calendars, dropdowns) appear at bottom of pages and event listeners leak memory.

## Pattern
```javascript
// In page-specific JS:
const instance = flatpickr(input, opts);
if (window.spaCleanupRegister) {
  window.spaCleanupRegister(function () { instance.destroy(); });
}
```

## Don't just .remove() DOM — call destroy()
DOM removal is a band-aid. destroy() releases event listeners, timers, and internal state. DOM fallback kept only as safety net after destroy().

## Implemented 2026-04-06
Flatpickr, Tom Select (7 files), Quill, Leaflet, Cropper.js all registered.
