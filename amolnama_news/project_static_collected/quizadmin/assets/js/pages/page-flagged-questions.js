/* Flagged Questions inbox — staff Resolve / Reject actions on each row.
   Uses window.quizadminPost from quizadmin-utils.js. */
(function () {
  'use strict';

  var inlineMessage = document.getElementById('quizadmin-flagged-inline-message');

  function _setMessage(text, tone) {
    if (!inlineMessage) return;
    inlineMessage.textContent = text;
    inlineMessage.dataset.tone = tone || 'success';
    inlineMessage.hidden = false;
  }

  async function _reviewReport(reportId, action, button) {
    button.disabled = true;
    var originalText = button.textContent;
    button.textContent = 'Saving…';
    try {
      var result = await window.quizadminPost(
        '/mastermind/api/question/report/' + reportId + '/review/',
        { action: action },
      );
      if (result && result.success) {
        var row = document.getElementById('quizadmin-flagged-row-' + reportId);
        if (row) row.remove();
        _setMessage('Report marked as ' + (result.new_status || action) + '.', 'success');
      } else {
        _setMessage((result && result.error) || 'Action failed.', 'error');
        button.disabled = false;
        button.textContent = originalText;
      }
    } catch (error) {
      _setMessage(error.message || 'Action failed.', 'error');
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  document.addEventListener('click', function (event) {
    var resolveButton = event.target.closest('.quizadmin-flagged-resolve-button');
    if (resolveButton) {
      _reviewReport(resolveButton.dataset.reportId, 'resolve', resolveButton);
      return;
    }
    var rejectButton = event.target.closest('.quizadmin-flagged-reject-button');
    if (rejectButton) {
      if (rejectButton.dataset.confirmed !== 'true') {
        rejectButton.dataset.confirmed = 'true';
        rejectButton.textContent = 'Confirm reject';
        setTimeout(function () {
          if (rejectButton.dataset.confirmed === 'true') {
            delete rejectButton.dataset.confirmed;
            rejectButton.textContent = 'Reject';
          }
        }, 3000);
        return;
      }
      _reviewReport(rejectButton.dataset.reportId, 'reject', rejectButton);
    }
  });
})();
