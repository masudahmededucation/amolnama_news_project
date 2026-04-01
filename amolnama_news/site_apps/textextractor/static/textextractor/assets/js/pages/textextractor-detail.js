/* textextractor-detail.js — Copy text, download, auto-poll for processing jobs. */
(function () {
  'use strict';

  /* Copy extracted text to clipboard */
  var copyButton = document.getElementById('textextractor-detail-copy-button');
  var textContent = document.getElementById('textextractor-detail-text-content');
  if (copyButton && textContent) {
    copyButton.addEventListener('click', function () {
      navigator.clipboard.writeText(textContent.textContent).then(function () {
        copyButton.textContent = '✅ Copied!';
        setTimeout(function () { copyButton.textContent = '📋 Copy Text'; }, 2000);
      });
    });
  }

  /* Download as .txt */
  var downloadButton = document.getElementById('textextractor-detail-download-button');
  if (downloadButton && textContent) {
    downloadButton.addEventListener('click', function () {
      var filename = downloadButton.getAttribute('data-filename') || 'extracted-text.txt';
      var blob = new Blob([textContent.textContent], { type: 'text/plain;charset=utf-8' });
      var downloadUrl = URL.createObjectURL(blob);
      var downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = filename;
      downloadLink.click();
      URL.revokeObjectURL(downloadUrl);
    });
  }

  /* Auto-poll for processing/queued jobs */
  var processingSection = document.getElementById('textextractor-detail-processing');
  if (processingSection) {
    var jobId = processingSection.getAttribute('data-job-id');
    if (jobId) {
      var pollInterval = setInterval(function () {
        fetch('/text-extractor/api/status/' + jobId + '/')
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.status_code === 'completed' || data.status_code === 'failed') {
            clearInterval(pollInterval);
            window.location.reload();
          }
        })
        .catch(function () { /* keep polling */ });
      }, 2000);
    }
  }
})();
