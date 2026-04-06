/**
 * poem-create-clear.js — "Clear Form" button for poem create page.
 * Two-click confirmation, clears all fields, localStorage draft, and preview.
 *
 * DOM dependency:
 *   #poem-clear-form-button — the clear button
 *   #poemCreateForm          — the form element
 */
(function () {
  'use strict';

  const button = document.getElementById('poem-clear-form-button');
  const form = document.getElementById('poemCreateForm');
  if (!button || !form) return;

  /* Inline confirmation message element */
  const messageElement = document.createElement('span');
  messageElement.className = 'poem-clear-form-message';
  messageElement.hidden = true;
  button.parentNode.insertBefore(messageElement, button);

  let confirmTimer = null;
  let awaitingConfirm = false;

  button.addEventListener('click', function () {
    /* First click — show inline confirmation */
    if (!awaitingConfirm) {
      awaitingConfirm = true;
      button.textContent = '\u09B9\u09CD\u09AF\u09BE\u0981, \u09AE\u09C1\u099B\u09C1\u09A8 (Yes, Clear)';
      button.classList.add('poem-clear-form-button-confirm');
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
      if (element.type === 'submit' || element.type === 'button') continue;
      if (element.type === 'select-one') {
        element.selectedIndex = 0;
      } else {
        element.value = '';
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /* 2. Clear localStorage draft */
    try { localStorage.removeItem('poem_draft'); } catch (error) { /* ignore */ }

    /* 3. Clear preview panel */
    const previewTitle = document.getElementById('previewTitle');
    const previewAuthor = document.getElementById('previewAuthor');
    const previewBody = document.getElementById('previewBody');
    const previewBackstoryWrap = document.getElementById('previewBackstoryWrap');
    const previewInterpretationWrap = document.getElementById('previewInterpretationWrap');
    if (previewTitle) previewTitle.textContent = '';
    if (previewAuthor) previewAuthor.textContent = '';
    if (previewBody) previewBody.innerHTML = '<span class="poem-create-preview-empty">\u0995\u09AC\u09BF\u09A4\u09BE \u09B2\u09BF\u0996\u09A4\u09C7 \u09B6\u09C1\u09B0\u09C1 \u0995\u09B0\u09C1\u09A8...</span>';
    if (previewBackstoryWrap) previewBackstoryWrap.hidden = true;
    if (previewInterpretationWrap) previewInterpretationWrap.hidden = true;

    /* 4. Reset counters */
    const counterBn = document.getElementById('poemBodyBnCounter');
    const counterEn = document.getElementById('poemBodyEnCounter');
    if (counterBn) counterBn.textContent = '\u09E6 \u09B2\u09BE\u0987\u09A8 | \u09E6 \u0985\u0995\u09CD\u09B7\u09B0';
    if (counterEn) counterEn.textContent = '0 lines | 0 chars';

    /* 5. Hide draft badge */
    let badge = document.getElementById('poemDraftBadge');
    if (badge) badge.classList.remove('poem-create-draft-badge--visible');
  });

  function resetButtonState() {
    awaitingConfirm = false;
    button.textContent = '\u09A4\u09A5\u09CD\u09AF \u09AE\u09C1\u099B\u09C1\u09A8 (Clear Form)';
    button.classList.remove('poem-clear-form-button-confirm');
    messageElement.hidden = true;
  }
})();
