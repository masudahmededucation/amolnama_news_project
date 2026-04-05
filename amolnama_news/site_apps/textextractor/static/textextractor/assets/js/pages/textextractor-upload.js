/* textextractor-upload.js — Upload page with progress + polling. Uses shared file-dropzone.js. */
(function () {
  'use strict';

  const dropzoneElement = document.getElementById('textextractor-upload-dropzone');
  const fileInputElement = document.getElementById('textextractor-upload-file-input');
  const progressSection = document.getElementById('textextractor-upload-progress');
  const progressFilename = document.getElementById('textextractor-upload-progress-filename');
  const progressBar = document.getElementById('textextractor-upload-progress-bar');
  const progressStatus = document.getElementById('textextractor-upload-progress-status');
  const resultSection = document.getElementById('textextractor-upload-result');
  const resultPreview = document.getElementById('textextractor-upload-result-preview');
  const resultViewButton = document.getElementById('textextractor-upload-result-view-button');
  const errorSection = document.getElementById('textextractor-upload-error');

  if (!dropzoneElement) return;


  function showError(text) {
    if (errorSection) { errorSection.textContent = text; errorSection.style.display = 'block'; }
    if (progressSection) progressSection.style.display = 'none';
    if (dropzoneElement) dropzoneElement.style.display = '';
  }

  function uploadFile(file) {
    /* Show progress immediately */
    if (errorSection) errorSection.style.display = 'none';
    if (resultSection) resultSection.style.display = 'none';
    if (progressSection) progressSection.style.display = 'block';
    if (progressFilename) progressFilename.textContent = file.name;
    if (progressBar) progressBar.style.width = '30%';
    if (progressStatus) progressStatus.textContent = 'Uploading...';
    if (dropzoneElement) dropzoneElement.style.display = 'none';

    const formData = new FormData();
    formData.append('extraction_file', file);

    fetch('/text-extractor/api/upload/', {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrfTokenValue() },
      body: formData,
    })
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function (data) {
      if (!data.success) { showError(data.error || 'Upload failed'); return; }
      if (progressBar) progressBar.style.width = '60%';
      if (progressStatus) progressStatus.textContent = 'Processing...';
      pollJobStatus(data.job_id);
    })
    .catch(function (networkError) {
      showError('Network error');
    });
  }

  function pollJobStatus(jobId) {
    const pollInterval = setInterval(function () {
      fetch('/text-extractor/api/status/' + jobId + '/')
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (data.status_code === 'completed') {
          clearInterval(pollInterval);
          if (progressBar) { progressBar.style.width = '100%'; progressBar.style.animation = 'none'; }
          if (progressStatus) progressStatus.textContent = 'Completed — ' + (data.word_count || 0) + ' words extracted';
          setTimeout(function () {
            if (progressSection) progressSection.style.display = 'none';
            if (resultSection) resultSection.style.display = 'block';
            if (resultPreview) resultPreview.textContent = data.extracted_text_preview || 'No text extracted';
            if (resultViewButton) resultViewButton.href = '/text-extractor/job/' + jobId + '/';
          }, 500);
        } else if (data.status_code === 'failed') {
          clearInterval(pollInterval);
          showError(data.error_message || 'Extraction failed');
        } else if (data.status_code === 'processing' && data.progress_message) {
          if (progressStatus) progressStatus.textContent = data.progress_message;
          /* Extract percent from message like "Processing page 3 of 15 (20%)" */
          const percentMatch = data.progress_message.match(/\((\d+)%\)/);
          if (percentMatch && progressBar) {
            const percent = parseInt(percentMatch[1], 10);
            progressBar.style.width = Math.max(10, percent) + '%';
            progressBar.style.animation = 'none';
          }
        }
      })
      .catch(function () { /* keep polling */ });
    }, 1500);
  }

  /* ---- Init shared dropzone ---- */
  if (window.fileDropzone) {
    window.fileDropzone.init({
      dropzoneElement: dropzoneElement,
      fileInputElement: fileInputElement,
      activeClass: 'textextractor-upload-dropzone-active',
      onFileSelected: uploadFile,
      onError: showError,
    });
  }
})();
