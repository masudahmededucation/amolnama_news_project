/* news-admin-form-access.js — Admin panel for managing form access permissions. */
(function () {
  'use strict';

  function getCsrfTokenValue() {
    var cookie = document.cookie.split(';').find(function (c) { return c.trim().startsWith('csrftoken='); });
    return cookie ? cookie.split('=')[1] : '';
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /* ---- Tab switching ---- */
  var tabs = document.querySelectorAll('.news-admin-form-access-tab');
  var panelUserAccess = document.getElementById('news-admin-form-access-panel-user-access');
  var panelFormRestrictions = document.getElementById('news-admin-form-access-panel-form-restrictions');

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('news-admin-form-access-tab-active'); });
      tab.classList.add('news-admin-form-access-tab-active');

      var targetTab = tab.getAttribute('data-tab');
      if (targetTab === 'user-access') {
        panelUserAccess.hidden = false;
        panelFormRestrictions.hidden = true;
      } else {
        panelUserAccess.hidden = true;
        panelFormRestrictions.hidden = false;
      }
    });
  });

  /* ---- Tab 1: User search + form access toggle ---- */
  var searchInput = document.getElementById('news-admin-form-access-search-input');
  var searchResults = document.getElementById('news-admin-form-access-search-results');
  var userDetail = document.getElementById('news-admin-form-access-user-detail');
  var userHeader = document.getElementById('news-admin-form-access-user-header');
  var formGrid = document.getElementById('news-admin-form-access-form-grid');
  var searchTimer = null;
  var selectedUserProfileId = null;

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      var query = searchInput.value.trim();
      if (query.length < 2) {
        searchResults.hidden = true;
        searchResults.innerHTML = '';
        return;
      }
      searchTimer = setTimeout(function () {
        fetch('/newshub/api/admin/form-access/search-users/?q=' + encodeURIComponent(query))
          .then(function (response) { return response.json(); })
          .then(function (data) {
            if (!data.success || !data.users.length) {
              searchResults.innerHTML = '<div class="news-admin-form-access-search-result-item" style="justify-content:center;color:var(--muted);font-size:.8rem;">কোনো ব্যবহারকারী পাওয়া যায়নি</div>';
              searchResults.hidden = false;
              return;
            }
            searchResults.innerHTML = data.users.map(function (user) {
              return '<div class="news-admin-form-access-search-result-item" data-user-profile-id="' + user.user_profile_id + '">' +
                '<div>' +
                  '<span class="news-admin-form-access-search-result-name">' + escapeHtml(user.display_name || 'No name') + '</span>' +
                  '<span class="news-admin-form-access-search-result-email"> — ' + escapeHtml(user.email) + '</span>' +
                '</div>' +
                (user.is_staff ? '<span class="news-admin-form-access-search-result-badge">Staff</span>' : '') +
              '</div>';
            }).join('');
            searchResults.hidden = false;
          })
          .catch(function (error) {
            console.error('news-admin-form-access: search failed', error);
          });
      }, 400);
    });
  }

  /* Click on search result → load user form access */
  if (searchResults) {
    searchResults.addEventListener('click', function (event) {
      var item = event.target.closest('.news-admin-form-access-search-result-item');
      if (!item) return;
      var userProfileId = item.getAttribute('data-user-profile-id');
      if (!userProfileId) return;

      selectedUserProfileId = parseInt(userProfileId);
      searchResults.hidden = true;

      var nameElement = item.querySelector('.news-admin-form-access-search-result-name');
      var emailElement = item.querySelector('.news-admin-form-access-search-result-email');
      userHeader.textContent = (nameElement ? nameElement.textContent : '') + (emailElement ? emailElement.textContent : '');

      loadUserFormAccess(selectedUserProfileId);
    });
  }

  function loadUserFormAccess(userProfileId) {
    fetch('/newshub/api/admin/form-access/user/' + userProfileId + '/')
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        formGrid.innerHTML = data.form_types.map(function (formType) {
          var isPublic = !formType.is_restricted;
          var cardClass = isPublic ? 'news-admin-form-access-form-card-public' : (formType.has_access ? 'news-admin-form-access-form-card-granted' : '');
          return '<div class="news-admin-form-access-form-card ' + cardClass + '" data-form-type-id="' + formType.form_type_id + '">' +
            '<div>' +
              '<span class="news-admin-form-access-form-card-name">' + escapeHtml(formType.form_name_bn) + '</span>' +
              '<span class="news-admin-form-access-form-card-code">' + escapeHtml(formType.group_code) + '</span>' +
            '</div>' +
            (isPublic
              ? '<span class="news-admin-form-access-form-card-status">🔓 উন্মুক্ত</span>'
              : '<label class="news-admin-form-access-toggle-label">' +
                  '<input type="checkbox" class="news-admin-form-access-user-toggle" data-form-type-id="' + formType.form_type_id + '" ' + (formType.has_access ? 'checked' : '') + '>' +
                  '<span class="news-admin-form-access-toggle-slider" style="background:' + (formType.has_access ? 'var(--success)' : 'var(--border)') + '"></span>' +
                  '<span class="news-admin-form-access-toggle-text">' + (formType.has_access ? '✅ অনুমোদিত' : '❌ অননুমোদিত') + '</span>' +
                '</label>') +
          '</div>';
        }).join('');
        userDetail.hidden = false;
      })
      .catch(function (error) {
        console.error('news-admin-form-access: load user detail failed', error);
      });
  }

  /* Toggle per-user form access */
  if (formGrid) {
    formGrid.addEventListener('change', function (event) {
      var toggle = event.target.closest('.news-admin-form-access-user-toggle');
      if (!toggle || !selectedUserProfileId) return;

      var formTypeId = parseInt(toggle.getAttribute('data-form-type-id'));
      var grant = toggle.checked;

      var slider = toggle.nextElementSibling;
      var textElement = slider ? slider.nextElementSibling : null;
      var card = toggle.closest('.news-admin-form-access-form-card');

      fetch('/newshub/api/admin/form-access/toggle/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ user_profile_id: selectedUserProfileId, form_type_id: formTypeId, grant: grant }),
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.success) {
            if (slider) slider.style.background = grant ? 'var(--success)' : 'var(--border)';
            if (textElement) textElement.textContent = grant ? '✅ অনুমোদিত' : '❌ অননুমোদিত';
            if (card) {
              card.classList.toggle('news-admin-form-access-form-card-granted', grant);
            }
          } else {
            toggle.checked = !grant;
          }
        })
        .catch(function (error) {
          console.error('news-admin-form-access: toggle failed', error);
          toggle.checked = !grant;
        });
    });
  }

  /* ---- Tab 2: Form restriction toggles ---- */
  var restrictionGrid = document.getElementById('news-admin-form-access-restriction-grid');
  if (restrictionGrid) {
    restrictionGrid.addEventListener('change', function (event) {
      var toggle = event.target.closest('.news-admin-form-access-restriction-toggle');
      if (!toggle) return;

      var card = toggle.closest('.news-admin-form-access-restriction-card');
      var formTypeId = parseInt(card.getAttribute('data-form-type-id'));
      var isRestricted = toggle.checked;

      var textElement = toggle.closest('.news-admin-form-access-toggle-label').querySelector('.news-admin-form-access-toggle-text');

      fetch('/newshub/api/admin/form-access/toggle-restriction/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ form_type_id: formTypeId, is_restricted: isRestricted }),
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.success) {
            if (textElement) textElement.textContent = isRestricted ? '🔒 Restricted' : '🔓 Open';
          } else {
            toggle.checked = !isRestricted;
          }
        })
        .catch(function (error) {
          console.error('news-admin-form-access: toggle restriction failed', error);
          toggle.checked = !isRestricted;
        });
    });
  }
})();
