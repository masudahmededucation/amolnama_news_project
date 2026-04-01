/**
 * beauty-hub-upload-clear.js — "Clear Form" button for beauty hub upload page.
 * Two-click confirmation, clears all fields including Quill editor and file preview.
 *
 * DOM dependency:
 *   #beauty-hub-clear-form-button — the clear button
 *   #beauty-hub-upload-form        — the form element
 */
(function () {
  'use strict';

  var button = document.getElementById('beauty-hub-clear-form-button');
  var form = document.getElementById('beauty-hub-upload-form');
  if (!button || !form) return;

  /* Inline confirmation message element */
  var messageElement = document.createElement('span');
  messageElement.className = 'beauty-hub-clear-form-message';
  messageElement.style.display = 'none';
  button.parentNode.insertBefore(messageElement, button);

  var confirmTimer = null;
  var awaitingConfirm = false;

  button.addEventListener('click', function () {
    /* First click — show inline confirmation */
    if (!awaitingConfirm) {
      awaitingConfirm = true;
      button.textContent = '\u09B9\u09CD\u09AF\u09BE\u0981, \u09AE\u09C1\u099B\u09C1\u09A8 (Yes, Clear)';
      button.classList.add('beauty-hub-clear-form-button-confirm');
      messageElement.textContent = '\u09A8\u09BF\u09B6\u09CD\u099A\u09BF\u09A4? (Sure?)';
      messageElement.style.display = '';
      confirmTimer = setTimeout(function () {
        resetButtonState();
      }, 4000);
      return;
    }

    /* Second click — confirmed, clear everything */
    awaitingConfirm = false;
    clearTimeout(confirmTimer);
    resetButtonState();
    messageElement.textContent = '\u09AE\u09C1\u099B\u09C7 \u09AB\u09C7\u09B2\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 (Cleared!)';
    messageElement.style.display = '';
    setTimeout(function () { messageElement.style.display = 'none'; }, 3000);

    /* 1. Clear all form fields */
    var elements = form.elements;
    for (var i = 0; i < elements.length; i++) {
      var element = elements[i];
      if (element.type === 'submit' || element.type === 'button') continue;
      if (element.type === 'file') {
        element.value = '';
      } else if (element.type === 'select-one') {
        element.selectedIndex = 0;
      } else if (element.type === 'checkbox') {
        element.checked = false;
      } else {
        element.value = '';
      }
    }

    /* 2. Clear Quill editor */
    clearQuillContainer('quill-beauty-hub-description');

    /* 3. Clear hidden textarea that syncs with Quill */
    var descTextarea = document.getElementById('beauty-hub-desc-bn');
    if (descTextarea) descTextarea.value = '';

    /* 4. Hide file preview */
    var filePreview = document.getElementById('beauty-hub-file-preview');
    var imagePreview = document.getElementById('beauty-hub-image-preview');
    var videoPreview = document.getElementById('beauty-hub-video-preview');
    if (filePreview) filePreview.style.display = 'none';
    if (imagePreview) { imagePreview.style.display = 'none'; imagePreview.src = ''; }
    if (videoPreview) { videoPreview.style.display = 'none'; videoPreview.src = ''; }

    /* 5. Hide festival date fields */
    var festivalFields = document.getElementById('beauty-hub-festival-fields');
    if (festivalFields) festivalFields.style.display = 'none';

    /* 6. Hide upload progress */
    var progressElement = document.getElementById('beauty-hub-upload-progress');
    if (progressElement) progressElement.style.display = 'none';

    /* 7. Clear error message */
    var errorElement = document.getElementById('beauty-hub-upload-error');
    if (errorElement) { errorElement.style.display = 'none'; errorElement.textContent = ''; }
  });

  function resetButtonState() {
    awaitingConfirm = false;
    button.textContent = '\u09A4\u09A5\u09CD\u09AF \u09AE\u09C1\u099B\u09C1\u09A8 (Clear Form)';
    button.classList.remove('beauty-hub-clear-form-button-confirm');
    messageElement.style.display = 'none';
  }

  function clearQuillContainer(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    if (typeof Quill !== 'undefined' && Quill.find) {
      var quillInstance = Quill.find(container);
      if (quillInstance) { quillInstance.setText(''); return; }
    }
    var editor = container.querySelector('.ql-editor');
    if (editor) editor.innerHTML = '<p><br></p>';
  }
})();
