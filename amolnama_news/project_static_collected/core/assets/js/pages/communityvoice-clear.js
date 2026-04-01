/**
 * communityvoice-clear.js — "Clear Form" button for community voice page.
 * Two-click confirmation, clears all fields and link previews.
 *
 * DOM dependency:
 *   #communityvoice-clear-form-button — the clear button
 *   .community-form                    — the form element
 */
(function () {
  'use strict';

  var button = document.getElementById('communityvoice-clear-form-button');
  var form = document.querySelector('.community-form');
  if (!button || !form) return;

  /* Inline confirmation message element */
  var messageElement = document.createElement('span');
  messageElement.className = 'communityvoice-clear-form-message';
  messageElement.style.display = 'none';
  button.parentNode.insertBefore(messageElement, button);

  var confirmTimer = null;
  var awaitingConfirm = false;

  button.addEventListener('click', function () {
    /* First click — show inline confirmation */
    if (!awaitingConfirm) {
      awaitingConfirm = true;
      button.textContent = 'Yes, Clear';
      button.classList.add('communityvoice-clear-form-button-confirm');
      messageElement.textContent = 'Sure?';
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
    messageElement.textContent = 'Cleared!';
    messageElement.style.display = '';
    setTimeout(function () { messageElement.style.display = 'none'; }, 3000);

    /* 1. Clear all form fields */
    var elements = form.elements;
    for (var i = 0; i < elements.length; i++) {
      var element = elements[i];
      if (element.type === 'submit' || element.type === 'button') continue;
      if (element.name === 'csrfmiddlewaretoken') continue;
      element.value = '';
    }

    /* 2. Hide link previews */
    var youtubePreview = document.getElementById('youtubePreview');
    var facebookPreview = document.getElementById('facebookPreview');
    var externalPreview = document.getElementById('externalPreview');
    if (youtubePreview) youtubePreview.style.display = 'none';
    if (facebookPreview) facebookPreview.style.display = 'none';
    if (externalPreview) externalPreview.style.display = 'none';

    /* 3. Clear iframe src */
    var youtubeFrame = document.getElementById('youtubeFrame');
    if (youtubeFrame) youtubeFrame.src = '';
  });

  function resetButtonState() {
    awaitingConfirm = false;
    button.textContent = 'Clear Form';
    button.classList.remove('communityvoice-clear-form-button-confirm');
    messageElement.style.display = 'none';
  }
})();
