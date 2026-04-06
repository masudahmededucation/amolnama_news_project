/* art-upload.js — Art upload form submission + image preview. */
(function () {
  'use strict';

  const uploadForm = document.getElementById('art-upload-form');
  const submitButton = document.getElementById('art-upload-submit-button');
  const errorMessage = document.getElementById('art-upload-error-message');
  const fileInput = document.getElementById('art-upload-photos');
  const previewContainer = document.getElementById('art-upload-preview');

  if (!uploadForm) return;


  function showError(text) {
    if (errorMessage) {
      errorMessage.textContent = text;
      errorMessage.hidden = false;
      setTimeout(function () { errorMessage.hidden = true; }, 5000);
    }
  }

  /* Image preview */
  if (fileInput && previewContainer) {
    fileInput.addEventListener('change', function () {
      previewContainer.innerHTML = '';
      const files = fileInput.files;
      if (files.length > 10) {
        showError('সর্বোচ্চ ১০টি ছবি আপলোড করা যায়');
        fileInput.value = '';
        return;
      }
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const reader = new FileReader();
        reader.onload = function (event) {
          const previewImage = document.createElement('img');
          previewImage.src = event.target.result;
          previewImage.className = 'art-upload-preview-item';
          previewContainer.appendChild(previewImage);
        };
        reader.readAsDataURL(files[fileIndex]);
      }
    });
  }

  /* Form submit */
  uploadForm.addEventListener('submit', function (event) {
    event.preventDefault();

    const formData = new FormData(uploadForm);
    submitButton.disabled = true;
    submitButton.textContent = 'আপলোড হচ্ছে...';

    fetch('/art-and-craft/api/create/', {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrfTokenValue() },
      body: formData,
    })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(function (data) {
      if (data.success) {
        window.location.href = '/art-and-craft/' + data.artwork_slug + '/';
      } else {
        showError(data.error || 'আপলোড করা যায়নি');
        submitButton.disabled = false;
        submitButton.textContent = 'আপলোড করুন';
      }
    })
    .catch(function (networkError) {
      showError('নেটওয়ার্ক ত্রুটি (Network error)');
      submitButton.disabled = false;
      submitButton.textContent = 'আপলোড করুন';
    });
  });
})();
