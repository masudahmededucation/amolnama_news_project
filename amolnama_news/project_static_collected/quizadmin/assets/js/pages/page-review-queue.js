/* Review queue — approve/reject/skip with keyboard shortcuts, loading states, reject confirmation. */
(function () {
  'use strict';

  var currentQuestionId = window.quizadminReadJson('quizadmin-current-id');
  var previousQuestionId = window.quizadminReadJson('quizadmin-previous-id');
  var nextQuestionId = window.quizadminReadJson('quizadmin-next-id');

  var inlineMessage = document.getElementById('quizadmin-review-card-inline-message');
  var approveButton = document.getElementById('quizadmin-review-button-approve');
  var rejectButton = document.getElementById('quizadmin-review-button-reject');
  var skipButton = document.getElementById('quizadmin-review-button-skip');
  var isProcessing = false;

  var navigateToQuestionId = function (questionId) {
    var parameters = new URLSearchParams(window.location.search);
    if (questionId === null || questionId === undefined) {
      parameters.delete('question_id');
    } else {
      parameters.set('question_id', String(questionId));
    }
    var destinationPath = window.location.pathname;
    if (typeof window.quizadminSaveScrollForPath === 'function') {
      window.quizadminSaveScrollForPath(destinationPath);
    }
    window.location.href = destinationPath + '?' + parameters.toString();
  };

  var setAllButtonsLoading = function (loading) {
    isProcessing = loading;
    [approveButton, rejectButton, skipButton].forEach(function (button) {
      if (button) button.disabled = loading;
    });
  };

  var performAction = async function (action, questionId) {
    if (!questionId || isProcessing) return;

    if (action === 'reject' && rejectButton && rejectButton.dataset.confirmed !== 'true') {
      rejectButton.dataset.confirmed = 'true';
      rejectButton.textContent = 'Confirm reject';
      rejectButton.classList.add('quizadmin-review-button-confirm-reject');
      setTimeout(function () {
        if (rejectButton.dataset.confirmed === 'true') {
          rejectButton.textContent = 'Reject';
          delete rejectButton.dataset.confirmed;
          rejectButton.classList.remove('quizadmin-review-button-confirm-reject');
        }
      }, 3000);
      return;
    }

    setAllButtonsLoading(true);

    var endpointMap = {
      approve: '/quizadmin/api/approve/',
      reject:  '/quizadmin/api/reject/',
      skip:    '/quizadmin/api/skip/',
    };
    var endpoint = endpointMap[action];
    if (!endpoint) return;

    var queryFromLocation = window.location.search;
    var requestUrl = queryFromLocation ? endpoint + queryFromLocation : endpoint;

    try {
      var result = await window.quizadminPost(requestUrl, { question_id: questionId });
      navigateToQuestionId(result.next_question_id);
    } catch (error) {
      window.quizadminShowInline(inlineMessage, error.message || 'Action failed. Try again.', 'error');
      setAllButtonsLoading(false);
      if (rejectButton) {
        rejectButton.textContent = 'Reject';
        delete rejectButton.dataset.confirmed;
        rejectButton.classList.remove('quizadmin-review-button-confirm-reject');
      }
    }
  };

  if (approveButton) {
    approveButton.addEventListener('click', function () { performAction('approve', currentQuestionId); });
  }
  if (rejectButton) {
    rejectButton.addEventListener('click', function () { performAction('reject', currentQuestionId); });
  }
  if (skipButton) {
    skipButton.addEventListener('click', function () { performAction('skip', currentQuestionId); });
  }

  document.addEventListener('keydown', function (event) {
    var activeTag = (document.activeElement && document.activeElement.tagName) || '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    var pressedKey = event.key.toLowerCase();
    if (pressedKey === 'a') {
      event.preventDefault();
      performAction('approve', currentQuestionId);
    } else if (pressedKey === 'r') {
      event.preventDefault();
      performAction('reject', currentQuestionId);
    } else if (pressedKey === 's') {
      event.preventDefault();
      performAction('skip', currentQuestionId);
    } else if (pressedKey === 'j' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (nextQuestionId !== null && nextQuestionId !== undefined) navigateToQuestionId(nextQuestionId);
    } else if (pressedKey === 'k' || event.key === 'ArrowLeft') {
      event.preventDefault();
      if (previousQuestionId !== null && previousQuestionId !== undefined) navigateToQuestionId(previousQuestionId);
    }
  });
})();
