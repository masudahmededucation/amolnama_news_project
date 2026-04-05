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

  const hiddenInput = document.getElementById('casualties-impact-json');
  if (!hiddenInput) return;

  const deathCountEl = document.getElementById('impact-death-count');
  const injuryCountEl = document.getElementById('impact-injury-count');
  const propertyDestructionEl = document.getElementById('impact-property-destruction');
  const damageAmountEl = document.getElementById('impact-damage-amount');
  const isOngoingEl = document.getElementById('impact-is-ongoing');

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
    let data = collectData();
    /* Only serialize if at least one field has a value */
    const hasData = data.deathCount > 0 || data.injuryCount > 0
      || data.propertyDestruction.trim() || data.damageAmount > 0
      || data.isOngoing;
    hiddenInput.value = hasData ? JSON.stringify(data) : '';
  }

  /* Sync on any input change within the section */
  const section = document.getElementById('section-casualties-impact');
  if (section) {
    section.addEventListener('input', syncToHiddenInput);
    section.addEventListener('change', syncToHiddenInput);
  }

  /* Re-sync right before form submit */
  const form = hiddenInput.closest('form');
  if (form) {
    form.addEventListener('submit', syncToHiddenInput);
  }

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenInput.value) return;
    let data;
    try { data = JSON.parse(hiddenInput.value); } catch (e) { return; }

    if (deathCountEl && data.deathCount)   deathCountEl.value   = data.deathCount;
    if (injuryCountEl && data.injuryCount) injuryCountEl.value  = data.injuryCount;
    if (propertyDestructionEl && data.propertyDestruction) propertyDestructionEl.value = data.propertyDestruction;
    if (damageAmountEl && data.damageAmount) damageAmountEl.value = data.damageAmount;
    if (isOngoingEl) isOngoingEl.checked = !!data.isOngoing;
  }
  setTimeout(restoreFromSavedData, 100);

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
