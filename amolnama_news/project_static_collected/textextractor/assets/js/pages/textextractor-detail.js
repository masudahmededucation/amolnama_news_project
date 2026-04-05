/* textextractor-detail.js — Copy text, download, auto-poll for processing jobs. */
(function () {
  'use strict';

  /* Copy extracted text to clipboard */
  const copyButton = document.getElementById('textextractor-detail-copy-button');
  const textContent = document.getElementById('textextractor-detail-text-content');
  if (copyButton && textContent) {
    copyButton.addEventListener('click', function () {
      navigator.clipboard.writeText(textContent.textContent).then(function () {
        copyButton.textContent = '✅ Copied!';
        setTimeout(function () { copyButton.textContent = '📋 Copy Text'; }, 2000);
      });
    });
  }

  /* Download as .txt */
  const downloadButton = document.getElementById('textextractor-detail-download-button');
  if (downloadButton && textContent) {
    downloadButton.addEventListener('click', function () {
      const filename = downloadButton.getAttribute('data-filename') || 'extracted-text.txt';
      const blob = new Blob([textContent.textContent], { type: 'text/plain;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = filename;
      downloadLink.click();
      URL.revokeObjectURL(downloadUrl);
    });
  }

  /* Auto-poll for processing/queued jobs */
  const processingSection = document.getElementById('textextractor-detail-processing');
  if (processingSection) {
    const jobId = processingSection.getAttribute('data-job-id');
    if (jobId) {
      const pollInterval = setInterval(function () {
        fetch('/text-extractor/api/status/' + jobId + '/')
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
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
