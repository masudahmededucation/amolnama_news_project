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
  var tocShortcutButtonElement  = document.getElementById('bookwriter-book-reader-toc-shortcut-button');
  var jumpErrorElement          = document.getElementById('bookwriter-book-reader-jump-error');
  var controlsContainerElement  = document.getElementById('bookwriter-book-reader-controls');
  var chapterPageIndicatorElement = document.getElementById('bookwriter-book-reader-chapter-page-indicator');

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

     DEFAULT IS FALSE — the server-side word-count pagination is the
     proven path that has been shipping. The client-side measurement
     paginator ships disabled by default so a fresh page load always
     renders predictable sheets; flip this to `true` to opt into the
     experimental measurement-based path (gives more visually accurate
     page splits when chapters contain images, but the path is newer
     and less battle-tested). Both code paths are kept in tree so the
     toggle is the only switch — no code change needed to compare.
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

  /* ====================================================================
     Per-sheet z-index ladder — sets a CSS custom property on every
     sheet so the deterministic-z-index rules in page-book-reader.css
     can compute a unique z-index for each sheet via calc().

     Why a custom property (not inline z-index): inline z-index would
     trump the .turning.flipped lift used by the page-flip animation.
     The custom property only feeds calc() inside CSS rules whose
     specificity is the same as the legacy nth-child rules — so the
     animation overrides keep working unchanged.

     Why position-from-top (not array index alone): the variable must
     match the DOM source order at the time CSS reads it, including
     after the client paginator replaces chapter sheets and after the
     standalone colophon is removed. So this function is called from
     EVERY code path that mutates the sheet list (initial load + after
     paginator + after colophon-inline).

     Without this function, the [style*="--bookwriter-reader-..."] CSS
     selector matches nothing → the page falls back to the legacy
     :nth-child ladder, which collapses every sheet past nth-child(10)
     to z-index 40 (the chapter-8-paints-over-chapter-4 bug).
     ==================================================================== */
  function _applyDeterministicZIndexLadderToAllSheets() {
    if (!pagesContainerElement) return;
    var allSheetsForLadder = pagesContainerElement.querySelectorAll(
      '.bookwriter-book-reader-page-sheet'
    );
    for (var sheetLadderIndex = 0; sheetLadderIndex < allSheetsForLadder.length; sheetLadderIndex++) {
      allSheetsForLadder[sheetLadderIndex].style.setProperty(
        '--bookwriter-reader-sheet-position-from-top',
        String(sheetLadderIndex + 1),
      );
    }
  }

  // Apply once at IIFE start so the server-rendered initial sheets get
  // the correct z-index BEFORE the user opens the cover. The client
  // paginator + colophon-inline paths call this again after they
  // mutate the sheet list (see _rebuildChapterSheetsWithClientSidePaginator).
  _applyDeterministicZIndexLadderToAllSheets();

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
    _refreshChapterPageIndicator();
  }

  /* Per-chapter page indicator: "X of Y" where X is the current sheet's
     1-based position WITHIN ITS CHAPTER and Y is the total sheet count
     for that chapter. Hidden when the current sheet has no chapter
     number (frontispiece) or when chapterPageIndicatorElement isn't on
     the page. The chapter number is read from the sheet's
     data-bookwriter-sheet-chapter-number attribute (set by the Django
     template AND by the client paginator's buildSheetHtmlString). */
  function _refreshChapterPageIndicator() {
    if (!chapterPageIndicatorElement) return;
    var currentSheetElement = allPageSheetElements[sheetsAlreadyTurnedCount];
    if (!currentSheetElement) {
      chapterPageIndicatorElement.hidden = true;
      return;
    }
    var currentChapterNumberRaw = currentSheetElement.getAttribute(
      'data-bookwriter-sheet-chapter-number'
    );
    if (!currentChapterNumberRaw) {
      // Non-chapter sheet (frontispiece) — hide the indicator.
      chapterPageIndicatorElement.hidden = true;
      return;
    }
    // Find every sheet in the same chapter and the current sheet's
    // 1-based position among them.
    var sheetsInThisChapterCount = 0;
    var currentPositionWithinChapter = 0;
    for (var siblingIdx = 0; siblingIdx < allPageSheetElements.length; siblingIdx++) {
      if (allPageSheetElements[siblingIdx].getAttribute(
            'data-bookwriter-sheet-chapter-number'
          ) === currentChapterNumberRaw) {
        sheetsInThisChapterCount++;
        if (siblingIdx === sheetsAlreadyTurnedCount) {
          currentPositionWithinChapter = sheetsInThisChapterCount;
        }
      }
    }
    if (sheetsInThisChapterCount <= 0 || currentPositionWithinChapter <= 0) {
      chapterPageIndicatorElement.hidden = true;
      return;
    }
    chapterPageIndicatorElement.textContent =
      currentPositionWithinChapter + ' of ' + sheetsInThisChapterCount;
    chapterPageIndicatorElement.hidden = false;
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
    // Plain synchronous classList add — back to baseline. The various
    // RAF / setTimeout / force-reflow / Z-stagger / contain / opacity
    // experiments to fix the Chrome jumpy snapshot DID NOT WORK and
    // some made the visual worse. Until a real fix is identified, we
    // revert to the simplest path so we don't pile on artifacts.
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
    // Plain synchronous class manipulation — reverted to baseline.
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

    var isMovingForward  = targetSheetIndex > sheetsAlreadyTurnedCount;
    var totalStepsToTake = Math.abs(targetSheetIndex - sheetsAlreadyTurnedCount);

    // Single-step jump = a regular Next/Prev turn (one animation).
    if (totalStepsToTake === 1) {
      if (isMovingForward) turnToNextSheet();
      else                 turnToPreviousSheet();
      return;
    }

    // Multi-step jump — ONE animation total.
    // Snap every intermediate sheet to its target state instantly
    // (transitions disabled, so no per-sheet flip is visible), then
    // animate ONLY the final hop. Matches the Kindle / iBooks model:
    // dragging the slider to a remote page does NOT play every page-
    // turn between source and target.
    isCurrentlyAnimating = true;

    // Disable transitions on every sheet so the snap is instantaneous.
    for (var disableTransitionIdx = 0; disableTransitionIdx < allPageSheetElements.length; disableTransitionIdx++) {
      allPageSheetElements[disableTransitionIdx].style.transition = 'none';
    }

    if (isMovingForward) {
      // Forward: snap sheets [current..target-2] to FLIPPED, leave
      // sheet (target-1) unflipped so we can animate it next.
      for (var snapForwardIdx = sheetsAlreadyTurnedCount; snapForwardIdx <= targetSheetIndex - 2; snapForwardIdx++) {
        allPageSheetElements[snapForwardIdx].classList.add(SHEET_FLIPPED_CLASS_NAME);
      }
    } else {
      // Backward: snap sheets [target+1..current-1] to UNFLIPPED,
      // leave sheet target still flipped so we can animate it next.
      for (var snapBackwardIdx = sheetsAlreadyTurnedCount - 1; snapBackwardIdx > targetSheetIndex; snapBackwardIdx--) {
        allPageSheetElements[snapBackwardIdx].classList.remove(SHEET_FLIPPED_CLASS_NAME);
      }
    }

    // Force a layout flush so the snap classes commit before we
    // re-enable transitions — without this, the browser may batch the
    // snap + the next class change into one animated transition,
    // causing all intermediate sheets to play their flips after all.
    void pagesContainerElement.offsetWidth;

    // Re-enable transitions so the FINAL hop animates normally.
    for (var enableTransitionIdx = 0; enableTransitionIdx < allPageSheetElements.length; enableTransitionIdx++) {
      allPageSheetElements[enableTransitionIdx].style.transition = '';
    }

    var finalSheetElement;
    if (isMovingForward) {
      // Animate sheet (target-1) flipping.
      finalSheetElement = allPageSheetElements[targetSheetIndex - 1];
      finalSheetElement.classList.add(SHEET_TURNING_CLASS_NAME);
      requestAnimationFrame(function () {
        finalSheetElement.classList.add(SHEET_FLIPPED_CLASS_NAME);
      });
      sheetsAlreadyTurnedCount = targetSheetIndex;
    } else {
      // Animate sheet target unflipping (it's still in the flipped state).
      finalSheetElement = allPageSheetElements[targetSheetIndex];
      finalSheetElement.classList.add(SHEET_TURNING_CLASS_NAME);
      requestAnimationFrame(function () {
        finalSheetElement.classList.remove(SHEET_FLIPPED_CLASS_NAME);
      });
      sheetsAlreadyTurnedCount = targetSheetIndex;
    }

    refreshPageIndicator();

    setTimeout(function () {
      // Defensive: clear TURNING from every sheet (only finalSheetElement
      // should have it, but the snap loop never adds it — this is just to
      // catch any stray class left from an earlier interrupted animation).
      for (var clearTurningIdx = 0; clearTurningIdx < allPageSheetElements.length; clearTurningIdx++) {
        allPageSheetElements[clearTurningIdx].classList.remove(SHEET_TURNING_CLASS_NAME);
      }
      isCurrentlyAnimating = false;
      refreshPageIndicator();
    }, PAGE_FLIP_ANIMATION_MS);
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

  /* TOC entries — click (or keyboard Enter on focused button) on any
     chapter row jumps to that chapter's first page.
     RESOLUTION: lookup by `data-bookwriter-toc-target-chapter-number`
     against the live `allPageSheetElements[].dataset.bookwriterSheet
     ChapterNumber` — finds the FIRST sheet that belongs to the target
     chapter (= the chapter-start page). This is robust against the
     client-side paginator re-numbering pages: server-side word-count
     pagination might say "Chapter 5 starts at page 9" but after the
     client paginator (which measures real font/image sizes) the same
     chapter actually starts at sheet 12 — the chapter-number lookup
     resolves to the live DOM position regardless of which paginator
     produced the sheets.
     stopPropagation prevents the stage-click page-turn handler (below)
     from ALSO firing when the user clicks a button on the TOC sheet
     (belt-and-suspenders — the stage handler also has its own TOC-
     page guard added in v939). */
  document.querySelectorAll('.bookwriter-book-reader-toc-link').forEach(function (tocLinkButton) {
    tocLinkButton.addEventListener('click', function (tocClickEvent) {
      tocClickEvent.stopPropagation();
      var targetChapterNumberString = tocLinkButton.dataset.bookwriterTocTargetChapterNumber;
      if (!targetChapterNumberString) return;
      var targetSheetIndex = -1;
      for (var sheetSearchIdx = 0; sheetSearchIdx < allPageSheetElements.length; sheetSearchIdx++) {
        if (allPageSheetElements[sheetSearchIdx].dataset.bookwriterSheetChapterNumber
            === targetChapterNumberString) {
          targetSheetIndex = sheetSearchIdx;
          break;
        }
      }
      if (targetSheetIndex >= 0) {
        jumpToPageNumber(targetSheetIndex + 1);
      }
    });
  });

  /* TOC SHORTCUT BUTTON (v945 + v946) — small "Contents" button in
     the bottom controls pill that jumps the user to the FIRST
     Contents sheet ("Contents — I"). Useful when the user picks the
     wrong chapter from the TOC and wants to go back without walking
     through prev N times or remembering the TOC page number for the
     jump-input. Resolves the destination sheet by data-bookwriter-
     sheet-type="toc" lookup against the live allPageSheetElements
     (same robust pattern as the chapter-number lookup above) — works
     regardless of how many TOC pages exist.

     v946 — INSTANT JUMP for the book-open case to avoid flashing
     intermediate sheets:
     jumpToPageNumber's multi-step BACKWARD path (jumpToPageNumber()
     line ~385) snaps every intermediate sheet [target+1..current-1]
     to UNFLIPPED state before animating the final sheet hop. That
     snap makes the sheet just above the target (e.g. Contents — II
     when target is Contents — I) the topmost via the z-index ladder
     for ~1 frame — the user reported "going to Contents — II then
     Contents — I". For a navigation SHORTCUT (not a page turn) the
     correct UX is instant jump with no animation. The cover-closed
     case (book hasn't been opened yet) defers to jumpToPageNumber
     which handles openTheBook + delayed jump correctly — no flash
     possible because there are no intermediate sheets between cover
     and Contents — I. */
  if (tocShortcutButtonElement) {
    tocShortcutButtonElement.addEventListener('click', function () {
      if (isCurrentlyAnimating) return;
      var firstTocSheetIndex = -1;
      for (var tocSheetSearchIdx = 0; tocSheetSearchIdx < allPageSheetElements.length; tocSheetSearchIdx++) {
        if (allPageSheetElements[tocSheetSearchIdx].dataset.bookwriterSheetType === 'toc') {
          firstTocSheetIndex = tocSheetSearchIdx;
          break;
        }
      }
      if (firstTocSheetIndex < 0) return;
      if (firstTocSheetIndex === sheetsAlreadyTurnedCount) return;

      // Cover-closed: defer to jumpToPageNumber (handles openTheBook
      // + delayed jump). No flash possible from this state.
      if (!isBookCurrentlyOpen) {
        jumpToPageNumber(firstTocSheetIndex + 1);
        return;
      }

      // Book open — instant atomic jump. Disable all sheet transitions,
      // set every sheet's flipped/unflipped state in one batch, force
      // ONE reflow, re-enable transitions. Result: user goes from
      // wherever they were straight to Contents — I with no animation
      // and no intermediate flash.
      for (var clearTransitionIdx = 0; clearTransitionIdx < allPageSheetElements.length; clearTransitionIdx++) {
        allPageSheetElements[clearTransitionIdx].style.transition = 'none';
        if (clearTransitionIdx < firstTocSheetIndex) {
          allPageSheetElements[clearTransitionIdx].classList.add(SHEET_FLIPPED_CLASS_NAME);
        } else {
          allPageSheetElements[clearTransitionIdx].classList.remove(SHEET_FLIPPED_CLASS_NAME);
        }
      }
      void pagesContainerElement.offsetWidth;
      for (var restoreTransitionIdx = 0; restoreTransitionIdx < allPageSheetElements.length; restoreTransitionIdx++) {
        allPageSheetElements[restoreTransitionIdx].style.transition = '';
      }
      sheetsAlreadyTurnedCount = firstTocSheetIndex;
      refreshPageIndicator();
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
     open and the click didn't land on cover, controls, floating btns,
     or the TOC sheet (which has its own clickable chapter entries +
     should ONLY be navigable via the prev/next floating buttons; the
     large left/right click area would conflict with the chapter-jump
     buttons on this page). The TOC lives on the page-BACK of the
     frontispiece sheet, so the guard targets that specific area
     across the entire back face — including empty space — not just
     the toc-list itself, so clicking anywhere on the TOC page is
     ignored by the stage page-turn handler. */
  stageElement.addEventListener('click', function (stageClickEvent) {
    if (!isBookCurrentlyOpen || isCurrentlyAnimating) return;
    if (stageClickEvent.target.closest('.bookwriter-book-reader-cover')) return;
    if (stageClickEvent.target.closest('.bookwriter-book-reader-controls')) return;
    if (stageClickEvent.target.closest('.bookwriter-book-reader-floating-button')) return;
    if (stageClickEvent.target.closest(
      '.bookwriter-book-reader-page-sheet[data-bookwriter-sheet-type="frontispiece"] .bookwriter-book-reader-page-back'
    )) return;
    /* Multi-page TOC sheets (data-bookwriter-sheet-type="toc") added in
       v941. Same special-case as the frontispiece's back face: clickable
       chapter entries on the FRONT face would conflict with the stage
       page-turn click area, so disable stage page-turn there. The back
       face of TOC sheets is intentionally blank — no buttons, no content
       — so we leave the stage page-turn ENABLED on the back face so the
       user can still flick past a flipped TOC sheet using the large
       click area (consistent with chapter-sheet back faces). */
    if (stageClickEvent.target.closest(
      '.bookwriter-book-reader-page-sheet[data-bookwriter-sheet-type="toc"] .bookwriter-book-reader-page-front'
    )) return;
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
  /* ====================================================================
     Measure the actual rendered .bookwriter-book-reader-page-front
     content box (after CSS padding) so the paginator splits at the
     real page boundary on the user's current viewport — not the
     module's hardcoded 510×645 default (which was computed for a
     fixed 640×860 book).

     The book is now responsive (height min-clamp 520, max 940), so
     the hardcoded default over-packed content on small viewports —
     trailing prose was clipped at the bottom of the page-face. With
     the runtime measurement, every page on every viewport gets a
     correct fit and the next page's first line is the next prose
     line, never a half-clipped sentence.

     Returns null if no chapter sheet is in the DOM yet (paginator
     falls back to its module defaults in that case).
     ==================================================================== */
  function _measureActualPageFaceContentBoxForPaginator() {
    if (!pagesContainerElement) return null;
    var firstChapterPageFront = pagesContainerElement.querySelector(
      '[data-bookwriter-sheet-type="chapter"] .bookwriter-book-reader-page-front'
    );
    if (firstChapterPageFront === null) return null;

    var pageFrontBoundingRect = firstChapterPageFront.getBoundingClientRect();
    if (pageFrontBoundingRect.width <= 0 || pageFrontBoundingRect.height <= 0) {
      return null;
    }

    var pageFrontComputedStyles = window.getComputedStyle(firstChapterPageFront);
    var paddingTopPx    = parseFloat(pageFrontComputedStyles.paddingTop)    || 0;
    var paddingBottomPx = parseFloat(pageFrontComputedStyles.paddingBottom) || 0;
    var paddingLeftPx   = parseFloat(pageFrontComputedStyles.paddingLeft)   || 0;
    var paddingRightPx  = parseFloat(pageFrontComputedStyles.paddingRight)  || 0;

    var contentWidthPx = pageFrontBoundingRect.width - paddingLeftPx - paddingRightPx;
    if (contentWidthPx <= 0) return null;

    // TWO BODY HEIGHTS — chapter-start vs continuation pages have a
    // different vertical content area inside the same page-front box.
    //
    // Chapter-start pages render in this order (top → bottom):
    //   padding-top → kicker → chapter-title → chapter-body → padding-bottom
    // The kicker (~14px + 12px margin) and chapter-title (~24-36px clamped
    // + 40px margin + 1.25 line-height) are IN FLOW — they push the
    // chapter-body's offsetTop down by ~95-110px on a typical page.
    //
    // Continuation pages render in this order:
    //   padding-top → chapter-body → padding-bottom
    // The running header is `position: absolute` (CSS line ~620), so it
    // does NOT consume any flow space — chapter-body sits directly below
    // padding-top.
    //
    // Measuring `pageFront.height − padding − safety` gave a SINGLE
    // height that over-allocated chapter-start pages by ~100px, causing
    // the user-reported overflow on chapter 5 page 12. Now we measure
    // both correctly: chapter-start uses the chapter-body's actual
    // offsetTop (which already includes padding-top + kicker + title);
    // continuation uses just padding-top.
    var firstChapterBody = firstChapterPageFront.querySelector(
      '.bookwriter-book-reader-chapter-body'
    );
    if (firstChapterBody === null) return null;
    var chapterBodyOffsetTopPx = firstChapterBody.offsetTop;

    var chapterStartPageContentHeightPx =
      pageFrontBoundingRect.height - chapterBodyOffsetTopPx - paddingBottomPx;
    var continuationPageContentHeightPx =
      pageFrontBoundingRect.height - paddingTopPx - paddingBottomPx;

    // SAFETY BUFFER for sub-pixel rounding. The browser rounds line
    // metrics (line-height, glyph advance) at fractional pixels, so a
    // ghost measurement of "fits exactly" can clip 1–2px in real
    // render — the user sees the last line of prose half-cut at the
    // bottom of the page. 16px ≈ half a line of body text, leaves
    // breathing room without visibly under-filling the page. Applied
    // to BOTH heights for consistency.
    var BOTTOM_SAFETY_BUFFER_PX = 16;
    chapterStartPageContentHeightPx -= BOTTOM_SAFETY_BUFFER_PX;
    continuationPageContentHeightPx -= BOTTOM_SAFETY_BUFFER_PX;

    if (chapterStartPageContentHeightPx <= 0 || continuationPageContentHeightPx <= 0) {
      return null;
    }

    var measuredPaginatorOptions = {
      contentWidthPx: Math.floor(contentWidthPx),
      chapterStartPageContentHeightPx: Math.floor(chapterStartPageContentHeightPx),
      continuationPageContentHeightPx: Math.floor(continuationPageContentHeightPx),
      // Full page-front bounding height (no padding subtracted) — the
      // paginator uses this to constrain ghost <img> max-height to match
      // the .chapter-body img { max-height: calc(book-height - 200px) }
      // CSS rule on the real page. Without this, ghost images render at
      // natural pixel size (often much taller than the real rendered
      // image), so the paginator over-allocates page space and pages
      // end up half-empty around image boundaries.
      bookHeightPx:   Math.floor(pageFrontBoundingRect.height),
    };

    // Read computed font-size + line-height + font-family from the
    // actual rendered .chapter-body so the ghost measures with the SAME
    // typography the page will render with. The page CSS uses
    // `font-size: clamp(--text-base, 2.2vw, --text-xl)` — at wide
    // viewports actual font-size can be 20px while the paginator's
    // hardcoded default is 18px. That 2px-per-line under-measurement
    // accumulates across a page and lets the paginator pack 1–2 lines
    // too many, which then clip on render. Same class of bug as the
    // responsive HEIGHT fix above, just for font-size.
    var firstChapterBody = firstChapterPageFront.querySelector(
      '.bookwriter-book-reader-chapter-body'
    );
    if (firstChapterBody !== null) {
      var bodyComputedStyles = window.getComputedStyle(firstChapterBody);
      var bodyFontSizePx     = parseFloat(bodyComputedStyles.fontSize);
      var bodyLineHeightRaw  = bodyComputedStyles.lineHeight;
      var bodyFontFamily     = bodyComputedStyles.fontFamily;

      if (isFinite(bodyFontSizePx) && bodyFontSizePx > 0) {
        measuredPaginatorOptions.fontSizePx = bodyFontSizePx;
      }
      // lineHeight from getComputedStyle is normally returned as a
      // pixel string ("35.1px"). The paginator wants a unitless ratio,
      // so divide by font-size when we got a pixel value.
      var bodyLineHeightPx = parseFloat(bodyLineHeightRaw);
      if (isFinite(bodyLineHeightPx) && bodyLineHeightPx > 0
          && bodyFontSizePx > 0
          && bodyLineHeightRaw.indexOf('px') !== -1) {
        measuredPaginatorOptions.lineHeight = bodyLineHeightPx / bodyFontSizePx;
      } else if (isFinite(bodyLineHeightPx) && bodyLineHeightPx > 0) {
        // Already a unitless ratio (rare for getComputedStyle but valid)
        measuredPaginatorOptions.lineHeight = bodyLineHeightPx;
      }
      if (bodyFontFamily) {
        measuredPaginatorOptions.fontFamily = bodyFontFamily;
      }
    }

    return measuredPaginatorOptions;
  }

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

    var measuredPageFaceDimensions = _measureActualPageFaceContentBoxForPaginator();
    var paginatorOptions = measuredPageFaceDimensions || {};

    paginatorModule.paginateAllChaptersAndBuildSheetsHtml(chaptersData, paginatorOptions)
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

        // Drop the standalone colophon sheet — it's almost always a
        // mostly-empty page that just shows "— end —" and wastes a
        // navigation step. Try to inline the end ornament at the bottom
        // of the LAST chapter sheet instead; if it overflows, skip it
        // entirely (no end text anywhere is fine — the writer asked
        // for "only if there is enough space, otherwise don't bother").
        var standaloneColophonSheet = pagesContainerElement.querySelector(
          '[data-bookwriter-sheet-type="colophon"]'
        );
        var allChapterSheetsAfterPagination = pagesContainerElement.querySelectorAll(
          '[data-bookwriter-sheet-type="chapter"]'
        );
        if (allChapterSheetsAfterPagination.length > 0) {
          var lastChapterPageFront = allChapterSheetsAfterPagination[
            allChapterSheetsAfterPagination.length - 1
          ].querySelector('.bookwriter-book-reader-page-front');
          if (lastChapterPageFront) {
            var inlineColophonHtmlString = ''
              + '<div class="bookwriter-book-reader-colophon-inline" aria-hidden="true">'
                + '<div class="bookwriter-book-reader-colophon-ornament">&#x2042;</div>'
                + '<p class="bookwriter-book-reader-colophon-text">&mdash; end &mdash;</p>'
              + '</div>';
            lastChapterPageFront.insertAdjacentHTML('beforeend', inlineColophonHtmlString);
            // Measure: if appending the ornament overflowed the page-front
            // content area, roll back so prose doesn't get clipped.
            if (lastChapterPageFront.scrollHeight > lastChapterPageFront.clientHeight) {
              var addedColophonNode = lastChapterPageFront.querySelector(
                '.bookwriter-book-reader-colophon-inline'
              );
              if (addedColophonNode && addedColophonNode.parentNode) {
                addedColophonNode.parentNode.removeChild(addedColophonNode);
              }
            }
          }
        }
        // Always remove the standalone colophon sheet — even if the
        // inline ornament didn't fit, an empty "end" page is worse
        // than no end marker at all.
        if (standaloneColophonSheet && standaloneColophonSheet.parentNode) {
          standaloneColophonSheet.parentNode.removeChild(standaloneColophonSheet);
        }

        // Re-collect sheet element list + refresh nav state.
        allPageSheetElements = Array.prototype.slice.call(
          pagesContainerElement.querySelectorAll('.bookwriter-book-reader-page-sheet')
        );
        totalSheetCount = allPageSheetElements.length;
        if (jumpInputElement && totalSheetCount > 0) {
          jumpInputElement.max = String(totalSheetCount);
        }
        // Reapply the per-sheet z-index ladder now that the DOM has
        // settled (paginator inserted new chapter sheets, colophon-
        // inline removed the standalone colophon). Each sheet's new
        // DOM position must be reflected in the custom property the
        // CSS calc() reads.
        _applyDeterministicZIndexLadderToAllSheets();
        refreshPageIndicator();
      })
      .catch(function (paginationError) {
        console.error('bookwriter reader: client-side paginator failed', paginationError);
      });
  }

  _rebuildChapterSheetsWithClientSidePaginator();

  /* ====================================================================
     Fullscreen toggle — distraction-free reading.
     Uses the browser's native Fullscreen API so the browser hides its
     own chrome (URL bar, tabs, OS taskbar) and the reader fills the
     screen. Esc exits universally — no custom keybind needed. The
     same button enters AND exits fullscreen; the fullscreenchange
     event listener swaps the icon + aria-label between expand and
     contract states so the UI matches the actual browser state even
     when the user exits via Esc, F11, or the browser's built-in
     fullscreen control.

     No deps, no other reader logic touched.
     ==================================================================== */
  var fullscreenToggleButtonElement = document.getElementById(
    'bookwriter-book-reader-floating-fullscreen-button'
  );
  var fullscreenToggleIconElement = document.getElementById(
    'bookwriter-book-reader-floating-fullscreen-icon'
  );

  function _isCurrentlyInFullscreen() {
    return !!(
      document.fullscreenElement
      || document.webkitFullscreenElement
      || document.msFullscreenElement
    );
  }

  /* Inline SVG markup for the two icon states — kept as constants so
     the render function stays pure data-swap. SVG inherits the
     button's text colour via stroke="currentColor" so theme/dark-mode
     overrides Just Work without per-icon colour rules.
       OFF state  — "enter fullscreen": four corner brackets pointing
                    outward (the universal expand/maximise glyph used
                    by every video player + reading app).
       ON state   — "exit fullscreen": door frame with an arrow leaving
                    through it — visually distinct from the close-book
                    × so the writer never has two ✕ buttons that look
                    the same when in fullscreen.  */
  var FULLSCREEN_ICON_SVG_ENTER = (
    '<svg viewBox="0 0 16 16" width="18" height="18" fill="none"'
    + ' stroke="currentColor" stroke-width="1.6"'
    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M2 6 L2 2 L6 2"/>'
      + '<path d="M10 2 L14 2 L14 6"/>'
      + '<path d="M14 10 L14 14 L10 14"/>'
      + '<path d="M6 14 L2 14 L2 10"/>'
    + '</svg>'
  );
  var FULLSCREEN_ICON_SVG_EXIT_DOOR = (
    '<svg viewBox="0 0 16 16" width="18" height="18" fill="none"'
    + ' stroke="currentColor" stroke-width="1.6"'
    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      // Door frame — open on the right side (looking from inside)
      + '<path d="M9 2 L3 2 L3 14 L9 14"/>'
      // Door knob — small dot on the inside edge
      + '<circle cx="7.2" cy="8" r="0.6" fill="currentColor" stroke="none"/>'
      // Arrow leaving the door, pointing right
      + '<path d="M7 8 L14 8 M11 5 L14 8 L11 11"/>'
    + '</svg>'
  );

  function _renderFullscreenButtonForCurrentState() {
    if (!fullscreenToggleButtonElement) return;
    var isInFullscreen = _isCurrentlyInFullscreen();
    if (isInFullscreen) {
      fullscreenToggleButtonElement.dataset.bookwriterFullscreenState = 'on';
      fullscreenToggleButtonElement.title = 'Exit full screen (Esc)';
      fullscreenToggleButtonElement.setAttribute('aria-label', 'Exit full screen reading mode');
      if (fullscreenToggleIconElement) {
        fullscreenToggleIconElement.innerHTML = FULLSCREEN_ICON_SVG_EXIT_DOOR;
      }
    } else {
      fullscreenToggleButtonElement.dataset.bookwriterFullscreenState = 'off';
      fullscreenToggleButtonElement.title = 'Enter full screen — distraction-free reading (press Esc to exit)';
      fullscreenToggleButtonElement.setAttribute('aria-label', 'Enter full screen reading mode');
      if (fullscreenToggleIconElement) {
        fullscreenToggleIconElement.innerHTML = FULLSCREEN_ICON_SVG_ENTER;
      }
    }
  }

  function _enterReaderFullscreen() {
    var requestFullscreenFn = (
      document.documentElement.requestFullscreen
      || document.documentElement.webkitRequestFullscreen
      || document.documentElement.msRequestFullscreen
    );
    if (typeof requestFullscreenFn !== 'function') return;
    var fullscreenPromise = requestFullscreenFn.call(document.documentElement);
    if (fullscreenPromise && typeof fullscreenPromise.catch === 'function') {
      fullscreenPromise.catch(function (fullscreenRequestError) {
        // Browser refused (e.g. permissions / user gesture lost). No
        // way to show an inline message inside fullscreen if it
        // succeeded then failed; log + leave button state alone — the
        // fullscreenchange listener handles UI sync if the state
        // never actually changed.
        console.error('bookwriter reader: requestFullscreen failed', fullscreenRequestError);
      });
    }
  }

  function _exitReaderFullscreen() {
    var exitFullscreenFn = (
      document.exitFullscreen
      || document.webkitExitFullscreen
      || document.msExitFullscreen
    );
    if (typeof exitFullscreenFn !== 'function') return;
    var exitPromise = exitFullscreenFn.call(document);
    if (exitPromise && typeof exitPromise.catch === 'function') {
      exitPromise.catch(function (fullscreenExitError) {
        console.error('bookwriter reader: exitFullscreen failed', fullscreenExitError);
      });
    }
  }

  if (fullscreenToggleButtonElement) {
    fullscreenToggleButtonElement.addEventListener('click', function () {
      if (_isCurrentlyInFullscreen()) {
        _exitReaderFullscreen();
      } else {
        _enterReaderFullscreen();
      }
    });
    // Sync the button to the actual browser state on entering / exiting,
    // including when the user uses Esc / F11 / the browser's own UI.
    document.addEventListener('fullscreenchange',       _renderFullscreenButtonForCurrentState);
    document.addEventListener('webkitfullscreenchange', _renderFullscreenButtonForCurrentState);
    document.addEventListener('msfullscreenchange',     _renderFullscreenButtonForCurrentState);
    // Initial render in case the page loaded already in fullscreen
    // (rare — F11 BEFORE clicking on the page; safe-guard anyway).
    _renderFullscreenButtonForCurrentState();
  }
})();
