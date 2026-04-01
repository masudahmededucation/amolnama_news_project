/* textextractor-dashboard.js — Upload files, redirect to dashboard. No polling. */
(function () {
  'use strict';

  var dashboardElement = document.querySelector('.textextractor-dashboard');
  if (!dashboardElement) return;

  function getCsrfTokenValue() {
    var cookieMatch = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
  }

  /* ---- Dropzone — upload files then reload ---- */
  if (window.fileDropzone) {
    window.fileDropzone.init({
      dropzoneElement: document.getElementById('textextractor-dashboard-dropzone'),
      fileInputElement: document.getElementById('textextractor-dashboard-file-input'),
      activeClass: 'textextractor-dashboard-dropzone-active',
      onFilesSelected: function (files) {
        var totalFiles = files.length;
        var uploadedCount = 0;

        for (var index = 0; index < files.length; index++) {
          (function (file) {
            var formData = new FormData();
            formData.append('extraction_file', file);
            fetch('/text-extractor/api/upload/', {
              method: 'POST',
              headers: { 'X-CSRFToken': getCsrfTokenValue() },
              body: formData,
            })
            .catch(function () {})
            .finally(function () {
              uploadedCount++;
              if (uploadedCount >= totalFiles) {
                /* All uploaded — reload to show jobs with current status from DB */
                window.location.href = '/text-extractor/';
              }
            });
          })(files[index]);
        }
      },
      onError: function () {},
    });
  }

  /* ---- Cancel / Delete ---- */
  document.addEventListener('click', function (event) {
    var cancelButton = event.target.closest('.textextractor-job-cancel-button');
    if (cancelButton) {
      event.preventDefault();
      event.stopPropagation();
      cancelButton.disabled = true;
      fetch('/text-extractor/api/cancel/' + cancelButton.getAttribute('data-job-id') + '/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      }).then(function () { window.location.href = '/text-extractor/'; });
      return;
    }

    var deleteButton = event.target.closest('.textextractor-job-delete-button');
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      var jobCard = deleteButton.closest('.textextractor-job-card');
      fetch('/text-extractor/api/delete/' + deleteButton.getAttribute('data-job-id') + '/', {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfTokenValue() },
      }).then(function () {
        if (jobCard) { jobCard.style.opacity = '0'; setTimeout(function () { jobCard.remove(); }, 300); }
      });
      return;
    }
  });
})();
