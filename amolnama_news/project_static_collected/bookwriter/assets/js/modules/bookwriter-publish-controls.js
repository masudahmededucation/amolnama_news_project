/* ====================================================================
   কলম / Inkwell — Publish controls module (atomic)
   --------------------------------------------------------------------
   Wires the per-chapter publish / unpublish toggle inside the BOOK
   SETTINGS slide-out drawer. Talks to the already-shipped endpoints:
     POST /bookwriter/api/chapter/<id>/publish/
     POST /bookwriter/api/chapter/<id>/unpublish/
   via window.bookwriter.apiPost (CSRF + JSON contract handled there).

   The module is event-delegated on the section container so it
   survives DOM rebuilds (e.g. when chapters are added/reordered) and
   does not have to re-bind per row. Idempotent — guards against
   double-init when the script is included twice.

   No console.log / .debug / .info / .warn — only console.error inside
   .catch(). No alert / confirm / prompt.
   ==================================================================== */
(function () {
  'use strict';

  if (window.__bookwriterPublishControlsInitialized) return;
  window.__bookwriterPublishControlsInitialized = true;

  var SECTION_SELECTOR        = '.bookwriter-publish-controls-section';
  var ROW_SELECTOR            = '.bookwriter-publish-controls-row';
  var TOGGLE_BUTTON_SELECTOR  = '.bookwriter-publish-controls-row-toggle-button';
  var COPY_BUTTON_SELECTOR    = '.bookwriter-publish-controls-row-public-url-copy-button';
  var ROW_STATUS_SELECTOR     = '.bookwriter-publish-controls-row-status';
  var URL_BLOCK_SELECTOR      = '.bookwriter-publish-controls-row-public-url-block';
  var URL_INPUT_SELECTOR      = '.bookwriter-publish-controls-row-public-url-input';
  var MESSAGE_SELECTOR        = '.bookwriter-publish-controls-row-message';

  var STATUS_PUBLISHED_CLASS  = 'bookwriter-publish-controls-row-status-is-published';
  var BUTTON_PUBLISHED_CLASS  = 'bookwriter-publish-controls-row-toggle-button-is-published';
  var COPY_BUTTON_COPIED_CLASS = 'bookwriter-publish-controls-row-public-url-copy-button-is-copied';
  var MESSAGE_ERROR_CLASS     = 'bookwriter-publish-controls-row-message-is-error';
  var MESSAGE_SUCCESS_CLASS   = 'bookwriter-publish-controls-row-message-is-success';

  var COPY_FEEDBACK_VISIBLE_MS  = 1600;
  var STATUS_MESSAGE_VISIBLE_MS = 2200;

  function _findRowFromButton(buttonElement) {
    return buttonElement.closest(ROW_SELECTOR);
  }

  function _setRowMessage(rowElement, messageText, kind) {
    var messageElement = rowElement.querySelector(MESSAGE_SELECTOR);
    if (!messageElement) return;
    messageElement.textContent = messageText || '';
    messageElement.classList.remove(MESSAGE_ERROR_CLASS, MESSAGE_SUCCESS_CLASS);
    if (kind === 'error')   messageElement.classList.add(MESSAGE_ERROR_CLASS);
    if (kind === 'success') messageElement.classList.add(MESSAGE_SUCCESS_CLASS);
    if (messageText) {
      setTimeout(function () {
        if (messageElement.textContent === messageText) {
          messageElement.textContent = '';
          messageElement.classList.remove(MESSAGE_ERROR_CLASS, MESSAGE_SUCCESS_CLASS);
        }
      }, STATUS_MESSAGE_VISIBLE_MS);
    }
  }

  function _renderRowAsPublished(rowElement, publicUrlString) {
    var statusElement = rowElement.querySelector(ROW_STATUS_SELECTOR);
    if (statusElement) {
      statusElement.textContent = 'Live';
      statusElement.classList.add(STATUS_PUBLISHED_CLASS);
    }

    var toggleButtonElement = rowElement.querySelector(TOGGLE_BUTTON_SELECTOR);
    if (toggleButtonElement) {
      toggleButtonElement.dataset.bookwriterPublishAction = 'unpublish';
      toggleButtonElement.classList.add(BUTTON_PUBLISHED_CLASS);
      toggleButtonElement.textContent = 'Unpublish';
    }

    var urlBlockElement = rowElement.querySelector(URL_BLOCK_SELECTOR);
    if (urlBlockElement) {
      urlBlockElement.hidden = false;
      var urlInputElement = urlBlockElement.querySelector(URL_INPUT_SELECTOR);
      if (urlInputElement && publicUrlString) {
        urlInputElement.value = publicUrlString;
      }
    }
  }

  function _renderRowAsUnpublished(rowElement) {
    var statusElement = rowElement.querySelector(ROW_STATUS_SELECTOR);
    if (statusElement) {
      statusElement.textContent = 'Draft';
      statusElement.classList.remove(STATUS_PUBLISHED_CLASS);
    }

    var toggleButtonElement = rowElement.querySelector(TOGGLE_BUTTON_SELECTOR);
    if (toggleButtonElement) {
      toggleButtonElement.dataset.bookwriterPublishAction = 'publish';
      toggleButtonElement.classList.remove(BUTTON_PUBLISHED_CLASS);
      toggleButtonElement.textContent = 'Publish';
    }

    var urlBlockElement = rowElement.querySelector(URL_BLOCK_SELECTOR);
    if (urlBlockElement) {
      urlBlockElement.hidden = true;
    }
  }

  function _handleToggleButtonClick(toggleButtonElement) {
    var rowElement = _findRowFromButton(toggleButtonElement);
    if (!rowElement) return;

    var chapterIdString = rowElement.dataset.bookwriterChapterId;
    if (!chapterIdString) return;

    var actionString = toggleButtonElement.dataset.bookwriterPublishAction || 'publish';
    var targetUrlPath =
      '/bookwriter/api/chapter/' + encodeURIComponent(chapterIdString)
      + (actionString === 'unpublish' ? '/unpublish/' : '/publish/');

    if (!window.bookwriter || typeof window.bookwriter.apiPost !== 'function') {
      _setRowMessage(rowElement, 'Could not reach the server. Try again.', 'error');
      return;
    }

    toggleButtonElement.disabled = true;
    _setRowMessage(rowElement, '');

    window.bookwriter.apiPost(targetUrlPath, {})
      .then(function (responseJson) {
        toggleButtonElement.disabled = false;
        if (!responseJson || responseJson.ok !== true) {
          _setRowMessage(rowElement, 'Server rejected the change. Try again.', 'error');
          return;
        }
        if (actionString === 'publish') {
          var publicUrlString =
            (responseJson.serial_release && responseJson.serial_release.public_url)
            || '';
          _renderRowAsPublished(rowElement, publicUrlString);
          _setRowMessage(rowElement, 'Published. Anyone with the link can read it.', 'success');
        } else {
          _renderRowAsUnpublished(rowElement);
          _setRowMessage(rowElement, 'Unpublished. The public link is no longer live.', 'success');
        }
      })
      .catch(function (publishToggleError) {
        toggleButtonElement.disabled = false;
        _setRowMessage(rowElement, 'Network error. Try again.', 'error');
        console.error('bookwriter publish-controls: toggle failed', publishToggleError);
      });
  }

  function _handleCopyButtonClick(copyButtonElement) {
    var rowElement = _findRowFromButton(copyButtonElement);
    if (!rowElement) return;
    var urlInputElement = rowElement.querySelector(URL_INPUT_SELECTOR);
    if (!urlInputElement) return;
    var urlText = urlInputElement.value || '';
    if (!urlText) return;

    function _markCopiedFeedback() {
      copyButtonElement.classList.add(COPY_BUTTON_COPIED_CLASS);
      var originalLabel = copyButtonElement.textContent;
      copyButtonElement.textContent = 'Copied';
      setTimeout(function () {
        copyButtonElement.classList.remove(COPY_BUTTON_COPIED_CLASS);
        copyButtonElement.textContent = originalLabel;
      }, COPY_FEEDBACK_VISIBLE_MS);
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(urlText)
        .then(_markCopiedFeedback)
        .catch(function (clipboardWriteError) {
          // Fall back to legacy execCommand path
          urlInputElement.select();
          urlInputElement.setSelectionRange(0, urlText.length);
          try {
            document.execCommand('copy');
            _markCopiedFeedback();
          } catch (legacyExecCommandError) {
            _setRowMessage(rowElement, 'Could not copy. Select the text and copy manually.', 'error');
            console.error('bookwriter publish-controls: clipboard failed', clipboardWriteError, legacyExecCommandError);
          }
        });
      return;
    }
    // Browsers without async Clipboard API
    urlInputElement.select();
    urlInputElement.setSelectionRange(0, urlText.length);
    try {
      document.execCommand('copy');
      _markCopiedFeedback();
    } catch (legacyExecCommandError) {
      _setRowMessage(rowElement, 'Could not copy. Select the text and copy manually.', 'error');
      console.error('bookwriter publish-controls: legacy copy failed', legacyExecCommandError);
    }
  }

  /* ---- Wire one section (idempotent on data-flag) ---- */
  function _wirePublishControlsSection(sectionElement) {
    if (sectionElement.dataset.bookwriterPublishControlsWired === 'true') return;
    sectionElement.dataset.bookwriterPublishControlsWired = 'true';

    sectionElement.addEventListener('click', function (sectionClickEvent) {
      var toggleButtonElement = sectionClickEvent.target.closest(TOGGLE_BUTTON_SELECTOR);
      if (toggleButtonElement) {
        _handleToggleButtonClick(toggleButtonElement);
        return;
      }
      var copyButtonElement = sectionClickEvent.target.closest(COPY_BUTTON_SELECTOR);
      if (copyButtonElement) {
        _handleCopyButtonClick(copyButtonElement);
        return;
      }
    });
  }

  function _wireAllPublishControlsSections() {
    var sectionElements = document.querySelectorAll(SECTION_SELECTOR);
    for (var sectionIndex = 0; sectionIndex < sectionElements.length; sectionIndex++) {
      _wirePublishControlsSection(sectionElements[sectionIndex]);
    }
  }

  /* ----------------------------------------------------------------
     Publish ALL chapters — bulk action button at the top of the
     Gallery view (Publish tab). Calls
       POST /bookwriter/api/book/<id>/publish-all/
     which loops through every active chapter that has at least one
     word and publishes it, reusing the same per-chapter helper as
     the per-row Publish button (single source of truth on the
     server, see views_api_helpers.publish_one_chapter_into_serial_release).

     On success we reload the page so the dashboard counts + per-row
     status chips + public URLs all refresh in one pass — DRY-er than
     re-rendering each row in JS, and matches the behaviour of every
     other server-rendered surface in the inkwell.
  ---------------------------------------------------------------- */
  var PUBLISH_ALL_BUTTON_ID  = 'bookwriter-gallery-publish-all-button';
  var PUBLISH_ALL_MESSAGE_ID = 'bookwriter-gallery-publish-all-message';
  var PUBLISH_ALL_RELOAD_DELAY_MS = 900;

  function _setPublishAllMessage(messageElement, messageText, kind) {
    if (!messageElement) return;
    messageElement.textContent = messageText || '';
    messageElement.classList.remove(
      'bookwriter-gallery-publish-all-message-is-error',
      'bookwriter-gallery-publish-all-message-is-success',
    );
    if (kind === 'error') {
      messageElement.classList.add('bookwriter-gallery-publish-all-message-is-error');
    }
    if (kind === 'success') {
      messageElement.classList.add('bookwriter-gallery-publish-all-message-is-success');
    }
  }

  function _wirePublishAllButton() {
    var publishAllButtonElement = document.getElementById(PUBLISH_ALL_BUTTON_ID);
    if (publishAllButtonElement === null) return;
    if (publishAllButtonElement.dataset.bookwriterPublishAllWired === 'true') return;
    publishAllButtonElement.dataset.bookwriterPublishAllWired = 'true';

    var publishAllMessageElement = document.getElementById(PUBLISH_ALL_MESSAGE_ID);

    publishAllButtonElement.addEventListener('click', function () {
      if (publishAllButtonElement.disabled) return;
      var endpointUrlString = publishAllButtonElement.dataset.bookwriterPublishAllEndpoint || '';
      if (!endpointUrlString) {
        _setPublishAllMessage(publishAllMessageElement, 'Cannot reach the publish endpoint.', 'error');
        return;
      }

      if (!window.bookwriter || typeof window.bookwriter.apiPost !== 'function') {
        _setPublishAllMessage(publishAllMessageElement, 'Publish service not loaded — refresh the page.', 'error');
        return;
      }

      publishAllButtonElement.disabled = true;
      _setPublishAllMessage(publishAllMessageElement, 'Publishing chapters…');

      window.bookwriter.apiPost(endpointUrlString, {})
        .then(function (responseJson) {
          if (!responseJson || responseJson.ok !== true) {
            publishAllButtonElement.disabled = false;
            _setPublishAllMessage(publishAllMessageElement, 'Server rejected the bulk publish. Try again.', 'error');
            return;
          }
          var newlyPublished = parseInt(responseJson.newly_published_count || 0, 10);
          var alreadyLive    = parseInt(responseJson.already_live_count || 0, 10);
          var skippedEmpty   = parseInt(responseJson.skipped_empty_count || 0, 10);
          var summaryParts = [];
          if (newlyPublished > 0) {
            summaryParts.push('Published ' + newlyPublished + ' chapter' + (newlyPublished === 1 ? '' : 's') + '.');
          }
          if (alreadyLive > 0) {
            summaryParts.push(alreadyLive + ' already live.');
          }
          if (skippedEmpty > 0) {
            summaryParts.push('Skipped ' + skippedEmpty + ' empty chapter' + (skippedEmpty === 1 ? '' : 's') + ' (no content).');
          }
          if (summaryParts.length === 0) {
            summaryParts.push('No chapters to publish.');
          }
          _setPublishAllMessage(publishAllMessageElement, summaryParts.join(' ') + ' Refreshing…', 'success');
          // Reload so every dashboard counter + per-row status chip
          // reflects the fresh server state in one consistent pass.
          setTimeout(function () { window.location.reload(); }, PUBLISH_ALL_RELOAD_DELAY_MS);
        })
        .catch(function (publishAllError) {
          publishAllButtonElement.disabled = false;
          _setPublishAllMessage(publishAllMessageElement, 'Network error. Try again.', 'error');
          console.error('bookwriter publish-controls: publish-all failed', publishAllError);
        });
    });
  }

  function _wireEverything() {
    _wireAllPublishControlsSections();
    _wirePublishAllButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _wireEverything, { once: true });
  } else {
    _wireEverything();
  }

})();
