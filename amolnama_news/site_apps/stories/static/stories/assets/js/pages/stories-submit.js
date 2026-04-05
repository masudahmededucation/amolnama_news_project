/* stories-submit.js — Story submission form. */
(function () {
  'use strict';

  const submitForm = document.getElementById('stories-submit-form');
  const submitButton = document.getElementById('stories-submit-button');
  const errorMessage = document.getElementById('stories-submit-error-message');

  if (!submitForm) return;


  function showError(text) {
    if (errorMessage) {
      errorMessage.textContent = text;
      errorMessage.style.display = 'block';
      setTimeout(function () { errorMessage.style.display = 'none'; }, 5000);
    }
  }

  submitForm.addEventListener('submit', function (event) {
    event.preventDefault();

    const formData = new FormData(submitForm);
    submitButton.disabled = true;
    submitButton.textContent = 'জমা হচ্ছে...';

    fetch('/stories-for-kids/api/create/', {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrfTokenValue() },
      body: formData,
    })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      if (data.success) {
        window.location.href = '/stories-for-kids/' + data.story_slug + '/';
      } else {
        showError(data.error || 'জমা দেওয়া যায়নি');
        submitButton.disabled = false;
        submitButton.textContent = 'জমা দিন';
      }
    })
    .catch(function (networkError) {
      showError('নেটওয়ার্ক ত্রুটি (Network error)');
      submitButton.disabled = false;
      submitButton.textContent = 'জমা দিন';
    });
  });
})();
