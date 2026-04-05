/**
 * news-war-conflict-humanitarian.js
 * Reads humanitarian fields (military/civilian casualties, refugees,
 * war crimes checkbox + description) and serializes to
 * #global-humanitarian-json hidden input on input/change and before form submit.
 *
 * DOM dependencies:
 *   #global-military-casualties      — number input
 *   #global-civilian-casualties      — number input
 *   #global-refugees                 — number input
 *   #global-war-crimes               — checkbox
 *   #global-war-crimes-description   — textarea (shown/hidden by checkbox)
 *   #global-war-crimes-details-row   — row container (toggled)
 *   #global-humanitarian-json        — hidden JSON input for form submission
 *
 * Exposes: window.newshubGlobalHumanitarian = { reset: fn }
 */
(function () {
  'use strict';

  const militaryCasualties = document.getElementById('global-military-casualties');
  const civilianCasualties = document.getElementById('global-civilian-casualties');
  const refugees = document.getElementById('global-refugees');
  const warCrimes = document.getElementById('global-war-crimes');
  const warCrimesDesc = document.getElementById('global-war-crimes-description');
  const warCrimesRow = document.getElementById('global-war-crimes-details-row');
  const hiddenJson = document.getElementById('global-humanitarian-json');

  if (!hiddenJson) return;

  /* Toggle war crimes details row visibility */
  function toggleWarCrimesRow() {
    if (!warCrimes || !warCrimesRow) return;
    warCrimes.checked ? warCrimesRow.classList.remove('display-hidden') : warCrimesRow.classList.add('display-hidden');
    if (!warCrimes.checked && warCrimesDesc) {
      warCrimesDesc.value = '';
    }
  }

  function serialize() {
    let data = {
      militaryCasualties: militaryCasualties ? (parseInt(militaryCasualties.value, 10) || 0) : 0,
      civilianCasualties: civilianCasualties ? (parseInt(civilianCasualties.value, 10) || 0) : 0,
      refugees: refugees ? (parseInt(refugees.value, 10) || 0) : 0,
      warCrimes: warCrimes ? warCrimes.checked : false,
      warCrimesDescription: warCrimesDesc ? warCrimesDesc.value.trim() : '',
    };

    hiddenJson.value = JSON.stringify(data);
  }

  /* Listen for input changes on number fields */
  const inputFields = [militaryCasualties, civilianCasualties, refugees, warCrimesDesc];
  inputFields.forEach(function (el) {
    if (el) el.addEventListener('input', serialize);
  });

  /* Checkbox: toggle + serialize */
  if (warCrimes) {
    warCrimes.addEventListener('change', function () {
      toggleWarCrimesRow();
      serialize();
    });
  }

  /* Serialize before form submit */
  const form = hiddenJson.closest('form');
  if (form) {
    form.addEventListener('submit', serialize);
  }

  /* Initial state */
  toggleWarCrimesRow();

  /* ---- Restore UI from saved hidden input JSON ---- */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    try {
      const data = JSON.parse(hiddenJson.value);
      if (militaryCasualties && data.militaryCasualties) militaryCasualties.value = data.militaryCasualties;
      if (civilianCasualties && data.civilianCasualties) civilianCasualties.value = data.civilianCasualties;
      if (refugees && data.refugees)                     refugees.value           = data.refugees;
      if (warCrimes)                                     warCrimes.checked        = !!data.warCrimes;
      if (warCrimesDesc && data.warCrimesDescription)    warCrimesDesc.value      = data.warCrimesDescription;
      toggleWarCrimesRow();
    } catch (e) { /* ignore parse errors */ }
  }

  setTimeout(restoreFromSavedData, 100);

  /* Public API for form-clear */
  window.newshubGlobalHumanitarian = {
    reset: function () {
      if (militaryCasualties) militaryCasualties.value = '';
      if (civilianCasualties) civilianCasualties.value = '';
      if (refugees) refugees.value = '';
      if (warCrimes) warCrimes.checked = false;
      if (warCrimesDesc) warCrimesDesc.value = '';
      toggleWarCrimesRow();
      hiddenJson.value = '';
    },
  };
})();
