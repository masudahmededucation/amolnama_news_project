/**
 * actions-bar.js — Shared actions bar component (like + share).
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
 * Share button uses Web Share API with clipboard fallback.
 */
(function () {
  'use strict';

  var config = {};

  function getCsrfTokenValue() {
    var cookieMatch = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
  }

  /* ---- Like toggle ---- */

  var likeRequestInProgress = {};

  document.addEventListener('click', function (event) {
    var likeButton = event.target.closest('.actions-bar-like-button');
    if (!likeButton) return;

    event.preventDefault();
    event.stopPropagation();

    if (typeof config.buildLikeApiUrl !== 'function') return;

    var entityId = likeButton.getAttribute('data-entity-id');
    if (!entityId || likeRequestInProgress[entityId]) return;

    likeRequestInProgress[entityId] = true;

    var apiUrl = config.buildLikeApiUrl(entityId);
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrfTokenValue() },
    })
    .then(function (response) { return response.json(); })
    .then(function (data) {
      likeRequestInProgress[entityId] = false;
      if (!data.success) return;

      /* Update ALL like buttons for this entity (top + bottom bars) */
      var allButtons = document.querySelectorAll('.actions-bar-like-button[data-entity-id="' + entityId + '"]');
      for (var buttonIndex = 0; buttonIndex < allButtons.length; buttonIndex++) {
        var matchingButton = allButtons[buttonIndex];
        var countElement = matchingButton.querySelector('.actions-bar-like-count');
        if (data.liked) {
          matchingButton.classList.add('actions-bar-like-button-active');
        } else {
          matchingButton.classList.remove('actions-bar-like-button-active');
        }
        if (countElement) countElement.textContent = data.like_count;
      }
    })
    .catch(function () {
      likeRequestInProgress[entityId] = false;
    });
  });

  /* ---- Share ---- */

  document.addEventListener('click', function (event) {
    var shareButton = event.target.closest('.actions-bar-share-button');
    if (!shareButton) return;

    event.preventDefault();
    var shareTitle = shareButton.getAttribute('data-title') || '';
    var shareUrl = window.location.href;

    if (navigator.share) {
      navigator.share({ title: shareTitle, url: shareUrl });
    } else {
      navigator.clipboard.writeText(shareUrl).then(function () {
        /* Brief visual feedback */
        var originalHtml = shareButton.innerHTML;
        shareButton.innerHTML = '✓ লিংক কপি হয়েছে';
        setTimeout(function () { shareButton.innerHTML = originalHtml; }, 2000);
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
