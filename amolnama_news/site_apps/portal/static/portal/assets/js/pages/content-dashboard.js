/* content-dashboard.js — filter tabs + publish/unpublish toggle for content dashboard */
(function () {
  'use strict';

  const dashboardElement = document.getElementById('content-dashboard');
  if (!dashboardElement) return;


  /* ---- FILTER TABS ---- */
  const filterButtons = document.querySelectorAll('.content-dashboard-filter');
  filterButtons.forEach(function (filterButton) {
    filterButton.addEventListener('click', function () {
      const filterValue = filterButton.getAttribute('data-filter');

      /* Update active tab */
      filterButtons.forEach(function (otherButton) {
        otherButton.classList.remove('content-dashboard-filter-active');
      });
      filterButton.classList.add('content-dashboard-filter-active');

      /* Show/hide items via hidden attribute (no inline style) */
      const allItems = document.querySelectorAll('.content-dashboard-item');
      allItems.forEach(function (item) {
        const matchesFilter = filterValue === 'all' || item.getAttribute('data-content-type') === filterValue;
        item.hidden = !matchesFilter;
      });
    });
  });

  /* ---- PUBLISH/UNPUBLISH TOGGLE (checkbox slider) ---- */
  document.addEventListener('change', function (event) {
    const toggleInput = event.target.closest('.content-dashboard-toggle-input');
    if (!toggleInput) return;

    const contentType = toggleInput.getAttribute('data-content-type');
    const contentId = parseInt(toggleInput.getAttribute('data-content-id'), 10);
    const newPublishState = toggleInput.checked;

    toggleInput.disabled = true;

    fetch('/portal/api/content/toggle-publish/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
      body: JSON.stringify({
        content_type: contentType,
        content_id: contentId,
        publish: newPublishState,
      }),
    })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      if (data.success) {
        /* Update status badge */
        const itemRow = toggleInput.closest('.content-dashboard-item');
        const statusBadge = itemRow.querySelector('.content-dashboard-item-status');
        if (statusBadge) {
          statusBadge.textContent = newPublishState ? 'Published' : 'Draft';
          statusBadge.className = 'content-dashboard-item-status ' +
            (newPublishState ? 'content-dashboard-item-status-published' : 'content-dashboard-item-status-draft');
        }
      } else {
        /* Revert toggle on failure */
        toggleInput.checked = !newPublishState;
      }
      toggleInput.disabled = false;
    })
    .catch(function () {
      toggleInput.checked = !newPublishState;
      toggleInput.disabled = false;
    });
  });
})();
