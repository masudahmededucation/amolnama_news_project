/* ============================================================
   bookwriter — shared namespace + helpers
   --------------------------------------------------------
   This file MUST load first. It exposes window.bookwriter so
   every page-inkwell.js / page-public-reader.js / module-*.js
   file can share helpers without duplication.

   What lives here (one source of truth):
     window.bookwriter.csrfHeaders()
       → returns { 'Content-Type': 'application/json',
                   'X-CSRFToken': '<token>' }
       Single CSRF dance.

     window.bookwriter.apiPost(urlPath, payload)
       → fetch POST + credentials + CSRF + JSON body
       → returns Promise resolving to parsed JSON on 2xx,
                  rejecting with Error on non-2xx
       Replaces the 30+ ad-hoc fetch().then().catch() blocks.

     window.bookwriter.apiDelete(urlPath)
       → fetch DELETE + credentials + CSRF
       → same Promise contract

     window.bookwriter.apiGet(urlPath)
       → fetch GET + credentials
       → same Promise contract

     window.bookwriter.wireTwoClickConfirmDelete(buttonElement, options)
       → Replaces the pendingConfirm + setTimeout dance repeated
         across margin-notes / plot-card / bible-entry /
         chapter-delete / etc.
       options:
         - confirmTimeoutMs   default 3000
         - initialLabel       default '×'
         - confirmingLabel    default '✓'
         - confirmingClass    default 'is-confirming'
         - initialTitle       optional: title attribute on initial state
         - confirmingTitle    optional: title attribute on confirming state
         - onConfirm          required: () => void
   ============================================================ */
(function () {
  'use strict';

  if (typeof window.bookwriter === 'object' && window.bookwriter !== null) {
    // Namespace already initialized (script loaded twice). Be idempotent.
    return;
  }
  window.bookwriter = {};

  function csrfHeaders() {
    var token = (typeof window.getCsrfTokenValue === 'function')
      ? window.getCsrfTokenValue() : '';
    return { 'Content-Type': 'application/json', 'X-CSRFToken': token };
  }
  window.bookwriter.csrfHeaders = csrfHeaders;

  function _toJsonOrThrow(response) {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }

  function apiPost(urlPath, payload) {
    return fetch(urlPath, {
      method: 'POST',
      credentials: 'same-origin',
      headers: csrfHeaders(),
      body: JSON.stringify(payload || {}),
    }).then(_toJsonOrThrow);
  }
  window.bookwriter.apiPost = apiPost;

  function apiDelete(urlPath) {
    return fetch(urlPath, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': csrfHeaders()['X-CSRFToken'] },
    }).then(_toJsonOrThrow);
  }
  window.bookwriter.apiDelete = apiDelete;

  function apiGet(urlPath) {
    return fetch(urlPath, {
      credentials: 'same-origin',
    }).then(_toJsonOrThrow);
  }
  window.bookwriter.apiGet = apiGet;

  /* ====================================================
     wireTwoClickConfirmDelete — shared two-click delete
     pattern. First click swaps button into "confirm"
     state (different label + class). Second click within
     `confirmTimeoutMs` triggers `onConfirm`. Otherwise
     auto-resets back to the initial state.
  ==================================================== */
  function wireTwoClickConfirmDelete(buttonElement, options) {
    options = options || {};
    var confirmTimeoutMs = options.confirmTimeoutMs || 3000;
    var initialLabel    = options.initialLabel    || '\u00d7';
    var confirmingLabel = options.confirmingLabel || '\u2713';
    var confirmingClass = options.confirmingClass || 'is-confirming';
    var initialTitle    = options.initialTitle    || null;
    var confirmingTitle = options.confirmingTitle || null;
    var onConfirm       = options.onConfirm;
    if (typeof onConfirm !== 'function') return;

    var pendingConfirm = false;
    buttonElement.addEventListener('click', function (clickEvent) {
      clickEvent.stopPropagation();
      if (!pendingConfirm) {
        pendingConfirm = true;
        buttonElement.textContent = confirmingLabel;
        buttonElement.classList.add(confirmingClass);
        if (confirmingTitle !== null) buttonElement.title = confirmingTitle;
        setTimeout(function () {
          if (pendingConfirm) {
            pendingConfirm = false;
            buttonElement.textContent = initialLabel;
            buttonElement.classList.remove(confirmingClass);
            if (initialTitle !== null) buttonElement.title = initialTitle;
          }
        }, confirmTimeoutMs);
        return;
      }
      onConfirm(clickEvent);
    });
  }
  window.bookwriter.wireTwoClickConfirmDelete = wireTwoClickConfirmDelete;
})();
