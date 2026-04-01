/**
 * marriage-form-clear.js — "Clear Form" button for marriage (nikahnama) form.
 * Two-click confirmation, clears all text fields, selects, checkboxes,
 * signature canvases, and photo uploads.
 *
 * DOM dependency:
 *   #marriage-clear-form-button — the clear button
 *   .marriage-form               — the form container div
 */
(function () {
  'use strict';

  var button = document.getElementById('marriage-clear-form-button');
  var formContainer = document.querySelector('.marriage-form');
  if (!button || !formContainer) return;

  /* Inline confirmation message element */
  var messageElement = document.createElement('span');
  messageElement.className = 'marriage-clear-form-message';
  messageElement.style.display = 'none';
  button.parentNode.insertBefore(messageElement, button);

  var confirmTimer = null;
  var awaitingConfirm = false;

  button.addEventListener('click', function () {
    /* First click — show inline confirmation */
    if (!awaitingConfirm) {
      awaitingConfirm = true;
      button.textContent = '\u09B9\u09CD\u09AF\u09BE\u0981, \u09AE\u09C1\u099B\u09C1\u09A8 (Yes, Clear)';
      button.classList.add('marriage-clear-form-button-confirm');
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

    /* 1. Clear all text inputs */
    var textInputs = formContainer.querySelectorAll('input[type="text"], input[type="number"], input[type="tel"], input[type="email"]');
    for (var i = 0; i < textInputs.length; i++) {
      textInputs[i].value = '';
    }

    /* 2. Clear all textareas */
    var textareas = formContainer.querySelectorAll('textarea');
    for (var j = 0; j < textareas.length; j++) {
      textareas[j].value = '';
    }

    /* 3. Reset selects to first option */
    var selects = formContainer.querySelectorAll('select');
    for (var k = 0; k < selects.length; k++) {
      selects[k].selectedIndex = 0;
    }

    /* 4. Uncheck all checkboxes and radios */
    var checkboxes = formContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]');
    for (var m = 0; m < checkboxes.length; m++) {
      checkboxes[m].checked = false;
    }

    /* 5. Clear date inputs (Flatpickr) */
    var dateInputs = formContainer.querySelectorAll('input[type="date"], input.datepicker-alt-input');
    for (var d = 0; d < dateInputs.length; d++) {
      dateInputs[d].value = '';
      /* Clear Flatpickr instance if present */
      if (dateInputs[d]._flatpickr) {
        dateInputs[d]._flatpickr.clear();
      }
    }

    /* 6. Clear all signature canvases */
    var canvases = formContainer.querySelectorAll('.sig-canvas');
    for (var c = 0; c < canvases.length; c++) {
      var context = canvases[c].getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvases[c].width, canvases[c].height);
      }
    }

    /* 7. Clear file inputs (photos) */
    var fileInputs = formContainer.querySelectorAll('input[type="file"]');
    for (var f = 0; f < fileInputs.length; f++) {
      fileInputs[f].value = '';
    }

    /* 8. Clear photo preview images */
    var photoPreviewImages = formContainer.querySelectorAll('.marriage-photo-preview img');
    for (var p = 0; p < photoPreviewImages.length; p++) {
      photoPreviewImages[p].src = '';
      photoPreviewImages[p].style.display = 'none';
    }

    /* 9. Clear hidden inputs (except csrf) */
    var hiddenInputs = formContainer.querySelectorAll('input[type="hidden"]');
    for (var h = 0; h < hiddenInputs.length; h++) {
      if (hiddenInputs[h].name === 'csrfmiddlewaretoken') continue;
      hiddenInputs[h].value = '';
    }
  });

  function resetButtonState() {
    awaitingConfirm = false;
    button.textContent = '\u09A4\u09A5\u09CD\u09AF \u09AE\u09C1\u099B\u09C1\u09A8 (Clear Form)';
    button.classList.remove('marriage-clear-form-button-confirm');
    messageElement.style.display = 'none';
  }
})();
