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

  var verificationRadios = document.querySelectorAll('input[name="july_verification_status"]');
  var evidenceCheckboxes = document.querySelectorAll('input[name="july_evidence_type"]');
  var hasEyewitness = document.getElementById('july-has-eyewitness');
  var eyewitnessCountRow = document.getElementById('july-eyewitness-count-row');
  var eyewitnessCount = document.getElementById('july-eyewitness-count');
  var memorialRef = document.getElementById('july-memorial-ref');
  var hiddenJson = document.getElementById('july-evidence-json');

  if (!hiddenJson) return;

  function getVerificationStatus() {
    for (var i = 0; i < verificationRadios.length; i++) {
      if (verificationRadios[i].checked) return verificationRadios[i].value;
    }
    return '';
  }

  function getEvidenceTypes() {
    var types = [];
    for (var i = 0; i < evidenceCheckboxes.length; i++) {
      if (evidenceCheckboxes[i].checked) types.push(evidenceCheckboxes[i].value);
    }
    return types;
  }

  function toggleEyewitnessCount() {
    if (eyewitnessCountRow) {
      eyewitnessCountRow.style.display = (hasEyewitness && hasEyewitness.checked) ? '' : 'none';
    }
  }

  function serialize() {
    var data = {
      verificationStatus: getVerificationStatus(),
      evidenceTypes: getEvidenceTypes(),
      eyewitnessCount: (hasEyewitness && hasEyewitness.checked && eyewitnessCount)
        ? eyewitnessCount.value : '',
      memorialRef: memorialRef ? memorialRef.value.trim() : '',
    };
    hiddenJson.value = JSON.stringify(data);
  }

  for (var i = 0; i < verificationRadios.length; i++) {
    verificationRadios[i].addEventListener('change', serialize);
  }

  for (var j = 0; j < evidenceCheckboxes.length; j++) {
    evidenceCheckboxes[j].addEventListener('change', function () {
      toggleEyewitnessCount();
      serialize();
    });
  }

  if (eyewitnessCount) eyewitnessCount.addEventListener('input', serialize);
  if (memorialRef) memorialRef.addEventListener('input', serialize);

  var form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  toggleEyewitnessCount();

  window.newshubJulyEvidence = {
    reset: function () {
      for (var k = 0; k < verificationRadios.length; k++) {
        verificationRadios[k].checked = false;
      }
      for (var m = 0; m < evidenceCheckboxes.length; m++) {
        evidenceCheckboxes[m].checked = false;
      }
      if (eyewitnessCount) eyewitnessCount.value = '';
      if (memorialRef) memorialRef.value = '';
      toggleEyewitnessCount();
      hiddenJson.value = '';
    },
  };
})();
