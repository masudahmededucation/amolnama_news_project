/**
 * news-july-uprising-evidence.js
 * Reads evidence fields (verification status, evidence type checkboxes,
 * eyewitness count, and memorial reference) and serializes to
 * #july-evidence-json hidden input on input/change and before form submit.
 *
 * Toggles eyewitness count row when EYEWITNESS_TESTIMONY checkbox is checked.
 * Gazette listing is now included inside the evidence_type checkboxes (DB-driven).
 *
 * DOM dependencies:
 *   input[name="july_verification_status"]  — radio buttons (DB-driven, values=status_id)
 *   input[name="july_evidence_type"]        — checkboxes (DB-driven, values=status_id)
 *   #july-has-eyewitness                    — checkbox for EYEWITNESS_TESTIMONY (toggles count row)
 *   #july-eyewitness-count-row              — conditional row container
 *   #july-eyewitness-count                  — number input
 *   #july-memorial-ref                      — text input
 *   #july-evidence-json                     — hidden JSON input for form submission
 *
 * Exposes: window.newshubJulyEvidence = { reset: fn }
 */
(function () {
  'use strict';

  const verificationRadios = document.querySelectorAll('input[name="july_verification_status"]');
  const evidenceCheckboxes = document.querySelectorAll('input[name="july_evidence_type"]');
  const hasEyewitness = document.getElementById('july-has-eyewitness');
  const eyewitnessCountRow = document.getElementById('july-eyewitness-count-row');
  const eyewitnessCount = document.getElementById('july-eyewitness-count');
  const memorialRef = document.getElementById('july-memorial-ref');
  const hiddenJson = document.getElementById('july-evidence-json');

  if (!hiddenJson) return;

  function getVerificationStatus() {
    for (let i = 0; i < verificationRadios.length; i++) {
      if (verificationRadios[i].checked) return verificationRadios[i].value;
    }
    return '';
  }

  function getEvidenceTypes() {
    const types = [];
    for (let i = 0; i < evidenceCheckboxes.length; i++) {
      if (evidenceCheckboxes[i].checked) types.push(evidenceCheckboxes[i].value);
    }
    return types;
  }

  function toggleEyewitnessCount() {
    if (eyewitnessCountRow) {
      (hasEyewitness && eyewitnessCountRow.hidden = !hasEyewitness.checked);
    }
  }

  function serialize() {
    let data = {
      verificationStatus: getVerificationStatus(),
      evidenceTypes: getEvidenceTypes(),
      eyewitnessCount: (hasEyewitness && hasEyewitness.checked && eyewitnessCount)
        ? eyewitnessCount.value : '',
      memorialRef: memorialRef ? memorialRef.value.trim() : '',
    };
    hiddenJson.value = JSON.stringify(data);
  }

  for (let i = 0; i < verificationRadios.length; i++) {
    verificationRadios[i].addEventListener('change', serialize);
  }

  for (let j = 0; j < evidenceCheckboxes.length; j++) {
    evidenceCheckboxes[j].addEventListener('change', function () {
      toggleEyewitnessCount();
      serialize();
    });
  }

  if (eyewitnessCount) eyewitnessCount.addEventListener('input', serialize);
  if (memorialRef) memorialRef.addEventListener('input', serialize);

  const form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  toggleEyewitnessCount();

  /* ========== Restore from saved data ========== */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    let data;
    try { data = JSON.parse(hiddenJson.value); } catch (e) { return; }
    if (!data || typeof data !== 'object') return;

    /* Verification status radios */
    if (data.verificationStatus) {
      for (let r = 0; r < verificationRadios.length; r++) {
        verificationRadios[r].checked = (verificationRadios[r].value === String(data.verificationStatus));
      }
    }

    /* Evidence type checkboxes */
    if (data.evidenceTypes && data.evidenceTypes.length) {
      for (let c = 0; c < evidenceCheckboxes.length; c++) {
        evidenceCheckboxes[c].checked = data.evidenceTypes.indexOf(evidenceCheckboxes[c].value) !== -1;
      }
    }

    /* Eyewitness count */
    if (eyewitnessCount && data.eyewitnessCount) eyewitnessCount.value = data.eyewitnessCount;

    /* Memorial ref */
    if (memorialRef && data.memorialRef) memorialRef.value = data.memorialRef;

    toggleEyewitnessCount();
  }

  setTimeout(restoreFromSavedData, 100);

  window.newshubJulyEvidence = {
    reset: function () {
      for (let k = 0; k < verificationRadios.length; k++) {
        verificationRadios[k].checked = false;
      }
      for (let m = 0; m < evidenceCheckboxes.length; m++) {
        evidenceCheckboxes[m].checked = false;
      }
      if (eyewitnessCount) eyewitnessCount.value = '';
      if (memorialRef) memorialRef.value = '';
      toggleEyewitnessCount();
      hiddenJson.value = '';
    },
  };
})();
