/* ============================================================
   bookwriter-page-breaks.js
   Visual A4 page-break markers + page numbers across the
   chapter prose. Pure cosmetic — does NOT split content into
   real pages, does NOT change autosave format, does NOT
   affect cursor / selection / typing. Operates on any
   element opted-in via attachPageBreakOverlay() — currently
   the chapter prose and the full-screen focus text.

   Design intent (Option A from the editor pagination decision):
     - Writers want a sense of "page count" while writing.
     - Real pagination at the EDITING layer is an unworkable
       reflow problem (see app-bookwriter.txt for the analysis).
     - This module gives the visual marker without any of the
       reflow complexity. Real pagination happens at PDF / ePub
       export time, which is a separate concern.

   How it works:
     - For each opted-in prose element, append an absolutely-
       positioned overlay sibling that holds the markers.
     - Recompute markers on input + ResizeObserver (prose grew
       or font/line-height settled). Debounced 80ms.
     - One marker per page boundary: a thin horizontal hairline
       across the prose width, with a centered "page N" label.
     - Markers have pointer-events: none so they never intercept
       clicks / typing / image drag-drop.

   Opt-in:
     - attachPageBreakOverlay(proseElement) — call to enable.
     - The auto-attach loop wires .bookwriter-prose +
       .bookwriter-focus-text on DOMContentLoaded.
     - Public API: window.bookwriterPageBreaks.refresh() lets
       page-inkwell.js trigger a re-measure after a chapter
       switch (when prose.innerHTML is replaced wholesale).
   ============================================================ */
(function () {
  'use strict';

  /* A4 content-area height at 96dpi: page 297mm minus typical
     top+bottom margins (25mm each) -> 247mm = ~944px. Tuned
     against the .bookwriter-prose font (17px / line-height 1.75
     -> ~30px per line, ~31 lines per A4 page) which matches
     the standard ~250 words per A4 page reference. */
  var APPROX_A4_PAGE_HEIGHT_PX = 944;

  /* Debounce so rapid typing doesn't recompute on every keystroke.
     80ms = roughly two animation frames at 60fps; long enough to
     skip per-character work, short enough to feel instant. */
  var RECOMPUTE_DEBOUNCE_MS = 80;

  /* Idempotent flag — survives chapter switches because we set it
     on the prose element itself (which is preserved across
     innerHTML replacements; it's the parent we re-attach to). */
  var ATTACHED_FLAG_ATTRIBUTE = 'data-bookwriter-page-breaks-attached';

  function ensureProseIsPositioningContext(proseElement) {
    /* The marker overlay is position: absolute relative to the
       prose. If the prose isn't itself positioned, the overlay
       would resolve against the next ancestor and end up in the
       wrong place. Add position: relative if missing — this is
       a benign change (no visual effect on its own). */
    var computedPosition = window.getComputedStyle(proseElement).position;
    if (computedPosition === 'static') {
      proseElement.style.position = 'relative';
    }
  }

  function getOrCreatePageBreakOverlay(proseElement) {
    /* Only direct-child overlay — never grab a nested one (e.g.
       if prose contains a <blockquote> with its own overlay, we
       don't want to touch it). */
    var existingOverlay = proseElement.querySelector(':scope > .bookwriter-page-break-overlay');
    if (existingOverlay) return existingOverlay;
    var freshOverlay = document.createElement('div');
    freshOverlay.className = 'bookwriter-page-break-overlay';
    freshOverlay.setAttribute('aria-hidden', 'true');
    freshOverlay.setAttribute('contenteditable', 'false');
    /* Append as the LAST child so it sits over the text but
       its placement in DOM order doesn't disturb the contenteditable
       cursor (which lives among the text nodes / paragraphs). */
    proseElement.appendChild(freshOverlay);
    return freshOverlay;
  }

  function clearOverlayMarkers(overlay) {
    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
  }

  function buildPageBoundaryLine(pageBoundaryIndex) {
    /* Horizontal dashed separator with a centered "page break"
       label (same band style as the End-of-Chapter marker so
       both landmarks read consistently). The top-right pill
       still shows the page number; this label just names the
       boundary so the writer sees "this is where page X ends
       and page Y starts". */
    var lineWrapper = document.createElement('div');
    lineWrapper.className = 'bookwriter-page-break-marker';
    lineWrapper.style.top = (APPROX_A4_PAGE_HEIGHT_PX * pageBoundaryIndex) + 'px';
    var pageBreakLabel = document.createElement('span');
    pageBreakLabel.className = 'bookwriter-page-break-label';
    pageBreakLabel.textContent = 'page break';
    lineWrapper.appendChild(pageBreakLabel);
    return lineWrapper;
  }

  function buildPageNumberPill(pageIndex) {
    /* Small circled-number badge for each page. Sits in the
       manuscript margin (right of the prose) at the top of its
       page band. Just the number — no "Page" prefix — so the
       badge stays compact and unobtrusive. */
    var pillElement = document.createElement('div');
    pillElement.className = 'bookwriter-page-number-pill';
    pillElement.style.top = (APPROX_A4_PAGE_HEIGHT_PX * (pageIndex - 1) + 12) + 'px';
    pillElement.textContent = String(pageIndex);
    return pillElement;
  }

  function buildEndOfChapterMarker(topPx) {
    /* End-of-chapter marker — rendered at the actual content
       bottom (not at scrollHeight, so an empty chapter or
       padding-only height doesn't show one). Visually distinct
       from the page-boundary markers via the modifier class. */
    var endMarkerWrapper = document.createElement('div');
    endMarkerWrapper.className = 'bookwriter-page-break-marker bookwriter-end-chapter-marker';
    endMarkerWrapper.style.top = topPx + 'px';
    var endChapterLabel = document.createElement('span');
    endChapterLabel.className = 'bookwriter-page-break-label bookwriter-end-chapter-label';
    endChapterLabel.textContent = '— End of Chapter —';
    endMarkerWrapper.appendChild(endChapterLabel);
    return endMarkerWrapper;
  }

  function findLastContentBottomPxRelativeToProse(proseElement) {
    /* Walk children backwards looking for the last "real" child
       (skip our own overlay + ignore empty / collapsed nodes).
       Return the bottom edge of that child relative to the
       prose element's top. Returns 0 if no content found. */
    var proseTopY = proseElement.getBoundingClientRect().top;
    for (var childIndex = proseElement.children.length - 1; childIndex >= 0; childIndex--) {
      var lastChildCandidate = proseElement.children[childIndex];
      if (lastChildCandidate.classList && lastChildCandidate.classList.contains('bookwriter-page-break-overlay')) continue;
      var lastChildRect = lastChildCandidate.getBoundingClientRect();
      /* Empty <p><br></p> has near-zero height — treat as no
         content. ~12px floor weeds out a single placeholder line. */
      if (lastChildRect.height < 12) continue;
      return lastChildRect.bottom - proseTopY;
    }
    return 0;
  }

  function recomputePageBreakMarkers(proseElement) {
    var overlay = getOrCreatePageBreakOverlay(proseElement);
    /* scrollHeight = full content height including overflow.
       Use it (not clientHeight) so we count all content, not
       just what's currently visible in the viewport. */
    var totalContentHeightPx = proseElement.scrollHeight;
    var totalPageCount = Math.max(1, Math.ceil(totalContentHeightPx / APPROX_A4_PAGE_HEIGHT_PX));
    /* Expand the prose's min-height up to the next FULL A4 page
       boundary so the last page never appears half-empty. A
       1.5-page chapter renders as 2 full A4 pages — the writer
       sees the rest of the second page as blank writing space.
       This nudges the prose taller; we don't shrink it (chapters
       can grow during typing without ResizeObserver feedback
       loops). */
    var fullPageHeightPx = totalPageCount * APPROX_A4_PAGE_HEIGHT_PX;
    var currentMinHeightPx = parseFloat(proseElement.style.minHeight) || 0;
    if (currentMinHeightPx !== fullPageHeightPx) {
      proseElement.style.minHeight = fullPageHeightPx + 'px';
    }
    clearOverlayMarkers(overlay);
    /* Page number badges only — NO horizontal page-break line.
       Boundaries between pages are signalled by the badge
       incrementing in the right margin. The line was visually
       noisy wherever it fell because pixel-fixed boundaries
       always cross live text. */
    for (var pageIndex = 1; pageIndex <= totalPageCount; pageIndex++) {
      overlay.appendChild(buildPageNumberPill(pageIndex));
    }
    /* End-of-chapter marker — only when there's REAL typed
       content (not an empty <p><br></p> placeholder, not zero
       height because layout hasn't settled). The 30px floor is
       a sanity check; if the prose is tiny / not laid out yet,
       we skip the marker rather than render it at the top. */
    var lastContentBottomPx = findLastContentBottomPxRelativeToProse(proseElement);
    if (lastContentBottomPx > 60) {
      overlay.appendChild(buildEndOfChapterMarker(lastContentBottomPx + 24));
    }
  }

  function attachPageBreakOverlay(proseElement) {
    if (!proseElement) return;
    if (proseElement.getAttribute(ATTACHED_FLAG_ATTRIBUTE) === '1') {
      /* Already attached — just re-measure (e.g. chapter switch
         replaced the innerHTML and the height changed). */
      recomputePageBreakMarkers(proseElement);
      return;
    }
    proseElement.setAttribute(ATTACHED_FLAG_ATTRIBUTE, '1');
    ensureProseIsPositioningContext(proseElement);

    var debounceTimer = null;
    function scheduleRecompute() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        recomputePageBreakMarkers(proseElement);
      }, RECOMPUTE_DEBOUNCE_MS);
    }

    proseElement.addEventListener('input', scheduleRecompute);

    /* ResizeObserver fires when the prose's box size changes
       (font swap completes, image loads change layout, viewport
       resize cascades through). Falls back to window resize on
       browsers without ResizeObserver. */
    if (typeof ResizeObserver !== 'undefined') {
      try {
        var resizeObserver = new ResizeObserver(scheduleRecompute);
        resizeObserver.observe(proseElement);
      } catch (resizeObserverError) {
        window.addEventListener('resize', scheduleRecompute);
      }
    } else {
      window.addEventListener('resize', scheduleRecompute);
    }

    /* Initial compute — defer until layout settles. On a fresh
       page load, getBoundingClientRect can return early / wrong
       values before fonts swap and the prose paints. Two
       requestAnimationFrames give the browser a chance to lay
       out the prose; the window 'load' event covers webfont
       swap. Without these, the End-of-Chapter marker sometimes
       landed at the TOP of the chapter on initial paint
       because the last paragraph hadn't been measured yet. */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        recomputePageBreakMarkers(proseElement);
      });
    });
    if (document.readyState !== 'complete') {
      window.addEventListener('load', function () {
        recomputePageBreakMarkers(proseElement);
      });
    }
  }

  function attachToAllOptedInProseElements() {
    /* Default targets: the chapter prose and the full-screen focus
       text. Any other writing surface can opt-in by calling
       window.bookwriterPageBreaks.attach(element) directly. */
    var optedInProseElements = document.querySelectorAll('.bookwriter-prose, .bookwriter-focus-text');
    optedInProseElements.forEach(attachPageBreakOverlay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachToAllOptedInProseElements);
  } else {
    attachToAllOptedInProseElements();
  }

  /* Public API — page-inkwell.js calls refresh() after a chapter
     switch (which sets prose.innerHTML wholesale; the per-element
     ResizeObserver should catch the size change but a manual nudge
     guarantees the markers update in the same paint frame). */
  window.bookwriterPageBreaks = {
    attach: attachPageBreakOverlay,
    refresh: attachToAllOptedInProseElements,
  };
})();
