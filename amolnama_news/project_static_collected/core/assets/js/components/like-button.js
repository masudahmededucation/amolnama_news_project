/**
 * like-button.js — Shared like button component.
 *
 * Usage:
 *   window.likeButton.init({
 *     buttonSelector: '.like-button',
 *     buildApiUrl: function (entityId) {
 *       return '/my-app/api/article/' + entityId + '/like/';
 *     },
 *   });
 *
 * HTML: use core/components/like-button.html include
 * CSS: core/assets/css/components/like-button.css
 *
 * The button must have data-entity-id attribute.
 * API response must return: { success: true, liked: bool, like_count: int }
 */
(function () {
  'use strict';

  let config = {};


  function handleLikeClick(event) {
    const likeButton = event.target.closest(config.buttonSelector);
    if (!likeButton) return;

    event.preventDefault();
    event.stopPropagation();

    const entityId = likeButton.getAttribute('data-entity-id');
    if (!entityId) return;

    likeButton.disabled = true;

    const apiUrl = config.buildApiUrl(entityId);
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrfTokenValue() },
    })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      likeButton.disabled = false;

      if (!data.success) {
        return;
      }

      /* Update ALL like buttons for this entity (top + bottom bars) */
      const allMatchingButtons = document.querySelectorAll(config.buttonSelector + '[data-entity-id="' + entityId + '"]');
      for (let buttonIndex = 0; buttonIndex < allMatchingButtons.length; buttonIndex++) {
        const matchingButton = allMatchingButtons[buttonIndex];
        const matchingIconElement = matchingButton.querySelector('.like-button-icon');
        const matchingCountElement = matchingButton.querySelector('.like-button-count');

        if (data.liked) {
          matchingButton.classList.add('like-button-active');
          if (matchingIconElement) matchingIconElement.textContent = '👍';
        } else {
          matchingButton.classList.remove('like-button-active');
          if (matchingIconElement) matchingIconElement.textContent = '👍';
        }
        if (matchingCountElement) matchingCountElement.textContent = data.like_count;
      }
    })
    .catch(function (networkError) {
      likeButton.disabled = false;
    });
  }

  function initLikeButton(userConfig) {
    config = {
      buttonSelector: userConfig.buttonSelector || '.like-button',
      buildApiUrl: userConfig.buildApiUrl,
    };

    if (typeof config.buildApiUrl !== 'function') {
      return;
    }

    document.addEventListener('click', handleLikeClick);
  }

  window.likeButton = {
    init: initLikeButton,
  };
})();
