/* follow-list.js — Followers/Following list page interactions
   Features: client-side search filter, load more pagination, follow/unfollow toggle */
(function () {
  'use strict';

  var pageContainer = document.getElementById('follow-list-page');
  if (!pageContainer) return;

  var userProfileId = parseInt(pageContainer.getAttribute('data-user-profile-id'), 10);
  var listType = pageContainer.getAttribute('data-list-type');
  var usersContainer = document.getElementById('follow-list-users');
  var searchInput = document.getElementById('follow-list-search-input');
  var loadMoreButton = document.getElementById('follow-list-load-more-button');
  var loadMoreWrapper = document.getElementById('follow-list-load-more-wrapper');
  var currentOffset = usersContainer ? usersContainer.querySelectorAll('.follow-list-user-card').length : 0;

  // =========================================================
  // CLIENT-SIDE SEARCH FILTER
  // =========================================================

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      var query = searchInput.value.trim().toLowerCase();
      var cards = usersContainer.querySelectorAll('.follow-list-user-card');
      cards.forEach(function (card) {
        var displayName = (card.getAttribute('data-display-name') || '').toLowerCase();
        var usernameHandle = (card.getAttribute('data-username-handle') || '').toLowerCase();
        var matches = !query || displayName.indexOf(query) !== -1 || usernameHandle.indexOf(query) !== -1;
        card.hidden = !matches;
      });
    });
  }

  // =========================================================
  // LOAD MORE (PAGINATION)
  // =========================================================

  if (loadMoreButton) {
    loadMoreButton.addEventListener('click', function () {
      loadMoreButton.disabled = true;
      loadMoreButton.textContent = 'লোড হচ্ছে...';

      fetch('/social/api/follow-list/' + userProfileId + '/?type=' + encodeURIComponent(listType) + '&offset=' + currentOffset, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data.success) return;

        data.users.forEach(function (user) {
          var cardHtml = buildUserCardHtml(user);
          usersContainer.insertAdjacentHTML('beforeend', cardHtml);
        });

        currentOffset += data.users.length;

        if (!data.has_more && loadMoreWrapper) {
          loadMoreWrapper.hidden = true;
        } else {
          loadMoreButton.disabled = false;
          loadMoreButton.textContent = 'আরও দেখুন (Load more)';
        }
      })
      .catch(function (error) {
        console.error('Follow list load more failed:', error);
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = 'আরও দেখুন (Load more)';
      });
    });
  }

  function buildUserCardHtml(user) {
    var avatarHtml = user.avatar_url
      ? '<img src="' + escapeHtml(user.avatar_url) + '" alt="' + escapeHtml(user.display_name) + '" class="follow-list-user-avatar" loading="lazy">'
      : '<span class="follow-list-user-avatar-initials">' + escapeHtml((user.display_name || '?').charAt(0)) + '</span>';

    var verifiedHtml = user.is_verified
      ? '<svg class="follow-list-user-verified-badge" viewBox="0 0 24 24" fill="#1877F2" width="14" height="14"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67.63 13.43-.25 12-.25S9.33.63 8.66 1.94c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 7.33 1.75 8.57 1.75 12c0 1.43.88 2.67 2.19 3.34-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/></svg>'
      : '';

    var followsYouHtml = user.follows_you
      ? '<span class="follow-list-user-follows-you-badge">Follows you</span>'
      : '';

    var bioHtml = user.professional_bio_summary
      ? '<p class="follow-list-user-bio">' + escapeHtml(user.professional_bio_summary) + '</p>'
      : '';

    var followButtonHtml = '';
    if (!user.is_own_profile) {
      var buttonClass = user.is_following ? ' follow-list-follow-button-active' : '';
      var buttonText = user.is_following ? 'Unfollow' : 'Follow';
      followButtonHtml = '<button type="button" class="follow-list-follow-button' + buttonClass + '" id="follow-list-follow-button-' + user.user_profile_id + '" name="follow_list_follow_button_' + user.user_profile_id + '" data-user-profile-id="' + user.user_profile_id + '">' + buttonText + '</button>';
    }

    return '<div class="follow-list-user-card" id="follow-list-user-card-' + user.user_profile_id + '" data-user-profile-id="' + user.user_profile_id + '" data-display-name="' + escapeHtml(user.display_name) + '" data-username-handle="' + escapeHtml(user.username_handle) + '">' +
      '<a href="/social/@' + escapeHtml(user.username_handle) + '/" class="follow-list-user-link" id="follow-list-user-link-' + user.user_profile_id + '" name="follow_list_user_link_' + user.user_profile_id + '">' +
        avatarHtml +
        '<div class="follow-list-user-info">' +
          '<div class="follow-list-user-name-row">' +
            '<span class="follow-list-user-display-name">' + escapeHtml(user.display_name || 'ব্যবহারকারী') + '</span>' +
            verifiedHtml + followsYouHtml +
          '</div>' +
          '<span class="follow-list-user-handle">@' + escapeHtml(user.username_handle) + '</span>' +
          bioHtml +
        '</div>' +
      '</a>' +
      followButtonHtml +
    '</div>';
  }

  // =========================================================
  // FOLLOW / UNFOLLOW TOGGLE (delegated)
  // =========================================================

  if (usersContainer) {
    usersContainer.addEventListener('click', function (event) {
      var followButton = event.target.closest('.follow-list-follow-button');
      if (!followButton) return;

      event.preventDefault();
      event.stopPropagation();

      var targetUserProfileId = parseInt(followButton.getAttribute('data-user-profile-id'), 10);
      followButton.disabled = true;

      fetch('/social/api/follow/' + targetUserProfileId + '/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        followButton.disabled = false;
        if (data.success) {
          if (data.following) {
            followButton.textContent = 'Unfollow';
            followButton.classList.add('follow-list-follow-button-active');
          } else {
            followButton.textContent = 'Follow';
            followButton.classList.remove('follow-list-follow-button-active');
          }
        }
      })
      .catch(function (error) {
        console.error('Follow toggle failed:', error);
        followButton.disabled = false;
      });
    });
  }

})();
