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
 * Exposes: window.newshubPoliticalContext = { reset: callback }
 */
(function () {
  'use strict';

  const checkboxes = document.querySelectorAll('input[name="political_motive"]');
  const descriptionEl = document.getElementById('political-context-description');
  const hiddenJson = document.getElementById('political-context-json');

  if (!hiddenJson) return;

  function serialize() {
    const motives = [];
    for (let i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) {
        motives.push(checkboxes[i].value);
      }
    }

    let data = {
      motives: motives,
      description: descriptionEl ? descriptionEl.value.trim() : '',
    };

    hiddenJson.value = JSON.stringify(data);
  }

  /* Listen for changes on checkboxes */
  for (let i = 0; i < checkboxes.length; i++) {
    checkboxes[i].addEventListener('change', serialize);
  }

  /* Listen for input on description */
  if (descriptionEl) {
    descriptionEl.addEventListener('input', serialize);
  }

  /* Serialize before form submit */
  const form = hiddenJson.closest('form');
  if (form) {
    form.addEventListener('submit', serialize);
  }

  /* ---- Restore UI from saved hidden input JSON ---- */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    try {
      const data = JSON.parse(hiddenJson.value);
      if (data.motives && Array.isArray(data.motives)) {
        for (let i = 0; i < checkboxes.length; i++) {
          checkboxes[i].checked = data.motives.indexOf(checkboxes[i].value) !== -1;
        }
      }
      if (descriptionEl && data.description) descriptionEl.value = data.description;
    } catch (e) { /* ignore parse errors */ }
  }

  setTimeout(restoreFromSavedData, 100);

  /* Public API for form-clear */
  window.newshubPoliticalContext = {
    reset: function () {
      for (let i = 0; i < checkboxes.length; i++) {
        checkboxes[i].checked = false;
      }
      if (descriptionEl) descriptionEl.value = '';
      hiddenJson.value = '';
    },
  };
})();
