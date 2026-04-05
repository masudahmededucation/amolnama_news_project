/* post-feed-interactions.js — Shared post feed interactions.
   Single delegated click handler for all post card actions.
   Used by both /post/ and /pulse/ pages. */
(function () {
  'use strict';


  /* ---- SVG templates (defined once, reused) ---- */
  const LIKE_SVG_PATH = '<svg viewBox="0 0 24 24" class="post-card-like-svg LIKECLASS"><path d="M2 20h2V8H2v12zm22-11a2 2 0 0 0-2-2h-6.31l.95-4.57.03-.32a1.49 1.49 0 0 0-.44-1.06L15.17 0 7.59 7.59C7.22 7.95 7 8.45 7 9v10a2 2 0 0 0 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>';
  const HEART_SVG_PATH = '<svg viewBox="0 0 24 24" class="post-card-heart-svg HEARTCLASS"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
  const VOTE_SVG_PATH = '<svg viewBox="0 0 24 24" class="post-card-vote-svg VOTECLASS"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>';

  /* ---- Helper: close all open dropdowns ---- */
  function closeAllDropdowns(exceptElement) {
    const allMore = document.querySelectorAll('.post-card-more-menu-dropdown-open');
    for (let i = 0; i < allMore.length; i++) {
      if (allMore[i] !== exceptElement) allMore[i].classList.remove('post-card-more-menu-dropdown-open');
    }
    const allShare = document.querySelectorAll('.post-card-share-menu-dropdown-open');
    for (let j = 0; j < allShare.length; j++) {
      if (allShare[j] !== exceptElement) allShare[j].classList.remove('post-card-share-menu-dropdown-open');
    }
  }

  /* ---- Dominant color background for single images (Facebook-style) ---- */
  function extractDominantColor(imageElement, containerElement) {
    let canvas = document.createElement('canvas');
    let context = canvas.getContext('2d');
    canvas.width = 1;
    canvas.height = 1;
    try {
      context.drawImage(imageElement, 0, 0, 1, 1);
      const pixelData = context.getImageData(0, 0, 1, 1).data;
      containerElement.style.backgroundColor = 'rgb(' + pixelData[0] + ',' + pixelData[1] + ',' + pixelData[2] + ')';
    } catch (crossOriginError) { /* Cross-origin — keep default */ }
  }

  const singleImageElements = document.querySelectorAll('.post-card-media-image-full');
  for (let imageIndex = 0; imageIndex < singleImageElements.length; imageIndex++) {
    (function (imageElement) {
      const containerElement = imageElement.closest('.post-card-media-item-single');
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

  const REPLY_PLACEHOLDERS = [
    'তথ্য যোগ করুন বা সূত্র দিন... (Add info or source...)',
    'ভুল তথ্য থাকলে সংশোধন করুন... (Correct if wrong...)',
    'আরও স্পষ্ট করুন... (Clarify further...)',
    'কিছু জানা থাকলে জানান... (Share what you know...)',
    'Suggest an improvement...',
  ];

  function buildReplyFormHtml(postId) {
    const placeholderText = REPLY_PLACEHOLDERS[Math.floor(Math.random() * REPLY_PLACEHOLDERS.length)];
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
    const replyAvatarHtml = reply.author_avatar_url
      ? '<img src="' + reply.author_avatar_url + '" alt="" class="post-card-reply-avatar-image">'
      : '<span class="post-card-reply-avatar-initials">' + (reply.author_display_name || '?').charAt(0) + '</span>';
    const replyVoteActiveClass = reply.user_voted ? ' post-card-vote-button-active' : '';
    const replyVoteSvgClass = reply.user_voted ? 'post-card-vote-svg-filled' : 'post-card-vote-svg-empty';
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
    let postId = postCard.getAttribute('data-post-id');
    if (!postId) return;

    let contentElement = postCard.querySelector('.post-card-content');
    const existingRepliesSection = postCard.querySelector('.post-card-replies-section');
    if (existingRepliesSection) { existingRepliesSection.remove(); return; }

    /* Show reply form IMMEDIATELY — zero delay */
    let repliesSection = document.createElement('div');
    repliesSection.className = 'post-card-replies-section';
    repliesSection.innerHTML = buildReplyFormHtml(postId);
    contentElement.appendChild(repliesSection);

    /* Focus textarea instantly */
    let replyTextarea = repliesSection.querySelector('.post-card-reply-textarea');
    if (replyTextarea) replyTextarea.focus();

    /* Insert replies — from prefetch cache (instant) or fetch in background */
    function insertRepliesIntoSection(replies) {
      if (!replies || replies.length === 0) return;
      let repliesListHtml = '<div class="post-card-replies-list">';
      for (let replyIndex = 0; replyIndex < replies.length; replyIndex++) {
        repliesListHtml += buildReplyItemHtml(replies[replyIndex]);
      }
      repliesListHtml += '</div>';
      let replyForm = repliesSection.querySelector('.post-card-reply-form');
      if (replyForm) {
        replyForm.insertAdjacentHTML('beforebegin', repliesListHtml);
      } else {
        repliesSection.insertAdjacentHTML('afterbegin', repliesListHtml);
      }
    }

    const cachedReplies = replyPrefetchCache[postId];
    if (Array.isArray(cachedReplies)) {
      /* Cache hit — render instantly, zero network wait */
      insertRepliesIntoSection(cachedReplies);
    } else {
      /* Cache miss — fetch in background */
      fetch('/post/api/' + postId + '/replies/')
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (data.success) {
          replyPrefetchCache[postId] = data.replies || [];
          insertRepliesIntoSection(data.replies);
        }
      })
      .catch(function (networkError) {
      });
    }
  }

  /* ---- Photo lightbox — uses shared window.photoLightbox component ---- */

  /* ==================================================================
     SINGLE DELEGATED CLICK HANDLER — routes to the right action
     ================================================================== */
  document.addEventListener('click', function (event) {
    const target = event.target;

    /* ---- Block actions while editing a post ---- */
    let clickedPostCard = target.closest('.post-card');
    if (clickedPostCard && clickedPostCard.getAttribute('data-editing') === '1') {
      /* Allow edit save, cancel, and textarea clicks only */
      if (!target.closest('.post-card-edit-save-button') && !target.closest('.post-card-edit-cancel-button') && !target.closest('.post-card-edit-textarea')
          && !target.closest('.post-card-inline-edit-save') && !target.closest('.post-card-inline-edit-cancel') && !target.closest('.post-card-inline-edit-textarea')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }

    /* ---- Follow/Unfollow toggle ---- */
    const followButton = target.closest('.post-card-follow-button');
    if (followButton) {
      event.preventDefault();
      const followUserProfileId = followButton.getAttribute('data-user-profile-id');
      if (!followUserProfileId) return;
      fetch('/social/api/follow/' + followUserProfileId + '/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        /* Update ALL follow buttons for this user across all posts */
        const allFollowButtons = document.querySelectorAll('.post-card-follow-button[data-user-profile-id="' + followUserProfileId + '"]');
        for (let followIndex = 0; followIndex < allFollowButtons.length; followIndex++) {
          const followIconSvg = data.following
            ? '<svg class="post-card-follow-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Following'
            : '<svg class="post-card-follow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> Follow';
          if (data.following) {
            allFollowButtons[followIndex].classList.add('post-card-follow-button-active');
          } else {
            allFollowButtons[followIndex].classList.remove('post-card-follow-button-active');
          }
          allFollowButtons[followIndex].innerHTML = followIconSvg;
        }
      })
      .catch(function () {});
      return;
    }

    /* ---- Upvote toggle ---- */
    const voteButton = target.closest('.post-card-vote-button');
    if (voteButton) {
      event.preventDefault();
      const votePostId = voteButton.getAttribute('data-post-id');
      if (!votePostId) return;
      fetch('/post/api/' + votePostId + '/vote/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        const voteCountElement = voteButton.querySelector('.post-card-vote-count');
        if (voteCountElement) voteCountElement.textContent = data.vote_score_count;
        const voteIconElement = voteButton.querySelector('.post-card-vote-icon');
        if (data.voted) {
          voteButton.classList.add('post-card-vote-button-active');
          if (voteIconElement) voteIconElement.innerHTML = VOTE_SVG_PATH.replace('VOTECLASS', 'post-card-vote-svg-filled');
        } else {
          voteButton.classList.remove('post-card-vote-button-active');
          if (voteIconElement) voteIconElement.innerHTML = VOTE_SVG_PATH.replace('VOTECLASS', 'post-card-vote-svg-empty');
        }
      })
      .catch(function () {});
      return;
    }

    /* ---- Follow Post toggle ---- */
    const followPostButton = target.closest('.post-card-follow-post-button');
    if (followPostButton) {
      event.preventDefault();
      closeAllDropdowns();
      const followPostId = followPostButton.getAttribute('data-post-id');
      if (!followPostId) return;
      fetch('/post/api/' + followPostId + '/follow-post/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        followPostButton.textContent = data.following ? '🔔 Unfollow Post' : '🔔 Follow Post';
      })
      .catch(function () {});
      return;
    }

    /* ---- Flag Post (show inline form) ---- */
    const flagButton = target.closest('.post-card-flag-button');
    if (flagButton) {
      event.preventDefault();
      closeAllDropdowns();
      const flagPostId = flagButton.getAttribute('data-post-id');
      const flagPostCard = flagButton.closest('.post-card');
      if (!flagPostCard || flagPostCard.querySelector('.post-card-flag-form')) return;

      const flagForm = document.createElement('div');
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
    const flagSubmitButton = target.closest('.post-card-flag-submit-button');
    if (flagSubmitButton) {
      const submitFlagPostId = flagSubmitButton.getAttribute('data-post-id');
      const flagFormElement = flagSubmitButton.closest('.post-card-flag-form');
      const selectedReason = flagFormElement.querySelector('input[type="radio"]:checked');
      if (!selectedReason) return;
      const flagDescriptionElement = flagFormElement.querySelector('.post-card-flag-description');
      const flagDescription = flagDescriptionElement ? flagDescriptionElement.value : '';
      flagSubmitButton.disabled = true;
      flagSubmitButton.textContent = 'Submitting...';
      fetch('/post/api/' + submitFlagPostId + '/flag/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ flag_reason_code: selectedReason.value, flag_description: flagDescription || null }),
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (data.success) {
          flagFormElement.innerHTML = '<div class="post-card-flag-success">Thank you. Your flag has been submitted for review.</div>';
          setTimeout(function () { flagFormElement.remove(); }, 3000);
        } else {
          flagSubmitButton.disabled = false;
          flagSubmitButton.textContent = 'Submit Flag';
        }
      })
      .catch(function () {
        flagSubmitButton.disabled = false;
        flagSubmitButton.textContent = 'Submit Flag';
      });
      return;
    }

    /* ---- Flag cancel ---- */
    const flagCancelButton = target.closest('.post-card-flag-cancel-button');
    if (flagCancelButton) {
      const flagFormToRemove = flagCancelButton.closest('.post-card-flag-form');
      if (flagFormToRemove) flagFormToRemove.remove();
      return;
    }

    /* ---- ⋯ More menu toggle ---- */
    const moreMenuButton = target.closest('.post-card-more-menu-button');
    if (moreMenuButton) {
      event.preventDefault();
      let postId = moreMenuButton.getAttribute('data-post-id');
      const dropdown = document.getElementById('post-card-more-dropdown-' + postId);
      if (dropdown) {
        closeAllDropdowns(dropdown);
        dropdown.classList.toggle('post-card-more-menu-dropdown-open');
      }
      return;
    }

    /* ---- Share menu toggle ---- */
    const shareToggle = target.closest('.post-card-share-menu-toggle');
    if (shareToggle) {
      event.preventDefault();
      const sharePostId = shareToggle.getAttribute('data-post-id');
      const shareDropdown = document.getElementById('post-card-share-dropdown-' + sharePostId);
      if (shareDropdown) {
        closeAllDropdowns(shareDropdown);
        shareDropdown.classList.toggle('post-card-share-menu-dropdown-open');
      }
      return;
    }

    /* ---- Copy Link (share button) ---- */
    const shareButton = target.closest('.post-card-share-button');
    if (shareButton) {
      event.preventDefault();
      const copyPostId = shareButton.getAttribute('data-post-id');
      const shareUrl = window.location.origin + '/post/' + copyPostId + '/';
      const parentShareDropdown = shareButton.closest('.post-card-share-menu-dropdown');
      if (parentShareDropdown) parentShareDropdown.classList.remove('post-card-share-menu-dropdown-open');
      navigator.clipboard.writeText(shareUrl).then(function () {
        const shareWrapper = shareButton.closest('.post-card-share-menu-wrapper');
        const toggleLabel = shareWrapper ? shareWrapper.querySelector('.post-card-action-label') : null;
        if (toggleLabel) {
          toggleLabel.textContent = '✓ Copied';
          setTimeout(function () { toggleLabel.textContent = 'শেয়ার'; }, 2000);
        }
      });
      return;
    }

    /* ---- Native Share (Share via) ---- */
    const nativeShareButton = target.closest('.post-card-native-share-button');
    if (nativeShareButton) {
      event.preventDefault();
      const nativePostId = nativeShareButton.getAttribute('data-post-id');
      const nativeShareUrl = window.location.origin + '/post/' + nativePostId + '/';
      closeAllDropdowns();
      if (navigator.share) { navigator.share({ url: nativeShareUrl }); }
      else { navigator.clipboard.writeText(nativeShareUrl); }
      return;
    }

    /* ---- Embed ---- */
    const embedButton = target.closest('.post-card-embed-button');
    if (embedButton) {
      event.preventDefault();
      const embedPostId = embedButton.getAttribute('data-post-id');
      if (!embedPostId) return;
      closeAllDropdowns();

      const embedPostCard = embedButton.closest('.post-card');
      const existingEmbedBox = embedPostCard.querySelector('.post-card-embed-box');
      if (existingEmbedBox) { existingEmbedBox.remove(); return; }

      const embedUrl = window.location.origin + '/post/' + embedPostId + '/embed/';
      const embedCode = '<iframe src="' + embedUrl + '" width="550" height="400" frameborder="0" scrolling="no" allowtransparency="true"></iframe>';
      const embedBox = document.createElement('div');
      embedBox.className = 'post-card-embed-box';
      embedBox.innerHTML = '<div class="post-card-embed-box-label">এম্বেড কোড (Embed Code)</div>'
        + '<textarea class="post-card-embed-box-code" id="post-card-embed-code-' + embedPostId + '" name="post_card_embed_code_' + embedPostId + '" readonly rows="3"></textarea>'
        + '<button type="button" class="post-card-embed-box-copy-button" id="post-card-embed-copy-' + embedPostId + '" name="post_card_embed_copy_' + embedPostId + '">কপি করুন</button>';
      const contentElement = embedPostCard.querySelector('.post-card-content');
      const actionsElement = embedPostCard.querySelector('.post-card-actions');
      contentElement.insertBefore(embedBox, actionsElement);
      const embedCodeTextarea = embedBox.querySelector('.post-card-embed-box-code');
      if (embedCodeTextarea) embedCodeTextarea.value = embedCode;
      return;
    }

    /* ---- Embed copy button ---- */
    const embedCopyButton = target.closest('.post-card-embed-box-copy-button');
    if (embedCopyButton) {
      const codeTextarea = embedCopyButton.closest('.post-card-embed-box').querySelector('.post-card-embed-box-code');
      codeTextarea.select();
      navigator.clipboard.writeText(codeTextarea.value).then(function () {
        embedCopyButton.textContent = '✓ কপি হয়েছে';
        setTimeout(function () { embedCopyButton.textContent = 'কপি করুন'; }, 2000);
      });
      return;
    }

    /* ---- Like toggle ---- */
    const likeButton = target.closest('.post-card-like-button');
    if (likeButton) {
      event.preventDefault();
      const likePostId = likeButton.getAttribute('data-post-id');
      if (!likePostId) return;
      fetch('/post/api/' + likePostId + '/like/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        const likeCountElement = likeButton.querySelector('.post-card-like-count');
        if (likeCountElement) likeCountElement.textContent = data.like_count;
        const likeIconElement = likeButton.querySelector('.post-card-like-icon');
        if (data.liked) {
          likeButton.classList.add('post-card-like-button-active');
          if (likeIconElement) likeIconElement.innerHTML = LIKE_SVG_PATH.replace('LIKECLASS', 'post-card-like-svg-filled');
        } else {
          likeButton.classList.remove('post-card-like-button-active');
          if (likeIconElement) likeIconElement.innerHTML = LIKE_SVG_PATH.replace('LIKECLASS', 'post-card-like-svg-empty');
        }
      })
      .catch(function () {});
      return;
    }

    /* ---- Bookmark toggle ---- */
    const bookmarkButton = target.closest('.post-card-bookmark-button');
    if (bookmarkButton) {
      event.preventDefault();
      const bookmarkPostId = bookmarkButton.getAttribute('data-post-id');
      if (!bookmarkPostId) return;
      fetch('/post/api/' + bookmarkPostId + '/bookmark/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        const bookmarkIconElement = bookmarkButton.querySelector('.post-card-bookmark-icon');
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
      })
      .catch(function () {});
      return;
    }

    /* ---- Repost toggle ---- */
    const repostButton = target.closest('.post-card-repost-button');
    if (repostButton) {
      event.preventDefault();
      const repostPostId = repostButton.getAttribute('data-post-id');
      if (!repostPostId) return;

      /* Optimistic UI — toggle immediately before server responds (Twitter pattern) */
      const repostCountElement = repostButton.querySelector('.post-card-repost-count');
      const repostLabelElement = repostButton.querySelector('.post-card-repost-label');
      const wasActive = repostButton.classList.contains('post-card-repost-button-active');
      const currentCount = parseInt(repostCountElement ? repostCountElement.textContent : '0', 10) || 0;

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
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
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
      });
      return;
    }

    /* ---- Reply button ---- */
    const replyButton = target.closest('.post-card-reply-button');
    if (replyButton) {
      event.preventDefault();
      toggleRepliesSection(replyButton.closest('.post-card'));
      return;
    }

    /* ---- Reply submit ---- */
    const submitReplyButton = target.closest('.post-card-reply-submit-button');
    if (submitReplyButton) {
      const replyPostId = submitReplyButton.getAttribute('data-post-id');
      const replyForm = submitReplyButton.closest('.post-card-reply-form');
      const replyTextarea = replyForm.querySelector('textarea');
      const replyText = (replyTextarea.value || '').trim();
      if (!replyText) { replyTextarea.focus(); return; }
      submitReplyButton.disabled = true;
      submitReplyButton.textContent = 'পাঠানো হচ্ছে...';
      fetch('/post/api/' + replyPostId + '/reply/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ reply_text_bn: replyText }),
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (data.success) {
          replyForm.remove();
          const replyPostCard = document.getElementById('post-card-' + replyPostId);
          if (replyPostCard) {
            const replyCountElement = replyPostCard.querySelector('.post-card-reply-count');
            if (replyCountElement) replyCountElement.textContent = data.reply_count;
          }
        } else { submitReplyButton.disabled = false; submitReplyButton.textContent = 'Submit'; }
      })
      .catch(function () { submitReplyButton.disabled = false; submitReplyButton.textContent = 'Submit'; });
      return;
    }

    /* ---- Reply cancel ---- */
    const cancelReplyButton = target.closest('.post-card-reply-cancel-button');
    if (cancelReplyButton) {
      const repliesSection = cancelReplyButton.closest('.post-card-replies-section');
      if (repliesSection) repliesSection.remove();
      return;
    }

    /* ---- Delete button (show confirm) ---- */
    /* ---- Edit button (inline edit) ---- */
    const editButton = target.closest('.post-card-edit-button');
    if (editButton) {
      event.preventDefault();
      closeAllDropdowns();
      const editPostId = editButton.getAttribute('data-post-id');
      const editPostCard = editButton.closest('.post-card');
      if (!editPostCard) return;

      let textElement = editPostCard.querySelector('.post-card-text');
      if (!textElement || textElement.querySelector('.post-card-edit-textarea')) return;

      let currentText = editButton.getAttribute('data-post-text') || textElement.textContent || '';
      let originalHtml = textElement.innerHTML;

      textElement.innerHTML = '<textarea class="post-card-edit-textarea" id="post-card-edit-textarea-' + editPostId + '" name="post_card_edit_textarea_' + editPostId + '" maxlength="1000">' + escapeHtml(currentText) + '</textarea>'
        + '<div class="post-card-edit-actions">'
        + '<button type="button" class="post-card-edit-save-button" id="post-card-edit-save-' + editPostId + '" name="post_card_edit_save_' + editPostId + '" data-post-id="' + editPostId + '">সংরক্ষণ (Save)</button>'
        + '<button type="button" class="post-card-edit-cancel-button" id="post-card-edit-cancel-' + editPostId + '" name="post_card_edit_cancel_' + editPostId + '">বাতিল (Cancel)</button>'
        + '</div>';

      const editTextareaElement = textElement.querySelector('.post-card-edit-textarea');
      editTextareaElement.style.overflow = 'hidden';
      editTextareaElement.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight + 60) + 'px';
      });
      /* Set initial height based on content */
      editTextareaElement.style.height = 'auto';
      editTextareaElement.style.height = (editTextareaElement.scrollHeight + 60) + 'px';
      editTextareaElement.focus();
      textElement.setAttribute('data-original-html', originalHtml);
      /* Disable actions while editing */
      editPostCard.setAttribute('data-editing', '1');
      let actionsBar = editPostCard.querySelector('.post-card-actions');
      if (actionsBar) actionsBar.style.opacity = '0.3';
      const moreMenuWrapper = editPostCard.querySelector('.post-card-more-menu-wrapper');
      if (moreMenuWrapper) moreMenuWrapper.style.opacity = '0.3';
      return;
    }

    /* ---- Edit save ---- */
    const editSaveButton = target.closest('.post-card-edit-save-button');
    if (editSaveButton) {
      const savePostId = editSaveButton.getAttribute('data-post-id');
      const savePostCard = editSaveButton.closest('.post-card');
      const saveTextElement = savePostCard.querySelector('.post-card-text');
      const editTextarea = saveTextElement.querySelector('.post-card-edit-textarea');
      let newText = (editTextarea.value || '').trim();

      if (!newText) { editTextarea.focus(); return; }

      editSaveButton.disabled = true;
      editSaveButton.textContent = 'সংরক্ষণ হচ্ছে...';

      fetch('/post/api/' + savePostId + '/edit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ post_text: newText }),
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (data.success) {
          saveTextElement.textContent = data.post_text;
          /* Update the edit button's data-post-text for next edit */
          const postEditButton = savePostCard.querySelector('.post-card-edit-button');
          if (postEditButton) postEditButton.setAttribute('data-post-text', data.post_text);
          /* Re-enable actions after edit */
          savePostCard.removeAttribute('data-editing');
          const savedActionsBar = savePostCard.querySelector('.post-card-actions');
          if (savedActionsBar) savedActionsBar.style.opacity = '';
          const savedMoreMenu = savePostCard.querySelector('.post-card-more-menu-wrapper');
          if (savedMoreMenu) savedMoreMenu.style.opacity = '';
        } else {
          editSaveButton.disabled = false;
          editSaveButton.textContent = 'সংরক্ষণ (Save)';
        }
      })
      .catch(function (networkError) {
        editSaveButton.disabled = false;
        editSaveButton.textContent = 'সংরক্ষণ (Save)';
      });
      return;
    }

    /* ---- Edit cancel ---- */
    const editCancelButton = target.closest('.post-card-edit-cancel-button');
    if (editCancelButton) {
      const cancelPostCard = editCancelButton.closest('.post-card');
      const cancelTextElement = editCancelButton.closest('.post-card-text');
      const savedOriginalHtml = cancelTextElement.getAttribute('data-original-html');
      if (savedOriginalHtml) {
        cancelTextElement.innerHTML = savedOriginalHtml;
        cancelTextElement.removeAttribute('data-original-html');
      }
      /* Re-enable actions after cancel */
      if (cancelPostCard) {
        cancelPostCard.removeAttribute('data-editing');
        let cancelActionsBar = cancelPostCard.querySelector('.post-card-actions');
        if (cancelActionsBar) cancelActionsBar.style.opacity = '';
        let cancelMoreMenu = cancelPostCard.querySelector('.post-card-more-menu-wrapper');
        if (cancelMoreMenu) cancelMoreMenu.style.opacity = '';
      }
      return;
    }

    /* ---- Delete button (show confirm) ---- */
    const deleteButton = target.closest('.post-card-delete-button');
    if (deleteButton) {
      event.preventDefault();
      closeAllDropdowns();
      const deletePostId = deleteButton.getAttribute('data-post-id');
      const deletePostCard = deleteButton.closest('.post-card');
      if (!deletePostCard || deletePostCard.querySelector('.post-card-delete-confirm')) return;
      const confirmElement = document.createElement('div');
      confirmElement.className = 'post-card-delete-confirm';
      confirmElement.innerHTML = '<span>মুছে ফেলতে চান?</span>'
        + '<button type="button" class="post-card-delete-confirm-yes-button" id="post-card-delete-yes-' + deletePostId + '" name="post_card_delete_yes_' + deletePostId + '" data-post-id="' + deletePostId + '">হ্যাঁ মুছুন</button>'
        + '<button type="button" class="post-card-delete-confirm-no-button" id="post-card-delete-no-' + deletePostId + '" name="post_card_delete_no_' + deletePostId + '">না</button>';
      deletePostCard.querySelector('.post-card-content').appendChild(confirmElement);
      return;
    }

    /* ---- Delete confirm YES ---- */
    const confirmYesButton = target.closest('.post-card-delete-confirm-yes-button');
    if (confirmYesButton) {
      const confirmPostId = confirmYesButton.getAttribute('data-post-id');
      const confirmPostCard = confirmYesButton.closest('.post-card');
      confirmYesButton.disabled = true;
      confirmYesButton.textContent = 'মুছে ফেলা হচ্ছে...';
      fetch('/post/api/' + confirmPostId + '/delete/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (data.success) {
          /* If deleted post was a repost, update the original post's repost button + count */
          if (data.was_repost && data.original_post_id) {
            const originalPostCard = document.getElementById('post-card-' + data.original_post_id);
            if (originalPostCard) {
              const originalRepostButton = originalPostCard.querySelector('.post-card-repost-button');
              if (originalRepostButton) {
                originalRepostButton.classList.remove('post-card-repost-button-active');
                const originalRepostCount = originalRepostButton.querySelector('.post-card-repost-count');
                const originalRepostLabel = originalRepostButton.querySelector('.post-card-repost-label');
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
      .catch(function () { confirmYesButton.disabled = false; confirmYesButton.textContent = 'হ্যাঁ মুছুন'; });
      return;
    }

    /* ---- Delete confirm NO ---- */
    const confirmNoButton = target.closest('.post-card-delete-confirm-no-button');
    if (confirmNoButton) {
      const confirmEl = confirmNoButton.closest('.post-card-delete-confirm');
      if (confirmEl) confirmEl.remove();
      return;
    }

    /* ---- Photo lightbox (uses shared window.photoLightbox) ---- */
    const mediaItem = target.closest('.post-card-media-item');
    if (mediaItem && window.photoLightbox) {
      const photoUrl = mediaItem.getAttribute('data-photo-url');
      if (!photoUrl) return;
      const mediaGrid = mediaItem.closest('.post-card-media-grid');
      if (!mediaGrid) return;
      const allMediaItems = mediaGrid.querySelectorAll('.post-card-media-item[data-photo-url]');
      const photoUrls = [];
      let startIndex = 0;
      for (let itemIndex = 0; itemIndex < allMediaItems.length; itemIndex++) {
        photoUrls.push(allMediaItems[itemIndex].getAttribute('data-photo-url'));
        if (allMediaItems[itemIndex] === mediaItem) startIndex = itemIndex;
      }
      window.photoLightbox.openWithUrls(photoUrls, startIndex);
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

    clickedPostCard = target.closest('.post-card');
    if (clickedPostCard) {
      toggleRepliesSection(clickedPostCard);
      return;
    }

    /* ---- Close all dropdowns when clicking outside everything ---- */
    closeAllDropdowns();
  });

  /* ---- Reply prefetch cache — Twitter-style background loading ---- */
  const replyPrefetchCache = {};
  const replyPrefetchTimers = {};
  const REPLY_PREFETCH_DWELL_MILLISECONDS = 2000;

  function prefetchReplies(postId) {
    if (replyPrefetchCache[postId]) return;
    replyPrefetchCache[postId] = 'loading';
    fetch('/post/api/' + postId + '/replies/')
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      replyPrefetchCache[postId] = (data.success && data.replies) ? data.replies : [];
    })
    .catch(function () { delete replyPrefetchCache[postId]; });
  }

  /* ---- View count — meaningful impression (3s dwell time, 50% visible) ---- */
  const viewedPostIds = {};
  const viewDwellTimers = {};
  const VIEW_DWELL_TIME_MILLISECONDS = 3000;

  const postCardObserver = new IntersectionObserver(function (entries) {
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
      let entry = entries[entryIndex];
      let postCard = entry.target;
      let postId = postCard.getAttribute('data-post-id');
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
            .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
            .then(function (data) {
              if (data.success) {
                const viewCountElement = dwellPostCard.querySelector('.post-card-header-view-count');
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

  const allPostCards = document.querySelectorAll('.post-card');
  for (let cardIndex = 0; cardIndex < allPostCards.length; cardIndex++) {
    postCardObserver.observe(allPostCards[cardIndex]);
  }

  /* ---- QUICK EDIT — inline edit form on pencil button click ---- */
  document.addEventListener('click', function (event) {
    const quickEditButton = event.target.closest('.post-card-quick-edit-button');
    if (!quickEditButton) return;

    let postId = quickEditButton.getAttribute('data-post-id');
    const currentText = quickEditButton.getAttribute('data-post-text');

    /* Works for both post cards and reply items — find the correct text element */
    const replyContainer = quickEditButton.closest('.post-card-reply-item');
    let container;
    let textElement;
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

    const originalHtml = textElement.innerHTML;
    const editForm = document.createElement('div');
    editForm.className = 'post-card-inline-edit-form';
    editForm.innerHTML =
      '<textarea class="post-card-inline-edit-textarea" id="post-card-inline-edit-textarea-' + postId + '" name="post_card_inline_edit_textarea_' + postId + '">' + escapeHtml(currentText) + '</textarea>' +
      '<div class="post-card-inline-edit-buttons">' +
      '<button type="button" class="post-card-inline-edit-save" id="post-card-inline-edit-save-' + postId + '" name="post_card_inline_edit_save_' + postId + '">সংরক্ষণ</button>' +
      '<button type="button" class="post-card-inline-edit-cancel" id="post-card-inline-edit-cancel-' + postId + '" name="post_card_inline_edit_cancel_' + postId + '">বাতিল</button>' +
      '</div>';

    textElement.innerHTML = '';
    textElement.appendChild(editForm);
    const inlineTextareaElement = editForm.querySelector('.post-card-inline-edit-textarea');
    inlineTextareaElement.style.overflow = 'hidden';
    inlineTextareaElement.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight + 60) + 'px';
    });
    inlineTextareaElement.style.height = 'auto';
    inlineTextareaElement.style.height = (inlineTextareaElement.scrollHeight + 60) + 'px';
    /* Disable actions while editing */
    const inlineEditPostCard = quickEditButton.closest('.post-card');
    if (inlineEditPostCard) {
      inlineEditPostCard.setAttribute('data-editing', '1');
      const inlineEditActionsBar = inlineEditPostCard.querySelector('.post-card-actions');
      if (inlineEditActionsBar) inlineEditActionsBar.style.opacity = '0.3';
      const inlineEditMoreMenu = inlineEditPostCard.querySelector('.post-card-more-menu-wrapper');
      if (inlineEditMoreMenu) inlineEditMoreMenu.style.opacity = '0.3';
    }

    editForm.querySelector('.post-card-inline-edit-cancel').addEventListener('click', function () {
      textElement.innerHTML = originalHtml;
      if (inlineEditPostCard) {
        inlineEditPostCard.removeAttribute('data-editing');
        const cancelActionsBar = inlineEditPostCard.querySelector('.post-card-actions');
        if (cancelActionsBar) cancelActionsBar.style.opacity = '';
        const cancelMoreMenu = inlineEditPostCard.querySelector('.post-card-more-menu-wrapper');
        if (cancelMoreMenu) cancelMoreMenu.style.opacity = '';
      }
    });

    editForm.querySelector('.post-card-inline-edit-save').addEventListener('click', function () {
      const newText = editForm.querySelector('.post-card-inline-edit-textarea').value.trim();
      if (!newText) return;

      fetch('/post/api/' + postId + '/edit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ post_text: newText }),
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (data.success) {
          textElement.textContent = newText;
          quickEditButton.setAttribute('data-post-text', newText);
        } else {
          textElement.innerHTML = originalHtml;
        }
        /* Re-enable actions after save */
        if (inlineEditPostCard) {
          inlineEditPostCard.removeAttribute('data-editing');
          const saveActionsBar = inlineEditPostCard.querySelector('.post-card-actions');
          if (saveActionsBar) saveActionsBar.style.opacity = '';
          const saveMoreMenu = inlineEditPostCard.querySelector('.post-card-more-menu-wrapper');
          if (saveMoreMenu) saveMoreMenu.style.opacity = '';
        }
      })
      .catch(function () {
        textElement.innerHTML = originalHtml;
        if (inlineEditPostCard) {
          inlineEditPostCard.removeAttribute('data-editing');
          const errorActionsBar = inlineEditPostCard.querySelector('.post-card-actions');
          if (errorActionsBar) errorActionsBar.style.opacity = '';
          const errorMoreMenu = inlineEditPostCard.querySelector('.post-card-more-menu-wrapper');
          if (errorMoreMenu) errorMoreMenu.style.opacity = '';
        }
      });
    });
  });

  /* ---- EDIT HISTORY — click "(edited)" label to show previous versions ---- */
  document.addEventListener('click', function (event) {
    const editedLabel = event.target.closest('.post-card-edited-label');
    if (!editedLabel) return;

    let postCard = editedLabel.closest('.post-card');
    if (!postCard) return;
    let postId = postCard.getAttribute('data-post-id');
    if (!postId) return;

    /* Toggle — if history already shown, remove it */
    const existingHistory = postCard.querySelector('.post-card-edit-history');
    if (existingHistory) { existingHistory.remove(); return; }

    fetch('/post/api/' + postId + '/edit-history/')
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (!data.success || !data.history || data.history.length === 0) return;

        let historyHtml = '<div class="post-card-edit-history">'
          + '<div class="post-card-edit-history-title">সম্পাদনার ইতিহাস (Edit History)</div>';
        for (let historyIndex = 0; historyIndex < data.history.length; historyIndex++) {
          const entry = data.history[historyIndex];
          historyHtml += '<div class="post-card-edit-history-item">'
            + '<div class="post-card-edit-history-text">' + (entry.previous_text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>'
            + '<div class="post-card-edit-history-date">' + entry.edited_at + '</div>'
            + '</div>';
        }
        historyHtml += '</div>';

        const textElement = postCard.querySelector('.post-card-text');
        if (textElement) textElement.insertAdjacentHTML('afterend', historyHtml);
      })
      .catch(function () {});
  });

  /* ---- POST ANALYTICS — inline card ---- */
  document.addEventListener('click', function (event) {
    const analyticsButton = event.target.closest('.post-card-analytics-button');
    if (!analyticsButton) return;

    let postCard = analyticsButton.closest('.post-card');
    const existingCard = postCard.querySelector('.post-card-analytics-card');
    if (existingCard) { existingCard.remove(); return; }

    const views = parseInt(analyticsButton.getAttribute('data-views') || '0', 10);
    const likes = parseInt(analyticsButton.getAttribute('data-likes') || '0', 10);
    const replies = parseInt(analyticsButton.getAttribute('data-replies') || '0', 10);
    const reposts = parseInt(analyticsButton.getAttribute('data-reposts') || '0', 10);
    const engagementRate = views > 0 ? ((likes + replies + reposts) / views * 100).toFixed(1) : '0.0';

    const analyticsCard = document.createElement('div');
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

    let actionsBar = postCard.querySelector('.post-card-actions');
    if (actionsBar) actionsBar.parentNode.insertBefore(analyticsCard, actionsBar);

    closeAllDropdowns();
  });

  /* ---- QUOTE REPOST — show inline form, then repost with quote text ---- */
  document.addEventListener('click', function (event) {
    const quoteButton = event.target.closest('.post-card-quote-repost-button');
    if (!quoteButton) return;

    let postId = quoteButton.getAttribute('data-post-id');
    const originalText = quoteButton.getAttribute('data-original-text');
    const originalAuthor = quoteButton.getAttribute('data-original-author');
    let postCard = quoteButton.closest('.post-card');

    /* Check if form already open */
    if (postCard.querySelector('.post-card-quote-repost-form')) return;

    const quoteForm = document.createElement('div');
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

    const actionsBar = postCard.querySelector('.post-card-actions');
    if (actionsBar) actionsBar.insertAdjacentElement('afterend', quoteForm);

    quoteForm.querySelector('.post-card-quote-repost-cancel').addEventListener('click', function () { quoteForm.remove(); });

    quoteForm.querySelector('.post-card-quote-repost-submit').addEventListener('click', function () {
      const quoteText = quoteForm.querySelector('.post-card-quote-repost-textarea').value.trim();
      if (!quoteText) return;

      fetch('/post/api/' + postId + '/repost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ quote_comment_text: quoteText }),
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
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
    const pollOption = event.target.closest('.post-card-poll-option');
    if (!pollOption || pollOption.disabled) return;

    let postId = pollOption.getAttribute('data-post-id');
    const pollId = pollOption.getAttribute('data-poll-id');
    const optionNumber = parseInt(pollOption.getAttribute('data-option-number'), 10);

    pollOption.disabled = true;

    fetch('/post/api/' + postId + '/poll-vote/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
      body: JSON.stringify({ poll_id: parseInt(pollId, 10), selected_option_number: optionNumber }),
    })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      if (data.success) {
        const pollContainer = pollOption.closest('.post-card-poll');
        const allOptions = pollContainer.querySelectorAll('.post-card-poll-option');
        allOptions.forEach(function (option) {
          option.disabled = true;
          const optNum = parseInt(option.getAttribute('data-option-number'), 10);
          const matchingOption = data.options.find(function (optionData) { return optionData.option_number === optNum; });
          if (matchingOption) {
            const barHtml = '<span class="post-card-poll-option-bar" style="width: ' + matchingOption.percentage + '%;"></span>';
            const pctHtml = '<span class="post-card-poll-option-percentage">' + matchingOption.percentage + '%</span>';
            option.insertAdjacentHTML('beforeend', barHtml + pctHtml);
          }
          if (optNum === data.selected_option_number) {
            option.classList.add('post-card-poll-option-voted');
          }
        });
        const totalElement = pollContainer.querySelector('.post-card-poll-total');
        if (totalElement) totalElement.textContent = data.total_vote_count + ' ভোট';
      }
    })
    .catch(function () { pollOption.disabled = false; });
  });

  /* ---- PIN POST ---- */
  document.addEventListener('click', function (event) {
    const pinButton = event.target.closest('.post-card-pin-button');
    if (!pinButton) return;

    const postId = pinButton.getAttribute('data-post-id');
    pinButton.disabled = true;

    fetch('/post/api/' + postId + '/pin/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
      body: JSON.stringify({}),
    })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
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
  const postTextElements = document.querySelectorAll('.post-card-text');
  postTextElements.forEach(function (textElement) {
    const textContent = textElement.textContent || '';
    const urlMatches = textContent.match(/https?:\/\/[^\s]+/g);
    if (!urlMatches || urlMatches.length === 0) return;

    const postCard = textElement.closest('.post-card');
    const previewContainer = postCard ? postCard.querySelector('.post-card-link-previews') : null;
    if (!previewContainer) return;

    urlMatches.slice(0, 2).forEach(function (detectedUrl) {
      fetch('/newsengine/api/link-preview/?url=' + encodeURIComponent(detectedUrl))
        .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
        .then(function (data) {
          if (!data.success || !data.title) return;
          const previewCard = document.createElement('a');
          previewCard.href = data.url;
          previewCard.target = '_blank';
          previewCard.rel = 'noopener';
          previewCard.className = 'post-card-link-preview-card';
          let previewHtml = '';
          if (data.image) {
            previewHtml += '<img src="' + escapeHtml(data.image) + '" alt="" class="post-card-link-preview-image" onerror="this.classList.add(\'display-hidden\')">';
          }
          previewHtml += '<div class="post-card-link-preview-info">';
          previewHtml += '<span class="post-card-link-preview-title">' + escapeHtml(data.title) + '</span>';
          if (data.description) {
            previewHtml += '<span class="post-card-link-preview-description">' + escapeHtml(data.description) + '</span>';
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
    const html = textElement.innerHTML;
    if (html.indexOf('@') === -1) return;
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const newHtml = html.replace(mentionRegex, '<a href="/portal/profile/public/?user=$1" class="post-card-mention-link">@$1</a>');
    if (newHtml !== html) {
      textElement.innerHTML = newHtml;
    }
  });

  /* ---- VIDEO THUMBNAIL — extract frame at 1s, skip black/solid frames ---- */
  const videoElements = document.querySelectorAll('.post-card-media-video-full');
  videoElements.forEach(function (videoElement) {
    if (videoElement.poster) return;

    function extractThumbnail() {
      try {
        if (videoElement.videoWidth === 0) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        /* Check if frame is mostly black/solid — sample 5 pixels */
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const samplePoints = [0, Math.floor(imageData.length / 4), Math.floor(imageData.length / 2), Math.floor(imageData.length * 3 / 4), imageData.length - 4];
        let darkPixelCount = 0;
        samplePoints.forEach(function (offset) {
          const red = imageData[offset];
          const green = imageData[offset + 1];
          const blue = imageData[offset + 2];
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

  /* ==================================================================
     LIVE FEED — "New posts" pill via WebSocket
     ================================================================== */

  const feedElement = document.getElementById('post-feed') || document.getElementById('pulse-feed');
  if (feedElement) {
    let newPostCount = 0;
    let feedWebSocket = null;

    /* Create the pill element */
    const newPostsPill = document.createElement('button');
    newPostsPill.type = 'button';
    newPostsPill.className = 'post-feed-new-posts-pill';
    newPostsPill.hidden = true;
    feedElement.parentNode.insertBefore(newPostsPill, feedElement);

    newPostsPill.addEventListener('click', function () {
      newPostsPill.hidden = true;
      newPostCount = 0;
      window.location.reload();
    });

    function updateNewPostsPill() {
      if (newPostCount > 0) {
        newPostsPill.textContent = newPostCount + ' নতুন পোস্ট দেখুন';
        newPostsPill.hidden = false;
      }
    }

    function connectFeedWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const webSocketUrl = protocol + '//' + window.location.host + '/ws/feed/';

      try {
        feedWebSocket = new WebSocket(webSocketUrl);

        feedWebSocket.onmessage = function (event) {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'new_post') {
              newPostCount++;
              updateNewPostsPill();
            }
          } catch (parseError) { /* ignore */ }
        };

        feedWebSocket.onclose = function () {
          feedWebSocket = null;
          setTimeout(connectFeedWebSocket, 10000);
        };

        feedWebSocket.onerror = function () {
          if (feedWebSocket) feedWebSocket.close();
        };
      } catch (webSocketError) { /* WebSocket not available */ }
    }

    connectFeedWebSocket();
  }

})();
