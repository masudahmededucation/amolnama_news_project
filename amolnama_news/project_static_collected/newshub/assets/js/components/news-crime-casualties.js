/**
 * news-crime-casualties.js
 * Serializes the Casualties & Impact form fields (step 7 of Crime/Violence)
 * into a hidden JSON input for form submission.
 * Saved to [investigation].[incident_evidence_impact_casualty] on the server.
 *
 * DOM dependencies:
 *   #casualties-impact-json      — hidden input (JSON payload)
 *   #impact-death-count           — number input
 *   #impact-injury-count          — number input
 *   #impact-property-destruction  — textarea
 *   #impact-damage-amount         — number input
 *   #impact-is-ongoing            — checkbox
 */
(function () {
  'use strict';

  var hiddenInput = document.getElementById('casualties-impact-json');
  if (!hiddenInput) return;

  var deathCountEl = document.getElementById('impact-death-count');
  var injuryCountEl = document.getElementById('impact-injury-count');
  var propertyDestructionEl = document.getElementById('impact-property-destruction');
  var damageAmountEl = document.getElementById('impact-damage-amount');
  var isOngoingEl = document.getElementById('impact-is-ongoing');

  function collectData() {
    return {
      deathCount: parseInt(deathCountEl && deathCountEl.value, 10) || 0,
      injuryCount: parseInt(injuryCountEl && injuryCountEl.value, 10) || 0,
      propertyDestruction: (propertyDestructionEl && propertyDestructionEl.value) || '',
      damageAmount: parseFloat(damageAmountEl && damageAmountEl.value) || 0,
      isOngoing: !!(isOngoingEl && isOngoingEl.checked)
    };
  }

  function syncToHiddenInput() {
    var data = collectData();
    /* Only serialize if at least one field has a value */
    var hasData = data.deathCount > 0 || data.injuryCount > 0
      || data.propertyDestruction.trim() || data.damageAmount > 0
      || data.isOngoing;
    hiddenInput.value = hasData ? JSON.stringify(data) : '';
  }

  /* Sync on any input change within the section */
  var section = document.getElementById('section-casualties-impact');
  if (section) {
    section.addEventListener('input', syncToHiddenInput);
    section.addEventListener('change', syncToHiddenInput);
  }

  /* Re-sync right before form submit */
  var form = hiddenInput.closest('form');
  if (form) {
    form.addEventListener('submit', syncToHiddenInput);
  }

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenInput.value) return;
    var data;
    try { data = JSON.parse(hiddenInput.value); } catch (e) { return; }

    if (deathCountEl && data.deathCount)   deathCountEl.value   = data.deathCount;
    if (injuryCountEl && data.injuryCount) injuryCountEl.value  = data.injuryCount;
    if (propertyDestructionEl && data.propertyDestruction) propertyDestructionEl.value = data.propertyDestruction;
    if (damageAmountEl && data.damageAmount) damageAmountEl.value = data.damageAmount;
    if (isOngoingEl) isOngoingEl.checked = !!data.isOngoing;
  }
  setTimeout(restoreFromSavedData, 350);

  /* Public API for form-clear.js */
  window.newshubCrimeCasualties = {
    reset: function () {
      if (deathCountEl) deathCountEl.value = '';
      if (injuryCountEl) injuryCountEl.value = '';
      if (propertyDestructionEl) propertyDestructionEl.value = '';
      if (damageAmountEl) damageAmountEl.value = '';
      if (isOngoingEl) isOngoingEl.checked = false;
      hiddenInput.value = '';
    }
  };
})();
