/**
 * news-watchdog-bangladesh-contradiction.js
 * Reads "Then vs Now" contradiction fields and serializes to
 * #contradiction-json hidden input on input/change and before form submit.
 *
 * DOM dependencies:
 *   #contradiction-original-statement  — original statement textarea
 *   #contradiction-original-date       — original date input
 *   #contradiction-original-source     — original source URL input
 *   #contradiction-current-statement   — current denial textarea
 *   #contradiction-current-date        — current date input
 *   #contradiction-proof-url           — proof URL input
 *   #contradiction-json                — hidden JSON input for form submission
 *
 * Exposes: window.newshubPoliticalContradiction = { reset: callback }
 */
(function () {
  'use strict';

  const originalStatement = document.getElementById('contradiction-original-statement');
  const originalDate = document.getElementById('contradiction-original-date');
  const originalSource = document.getElementById('contradiction-original-source');
  const currentStatement = document.getElementById('contradiction-current-statement');
  const currentDate = document.getElementById('contradiction-current-date');
  const proofUrl = document.getElementById('contradiction-proof-url');
  const hiddenJson = document.getElementById('contradiction-json');

  if (!hiddenJson) return;

  function serialize() {
    let data = {
      originalStatement: originalStatement ? originalStatement.value.trim() : '',
      originalDate: originalDate ? originalDate.value : '',
      originalSource: originalSource ? originalSource.value.trim() : '',
      currentStatement: currentStatement ? currentStatement.value.trim() : '',
      currentDate: currentDate ? currentDate.value : '',
      proofUrl: proofUrl ? proofUrl.value.trim() : '',
    };

    hiddenJson.value = JSON.stringify(data);
  }

  /* Listen for input changes on all fields */
  const fields = [originalStatement, originalDate, originalSource,
                currentStatement, currentDate, proofUrl];
  fields.forEach(function (element) {
    if (!element) return;
    element.addEventListener('input', serialize);
  });

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
      if (originalStatement && data.originalStatement) originalStatement.value = data.originalStatement;
      if (originalDate && data.originalDate)           originalDate.value      = data.originalDate;
      if (originalSource && data.originalSource)       originalSource.value    = data.originalSource;
      if (currentStatement && data.currentStatement)   currentStatement.value  = data.currentStatement;
      if (currentDate && data.currentDate)             currentDate.value       = data.currentDate;
      if (proofUrl && data.proofUrl)                   proofUrl.value          = data.proofUrl;
    } catch (e) { /* ignore parse errors */ }
  }

  setTimeout(restoreFromSavedData, 100);

  /* Public API for form-clear */
  window.newshubPoliticalContradiction = {
    reset: function () {
      if (originalStatement) originalStatement.value = '';
      if (originalDate) originalDate.value = '';
      if (originalSource) originalSource.value = '';
      if (currentStatement) currentStatement.value = '';
      if (currentDate) currentDate.value = '';
      if (proofUrl) proofUrl.value = '';
      hiddenJson.value = '';
    },
  };

  /* Step validator: require both statements when this section is visible */
  const section = document.getElementById('section-contradiction');
  const panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    const step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, callback: function () {
      /* Only validate when this section is the active one */
      if (section && section.hidden) return { warnings: [] };
      const warnings = [];
      const hasOriginal = originalStatement && originalStatement.value.trim();
      const hasCurrent = currentStatement && currentStatement.value.trim();
      if (!hasOriginal) {
        warnings.push('\u09AA\u09C2\u09B0\u09CD\u09AC\u09C7\u09B0 \u09AC\u0995\u09CD\u09A4\u09AC\u09CD\u09AF \u09A6\u09BF\u09A8 (Please enter the original statement)');
      }
      if (!hasCurrent) {
        warnings.push('\u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09AC\u0995\u09CD\u09A4\u09AC\u09CD\u09AF/\u0985\u09B8\u09CD\u09AC\u09C0\u0995\u09BE\u09B0 \u09A6\u09BF\u09A8 (Please enter the current statement/denial)');
      }
      return { warnings: warnings };
    }});
  }
})();
