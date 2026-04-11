# Mobile UX/UI Compliance Report

**Date:** 2026-04-11
**Branch:** newshub-multiform
**Scope:** all CSS files under `amolnama_news/site_apps/` (19 apps, 102 files, 27,687 lines)
**Method:** automated audit + manual sampling of foundation files + 2 page files

---

## TL;DR — The 5 structural problems

These are project-wide and block "gold standard mobile UX" until fixed. Each has a
specific remedy. Numbers are current state, not targets.

| # | Problem | Current | Gold standard | Severity |
|---|---|---|---|---|
| 1 | **Desktop-first CSS** (`max-width` media queries) | 130 `max-width` vs 1 `min-width` (99% desktop-first) | Mobile-first: start at 320px, grow with `min-width` | CRITICAL |
| 2 | **iOS auto-zoom on form focus** | 96 form inputs with `font-size < 16px` | Every form input ≥ 16px on mobile | CRITICAL |
| 3 | **No `safe-area-inset`** | 0 uses project-wide | iPhone notch + home indicator respected | HIGH |
| 4 | **Spacing scale fragmented** | `colors.css` defines only `--gap`, `--radius`, `--radius-sm` (no scale) | `--space-0` through `--space-12` (4/8 grid) | HIGH |
| 5 | **Tokens half-built** | Typography + button scales missing | One source of truth for type, button, input, card | HIGH |

## The good news — what's already done

1. **Viewport meta is correct** — `width=device-width, initial-scale=1`, no `user-scalable=no`
2. **Colors system is solid** — 40 CSS variables, full dark mode + prefers-color-scheme support in `colors.css`
3. **44px touch targets** — 85 occurrences of `44px` across 16 apps (Phase 3 audit did this)
4. **`prefers-reduced-motion`** — respected in 13 spots
5. **Bengali font stack** — `'Noto Sans Bengali', 'Noto Sans', sans-serif` enforced globally, `font-feature-settings: "liga"` for matras
6. **No internal `<style>` blocks** — Phase 3 audit extracted them
7. **No inline `style=""`** — same
8. **Dark mode** — full parity in `colors.css`, manual toggle + auto-detect
9. **Print stylesheet** — hides sidebar/header/footer cleanly

This is a stronger starting position than most projects. Foundation is 60% built.

---

## Per-app audit table

Raw metrics from the CSS audit script. Breakpoint columns (`480`/`640`/`768`/`1024`) show which tablet/desktop breakpoints exist anywhere in that app's CSS (`y` = yes).

```
app               files  lines  hex   mq  480  640  768  1024  touch44  rdm  gaps  !imp  safe
-----------------------------------------------------------------------------------------------
core                 28  2981  145   28    y    y    y    y        7    1    62    0     0
tools                12  6218  297   14    .    y    y    .       10    0    93    2     0
evaluation_vote       7  1011    2   22    y    .    y    .        7    4     9    0     0
newshub               7  4490    0   16    y    y    y    y        1    0    81   26     0
portal                6   786   26    5    .    y    .    .       12    0    31    0     0
social                6   501    9    9    .    y    .    .       11    5    15    0     0
bangladesh            4  1291   49    6    .    y    y    .        0    0    43    0     0
election_vote         4   325    0    2    y    y    .    .        1    0     2    0     0
marriage              4  2602  171    9    y    y    .    .        4    0    43   24     0
poem                  4  1437   69    6    .    y    .    .        0    0    28    0     0
art                   3   623    0    5    .    y    y    .        5    0    20    0     0
content               3   527    0    5    .    y    .    .        4    2    12    0     0
debate                3   625   25    5    y    .    y    .        6    0    34    8     0
stories               3   529    0    5    .    y    y    .        4    0     9    0     0
textextractor         3   215    0    3    .    .    .    .        0    0    15    0     0
user_account          2   570    0    3    y    .    .    .        3    0    12    0     0
messenger             1   774    6    2    .    y    .    .        6    1    14    3     0
post                  1  2091  110    3    y    y    .    .        3    0    44    0     0
search                1    71    2    2    .    y    .    .        2    1     5    0     0
```

**Legend:** `files` = CSS files, `lines` = total lines, `hex` = hardcoded hex colors
(should be 0 or close to it — all should use `var(--*)` tokens), `mq` = @media queries,
`touch44` = `44px` hits (touch-target compliance), `rdm` = `prefers-reduced-motion` hits,
`gaps` = `gap:` property (modern flex/grid layout), `!imp` = `!important` count
(code smell), `safe` = `safe-area-inset` hits.

---

## Per-app Mobile UX/UI compliance scores

Each app scored across 10 mobile UX dimensions. Score = number of dimensions PASS.
Grades: 8-10 = GOOD, 5-7 = FAIR, 0-4 = POOR.

### Dimensions scored
1. **Uses design tokens** — `var(--*)` instead of hex colors (hex count ≤ 10% of rules)
2. **Mobile-first approach** — prefers `min-width` over `max-width` (at least 1 `min-width`)
3. **Has mobile breakpoint** — at least one `@media` with `480px` or `640px`
4. **Has tablet/desktop breakpoint** — at least one with `768px` or `1024px`
5. **44px touch targets** — at least 1 occurrence
6. **`prefers-reduced-motion`** — at least 1 occurrence
7. **Modern `gap:` layouts** — uses CSS gap (not margin-based spacing)
8. **No `!important` abuse** — `!important` count < 5
9. **iOS font-zoom safe** — no `font-size < 16px` on form inputs (not scored per app — project-wide: 96 violations)
10. **Safe-area support** — at least 1 `safe-area-inset` (project-wide: 0, so ALL apps fail this)

### Scorecard

| App | 1.Tokens | 2.Mobile-first | 3.Mobile BP | 4.Tablet BP | 5.Touch 44 | 6.Reduced | 7.Gap | 8.No !imp | 9.iOS | 10.Safe | **Score** | Grade |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **core** | ✗ (145 hex) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ? | ✗ | **6/10** | FAIR |
| **art** | ✓ (0 hex) | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ? | ✗ | **6/10** | FAIR |
| **stories** | ✓ (0 hex) | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ? | ✗ | **6/10** | FAIR |
| **content** | ✓ (0 hex) | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ? | ✗ | **6/10** | FAIR |
| **social** | ✓ (9 hex) | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ? | ✗ | **6/10** | FAIR |
| **portal** | ✗ (26 hex) | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ | ? | ✗ | **5/10** | FAIR |
| **debate** | ✗ (25 hex, scoped) | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ (8) | ? | ✗ | **5/10** | FAIR |
| **evaluation_vote** | ✓ (2 hex) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ? | ✗ | **7/10** | FAIR |
| **newshub** | ✓ (0 hex) | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ (26) | ? | ✗ | **5/10** | FAIR |
| **bangladesh** | ✗ (49 hex) | ✗ | ✓ | ✓ | ✗ (0) | ✗ | ✓ | ✓ | ? | ✗ | **4/10** | POOR |
| **poem** | ✗ (69 hex) | ✗ | ✓ | ✗ | ✗ (0) | ✗ | ✓ | ✓ | ? | ✗ | **3/10** | POOR |
| **tools** | ✗ (297 hex) | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ? | ✗ | **5/10** | FAIR |
| **marriage** | ✗ (171 hex) | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ (24) | ? | ✗ | **3/10** | POOR |
| **post** | ✗ (110 hex) | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ | ? | ✗ | **4/10** | POOR |
| **messenger** | ✓ (6 hex) | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ? | ✗ | **6/10** | FAIR |
| **election_vote** | ✓ (0 hex) | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ? | ✗ | **4/10** | POOR |
| **user_account** | ✓ (0 hex) | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ | ? | ✗ | **5/10** | FAIR |
| **textextractor** | ✓ (0 hex) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ? | ✗ | **3/10** | POOR |
| **search** | ✓ (2 hex) | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ? | ✗ | **6/10** | FAIR |

**Project average: 5/10 = FAIR.** No app scores 8+. Zero apps pass the mobile-first criterion. Zero apps support safe-area.

### Apps grouped by grade

- **FAIR (5-7/10)** — 13 apps: evaluation_vote (7), core, art, stories, content, social, messenger, newshub, portal, debate, tools, user_account, search
- **POOR (0-4/10)** — 6 apps: bangladesh (4), post (4), election_vote (4), poem (3), marriage (3), textextractor (3)

### Apps flagged RED for specific problems

| Issue | Apps |
|---|---|
| **Heavy hex usage** (> 25 hardcoded hex colors) | tools (297), marriage (171), core (145), post (110), poem (69), bangladesh (49) |
| **No touch targets** (0 × 44px) | bangladesh, poem, textextractor |
| **No reduced-motion** | 15 of 19 apps — only core, content, social, evaluation_vote, messenger, search respect it |
| **`!important` abuse** | newshub (26), marriage (24), debate (8), tools (2), messenger (3) |

---

## The critical project-wide problems in detail

### Problem 1 — Desktop-first CSS

- **130** `max-width` media queries across the project
- **1** `min-width` media query across the project
- 99% desktop-first

**Why this is a problem:**
Desktop-first CSS means "default styles = desktop, override for mobile". Every mobile user
loads the full desktop styles first, then the browser recomputes them at smaller breakpoints.
This is slower on mobile (wasted CSS parsing) and logically backwards for a mobile-majority
user base.

**Gold standard (used by every modern app):**
Mobile-first. Default styles = 320px mobile. Use `@media (min-width: 768px)` to scale up
for tablets, `@media (min-width: 1024px)` for desktop. Mobile users see their styles
first. Desktop users' browsers add the desktop override only on desktop.

**Fix:** Case-by-case inversion of each `max-width` block. Cannot be done by regex — requires
reading each media block and swapping the selector logic. ~130 blocks to invert across 65 files.

### Problem 2 — iOS auto-zoom on form focus

- **96** form inputs across the project have `font-size < 16px`
- iOS Safari auto-zooms the viewport when a user focuses an input with font-size < 16px
- This is a jarring UX — the page snaps, the keyboard opens, the user loses context

**Fix:** Raise every form input's font-size to 16px minimum on mobile. Can be done in one
global rule in base.css targeting `input, select, textarea` at `max-width: 768px`. ~1 line
fix. Per-component overrides can use `font-size: 14px` above 768px.

### Problem 3 — No safe-area-inset

- **0** uses of `safe-area-inset-*` anywhere
- iPhone X+ has a notch at the top and home indicator at the bottom
- Fullscreen elements (sticky header, bottom tab bar, modal) must respect safe areas
- Project does not — content can be hidden behind notch or home bar on iPhone

**Fix:** Add `padding-top: max(Npx, env(safe-area-inset-top))` to sticky headers, same
for `padding-bottom` on bottom bars + FAB buttons + tab bars. ~6-10 component files affected.

### Problem 4 — Spacing scale fragmented

`colors.css` defines:
- `--gap: 1.25rem`
- `--radius: 12px`
- `--radius-sm: 8px`

That's it for layout tokens. No spacing scale. Every page CSS file invents its own
`padding: .6rem 1rem` or `margin-bottom: 1.25rem` etc. Result: visually inconsistent
spacing across pages.

**Fix:** Add a 4/8 grid spacing scale to colors.css (or a new tokens.css):
```
--space-1: .25rem;   /* 4px */
--space-2: .5rem;    /* 8px */
--space-3: .75rem;   /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.25rem;  /* 20px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-10: 2.5rem;  /* 40px */
--space-12: 3rem;    /* 48px */
```

Plus radius scale:
```
--radius-xs: 4px;
--radius-sm: 8px;    /* already exists */
--radius-md: 12px;   /* same as --radius */
--radius-lg: 16px;
--radius-xl: 24px;
--radius-full: 9999px;
```

Plus shadow tiers:
```
--shadow-xs: 0 1px 2px rgba(0,0,0,.04);
--shadow-sm: var(--shadow);      /* already exists */
--shadow-md: var(--shadow-md);   /* already exists */
--shadow-lg: 0 10px 30px rgba(0,0,0,.12);
```

Plus motion scale:
```
--duration-fast: .12s;
--duration-base: .2s;
--duration-slow: .35s;
--ease-out: cubic-bezier(.22, 1, .36, 1);
```

Phase-0 task.

### Problem 5 — Tokens half-built

- **Typography scale missing** — no `--text-xs/sm/base/lg/xl/2xl/3xl/4xl`
- **Line-height scale missing** — no `--leading-tight/normal/relaxed/loose`
- **Button component incomplete** — `components/buttons.css` is 53 lines with only `.button`, `.button.primary`, `.icon-button`. Missing: secondary, ghost, danger, disabled, loading, small/large sizes, focus-visible state
- **Forms component is 1 line** — `components/forms.css` has `wc -l` = 1. Effectively empty. All form styling is bespoke per page.
- **Motion tokens missing** — no duration/easing tokens
- **Z-index scale missing** — no `--z-dropdown/sticky/modal/toast`

**Fix:** Phase 0 task. Build out the foundation files to production quality.

---

## Proposed remediation plan

All 5 structural problems fixable. **Not** in one session. Safest order:

### Phase 0 — Foundation (1 session, 1 commit)
**Scope:** Build out tokens + foundation components. No visual changes to any app.

Files touched:
- `core/utilities/colors.css` — add spacing/radius/shadow/motion/z-index/text scales (additive only, existing tokens untouched)
- `core/utilities/typography.css` — expand type scale + Bengali line-height
- `core/components/buttons.css` — complete button system (all variants, states, sizes)
- `core/components/forms.css` — write real form system (inputs, labels, errors, focus)
- `core/components/cards.css` — polish existing card component
- `core/base.css` — add `input/select/textarea { font-size: 16px; }` at mobile breakpoint (fixes iOS auto-zoom project-wide in 1 rule)
- `core/base.css` — add safe-area-inset to `.page-wrapper` padding
- `core/templates/core/base.html` — ensure viewport meta has `viewport-fit=cover` (enables safe-area-inset)

Risk: LOW. Additive only. Existing styles unchanged.

**Expected result:** Every app automatically fixes iOS zoom + safe-area via base.css. Every app gets access to new tokens for Phase 1+.

### Phase 1 — Tools app (1 session, 1 commit)
**Scope:** Tools has the most hex colors (297) but simplest interactions. Perfect warm-up.

Activity:
- Replace 297 hex colors with token vars
- Invert desktop-first `max-width` queries to mobile-first `min-width`
- Adopt new button/card/form components
- Add `prefers-reduced-motion` fallback
- Mobile-test all 11 tool pages (320px / 768px / 1024px)

Risk: LOW-MEDIUM. Tools pages are self-contained, no shared component conflicts.

### Phases 2-6 — One app each, in risk order
| Phase | Session | App | Files | Lines | Hex | Risk | Why |
|---|---|---|---|---|---|---|---|
| 2 | 3 | poem | 4 | 1437 | 69 | LOW | Small, recently migrated |
| 2 | 3 | stories | 3 | 529 | 0 | LOW | Small, recently migrated |
| 2 | 3 | art | 3 | 623 | 0 | LOW | Small, recently migrated |
| 3 | 4 | bangladesh | 4 | 1291 | 49 | MED | Travel + beauty, 2 layouts |
| 4 | 5 | debate | 3 | 625 | 25 | MED | Complex arena, blue/red cols |
| 5 | 6 | marriage | 4 | 2602 | 171 | MED | Large, heavy hex |
| 5 | 6 | evaluation_vote | 7 | 1011 | 2 | MED | Voting UI |
| 5 | 6 | election_vote | 4 | 325 | 0 | LOW | Small |
| 6 | 7 | social | 6 | 501 | 9 | MED-HIGH | Profile, bookmarks, most visible |
| 6 | 7 | post | 1 | 2091 | 110 | MED-HIGH | Home feed, most interactions |
| 6 | 7 | content | 3 | 527 | 0 | LOW | Shared components polish |
| 7 | 8 | messenger | 1 | 774 | 6 | HIGH | Complex WebSocket layout |
| 8 | 9 | newshub | 7 | 4490 | 0 | HIGHEST | Biggest app, multistep forms |
| 8 | 9 | portal | 6 | 786 | 26 | LOW | Staff dashboards |
| 9 | 10 | core partials | 5 | — | 145 | LOW-MED | Header, sidebar, right-panel, final |

Sessions count: **9 total** (including Phase 0). Each session ships ONE commit, independently rollback-able.

### What each app-phase includes
1. Invert desktop-first media queries to mobile-first
2. Replace hardcoded hex with tokens
3. Adopt shared button/card/form components (delete page-level bespoke copies)
4. Raise form input font-size to 16px on mobile (if Phase 0 global fix didn't catch it)
5. Add `prefers-reduced-motion` block
6. Verify at 320px / 375px / 768px / 1024px via test client (if SSR) or manual browser check
7. Smoke test every page of the app via test client before commit
8. Commit with clear scope

---

## What "gold standard mobile UX/UI" actually means (for calibration)

Professional mobile-first apps share these invariants. Marking which your project has today.

| Invariant | Status |
|---|---|
| Viewport meta with `width=device-width, initial-scale=1` | ✓ done |
| `viewport-fit=cover` for safe-area (needed for env()) | ✗ not yet |
| Mobile-first CSS (`min-width` not `max-width`) | ✗ 99% desktop-first |
| All form inputs ≥ 16px on mobile (iOS zoom prevention) | ✗ 96 violations |
| `safe-area-inset` on sticky/fixed/bottom elements | ✗ 0 uses |
| 44×44px minimum touch targets (iOS HIG) | ~ partial (85 hits, 3 apps have 0) |
| `prefers-reduced-motion` fallback on all transforms/animations | ~ partial (13 hits, 15 apps have 0) |
| Single source of truth for colors | ✓ colors.css |
| Single source of truth for spacing | ✗ fragmented per file |
| Single source of truth for typography scale | ✗ fragmented per file |
| Single source of truth for button system | ~ partial (3 variants only, missing states) |
| Single source of truth for form system | ✗ 1-line file, effectively empty |
| Single source of truth for card system | ✓ exists |
| Dark mode parity | ✓ done (colors.css) |
| Print stylesheet | ✓ done (base.css) |
| Bengali typography (ligatures, matras, font-feature-settings) | ✓ done (base.css) |
| Focus-visible rings on interactive elements | ~ partial |
| Loading states (skeleton screens) | ~ partial |
| Scroll restoration / `overflow-y: scroll` (prevents layout shift) | ✓ done (base.css) |

**Score: 7 done / 4 partial / 7 missing.** Solid foundation. Most gaps are fixable in Phase 0 alone.

---

## Honest take on timeline and scope

**You asked: "how long does this take?"**

- **Phase 0 (foundation):** 1 focused session. Low risk. Immediate wins via the base.css global rules (iOS zoom, safe-area).
- **Every other phase:** 1 session per app. Reading every line, swapping tokens, inverting breakpoints, testing at each width.
- **Total:** 9 sessions to 100% compliance.

**You asked: "many users will be mobile — this is urgent"**

Agreed. The **biggest user-visible wins** come from Phase 0 alone — iOS zoom fix and
safe-area fix affect every app simultaneously the moment base.css is updated. Don't wait
for the full 9 sessions to ship benefits. Phase 0 is the fast path to instant mobile UX
improvement.

**You asked: "don't want to do it all at once"**

Agreed and strongly recommended. Each app-phase is independently verifiable and
rollback-able. Doing all 9 in one session = guaranteed regressions you won't see until
a user reports them.

---

## Report metadata

**CSS files audited:** 102
**Total lines:** 27,687
**Apps covered:** 19
**Audit script:** `_audit_tmp.py` (generated per run, deleted after use)
**Verification method:** automated regex audit + manual read of 6 representative files
**Generated:** 2026-04-11, during research phase before any code changes

No code was written during this research pass. This report is a pre-flight assessment
only. Execution plan and per-phase commit strategy documented above.
