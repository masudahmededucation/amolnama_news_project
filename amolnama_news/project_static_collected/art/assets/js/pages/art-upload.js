/* art-upload.js — Art upload form submission + image preview. */
(function () {
  'use strict';

  var uploadForm = document.getElementById('art-upload-form');
  var submitButton = document.getElementById('art-upload-submit-button');
  var errorMessage = document.getElementById('art-upload-error-message');
  var fileInput = document.getElementById('art-upload-photos');
  var previewContainer = document.getElementById('art-upload-preview');

  if (!uploadForm) return;

  function getCsrfTokenValue() {
    var cookieMatch = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
  }

  function showError(text) {
    if (errorMessage) {
      errorMessage.textContent = text;
      errorMessage.style.display = 'block';
      setTimeout(function () { errorMessage.style.display = 'none'; }, 5000);
    }
  }

  /* Image preview */
  if (fileInput && previewContainer) {
    fileInput.addEventListener('change', function () {
      previewContainer.innerHTML = '';
      var files = fileInput.files;
      if (files.length > 10) {
        showError('সর্বোচ্চ ১০টি ছবি আপলোড করা যায়');
        fileInput.value = '';
        return;
      }
      for (var fileIndex = 0; fileIndex < files.length; fileIndex++) {
        var reader = new FileReader();
        reader.onload = function (event) {
          var previewImage = document.createElement('img');
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

    var formData = new FormData(uploadForm);
    submitButton.disabled = true;
    submitButton.textContent = 'আপলোড হচ্ছে...';

    fetch('/art-and-craft/api/create/', {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrfTokenValue() },
      body: formData,
    })
    .then(function (response) { return response.json(); })
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
      console.error('Upload failed:', networkError);
      showError('নেটওয়ার্ক ত্রুটি (Network error)');
      submitButton.disabled = false;
      submitButton.textContent = 'আপলোড করুন';
    });
  });
})();
