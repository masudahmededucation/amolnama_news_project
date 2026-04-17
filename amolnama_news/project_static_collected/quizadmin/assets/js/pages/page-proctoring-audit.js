/* Proctoring per-session audit page — forgive button with inline confirm + in-place DOM update. */
(function () {
  'use strict';

  var inlineMessage = document.getElementById('quizadmin-proctoring-audit-inline-message');
  var scoreValue = document.getElementById('quizadmin-proctoring-audit-score-value');
  var statusChip = document.getElementById('quizadmin-proctoring-audit-status-chip');
  var activeCount = document.getElementById('quizadmin-proctoring-audit-active-count');
  var forgivenCount = document.getElementById('quizadmin-proctoring-audit-forgiven-count');

  var STATUS_CHIP_CLASSES = ['quizadmin-status-chip-clean', 'quizadmin-status-chip-warned', 'quizadmin-status-chip-flagged', 'quizadmin-status-chip-locked'];
  var CONFIRM_TIMEOUT_MS = 3000;

  function resetForgiveButton(button) {
    if (!button) return;
    if (button.dataset.confirmed === 'true') {
      button.textContent = 'Forgive';
      delete button.dataset.confirmed;
      button.classList.remove('quizadmin-violation-forgive-confirm');
    }
  }

  function armForgiveButton(button) {
    button.dataset.confirmed = 'true';
    button.textContent = 'Confirm forgive';
    button.classList.add('quizadmin-violation-forgive-confirm');
    setTimeout(function () { resetForgiveButton(button); }, CONFIRM_TIMEOUT_MS);
  }

  function applyChipUpdate(newStatus) {
    if (!statusChip || !newStatus) return;
    STATUS_CHIP_CLASSES.forEach(function (cls) { statusChip.classList.remove(cls); });
    statusChip.classList.add('quizadmin-status-chip-' + newStatus);
    statusChip.textContent = newStatus;
  }

  function applyForgiveDomUpdate(button, result) {
    if (scoreValue && typeof result.session_score !== 'undefined') {
      scoreValue.textContent = result.session_score;
    }
    applyChipUpdate(result.status);

    var row = button.closest('tr');
    if (row) {
      row.classList.add('quizadmin-violation-forgiven-row');
      var statusCell = row.querySelector('td .quizadmin-status-chip');
      if (statusCell) {
        statusCell.classList.remove('quizadmin-status-chip-violation-active');
        statusCell.classList.add('quizadmin-status-chip-forgiven');
        statusCell.textContent = 'forgiven';
      }
      var actionCell = button.parentElement;
      if (actionCell) actionCell.textContent = '\u2014';
    }

    if (activeCount) {
      var activeNumber = parseInt(activeCount.textContent, 10);
      if (!isNaN(activeNumber) && activeNumber > 0) activeCount.textContent = activeNumber - 1;
    }
    if (forgivenCount) {
      var forgivenNumber = parseInt(forgivenCount.textContent, 10);
      if (!isNaN(forgivenNumber)) forgivenCount.textContent = forgivenNumber + 1;
    }
  }

  document.addEventListener('click', async function (event) {
    var forgiveButton = event.target.closest('.quizadmin-violation-forgive-button');
    if (!forgiveButton) return;

    if (forgiveButton.dataset.confirmed !== 'true') {
      armForgiveButton(forgiveButton);
      return;
    }

    var violationId = forgiveButton.dataset.violationId;
    forgiveButton.disabled = true;
    try {
      var result = await window.quizadminPost(
        '/quizadmin/api/proctoring/violation/' + violationId + '/forgive/',
        {}
      );
      applyForgiveDomUpdate(forgiveButton, result);
      window.quizadminShowInline(
        inlineMessage,
        'Violation forgiven. New session score: ' + result.session_score + ' (' + result.status + ').',
        'success'
      );
    } catch (error) {
      window.quizadminShowInline(inlineMessage, error.message || 'Forgive failed.', 'error');
      forgiveButton.disabled = false;
      resetForgiveButton(forgiveButton);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.quizadmin-violation-forgive-button[data-confirmed="true"]').forEach(resetForgiveButton);
  });

  document.addEventListener('focusout', function (event) {
    var button = event.target.closest && event.target.closest('.quizadmin-violation-forgive-button');
    if (!button) return;
    if (button.dataset.confirmed !== 'true') return;
    setTimeout(function () {
      if (document.activeElement !== button) resetForgiveButton(button);
    }, 150);
  });
})();
