/* textextractor-dashboard.js — Upload files, live progress polling, cancel/delete. */
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
                window.location.href = '/text-extractor/';
              }
            });
          })(files[index]);
        }
      },
      onError: function () {},
    });
  }

  /* ---- Live Progress Polling — ONLY when processing jobs exist ---- */
  var processingJobElements = document.querySelectorAll('.textextractor-job-progress-row');
  var pollingActive = processingJobElements.length > 0;

  function pollProcessingJobs() {
    if (!pollingActive) return;

    var stillProcessing = false;

    processingJobElements.forEach(function (progressRowElement) {
      var processingJobId = progressRowElement.getAttribute('data-job-id');

      fetch('/text-extractor/api/status/' + processingJobId + '/')
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (!data.success) return;

          if (data.status_code === 'processing') {
            stillProcessing = true;

            var progressBarElement = document.getElementById('textextractor-job-progress-bar-' + processingJobId);
            var progressLogElement = document.getElementById('textextractor-job-progress-log-' + processingJobId);

            /* Update progress bar */
            if (data.page_count && data.page_count > 0 && data.progress_message) {
              var currentPageMatch = data.progress_message.match(/(\d+)\/(\d+) pages/);
              if (currentPageMatch) {
                var currentPage = parseInt(currentPageMatch[1], 10);
                var totalPages = parseInt(currentPageMatch[2], 10);
                var percent = Math.round((currentPage / totalPages) * 100);
                if (progressBarElement) {
                  progressBarElement.style.width = percent + '%';
                }
              }
            }

            /* Update log display */
            if (progressLogElement && data.progress_message) {
              progressLogElement.textContent = data.progress_message;
              progressLogElement.scrollTop = progressLogElement.scrollHeight;
            }
          }

          if (data.status_code === 'completed' || data.status_code === 'failed') {
            pollingActive = false;
            window.location.href = '/text-extractor/';
          }
        })
        .catch(function () {});
    });

    /* Only schedule next poll if still processing */
    if (pollingActive) {
      setTimeout(pollProcessingJobs, 3000);
    }
  }

  if (pollingActive) {
    pollProcessingJobs();
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
