/* Webhook subscription manager — add + delete via mastermind API.
   Uses window.quizadminPost from quizadmin-utils.js. */
(function () {
  'use strict';

  var form = document.getElementById('quizadmin-webhook-form');
  if (!form) return;

  var formMessage = document.getElementById('quizadmin-webhook-form-message');
  var submitButton = document.getElementById('quizadmin-webhook-form-submit');

  function _setMessage(target, text, tone) {
    if (!target) return;
    target.textContent = text;
    target.dataset.tone = tone || 'success';
    target.hidden = false;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    submitButton.disabled = true;
    var originalText = submitButton.textContent;
    submitButton.textContent = 'Adding…';
    formMessage.hidden = true;

    try {
      var payload = {
        webhook_event_code: document.getElementById('quizadmin-webhook-event-code').value,
        webhook_target_url: document.getElementById('quizadmin-webhook-target-url').value,
        webhook_label: document.getElementById('quizadmin-webhook-label').value,
        webhook_secret: document.getElementById('quizadmin-webhook-secret').value,
      };
      var result = await window.quizadminPost(
        '/mastermind/api/webhook/subscriptions/create/', payload,
      );
      if (result && result.success) {
        _setMessage(formMessage, 'Subscription added. Reloading…', 'success');
        setTimeout(function () { window.location.reload(); }, 600);
      } else {
        _setMessage(formMessage, (result && result.error) || 'Add failed.', 'error');
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    } catch (error) {
      _setMessage(formMessage, error.message || 'Add failed.', 'error');
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  });

  document.addEventListener('click', async function (event) {
    var deleteButton = event.target.closest('.quizadmin-webhook-delete-button');
    if (!deleteButton) return;
    var subscriptionId = deleteButton.dataset.subscriptionId;

    if (deleteButton.dataset.confirmed !== 'true') {
      deleteButton.dataset.confirmed = 'true';
      deleteButton.textContent = 'Confirm delete';
      setTimeout(function () {
        if (deleteButton.dataset.confirmed === 'true') {
          delete deleteButton.dataset.confirmed;
          deleteButton.textContent = 'Delete';
        }
      }, 3000);
      return;
    }

    deleteButton.disabled = true;
    try {
      await window.quizadminPost(
        '/mastermind/api/webhook/subscriptions/' + subscriptionId + '/delete/', {},
      );
      var row = deleteButton.closest('tr');
      if (row) row.remove();
    } catch (error) {
      deleteButton.disabled = false;
      deleteButton.textContent = 'Delete';
      delete deleteButton.dataset.confirmed;
    }
  });
})();
