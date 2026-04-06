/**
 * news-wcv-condition-injury.js
 * Merged module for WCV Step 5 — Victim Condition & Injury.
 * Combines:
 *   A) Condition attributes (pregnancy, children, dependence, disability)
 *   B) Injury types, severity, psychological symptoms
 *   C) Medical condition, safety status, consent (DB-driven radios)
 *
 * Serializes all data to #wcv-condition-injury-json.
 *
 * DOM dependencies:
 *   #wcv-condition-injury-json     — hidden JSON input for form submission
 *   #wcv-condition-radios          — container (populated from wcv-medical-conditions-data)
 *   #wcv-safety-radios             — container (populated from wcv-safety-statuses-data)
 *   #wcv-consent-radios            — container (populated from wcv-consent-statuses-data)
 *
 * Exposes: window.newshubWcvConditionInjury = { reset: fn }
 */
(function () {
  'use strict';

  /* ========== DOM references ========== */

  /* Section A: Condition attributes */
  const pregnantCb = document.getElementById('wcv-victim-pregnant');
  const pregnantMonthsRow = document.getElementById('wcv-pregnant-months-row');
  const pregnantMonths = document.getElementById('wcv-victim-pregnant-months');
  const childrenCb = document.getElementById('wcv-victim-has-children');
  const childrenCountRow = document.getElementById('wcv-children-count-row');
  const childrenCount = document.getElementById('wcv-victim-children-count');
  const dependentCb = document.getElementById('wcv-victim-dependent');
  const disabilityCb = document.getElementById('wcv-victim-disability');
  const disabilityTypeRow = document.getElementById('wcv-disability-type-row');
  const disabilityType = document.getElementById('wcv-victim-disability-type');

  /* Section B: Injury (DB-driven containers) */
  const injuryTypesContainer = document.getElementById('wcv-injury-types-checkboxes');
  const severityContainer = document.getElementById('wcv-injury-severity-radios');
  const psychSymptomsContainer = document.getElementById('wcv-psych-symptoms-checkboxes');

  /* Section C: Medical, Safety, Consent (DB-driven containers) */
  const conditionContainer = document.getElementById('wcv-condition-radios');
  const safetyContainer = document.getElementById('wcv-safety-radios');
  const consentContainer = document.getElementById('wcv-consent-radios');

  const hiddenJson = document.getElementById('wcv-condition-injury');

  if (!hiddenJson) return;

  /* ========== Parse reference data ========== */

  function parseJsonData(id) {
    const el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
  }

  const injuryTypesData = parseJsonData('wcv-injury-types-data');
  const injurySeverityData = parseJsonData('wcv-injury-severity-data');
  const psychSymptomsData = parseJsonData('wcv-psychological-symptoms-data');
  const medicalConditions = parseJsonData('wcv-medical-conditions-data');
  const safetyStatuses = parseJsonData('wcv-safety-statuses-data');
  const consentStatuses = parseJsonData('wcv-consent-statuses-data');

  /* ========== Populate radio groups ========== */

  function populateCheckboxes(container, checkboxName, items) {
    if (!container || !items.length) return;
    for (let i = 0; i < items.length; i++) {
      let s = items[i];
      let label = document.createElement('label');
      label.className = 'checkbox-inline';
      let input = document.createElement('input');
      input.type = 'checkbox';
      input.id = checkboxName + '-' + s.status_id;
      input.name = checkboxName;
      input.value = s.status_id;
      let text = document.createTextNode(
        ' ' + (s.status_name_bn || '') + ' (' + (s.status_name_en || '') + ')'
      );
      label.appendChild(input);
      label.appendChild(text);
      container.appendChild(label);
      input.addEventListener('change', serialize);
    }
  }

  function populateRadios(container, radioName, items) {
    if (!container || !items.length) return;
    for (let i = 0; i < items.length; i++) {
      let s = items[i];
      const label = document.createElement('label');
      label.className = 'radio-inline';
      const input = document.createElement('input');
      input.type = 'radio';
      input.id = radioName + '-' + s.status_id;
      input.name = radioName;
      input.value = s.status_id;
      const text = document.createTextNode(
        ' ' + (s.status_name_bn || '') + ' (' + (s.status_name_en || '') + ')'
      );
      label.appendChild(input);
      label.appendChild(text);
      container.appendChild(label);
      input.addEventListener('change', serialize);
    }
  }

  /* Section B: Injury types + severity + psych symptoms (DB-driven) */
  populateCheckboxes(injuryTypesContainer, 'wcv_injury_type', injuryTypesData);
  populateRadios(severityContainer, 'wcv_injury_severity', injurySeverityData);
  populateCheckboxes(psychSymptomsContainer, 'wcv_psych_symptom', psychSymptomsData);

  /* Section C: Medical, Safety, Consent */
  populateRadios(conditionContainer, 'wcv_victim_condition', medicalConditions);
  populateRadios(safetyContainer, 'wcv_victim_safety', safetyStatuses);
  populateRadios(consentContainer, 'wcv_victim_consent', consentStatuses);

  /* Re-query after dynamic population */
  const injuryTypeCheckboxes = document.querySelectorAll('input[name="wcv_injury_type"]');
  const severityRadios = document.querySelectorAll('input[name="wcv_injury_severity"]');
  const psychSymptoms = document.querySelectorAll('input[name="wcv_psych_symptom"]');
  const conditionRadios = document.querySelectorAll('input[name="wcv_victim_condition"]');
  const safetyRadios = document.querySelectorAll('input[name="wcv_victim_safety"]');
  const consentRadios = document.querySelectorAll('input[name="wcv_victim_consent"]');

  /* ========== Helpers ========== */

  function getRadioValue(radios) {
    for (let i = 0; i < radios.length; i++) {
      if (radios[i].checked) return parseInt(radios[i].value, 10) || 0;
    }
    return 0;
  }

  function getRadioString(radios) {
    for (let i = 0; i < radios.length; i++) {
      if (radios[i].checked) return radios[i].value;
    }
    return '';
  }

  function getCheckedIds(checkboxes) {
    const ids = [];
    for (let i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) ids.push(parseInt(checkboxes[i].value, 10));
    }
    return ids;
  }

  function getCheckedStrings(checkboxes) {
    const values = [];
    for (let i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) values.push(checkboxes[i].value);
    }
    return values;
  }

  /* ========== Conditional toggles ========== */

  function togglePregnancy() {
    if (pregnantMonthsRow) (pregnantCb && pregnantMonthsRow.hidden = !pregnantCb.checked);
    if (!pregnantCb || !pregnantCb.checked) {
      if (pregnantMonths) pregnantMonths.value = '';
      let w = document.getElementById('wcv-pregnant-months-warning');
      if (w) w.hidden = true;
    }
  }

  function toggleChildren() {
    if (childrenCountRow) (childrenCb && childrenCountRow.hidden = !childrenCb.checked);
    if (!childrenCb || !childrenCb.checked) {
      if (childrenCount) childrenCount.value = '';
      const e = document.getElementById('wcv-children-count-error');
      const w = document.getElementById('wcv-children-count-warning');
      if (e) e.hidden = true;
      if (w) w.hidden = true;
    }
  }

  function checkChildrenCountWarning() {
    let warning = document.getElementById('wcv-children-count-warning');
    if (!warning) return;
    const count = childrenCount ? parseInt(childrenCount.value, 10) : 0;
    (childrenCb && childrenCb.checked && count > warning.hidden = !4);
  }

  function toggleDisability() {
    if (disabilityTypeRow) (disabilityCb && disabilityTypeRow.hidden = !disabilityCb.checked);
    if (!disabilityCb || !disabilityCb.checked) { if (disabilityType) disabilityType.value = ''; }
  }

  /* ========== Serialize ========== */

  function serialize() {
    let data = {
      /* Section A: Condition attributes */
      pregnant: pregnantCb ? pregnantCb.checked : false,
      pregnantMonths: pregnantCb && pregnantCb.checked && pregnantMonths
        ? (parseInt(pregnantMonths.value, 10) || 0) : 0,
      hasChildren: childrenCb ? childrenCb.checked : false,
      childrenCount: childrenCb && childrenCb.checked && childrenCount
        ? (parseInt(childrenCount.value, 10) || 0) : 0,
      dependent: dependentCb ? dependentCb.checked : false,
      disability: disabilityCb ? disabilityCb.checked : false,
      disabilityType: disabilityCb && disabilityCb.checked && disabilityType
        ? disabilityType.value.trim() : '',

      /* Section B: Injury (integer IDs for DB storage) */
      injuryTypeIds: getCheckedIds(injuryTypeCheckboxes),
      severityId: getRadioValue(severityRadios),
      psychSymptoms: getCheckedIds(psychSymptoms),

      /* Section C: Medical, Safety, Consent (integer IDs) */
      conditionId: getRadioValue(conditionRadios),
      safetyStatusId: getRadioValue(safetyRadios),
      consentId: getRadioValue(consentRadios),
    };
    hiddenJson.value = JSON.stringify(data);
  }

  /* ========== Event listeners ========== */

  /* Section A toggles */
  if (pregnantCb) pregnantCb.addEventListener('change', function () { togglePregnancy(); serialize(); });
  if (childrenCb) childrenCb.addEventListener('change', function () { toggleChildren(); serialize(); });
  if (disabilityCb) disabilityCb.addEventListener('change', function () { toggleDisability(); serialize(); });
  if (dependentCb) dependentCb.addEventListener('change', serialize);

  if (pregnantMonths) pregnantMonths.addEventListener('input', function () {
    let val = parseInt(this.value, 10);
    let warning = document.getElementById('wcv-pregnant-months-warning');
    let exceeded = !isNaN(val) && val > 10;
    if (exceeded) this.value = 10;
    if (warning) warning.hidden = !exceeded;
    serialize();
  });
  if (childrenCount) childrenCount.addEventListener('input', function () {
    let val = parseInt(this.value, 10);
    const error   = document.getElementById('wcv-children-count-error');
    const warning = document.getElementById('wcv-children-count-warning');
    const exceeded = !isNaN(val) && val > 20;
    if (exceeded) {
      this.value = '';
      if (error)   error.hidden = false;
      if (warning) warning.hidden = true;
    } else {
      if (error) error.hidden = true;
      checkChildrenCountWarning();
    }
    serialize();
  });
  if (disabilityType) disabilityType.addEventListener('input', serialize);

  /* Section B psych symptoms — change listeners wired by populateCheckboxes */

  /* Serialize before form submit */
  const form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* Initial state */
  togglePregnancy();
  toggleChildren();
  toggleDisability();

  /* ========== Restore from saved data ========== */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    let data;
    try { data = JSON.parse(hiddenJson.value); } catch (e) { return; }
    if (!data || typeof data !== 'object') return;

    /* Section A: Condition attributes */
    if (pregnantCb && data.pregnant) pregnantCb.checked = true;
    if (pregnantMonths && data.pregnantMonths) pregnantMonths.value = data.pregnantMonths;
    if (childrenCb && data.hasChildren) childrenCb.checked = true;
    if (childrenCount && data.childrenCount) childrenCount.value = data.childrenCount;
    if (dependentCb && data.dependent) dependentCb.checked = true;
    if (disabilityCb && data.disability) disabilityCb.checked = true;
    if (disabilityType && data.disabilityType) disabilityType.value = data.disabilityType;

    togglePregnancy();
    toggleChildren();
    toggleDisability();

    /* Section B: Injury types (checkboxes) */
    if (data.injuryTypeIds && data.injuryTypeIds.length) {
      for (let i = 0; i < injuryTypeCheckboxes.length; i++) {
        const val = parseInt(injuryTypeCheckboxes[i].value, 10);
        injuryTypeCheckboxes[i].checked = data.injuryTypeIds.indexOf(val) !== -1;
      }
    }

    /* Severity radio */
    if (data.severityId) {
      for (let s = 0; s < severityRadios.length; s++) {
        severityRadios[s].checked = (parseInt(severityRadios[s].value, 10) === data.severityId);
      }
    }

    /* Psych symptoms (checkboxes) */
    if (data.psychSymptoms && data.psychSymptoms.length) {
      for (let p = 0; p < psychSymptoms.length; p++) {
        const pVal = parseInt(psychSymptoms[p].value, 10);
        psychSymptoms[p].checked = data.psychSymptoms.indexOf(pVal) !== -1;
      }
    }

    /* Section C: Medical, Safety, Consent (radios) */
    if (data.conditionId) {
      for (let ci = 0; ci < conditionRadios.length; ci++) {
        conditionRadios[ci].checked = (parseInt(conditionRadios[ci].value, 10) === data.conditionId);
      }
    }
    if (data.safetyStatusId) {
      for (let si = 0; si < safetyRadios.length; si++) {
        safetyRadios[si].checked = (parseInt(safetyRadios[si].value, 10) === data.safetyStatusId);
      }
    }
    if (data.consentId) {
      for (let cn = 0; cn < consentRadios.length; cn++) {
        consentRadios[cn].checked = (parseInt(consentRadios[cn].value, 10) === data.consentId);
      }
    }
  }

  setTimeout(restoreFromSavedData, 100);

  /* ========== Public API ========== */

  window.newshubWcvConditionInjury = {
    reset: function () {
      /* Section A */
      [pregnantCb, childrenCb, dependentCb, disabilityCb].forEach(function (cb) {
        if (cb) cb.checked = false;
      });
      [pregnantMonths, childrenCount, disabilityType].forEach(function (el) {
        if (el) el.value = '';
      });
      togglePregnancy();
      toggleChildren();
      toggleDisability();

      /* Section B */
      for (let i = 0; i < injuryTypeCheckboxes.length; i++) injuryTypeCheckboxes[i].checked = false;
      for (let j = 0; j < severityRadios.length; j++) severityRadios[j].checked = false;
      for (let k = 0; k < psychSymptoms.length; k++) psychSymptoms[k].checked = false;

      /* Section C */
      [conditionRadios, safetyRadios, consentRadios].forEach(function (radios) {
        for (let i = 0; i < radios.length; i++) radios[i].checked = false;
      });

      hiddenJson.value = '';
    }
  };

  /* Step validator: injury type + all radio groups mandatory */
  const panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    const step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      const warnings = [];
      if (!getCheckedIds(injuryTypeCheckboxes).length) {
        warnings.push('আঘাতের ধরন নির্বাচন করুন (Please select at least one injury type)');
      }
      if (!getRadioValue(severityRadios)) {
        warnings.push('আঘাতের তীব্রতা নির্বাচন করুন (Please select injury severity)');
      }
      if (!getRadioValue(conditionRadios)) {
        warnings.push('ভুক্তভোগীর বর্তমান অবস্থা নির্বাচন করুন (Please select victim current condition)');
      }
      if (!getRadioValue(safetyRadios)) {
        warnings.push('নিরাপত্তা অবস্থা নির্বাচন করুন (Please select safety status)');
      }
      if (!getRadioValue(consentRadios)) {
        warnings.push('তথ্য প্রকাশে সম্মতি নির্বাচন করুন (Please select consent status)');
      }
      return { warnings: warnings };
    }});
  }
})();
