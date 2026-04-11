/* moderation-queue.js — staff approve/reject actions for flagged content rows */
(function () {
  'use strict';

  function getModerationCsrfToken() {
    const cookieMatch = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
  }

  document.addEventListener('click', function (event) {
    const actionButton = event.target.closest('.moderation-action-button');
    if (!actionButton) return;
    const action = actionButton.getAttribute('data-action');
    const contentType = actionButton.getAttribute('data-content-type');
    const contentId = parseInt(actionButton.getAttribute('data-content-id'), 10);
    actionButton.disabled = true;
    actionButton.textContent = '...';
    fetch('/portal/api/moderation/' + action + '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getModerationCsrfToken() },
      body: JSON.stringify({ content_type: contentType, content_id: contentId }),
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          const itemRow = actionButton.closest('.moderation-item');
          if (itemRow) itemRow.hidden = true;
        } else {
          actionButton.textContent = action === 'approve' ? 'Approve' : 'Reject';
          actionButton.disabled = false;
        }
      })
      .catch(function () {
        actionButton.textContent = action === 'approve' ? 'Approve' : 'Reject';
        actionButton.disabled = false;
      });
  });
})();
