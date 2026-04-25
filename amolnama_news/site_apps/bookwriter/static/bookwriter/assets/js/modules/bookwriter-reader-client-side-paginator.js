/* ====================================================================
   কলম / Book Reader — client-side measurement-based paginator
   --------------------------------------------------------------------
   Replaces the server-side word-count pagination (which can't model
   visual height — an <img> takes ~50% of the page visually but
   contributes 0 words). This module measures actual rendered heights
   in a hidden ghost element at the same width / font / line-height
   as the real page-face, splits chapters at the exact boundary where
   they overflow, and returns sheet HTML strings ready for DOM
   insertion.

   Public API (attached to window):
     window.bookwriterReaderClientSidePaginator = {
       paginateAllChaptersAndBuildSheetsHtml(chaptersData, options),
       buildSheetHtmlString(sheetData),
     }

   `chaptersData` shape (matches the JSON island the view emits):
     [{
       chapter_number: 1,
       chapter_title: 'Chapter One',
       chapter_html: '<p>...</p><img src="..."/><p>...</p>'
     }, ...]

   Returns a Promise resolving to an array of sheet objects ready to
   render via buildSheetHtmlString:
     [{
       chapter_number: 1,
       chapter_title: 'Chapter One',
       is_chapter_start_on_front: true,
       front_html: '...',
       back_html: '...',
       has_back_content: true,
       front_page_label: 1,
       back_page_label: 2,
     }, ...]

   The page-book-reader.js entry IIFE invokes this when its
   ENABLE_CLIENT_SIDE_PAGINATION toggle is true; otherwise the
   server-pre-paginated sheets stay as rendered.

   No external dependencies. No console.log/.debug/.info/.warn.
   No alert/confirm/prompt.
   ==================================================================== */
(function () {
  'use strict';

  if (typeof window.bookwriterReaderClientSidePaginator === 'object'
      && window.bookwriterReaderClientSidePaginator !== null) {
    // Already loaded (script included twice). Stay idempotent.
    return;
  }

  // Match the actual page-face content area exactly so heights measured
  // in the ghost match what they will be when rendered for real.
  // Source of truth: page-book-reader.css `.bookwriter-book-reader-page-front`
  //   width  = book-width 640 - padding-left 65 - padding-right 65 = 510
  //   height = book-height 860 - padding-top 55 - padding-bottom 160 = 645
  // If the CSS padding values change, update these constants too.
  var DEFAULT_PAGE_FACE_CONTENT_WIDTH_PX  = 510;
  var DEFAULT_PAGE_FACE_CONTENT_HEIGHT_PX = 645;
  var DEFAULT_PAGE_FACE_FONT_FAMILY       = "'Noto Serif Bengali', 'Cormorant Garamond', serif";
  // Body uses clamp(--text-base, 2.2vw, --text-xl). At ~1280px viewport
  // the clamp settles around 18-20px; at narrower widths it shrinks.
  // We use 18px as a safe default — close enough that pagination splits
  // are accurate (off by 1 line at most on narrow viewports).
  var DEFAULT_PAGE_FACE_FONT_SIZE_PX      = 18;
  var DEFAULT_PAGE_FACE_LINE_HEIGHT       = 1.95;

  /* ----------------------------------------------------------------
     Ghost measurer — a hidden DOM element styled to match the real
     page-face content area. Append child nodes to it and read
     scrollHeight to know if they fit.
  ---------------------------------------------------------------- */
  function _createGhostMeasurer(options) {
    var ghostElement = document.createElement('div');
    ghostElement.className = 'bookwriter-book-reader-client-paginator-ghost';
    ghostElement.style.width            = options.contentWidthPx  + 'px';
    ghostElement.style.position         = 'absolute';
    ghostElement.style.top              = '-99999px';
    ghostElement.style.left             = '-99999px';
    ghostElement.style.visibility       = 'hidden';
    ghostElement.style.pointerEvents    = 'none';
    ghostElement.style.boxSizing        = 'content-box';
    ghostElement.style.fontFamily       = options.fontFamily;
    ghostElement.style.fontSize         = options.fontSizePx + 'px';
    ghostElement.style.lineHeight       = String(options.lineHeight);
    ghostElement.style.fontWeight       = '500';
    ghostElement.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ghostElement);
    return ghostElement;
  }

  /* ----------------------------------------------------------------
     Wait for fonts (so text widths are stable) + every <img> in the
     ghost (so image heights are known). Without this, scrollHeight
     readings happen before assets load and pagination splits land
     in the wrong place.
  ---------------------------------------------------------------- */
  function _waitForFontsAndImagesInGhost(ghostElement) {
    var fontsReadyPromise = (
      document.fonts && typeof document.fonts.ready !== 'undefined'
    ) ? document.fonts.ready : Promise.resolve();

    var imageReadyPromises = [];
    var ghostImages = ghostElement.querySelectorAll('img');
    for (var imgIndex = 0; imgIndex < ghostImages.length; imgIndex++) {
      (function (imageElement) {
        if (imageElement.complete && imageElement.naturalHeight !== 0) {
          imageReadyPromises.push(Promise.resolve());
          return;
        }
        imageReadyPromises.push(new Promise(function (resolveImageReady) {
          var settled = false;
          function _settle() {
            if (settled) return;
            settled = true;
            resolveImageReady();
          }
          imageElement.addEventListener('load',  _settle, { once: true });
          imageElement.addEventListener('error', _settle, { once: true });
          // Hard timeout so a broken image src doesn't block pagination
          // forever. 3s is enough for any real image; broken ones
          // resolve here and pagination uses 0 height for them.
          setTimeout(_settle, 3000);
        }));
      })(ghostImages[imgIndex]);
    }
    return Promise.all([fontsReadyPromise].concat(imageReadyPromises));
  }

  /* ----------------------------------------------------------------
     Sentence-boundary split for the edge case where a single block
     element (usually a <p>) is taller than a full page on its own.
     Splits the inner HTML at sentence-end punctuation followed by
     whitespace, returning an array of substring chunks. Preserves
     the punctuation. Best-effort: doesn't understand abbreviations
     (Mr., Dr., etc.) but for prose-heavy chapters this is fine.
     Bengali sentence-end punctuation `।` (U+0964 DEVANAGARI DANDA) is
     included alongside `.!?` so a Bengali paragraph splits at the
     same natural sentence boundaries an English paragraph does.
  ---------------------------------------------------------------- */
  function _splitInnerHtmlAtSentenceBoundaries(innerHtmlString) {
    if (!innerHtmlString) return [''];
    // Split after . ! ? । followed by whitespace. Lookbehind keeps
    // the punctuation attached to the preceding sentence.
    var sentenceChunks = innerHtmlString.split(/(?<=[.!?।])\s+/);
    if (sentenceChunks.length === 0) return [innerHtmlString];
    return sentenceChunks;
  }

  /* ----------------------------------------------------------------
     Core paginator — walks the ghost's already-loaded child nodes,
     moving them one-by-one and measuring scrollHeight after each
     append. Crucially uses the ORIGINAL ghost nodes (not clones from
     a fresh innerHTML parse) so images that were already loaded by
     `_waitForFontsAndImagesInGhost` retain their natural dimensions
     during measurement. Cloning + re-parsing creates new <img>
     elements whose naturalHeight is 0 until the load event fires,
     which made scrollHeight measurements wrong and silently dropped
     content (the parrot-disappearing bug).
  ---------------------------------------------------------------- */
  function _paginateGhostChildrenIntoPages(ghostElement, pageHeightPx) {
    // Snapshot the children, then clear ghost to start measurement
    // from empty state. The snapshotted nodes still hold their
    // already-loaded image data (browser keeps the elements alive).
    var topLevelChildNodes = Array.prototype.slice.call(ghostElement.childNodes);
    ghostElement.innerHTML = '';

    var paginatedPagesHtml = [];

    for (var nodeIndex = 0; nodeIndex < topLevelChildNodes.length; nodeIndex++) {
      var nodeBeingMeasured = topLevelChildNodes[nodeIndex];
      // Skip pure-whitespace text nodes between elements.
      if (nodeBeingMeasured.nodeType === 3
          && !nodeBeingMeasured.nodeValue.replace(/\s+/g, '').length) {
        continue;
      }

      // MOVE the original node into the ghost (not a clone). Image
      // dimensions are preserved.
      ghostElement.appendChild(nodeBeingMeasured);

      if (ghostElement.scrollHeight <= pageHeightPx) {
        // Fits — leave node in ghost and continue.
        continue;
      }

      // Did not fit. Two sub-cases.
      ghostElement.removeChild(nodeBeingMeasured);

      var ghostHasContent = (
        ghostElement.children.length > 0
        || ghostElement.innerHTML.trim().length > 0
      );

      if (ghostHasContent) {
        // sub-case (a): flush prior content as a page, retry node on
        // a fresh empty page.
        paginatedPagesHtml.push(ghostElement.innerHTML);
        ghostElement.innerHTML = '';
        ghostElement.appendChild(nodeBeingMeasured);

        if (ghostElement.scrollHeight <= pageHeightPx) {
          // Fits on fresh page — continue.
          continue;
        }
        // Falls through to sub-case (b): node alone exceeds page.
      }
      // (If ghostHasContent was false, the node is already removed
      // and ghost is empty — we land here with the node detached.)

      // sub-case (b): the block alone is taller than the page.
      var isParagraphLike = (
        nodeBeingMeasured.nodeType === 1
        && (nodeBeingMeasured.tagName === 'P' || nodeBeingMeasured.tagName === 'BLOCKQUOTE')
      );

      if (!isParagraphLike) {
        // Non-text block (image, etc.) taller than a page. Put it on
        // its OWN page (CSS overflow:hidden clips the bottom). Critical:
        // re-attach the node to the ghost first so it's actually
        // included in the flushed HTML — the original code dropped the
        // image here (the parrot-disappearing bug). Then push and reset.
        if (!ghostElement.contains(nodeBeingMeasured)) {
          ghostElement.appendChild(nodeBeingMeasured);
        }
        paginatedPagesHtml.push(ghostElement.innerHTML);
        ghostElement.innerHTML = '';
        continue;
      }

      // Sentence-split paragraph: build a working <p> sentence-by-
      // sentence and flush whenever it overflows.
      // CRITICAL: remove the original full paragraph from the ghost
      // before appending the working clone. Reaching this branch via
      // the `ghostHasContent` path above leaves nodeBeingMeasured
      // attached to ghost (it was re-appended on a fresh page after
      // the prior-content flush). If we then append workingParagraph
      // alongside, ghost ends up with BOTH — and the next sentence
      // measurement immediately overflows, pushing the full original
      // paragraph as one page AND emitting sentence-split copies after,
      // duplicating the same prose across multiple pages.
      if (ghostElement.contains(nodeBeingMeasured)) {
        ghostElement.removeChild(nodeBeingMeasured);
      }
      var originalInnerHtml = nodeBeingMeasured.innerHTML;
      var sentenceChunks = _splitInnerHtmlAtSentenceBoundaries(originalInnerHtml);

      var workingParagraph = nodeBeingMeasured.cloneNode(false);  // empty clone with same attrs
      workingParagraph.innerHTML = '';
      ghostElement.appendChild(workingParagraph);

      for (var sentenceIndex = 0; sentenceIndex < sentenceChunks.length; sentenceIndex++) {
        var sentenceText = sentenceChunks[sentenceIndex];
        var contentBeforeSentence = workingParagraph.innerHTML;
        workingParagraph.innerHTML = (
          contentBeforeSentence
            ? contentBeforeSentence + ' ' + sentenceText
            : sentenceText
        );

        if (ghostElement.scrollHeight > pageHeightPx) {
          // Roll back, flush page, start fresh paragraph with the
          // overflowing sentence.
          workingParagraph.innerHTML = contentBeforeSentence;
          paginatedPagesHtml.push(ghostElement.innerHTML);
          ghostElement.innerHTML = '';
          workingParagraph = nodeBeingMeasured.cloneNode(false);
          workingParagraph.innerHTML = sentenceText;
          ghostElement.appendChild(workingParagraph);
        }
      }
    }

    // Flush any remaining content as the last page.
    if (ghostElement.innerHTML.trim().length > 0) {
      paginatedPagesHtml.push(ghostElement.innerHTML);
    }

    return paginatedPagesHtml.length > 0 ? paginatedPagesHtml : [''];
  }

  /* ----------------------------------------------------------------
     Pack each chapter's pages onto sheets (front + back, two faces
     per sheet) and assign running arabic page numbers. Mirrors the
     server-side `pack_chapter_pages_into_book_sheets` exactly so
     either path produces the same sheet shape.
  ---------------------------------------------------------------- */
  function _packChapterPagesIntoSheetData(chaptersWithPaginatedPages) {
    var bookSheetsList = [];
    var runningPageNumber = 0;

    for (var chapterIndex = 0; chapterIndex < chaptersWithPaginatedPages.length; chapterIndex++) {
      var chapterWithPages = chaptersWithPaginatedPages[chapterIndex];
      var chapterPagesHtml = chapterWithPages.pagesHtmlList;

      for (var sheetIndexInChapter = 0; sheetIndexInChapter < chapterPagesHtml.length; sheetIndexInChapter += 2) {
        var frontPageHtml = chapterPagesHtml[sheetIndexInChapter];
        var hasBackContent = (sheetIndexInChapter + 1) < chapterPagesHtml.length;
        var backPageHtml = hasBackContent ? chapterPagesHtml[sheetIndexInChapter + 1] : '';

        runningPageNumber += 1;
        var frontPageLabel = runningPageNumber;
        var backPageLabel = '';
        if (hasBackContent) {
          runningPageNumber += 1;
          backPageLabel = runningPageNumber;
        }

        bookSheetsList.push({
          chapter_number: chapterWithPages.chapterNumber,
          chapter_title:  chapterWithPages.chapterTitle,
          is_chapter_start_on_front: sheetIndexInChapter === 0,
          front_html: frontPageHtml,
          back_html:  backPageHtml,
          has_back_content: hasBackContent,
          front_page_label: frontPageLabel,
          back_page_label:  backPageLabel,
        });
      }
    }

    return bookSheetsList;
  }

  /* ----------------------------------------------------------------
     Escape text for safe insertion into HTML attributes / text content.
  ---------------------------------------------------------------- */
  function _escapeHtmlText(rawText) {
    if (rawText === null || typeof rawText === 'undefined') return '';
    return String(rawText)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ----------------------------------------------------------------
     Build the HTML string for one sheet — must match the server-side
     template exactly so the existing CSS works without changes.
  ---------------------------------------------------------------- */
  function buildSheetHtmlString(sheetData) {
    var chapterTitleHtmlSafe = _escapeHtmlText(sheetData.chapter_title);
    var runningHeaderText = 'Chapter ' + sheetData.chapter_number
      + ' · ' + chapterTitleHtmlSafe;

    var frontFaceParts = [
      '<div class="bookwriter-book-reader-page-face bookwriter-book-reader-page-front">',
        '<div class="bookwriter-book-reader-binding-shadow" aria-hidden="true"></div>',
    ];
    if (sheetData.is_chapter_start_on_front) {
      // Chapter opening page: kicker on line 1, title on line 2.
      // No running header here — would duplicate the same info.
      frontFaceParts.push(
        '<div class="bookwriter-book-reader-chapter-number-kicker">Chapter ',
          sheetData.chapter_number,
        '</div>',
        '<h2 class="bookwriter-book-reader-chapter-title">', chapterTitleHtmlSafe, '</h2>',
      );
    } else {
      // Continuation page: running header at top, body below.
      frontFaceParts.push(
        '<div class="bookwriter-book-reader-running-header">', runningHeaderText, '</div>',
      );
    }
    frontFaceParts.push(
      '<div class="bookwriter-book-reader-chapter-body">', sheetData.front_html, '</div>',
      '<div class="bookwriter-book-reader-folio" aria-hidden="true">',
        sheetData.front_page_label,
      '</div>',
      '</div>',  // close .page-front
    );

    var backFaceParts = [
      '<div class="bookwriter-book-reader-page-face bookwriter-book-reader-page-back">',
        '<div class="bookwriter-book-reader-binding-shadow bookwriter-book-reader-binding-shadow-mirrored" aria-hidden="true"></div>',
    ];
    if (sheetData.has_back_content) {
      backFaceParts.push(
        '<div class="bookwriter-book-reader-running-header">', runningHeaderText, '</div>',
        '<div class="bookwriter-book-reader-chapter-body">', sheetData.back_html, '</div>',
        '<div class="bookwriter-book-reader-folio" aria-hidden="true">',
          sheetData.back_page_label,
        '</div>',
      );
    }
    backFaceParts.push('</div>');  // close .page-back

    return ''
      + '<div class="bookwriter-book-reader-page-sheet"'
        + ' data-bookwriter-sheet-type="chapter"'
        + ' data-bookwriter-sheet-source="client-paginator">'
      + frontFaceParts.join('')
      + backFaceParts.join('')
      + '<div class="bookwriter-book-reader-page-shade" aria-hidden="true"></div>'
      + '</div>';
  }

  /* ----------------------------------------------------------------
     Public entry — paginate every chapter, build sheet data + HTML.
     Returns Promise<{ sheetsData, sheetsHtml }>:
       sheetsData = array of sheet objects (for the page indicator etc.)
       sheetsHtml = single concatenated HTML string ready for innerHTML
  ---------------------------------------------------------------- */
  function paginateAllChaptersAndBuildSheetsHtml(chaptersData, options) {
    options = options || {};
    var pageFaceContentWidthPx  = options.contentWidthPx  || DEFAULT_PAGE_FACE_CONTENT_WIDTH_PX;
    var pageFaceContentHeightPx = options.contentHeightPx || DEFAULT_PAGE_FACE_CONTENT_HEIGHT_PX;
    var fontFamily              = options.fontFamily      || DEFAULT_PAGE_FACE_FONT_FAMILY;
    var fontSizePx              = options.fontSizePx      || DEFAULT_PAGE_FACE_FONT_SIZE_PX;
    var lineHeight              = options.lineHeight      || DEFAULT_PAGE_FACE_LINE_HEIGHT;

    var ghostElement = _createGhostMeasurer({
      contentWidthPx: pageFaceContentWidthPx,
      fontFamily:     fontFamily,
      fontSizePx:     fontSizePx,
      lineHeight:     lineHeight,
    });

    // Per-chapter sequential pagination: load THIS chapter's HTML
    // into the ghost, await its fonts+images, paginate using the
    // already-loaded ghost children. Done sequentially via a Promise
    // chain so each chapter's images are guaranteed loaded (with
    // their natural dimensions known) before measurement.
    var chaptersWithPaginatedPages = [];

    function _paginateOneChapterSequentially(chapterIndex) {
      if (chapterIndex >= chaptersData.length) {
        return Promise.resolve();
      }
      var chapter = chaptersData[chapterIndex];
      ghostElement.innerHTML = chapter.chapter_html || '';
      return _waitForFontsAndImagesInGhost(ghostElement).then(function () {
        var paginatedPages = _paginateGhostChildrenIntoPages(
          ghostElement, pageFaceContentHeightPx,
        );
        chaptersWithPaginatedPages.push({
          chapterNumber: chapter.chapter_number,
          chapterTitle:  chapter.chapter_title,
          pagesHtmlList: paginatedPages,
        });
        return _paginateOneChapterSequentially(chapterIndex + 1);
      });
    }

    return _paginateOneChapterSequentially(0).then(function () {
      var packedSheetsData = _packChapterPagesIntoSheetData(chaptersWithPaginatedPages);
      var concatenatedSheetsHtml = '';
      for (var sheetBuildIndex = 0; sheetBuildIndex < packedSheetsData.length; sheetBuildIndex++) {
        concatenatedSheetsHtml += buildSheetHtmlString(packedSheetsData[sheetBuildIndex]);
      }

      if (ghostElement.parentNode) {
        ghostElement.parentNode.removeChild(ghostElement);
      }

      return {
        sheetsData: packedSheetsData,
        sheetsHtml: concatenatedSheetsHtml,
      };
    });
  }

  window.bookwriterReaderClientSidePaginator = {
    paginateAllChaptersAndBuildSheetsHtml: paginateAllChaptersAndBuildSheetsHtml,
    buildSheetHtmlString:                  buildSheetHtmlString,
  };
})();
