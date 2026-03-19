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

  var tournamentName = document.getElementById('sports-tournament-name');
  var milestones = document.getElementById('sports-records-milestones');
  var transferSection = document.getElementById('sports-transfer-section');
  var transferFrom = document.getElementById('sports-transfer-from');
  var transferTo = document.getElementById('sports-transfer-to');
  var transferFee = document.getElementById('sports-transfer-fee');
  var transferDuration = document.getElementById('sports-transfer-duration');
  var injurySection = document.getElementById('sports-injury-section');
  var injuryType = document.getElementById('sports-injury-type');
  var injuryRecovery = document.getElementById('sports-injury-recovery');
  var subTypeHidden = document.getElementById('sports-sub-type');
  var hiddenJson = document.getElementById('sports-records-json');

  if (!hiddenJson) return;

  /* Toggle conditional sections based on sub-type */
  function toggleSections() {
    var subType = subTypeHidden ? subTypeHidden.value : '';
    if (transferSection) {
      transferSection.style.display = (subType === 'transfer') ? '' : 'none';
    }
    if (injurySection) {
      injurySection.style.display = (subType === 'injury') ? '' : 'none';
    }
  }

  function serialize() {
    var subType = subTypeHidden ? subTypeHidden.value : '';
    var data = {
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
  var inputFields = [tournamentName, milestones,
                     transferFrom, transferTo, transferFee, transferDuration,
                     injuryType, injuryRecovery];
  inputFields.forEach(function (el) {
    if (el) el.addEventListener('input', serialize);
  });

  /* Watch sub-type hidden input for value changes (set by radio picker in step 3) */
  if (subTypeHidden) {
    /* Listen to sub-type radio changes directly (more reliable than MutationObserver) */
    var subTypeRadios = document.querySelectorAll('input[name="sports_sub_type_radio"]');
    for (var i = 0; i < subTypeRadios.length; i++) {
      subTypeRadios[i].addEventListener('change', function () {
        toggleSections();
        serialize();
      });
    }
  }

  /* Serialize before form submit */
  var form = hiddenJson.closest('form');
  if (form) {
    form.addEventListener('submit', serialize);
  }

  /* Initial state */
  toggleSections();

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
