/* user-profile.js — Follow/block button handlers on public profile page. */
(function () {
  'use strict';


  /* ---- Follow toggle ---- */
  const followButton = document.getElementById('user-profile-follow-button');
  if (followButton) {
    followButton.addEventListener('click', function () {
      let userProfileId = followButton.getAttribute('data-user-profile-id');
      fetch('/social/api/follow/' + userProfileId + '/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        if (data.following) {
          followButton.textContent = 'Following';
          followButton.classList.add('user-profile-follow-button-active');
        } else {
          followButton.textContent = 'Follow';
          followButton.classList.remove('user-profile-follow-button-active');
        }
      })
      .catch(function (followToggleError) {
        console.error('User profile follow toggle failed:', followToggleError);
        followButton.textContent = 'Follow';
      });
    });
  }

  /* ---- Block toggle ---- */
  const blockButton = document.getElementById('user-profile-block-button');
  if (blockButton) {
    blockButton.addEventListener('click', function () {
      const userProfileId = blockButton.getAttribute('data-user-profile-id');
      fetch('/social/api/block/' + userProfileId + '/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        if (data.blocked) {
          blockButton.textContent = 'Unblock';
          blockButton.classList.add('user-profile-block-button-active');
        } else {
          blockButton.textContent = 'Block';
          blockButton.classList.remove('user-profile-block-button-active');
        }
      })
      .catch(function (blockToggleError) {
        console.error('User profile block toggle failed:', blockToggleError);
      });
    });
  }
})();
