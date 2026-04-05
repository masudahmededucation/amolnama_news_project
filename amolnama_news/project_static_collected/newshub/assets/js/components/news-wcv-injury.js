/**
 * news-wcv-injury.js
 * Reads injury types, severity, and psychological symptoms;
 * serializes to #wcv-injury.
 *
 * Exposes: window.newshubWcvInjury = { reset: fn }
 */
(function () {
  'use strict';

  const injuryTypes = document.querySelectorAll('input[name="wcv_injury_type"]');
  const severityRadios = document.querySelectorAll('input[name="wcv_injury_severity"]');
  const psychSymptoms = document.querySelectorAll('input[name="wcv_psych_symptom"]');
  const hiddenJson = document.getElementById('wcv-injury');

  if (!hiddenJson) return;

  function getRadio(radios) {
    for (let i = 0; i < radios.length; i++) {
      if (radios[i].checked) return radios[i].value;
    }
    return '';
  }

  function getCheckedValues(checkboxes) {
    const values = [];
    for (let i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) values.push(checkboxes[i].value);
    }
    return values;
  }

  function serialize() {
    let data = {
      injuryTypes: getCheckedValues(injuryTypes),
      severity: getRadio(severityRadios),
      psychSymptoms: getCheckedValues(psychSymptoms)
    };
    hiddenJson.value = JSON.stringify(data);
  }

  /* Listeners */
  [injuryTypes, psychSymptoms].forEach(function (group) {
    for (let i = 0; i < group.length; i++) group[i].addEventListener('change', serialize);
  });
  for (let i = 0; i < severityRadios.length; i++) severityRadios[i].addEventListener('change', serialize);

  const form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* ========== Restore from saved data ========== */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    let data;
    try { data = JSON.parse(hiddenJson.value); } catch (e) { return; }
    if (!data || typeof data !== 'object') return;

    /* Injury type checkboxes */
    if (data.injuryTypes && data.injuryTypes.length) {
      for (let i = 0; i < injuryTypes.length; i++) {
        injuryTypes[i].checked = data.injuryTypes.indexOf(injuryTypes[i].value) !== -1;
      }
    }

    /* Severity radio */
    if (data.severity) {
      for (let s = 0; s < severityRadios.length; s++) {
        severityRadios[s].checked = (severityRadios[s].value === String(data.severity));
      }
    }

    /* Psychological symptoms checkboxes */
    if (data.psychSymptoms && data.psychSymptoms.length) {
      for (let p = 0; p < psychSymptoms.length; p++) {
        psychSymptoms[p].checked = data.psychSymptoms.indexOf(psychSymptoms[p].value) !== -1;
      }
    }
  }

  setTimeout(restoreFromSavedData, 100);

  window.newshubWcvInjury = {
    reset: function () {
      [injuryTypes, psychSymptoms].forEach(function (group) {
        for (let i = 0; i < group.length; i++) group[i].checked = false;
      });
      for (let j = 0; j < severityRadios.length; j++) severityRadios[j].checked = false;
      hiddenJson.value = '';
    }
  };

  /* Step validator: if injury types selected, require severity */
  const panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    const step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      const warnings = [];
      const hasInjuryType = getCheckedValues(injuryTypes).length > 0;
      if (hasInjuryType && !getRadio(severityRadios)) {
        warnings.push('আঘাতের তীব্রতা নির্বাচন করুন (Please select injury severity)');
      }
      return { warnings: warnings };
    }});
  }
})();
