/* Quiz Panel — write-from-scratch book form.
   Posts to /mastermind/api/book/create-blank-authored/ then redirects to
   the editor where the author adds chapters. */
(function () {
  'use strict';

  var formElement = document.getElementById('quizadmin-book-create-authored-form');
  if (!formElement) return;

  var formMessage = document.getElementById('quizadmin-book-create-authored-form-message');
  var submitButton = document.getElementById('quizadmin-book-create-authored-submit');

  function _setMessage(text, tone) {
    if (!formMessage) return;
    formMessage.textContent = text;
    formMessage.dataset.tone = tone || 'success';
    formMessage.hidden = false;
  }

  formElement.addEventListener('submit', async function (event) {
    event.preventDefault();
    submitButton.disabled = true;
    var originalLabel = submitButton.textContent;
    submitButton.textContent = 'Creating…';
    formMessage.hidden = true;

    try {
      var payload = {
        title_bn: document.getElementById('quizadmin-book-create-authored-title-bn').value,
        title_en: document.getElementById('quizadmin-book-create-authored-title-en').value,
        language_code: document.getElementById('quizadmin-book-create-authored-language').value,
        description: document.getElementById('quizadmin-book-create-authored-description').value,
      };
      var result = await window.quizadminPost(
        '/mastermind/api/book/create-blank-authored/', payload,
      );
      if (result && result.success) {
        _setMessage('Book created — opening editor…', 'success');
        setTimeout(function () {
          window.location.href = '/quizadmin/book/' + result.book_id + '/edit/';
        }, 500);
      } else {
        _setMessage((result && result.error) || 'Create failed.', 'error');
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
    } catch (submitError) {
      _setMessage(submitError.message || 'Create failed.', 'error');
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  });
})();
