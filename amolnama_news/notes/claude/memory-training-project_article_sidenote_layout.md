---
name: Article view — sidenote/margin data layout
description: Two-column article layout with paragraph-level metadata (dates, places, people, keywords) on left and content on right. NYT/Economist style. Discussed 2026-03-23.
type: project
---

User wants premium editorial layout for news articles — "Sidenote" or "Margin Data" architecture like NYT/Economist/Bloomberg.

**Layout:**
- Left column: key dates, places, people, amounts — synced per paragraph
- Right column: headline + article body paragraphs
- Mobile: stacked (metadata above paragraph)
- Sticky metadata for long paragraphs

**Why:** Professional editorial presentation. Makes structured investigation data (already collected in multistep forms) visible alongside the narrative.

**How to apply:** Two implementation phases.

**Phase 1 — Use existing structured data (no new tables):**
We already collect dates, locations, actors, amounts in the multistep form. The article view can display this data in the left column without paragraph-level linking. Simple but effective — one metadata block for the whole article.

**Phase 2 — Paragraph-level entity linking (new tables needed):**
- `[news].[article_content]` — stores paragraphs with order
- `[news].[article_metadata]` — links entities (date, place, person, keyword) to specific paragraphs
- Split article body into paragraphs at save time or render time
- Auto-extraction possible later with regex (dates, Bengali place names, amounts)
- Manual tagging via editor UI

**Gemini's suggestion (saved as reference):**
- CSS Grid: `grid-template-columns: 250px 1fr` for two-column
- `prefetch_related('paragraphs__metadata_set')` for single DB hit
- `position: sticky; top: 20px` for long paragraphs
- Color coding: blue=places, green=dates, bold=people
- Responsive: stack on mobile `@media (max-width: 768px)`

**Decision:** Park for now. Build Phase 1 first (use existing form data). Phase 2 when editorial workflow is established.
