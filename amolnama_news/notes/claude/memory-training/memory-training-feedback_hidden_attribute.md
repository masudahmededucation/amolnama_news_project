---
name: Use HTML hidden attribute, not CSS display-hidden class
description: All visibility toggling must use HTML hidden attribute and .hidden JS property, not display-hidden CSS class
type: feedback
---

## Rule
Use HTML `hidden` attribute for hiding elements. Never use CSS class `display-hidden`.

## Why
CSS classes only work after CSS loads. HTML `hidden` attribute is built-in to the browser (`[hidden] { display: none }`) and works immediately, preventing flash of hidden elements on page load.

## Pattern
```html
HTML: <div class="my-element" id="my-element" hidden>
CSS:  .my-element:not([hidden]) { display: flex; }  /* only if element needs explicit display */
JS:   element.hidden = true;   // hide
      element.hidden = false;  // show
      if (element.hidden) ...  // check
```

## Critical: CSS display overrides hidden
If CSS sets `display: flex/grid/block` on an element, it OVERRIDES the `hidden` attribute. Fix: use `:not([hidden])` selector.

Before: `.element { display: flex; }`
After:  `.element:not([hidden]) { display: flex; }`

## Migration completed 2026-04-05
230 files, 355 HTML + 373 JS + 12 CSS across all 15 apps.
.display-hidden CSS rule kept in forms.css as temporary fallback.
