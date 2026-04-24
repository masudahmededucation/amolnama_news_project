/* ====================================================================
   কলম / My Library — page entry IIFE.
   --------------------------------------------------------------------
   Three responsibilities (no others — keep this file tight):

     1. Search filter  — case-insensitive substring match against each
        card's data-search-haystack. Toggles the [hidden] attribute on
        cards and the no-match empty state. Updates the live-region
        count text. Pure DOM, no network.

     2. + New book     — both the header button and the empty-state
        "Start writing" button POST to bookwriter:api_book_create.
        On success the server returns redirect_url; we navigate to it.

     3. Two-click archive — first click flips data-confirm-state to
        "awaiting-confirm" + reveals the confirm label "Archive?".
        Second click within 3s POSTs to bookwriter:api_book_archive,
        removes the card from the DOM, decrements the count, and
        re-runs the search filter so the no-match state can appear.
        Auto-reset after 3s if no second click.

   Depends on window.bookwriter.{apiPost,csrfHeaders} from
   modules/bookwriter-namespace.js — that file MUST load first
   (the template enforces the script order).
   ==================================================================== */
(function () {
  'use strict';

  var libraryGridElement                = document.getElementById('bookwriter-library-grid');
  var librarySearchInputElement         = document.getElementById('bookwriter-library-search-input');
  var libraryCountElement               = document.getElementById('bookwriter-library-count');
  var libraryNoMatchEmptyElement        = document.getElementById('bookwriter-library-empty-no-match');
  var libraryHeaderCreateButton         = document.getElementById('bookwriter-library-create-button');
  var libraryEmptyStateCreateButton     = document.getElementById('bookwriter-library-empty-create-button');

  var ARCHIVE_CONFIRM_TIMEOUT_MS  = 3000;
  var ARCHIVE_CONFIRM_LABEL_TEXT  = 'Archive?';
  var BOOK_CREATE_API_URL_PATH    = '/bookwriter/api/book/create/';
  // Archive URL is built per-card from the data-archive-book-id attribute.

  /* -----------------------------------------------------------------
     Count display + search filter — both work off the SAME book-card
     queryset so changes (archive removes a card) stay consistent.
  ----------------------------------------------------------------- */
  function getAllBookCardElements() {
    if (!libraryGridElement) return [];
    return Array.prototype.slice.call(
      libraryGridElement.querySelectorAll('.bookwriter-library-card')
    );
  }

  function refreshLibraryCountDisplay(visibleCardCount, totalCardCount) {
    if (!libraryCountElement) return;
    if (totalCardCount === 0) {
      libraryCountElement.textContent = '';
      return;
    }
    if (visibleCardCount === totalCardCount) {
      libraryCountElement.textContent =
        totalCardCount === 1 ? '1 book' : (totalCardCount + ' books');
    } else {
      libraryCountElement.textContent =
        visibleCardCount + ' of ' + totalCardCount;
    }
  }

  function applySearchFilterToCards(searchQueryText) {
    var allCardElements = getAllBookCardElements();
    var normalizedQueryText = (searchQueryText || '').trim().toLowerCase();
    var visibleCardCount = 0;
    for (var cardIndex = 0; cardIndex < allCardElements.length; cardIndex++) {
      var cardElement = allCardElements[cardIndex];
      var cardHaystackText = (cardElement.getAttribute('data-search-haystack') || '');
      var cardMatchesQuery = (
        normalizedQueryText === '' ||
        cardHaystackText.indexOf(normalizedQueryText) !== -1
      );
      if (cardMatchesQuery) {
        cardElement.removeAttribute('hidden');
        visibleCardCount++;
      } else {
        cardElement.setAttribute('hidden', '');
      }
    }
    refreshLibraryCountDisplay(visibleCardCount, allCardElements.length);
    if (libraryNoMatchEmptyElement) {
      var shouldShowNoMatch = (
        allCardElements.length > 0 &&
        visibleCardCount === 0 &&
        normalizedQueryText !== ''
      );
      if (shouldShowNoMatch) {
        libraryNoMatchEmptyElement.removeAttribute('hidden');
      } else {
        libraryNoMatchEmptyElement.setAttribute('hidden', '');
      }
    }
  }

  if (librarySearchInputElement) {
    librarySearchInputElement.addEventListener('input', function (inputEvent) {
      applySearchFilterToCards(inputEvent.target.value);
    });
  }

  // Initial count paint (no search filter).
  applySearchFilterToCards('');

  /* -----------------------------------------------------------------
     + New book — both buttons share the same handler so the create
     flow has a single source of truth.
  ----------------------------------------------------------------- */
  function handleCreateNewBookClick(clickEvent) {
    var triggerButton = clickEvent.currentTarget;
    if (triggerButton.disabled) return;
    triggerButton.disabled = true;
    var originalLabelText = triggerButton.textContent;
    triggerButton.textContent = 'Creating…';
    window.bookwriter.apiPost(BOOK_CREATE_API_URL_PATH, {})
      .then(function (responseJson) {
        if (responseJson && responseJson.redirect_url) {
          window.location.href = responseJson.redirect_url;
          return;
        }
        triggerButton.disabled = false;
        triggerButton.textContent = originalLabelText;
      })
      .catch(function (createError) {
        console.error('bookwriter library — create book failed', createError);
        triggerButton.disabled = false;
        triggerButton.textContent = originalLabelText;
      });
  }

  if (libraryHeaderCreateButton) {
    libraryHeaderCreateButton.addEventListener('click', handleCreateNewBookClick);
  }
  if (libraryEmptyStateCreateButton) {
    libraryEmptyStateCreateButton.addEventListener('click', handleCreateNewBookClick);
  }

  /* -----------------------------------------------------------------
     Two-click archive — per-card. Stops link-navigation propagation
     from the parent <a class="bookwriter-library-card-link">.
  ----------------------------------------------------------------- */
  function wireArchiveButtonOnCard(cardElement) {
    var archiveButtonElement = cardElement.querySelector(
      '.bookwriter-library-card-archive-button'
    );
    if (archiveButtonElement === null) return;
    var archiveBookId = archiveButtonElement.getAttribute('data-archive-book-id');
    if (!archiveBookId) return;
    var confirmLabelElement = archiveButtonElement.querySelector(
      '.bookwriter-library-card-archive-confirm-label'
    );
    var pendingConfirmTimeoutHandle = null;

    function resetArchiveConfirmState() {
      archiveButtonElement.setAttribute('data-confirm-state', 'idle');
      if (confirmLabelElement) confirmLabelElement.textContent = '';
      if (pendingConfirmTimeoutHandle !== null) {
        clearTimeout(pendingConfirmTimeoutHandle);
        pendingConfirmTimeoutHandle = null;
      }
    }

    archiveButtonElement.addEventListener('click', function (archiveClickEvent) {
      archiveClickEvent.preventDefault();
      archiveClickEvent.stopPropagation();
      var currentConfirmState = archiveButtonElement.getAttribute('data-confirm-state');
      if (currentConfirmState !== 'awaiting-confirm') {
        archiveButtonElement.setAttribute('data-confirm-state', 'awaiting-confirm');
        if (confirmLabelElement) confirmLabelElement.textContent = ARCHIVE_CONFIRM_LABEL_TEXT;
        pendingConfirmTimeoutHandle = setTimeout(
          resetArchiveConfirmState, ARCHIVE_CONFIRM_TIMEOUT_MS
        );
        return;
      }
      // Second click — actually archive.
      if (pendingConfirmTimeoutHandle !== null) {
        clearTimeout(pendingConfirmTimeoutHandle);
        pendingConfirmTimeoutHandle = null;
      }
      archiveButtonElement.disabled = true;
      var archiveUrlPath = '/bookwriter/api/book/' + archiveBookId + '/archive/';
      window.bookwriter.apiPost(archiveUrlPath, {})
        .then(function () {
          var parentNode = cardElement.parentNode;
          if (parentNode !== null) parentNode.removeChild(cardElement);
          // Re-run filter so count + no-match state stay consistent.
          applySearchFilterToCards(
            librarySearchInputElement ? librarySearchInputElement.value : ''
          );
        })
        .catch(function (archiveError) {
          console.error('bookwriter library — archive failed', archiveError);
          archiveButtonElement.disabled = false;
          resetArchiveConfirmState();
        });
    });
  }

  var allCardElementsForWiring = getAllBookCardElements();
  for (var wireCardIndex = 0; wireCardIndex < allCardElementsForWiring.length; wireCardIndex++) {
    wireArchiveButtonOnCard(allCardElementsForWiring[wireCardIndex]);
  }
})();
