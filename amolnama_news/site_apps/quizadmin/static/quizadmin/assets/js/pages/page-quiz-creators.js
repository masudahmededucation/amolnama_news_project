/* Quiz creators management — search users, grant/revoke permissions. */
(function () {
  'use strict';

  var searchInput = document.getElementById('quizadmin-creator-search-input');
  var searchResults = document.getElementById('quizadmin-creator-search-results');
  var selectedUserInput = document.getElementById('quizadmin-creator-selected-user-profile-id');
  var expiresAtInput = document.getElementById('quizadmin-creator-expires-at');
  var notesInput = document.getElementById('quizadmin-creator-notes');
  var grantButton = document.getElementById('quizadmin-creator-grant-button');
  var inlineMessage = document.getElementById('quizadmin-creator-inline-message');
  var searchTimeout = null;

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimeout);
      var query = searchInput.value.trim();
      if (query.length < 3) {
        searchResults.hidden = true;
        return;
      }
      searchTimeout = setTimeout(async function () {
        try {
          var csrfToken = window.getCsrfTokenValue ? window.getCsrfTokenValue() : '';
          var response = await fetch('/quizadmin/api/creator/search-users/?q=' + encodeURIComponent(query), {
            headers: { 'X-CSRFToken': csrfToken },
          });
          var body = await response.json();
          if (!body.results || !body.results.length) {
            searchResults.innerHTML = '<div class="quizadmin-creator-search-empty">No users found</div>';
            searchResults.hidden = false;
            return;
          }
          searchResults.innerHTML = '';
          body.results.forEach(function (user) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'quizadmin-creator-search-item';
            item.textContent = user.email + (user.display_name ? ' (' + user.display_name + ')' : '');
            item.dataset.userProfileId = String(user.user_profile_id);
            item.addEventListener('click', function () {
              selectedUserInput.value = String(user.user_profile_id);
              searchInput.value = user.email;
              searchResults.hidden = true;
              grantButton.disabled = false;
            });
            searchResults.appendChild(item);
          });
          searchResults.hidden = false;
        } catch (error) {
          searchResults.innerHTML = '<div class="quizadmin-creator-search-empty">Search failed</div>';
          searchResults.hidden = false;
        }
      }, 300);
    });
  }

  document.addEventListener('click', function (event) {
    if (searchResults && !searchResults.contains(event.target) && event.target !== searchInput) {
      searchResults.hidden = true;
    }
  });

  if (grantButton) {
    grantButton.addEventListener('click', async function () {
      var userProfileId = parseInt(selectedUserInput.value, 10);
      if (!userProfileId) return;

      window.quizadminSetLoading(grantButton, true);
      try {
        await window.quizadminPost('/quizadmin/api/creator/grant/', {
          user_profile_id: userProfileId,
          expires_at: expiresAtInput.value || null,
          permission_notes: notesInput.value || null,
        });
        window.quizadminShowInline(inlineMessage, 'Creator access granted. Reloading...', 'success');
        setTimeout(function () { window.location.reload(); }, 800);
      } catch (error) {
        window.quizadminShowInline(inlineMessage, error.message || 'Grant failed.', 'error');
        window.quizadminSetLoading(grantButton, false, 'Grant access');
      }
    });
  }

  document.addEventListener('click', async function (event) {
    var revokeButton = event.target.closest('.quizadmin-creator-revoke-button');
    if (revokeButton) {
      var permissionId = revokeButton.dataset.permissionId;
      if (revokeButton.dataset.confirmed !== 'true') {
        revokeButton.dataset.confirmed = 'true';
        revokeButton.textContent = 'Confirm';
        revokeButton.classList.add('quizadmin-creator-revoke-confirm');
        setTimeout(function () {
          if (revokeButton.dataset.confirmed === 'true') {
            revokeButton.textContent = 'Revoke';
            delete revokeButton.dataset.confirmed;
            revokeButton.classList.remove('quizadmin-creator-revoke-confirm');
          }
        }, 3000);
        return;
      }
      revokeButton.disabled = true;
      try {
        await window.quizadminPost('/quizadmin/api/creator/' + permissionId + '/revoke/', {});
        window.quizadminShowInline(inlineMessage, 'Access revoked.', 'success');
        setTimeout(function () { window.location.reload(); }, 600);
      } catch (error) {
        window.quizadminShowInline(inlineMessage, error.message || 'Revoke failed.', 'error');
        revokeButton.disabled = false;
      }
    }
  });
})();
