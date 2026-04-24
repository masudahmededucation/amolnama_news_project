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

  var sheetsAlreadyTurnedCount = 0;
  var isCurrentlyAnimating     = false;
  var isBookCurrentlyOpen      = false;
  var pendingJumpErrorTimeout  = null;

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
    // Auto-open the book if user clicked Next before opening the
    // cover. Without this guard, the page-flip animation runs but
    // stage-open class never gets added — cover stays in front of
    // pages and controls never become visible. After the cover-open
    // animation completes, advance to the first page automatically
    // so the user gets the "I clicked Next, I'm now reading" outcome
    // they expected.
    if (!isBookCurrentlyOpen) {
      openTheBook();
      setTimeout(turnToNextSheet, COVER_FLIP_ANIMATION_MS + 60);
      return;
    }
    if (sheetsAlreadyTurnedCount >= totalSheetCount - 1) return;
    isCurrentlyAnimating = true;
    var sheetBeingTurned = allPageSheetElements[sheetsAlreadyTurnedCount];
    sheetBeingTurned.classList.add(SHEET_TURNING_CLASS_NAME);
    requestAnimationFrame(function () {
      sheetBeingTurned.classList.add(SHEET_FLIPPED_CLASS_NAME);
    });
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
    // Auto-open if Prev clicked on a closed book — same reason as
    // turnToNextSheet. Then no-op (no previous page from page 1).
    if (!isBookCurrentlyOpen) {
      openTheBook();
      return;
    }
    if (sheetsAlreadyTurnedCount === 0) return;
    isCurrentlyAnimating = true;
    sheetsAlreadyTurnedCount--;
    var sheetBeingTurned = allPageSheetElements[sheetsAlreadyTurnedCount];
    sheetBeingTurned.classList.add(SHEET_TURNING_CLASS_NAME);
    requestAnimationFrame(function () {
      sheetBeingTurned.classList.remove(SHEET_FLIPPED_CLASS_NAME);
    });
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
})();
