/* file-dropzone.js — Reusable drag & drop file upload component.
   Supports single and multiple files.
   Usage:
     window.fileDropzone.init({
       dropzoneElement: document.getElementById('my-dropzone'),
       fileInputElement: document.getElementById('my-file-input'),
       onFileSelected: function(file) { ... },        // called per file
       onFilesSelected: function(files) { ... },       // called once with all files (optional)
       maxSizeBytes: 50 * 1024 * 1024,
       onError: function(message) { ... },
       activeClass: 'my-dropzone-active',
     });
*/
(function () {
  'use strict';

  function initDropzone(options) {
    var dropzoneElement = options.dropzoneElement;
    var fileInputElement = options.fileInputElement;
    var onFileSelected = options.onFileSelected;
    var onFilesSelected = options.onFilesSelected;
    var maxSizeBytes = options.maxSizeBytes || 50 * 1024 * 1024;
    var onError = options.onError || function () {};
    var activeClass = options.activeClass || 'file-dropzone-active';

    if (!dropzoneElement || (!onFileSelected && !onFilesSelected)) return;

    function handleFiles(fileList) {
      if (!fileList || fileList.length === 0) return;

      var validFiles = [];
      for (var fileIndex = 0; fileIndex < fileList.length; fileIndex++) {
        var file = fileList[fileIndex];
        if (file.size > maxSizeBytes) {
          var maxSizeMegabytes = Math.round(maxSizeBytes / (1024 * 1024));
          onError(file.name + ' too large (max ' + maxSizeMegabytes + 'MB)');
          continue;
        }
        validFiles.push(file);
      }

      if (onFilesSelected && validFiles.length > 0) {
        onFilesSelected(validFiles);
      } else if (onFileSelected) {
        for (var validIndex = 0; validIndex < validFiles.length; validIndex++) {
          onFileSelected(validFiles[validIndex]);
        }
      }
    }

    /* Click dropzone → open file picker */
    dropzoneElement.addEventListener('click', function () {
      if (fileInputElement) fileInputElement.click();
    });

    /* File input change */
    if (fileInputElement) {
      fileInputElement.addEventListener('change', function () {
        handleFiles(fileInputElement.files);
        fileInputElement.value = '';
      });
    }

    /* Drag events */
    dropzoneElement.addEventListener('dragover', function (event) {
      event.preventDefault();
      dropzoneElement.classList.add(activeClass);
    });

    dropzoneElement.addEventListener('dragleave', function () {
      dropzoneElement.classList.remove(activeClass);
    });

    dropzoneElement.addEventListener('drop', function (event) {
      event.preventDefault();
      dropzoneElement.classList.remove(activeClass);
      handleFiles(event.dataTransfer.files);
    });
  }

  window.fileDropzone = { init: initDropzone };
})();
