/* Proctoring per-session audit page — forgive button with inline confirm. */
(function () {
  'use strict';

  var inlineMessage = document.getElementById('quizadmin-proctoring-audit-message');

  document.addEventListener('click', async function (event) {
    var forgiveButton = event.target.closest('.quizadmin-violation-forgive-button');
    if (!forgiveButton) return;

    var violationId = forgiveButton.dataset.violationId;
    if (forgiveButton.dataset.confirmed !== 'true') {
      forgiveButton.dataset.confirmed = 'true';
      forgiveButton.textContent = 'Confirm forgive';
      forgiveButton.classList.add('quizadmin-violation-forgive-confirm');
      setTimeout(function () {
        if (forgiveButton.dataset.confirmed === 'true') {
          forgiveButton.textContent = 'Forgive';
          delete forgiveButton.dataset.confirmed;
          forgiveButton.classList.remove('quizadmin-violation-forgive-confirm');
        }
      }, 3000);
      return;
    }

    forgiveButton.disabled = true;
    try {
      var result = await window.quizadminPost(
        '/quizadmin/api/proctoring/violation/' + violationId + '/forgive/',
        {}
      );
      window.quizadminShowInline(
        inlineMessage,
        'Violation forgiven. New session score: ' + result.session_score + ' (' + result.status + ').',
        'success'
      );
      setTimeout(function () { window.location.reload(); }, 800);
    } catch (error) {
      window.quizadminShowInline(inlineMessage, error.message || 'Forgive failed.', 'error');
      forgiveButton.disabled = false;
      forgiveButton.textContent = 'Forgive';
      delete forgiveButton.dataset.confirmed;
      forgiveButton.classList.remove('quizadmin-violation-forgive-confirm');
    }
  });
})();
