/* ============================================================
   Bookwriter — public reader page interactivity
   --------------------------------------------------------
   Wires: subscribe toggle, reaction toggles, comment thread,
   per-read view tracking, beta-mode inline highlight overlay.

   All API calls go through window.bookwriter.{apiPost, apiDelete,
   apiGet} (defined in modules/bookwriter-namespace.js, loaded
   first via the template). CSRF + JSON shape + non-2xx-rejects
   are handled there once. Each call site wraps its own .catch()
   for UI fallback (revert optimistic toggle, leave row, etc).
   ============================================================ */
(function () {
  'use strict';

  /* ========================================================
     SUBSCRIBE TOGGLE — flips +/✓ + label, updates aria-pressed
     ======================================================== */
  var subscribeButtonElement = document.getElementById('bookwriter-reader-subscribe-button');
  if (subscribeButtonElement) {
    subscribeButtonElement.addEventListener('click', function () {
      var bookId = subscribeButtonElement.dataset.bookId;
      if (!bookId) return;

      // Optimistic toggle for instant feedback; reverts on failure.
      var wasSubscribed = subscribeButtonElement.classList.contains('bookwriter-is-subscribed');
      applySubscribeButtonState(!wasSubscribed);

      window.bookwriter.apiPost('/bookwriter/api/book/' + encodeURIComponent(bookId) + '/subscribe/toggle/', {})
        .then(function (data) {
          // Server is the source of truth — apply whatever it returned.
          applySubscribeButtonState(!!data.is_subscribed);
        })
        .catch(function () {
          // Revert optimistic toggle.
          applySubscribeButtonState(wasSubscribed);
        });
    });
  }

  function applySubscribeButtonState(isSubscribed) {
    if (!subscribeButtonElement) return;
    subscribeButtonElement.classList.toggle('bookwriter-is-subscribed', isSubscribed);
    subscribeButtonElement.setAttribute('aria-pressed', isSubscribed ? 'true' : 'false');
    var iconElement = subscribeButtonElement.querySelector('.bookwriter-reader-subscribe-icon');
    var labelElement = subscribeButtonElement.querySelector('.bookwriter-reader-subscribe-label');
    if (iconElement) iconElement.textContent = isSubscribed ? '\u2713' : '+';
    if (labelElement) labelElement.textContent = isSubscribed ? 'Subscribed' : 'Subscribe to next chapter';
  }


  /* ========================================================
     REACTION TOGGLE — flips active class + count, optimistic
     ======================================================== */
  var reactionStripElement = document.getElementById('bookwriter-reader-reaction-strip');
  if (reactionStripElement) {
    var serialReleaseId = reactionStripElement.dataset.serialReleaseId;
    reactionStripElement.querySelectorAll('.bookwriter-reader-reaction-button').forEach(function (reactionButton) {
      reactionButton.addEventListener('click', function () {
        if (reactionButton.classList.contains('bookwriter-is-disabled')) return;
        if (!serialReleaseId) return;
        var reactionKindCode = reactionButton.dataset.reactionKindCode;
        if (!reactionKindCode) return;

        var wasReacted = reactionButton.classList.contains('bookwriter-is-reacted');
        var countElement = reactionButton.querySelector('.bookwriter-reader-reaction-count');
        var previousCount = parseInt(countElement.textContent, 10) || 0;
        var optimisticCount = wasReacted ? Math.max(0, previousCount - 1) : previousCount + 1;
        applyReactionButtonState(reactionButton, !wasReacted, optimisticCount);

        window.bookwriter.apiPost('/bookwriter/api/release/' + encodeURIComponent(serialReleaseId) + '/reaction/toggle/', { reaction_kind_code: reactionKindCode })
          .then(function (data) {
            // Server-truth — overwrite optimistic state.
            applyReactionButtonState(reactionButton, !!data.is_reacted, optimisticCount);
            // Note: API returns total reactions across ALL kinds, so we
            // can't trust it for this single kind's count. Keep optimistic.
          })
          .catch(function () {
            applyReactionButtonState(reactionButton, wasReacted, previousCount);
          });
      });
    });
  }

  function applyReactionButtonState(buttonElement, isReacted, nextCount) {
    buttonElement.classList.toggle('bookwriter-is-reacted', isReacted);
    buttonElement.setAttribute('aria-pressed', isReacted ? 'true' : 'false');
    var countElement = buttonElement.querySelector('.bookwriter-reader-reaction-count');
    if (countElement) countElement.textContent = String(nextCount);
  }


  /* ========================================================
     COMMENTS — post / reply / delete / pin
     --------------------------------------------------------
     Server-rendered list paints first; JS handles add/remove.
     Pin and delete are one-click (no confirm) since the action
     is reversible and the row reappears on page reload until
     it's permanently filtered server-side. ================ */
  var commentsSection = document.getElementById('bookwriter-reader-comments-section');
  if (commentsSection) {
    var commentsSerialReleaseId = commentsSection.dataset.serialReleaseId;
    var commentListElement = document.getElementById('bookwriter-reader-comment-list');
    var commentCountElement = document.getElementById('bookwriter-reader-comments-count');

    // New top-level comment
    var newCommentSubmitButton = document.getElementById('bookwriter-reader-comment-new-submit-button');
    if (newCommentSubmitButton) {
      newCommentSubmitButton.addEventListener('click', function () {
        var textarea = document.getElementById('bookwriter-reader-comment-new-textarea');
        if (!textarea) return;
        var commentText = (textarea.value || '').trim();
        if (!commentText) return;
        postCommentToServer(commentText, null, function (commentRecord) {
          textarea.value = '';
          appendCommentRowToList(commentRecord, null);
        });
      });
    }

    // Wire reply / pin / delete buttons on server-rendered rows
    commentListElement.querySelectorAll('.bookwriter-reader-comment-row').forEach(wireCommentRowAffordances);
  }

  function postCommentToServer(commentText, parentCommentId, onSuccess) {
    if (!commentsSerialReleaseId) return;
    window.bookwriter.apiPost('/bookwriter/api/release/' + encodeURIComponent(commentsSerialReleaseId) + '/comment/create/', { comment_text: commentText, parent_id: parentCommentId })
      .then(function (data) {
        if (commentCountElement && typeof data.comment_count === 'number') {
          commentCountElement.textContent = String(data.comment_count);
        }
        if (typeof onSuccess === 'function') onSuccess(data.comment);
      })
      .catch(function () { /* user can retry; textarea kept populated */ });
  }

  function appendCommentRowToList(commentRecord, parentCommentId) {
    if (!commentRecord || !commentListElement) return;
    var rowElement = document.createElement('article');
    rowElement.className = 'bookwriter-reader-comment-row' + (parentCommentId ? ' bookwriter-is-reply' : '');
    rowElement.id = 'bookwriter-reader-comment-' + commentRecord.id;
    rowElement.dataset.commentId = String(commentRecord.id);
    rowElement.dataset.parentCommentId = parentCommentId == null ? '' : String(parentCommentId);

    var headerHtml =
      '<header class="bookwriter-reader-comment-header">' +
        '<span class="bookwriter-reader-comment-author">You</span>' +
        '<time class="bookwriter-reader-comment-time" datetime="' + escapeAttribute(commentRecord.created_at || '') + '">' + escapeAttribute(commentRecord.created_at || 'just now') + '</time>' +
      '</header>';
    var bodyEl = document.createElement('p');
    bodyEl.className = 'bookwriter-reader-comment-body';
    bodyEl.textContent = commentRecord.text || '';

    var footerEl = document.createElement('footer');
    footerEl.className = 'bookwriter-reader-comment-footer';
    var deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'bookwriter-reader-comment-delete-button';
    deleteButton.id = 'bookwriter-reader-comment-' + commentRecord.id + '-delete-button';
    deleteButton.name = 'bookwriter_reader_comment_' + commentRecord.id + '_delete_button';
    deleteButton.dataset.targetCommentId = String(commentRecord.id);
    deleteButton.textContent = 'Delete';
    footerEl.appendChild(deleteButton);

    rowElement.insertAdjacentHTML('beforeend', headerHtml);
    rowElement.appendChild(bodyEl);
    rowElement.appendChild(footerEl);

    if (parentCommentId) {
      var parentRow = document.getElementById('bookwriter-reader-comment-' + parentCommentId);
      if (parentRow && parentRow.parentNode) parentRow.parentNode.insertBefore(rowElement, parentRow.nextSibling);
      else commentListElement.appendChild(rowElement);
    } else {
      commentListElement.insertBefore(rowElement, commentListElement.firstChild);
    }
    wireCommentRowAffordances(rowElement);
  }

  function escapeAttribute(rawValue) {
    return String(rawValue == null ? '' : rawValue)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function wireCommentRowAffordances(rowElement) {
    if (rowElement.dataset.wired === '1') return;
    rowElement.dataset.wired = '1';

    var replyToggleButton = rowElement.querySelector('.bookwriter-reader-comment-reply-toggle-button');
    if (replyToggleButton) {
      replyToggleButton.addEventListener('click', function () {
        toggleReplyFormUnderRow(rowElement, replyToggleButton.dataset.targetCommentId);
      });
    }

    var pinButton = rowElement.querySelector('.bookwriter-reader-comment-pin-button');
    if (pinButton) {
      pinButton.addEventListener('click', function () {
        var commentId = pinButton.dataset.targetCommentId;
        var nextPinned = pinButton.dataset.isPinned !== '1';
        window.bookwriter.apiPost('/bookwriter/api/serial-comment/' + encodeURIComponent(commentId) + '/pin/', { is_pinned: nextPinned })
          .then(function (data) {
            var isNowPinned = !!data.is_pinned;
            pinButton.dataset.isPinned = isNowPinned ? '1' : '0';
            pinButton.textContent = isNowPinned ? 'Unpin' : 'Pin';
            rowElement.classList.toggle('bookwriter-is-pinned', isNowPinned);
          })
          .catch(function () { /* leave UI as-is */ });
      });
    }

    var deleteButton = rowElement.querySelector('.bookwriter-reader-comment-delete-button');
    if (deleteButton) {
      deleteButton.addEventListener('click', function () {
        var commentId = deleteButton.dataset.targetCommentId;
        window.bookwriter.apiDelete('/bookwriter/api/serial-comment/' + encodeURIComponent(commentId) + '/delete/')
          .then(function () {
            rowElement.parentNode.removeChild(rowElement);
            if (commentCountElement) {
              var current = parseInt(commentCountElement.textContent, 10) || 0;
              commentCountElement.textContent = String(Math.max(0, current - 1));
            }
          })
          .catch(function () { /* leave row */ });
      });
    }
  }

  /* ========================================================
     VIEW TRACKING — single fetch on mount
     --------------------------------------------------------
     Records a row in engagement_serial_view so the writer's
     analytics dashboard can show read counts. Lightweight —
     fires once after page paint, fire-and-forget. Logged-in
     reads carry user_profile_id (server-resolved); anon reads
     get session_hash. Detects device class from screen width
     and referrer source from document.referrer host. ======= */
  (function recordPublicReaderView() {
    var releaseIdInput = document.getElementById('bookwriter-reader-serial-release-id');
    if (!releaseIdInput || !releaseIdInput.value) return;
    var serialReleaseIdToTrack = releaseIdInput.value;

    // Device classification — must use codes that exist in
    // ref_view_device (mobile / tablet / desktop / unknown).
    var deviceCode = 'desktop';
    var screenWidth = window.innerWidth || 0;
    if (screenWidth > 0 && screenWidth < 600) deviceCode = 'mobile';
    else if (screenWidth >= 600 && screenWidth < 1024) deviceCode = 'tablet';

    // Referrer source — must use codes that exist in
    // ref_view_referrer (direct / search / social / email / rss /
    // internal / unknown). External non-search non-social referrers
    // are bucketed as 'unknown' since 'external' is not seeded.
    var referrerCode = 'direct';
    if (document.referrer) {
      try {
        var referrerHost = new URL(document.referrer).hostname.toLowerCase();
        if (referrerHost === window.location.hostname) referrerCode = 'internal';
        else if (/google\.|bing\.|duckduckgo\.|search/.test(referrerHost)) referrerCode = 'search';
        else if (/facebook\.|twitter\.|x\.com|linkedin\.|reddit\./.test(referrerHost)) referrerCode = 'social';
        else if (referrerHost) referrerCode = 'unknown';
      } catch (urlParseError) {
        // Malformed referrer header — leave as 'direct'
      }
    }

    window.bookwriter.apiPost('/bookwriter/api/release/' + encodeURIComponent(serialReleaseIdToTrack) + '/view/', {
        view_seconds: 0,
        view_completion_pct: 0,
        view_referrer_code: referrerCode,
        view_device_code: deviceCode,
      }).catch(function () { /* analytics is best-effort */ });
  })();


  /* ========================================================
     PREVIEW IMPRESSIONS — IntersectionObserver on TOC rows
     --------------------------------------------------------
     Each TOC row that points at a different chapter than the
     one being read carries data-preview-release-id="<id>".
     When at least 50% of the row scrolls into view, fire a
     single POST /api/release/<id>/preview-impression/. The
     observer is disconnected per-row after firing so we don't
     re-bump on scroll oscillation. Best-effort analytics —
     silent on failure. ==================================== */
  (function watchTocPreviewImpressions() {
    if (typeof IntersectionObserver !== 'function') return;
    var tocRowsWithReleaseId = document.querySelectorAll(
      '.bookwriter-reader-toc-item[data-preview-release-id]'
    );
    if (tocRowsWithReleaseId.length === 0) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var rowElement = entry.target;
        if (rowElement.dataset.impressionFired === '1') return;
        rowElement.dataset.impressionFired = '1';
        observer.unobserve(rowElement);
        var releaseIdToBump = rowElement.dataset.previewReleaseId;
        window.bookwriter.apiPost('/bookwriter/api/release/' + encodeURIComponent(releaseIdToBump) + '/preview-impression/', {}).catch(function () { /* best-effort */ });
      });
    }, { threshold: 0.5 });

    tocRowsWithReleaseId.forEach(function (rowElement) { observer.observe(rowElement); });
  })();


  /* ========================================================
     BETA INLINE HIGHLIGHTS — wrap anchored prose ranges in <mark>
     --------------------------------------------------------
     For every beta comment with comment_anchor_offset/length, find
     the corresponding plain-text range inside the chapter prose and
     wrap it with a <mark class="bookwriter-beta-anchor"> tag pointing
     at the comment id. Click on the mark scrolls the sidebar to the
     comment row + flashes its background.

     Stale anchors (writer edited the prose so offsets shifted) fall
     back to comment_anchor_text substring search; if neither matches,
     the comment shows in the sidebar without a highlight.
  ======================================================== */
  function applyBetaInlineHighlights() {
    var proseElement = document.querySelector('.bookwriter-reader-prose');
    if (!proseElement) return;
    // Collect anchored beta comments from the server-rendered sidebar
    // rows (data attributes carry offset/length/anchor-text per row)
    var anchoredRows = document.querySelectorAll('.bookwriter-beta-comment-row[data-anchor-offset]');
    if (anchoredRows.length === 0) return;
    // Sort by offset ascending so we can apply highlights in order
    var anchorRecords = [];
    anchoredRows.forEach(function (rowElement) {
      var offset = parseInt(rowElement.dataset.anchorOffset, 10);
      var length = parseInt(rowElement.dataset.anchorLength, 10);
      var anchorText = rowElement.dataset.anchorText || '';
      var commentId = rowElement.dataset.betaCommentId;
      if (Number.isFinite(offset) && Number.isFinite(length) && length > 0 && commentId) {
        anchorRecords.push({ offset: offset, length: length, anchorText: anchorText, commentId: commentId });
      }
    });
    anchorRecords.sort(function (a, b) { return a.offset - b.offset; });

    // Build a flat list of text-node positions so we can map char-offsets
    // to (textNode, nodeOffset). Walks the prose subtree once.
    var textNodeList = [];
    var totalCharsCovered = 0;
    var walker = document.createTreeWalker(proseElement, NodeFilter.SHOW_TEXT, null);
    var currentTextNode = walker.nextNode();
    while (currentTextNode) {
      textNodeList.push({
        node: currentTextNode,
        startOffset: totalCharsCovered,
        endOffset: totalCharsCovered + currentTextNode.textContent.length,
      });
      totalCharsCovered += currentTextNode.textContent.length;
      currentTextNode = walker.nextNode();
    }

    function findRangePositionInTextNodes(targetOffset, targetLength) {
      // Returns a Range, or null on miss.
      var startNodeRecord = null;
      var startInNodeOffset = 0;
      var endNodeRecord = null;
      var endInNodeOffset = 0;
      var targetEnd = targetOffset + targetLength;
      for (var i = 0; i < textNodeList.length; i++) {
        var rec = textNodeList[i];
        if (startNodeRecord === null && targetOffset >= rec.startOffset && targetOffset < rec.endOffset) {
          startNodeRecord = rec;
          startInNodeOffset = targetOffset - rec.startOffset;
        }
        if (targetEnd > rec.startOffset && targetEnd <= rec.endOffset) {
          endNodeRecord = rec;
          endInNodeOffset = targetEnd - rec.startOffset;
          break;
        }
      }
      if (startNodeRecord === null || endNodeRecord === null) return null;
      var range = document.createRange();
      try {
        range.setStart(startNodeRecord.node, startInNodeOffset);
        range.setEnd(endNodeRecord.node, endInNodeOffset);
      } catch (rangeError) {
        return null;
      }
      return range;
    }

    function findRangeByAnchorTextSearch(anchorText) {
      if (!anchorText) return null;
      var fullText = proseElement.textContent || '';
      var anchorIndex = fullText.indexOf(anchorText);
      if (anchorIndex === -1) return null;
      return findRangePositionInTextNodes(anchorIndex, anchorText.length);
    }

    // Apply each anchor in REVERSE order so earlier wrap operations
    // don't invalidate later offsets (later anchors live in nodes that
    // haven't been touched yet).
    for (var i = anchorRecords.length - 1; i >= 0; i--) {
      var rec = anchorRecords[i];
      var range = findRangePositionInTextNodes(rec.offset, rec.length);
      if (range === null) {
        range = findRangeByAnchorTextSearch(rec.anchorText);
      }
      if (range === null) continue;
      var markElement = document.createElement('mark');
      markElement.className = 'bookwriter-beta-anchor';
      markElement.dataset.betaCommentId = rec.commentId;
      try {
        range.surroundContents(markElement);
      } catch (surroundError) {
        // Range crosses element boundaries — skip silently.
        continue;
      }
      markElement.addEventListener('click', function (clickEvent) {
        var targetCommentId = clickEvent.currentTarget.dataset.betaCommentId;
        var commentRow = document.getElementById('bookwriter-beta-comment-' + targetCommentId);
        if (!commentRow) return;
        commentRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        commentRow.classList.add('bookwriter-is-highlight-flash');
        setTimeout(function () { commentRow.classList.remove('bookwriter-is-highlight-flash'); }, 1600);
      });
    }
  }

  // Run after the beta sidebar wiring (document order ensures sidebar
  // exists before we try to read its rows).
  if (document.querySelector('.bookwriter-beta-comments-sidebar')) {
    applyBetaInlineHighlights();
  }


  /* ========================================================
     BETA COMMENTS — beta-reader sidebar (chapter-anchored)
     --------------------------------------------------------
     Wires the new-comment form + per-row resolve/delete on
     the beta reader sidebar (only present in beta mode).
  ======================================================== */
  var betaSidebar = document.getElementById('bookwriter-beta-comments-sidebar');
  if (betaSidebar) {
    var betaChapterId = betaSidebar.dataset.chapterId;
    var betaReaderId = betaSidebar.dataset.betaReaderId;
    var betaCommentList = document.getElementById('bookwriter-beta-comment-list');
    var betaCommentCount = document.getElementById('bookwriter-beta-comments-count');

    // Capture the user's current selection inside .bookwriter-reader-prose
    // so a new comment can be anchored to the selected passage.
    var pendingAnchorRecord = null;
    var proseElementForSelection = document.querySelector('.bookwriter-reader-prose');
    if (proseElementForSelection) {
      document.addEventListener('selectionchange', function () {
        var selection = document.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
          pendingAnchorRecord = null;
          return;
        }
        var range = selection.getRangeAt(0);
        if (!proseElementForSelection.contains(range.startContainer) ||
            !proseElementForSelection.contains(range.endContainer)) {
          pendingAnchorRecord = null;
          return;
        }
        // Compute char-offset within the prose by summing text lengths
        // up to the start node + adding the in-node start offset.
        var totalCharsBeforeStart = 0;
        var walker = document.createTreeWalker(proseElementForSelection, NodeFilter.SHOW_TEXT, null);
        var currentTextNode = walker.nextNode();
        while (currentTextNode && currentTextNode !== range.startContainer) {
          totalCharsBeforeStart += currentTextNode.textContent.length;
          currentTextNode = walker.nextNode();
        }
        var anchorStartOffset = totalCharsBeforeStart + range.startOffset;
        var anchorTextSelected = selection.toString();
        pendingAnchorRecord = {
          offset: anchorStartOffset,
          length: anchorTextSelected.length,
          text: anchorTextSelected.slice(0, 500),
        };
      });
    }

    var betaSubmitButton = document.getElementById('bookwriter-beta-comment-new-submit-button');
    if (betaSubmitButton && betaReaderId) {
      betaSubmitButton.addEventListener('click', function () {
        var textarea = document.getElementById('bookwriter-beta-comment-new-textarea');
        var kindSelect = document.getElementById('bookwriter-beta-comment-kind-select');
        if (!textarea || !kindSelect) return;
        var commentText = (textarea.value || '').trim();
        if (!commentText) return;
        var requestPayload = {
          beta_reader_id: parseInt(betaReaderId, 10),
          comment_text: commentText,
          comment_kind_code: kindSelect.value || 'comment',
        };
        if (pendingAnchorRecord) {
          requestPayload.comment_anchor_offset = pendingAnchorRecord.offset;
          requestPayload.comment_anchor_length = pendingAnchorRecord.length;
          requestPayload.comment_anchor_text = pendingAnchorRecord.text;
        }
        window.bookwriter.apiPost('/bookwriter/api/chapter/' + encodeURIComponent(betaChapterId) + '/beta-comment/create/', requestPayload)
          .then(function (data) {
            textarea.value = '';
            appendBetaCommentRow(data.beta_comment || {});
            if (betaCommentCount) {
              betaCommentCount.textContent = String((parseInt(betaCommentCount.textContent, 10) || 0) + 1);
            }
          })
          .catch(function () { /* leave textarea populated */ });
      });
    }

    betaCommentList.querySelectorAll('.bookwriter-beta-comment-row').forEach(wireBetaCommentRowAffordances);
  }

  function appendBetaCommentRow(commentRecord) {
    var listEl = document.getElementById('bookwriter-beta-comment-list');
    if (!listEl || !commentRecord.id) return;
    var rowEl = document.createElement('article');
    rowEl.className = 'bookwriter-beta-comment-row';
    rowEl.id = 'bookwriter-beta-comment-' + commentRecord.id;
    rowEl.dataset.betaCommentId = String(commentRecord.id);

    var headerEl = document.createElement('header');
    headerEl.className = 'bookwriter-beta-comment-header';
    var kindEl = document.createElement('span');
    kindEl.className = 'bookwriter-beta-comment-kind';
    kindEl.textContent = commentRecord.kind || 'comment';
    var timeEl = document.createElement('time');
    timeEl.className = 'bookwriter-beta-comment-time';
    var nowIso = commentRecord.created_at || new Date().toISOString();
    timeEl.dateTime = nowIso;
    timeEl.textContent = nowIso;
    headerEl.appendChild(kindEl);
    headerEl.appendChild(timeEl);

    var bodyEl = document.createElement('p');
    bodyEl.className = 'bookwriter-beta-comment-body';
    bodyEl.textContent = commentRecord.text || '';

    var footerEl = document.createElement('footer');
    footerEl.className = 'bookwriter-beta-comment-footer';
    var deleteEl = document.createElement('button');
    deleteEl.type = 'button';
    deleteEl.className = 'bookwriter-beta-comment-delete-button';
    deleteEl.id = 'bookwriter-beta-comment-' + commentRecord.id + '-delete-button';
    deleteEl.name = 'bookwriter_beta_comment_' + commentRecord.id + '_delete_button';
    deleteEl.dataset.targetCommentId = String(commentRecord.id);
    deleteEl.textContent = 'Delete';
    footerEl.appendChild(deleteEl);

    rowEl.appendChild(headerEl);
    rowEl.appendChild(bodyEl);
    rowEl.appendChild(footerEl);
    listEl.insertBefore(rowEl, listEl.firstChild);
    wireBetaCommentRowAffordances(rowEl);
  }

  function wireBetaCommentRowAffordances(rowElement) {
    if (rowElement.dataset.wired === '1') return;
    rowElement.dataset.wired = '1';

    var resolveButton = rowElement.querySelector('.bookwriter-beta-comment-resolve-button');
    if (resolveButton) {
      resolveButton.addEventListener('click', function () {
        var commentId = resolveButton.dataset.targetCommentId;
        var nextResolved = resolveButton.dataset.isResolved !== '1';
        window.bookwriter.apiPost('/bookwriter/api/beta-comment/' + encodeURIComponent(commentId) + '/resolve/', { is_resolved: nextResolved })
          .then(function () {
            resolveButton.dataset.isResolved = nextResolved ? '1' : '0';
            resolveButton.textContent = nextResolved ? 'Reopen' : 'Resolve';
            rowElement.classList.toggle('bookwriter-is-resolved', nextResolved);
          })
          .catch(function () { /* leave UI */ });
      });
    }

    var deleteButton = rowElement.querySelector('.bookwriter-beta-comment-delete-button');
    if (deleteButton) {
      deleteButton.addEventListener('click', function () {
        var commentId = deleteButton.dataset.targetCommentId;
        window.bookwriter.apiDelete('/bookwriter/api/beta-comment/' + encodeURIComponent(commentId) + '/delete/')
          .then(function () {
            rowElement.parentNode.removeChild(rowElement);
            var countEl = document.getElementById('bookwriter-beta-comments-count');
            if (countEl) countEl.textContent = String(Math.max(0, (parseInt(countEl.textContent, 10) || 0) - 1));
          })
          .catch(function () { /* leave row */ });
      });
    }
  }


  function toggleReplyFormUnderRow(parentRowElement, parentCommentId) {
    var existingForm = parentRowElement.querySelector(':scope > .bookwriter-reader-comment-reply-form');
    if (existingForm) { existingForm.parentNode.removeChild(existingForm); return; }

    var formElement = document.createElement('form');
    formElement.className = 'bookwriter-reader-comment-form bookwriter-reader-comment-reply-form';
    formElement.onsubmit = function () { return false; };
    var textarea = document.createElement('textarea');
    textarea.className = 'bookwriter-reader-comment-textarea';
    textarea.id = 'bookwriter-reader-comment-' + parentCommentId + '-reply-textarea';
    textarea.name = 'bookwriter_reader_comment_' + parentCommentId + '_reply_textarea';
    textarea.placeholder = 'Reply…';
    textarea.rows = 2;
    textarea.maxLength = 4000;
    var submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'bookwriter-reader-comment-submit-button';
    submit.id = 'bookwriter-reader-comment-' + parentCommentId + '-reply-submit-button';
    submit.name = 'bookwriter_reader_comment_' + parentCommentId + '_reply_submit_button';
    submit.textContent = 'Post reply';
    submit.addEventListener('click', function () {
      var text = (textarea.value || '').trim();
      if (!text) return;
      postCommentToServer(text, parseInt(parentCommentId, 10), function (commentRecord) {
        formElement.parentNode.removeChild(formElement);
        appendCommentRowToList(commentRecord, parseInt(parentCommentId, 10));
      });
    });
    formElement.appendChild(textarea);
    formElement.appendChild(submit);
    parentRowElement.appendChild(formElement);
    textarea.focus();
  }
})();
