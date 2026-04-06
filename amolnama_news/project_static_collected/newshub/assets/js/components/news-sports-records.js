/**
 * news-sports-records.js
 * Reads records fields (tournament name, milestones, transfer details,
 * injury details) and serializes to #sports-records-json hidden input
 * on input/change and before form submit.
 *
 * Toggles transfer/injury sections based on the sports sub-type hidden input.
 *
 * DOM dependencies:
 *   #sports-tournament-name       — text input
 *   #sports-records-milestones    — textarea
 *   #sports-transfer-section      — conditional section container
 *   #sports-transfer-from         — text input
 *   #sports-transfer-to           — text input
 *   #sports-transfer-fee          — text input
 *   #sports-transfer-duration     — text input
 *   #sports-injury-section        — conditional section container
 *   #sports-injury-type           — text input
 *   #sports-injury-recovery       — text input
 *   #sports-sub-type              — hidden input (set by sub-type picker)
 *   #sports-records-json          — hidden JSON input for form submission
 *
 * Exposes: window.newshubSportsRecords = { reset: fn }
 */
(function () {
  'use strict';

  const tournamentName = document.getElementById('sports-tournament-name');
  const milestones = document.getElementById('sports-records-milestones');
  const transferSection = document.getElementById('sports-transfer-section');
  const transferFrom = document.getElementById('sports-transfer-from');
  const transferTo = document.getElementById('sports-transfer-to');
  const transferFee = document.getElementById('sports-transfer-fee');
  const transferDuration = document.getElementById('sports-transfer-duration');
  const injurySection = document.getElementById('sports-injury-section');
  const injuryType = document.getElementById('sports-injury-type');
  const injuryRecovery = document.getElementById('sports-injury-recovery');
  const subTypeHidden = document.getElementById('sports-sub-type');
  const hiddenJson = document.getElementById('sports-records-json');

  if (!hiddenJson) return;

  /* Toggle conditional sections based on sub-type */
  function toggleSections() {
    let subType = subTypeHidden ? subTypeHidden.value : '';
    if (transferSection) {
      transferSection.hidden = (subType !== 'transfer');
    }
    if (injurySection) {
      injurySection.hidden = (subType !== 'injury');
    }
  }

  function serialize() {
    const subType = subTypeHidden ? subTypeHidden.value : '';
    let data = {
      tournamentName: tournamentName ? tournamentName.value.trim() : '',
      milestones: milestones ? milestones.value.trim() : '',
    };

    /* Include transfer details only when visible */
    if (subType === 'transfer') {
      data.transferFrom = transferFrom ? transferFrom.value.trim() : '';
      data.transferTo = transferTo ? transferTo.value.trim() : '';
      data.transferFee = transferFee ? transferFee.value.trim() : '';
      data.transferDuration = transferDuration ? transferDuration.value.trim() : '';
    }

    /* Include injury details only when visible */
    if (subType === 'injury') {
      data.injuryType = injuryType ? injuryType.value.trim() : '';
      data.injuryRecovery = injuryRecovery ? injuryRecovery.value.trim() : '';
    }

    hiddenJson.value = JSON.stringify(data);
  }

  /* Listen for input changes on text fields */
  const inputFields = [tournamentName, milestones,
                     transferFrom, transferTo, transferFee, transferDuration,
                     injuryType, injuryRecovery];
  inputFields.forEach(function (el) {
    if (el) el.addEventListener('input', serialize);
  });

  /* Watch sub-type hidden input for value changes (set by radio picker in step 3) */
  if (subTypeHidden) {
    /* Listen to sub-type radio changes directly (more reliable than MutationObserver) */
    const subTypeRadios = document.querySelectorAll('input[name="sports_sub_type_radio"]');
    for (let i = 0; i < subTypeRadios.length; i++) {
      subTypeRadios[i].addEventListener('change', function () {
        toggleSections();
        serialize();
      });
    }
  }

  /* Serialize before form submit */
  const form = hiddenJson.closest('form');
  if (form) {
    form.addEventListener('submit', serialize);
  }

  /* Initial state */
  toggleSections();

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    let data;
    try { data = JSON.parse(hiddenJson.value); } catch (e) { return; }

    if (tournamentName && data.tournamentName)     tournamentName.value   = data.tournamentName;
    if (milestones && data.milestones)             milestones.value       = data.milestones;
    if (transferFrom && data.transferFrom)         transferFrom.value     = data.transferFrom;
    if (transferTo && data.transferTo)             transferTo.value       = data.transferTo;
    if (transferFee && data.transferFee)           transferFee.value      = data.transferFee;
    if (transferDuration && data.transferDuration) transferDuration.value = data.transferDuration;
    if (injuryType && data.injuryType)             injuryType.value      = data.injuryType;
    if (injuryRecovery && data.injuryRecovery)     injuryRecovery.value  = data.injuryRecovery;
    toggleSections();
  }
  setTimeout(restoreFromSavedData, 100);

  /* Public API for form-clear */
  window.newshubSportsRecords = {
    reset: function () {
      if (tournamentName) tournamentName.value = '';
      if (milestones) milestones.value = '';
      if (transferFrom) transferFrom.value = '';
      if (transferTo) transferTo.value = '';
      if (transferFee) transferFee.value = '';
      if (transferDuration) transferDuration.value = '';
      if (injuryType) injuryType.value = '';
      if (injuryRecovery) injuryRecovery.value = '';
      toggleSections();
      hiddenJson.value = '';
    },
  };
})();
