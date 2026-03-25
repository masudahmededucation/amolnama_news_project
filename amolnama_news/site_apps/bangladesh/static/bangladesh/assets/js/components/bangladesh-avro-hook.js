/**
 * bangladesh-bangla-input-hook.js — Attach BanglaInput to all Bengali text fields
 * on bangladesh pages (travel-hub-add, beauty-hub-upload).
 * Skips URL fields and data-no-bangla fields.
 * Retries until BanglaInput is loaded (it loads after extra_js block).
 */
(function attachBanglaToFormFields() {
  'use strict';

  if (typeof BanglaInput === 'undefined') {
    setTimeout(attachBanglaToFormFields, 300);
    return;
  }

  var fields = document.querySelectorAll('input[type="text"]:not([data-no-bangla])');
  for (var i = 0; i < fields.length; i++) {
    if (!fields[i].getAttribute('data-bangla-attached')) {
      BanglaInput.attach(fields[i]);
      fields[i].setAttribute('data-bangla-attached', '1');
    }
  }
})();
