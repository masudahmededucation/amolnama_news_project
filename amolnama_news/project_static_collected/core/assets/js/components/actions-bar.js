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
 * HTML: use core/components/actions-bar.html include
 * CSS: core/assets/css/components/actions-bar.css
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

  /* ---- Share ---- */

  document.addEventListener('click', function (event) {
    const shareButton = event.target.closest('.actions-bar-share-button');
    if (!shareButton) return;

    event.preventDefault();
    const shareTitle = shareButton.getAttribute('data-title') || '';
    const shareUrl = window.location.href;

    if (navigator.share) {
      navigator.share({ title: shareTitle, url: shareUrl }).catch(function (shareError) {
        console.error('Web Share API failed:', shareError);
      });
    } else {
      navigator.clipboard.writeText(shareUrl).then(function () {
        var originalHtml = shareButton.innerHTML;
        shareButton.innerHTML = '✓ লিংক কপি হয়েছে';
        setTimeout(function () { shareButton.innerHTML = originalHtml; }, 2000);
      }).catch(function (clipboardError) {
        console.error('Clipboard write failed:', clipboardError);
      });
    }
  });

  /* ---- Init ---- */

  function initActionsBar(userConfig) {
    config = {
      buildLikeApiUrl: userConfig.buildLikeApiUrl,
    };
  }

  window.actionsBar = {
    init: initActionsBar,
  };
})();
