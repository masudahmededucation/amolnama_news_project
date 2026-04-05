---
name: SPA FOUC / Double Flash Prevention
description: Rules for preventing Flash of Unstyled Content during SPA navigation and first page load
type: feedback
---

## Problem
Moving from MPA to SPA caused "double flash" — unstyled content visible for a split second before CSS loads.
Root cause: CSS loading timing during <main> swap. NOT hydration mismatch (no React/Vue).

## Rules

1. NEVER show content before CSS is loaded.
   Wait for Promise.all(cssLoadPromises) before setting opacity > 0.

2. NEVER use requestAnimationFrame alone to reveal content.
   One frame (~16ms) is not enough. CSS takes 50-500ms.
   Use Promise-based CSS onload + setTimeout fallback.

3. ALWAYS keep old content hidden during swap.
   Set opacity:0 BEFORE innerHTML swap.

4. ALWAYS have a timeout fallback (500ms).
   Never leave page invisible forever.

5. First page load must also be cloaked.
   html.spa-ready class + DOMContentLoaded reveal + 800ms fallback.

6. CSS transition on main must be 150ms+ (not 100ms).
   Professional apps use 150-200ms fade.

7. Prefetch CSS on hover, not just HTML.
   Parse prefetched HTML, inject <link rel="preload" as="style">.

8. Back/forward must restore scroll position.
   Save scrollY in history.state, restore on popstate.

## What Does NOT Apply
- Hydration mismatch, Inertia.js, Vite, SSR with Node, v-cloak, React Suspense
- These are React/Vue concepts. We use Django SSR + vanilla JS.

## Implementation
- spa-navigation.js: 10-step navigation flow with CSS Promise + scroll restore
- base.html: inline cloak (opacity:0 -> spa-ready class)
- base.css: main { transition: opacity .15s ease }
- Full rules: notes/spa-fouc-prevention-rules.txt
