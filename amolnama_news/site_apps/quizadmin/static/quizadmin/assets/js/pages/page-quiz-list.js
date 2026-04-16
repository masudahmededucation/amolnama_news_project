/* Quiz list — sort auto-submit, clone and delete with inline confirmation. */
(function () {
  'use strict';

  var inlineMessage = document.getElementById('quizadmin-quiz-list-inline-message');
  var sortSelect = document.getElementById('quizadmin-quiz-sort');

  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      sortSelect.closest('form').submit();
    });
  }

  document.addEventListener('click', async function (event) {
    var cloneButton = event.target.closest('.quizadmin-quiz-clone-button');
    if (cloneButton) {
      var examId = cloneButton.dataset.examId;
      cloneButton.disabled = true;
      try {
        var result = await window.quizadminPost('/quizadmin/api/quiz/' + examId + '/clone/', {});
        showInline('Quiz cloned. Redirecting to edit...', 'success');
        setTimeout(function () {
          window.location.href = '/quizadmin/quiz/' + result.exam_id + '/edit/';
        }, 500);
      } catch (error) {
        showInline(error.message || 'Clone failed.', 'error');
        cloneButton.disabled = false;
      }
      return;
    }

    var deleteButton = event.target.closest('.quizadmin-quiz-delete-button');
    if (deleteButton) {
      var row = deleteButton.closest('tr');
      if (deleteButton.dataset.confirmed !== 'true') {
        deleteButton.textContent = 'Confirm delete';
        deleteButton.dataset.confirmed = 'true';
        deleteButton.classList.add('quizadmin-quiz-delete-confirm');
        setTimeout(function () {
          deleteButton.textContent = 'Delete';
          delete deleteButton.dataset.confirmed;
          deleteButton.classList.remove('quizadmin-quiz-delete-confirm');
        }, 3000);
        return;
      }

      var deleteExamId = deleteButton.dataset.examId;
      deleteButton.disabled = true;
      try {
        await window.quizadminPost('/quizadmin/api/quiz/' + deleteExamId + '/delete/', {});
        if (row) row.remove();
        showInline('Quiz deleted.', 'success');
      } catch (error) {
        showInline(error.message || 'Delete failed.', 'error');
        deleteButton.disabled = false;
      }
    }
  });
})();
