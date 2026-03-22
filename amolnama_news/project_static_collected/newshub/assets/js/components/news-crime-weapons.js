/**
 * news-crime-weapons.js
 * Serializes the Weapons & Evidence form fields (step 8 of Crime/Violence)
 * into a hidden JSON input for form submission.
 * Saved to [investigation].[incident_evidence_weapon] + [incident_evidence_impact_weapon].
 *
 * JSON format:
 *   { weaponTypeIds: [1,2,3], otherWeaponDetail: "...", recoveredEvidence: "..." }
 *
 * DOM dependencies:
 *   #weapons-evidence-json        — hidden input (JSON payload)
 *   .weapon-type-cb               — weapon type checkboxes (value=status_id, data-code=STATUS_CODE)
 *   #weapon-other-text            — text input shown when the OTHER checkbox is checked
 *   #evidence-recovered           — textarea for recovered evidence description
 *                                   (name="evidence_recovered_bn")
 *
 * Save note: otherWeaponDetail is stored in wpn_details_bn only for the OTHER weapon row.
 *            All other weapon rows have wpn_details_bn = None.
 */
(function () {
  'use strict';

  var hiddenInput = document.getElementById('weapons-evidence-json');
  if (!hiddenInput) return;

  var section = document.getElementById('section-weapons-evidence');
  var otherText = document.getElementById('weapon-other-text');
  var recoveredEl = document.getElementById('evidence-recovered');

  /* Find the DB-driven "Other" checkbox by data-code="OTHER" */
  function getOtherCb() {
    return document.querySelector('.weapon-type-cb[data-code="OTHER"]');
  }

  /* Show/hide the "other" text input based on whether the OTHER checkbox is checked */
  function updateOtherTextVisibility() {
    var otherCb = getOtherCb();
    if (!otherText) return;
    var checked = !!(otherCb && otherCb.checked);
    otherText.style.display = checked ? '' : 'none';
    if (!checked) otherText.value = '';
  }

  function collectWeaponTypeIds() {
    var ids = [];
    var checkboxes = document.querySelectorAll('.weapon-type-cb:checked');
    for (var i = 0; i < checkboxes.length; i++) {
      var id = parseInt(checkboxes[i].value, 10);
      if (id > 0) ids.push(id);
    }
    return ids;
  }

  function collectData() {
    var otherCb = getOtherCb();
    var otherDetail = '';
    if (otherCb && otherCb.checked && otherText) {
      otherDetail = otherText.value.trim();
    }
    return {
      weaponTypeIds: collectWeaponTypeIds(),
      otherWeaponDetail: otherDetail,
      recoveredEvidence: (recoveredEl && recoveredEl.value) || ''
    };
  }

  function syncToHiddenInput() {
    var data = collectData();
    var hasData = data.weaponTypeIds.length > 0 || data.recoveredEvidence.trim();
    hiddenInput.value = hasData ? JSON.stringify(data) : '';
  }

  /* Sync on any input/change within the section */
  if (section) {
    section.addEventListener('change', function (e) {
      if (e.target && e.target.classList.contains('weapon-type-cb')) {
        updateOtherTextVisibility();
      }
      syncToHiddenInput();
    });
    section.addEventListener('input', syncToHiddenInput);
  }

  /* Re-sync right before form submit */
  var form = hiddenInput.closest('form');
  if (form) {
    form.addEventListener('submit', syncToHiddenInput);
  }

  /* Step validator: if OTHER checked, require description */
  var panel = hiddenInput.closest('.step-panel[data-step]');
  if (panel) {
    var step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      var warnings = [];
      var otherCb = getOtherCb();
      if (otherCb && otherCb.checked && otherText && !otherText.value.trim()) {
        warnings.push('"অন্যান্য" অস্ত্রের বিবরণ দিন (Please describe the other weapon)');
      }
      return { warnings: warnings };
    }});
  }

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenInput.value) return;
    var data;
    try { data = JSON.parse(hiddenInput.value); } catch (e) { return; }

    /* Re-check weapon type checkboxes */
    if (data.weaponTypeIds && data.weaponTypeIds.length) {
      var allCbs = document.querySelectorAll('.weapon-type-cb');
      for (var i = 0; i < allCbs.length; i++) {
        var cbId = parseInt(allCbs[i].value, 10);
        if (data.weaponTypeIds.indexOf(cbId) !== -1) {
          allCbs[i].checked = true;
        }
      }
    }

    /* Restore other weapon detail */
    if (otherText && data.otherWeaponDetail) {
      otherText.value = data.otherWeaponDetail;
    }
    updateOtherTextVisibility();

    /* Restore recovered evidence */
    if (recoveredEl && data.recoveredEvidence) {
      recoveredEl.value = data.recoveredEvidence;
    }
  }
  setTimeout(restoreFromSavedData, 100);

  /* Public API for form-clear.js */
  window.newshubCrimeWeapons = {
    reset: function () {
      var checkboxes = document.querySelectorAll('.weapon-type-cb');
      for (var i = 0; i < checkboxes.length; i++) {
        checkboxes[i].checked = false;
      }
      if (otherText) { otherText.value = ''; otherText.style.display = 'none'; }
      if (recoveredEl) recoveredEl.value = '';
      hiddenInput.value = '';
    }
  };
})();
