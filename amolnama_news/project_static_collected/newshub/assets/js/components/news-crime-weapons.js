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
 *   .weapon-type-callback               — weapon type checkboxes (value=status_id, data-code=STATUS_CODE)
 *   #weapon-other-text            — text input shown when the OTHER checkbox is checked
 *   #evidence-recovered           — textarea for recovered evidence description
 *                                   (name="evidence_recovered_bn")
 *
 * Save note: otherWeaponDetail is stored in wpn_details_bn only for the OTHER weapon row.
 *            All other weapon rows have wpn_details_bn = None.
 */
(function () {
  'use strict';

  const hiddenInput = document.getElementById('weapons-evidence-json');
  if (!hiddenInput) return;

  const section = document.getElementById('section-weapons-evidence');
  const otherText = document.getElementById('weapon-other-text');
  const recoveredEl = document.getElementById('evidence-recovered');

  /* Find the DB-driven "Other" checkbox by data-code="OTHER" */
  function getOtherCb() {
    return document.querySelector('.weapon-type-callback[data-code="OTHER"]');
  }

  /* Show/hide the "other" text input based on whether the OTHER checkbox is checked */
  function updateOtherTextVisibility() {
    let otherCb = getOtherCb();
    if (!otherText) return;
    const checked = !!(otherCb && otherCb.checked);
    otherText.hidden = !checked;
    if (!checked) otherText.value = '';
  }

  function collectWeaponTypeIds() {
    const ids = [];
    let checkboxes = document.querySelectorAll('.weapon-type-callback:checked');
    for (let i = 0; i < checkboxes.length; i++) {
      const id = parseInt(checkboxes[i].value, 10);
      if (id > 0) ids.push(id);
    }
    return ids;
  }

  function collectData() {
    let otherCb = getOtherCb();
    let otherDetail = '';
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
    let data = collectData();
    const hasData = data.weaponTypeIds.length > 0 || data.recoveredEvidence.trim();
    hiddenInput.value = hasData ? JSON.stringify(data) : '';
  }

  /* Sync on any input/change within the section */
  if (section) {
    section.addEventListener('change', function (e) {
      if (e.target && e.target.classList.contains('weapon-type-callback')) {
        updateOtherTextVisibility();
      }
      syncToHiddenInput();
    });
    section.addEventListener('input', syncToHiddenInput);
  }

  /* Re-sync right before form submit */
  const form = hiddenInput.closest('form');
  if (form) {
    form.addEventListener('submit', syncToHiddenInput);
  }

  /* Step validator: if OTHER checked, require description */
  const panel = hiddenInput.closest('.step-panel[data-step]');
  if (panel) {
    const step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      const warnings = [];
      const otherCb = getOtherCb();
      if (otherCb && otherCb.checked && otherText && !otherText.value.trim()) {
        warnings.push('"অন্যান্য" অস্ত্রের বিবরণ দিন (Please describe the other weapon)');
      }
      return { warnings: warnings };
    }});
  }

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenInput.value) return;
    let data;
    try { data = JSON.parse(hiddenInput.value); } catch (e) { return; }

    /* Re-check weapon type checkboxes */
    if (data.weaponTypeIds && data.weaponTypeIds.length) {
      const allCbs = document.querySelectorAll('.weapon-type-callback');
      for (let i = 0; i < allCbs.length; i++) {
        const cbId = parseInt(allCbs[i].value, 10);
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
      const checkboxes = document.querySelectorAll('.weapon-type-callback');
      for (let i = 0; i < checkboxes.length; i++) {
        checkboxes[i].checked = false;
      }
      if (otherText) { otherText.value = ''; otherText.hidden = true; }
      if (recoveredEl) recoveredEl.value = '';
      hiddenInput.value = '';
    }
  };
})();
