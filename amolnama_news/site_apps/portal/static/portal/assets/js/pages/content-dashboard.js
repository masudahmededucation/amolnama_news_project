/* content-dashboard.js — filter tabs + publish/unpublish toggle for content dashboard */
(function () {
  'use strict';

  var dashboardElement = document.getElementById('content-dashboard');
  if (!dashboardElement) return;

  function getCsrfTokenValue() {
    var cookieMatch = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
  }

  /* ---- FILTER TABS ---- */
  var filterButtons = document.querySelectorAll('.content-dashboard-filter');
  filterButtons.forEach(function (filterButton) {
    filterButton.addEventListener('click', function () {
      var filterValue = filterButton.getAttribute('data-filter');

      /* Update active tab */
      filterButtons.forEach(function (otherButton) {
        otherButton.classList.remove('content-dashboard-filter-active');
      });
      filterButton.classList.add('content-dashboard-filter-active');

      /* Show/hide items */
      var allItems = document.querySelectorAll('.content-dashboard-item');
      allItems.forEach(function (item) {
        if (filterValue === 'all' || item.getAttribute('data-content-type') === filterValue) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  /* ---- PUBLISH/UNPUBLISH TOGGLE ---- */
  document.addEventListener('click', function (event) {
    var toggleButton = event.target.closest('.content-dashboard-item-toggle');
    if (!toggleButton) return;

    var contentType = toggleButton.getAttribute('data-content-type');
    var contentId = parseInt(toggleButton.getAttribute('data-content-id'), 10);
    var currentlyPublished = toggleButton.getAttribute('data-is-published') === 'true';
    var newPublishState = !currentlyPublished;

    toggleButton.disabled = true;
    toggleButton.textContent = '...';

    fetch('/portal/api/content/toggle-publish/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
      body: JSON.stringify({
        content_type: contentType,
        content_id: contentId,
        publish: newPublishState,
      }),
    })
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (data.success) {
        /* Update button */
        toggleButton.setAttribute('data-is-published', newPublishState ? 'true' : 'false');
        toggleButton.textContent = newPublishState ? 'Unpublish' : 'Publish';
        toggleButton.className = 'content-dashboard-item-toggle ' +
          (newPublishState ? 'content-dashboard-item-toggle-unpublish' : 'content-dashboard-item-toggle-publish');

        /* Update status badge */
        var itemRow = toggleButton.closest('.content-dashboard-item');
        var statusBadge = itemRow.querySelector('.content-dashboard-item-status');
        if (statusBadge) {
          statusBadge.textContent = newPublishState ? 'Published' : 'Draft';
          statusBadge.className = 'content-dashboard-item-status ' +
            (newPublishState ? 'content-dashboard-item-status-published' : 'content-dashboard-item-status-draft');
        }
      } else {
        toggleButton.textContent = currentlyPublished ? 'Unpublish' : 'Publish';
      }
      toggleButton.disabled = false;
    })
    .catch(function () {
      toggleButton.textContent = currentlyPublished ? 'Unpublish' : 'Publish';
      toggleButton.disabled = false;
    });
  });
})();
