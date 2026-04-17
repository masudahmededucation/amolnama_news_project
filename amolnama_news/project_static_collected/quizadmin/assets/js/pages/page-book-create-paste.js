/* Quiz Panel — paste-as-book form.
   Submits to /mastermind/api/book/create-from-paste/ then navigates to
   the book editor on success. */
(function () {
  'use strict';

  var formElement = document.getElementById('quizadmin-book-create-paste-form');
  if (!formElement) return;

  var formMessage = document.getElementById('quizadmin-book-create-paste-form-message');
  var submitButton = document.getElementById('quizadmin-book-create-paste-submit');

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
        title_bn: document.getElementById('quizadmin-book-create-paste-title-bn').value,
        title_en: document.getElementById('quizadmin-book-create-paste-title-en').value,
        language_code: document.getElementById('quizadmin-book-create-paste-language').value,
        description: document.getElementById('quizadmin-book-create-paste-description').value,
        cover_image_url: document.getElementById('quizadmin-book-create-paste-cover-url').value,
        chapter_title_bn: document.getElementById('quizadmin-book-create-paste-chapter-title-bn').value,
        paste_text: document.getElementById('quizadmin-book-create-paste-text').value,
      };
      var result = await window.quizadminPost(
        '/mastermind/api/book/create-from-paste/', payload,
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
