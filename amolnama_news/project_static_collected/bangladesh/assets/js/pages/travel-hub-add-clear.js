/**
 * travel-hub-add-clear.js — "Clear Form" button for travel hub add page.
 * Two-click confirmation, clears all fields including Quill editors.
 * Only active in create mode (not edit mode).
 *
 * DOM dependency:
 *   #travel-hub-clear-form-button — the clear button
 *   #travel-hub-add-form                     — the form element
 */
(function () {
  'use strict';

  const button = document.getElementById('travel-hub-clear-form-button');
  const form = document.getElementById('travel-hub-add-form');
  if (!button || !form) return;

  /* Skip in edit mode */
  if (document.getElementById('travel-hub-edit-entry-id')) {
    button.hidden = true;
    return;
  }

  /* Inline confirmation message element */
  const messageElement = document.createElement('span');
  messageElement.className = 'travel-hub-clear-form-message';
  messageElement.hidden = true;
  button.parentNode.insertBefore(messageElement, button);

  let confirmTimer = null;
  let awaitingConfirm = false;

  button.addEventListener('click', function () {
    /* First click — show inline confirmation */
    if (!awaitingConfirm) {
      awaitingConfirm = true;
      button.textContent = '\u09B9\u09CD\u09AF\u09BE\u0981, \u09AE\u09C1\u099B\u09C1\u09A8 (Yes, Clear)';
      button.classList.add('travel-hub-clear-form-button-confirm');
      messageElement.textContent = '\u09A8\u09BF\u09B6\u09CD\u099A\u09BF\u09A4? (Sure?)';
      messageElement.hidden = false;
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
    messageElement.hidden = false;
    setTimeout(function () { messageElement.hidden = true; }, 3000);

    /* 1. Clear all form fields */
    const elements = form.elements;
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (element.type === 'submit' || element.type === 'button' || element.type === 'hidden') continue;
      if (element.type === 'select-one') {
        element.selectedIndex = 0;
      } else {
        element.value = '';
      }
    }

    /* 2. Clear Quill editors — use Quill.find() if available, else clear ql-editor */
    clearQuillContainer('quill-short-desc');
    clearQuillContainer('quill-desc');

    /* 3. Clear hidden textareas that sync with Quill */
    const shortDescTextarea = document.getElementById('travel-hub-short-desc-bn');
    const descTextarea = document.getElementById('travel-hub-desc-bn');
    if (shortDescTextarea) shortDescTextarea.value = '';
    if (descTextarea) descTextarea.value = '';

    /* 4. Clear error message */
    const errorElement = document.getElementById('travel-hub-add-error');
    if (errorElement) { errorElement.classList.remove('form-error-visible'); errorElement.textContent = ''; }
  });

  function resetButtonState() {
    awaitingConfirm = false;
    button.textContent = '\u09A4\u09A5\u09CD\u09AF \u09AE\u09C1\u099B\u09C1\u09A8 (Clear Form)';
    button.classList.remove('travel-hub-clear-form-button-confirm');
    messageElement.hidden = true;
  }

  function clearQuillContainer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    /* Try Quill.find() first (Quill 1.x stores reference) */
    if (typeof Quill !== 'undefined' && Quill.find) {
      const quillInstance = Quill.find(container);
      if (quillInstance) { quillInstance.setText(''); return; }
    }
    /* Fallback: clear the editor div directly */
    const editor = container.querySelector('.ql-editor');
    if (editor) editor.innerHTML = '<p><br></p>';
  }
})();
