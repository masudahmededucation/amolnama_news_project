/* ====================================================================
   কলম / Book Reader page (owner preview) — entry IIFE.
   --------------------------------------------------------------------
   Drives the 3D leather-bound book in pages/book_reader.html:
     • Cover open / close (cover rotates 175° on the left hinge)
     • Page-flip animation per sheet (left-edge transform-origin)
     • Forward / back navigation via Prev / Next paper-tab buttons,
       arrow keys (← / →), and click on the right / left half of the
       open page area
     • Jump-to-page input (1-based, validated, animates intermediate
       flips at a faster tempo so the user sees pages flying by)
     • Esc closes the book

   No external network calls — pure client-side flip animation.
   No console.log / .debug / .info / .warn — only console.error inside
   .catch() if a future fetch is added.

   Class names follow the .bookwriter-book-reader-* prefix used by
   pages/page-book-reader.css so selectors here cannot collide with
   any other bookwriter page.
   ==================================================================== */
(function () {
  'use strict';

  var stageElement              = document.getElementById('bookwriter-book-reader-stage');
  if (stageElement === null) return;

  var coverElement              = document.getElementById('bookwriter-book-reader-cover');
  var pagesContainerElement     = document.getElementById('bookwriter-book-reader-pages');
  var prevButtonElement         = document.getElementById('bookwriter-book-reader-prev-button');
  var nextButtonElement         = document.getElementById('bookwriter-book-reader-next-button');
  var pageIndicatorElement      = document.getElementById('bookwriter-book-reader-page-indicator');
  var jumpInputElement          = document.getElementById('bookwriter-book-reader-jump-input');
  var jumpButtonElement         = document.getElementById('bookwriter-book-reader-jump-button');
  var jumpErrorElement          = document.getElementById('bookwriter-book-reader-jump-error');
  var controlsContainerElement  = document.getElementById('bookwriter-book-reader-controls');

  var allPageSheetElements = pagesContainerElement
    ? Array.prototype.slice.call(
        pagesContainerElement.querySelectorAll('.bookwriter-book-reader-page-sheet')
      )
    : [];
  var totalSheetCount  = allPageSheetElements.length;

  var STAGE_OPEN_CLASS_NAME      = 'bookwriter-book-reader-stage-open';
  var SHEET_FLIPPED_CLASS_NAME   = 'bookwriter-book-reader-page-sheet-flipped';
  var SHEET_TURNING_CLASS_NAME   = 'bookwriter-book-reader-page-sheet-turning';
  var CONTROLS_VISIBLE_CLASS     = 'bookwriter-book-reader-controls-visible';
  var JUMP_ERROR_VISIBLE_CLASS   = 'bookwriter-book-reader-jump-error-show';

  var COVER_FLIP_ANIMATION_MS    = 1400;
  var PAGE_FLIP_ANIMATION_MS     = 1300;
  var JUMP_ERROR_VISIBLE_MS      = 2200;

  /* ====================================================================
     Toggle: client-side measurement-based pagination ON/OFF.
     true  → after page load, the bookwriter-reader-client-side-paginator
             module re-paginates each chapter using actual rendered
             heights (image-aware, font-aware, accurate). Replaces the
             server pre-paginated chapter sheets with measurement-based
             ones. Frontispiece + colophon sheets stay as server-rendered.
     false → leave the server-pre-paginated sheets exactly as rendered.
             Word-count algorithm output (faster initial paint, but
             can squash chapters with images onto a single page).
     Set to false to fall back if the client paginator misbehaves.
     ==================================================================== */
  var ENABLE_CLIENT_SIDE_PAGINATION = true;

  var sheetsAlreadyTurnedCount = 0;
  var isCurrentlyAnimating     = false;
  var isBookCurrentlyOpen      = false;
  var pendingJumpErrorTimeout  = null;
  // Race guard: when a Next/Prev/jump click on a closed book queues
  // an auto-open + deferred-action via setTimeout, this flag stays
  // true until the deferred action runs. Subsequent clicks during
  // that window (cover-flip animation) are ignored — without this
  // a double-click would queue two deferred flips and turn 2 pages
  // on first interaction.
  var isPendingAutoActionAfterOpen = false;

  if (jumpInputElement && totalSheetCount > 0) {
    jumpInputElement.max = String(totalSheetCount);
  }

  function refreshPageIndicator() {
    if (pageIndicatorElement) {
      var displayCurrent = (sheetsAlreadyTurnedCount + 1);
      pageIndicatorElement.textContent =
        displayCurrent + ' / ' + totalSheetCount;
    }
    if (prevButtonElement) {
      prevButtonElement.disabled =
        sheetsAlreadyTurnedCount === 0 || isCurrentlyAnimating;
    }
    if (nextButtonElement) {
      nextButtonElement.disabled =
        sheetsAlreadyTurnedCount >= totalSheetCount - 1 || isCurrentlyAnimating;
    }
  }

  function showJumpErrorMessage(messageText) {
    if (!jumpErrorElement) return;
    jumpErrorElement.textContent = messageText;
    jumpErrorElement.classList.add(JUMP_ERROR_VISIBLE_CLASS);
    if (pendingJumpErrorTimeout !== null) {
      clearTimeout(pendingJumpErrorTimeout);
    }
    pendingJumpErrorTimeout = setTimeout(function () {
      jumpErrorElement.classList.remove(JUMP_ERROR_VISIBLE_CLASS);
    }, JUMP_ERROR_VISIBLE_MS);
  }

  function openTheBook() {
    if (isCurrentlyAnimating || isBookCurrentlyOpen) return;
    isCurrentlyAnimating = true;
    stageElement.classList.add(STAGE_OPEN_CLASS_NAME);
    if (controlsContainerElement) {
      controlsContainerElement.classList.add(CONTROLS_VISIBLE_CLASS);
    }
    // Make sure the cover starts visible (it might be hidden from a
    // previous close-and-reopen). The cover element only exists when
    // the page is the owner-preview reader; guard for safety.
    if (coverElement) {
      coverElement.style.visibility = 'visible';
    }
    isBookCurrentlyOpen = true;
    setTimeout(function () {
      isCurrentlyAnimating = false;
      refreshPageIndicator();
      // Once the open animation completes, hide the cover entirely.
      // Reason: inside the .stage's `transform-style: preserve-3d`
      // context, z-index alone can't keep flipped page sheets above
      // the cover's back face — they'd both occupy the same Z plane
      // and the cover (last in source order) would paint over the
      // pages. Visibility-hide removes the cover from rendering after
      // it's done flipping; closeTheBook restores it.
      if (coverElement) {
        coverElement.style.visibility = 'hidden';
      }
    }, COVER_FLIP_ANIMATION_MS);
    refreshPageIndicator();
  }

  function closeTheBook() {
    if (isCurrentlyAnimating) return;
    isCurrentlyAnimating = true;
    // Restore cover visibility BEFORE removing .stage-open so the
    // close-flip animation has a visible cover element to animate.
    if (coverElement) {
      coverElement.style.visibility = 'visible';
    }
    for (var resetSheetIndex = 0; resetSheetIndex < allPageSheetElements.length; resetSheetIndex++) {
      allPageSheetElements[resetSheetIndex].classList.remove(
        SHEET_FLIPPED_CLASS_NAME, SHEET_TURNING_CLASS_NAME,
      );
    }
    sheetsAlreadyTurnedCount = 0;
    setTimeout(function () {
      stageElement.classList.remove(STAGE_OPEN_CLASS_NAME);
      if (controlsContainerElement) {
        controlsContainerElement.classList.remove(CONTROLS_VISIBLE_CLASS);
      }
      isBookCurrentlyOpen = false;
      setTimeout(function () {
        isCurrentlyAnimating = false;
        refreshPageIndicator();
      }, COVER_FLIP_ANIMATION_MS);
    }, 400);
    refreshPageIndicator();
  }

  function turnToNextSheet() {
    if (isCurrentlyAnimating) return;
    // Closed book + Next click = JUST open the cover. No auto-flip.
    // Real book behaviour — open it first, then turn pages. Auto-
    // flipping queued a second animation that looked like a "two-
    // page turn" to the user (cover open + first page flip in
    // sequence). One animation per click is the right model.
    if (!isBookCurrentlyOpen) {
      openTheBook();
      return;
    }
    if (sheetsAlreadyTurnedCount >= totalSheetCount - 1) return;
    isCurrentlyAnimating = true;
    var sheetBeingTurned = allPageSheetElements[sheetsAlreadyTurnedCount];
    // Apply both classes in the SAME synchronous tick so the browser
    // composites the shade overlay AND the rotation start in the
    // same paint frame. The old pattern (add `turning`, then RAF →
    // add `flipped`) gave one paint cycle where the shade overlay
    // was visible but the rotation hadn't started yet — that's the
    // "jumpy snapshot" the user saw right before the page actually
    // turned. The CSS engine batches both class adds into one style
    // change and starts the transform transition immediately.
    sheetBeingTurned.classList.add(
      SHEET_TURNING_CLASS_NAME, SHEET_FLIPPED_CLASS_NAME,
    );
    setTimeout(function () {
      sheetBeingTurned.classList.remove(SHEET_TURNING_CLASS_NAME);
      isCurrentlyAnimating = false;
      refreshPageIndicator();
    }, PAGE_FLIP_ANIMATION_MS);
    sheetsAlreadyTurnedCount++;
    refreshPageIndicator();
  }

  function turnToPreviousSheet() {
    if (isCurrentlyAnimating) return;
    // Closed book + Prev click = JUST open the cover (same model as
    // turnToNextSheet — one animation per click).
    if (!isBookCurrentlyOpen) {
      openTheBook();
      return;
    }
    if (sheetsAlreadyTurnedCount === 0) return;
    isCurrentlyAnimating = true;
    sheetsAlreadyTurnedCount--;
    var sheetBeingTurned = allPageSheetElements[sheetsAlreadyTurnedCount];
    // Same single-frame application as turnToNextSheet — add `turning`
    // and remove `flipped` in the same paint cycle so we never see
    // a transient state where the shade is visible but the rotation
    // back hasn't started.
    sheetBeingTurned.classList.add(SHEET_TURNING_CLASS_NAME);
    sheetBeingTurned.classList.remove(SHEET_FLIPPED_CLASS_NAME);
    setTimeout(function () {
      sheetBeingTurned.classList.remove(SHEET_TURNING_CLASS_NAME);
      isCurrentlyAnimating = false;
      refreshPageIndicator();
    }, PAGE_FLIP_ANIMATION_MS);
    refreshPageIndicator();
  }

  function jumpToPageNumber(targetPageNumber) {
    if (isCurrentlyAnimating) return;
    // Auto-open the book if user typed a page number before opening
    // the cover. Defer the jump until after the cover-flip completes.
    if (!isBookCurrentlyOpen) {
      openTheBook();
      setTimeout(function () { jumpToPageNumber(targetPageNumber); },
                 COVER_FLIP_ANIMATION_MS + 60);
      return;
    }

    var isValidPageNumber = (
      typeof targetPageNumber === 'number'
      && Number.isInteger(targetPageNumber)
      && targetPageNumber >= 1
      && targetPageNumber <= totalSheetCount
    );
    if (!isValidPageNumber) {
      showJumpErrorMessage('Enter a number between 1 and ' + totalSheetCount);
      if (jumpInputElement) {
        jumpInputElement.focus();
        jumpInputElement.select();
      }
      return;
    }

    var targetSheetIndex = targetPageNumber - 1;
    if (targetSheetIndex === sheetsAlreadyTurnedCount) {
      showJumpErrorMessage('Already on that page');
      return;
    }

    isCurrentlyAnimating = true;
    refreshPageIndicator();

    var isMovingForward      = targetSheetIndex > sheetsAlreadyTurnedCount;
    var totalStepsToTake     = Math.abs(targetSheetIndex - sheetsAlreadyTurnedCount);
    var perStepDelayMs       = totalStepsToTake === 1
      ? PAGE_FLIP_ANIMATION_MS
      : Math.max(260, 600 - totalStepsToTake * 40);
    var perStepFlipDurationMs = totalStepsToTake === 1
      ? PAGE_FLIP_ANIMATION_MS
      : Math.max(500, 900 - totalStepsToTake * 30);

    if (totalStepsToTake > 1) {
      for (var speedupSheetIndex = 0; speedupSheetIndex < allPageSheetElements.length; speedupSheetIndex++) {
        allPageSheetElements[speedupSheetIndex].style.transition =
          'transform ' + perStepFlipDurationMs + 'ms cubic-bezier(0.55, 0.1, 0.35, 1)';
      }
    }

    var stepsTakenSoFar = 0;
    function performNextStep() {
      if (stepsTakenSoFar >= totalStepsToTake) {
        setTimeout(function () {
          for (var resetSheetIndex = 0; resetSheetIndex < allPageSheetElements.length; resetSheetIndex++) {
            allPageSheetElements[resetSheetIndex].style.transition = '';
            allPageSheetElements[resetSheetIndex].classList.remove(SHEET_TURNING_CLASS_NAME);
          }
          isCurrentlyAnimating = false;
          refreshPageIndicator();
        }, perStepFlipDurationMs);
        return;
      }
      if (isMovingForward) {
        var sheetToFlip = allPageSheetElements[sheetsAlreadyTurnedCount];
        sheetToFlip.classList.add(SHEET_TURNING_CLASS_NAME);
        requestAnimationFrame(function () {
          sheetToFlip.classList.add(SHEET_FLIPPED_CLASS_NAME);
        });
        sheetsAlreadyTurnedCount++;
      } else {
        sheetsAlreadyTurnedCount--;
        var sheetToUnflip = allPageSheetElements[sheetsAlreadyTurnedCount];
        sheetToUnflip.classList.add(SHEET_TURNING_CLASS_NAME);
        requestAnimationFrame(function () {
          sheetToUnflip.classList.remove(SHEET_FLIPPED_CLASS_NAME);
        });
      }
      if (pageIndicatorElement) {
        pageIndicatorElement.textContent =
          (sheetsAlreadyTurnedCount + 1) + ' / ' + totalSheetCount;
      }
      stepsTakenSoFar++;
      setTimeout(performNextStep, perStepDelayMs);
    }

    performNextStep();
  }

  function handleJumpButtonClick() {
    if (!jumpInputElement) return;
    var rawInputValue = jumpInputElement.value.trim();
    if (rawInputValue === '') {
      showJumpErrorMessage('Enter a page number');
      jumpInputElement.focus();
      return;
    }
    jumpToPageNumber(parseInt(rawInputValue, 10));
    jumpInputElement.value = '';
  }

  /* ---------- Wire up listeners ---------- */
  if (coverElement) {
    coverElement.addEventListener('click', function () {
      if (!isBookCurrentlyOpen) openTheBook();
    });
    coverElement.addEventListener('keydown', function (coverKeyEvent) {
      if (coverKeyEvent.key === 'Enter' || coverKeyEvent.key === ' ') {
        coverKeyEvent.preventDefault();
        if (!isBookCurrentlyOpen) openTheBook();
      }
    });
  }
  if (nextButtonElement) nextButtonElement.addEventListener('click', turnToNextSheet);
  if (prevButtonElement) prevButtonElement.addEventListener('click', turnToPreviousSheet);
  if (jumpButtonElement) jumpButtonElement.addEventListener('click', handleJumpButtonClick);
  if (jumpInputElement) {
    jumpInputElement.addEventListener('keydown', function (jumpKeyEvent) {
      if (jumpKeyEvent.key === 'Enter') {
        jumpKeyEvent.preventDefault();
        handleJumpButtonClick();
      }
      jumpKeyEvent.stopPropagation();
    });
  }

  /* Keyboard navigation — left/right arrows + Esc to close. */
  document.addEventListener('keydown', function (documentKeyEvent) {
    if (document.activeElement === jumpInputElement) return;
    if (!isBookCurrentlyOpen) {
      if (documentKeyEvent.key === 'Enter' || documentKeyEvent.key === ' ') {
        if (document.activeElement === coverElement) {
          documentKeyEvent.preventDefault();
          openTheBook();
        }
      }
      return;
    }
    if (documentKeyEvent.key === 'ArrowRight') turnToNextSheet();
    if (documentKeyEvent.key === 'ArrowLeft')  turnToPreviousSheet();
    if (documentKeyEvent.key === 'Escape')     closeTheBook();
  });

  /* Click on right half of stage = next, left half = prev — only when
     open and the click didn't land on cover, controls, or floating btns. */
  stageElement.addEventListener('click', function (stageClickEvent) {
    if (!isBookCurrentlyOpen || isCurrentlyAnimating) return;
    if (stageClickEvent.target.closest('.bookwriter-book-reader-cover')) return;
    if (stageClickEvent.target.closest('.bookwriter-book-reader-controls')) return;
    if (stageClickEvent.target.closest('.bookwriter-book-reader-floating-button')) return;
    var stageRect = stageElement.getBoundingClientRect();
    var clickXWithinStage = stageClickEvent.clientX - stageRect.left;
    if (clickXWithinStage > stageRect.width / 2) turnToNextSheet();
    else                                          turnToPreviousSheet();
  });

  refreshPageIndicator();

  /* ====================================================================
     Client-side measurement-based pagination — runs after page load
     when ENABLE_CLIENT_SIDE_PAGINATION is true. Uses the paginator
     module to re-paginate each chapter's raw HTML based on actual
     rendered heights, then replaces the server-pre-paginated chapter
     sheets in the DOM. Frontispiece + colophon sheets stay as
     server-rendered (their content never changes).

     Refreshes nav state (page indicator max, jump-input max, button
     disabled state) after the rebuild because the sheet count may
     differ from the server's word-count estimate.

     Falls back silently to server-rendered sheets if anything goes
     wrong (paginator module missing, JSON parse fails, etc.) — never
     leaves the user with a broken reader.
     ==================================================================== */
  function _rebuildChapterSheetsWithClientSidePaginator() {
    if (!ENABLE_CLIENT_SIDE_PAGINATION) return;
    if (!pagesContainerElement) return;

    var paginatorModule = window.bookwriterReaderClientSidePaginator;
    if (!paginatorModule
        || typeof paginatorModule.paginateAllChaptersAndBuildSheetsHtml !== 'function') {
      return;
    }

    var rawDataElement = document.getElementById(
      'bookwriter-book-reader-chapters-raw-html-data'
    );
    if (rawDataElement === null) return;

    var chaptersData;
    try {
      chaptersData = JSON.parse(rawDataElement.textContent);
    } catch (parseError) {
      console.error('bookwriter reader: parse chapters-raw-html-data', parseError);
      return;
    }
    if (!Array.isArray(chaptersData) || chaptersData.length === 0) return;

    paginatorModule.paginateAllChaptersAndBuildSheetsHtml(chaptersData)
      .then(function (paginationResult) {
        if (!paginationResult || !paginationResult.sheetsHtml) return;

        // Locate the colophon sheet — chapter sheets are inserted
        // BEFORE it. Frontispiece sheet is the first; chapter sheets
        // are everything between frontispiece and colophon.
        var frontispieceSheet = pagesContainerElement.querySelector(
          '[data-bookwriter-sheet-type="frontispiece"]'
        );
        var colophonSheet = pagesContainerElement.querySelector(
          '[data-bookwriter-sheet-type="colophon"]'
        );

        // Remove every existing chapter sheet (server-pre-paginated).
        var existingChapterSheets = pagesContainerElement.querySelectorAll(
          '[data-bookwriter-sheet-type="chapter"]'
        );
        for (var existingIndex = 0; existingIndex < existingChapterSheets.length; existingIndex++) {
          existingChapterSheets[existingIndex].parentNode.removeChild(
            existingChapterSheets[existingIndex]
          );
        }

        // Insert the new client-paginated chapter sheets between
        // frontispiece and colophon. Use insertAdjacentHTML for speed
        // (single innerHTML parse rather than per-sheet appendChild).
        var insertionAnchorNode = colophonSheet || null;
        if (insertionAnchorNode) {
          insertionAnchorNode.insertAdjacentHTML(
            'beforebegin', paginationResult.sheetsHtml,
          );
        } else if (frontispieceSheet) {
          frontispieceSheet.insertAdjacentHTML(
            'afterend', paginationResult.sheetsHtml,
          );
        } else {
          pagesContainerElement.insertAdjacentHTML(
            'beforeend', paginationResult.sheetsHtml,
          );
        }

        // Re-collect sheet element list + refresh nav state.
        allPageSheetElements = Array.prototype.slice.call(
          pagesContainerElement.querySelectorAll('.bookwriter-book-reader-page-sheet')
        );
        totalSheetCount = allPageSheetElements.length;
        if (jumpInputElement && totalSheetCount > 0) {
          jumpInputElement.max = String(totalSheetCount);
        }
        refreshPageIndicator();
      })
      .catch(function (paginationError) {
        console.error('bookwriter reader: client-side paginator failed', paginationError);
      });
  }

  _rebuildChapterSheetsWithClientSidePaginator();
})();
