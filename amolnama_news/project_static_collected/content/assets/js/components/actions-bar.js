/**
 * actions-bar.js — Shared actions bar component (like + writer follow + share).
 *
 * Usage:
 *   window.actionsBar.init({
 *     buildLikeApiUrl: function (entityId) {
 *       return '/my-app/api/entity/' + entityId + '/like/';
 *     },
 *   });
 *
 * HTML: use {% content_actions_bar %} template tag (renders content/components/actions-bar.html)
 * CSS: content/assets/css/components/actions-bar.css
 *
 * Like button must have data-entity-id attribute and class .actions-bar-like-button.
 * Like API response must return: { success: true, liked: bool, like_count: int }
 * Follow button must have data-user-profile-id and class .actions-bar-follow-button.
 * Share button uses Web Share API with clipboard fallback.
 */
(function () {
  'use strict';

  let config = {};


  /* ---- Shared helper: toggle follow buttons state ---- */

  function setFollowButtonsState(allFollowButtons, isFollowing) {
    for (var buttonIndex = 0; buttonIndex < allFollowButtons.length; buttonIndex++) {
      if (isFollowing) {
        allFollowButtons[buttonIndex].classList.add('actions-bar-follow-button-active');
        allFollowButtons[buttonIndex].textContent = 'Unfollow';
      } else {
        allFollowButtons[buttonIndex].classList.remove('actions-bar-follow-button-active');
        allFollowButtons[buttonIndex].textContent = 'Follow';
      }
    }
  }


  /* ---- Like toggle ---- */

  const likeRequestInProgress = {};

  document.addEventListener('click', function (event) {
    const likeButton = event.target.closest('.actions-bar-like-button');
    if (!likeButton) return;

    event.preventDefault();
    event.stopPropagation();

    if (typeof config.buildLikeApiUrl !== 'function') return;

    const entityId = likeButton.getAttribute('data-entity-id');
    if (!entityId || likeRequestInProgress[entityId]) return;

    likeRequestInProgress[entityId] = true;

    const apiUrl = config.buildLikeApiUrl(entityId);
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrfTokenValue() },
    })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      likeRequestInProgress[entityId] = false;
      if (!data.success) return;

      /* Update ALL like buttons for this entity (top + bottom bars) */
      const allButtons = document.querySelectorAll('.actions-bar-like-button[data-entity-id="' + entityId + '"]');
      for (let buttonIndex = 0; buttonIndex < allButtons.length; buttonIndex++) {
        const matchingButton = allButtons[buttonIndex];
        const countElement = matchingButton.querySelector('.actions-bar-like-count');
        if (data.liked) {
          matchingButton.classList.add('actions-bar-like-button-active');
        } else {
          matchingButton.classList.remove('actions-bar-like-button-active');
        }
        if (countElement) countElement.textContent = data.like_count;
      }
    })
    .catch(function (likeError) {
      console.error('Actions bar like failed:', likeError);
      likeRequestInProgress[entityId] = false;
    });
  });

  /* ---- Writer Follow toggle (optimistic UI with rollback) ---- */

  document.addEventListener('click', function (event) {
    const followButton = event.target.closest('.actions-bar-follow-button');
    if (!followButton) return;

    event.preventDefault();
    event.stopPropagation();

    const authorUserProfileId = followButton.getAttribute('data-user-profile-id');
    if (!authorUserProfileId) return;

    var allFollowButtons = document.querySelectorAll('.actions-bar-follow-button[data-user-profile-id="' + authorUserProfileId + '"]');
    var wasActive = followButton.classList.contains('actions-bar-follow-button-active');

    /* Optimistic toggle */
    setFollowButtonsState(allFollowButtons, !wasActive);

    /* Server sync */
    fetch('/social/api/follow/' + authorUserProfileId + '/', {
      method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
    })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      if (!data.success) {
        setFollowButtonsState(allFollowButtons, wasActive);
      }
    })
    .catch(function (followError) {
      console.error('Actions bar follow toggle failed:', followError);
      setFollowButtonsState(allFollowButtons, wasActive);
    });
  });

  /* ---- Bookmark toggle (universal — POSTs to /newsengine/api/bookmark/toggle/) ---- */

  const bookmarkRequestInProgress = {};
  const BOOKMARK_API_URL = '/newsengine/api/bookmark/toggle/';

  document.addEventListener('click', function (event) {
    const bookmarkButton = event.target.closest('.actions-bar-bookmark-button');
    if (!bookmarkButton) return;

    event.preventDefault();
    event.stopPropagation();

    const contentType = bookmarkButton.getAttribute('data-content-type');
    const contentId = bookmarkButton.getAttribute('data-content-id');
    const contentTitle = bookmarkButton.getAttribute('data-content-title') || '';
    const contentUrl = bookmarkButton.getAttribute('data-content-url') || '';
    if (!contentType || !contentId) return;

    const requestKey = contentType + ':' + contentId;
    if (bookmarkRequestInProgress[requestKey]) return;
    bookmarkRequestInProgress[requestKey] = true;

    fetch(BOOKMARK_API_URL, {
      method: 'POST',
      headers: {
        'X-CSRFToken': getCsrfTokenValue(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content_type_code: contentType,
        content_id: contentId,
        content_title: contentTitle,
        content_url: contentUrl,
      }),
    })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      bookmarkRequestInProgress[requestKey] = false;
      if (!data.success) return;

      /* Update ALL bookmark buttons for this content (top + bottom bars on the page) */
      const allButtons = document.querySelectorAll(
        '.actions-bar-bookmark-button[data-content-type="' + contentType + '"][data-content-id="' + contentId + '"]'
      );
      for (let buttonIndex = 0; buttonIndex < allButtons.length; buttonIndex++) {
        const matchingButton = allButtons[buttonIndex];
        const countElement = matchingButton.querySelector('.actions-bar-bookmark-count');
        if (data.bookmarked) {
          matchingButton.classList.add('actions-bar-bookmark-button-active');
        } else {
          matchingButton.classList.remove('actions-bar-bookmark-button-active');
        }
        if (countElement && typeof data.bookmark_count !== 'undefined') {
          countElement.textContent = data.bookmark_count;
        }
      }
    })
    .catch(function (bookmarkError) {
      console.error('Actions bar bookmark failed:', bookmarkError);
      bookmarkRequestInProgress[requestKey] = false;
    });
  });

  /* ---- Share dropdown ---- */

  function getCsrfTokenValue() {
    const csrfCookie = document.cookie.split(';').find(function (cookieEntry) { return cookieEntry.trim().startsWith('csrftoken='); });
    return csrfCookie ? csrfCookie.split('=')[1] : '';
  }

  function closeAllShareDropdowns(except) {
    document.querySelectorAll('.actions-bar-share-dropdown').forEach(function (dropdown) {
      if (dropdown !== except) {
        dropdown.hidden = true;
        const wrapper = dropdown.closest('.actions-bar-share-wrapper');
        if (wrapper) {
          const button = wrapper.querySelector('.actions-bar-share-button');
          if (button) button.setAttribute('aria-expanded', 'false');
        }
      }
    });
  }

  /* Toggle dropdown on share button click */
  document.addEventListener('click', function (event) {
    const shareButton = event.target.closest('.actions-bar-share-button');
    if (!shareButton) return;

    event.preventDefault();
    event.stopPropagation();

    const wrapper = shareButton.closest('.actions-bar-share-wrapper');
    if (!wrapper) return;
    const dropdown = wrapper.querySelector('.actions-bar-share-dropdown');
    if (!dropdown) return;

    const isOpen = !dropdown.hidden;
    closeAllShareDropdowns(isOpen ? null : dropdown);
    dropdown.hidden = isOpen;
    shareButton.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  });

  /* Close dropdown on outside click */
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.actions-bar-share-wrapper')) {
      closeAllShareDropdowns(null);
    }
  });

  /* Copy link option */
  document.addEventListener('click', function (event) {
    const copyLinkButton = event.target.closest('.actions-bar-share-copy-link');
    if (!copyLinkButton) return;

    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl).then(function () {
      const label = copyLinkButton.querySelector('.actions-bar-share-option-label');
      if (label) {
        const originalText = label.textContent;
        label.textContent = '✓ কপি হয়েছে';
        setTimeout(function () { label.textContent = originalText; }, 1500);
      }
    }).catch(function (clipboardError) {
      console.error('Clipboard write failed:', clipboardError);
    });
  });

  /* External share option (Web Share API) */
  document.addEventListener('click', function (event) {
    const externalShareButton = event.target.closest('.actions-bar-share-external');
    if (!externalShareButton) return;

    const wrapper = externalShareButton.closest('.actions-bar-share-wrapper');
    const shareButton = wrapper ? wrapper.querySelector('.actions-bar-share-button') : null;
    const shareTitle = shareButton ? (shareButton.getAttribute('data-title') || '') : '';
    const shareUrl = window.location.href;

    if (navigator.share) {
      navigator.share({ title: shareTitle, url: shareUrl }).catch(function (shareError) {
        console.error('Web Share API failed:', shareError);
      });
    } else {
      navigator.clipboard.writeText(shareUrl).then(function () {
        const label = externalShareButton.querySelector('.actions-bar-share-option-label');
        if (label) {
          const originalText = label.textContent;
          label.textContent = '✓ লিংক কপি হয়েছে';
          setTimeout(function () { label.textContent = originalText; }, 1500);
        }
      }).catch(function (clipboardError) {
        console.error('Clipboard write failed:', clipboardError);
      });
    }
    closeAllShareDropdowns(null);
  });

  /* Share to my wall option */
  document.addEventListener('click', function (event) {
    const shareToWallButton = event.target.closest('.actions-bar-share-to-wall');
    if (!shareToWallButton) return;

    const wrapper = shareToWallButton.closest('.actions-bar-share-wrapper');
    const shareButton = wrapper ? wrapper.querySelector('.actions-bar-share-button') : null;
    const contentRegistryId = shareButton ? shareButton.getAttribute('data-content-registry-id') : '';

    if (!contentRegistryId) {
      console.error('Share to wall: missing content_registry_id');
      return;
    }

    shareToWallButton.disabled = true;
    const label = shareToWallButton.querySelector('.actions-bar-share-option-label');
    const originalText = label ? label.textContent : '';
    if (label) label.textContent = 'শেয়ার হচ্ছে...';

    fetch('/post/api/share-to-wall/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
      body: JSON.stringify({ content_registry_id: parseInt(contentRegistryId, 10) }),
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          if (label) label.textContent = '✓ ' + data.message;
          setTimeout(function () {
            if (label) label.textContent = originalText;
            shareToWallButton.disabled = false;
            closeAllShareDropdowns(null);
          }, 1800);
        } else {
          if (label) label.textContent = data.error || 'ব্যর্থ হয়েছে';
          setTimeout(function () {
            if (label) label.textContent = originalText;
            shareToWallButton.disabled = false;
          }, 2000);
        }
      })
      .catch(function (shareError) {
        console.error('Share to wall failed:', shareError);
        if (label) label.textContent = 'নেটওয়ার্ক ত্রুটি';
        setTimeout(function () {
          if (label) label.textContent = originalText;
          shareToWallButton.disabled = false;
        }, 2000);
      });
  });

  /* ---- Init ---- */

  function initActionsBar(userConfig) {
    /* Bookmark API is universal — no per-app config needed.
       Like API is per-app (poems vs likes vs comments differ), so still uses buildLikeApiUrl. */
    config = {
      buildLikeApiUrl: userConfig.buildLikeApiUrl,
    };
  }

  window.actionsBar = {
    init: initActionsBar,
  };
})();
