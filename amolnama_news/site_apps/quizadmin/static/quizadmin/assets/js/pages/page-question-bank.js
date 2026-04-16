/* Question bank — bulk select, bulk status with confirmation, CSV import with loading state. */
(function () {
  'use strict';

  var selectAllCheckbox = document.getElementById('quizadmin-select-all');
  var bulkBar = document.getElementById('quizadmin-bulk-bar');
  var bulkCountElement = document.getElementById('quizadmin-bulk-count');
  var inlineMessage = document.getElementById('quizadmin-question-bank-inline-message');
  var importTrigger = document.getElementById('quizadmin-import-csv-trigger');
  var importFileInput = document.getElementById('quizadmin-import-csv-file');

  var getCheckedIds = function () {
    var checkboxes = document.querySelectorAll('.quizadmin-question-checkbox:checked');
    var ids = [];
    checkboxes.forEach(function (checkbox) { ids.push(parseInt(checkbox.value, 10)); });
    return ids;
  };

  var syncBulkBar = function () {
    var ids = getCheckedIds();
    if (bulkBar) {
      bulkBar.hidden = ids.length === 0;
      if (bulkCountElement) bulkCountElement.textContent = String(ids.length);
    }
  };

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', function () {
      var checkboxes = document.querySelectorAll('.quizadmin-question-checkbox');
      checkboxes.forEach(function (checkbox) { checkbox.checked = selectAllCheckbox.checked; });
      syncBulkBar();
    });
  }

  document.addEventListener('change', function (event) {
    if (event.target.classList.contains('quizadmin-question-checkbox')) {
      syncBulkBar();
      if (selectAllCheckbox) {
        var total = document.querySelectorAll('.quizadmin-question-checkbox').length;
        var checked = document.querySelectorAll('.quizadmin-question-checkbox:checked').length;
        selectAllCheckbox.checked = total > 0 && checked === total;
        selectAllCheckbox.indeterminate = checked > 0 && checked < total;
      }
    }
  });

  var pendingConfirmation = null;

  var performBulkStatus = async function (statusCode, buttonElement) {
    var ids = getCheckedIds();
    if (!ids.length) return;

    if (statusCode === 'archived' && pendingConfirmation !== 'archived') {
      pendingConfirmation = 'archived';
      buttonElement.textContent = 'Confirm archive (' + ids.length + ')';
      setTimeout(function () {
        if (pendingConfirmation === 'archived') {
          buttonElement.textContent = 'Archive';
          pendingConfirmation = null;
        }
      }, 3000);
      return;
    }
    pendingConfirmation = null;

    window.quizadminSetLoading(buttonElement, true);
    try {
      var result = await window.quizadminPost('/quizadmin/api/question/bulk-status/', {
        question_ids: ids,
        status_code: statusCode,
      });
      window.quizadminShowInline(inlineMessage, result.updated_count + ' question(s) set to ' + statusCode + '.', 'success');
      setTimeout(function () { window.location.reload(); }, 800);
    } catch (error) {
      window.quizadminShowInline(inlineMessage, error.message || 'Bulk action failed.', 'error');
      window.quizadminSetLoading(buttonElement, false);
    }
  };

  var publishButton = document.getElementById('quizadmin-bulk-publish');
  var draftButton = document.getElementById('quizadmin-bulk-draft');
  var archiveButton = document.getElementById('quizadmin-bulk-archive');
  var deselectButton = document.getElementById('quizadmin-bulk-deselect');

  if (publishButton) publishButton.addEventListener('click', function () { performBulkStatus('published', publishButton); });
  if (draftButton) draftButton.addEventListener('click', function () { performBulkStatus('draft', draftButton); });
  if (archiveButton) archiveButton.addEventListener('click', function () { performBulkStatus('archived', archiveButton); });
  if (deselectButton) {
    deselectButton.addEventListener('click', function () {
      document.querySelectorAll('.quizadmin-question-checkbox').forEach(function (checkbox) { checkbox.checked = false; });
      if (selectAllCheckbox) { selectAllCheckbox.checked = false; selectAllCheckbox.indeterminate = false; }
      syncBulkBar();
    });
  }

  if (importTrigger && importFileInput) {
    importTrigger.addEventListener('click', function () { importFileInput.click(); });
    importFileInput.addEventListener('change', async function () {
      var file = importFileInput.files[0];
      if (!file) return;

      window.quizadminSetLoading(importTrigger, true, 'Importing\u2026');

      var formData = new FormData();
      formData.append('csv_file', file);
      var csrfToken = window.getCsrfTokenValue ? window.getCsrfTokenValue() : '';

      try {
        var response = await fetch('/quizadmin/api/question/import-csv/', {
          method: 'POST',
          headers: { 'X-CSRFToken': csrfToken },
          body: formData,
        });
        var body = await response.json().catch(function () { return {}; });
        if (!response.ok || body.error) {
          window.quizadminShowInline(inlineMessage, body.error || 'Import failed.', 'error');
          window.quizadminSetLoading(importTrigger, false, 'Import CSV');
          return;
        }
        var message = body.created_count + ' question(s) imported successfully.';
        if (body.errors && body.errors.length) {
          message += ' ' + body.errors.length + ' row(s) had errors.';
        }
        window.quizadminShowInline(inlineMessage, message, 'success');
        setTimeout(function () { window.location.reload(); }, 1200);
      } catch (networkError) {
        window.quizadminShowInline(inlineMessage, 'Network error during import.', 'error');
        window.quizadminSetLoading(importTrigger, false, 'Import CSV');
      }
      importFileInput.value = '';
    });
  }
})();
