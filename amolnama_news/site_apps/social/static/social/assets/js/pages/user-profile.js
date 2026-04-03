/* user-profile.js — Follow/block button handlers on public profile page. */
(function () {
  'use strict';

  function getCsrfTokenValue() {
    var cookieMatch = document.cookie.match(/csrftoken=([^;]+)/);
    return cookieMatch ? cookieMatch[1] : '';
  }

  /* ---- Follow toggle ---- */
  var followButton = document.getElementById('user-profile-follow-button');
  if (followButton) {
    followButton.addEventListener('click', function () {
      var userProfileId = followButton.getAttribute('data-user-profile-id');
      fetch('/social/api/follow/' + userProfileId + '/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        if (data.following) {
          followButton.textContent = 'Following';
          followButton.classList.add('user-profile-follow-button-active');
        } else {
          followButton.textContent = 'Follow';
          followButton.classList.remove('user-profile-follow-button-active');
        }
      });
    });
  }

  /* ---- Block toggle ---- */
  var blockButton = document.getElementById('user-profile-block-button');
  if (blockButton) {
    blockButton.addEventListener('click', function () {
      var userProfileId = blockButton.getAttribute('data-user-profile-id');
      fetch('/social/api/block/' + userProfileId + '/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        if (data.blocked) {
          blockButton.textContent = 'Unblock';
          blockButton.classList.add('user-profile-block-button-active');
        } else {
          blockButton.textContent = 'Block';
          blockButton.classList.remove('user-profile-block-button-active');
        }
      });
    });
  }
})();
