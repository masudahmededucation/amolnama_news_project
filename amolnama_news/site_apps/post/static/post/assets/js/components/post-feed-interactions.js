/* post-feed-interactions.js — Shared post feed interactions.
   Single delegated click handler for all post card actions.
   Used by both /post/ and /pulse/ pages. */
(function () {
  'use strict';

  function getCsrfTokenValue() {
    var cookieMatch = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
  }

  /* ---- SVG templates (defined once, reused) ---- */
  var LIKE_SVG_PATH = '<svg viewBox="0 0 24 24" class="post-card-like-svg LIKECLASS"><path d="M2 20h2V8H2v12zm22-11a2 2 0 0 0-2-2h-6.31l.95-4.57.03-.32a1.49 1.49 0 0 0-.44-1.06L15.17 0 7.59 7.59C7.22 7.95 7 8.45 7 9v10a2 2 0 0 0 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>';
  var HEART_SVG_PATH = '<svg viewBox="0 0 24 24" class="post-card-heart-svg HEARTCLASS"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
  var VOTE_SVG_PATH = '<svg viewBox="0 0 24 24" class="post-card-vote-svg VOTECLASS"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>';

  /* ---- Helper: close all open dropdowns ---- */
  function closeAllDropdowns(exceptElement) {
    var allMore = document.querySelectorAll('.post-card-more-menu-dropdown-open');
    for (var i = 0; i < allMore.length; i++) {
      if (allMore[i] !== exceptElement) allMore[i].classList.remove('post-card-more-menu-dropdown-open');
    }
    var allShare = document.querySelectorAll('.post-card-share-menu-dropdown-open');
    for (var j = 0; j < allShare.length; j++) {
      if (allShare[j] !== exceptElement) allShare[j].classList.remove('post-card-share-menu-dropdown-open');
    }
  }

  /* ---- Dominant color background for single images (Facebook-style) ---- */
  function extractDominantColor(imageElement, containerElement) {
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    canvas.width = 1;
    canvas.height = 1;
    try {
      context.drawImage(imageElement, 0, 0, 1, 1);
      var pixelData = context.getImageData(0, 0, 1, 1).data;
      containerElement.style.backgroundColor = 'rgb(' + pixelData[0] + ',' + pixelData[1] + ',' + pixelData[2] + ')';
    } catch (crossOriginError) { /* Cross-origin — keep default */ }
  }

  var singleImageElements = document.querySelectorAll('.post-card-media-image-full');
  for (var imageIndex = 0; imageIndex < singleImageElements.length; imageIndex++) {
    (function (imageElement) {
      var containerElement = imageElement.closest('.post-card-media-item-single');
      if (!containerElement) return;
      if (imageElement.complete && imageElement.naturalWidth > 0) {
        extractDominantColor(imageElement, containerElement);
      } else {
        imageElement.addEventListener('load', function () {
          extractDominantColor(imageElement, containerElement);
        });
      }
    })(singleImageElements[imageIndex]);
  }

  /* ---- Shared HTML escape (exposed on window for post-home.js) ---- */
  function escapeHtmlText(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  window.escapeHtmlText = escapeHtmlText;

  var REPLY_PLACEHOLDERS = [
    'তথ্য যোগ করুন বা সূত্র দিন... (Add info or source...)',
    'ভুল তথ্য থাকলে সংশোধন করুন... (Correct if wrong...)',
    'আরও স্পষ্ট করুন... (Clarify further...)',
    'কিছু জানা থাকলে জানান... (Share what you know...)',
    'Suggest an improvement...',
  ];

  function buildReplyFormHtml(postId) {
    var placeholderText = REPLY_PLACEHOLDERS[Math.floor(Math.random() * REPLY_PLACEHOLDERS.length)];
    return '<div class="post-card-reply-form">'
      + '<textarea class="post-card-reply-textarea" data-bangla-input="true" '
      + 'id="post-card-reply-textarea-' + postId + '" name="post_card_reply_textarea_' + postId + '" '
      + 'placeholder="' + placeholderText + '" maxlength="500"></textarea>'
      + '<div class="post-card-reply-form-actions">'
      + '<button type="button" class="post-card-reply-submit-button" id="post-card-reply-submit-' + postId + '" name="post_card_reply_submit_' + postId + '" data-post-id="' + postId + '">Submit</button>'
      + '<button type="button" class="post-card-reply-cancel-button" id="post-card-reply-cancel-' + postId + '" name="post_card_reply_cancel_' + postId + '">Cancel</button>'
      + '</div></div>';
  }

  function buildReplyItemHtml(reply) {
    var replyAvatarHtml = reply.author_avatar_url
      ? '<img src="' + reply.author_avatar_url + '" alt="" class="post-card-reply-avatar-image">'
      : '<span class="post-card-reply-avatar-initials">' + (reply.author_display_name || '?').charAt(0) + '</span>';
    var replyVoteActiveClass = reply.user_voted ? ' post-card-vote-button-active' : '';
    var replyVoteSvgClass = reply.user_voted ? 'post-card-vote-svg-filled' : 'post-card-vote-svg-empty';
    return '<div class="post-card-reply-item" id="post-card-reply-item-' + reply.post_post_id + '">'
      + '<div class="post-card-reply-avatar">' + replyAvatarHtml + '</div>'
      + '<div class="post-card-reply-body">'
      + '<div class="post-card-reply-header">'
      + '<span class="post-card-reply-author">' + escapeHtmlText(reply.author_display_name) + '</span>'
      + '<span class="post-card-reply-time">' + escapeHtmlText(reply.time_ago) + ' · ' + escapeHtmlText(reply.created_at_formatted) + '</span>'
      + '</div>'
      + '<div class="post-card-reply-text">' + escapeHtmlText(reply.post_text) + '</div>'
      + '<div class="post-card-reply-actions">'
      + '<button type="button" class="post-card-reply-vote-button post-card-vote-button' + replyVoteActiveClass + '" id="post-card-vote-' + reply.post_post_id + '" name="post_card_vote_' + reply.post_post_id + '" data-post-id="' + reply.post_post_id + '" title="This reply is useful">'
      + '<span class="post-card-action-icon post-card-vote-icon"><svg viewBox="0 0 24 24" class="post-card-vote-svg ' + replyVoteSvgClass + '"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg></span>'
      + '<span class="post-card-action-count post-card-vote-count">' + (reply.vote_score_count || 0) + '</span>'
      + '</button>'
      + (reply.can_edit ? '<button type="button" class="post-card-quick-edit-button" id="post-card-quick-edit-' + reply.post_post_id + '" name="post_card_quick_edit_' + reply.post_post_id + '" data-post-id="' + reply.post_post_id + '" data-post-text="' + escapeHtmlText(reply.post_text) + '" title="সম্পাদনা (Edit)">✏️</button>' : '')
      + '</div>'
      + '</div></div>';
  }

  function toggleRepliesSection(postCard) {
    if (!postCard) return;
    var postId = postCard.getAttribute('data-post-id');
    if (!postId) return;

    var contentElement = postCard.querySelector('.post-card-content');
    var existingRepliesSection = postCard.querySelector('.post-card-replies-section');
    if (existingRepliesSection) { existingRepliesSection.remove(); return; }

    /* Show reply form IMMEDIATELY — zero delay */
    var repliesSection = document.createElement('div');
    repliesSection.className = 'post-card-replies-section';
    repliesSection.innerHTML = buildReplyFormHtml(postId);
    contentElement.appendChild(repliesSection);

    /* Focus textarea instantly */
    var replyTextarea = repliesSection.querySelector('.post-card-reply-textarea');
    if (replyTextarea) replyTextarea.focus();

    /* Insert replies — from prefetch cache (instant) or fetch in background */
    function insertRepliesIntoSection(replies) {
      if (!replies || replies.length === 0) return;
      var repliesListHtml = '<div class="post-card-replies-list">';
      for (var replyIndex = 0; replyIndex < replies.length; replyIndex++) {
        repliesListHtml += buildReplyItemHtml(replies[replyIndex]);
      }
      repliesListHtml += '</div>';
      var replyForm = repliesSection.querySelector('.post-card-reply-form');
      if (replyForm) {
        replyForm.insertAdjacentHTML('beforebegin', repliesListHtml);
      } else {
        repliesSection.insertAdjacentHTML('afterbegin', repliesListHtml);
      }
    }

    var cachedReplies = replyPrefetchCache[postId];
    if (Array.isArray(cachedReplies)) {
      /* Cache hit — render instantly, zero network wait */
      insertRepliesIntoSection(cachedReplies);
    } else {
      /* Cache miss — fetch in background */
      fetch('/post/api/' + postId + '/replies/')
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          replyPrefetchCache[postId] = data.replies || [];
          insertRepliesIntoSection(data.replies);
        }
      })
      .catch(function (networkError) {
        console.error('Failed to load replies:', networkError);
      });
    }
  }

  /* ---- Photo lightbox state ---- */
  var postLightboxPhotos = [];
  var postLightboxCurrentIndex = 0;
  var postLightboxElement = document.getElementById('photo-lightbox');
  var postLightboxImageElement = document.getElementById('photo-lightbox-image');
  var postLightboxCaptionElement = document.getElementById('photo-lightbox-caption');
  var postLightboxCounterElement = document.getElementById('photo-lightbox-counter');

  function postLightboxShow() {
    if (!postLightboxElement || !postLightboxPhotos.length) return;
    postLightboxImageElement.src = postLightboxPhotos[postLightboxCurrentIndex];
    postLightboxCaptionElement.textContent = '';
    postLightboxCounterElement.textContent = (postLightboxCurrentIndex + 1) + ' / ' + postLightboxPhotos.length;
  }
  function postLightboxClose() {
    if (!postLightboxElement) return;
    postLightboxElement.style.display = 'none';
    document.body.style.overflow = '';
    postLightboxPhotos = [];
  }

  if (postLightboxElement) {
    var postLightboxCloseButton = document.getElementById('photo-lightbox-close-button');
    var postLightboxOverlay = document.getElementById('photo-lightbox-overlay');
    var postLightboxPreviousButton = document.getElementById('photo-lightbox-previous-button');
    var postLightboxNextButton = document.getElementById('photo-lightbox-next-button');
    if (postLightboxCloseButton) postLightboxCloseButton.addEventListener('click', postLightboxClose);
    if (postLightboxOverlay) postLightboxOverlay.addEventListener('click', postLightboxClose);
    if (postLightboxPreviousButton) postLightboxPreviousButton.addEventListener('click', function () {
      postLightboxCurrentIndex = (postLightboxCurrentIndex - 1 + postLightboxPhotos.length) % postLightboxPhotos.length;
      postLightboxShow();
    });
    if (postLightboxNextButton) postLightboxNextButton.addEventListener('click', function () {
      postLightboxCurrentIndex = (postLightboxCurrentIndex + 1) % postLightboxPhotos.length;
      postLightboxShow();
    });
    document.addEventListener('keydown', function (event) {
      if (postLightboxElement.style.display === 'none' || !postLightboxPhotos.length) return;
      if (event.key === 'Escape') postLightboxClose();
      if (event.key === 'ArrowLeft') { postLightboxCurrentIndex = (postLightboxCurrentIndex - 1 + postLightboxPhotos.length) % postLightboxPhotos.length; postLightboxShow(); }
      if (event.key === 'ArrowRight') { postLightboxCurrentIndex = (postLightboxCurrentIndex + 1) % postLightboxPhotos.length; postLightboxShow(); }
    });
  }

  /* ==================================================================
     SINGLE DELEGATED CLICK HANDLER — routes to the right action
     ================================================================== */
  document.addEventListener('click', function (event) {
    var target = event.target;

    /* ---- Follow/Unfollow toggle ---- */
    var followButton = target.closest('.post-card-follow-button');
    if (followButton) {
      event.preventDefault();
      var followUserProfileId = followButton.getAttribute('data-user-profile-id');
      if (!followUserProfileId) return;
      fetch('/social/api/follow/' + followUserProfileId + '/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        /* Update ALL follow buttons for this user across all posts */
        var allFollowButtons = document.querySelectorAll('.post-card-follow-button[data-user-profile-id="' + followUserProfileId + '"]');
        for (var followIndex = 0; followIndex < allFollowButtons.length; followIndex++) {
          var followIconSvg = data.following
            ? '<svg class="post-card-follow-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Following'
            : '<svg class="post-card-follow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> Follow';
          if (data.following) {
            allFollowButtons[followIndex].classList.add('post-card-follow-button-active');
          } else {
            allFollowButtons[followIndex].classList.remove('post-card-follow-button-active');
          }
          allFollowButtons[followIndex].innerHTML = followIconSvg;
        }
      });
      return;
    }

    /* ---- Upvote toggle ---- */
    var voteButton = target.closest('.post-card-vote-button');
    if (voteButton) {
      event.preventDefault();
      var votePostId = voteButton.getAttribute('data-post-id');
      if (!votePostId) return;
      fetch('/post/api/' + votePostId + '/vote/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        var voteCountElement = voteButton.querySelector('.post-card-vote-count');
        if (voteCountElement) voteCountElement.textContent = data.vote_score_count;
        var voteIconElement = voteButton.querySelector('.post-card-vote-icon');
        if (data.voted) {
          voteButton.classList.add('post-card-vote-button-active');
          if (voteIconElement) voteIconElement.innerHTML = VOTE_SVG_PATH.replace('VOTECLASS', 'post-card-vote-svg-filled');
        } else {
          voteButton.classList.remove('post-card-vote-button-active');
          if (voteIconElement) voteIconElement.innerHTML = VOTE_SVG_PATH.replace('VOTECLASS', 'post-card-vote-svg-empty');
        }
      });
      return;
    }

    /* ---- Follow Post toggle ---- */
    var followPostButton = target.closest('.post-card-follow-post-button');
    if (followPostButton) {
      event.preventDefault();
      closeAllDropdowns();
      var followPostId = followPostButton.getAttribute('data-post-id');
      if (!followPostId) return;
      fetch('/post/api/' + followPostId + '/follow-post/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        followPostButton.textContent = data.following ? '🔔 Unfollow Post' : '🔔 Follow Post';
      });
      return;
    }

    /* ---- Flag Post (show inline form) ---- */
    var flagButton = target.closest('.post-card-flag-button');
    if (flagButton) {
      event.preventDefault();
      closeAllDropdowns();
      var flagPostId = flagButton.getAttribute('data-post-id');
      var flagPostCard = flagButton.closest('.post-card');
      if (!flagPostCard || flagPostCard.querySelector('.post-card-flag-form')) return;

      var flagForm = document.createElement('div');
      flagForm.className = 'post-card-flag-form';
      flagForm.innerHTML = '<div class="post-card-flag-form-title">⚑ Flag This Post</div>'
        + '<label class="post-card-flag-option"><input type="radio" name="post_card_flag_reason_' + flagPostId + '" value="misinformation"> Misinformation</label>'
        + '<label class="post-card-flag-option"><input type="radio" name="post_card_flag_reason_' + flagPostId + '" value="spam"> Spam</label>'
        + '<label class="post-card-flag-option"><input type="radio" name="post_card_flag_reason_' + flagPostId + '" value="harassment"> Harassment</label>'
        + '<label class="post-card-flag-option"><input type="radio" name="post_card_flag_reason_' + flagPostId + '" value="hate_speech"> Hate Speech</label>'
        + '<label class="post-card-flag-option"><input type="radio" name="post_card_flag_reason_' + flagPostId + '" value="other"> Other</label>'
        + '<textarea class="post-card-flag-description" id="post-card-flag-description-' + flagPostId + '" name="post_card_flag_description_' + flagPostId + '" placeholder="Optional: describe the issue..." maxlength="500" data-no-bangla></textarea>'
        + '<div class="post-card-flag-form-actions">'
        + '<button type="button" class="post-card-flag-submit-button" id="post-card-flag-submit-' + flagPostId + '" name="post_card_flag_submit_' + flagPostId + '" data-post-id="' + flagPostId + '">Submit Flag</button>'
        + '<button type="button" class="post-card-flag-cancel-button" id="post-card-flag-cancel-' + flagPostId + '" name="post_card_flag_cancel_' + flagPostId + '">Cancel</button>'
        + '</div>';
      flagPostCard.querySelector('.post-card-content').appendChild(flagForm);
      return;
    }

    /* ---- Flag submit ---- */
    var flagSubmitButton = target.closest('.post-card-flag-submit-button');
    if (flagSubmitButton) {
      var submitFlagPostId = flagSubmitButton.getAttribute('data-post-id');
      var flagFormElement = flagSubmitButton.closest('.post-card-flag-form');
      var selectedReason = flagFormElement.querySelector('input[type="radio"]:checked');
      if (!selectedReason) return;
      var flagDescriptionElement = flagFormElement.querySelector('.post-card-flag-description');
      var flagDescription = flagDescriptionElement ? flagDescriptionElement.value : '';
      flagSubmitButton.disabled = true;
      flagSubmitButton.textContent = 'Submitting...';
      fetch('/post/api/' + submitFlagPostId + '/flag/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ flag_reason_code: selectedReason.value, flag_description: flagDescription || null }),
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          flagFormElement.innerHTML = '<div class="post-card-flag-success">Thank you. Your flag has been submitted for review.</div>';
          setTimeout(function () { flagFormElement.remove(); }, 3000);
        } else {
          flagSubmitButton.disabled = false;
          flagSubmitButton.textContent = 'Submit Flag';
        }
      })
      .catch(function (networkError) { console.error('Flag submit failed:', networkError); flagSubmitButton.disabled = false; flagSubmitButton.textContent = 'Submit Flag'; });
      return;
    }

    /* ---- Flag cancel ---- */
    var flagCancelButton = target.closest('.post-card-flag-cancel-button');
    if (flagCancelButton) {
      var flagFormToRemove = flagCancelButton.closest('.post-card-flag-form');
      if (flagFormToRemove) flagFormToRemove.remove();
      return;
    }

    /* ---- ⋯ More menu toggle ---- */
    var moreMenuButton = target.closest('.post-card-more-menu-button');
    if (moreMenuButton) {
      event.preventDefault();
      var postId = moreMenuButton.getAttribute('data-post-id');
      var dropdown = document.getElementById('post-card-more-dropdown-' + postId);
      if (dropdown) {
        closeAllDropdowns(dropdown);
        dropdown.classList.toggle('post-card-more-menu-dropdown-open');
      }
      return;
    }

    /* ---- Share menu toggle ---- */
    var shareToggle = target.closest('.post-card-share-menu-toggle');
    if (shareToggle) {
      event.preventDefault();
      var sharePostId = shareToggle.getAttribute('data-post-id');
      var shareDropdown = document.getElementById('post-card-share-dropdown-' + sharePostId);
      if (shareDropdown) {
        closeAllDropdowns(shareDropdown);
        shareDropdown.classList.toggle('post-card-share-menu-dropdown-open');
      }
      return;
    }

    /* ---- Copy Link (share button) ---- */
    var shareButton = target.closest('.post-card-share-button');
    if (shareButton) {
      event.preventDefault();
      var copyPostId = shareButton.getAttribute('data-post-id');
      var shareUrl = window.location.origin + '/post/' + copyPostId + '/';
      var parentShareDropdown = shareButton.closest('.post-card-share-menu-dropdown');
      if (parentShareDropdown) parentShareDropdown.classList.remove('post-card-share-menu-dropdown-open');
      navigator.clipboard.writeText(shareUrl).then(function () {
        var shareWrapper = shareButton.closest('.post-card-share-menu-wrapper');
        var toggleLabel = shareWrapper ? shareWrapper.querySelector('.post-card-action-label') : null;
        if (toggleLabel) {
          toggleLabel.textContent = '✓ Copied';
          setTimeout(function () { toggleLabel.textContent = 'শেয়ার'; }, 2000);
        }
      });
      return;
    }

    /* ---- Native Share (Share via) ---- */
    var nativeShareButton = target.closest('.post-card-native-share-button');
    if (nativeShareButton) {
      event.preventDefault();
      var nativePostId = nativeShareButton.getAttribute('data-post-id');
      var nativeShareUrl = window.location.origin + '/post/' + nativePostId + '/';
      closeAllDropdowns();
      if (navigator.share) { navigator.share({ url: nativeShareUrl }); }
      else { navigator.clipboard.writeText(nativeShareUrl); }
      return;
    }

    /* ---- Embed ---- */
    var embedButton = target.closest('.post-card-embed-button');
    if (embedButton) {
      event.preventDefault();
      var embedPostId = embedButton.getAttribute('data-post-id');
      if (!embedPostId) return;
      closeAllDropdowns();

      var embedPostCard = embedButton.closest('.post-card');
      var existingEmbedBox = embedPostCard.querySelector('.post-card-embed-box');
      if (existingEmbedBox) { existingEmbedBox.remove(); return; }

      var embedUrl = window.location.origin + '/post/' + embedPostId + '/embed/';
      var embedCode = '<iframe src="' + embedUrl + '" width="550" height="400" frameborder="0" scrolling="no" allowtransparency="true"></iframe>';
      var embedBox = document.createElement('div');
      embedBox.className = 'post-card-embed-box';
      embedBox.innerHTML = '<div class="post-card-embed-box-label">এম্বেড কোড (Embed Code)</div>'
        + '<textarea class="post-card-embed-box-code" id="post-card-embed-code-' + embedPostId + '" name="post_card_embed_code_' + embedPostId + '" readonly rows="3"></textarea>'
        + '<button type="button" class="post-card-embed-box-copy-button" id="post-card-embed-copy-' + embedPostId + '" name="post_card_embed_copy_' + embedPostId + '">কপি করুন</button>';
      var contentElement = embedPostCard.querySelector('.post-card-content');
      var actionsElement = embedPostCard.querySelector('.post-card-actions');
      contentElement.insertBefore(embedBox, actionsElement);
      var embedCodeTextarea = embedBox.querySelector('.post-card-embed-box-code');
      if (embedCodeTextarea) embedCodeTextarea.value = embedCode;
      return;
    }

    /* ---- Embed copy button ---- */
    var embedCopyButton = target.closest('.post-card-embed-box-copy-button');
    if (embedCopyButton) {
      var codeTextarea = embedCopyButton.closest('.post-card-embed-box').querySelector('.post-card-embed-box-code');
      codeTextarea.select();
      navigator.clipboard.writeText(codeTextarea.value).then(function () {
        embedCopyButton.textContent = '✓ কপি হয়েছে';
        setTimeout(function () { embedCopyButton.textContent = 'কপি করুন'; }, 2000);
      });
      return;
    }

    /* ---- Like toggle ---- */
    var likeButton = target.closest('.post-card-like-button');
    if (likeButton) {
      event.preventDefault();
      var likePostId = likeButton.getAttribute('data-post-id');
      if (!likePostId) return;
      fetch('/post/api/' + likePostId + '/like/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        var likeCountElement = likeButton.querySelector('.post-card-like-count');
        if (likeCountElement) likeCountElement.textContent = data.like_count;
        var likeIconElement = likeButton.querySelector('.post-card-like-icon');
        if (data.liked) {
          likeButton.classList.add('post-card-like-button-active');
          if (likeIconElement) likeIconElement.innerHTML = LIKE_SVG_PATH.replace('LIKECLASS', 'post-card-like-svg-filled');
        } else {
          likeButton.classList.remove('post-card-like-button-active');
          if (likeIconElement) likeIconElement.innerHTML = LIKE_SVG_PATH.replace('LIKECLASS', 'post-card-like-svg-empty');
        }
      });
      return;
    }

    /* ---- Bookmark toggle ---- */
    var bookmarkButton = target.closest('.post-card-bookmark-button');
    if (bookmarkButton) {
      event.preventDefault();
      var bookmarkPostId = bookmarkButton.getAttribute('data-post-id');
      if (!bookmarkPostId) return;
      fetch('/post/api/' + bookmarkPostId + '/bookmark/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        var bookmarkIconElement = bookmarkButton.querySelector('.post-card-bookmark-icon');
        if (data.bookmarked) {
          bookmarkButton.classList.add('post-card-bookmark-button-active');
          if (bookmarkIconElement) {
            bookmarkIconElement.innerHTML = HEART_SVG_PATH.replace('HEARTCLASS', 'post-card-heart-svg-filled');
            bookmarkIconElement.classList.add('post-card-bookmark-icon-animate');
            setTimeout(function () { bookmarkIconElement.classList.remove('post-card-bookmark-icon-animate'); }, 400);
          }
        } else {
          bookmarkButton.classList.remove('post-card-bookmark-button-active');
          if (bookmarkIconElement) bookmarkIconElement.innerHTML = HEART_SVG_PATH.replace('HEARTCLASS', 'post-card-heart-svg-empty');
        }
      });
      return;
    }

    /* ---- Repost toggle ---- */
    var repostButton = target.closest('.post-card-repost-button');
    if (repostButton) {
      event.preventDefault();
      var repostPostId = repostButton.getAttribute('data-post-id');
      if (!repostPostId) return;

      /* Optimistic UI — toggle immediately before server responds (Twitter pattern) */
      var repostCountElement = repostButton.querySelector('.post-card-repost-count');
      var repostLabelElement = repostButton.querySelector('.post-card-repost-label');
      var wasActive = repostButton.classList.contains('post-card-repost-button-active');
      var currentCount = parseInt(repostCountElement ? repostCountElement.textContent : '0', 10) || 0;

      if (wasActive) {
        repostButton.classList.remove('post-card-repost-button-active');
        if (repostLabelElement) repostLabelElement.textContent = 'Repost';
        if (repostCountElement) repostCountElement.textContent = Math.max(0, currentCount - 1);
      } else {
        repostButton.classList.add('post-card-repost-button-active');
        if (repostLabelElement) repostLabelElement.textContent = 'Cancel Repost';
        if (repostCountElement) repostCountElement.textContent = currentCount + 1;
      }

      /* Pop animation on the icon */
      repostButton.style.transform = 'scale(1.2)';
      setTimeout(function () { repostButton.style.transform = ''; }, 150);

      /* Server sync — correct count from actual data */
      fetch('/post/api/' + repostPostId + '/repost/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.success) {
          /* Revert optimistic UI on failure */
          if (wasActive) {
            repostButton.classList.add('post-card-repost-button-active');
            if (repostLabelElement) repostLabelElement.textContent = 'Cancel Repost';
          } else {
            repostButton.classList.remove('post-card-repost-button-active');
            if (repostLabelElement) repostLabelElement.textContent = 'Repost';
          }
          if (repostCountElement) repostCountElement.textContent = currentCount;
          return;
        }
        /* Correct count from server (actual data, not optimistic guess) */
        if (repostCountElement) repostCountElement.textContent = data.repost_count;
      })
      .catch(function () {
        /* Network error — revert optimistic UI */
        if (wasActive) {
          repostButton.classList.add('post-card-repost-button-active');
          if (repostLabelElement) repostLabelElement.textContent = 'Cancel Repost';
        } else {
          repostButton.classList.remove('post-card-repost-button-active');
          if (repostLabelElement) repostLabelElement.textContent = 'Repost';
        }
        if (repostCountElement) repostCountElement.textContent = currentCount;
        console.error('Repost toggle failed');
      });
      return;
    }

    /* ---- Reply button ---- */
    var replyButton = target.closest('.post-card-reply-button');
    if (replyButton) {
      event.preventDefault();
      toggleRepliesSection(replyButton.closest('.post-card'));
      return;
    }

    /* ---- Reply submit ---- */
    var submitReplyButton = target.closest('.post-card-reply-submit-button');
    if (submitReplyButton) {
      var replyPostId = submitReplyButton.getAttribute('data-post-id');
      var replyForm = submitReplyButton.closest('.post-card-reply-form');
      var replyTextarea = replyForm.querySelector('textarea');
      var replyText = (replyTextarea.value || '').trim();
      if (!replyText) { replyTextarea.focus(); return; }
      submitReplyButton.disabled = true;
      submitReplyButton.textContent = 'পাঠানো হচ্ছে...';
      fetch('/post/api/' + replyPostId + '/reply/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ reply_text_bn: replyText }),
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          replyForm.remove();
          var replyPostCard = document.getElementById('post-card-' + replyPostId);
          if (replyPostCard) {
            var replyCountElement = replyPostCard.querySelector('.post-card-reply-count');
            if (replyCountElement) replyCountElement.textContent = data.reply_count;
          }
        } else { submitReplyButton.disabled = false; submitReplyButton.textContent = 'Submit'; }
      })
      .catch(function (networkError) { console.error('Reply submit failed:', networkError); submitReplyButton.disabled = false; submitReplyButton.textContent = 'Submit'; });
      return;
    }

    /* ---- Reply cancel ---- */
    var cancelReplyButton = target.closest('.post-card-reply-cancel-button');
    if (cancelReplyButton) {
      var repliesSection = cancelReplyButton.closest('.post-card-replies-section');
      if (repliesSection) repliesSection.remove();
      return;
    }

    /* ---- Delete button (show confirm) ---- */
    /* ---- Edit button (inline edit) ---- */
    var editButton = target.closest('.post-card-edit-button');
    if (editButton) {
      event.preventDefault();
      closeAllDropdowns();
      var editPostId = editButton.getAttribute('data-post-id');
      var editPostCard = editButton.closest('.post-card');
      if (!editPostCard) return;

      var textElement = editPostCard.querySelector('.post-card-text');
      if (!textElement || textElement.querySelector('.post-card-edit-textarea')) return;

      var currentText = editButton.getAttribute('data-post-text') || textElement.textContent || '';
      var originalHtml = textElement.innerHTML;

      textElement.innerHTML = '<textarea class="post-card-edit-textarea" id="post-card-edit-textarea-' + editPostId + '" name="post_card_edit_textarea_' + editPostId + '" maxlength="1000">' + currentText.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</textarea>'
        + '<div class="post-card-edit-actions">'
        + '<button type="button" class="post-card-edit-save-button" id="post-card-edit-save-' + editPostId + '" name="post_card_edit_save_' + editPostId + '" data-post-id="' + editPostId + '">সংরক্ষণ (Save)</button>'
        + '<button type="button" class="post-card-edit-cancel-button" id="post-card-edit-cancel-' + editPostId + '" name="post_card_edit_cancel_' + editPostId + '">বাতিল (Cancel)</button>'
        + '</div>';

      textElement.querySelector('.post-card-edit-textarea').focus();
      textElement.setAttribute('data-original-html', originalHtml);
      return;
    }

    /* ---- Edit save ---- */
    var editSaveButton = target.closest('.post-card-edit-save-button');
    if (editSaveButton) {
      var savePostId = editSaveButton.getAttribute('data-post-id');
      var savePostCard = editSaveButton.closest('.post-card');
      var saveTextElement = savePostCard.querySelector('.post-card-text');
      var editTextarea = saveTextElement.querySelector('.post-card-edit-textarea');
      var newText = (editTextarea.value || '').trim();

      if (!newText) { editTextarea.focus(); return; }

      editSaveButton.disabled = true;
      editSaveButton.textContent = 'সংরক্ষণ হচ্ছে...';

      fetch('/post/api/' + savePostId + '/edit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ post_text: newText }),
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          saveTextElement.textContent = data.post_text;
          /* Update the edit button's data-post-text for next edit */
          var postEditButton = savePostCard.querySelector('.post-card-edit-button');
          if (postEditButton) postEditButton.setAttribute('data-post-text', data.post_text);
        } else {
          editSaveButton.disabled = false;
          editSaveButton.textContent = 'সংরক্ষণ (Save)';
        }
      })
      .catch(function (networkError) {
        console.error('Edit save failed:', networkError);
        editSaveButton.disabled = false;
        editSaveButton.textContent = 'সংরক্ষণ (Save)';
      });
      return;
    }

    /* ---- Edit cancel ---- */
    var editCancelButton = target.closest('.post-card-edit-cancel-button');
    if (editCancelButton) {
      var cancelTextElement = editCancelButton.closest('.post-card-text');
      var savedOriginalHtml = cancelTextElement.getAttribute('data-original-html');
      if (savedOriginalHtml) {
        cancelTextElement.innerHTML = savedOriginalHtml;
        cancelTextElement.removeAttribute('data-original-html');
      }
      return;
    }

    /* ---- Delete button (show confirm) ---- */
    var deleteButton = target.closest('.post-card-delete-button');
    if (deleteButton) {
      event.preventDefault();
      closeAllDropdowns();
      var deletePostId = deleteButton.getAttribute('data-post-id');
      var deletePostCard = deleteButton.closest('.post-card');
      if (!deletePostCard || deletePostCard.querySelector('.post-card-delete-confirm')) return;
      var confirmElement = document.createElement('div');
      confirmElement.className = 'post-card-delete-confirm';
      confirmElement.innerHTML = '<span>মুছে ফেলতে চান?</span>'
        + '<button type="button" class="post-card-delete-confirm-yes-button" id="post-card-delete-yes-' + deletePostId + '" name="post_card_delete_yes_' + deletePostId + '" data-post-id="' + deletePostId + '">হ্যাঁ মুছুন</button>'
        + '<button type="button" class="post-card-delete-confirm-no-button" id="post-card-delete-no-' + deletePostId + '" name="post_card_delete_no_' + deletePostId + '">না</button>';
      deletePostCard.querySelector('.post-card-content').appendChild(confirmElement);
      return;
    }

    /* ---- Delete confirm YES ---- */
    var confirmYesButton = target.closest('.post-card-delete-confirm-yes-button');
    if (confirmYesButton) {
      var confirmPostId = confirmYesButton.getAttribute('data-post-id');
      var confirmPostCard = confirmYesButton.closest('.post-card');
      confirmYesButton.disabled = true;
      confirmYesButton.textContent = 'মুছে ফেলা হচ্ছে...';
      fetch('/post/api/' + confirmPostId + '/delete/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          /* If deleted post was a repost, update the original post's repost button + count */
          if (data.was_repost && data.original_post_id) {
            var originalPostCard = document.getElementById('post-card-' + data.original_post_id);
            if (originalPostCard) {
              var originalRepostButton = originalPostCard.querySelector('.post-card-repost-button');
              if (originalRepostButton) {
                originalRepostButton.classList.remove('post-card-repost-button-active');
                var originalRepostCount = originalRepostButton.querySelector('.post-card-repost-count');
                var originalRepostLabel = originalRepostButton.querySelector('.post-card-repost-label');
                if (originalRepostCount) originalRepostCount.textContent = '0';
                if (originalRepostLabel) originalRepostLabel.textContent = 'রিপোস্ট';
              }
            }
          }

          /* Smooth fade out + collapse */
          confirmPostCard.style.transition = 'opacity .3s, max-height .3s';
          confirmPostCard.style.opacity = '0';
          confirmPostCard.style.maxHeight = confirmPostCard.offsetHeight + 'px';
          confirmPostCard.style.overflow = 'hidden';
          setTimeout(function () {
            confirmPostCard.style.maxHeight = '0';
            confirmPostCard.style.padding = '0';
            confirmPostCard.style.margin = '0';
            confirmPostCard.style.borderWidth = '0';
          }, 50);
          setTimeout(function () { confirmPostCard.remove(); }, 350);
        }
        else { confirmYesButton.disabled = false; confirmYesButton.textContent = 'হ্যাঁ মুছুন'; }
      })
      .catch(function (networkError) { console.error('Delete failed:', networkError); confirmYesButton.disabled = false; confirmYesButton.textContent = 'হ্যাঁ মুছুন'; });
      return;
    }

    /* ---- Delete confirm NO ---- */
    var confirmNoButton = target.closest('.post-card-delete-confirm-no-button');
    if (confirmNoButton) {
      var confirmEl = confirmNoButton.closest('.post-card-delete-confirm');
      if (confirmEl) confirmEl.remove();
      return;
    }

    /* ---- Photo lightbox ---- */
    var mediaItem = target.closest('.post-card-media-item');
    if (mediaItem) {
      var photoUrl = mediaItem.getAttribute('data-photo-url');
      if (!photoUrl || !postLightboxElement) return;
      var mediaGrid = mediaItem.closest('.post-card-media-grid');
      if (!mediaGrid) return;
      var allMediaItems = mediaGrid.querySelectorAll('.post-card-media-item[data-photo-url]');
      postLightboxPhotos = [];
      postLightboxCurrentIndex = 0;
      for (var itemIndex = 0; itemIndex < allMediaItems.length; itemIndex++) {
        postLightboxPhotos.push(allMediaItems[itemIndex].getAttribute('data-photo-url'));
        if (allMediaItems[itemIndex] === mediaItem) postLightboxCurrentIndex = itemIndex;
      }
      postLightboxShow();
      postLightboxElement.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      return;
    }

    /* ---- Click post card body → toggle replies (catch-all, last priority) ---- */
    if (target.closest('.post-card-action-button')) return;
    if (target.closest('.post-card-reply-form')) return;
    if (target.closest('.post-card-replies-section')) return;
    if (target.closest('.post-card-delete-confirm')) return;
    if (target.closest('.post-card-embed-box')) return;
    if (target.closest('.post-card-more-menu-wrapper')) return;
    if (target.closest('.post-card-share-menu-wrapper')) return;
    if (target.closest('a')) return;
    if (target.closest('button')) return;
    if (target.closest('textarea')) return;

    var clickedPostCard = target.closest('.post-card');
    if (clickedPostCard) {
      toggleRepliesSection(clickedPostCard);
      return;
    }

    /* ---- Close all dropdowns when clicking outside everything ---- */
    closeAllDropdowns();
  });

  /* ---- Reply prefetch cache — Twitter-style background loading ---- */
  var replyPrefetchCache = {};
  var replyPrefetchTimers = {};
  var REPLY_PREFETCH_DWELL_MILLISECONDS = 2000;

  function prefetchReplies(postId) {
    if (replyPrefetchCache[postId]) return;
    replyPrefetchCache[postId] = 'loading';
    fetch('/post/api/' + postId + '/replies/')
    .then(function (response) { return response.json(); })
    .then(function (data) {
      replyPrefetchCache[postId] = (data.success && data.replies) ? data.replies : [];
    })
    .catch(function () { delete replyPrefetchCache[postId]; });
  }

  /* ---- View count — meaningful impression (3s dwell time, 50% visible) ---- */
  var viewedPostIds = {};
  var viewDwellTimers = {};
  var VIEW_DWELL_TIME_MILLISECONDS = 3000;

  var postCardObserver = new IntersectionObserver(function (entries) {
    for (var entryIndex = 0; entryIndex < entries.length; entryIndex++) {
      var entry = entries[entryIndex];
      var postCard = entry.target;
      var postId = postCard.getAttribute('data-post-id');
      if (!postId || viewedPostIds[postId]) continue;

      if (entry.isIntersecting) {
        /* Prefetch replies in background after 2s dwell */
        if (!replyPrefetchCache[postId] && !replyPrefetchTimers[postId]) {
          (function (prefetchPostId) {
            replyPrefetchTimers[prefetchPostId] = setTimeout(function () {
              delete replyPrefetchTimers[prefetchPostId];
              prefetchReplies(prefetchPostId);
            }, REPLY_PREFETCH_DWELL_MILLISECONDS);
          })(postId);
        }

        (function (dwellPostId, dwellPostCard) {
          viewDwellTimers[dwellPostId] = setTimeout(function () {
            viewedPostIds[dwellPostId] = true;
            delete viewDwellTimers[dwellPostId];
            fetch('/post/api/' + dwellPostId + '/view/', {
              method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
            })
            .then(function (response) { return response.json(); })
            .then(function (data) {
              if (data.success) {
                var viewCountElement = dwellPostCard.querySelector('.post-card-header-view-count');
                if (viewCountElement) viewCountElement.textContent = '👁️ ' + data.view_count;
              }
            })
            .catch(function () { /* view tracking — non-critical, no user feedback needed */ });
          }, VIEW_DWELL_TIME_MILLISECONDS);
        })(postId, postCard);
      } else {
        if (replyPrefetchTimers[postId]) {
          clearTimeout(replyPrefetchTimers[postId]);
          delete replyPrefetchTimers[postId];
        }
        if (viewDwellTimers[postId]) {
          clearTimeout(viewDwellTimers[postId]);
          delete viewDwellTimers[postId];
        }
      }
    }
  }, { threshold: 0.5 });

  var allPostCards = document.querySelectorAll('.post-card');
  for (var cardIndex = 0; cardIndex < allPostCards.length; cardIndex++) {
    postCardObserver.observe(allPostCards[cardIndex]);
  }

  /* ---- QUICK EDIT — inline edit form on pencil button click ---- */
  document.addEventListener('click', function (event) {
    var quickEditButton = event.target.closest('.post-card-quick-edit-button');
    if (!quickEditButton) return;

    var postId = quickEditButton.getAttribute('data-post-id');
    var currentText = quickEditButton.getAttribute('data-post-text');

    /* Works for both post cards and reply items — find the correct text element */
    var replyContainer = quickEditButton.closest('.post-card-reply-item');
    var container;
    var textElement;
    if (replyContainer) {
      container = replyContainer;
      textElement = replyContainer.querySelector('.post-card-reply-text');
    } else {
      container = quickEditButton.closest('.post-card');
      textElement = container ? container.querySelector('#post-card-text-' + postId) : null;
    }

    if (!textElement) return;

    /* Check if already editing */
    if (container.querySelector('.post-card-inline-edit-form')) return;

    var originalHtml = textElement.innerHTML;
    var editForm = document.createElement('div');
    editForm.className = 'post-card-inline-edit-form';
    editForm.innerHTML =
      '<textarea class="post-card-inline-edit-textarea" id="post-card-inline-edit-textarea-' + postId + '" name="post_card_inline_edit_textarea_' + postId + '" rows="4">' + currentText + '</textarea>' +
      '<div class="post-card-inline-edit-buttons">' +
      '<button type="button" class="post-card-inline-edit-save" id="post-card-inline-edit-save-' + postId + '" name="post_card_inline_edit_save_' + postId + '">সংরক্ষণ</button>' +
      '<button type="button" class="post-card-inline-edit-cancel" id="post-card-inline-edit-cancel-' + postId + '" name="post_card_inline_edit_cancel_' + postId + '">বাতিল</button>' +
      '</div>';

    textElement.innerHTML = '';
    textElement.appendChild(editForm);

    editForm.querySelector('.post-card-inline-edit-cancel').addEventListener('click', function () {
      textElement.innerHTML = originalHtml;
    });

    editForm.querySelector('.post-card-inline-edit-save').addEventListener('click', function () {
      var newText = editForm.querySelector('.post-card-inline-edit-textarea').value.trim();
      if (!newText) return;

      fetch('/post/api/' + postId + '/edit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ post_text: newText }),
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          textElement.textContent = newText;
          quickEditButton.setAttribute('data-post-text', newText);
        } else {
          textElement.innerHTML = originalHtml;
        }
      })
      .catch(function () { textElement.innerHTML = originalHtml; });
    });
  });

  /* ---- POST ANALYTICS — inline card ---- */
  document.addEventListener('click', function (event) {
    var analyticsButton = event.target.closest('.post-card-analytics-button');
    if (!analyticsButton) return;

    var postCard = analyticsButton.closest('.post-card');
    var existingCard = postCard.querySelector('.post-card-analytics-card');
    if (existingCard) { existingCard.remove(); return; }

    var views = parseInt(analyticsButton.getAttribute('data-views') || '0', 10);
    var likes = parseInt(analyticsButton.getAttribute('data-likes') || '0', 10);
    var replies = parseInt(analyticsButton.getAttribute('data-replies') || '0', 10);
    var reposts = parseInt(analyticsButton.getAttribute('data-reposts') || '0', 10);
    var engagementRate = views > 0 ? ((likes + replies + reposts) / views * 100).toFixed(1) : '0.0';

    var analyticsCard = document.createElement('div');
    analyticsCard.className = 'post-card-analytics-card';
    analyticsCard.innerHTML =
      '<div class="post-card-analytics-card-title">📊 পোস্ট Analytics</div>' +
      '<div class="post-card-analytics-card-stats">' +
      '<div class="post-card-analytics-card-stat"><span class="post-card-analytics-card-stat-value">' + views + '</span><span class="post-card-analytics-card-stat-label">Views</span></div>' +
      '<div class="post-card-analytics-card-stat"><span class="post-card-analytics-card-stat-value">' + likes + '</span><span class="post-card-analytics-card-stat-label">Likes</span></div>' +
      '<div class="post-card-analytics-card-stat"><span class="post-card-analytics-card-stat-value">' + replies + '</span><span class="post-card-analytics-card-stat-label">Replies</span></div>' +
      '<div class="post-card-analytics-card-stat"><span class="post-card-analytics-card-stat-value">' + reposts + '</span><span class="post-card-analytics-card-stat-label">Reposts</span></div>' +
      '</div>' +
      '<div class="post-card-analytics-card-engagement">Engagement Rate: ' + engagementRate + '%</div>';

    var actionsBar = postCard.querySelector('.post-card-actions');
    if (actionsBar) actionsBar.parentNode.insertBefore(analyticsCard, actionsBar);

    closeAllDropdowns();
  });

  /* ---- QUOTE REPOST — show inline form, then repost with quote text ---- */
  document.addEventListener('click', function (event) {
    var quoteButton = event.target.closest('.post-card-quote-repost-button');
    if (!quoteButton) return;

    var postId = quoteButton.getAttribute('data-post-id');
    var originalText = quoteButton.getAttribute('data-original-text');
    var originalAuthor = quoteButton.getAttribute('data-original-author');
    var postCard = quoteButton.closest('.post-card');

    /* Check if form already open */
    if (postCard.querySelector('.post-card-quote-repost-form')) return;

    var quoteForm = document.createElement('div');
    quoteForm.className = 'post-card-quote-repost-form';
    quoteForm.innerHTML =
      '<div class="post-card-quote-repost-original">' +
      '<span class="post-card-quote-repost-original-author">' + escapeHtmlText(originalAuthor) + '</span>: ' +
      '<span class="post-card-quote-repost-original-text">' + escapeHtmlText(originalText) + '</span>' +
      '</div>' +
      '<textarea class="post-card-quote-repost-textarea" id="post-card-quote-repost-textarea-' + postId + '" name="post_card_quote_repost_textarea_' + postId + '" rows="2" placeholder="আপনার মন্তব্য লিখুন..."></textarea>' +
      '<div class="post-card-quote-repost-buttons">' +
      '<button type="button" class="post-card-quote-repost-submit" id="post-card-quote-repost-submit-' + postId + '" name="post_card_quote_repost_submit_' + postId + '">Quote Repost</button>' +
      '<button type="button" class="post-card-quote-repost-cancel" id="post-card-quote-repost-cancel-' + postId + '" name="post_card_quote_repost_cancel_' + postId + '">বাতিল</button>' +
      '</div>';

    var actionsBar = postCard.querySelector('.post-card-actions');
    if (actionsBar) actionsBar.insertAdjacentElement('afterend', quoteForm);

    quoteForm.querySelector('.post-card-quote-repost-cancel').addEventListener('click', function () { quoteForm.remove(); });

    quoteForm.querySelector('.post-card-quote-repost-submit').addEventListener('click', function () {
      var quoteText = quoteForm.querySelector('.post-card-quote-repost-textarea').value.trim();
      if (!quoteText) return;

      fetch('/post/api/' + postId + '/repost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ quote_comment_text: quoteText }),
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          quoteForm.innerHTML = '<div style="padding:.4rem;font-size:.75rem;color:#059669;">✓ Quote repost হয়েছে</div>';
          setTimeout(function () { quoteForm.remove(); }, 2000);
        }
      })
      .catch(function () {});
    });
  });

  /* ---- POLL VOTE ---- */
  document.addEventListener('click', function (event) {
    var pollOption = event.target.closest('.post-card-poll-option');
    if (!pollOption || pollOption.disabled) return;

    var postId = pollOption.getAttribute('data-post-id');
    var pollId = pollOption.getAttribute('data-poll-id');
    var optionNumber = parseInt(pollOption.getAttribute('data-option-number'), 10);

    pollOption.disabled = true;

    fetch('/post/api/' + postId + '/poll-vote/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
      body: JSON.stringify({ poll_id: parseInt(pollId, 10), selected_option_number: optionNumber }),
    })
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (data.success) {
        var pollContainer = pollOption.closest('.post-card-poll');
        var allOptions = pollContainer.querySelectorAll('.post-card-poll-option');
        allOptions.forEach(function (option) {
          option.disabled = true;
          var optNum = parseInt(option.getAttribute('data-option-number'), 10);
          var matchingOption = data.options.find(function (optionData) { return optionData.option_number === optNum; });
          if (matchingOption) {
            var barHtml = '<span class="post-card-poll-option-bar" style="width: ' + matchingOption.percentage + '%;"></span>';
            var pctHtml = '<span class="post-card-poll-option-percentage">' + matchingOption.percentage + '%</span>';
            option.insertAdjacentHTML('beforeend', barHtml + pctHtml);
          }
          if (optNum === data.selected_option_number) {
            option.classList.add('post-card-poll-option-voted');
          }
        });
        var totalElement = pollContainer.querySelector('.post-card-poll-total');
        if (totalElement) totalElement.textContent = data.total_vote_count + ' ভোট';
      }
    })
    .catch(function () { pollOption.disabled = false; });
  });

  /* ---- PIN POST ---- */
  document.addEventListener('click', function (event) {
    var pinButton = event.target.closest('.post-card-pin-button');
    if (!pinButton) return;

    var postId = pinButton.getAttribute('data-post-id');
    pinButton.disabled = true;

    fetch('/post/api/' + postId + '/pin/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
      body: JSON.stringify({}),
    })
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (data.success) {
        pinButton.textContent = data.is_pinned ? '📌 Unpin Post' : '📌 Pin Post';
        window.location.reload();
      }
      pinButton.disabled = false;
    })
    .catch(function () { pinButton.disabled = false; });
  });

  /* ---- LINK PREVIEW — detect URLs in post text, fetch og:preview ---- */
  var postTextElements = document.querySelectorAll('.post-card-text');
  postTextElements.forEach(function (textElement) {
    var textContent = textElement.textContent || '';
    var urlMatches = textContent.match(/https?:\/\/[^\s]+/g);
    if (!urlMatches || urlMatches.length === 0) return;

    var postCard = textElement.closest('.post-card');
    var previewContainer = postCard ? postCard.querySelector('.post-card-link-previews') : null;
    if (!previewContainer) return;

    urlMatches.slice(0, 2).forEach(function (detectedUrl) {
      fetch('/newsengine/api/link-preview/?url=' + encodeURIComponent(detectedUrl))
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (!data.success || !data.title) return;
          var previewCard = document.createElement('a');
          previewCard.href = data.url;
          previewCard.target = '_blank';
          previewCard.rel = 'noopener';
          previewCard.className = 'post-card-link-preview-card';
          var previewHtml = '';
          if (data.image) {
            previewHtml += '<img src="' + data.image + '" alt="" class="post-card-link-preview-image" onerror="this.style.display=\'none\'">';
          }
          previewHtml += '<div class="post-card-link-preview-info">';
          previewHtml += '<span class="post-card-link-preview-title">' + data.title + '</span>';
          if (data.description) {
            previewHtml += '<span class="post-card-link-preview-description">' + data.description + '</span>';
          }
          previewHtml += '</div>';
          previewCard.innerHTML = previewHtml;
          previewContainer.appendChild(previewCard);
        })
        .catch(function () {});
    });
  });

  /* ---- @MENTION RENDERING — convert @username to clickable links ---- */
  postTextElements.forEach(function (textElement) {
    var html = textElement.innerHTML;
    if (html.indexOf('@') === -1) return;
    var mentionRegex = /@([a-zA-Z0-9_]+)/g;
    var newHtml = html.replace(mentionRegex, '<a href="/portal/profile/public/?user=$1" class="post-card-mention-link">@$1</a>');
    if (newHtml !== html) {
      textElement.innerHTML = newHtml;
    }
  });

  /* ---- VIDEO THUMBNAIL — extract frame at 1s, skip black/solid frames ---- */
  var videoElements = document.querySelectorAll('.post-card-media-video-full');
  videoElements.forEach(function (videoElement) {
    if (videoElement.poster) return;

    function extractThumbnail() {
      try {
        if (videoElement.videoWidth === 0) return;
        var canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        var context = canvas.getContext('2d');
        context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        /* Check if frame is mostly black/solid — sample 5 pixels */
        var imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
        var samplePoints = [0, Math.floor(imageData.length / 4), Math.floor(imageData.length / 2), Math.floor(imageData.length * 3 / 4), imageData.length - 4];
        var darkPixelCount = 0;
        samplePoints.forEach(function (offset) {
          var red = imageData[offset];
          var green = imageData[offset + 1];
          var blue = imageData[offset + 2];
          if (red < 30 && green < 30 && blue < 30) darkPixelCount++;
        });

        if (darkPixelCount >= 4 && videoElement.currentTime < 3) {
          videoElement.currentTime = Math.min(videoElement.currentTime + 2, videoElement.duration - 0.5);
          return;
        }

        videoElement.poster = canvas.toDataURL('image/jpeg', 0.7);
        videoElement.currentTime = 0;
      } catch (thumbnailError) {}
    }

    videoElement.addEventListener('seeked', extractThumbnail);

    /* Try to seek — works if video is already loaded or has metadata */
    if (videoElement.readyState >= 1) {
      videoElement.currentTime = 1;
    } else {
      videoElement.addEventListener('loadedmetadata', function () {
        videoElement.currentTime = 1;
      }, { once: true });
    }
  });

})();
