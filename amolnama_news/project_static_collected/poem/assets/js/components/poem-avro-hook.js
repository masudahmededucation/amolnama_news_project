/**
 * poem-bangla-input-hook.js — Attach BanglaInput to all Bengali text fields
 * on poem create and edit pages. Skips _en fields.
 * Retries until BanglaInput is loaded (it loads after extra_js block).
 */
(function attachBanglaToPoetryFields() {
  'use strict';

  if (typeof BanglaInput === 'undefined') {
    setTimeout(attachBanglaToPoetryFields, 300);
    return;
  }

  var fields = document.querySelectorAll(
    '#poem-author-name, #poem-title-bn, #poem-body-bn, '
    + '#poem-backstory-bn, #poem-interpretation-bn, '
    + '#poem-audio-reciter-name, #poem-audio-description'
  );

  for (var i = 0; i < fields.length; i++) {
    if (!fields[i].getAttribute('data-bangla-attached')) {
      BanglaInput.attach(fields[i]);
      fields[i].setAttribute('data-bangla-attached', '1');
    }
  }
})();
