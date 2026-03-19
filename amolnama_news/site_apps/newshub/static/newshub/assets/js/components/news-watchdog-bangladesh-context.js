/**
 * news-watchdog-bangladesh-context.js
 * Reads motive checkboxes + context description and serializes to
 * #political-context-json hidden input on input/change and before form submit.
 *
 * DOM dependencies:
 *   input[name="political_motive"]     — motive checkboxes
 *   #political-context-description     — context description textarea
 *   #political-context-json            — hidden JSON input for form submission
 *
 * Exposes: window.newshubPoliticalContext = { reset: fn }
 */
(function () {
  'use strict';

  var checkboxes = document.querySelectorAll('input[name="political_motive"]');
  var descriptionEl = document.getElementById('political-context-description');
  var hiddenJson = document.getElementById('political-context-json');

  if (!hiddenJson) return;

  function serialize() {
    var motives = [];
    for (var i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) {
        motives.push(checkboxes[i].value);
      }
    }

    var data = {
      motives: motives,
      description: descriptionEl ? descriptionEl.value.trim() : '',
    };

    hiddenJson.value = JSON.stringify(data);
  }

  /* Listen for changes on checkboxes */
  for (var i = 0; i < checkboxes.length; i++) {
    checkboxes[i].addEventListener('change', serialize);
  }

  /* Listen for input on description */
  if (descriptionEl) {
    descriptionEl.addEventListener('input', serialize);
  }

  /* Serialize before form submit */
  var form = hiddenJson.closest('form');
  if (form) {
    form.addEventListener('submit', serialize);
  }

  /* Public API for form-clear */
  window.newshubPoliticalContext = {
    reset: function () {
      for (var i = 0; i < checkboxes.length; i++) {
        checkboxes[i].checked = false;
      }
      if (descriptionEl) descriptionEl.value = '';
      hiddenJson.value = '';
    },
  };
})();
