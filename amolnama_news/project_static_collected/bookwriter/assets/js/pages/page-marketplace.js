/* ====================================================================
   কলম / Marketplace page — search + sort (atomic, no deps)
   --------------------------------------------------------------------
   Pure client-side enhancement on top of the SSR-rendered card grid.
   Cards already carry data-search-haystack + data-sort-* attributes
   (lowercased title/author/pages) so the grid is fully indexable
   without a network roundtrip.

   No console.log/.debug/.info/.warn. No alert/confirm/prompt.
   Idempotent against double-include.
   ==================================================================== */
(function () {
  'use strict';

  if (window.__bookwriterMarketplaceInitialized) return;
  window.__bookwriterMarketplaceInitialized = true;

  var SEARCH_INPUT_ID    = 'bookwriter-marketplace-search-input';
  var SORT_SELECT_ID     = 'bookwriter-marketplace-sort-select';
  var GRID_ID            = 'bookwriter-marketplace-grid';
  var COUNT_ID           = 'bookwriter-marketplace-count';
  var EMPTY_NO_MATCH_ID  = 'bookwriter-marketplace-empty-no-match';
  var CARD_SELECTOR      = '.bookwriter-marketplace-card';

  function _applySearchFilterToGrid(searchInputElement, gridElement, countElement, emptyElement) {
    var rawQueryValue = (searchInputElement.value || '').trim().toLowerCase();
    var allCardElements = gridElement.querySelectorAll(CARD_SELECTOR);
    var visibleCardCount = 0;
    for (var cardIndex = 0; cardIndex < allCardElements.length; cardIndex++) {
      var cardElement = allCardElements[cardIndex];
      var haystackValue = cardElement.dataset.searchHaystack || '';
      var matches = (rawQueryValue === '') || (haystackValue.indexOf(rawQueryValue) !== -1);
      if (matches) {
        cardElement.hidden = false;
        visibleCardCount += 1;
      } else {
        cardElement.hidden = true;
      }
    }
    if (countElement) {
      var pluralLabel = (visibleCardCount === 1) ? 'book' : 'books';
      countElement.textContent = visibleCardCount + ' ' + pluralLabel;
    }
    if (emptyElement) {
      emptyElement.hidden = (visibleCardCount > 0);
    }
  }

  function _applySortToGrid(sortSelectElement, gridElement) {
    var sortKey = sortSelectElement.value || 'recent';
    var allCardElements = Array.prototype.slice.call(
      gridElement.querySelectorAll(CARD_SELECTOR)
    );
    if (allCardElements.length < 2) return;

    // The DOM order on first render IS the "recent" order (server
    // sorts by -updated_at). Snapshot it once on first sort so re-
    // selecting "recent" can restore deterministic order without a
    // page reload.
    if (!gridElement.dataset.bookwriterMarketplaceOriginalOrderCaptured) {
      for (var snapshotIndex = 0; snapshotIndex < allCardElements.length; snapshotIndex++) {
        allCardElements[snapshotIndex].dataset.bookwriterMarketplaceOriginalOrderIndex =
          String(snapshotIndex);
      }
      gridElement.dataset.bookwriterMarketplaceOriginalOrderCaptured = 'true';
    }

    var comparatorFunction;
    if (sortKey === 'title') {
      comparatorFunction = function (cardA, cardB) {
        return (cardA.dataset.sortTitle || '').localeCompare(
          cardB.dataset.sortTitle || ''
        );
      };
    } else if (sortKey === 'author') {
      comparatorFunction = function (cardA, cardB) {
        return (cardA.dataset.sortAuthor || '').localeCompare(
          cardB.dataset.sortAuthor || ''
        );
      };
    } else if (sortKey === 'pages-desc') {
      comparatorFunction = function (cardA, cardB) {
        return (parseInt(cardB.dataset.sortPages, 10) || 0)
             - (parseInt(cardA.dataset.sortPages, 10) || 0);
      };
    } else if (sortKey === 'pages-asc') {
      comparatorFunction = function (cardA, cardB) {
        return (parseInt(cardA.dataset.sortPages, 10) || 0)
             - (parseInt(cardB.dataset.sortPages, 10) || 0);
      };
    } else {
      // 'recent' — restore the captured original order.
      comparatorFunction = function (cardA, cardB) {
        return (parseInt(cardA.dataset.bookwriterMarketplaceOriginalOrderIndex, 10) || 0)
             - (parseInt(cardB.dataset.bookwriterMarketplaceOriginalOrderIndex, 10) || 0);
      };
    }

    allCardElements.sort(comparatorFunction);
    var fragment = document.createDocumentFragment();
    for (var insertionIndex = 0; insertionIndex < allCardElements.length; insertionIndex++) {
      fragment.appendChild(allCardElements[insertionIndex]);
    }
    gridElement.appendChild(fragment);
  }

  function _wireMarketplaceControls() {
    var searchInputElement = document.getElementById(SEARCH_INPUT_ID);
    var sortSelectElement  = document.getElementById(SORT_SELECT_ID);
    var gridElement        = document.getElementById(GRID_ID);
    var countElement       = document.getElementById(COUNT_ID);
    var emptyElement       = document.getElementById(EMPTY_NO_MATCH_ID);
    if (gridElement === null) return;

    if (searchInputElement) {
      searchInputElement.addEventListener('input', function () {
        _applySearchFilterToGrid(searchInputElement, gridElement, countElement, emptyElement);
      });
    }

    if (sortSelectElement) {
      sortSelectElement.addEventListener('change', function () {
        _applySortToGrid(sortSelectElement, gridElement);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _wireMarketplaceControls, { once: true });
  } else {
    _wireMarketplaceControls();
  }
})();
