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

  const button = document.getElementById('beauty-hub-clear-form-button');
  const form = document.getElementById('beauty-hub-upload-form');
  if (!button || !form) return;

  /* Inline confirmation message element */
  const messageElement = document.createElement('span');
  messageElement.className = 'beauty-hub-clear-form-message display-hidden';
  button.parentNode.insertBefore(messageElement, button);

  let confirmTimer = null;
  let awaitingConfirm = false;

  button.addEventListener('click', function () {
    /* First click — show inline confirmation */
    if (!awaitingConfirm) {
      awaitingConfirm = true;
      button.textContent = '\u09B9\u09CD\u09AF\u09BE\u0981, \u09AE\u09C1\u099B\u09C1\u09A8 (Yes, Clear)';
      button.classList.add('beauty-hub-clear-form-button-confirm');
      messageElement.textContent = '\u09A8\u09BF\u09B6\u09CD\u099A\u09BF\u09A4? (Sure?)';
      messageElement.classList.remove('display-hidden');
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
    messageElement.classList.remove('display-hidden');
    setTimeout(function () { messageElement.classList.add('display-hidden'); }, 3000);

    /* 1. Clear all form fields */
    const elements = form.elements;
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
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
    const descTextarea = document.getElementById('beauty-hub-desc-bn');
    if (descTextarea) descTextarea.value = '';

    /* 4. Hide file preview */
    const filePreview = document.getElementById('beauty-hub-file-preview');
    const imagePreview = document.getElementById('beauty-hub-image-preview');
    const videoPreview = document.getElementById('beauty-hub-video-preview');
    if (filePreview) filePreview.classList.add('display-hidden');
    if (imagePreview) { imagePreview.classList.add('display-hidden'); imagePreview.src = ''; }
    if (videoPreview) { videoPreview.classList.add('display-hidden'); videoPreview.src = ''; }

    /* 5. Hide festival date fields */
    const festivalFields = document.getElementById('beauty-hub-festival-fields');
    if (festivalFields) festivalFields.classList.add('display-hidden');

    /* 6. Hide upload progress */
    const progressElement = document.getElementById('beauty-hub-upload-progress');
    if (progressElement) progressElement.classList.add('display-hidden');

    /* 7. Clear error message */
    const errorElement = document.getElementById('beauty-hub-upload-error');
    if (errorElement) { errorElement.classList.add('display-hidden'); errorElement.textContent = ''; }
  });

  function resetButtonState() {
    awaitingConfirm = false;
    button.textContent = '\u09A4\u09A5\u09CD\u09AF \u09AE\u09C1\u099B\u09C1\u09A8 (Clear Form)';
    button.classList.remove('beauty-hub-clear-form-button-confirm');
    messageElement.classList.add('display-hidden');
  }

  function clearQuillContainer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (typeof Quill !== 'undefined' && Quill.find) {
      const quillInstance = Quill.find(container);
      if (quillInstance) { quillInstance.setText(''); return; }
    }
    const editor = container.querySelector('.ql-editor');
    if (editor) editor.innerHTML = '<p><br></p>';
  }
})();
