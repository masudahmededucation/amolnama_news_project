/* ====================================================================
   কলম / Reader feedback admin sub-page — filter + resolve toggle
   --------------------------------------------------------------------
   Wires the All / Open / Resolved / By-reader filter chips and the
   per-comment resolve toggle. The resolve toggle calls the already-
   shipped POST /bookwriter/api/beta-comment/<id>/resolve/ via
   window.bookwriter.apiPost (CSRF + JSON contract handled there).

   No console.log/.debug/.info/.warn. No alert/confirm/prompt.
   ==================================================================== */
(function () {
  'use strict';

  if (window.__bookwriterInkwellFeedbackInitialized) return;
  window.__bookwriterInkwellFeedbackInitialized = true;

  var FILTER_BAR_ID         = 'bookwriter-feedback-filter-bar';
  var FILTER_CHIP_SELECTOR  = '.bookwriter-feedback-filter-chip';
  var COMMENT_LIST_ID       = 'bookwriter-feedback-comment-list';
  var COMMENT_ROW_SELECTOR  = '.bookwriter-feedback-comment-row';
  var EMPTY_NO_MATCH_ID     = 'bookwriter-feedback-empty-no-match';
  var RESOLVE_BUTTON_SELECTOR = '.bookwriter-feedback-comment-row-resolve-button';
  var ROW_MESSAGE_SELECTOR    = '.bookwriter-feedback-comment-row-message';

  var FILTER_CHIP_ACTIVE_CLASS              = 'bookwriter-feedback-filter-chip-is-active';
  var COMMENT_ROW_RESOLVED_CLASS            = 'bookwriter-feedback-comment-row-is-resolved';
  var RESOLVE_BUTTON_RESOLVED_CLASS         = 'bookwriter-feedback-comment-row-resolve-button-is-resolved';
  var ROW_MESSAGE_ERROR_CLASS               = 'bookwriter-feedback-comment-row-message-is-error';
  var ROW_MESSAGE_SUCCESS_CLASS             = 'bookwriter-feedback-comment-row-message-is-success';

  var STATUS_MESSAGE_VISIBLE_MS = 2200;

  function _setRowMessage(rowElement, messageText, kind) {
    var messageElement = rowElement.querySelector(ROW_MESSAGE_SELECTOR);
    if (!messageElement) return;
    messageElement.textContent = messageText || '';
    messageElement.classList.remove(ROW_MESSAGE_ERROR_CLASS, ROW_MESSAGE_SUCCESS_CLASS);
    if (kind === 'error')   messageElement.classList.add(ROW_MESSAGE_ERROR_CLASS);
    if (kind === 'success') messageElement.classList.add(ROW_MESSAGE_SUCCESS_CLASS);
    if (messageText) {
      setTimeout(function () {
        if (messageElement.textContent === messageText) {
          messageElement.textContent = '';
          messageElement.classList.remove(ROW_MESSAGE_ERROR_CLASS, ROW_MESSAGE_SUCCESS_CLASS);
        }
      }, STATUS_MESSAGE_VISIBLE_MS);
    }
  }

  function _applyActiveFiltersToList(activeFilterKindString, activeFilterValueString,
                                     commentListElement, emptyNoMatchElement) {
    var allRowElements = commentListElement.querySelectorAll(COMMENT_ROW_SELECTOR);
    var visibleRowCount = 0;
    for (var rowIndex = 0; rowIndex < allRowElements.length; rowIndex++) {
      var rowElement = allRowElements[rowIndex];
      var matches = true;
      if (activeFilterKindString === 'status') {
        matches = (rowElement.dataset.bookwriterCommentStatus === activeFilterValueString);
      } else if (activeFilterKindString === 'reader') {
        matches = (rowElement.dataset.bookwriterBetaReaderId === activeFilterValueString);
      }
      // 'all' (or empty) → matches stays true
      rowElement.hidden = !matches;
      if (matches) visibleRowCount += 1;
    }
    if (emptyNoMatchElement) {
      emptyNoMatchElement.hidden = (visibleRowCount > 0);
    }
  }

  function _wireFilterBar(filterBarElement, commentListElement, emptyNoMatchElement) {
    if (!filterBarElement) return;
    filterBarElement.addEventListener('click', function (filterClickEvent) {
      var clickedChipElement = filterClickEvent.target.closest(FILTER_CHIP_SELECTOR);
      if (!clickedChipElement) return;
      var allChipElements = filterBarElement.querySelectorAll(FILTER_CHIP_SELECTOR);
      for (var chipIndex = 0; chipIndex < allChipElements.length; chipIndex++) {
        allChipElements[chipIndex].classList.remove(FILTER_CHIP_ACTIVE_CLASS);
      }
      clickedChipElement.classList.add(FILTER_CHIP_ACTIVE_CLASS);
      _applyActiveFiltersToList(
        clickedChipElement.dataset.bookwriterFeedbackFilterKind || 'all',
        clickedChipElement.dataset.bookwriterFeedbackFilterValue || '',
        commentListElement,
        emptyNoMatchElement,
      );
    });
  }

  function _handleResolveButtonClick(resolveButtonElement, commentListElement, emptyNoMatchElement) {
    var rowElement = resolveButtonElement.closest(COMMENT_ROW_SELECTOR);
    if (!rowElement) return;
    var betaCommentIdString = rowElement.dataset.bookwriterBetaCommentId;
    if (!betaCommentIdString) return;

    var currentResolvedStateString = resolveButtonElement.dataset.bookwriterCurrentResolvedState || 'false';
    var nextResolvedState = (currentResolvedStateString !== 'true');

    if (!window.bookwriter || typeof window.bookwriter.apiPost !== 'function') {
      _setRowMessage(rowElement, 'Could not reach the server. Try again.', 'error');
      return;
    }

    resolveButtonElement.disabled = true;
    _setRowMessage(rowElement, '');

    window.bookwriter.apiPost(
      '/bookwriter/api/beta-comment/' + encodeURIComponent(betaCommentIdString) + '/resolve/',
      { is_resolved: nextResolvedState }
    )
      .then(function (responseJson) {
        resolveButtonElement.disabled = false;
        if (!responseJson || responseJson.ok !== true) {
          _setRowMessage(rowElement, 'Server rejected the change. Try again.', 'error');
          return;
        }
        // Update DOM state to match the new server-side state.
        resolveButtonElement.dataset.bookwriterCurrentResolvedState = nextResolvedState ? 'true' : 'false';
        if (nextResolvedState) {
          rowElement.classList.add(COMMENT_ROW_RESOLVED_CLASS);
          rowElement.dataset.bookwriterCommentStatus = 'resolved';
          resolveButtonElement.classList.add(RESOLVE_BUTTON_RESOLVED_CLASS);
          resolveButtonElement.textContent = 'Reopen';
          resolveButtonElement.setAttribute('aria-label', 'Reopen comment');
          _setRowMessage(rowElement, 'Marked resolved.', 'success');
        } else {
          rowElement.classList.remove(COMMENT_ROW_RESOLVED_CLASS);
          rowElement.dataset.bookwriterCommentStatus = 'open';
          resolveButtonElement.classList.remove(RESOLVE_BUTTON_RESOLVED_CLASS);
          resolveButtonElement.textContent = 'Mark resolved';
          resolveButtonElement.setAttribute('aria-label', 'Mark resolved');
          _setRowMessage(rowElement, 'Reopened.', 'success');
        }
        // Re-apply the currently-active filter so a row doesn't visually
        // linger in the wrong filter (e.g. "Open" tab still showing the
        // row we just marked resolved).
        var activeChipElement = document.querySelector(
          '#' + FILTER_BAR_ID + ' .' + FILTER_CHIP_ACTIVE_CLASS
        );
        if (activeChipElement) {
          _applyActiveFiltersToList(
            activeChipElement.dataset.bookwriterFeedbackFilterKind || 'all',
            activeChipElement.dataset.bookwriterFeedbackFilterValue || '',
            commentListElement,
            emptyNoMatchElement,
          );
        }
      })
      .catch(function (resolveToggleError) {
        resolveButtonElement.disabled = false;
        _setRowMessage(rowElement, 'Network error. Try again.', 'error');
        console.error('bookwriter feedback: resolve toggle failed', resolveToggleError);
      });
  }

  function _wireResolveButtons(commentListElement, emptyNoMatchElement) {
    if (!commentListElement) return;
    commentListElement.addEventListener('click', function (listClickEvent) {
      var resolveButtonElement = listClickEvent.target.closest(RESOLVE_BUTTON_SELECTOR);
      if (!resolveButtonElement) return;
      _handleResolveButtonClick(resolveButtonElement, commentListElement, emptyNoMatchElement);
    });
  }

  function _wireFeedbackPage() {
    var filterBarElement     = document.getElementById(FILTER_BAR_ID);
    var commentListElement   = document.getElementById(COMMENT_LIST_ID);
    var emptyNoMatchElement  = document.getElementById(EMPTY_NO_MATCH_ID);
    if (commentListElement === null) return;
    _wireFilterBar(filterBarElement, commentListElement, emptyNoMatchElement);
    _wireResolveButtons(commentListElement, emptyNoMatchElement);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _wireFeedbackPage, { once: true });
  } else {
    _wireFeedbackPage();
  }
})();
