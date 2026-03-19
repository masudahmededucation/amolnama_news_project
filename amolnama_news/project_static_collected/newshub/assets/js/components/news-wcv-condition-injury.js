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
  var pregnantCb = document.getElementById('wcv-victim-pregnant');
  var pregnantMonthsRow = document.getElementById('wcv-pregnant-months-row');
  var pregnantMonths = document.getElementById('wcv-victim-pregnant-months');
  var childrenCb = document.getElementById('wcv-victim-has-children');
  var childrenCountRow = document.getElementById('wcv-children-count-row');
  var childrenCount = document.getElementById('wcv-victim-children-count');
  var dependentCb = document.getElementById('wcv-victim-dependent');
  var disabilityCb = document.getElementById('wcv-victim-disability');
  var disabilityTypeRow = document.getElementById('wcv-disability-type-row');
  var disabilityType = document.getElementById('wcv-victim-disability-type');

  /* Section B: Injury (DB-driven containers) */
  var injuryTypesContainer = document.getElementById('wcv-injury-types-checkboxes');
  var severityContainer = document.getElementById('wcv-injury-severity-radios');
  var psychSymptomsContainer = document.getElementById('wcv-psych-symptoms-checkboxes');

  /* Section C: Medical, Safety, Consent (DB-driven containers) */
  var conditionContainer = document.getElementById('wcv-condition-radios');
  var safetyContainer = document.getElementById('wcv-safety-radios');
  var consentContainer = document.getElementById('wcv-consent-radios');

  var hiddenJson = document.getElementById('wcv-condition-injury');

  if (!hiddenJson) return;

  /* ========== Parse reference data ========== */

  function parseJsonData(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
  }

  var injuryTypesData = parseJsonData('wcv-injury-types-data');
  var injurySeverityData = parseJsonData('wcv-injury-severity-data');
  var psychSymptomsData = parseJsonData('wcv-psychological-symptoms-data');
  var medicalConditions = parseJsonData('wcv-medical-conditions-data');
  var safetyStatuses = parseJsonData('wcv-safety-statuses-data');
  var consentStatuses = parseJsonData('wcv-consent-statuses-data');

  /* ========== Populate radio groups ========== */

  function populateCheckboxes(container, checkboxName, items) {
    if (!container || !items.length) return;
    for (var i = 0; i < items.length; i++) {
      var s = items[i];
      var label = document.createElement('label');
      label.className = 'checkbox-inline';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.name = checkboxName;
      input.value = s.status_id;
      var text = document.createTextNode(
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
    for (var i = 0; i < items.length; i++) {
      var s = items[i];
      var label = document.createElement('label');
      label.className = 'radio-inline';
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = radioName;
      input.value = s.status_id;
      var text = document.createTextNode(
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
  var injuryTypeCheckboxes = document.querySelectorAll('input[name="wcv_injury_type"]');
  var severityRadios = document.querySelectorAll('input[name="wcv_injury_severity"]');
  var psychSymptoms = document.querySelectorAll('input[name="wcv_psych_symptom"]');
  var conditionRadios = document.querySelectorAll('input[name="wcv_victim_condition"]');
  var safetyRadios = document.querySelectorAll('input[name="wcv_victim_safety"]');
  var consentRadios = document.querySelectorAll('input[name="wcv_victim_consent"]');

  /* ========== Helpers ========== */

  function getRadioValue(radios) {
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked) return parseInt(radios[i].value, 10) || 0;
    }
    return 0;
  }

  function getRadioString(radios) {
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked) return radios[i].value;
    }
    return '';
  }

  function getCheckedIds(checkboxes) {
    var ids = [];
    for (var i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) ids.push(parseInt(checkboxes[i].value, 10));
    }
    return ids;
  }

  function getCheckedStrings(checkboxes) {
    var values = [];
    for (var i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) values.push(checkboxes[i].value);
    }
    return values;
  }

  /* ========== Conditional toggles ========== */

  function togglePregnancy() {
    if (pregnantMonthsRow) pregnantMonthsRow.style.display = pregnantCb && pregnantCb.checked ? '' : 'none';
    if (!pregnantCb || !pregnantCb.checked) {
      if (pregnantMonths) pregnantMonths.value = '';
      var w = document.getElementById('wcv-pregnant-months-warning');
      if (w) w.style.display = 'none';
    }
  }

  function toggleChildren() {
    if (childrenCountRow) childrenCountRow.style.display = childrenCb && childrenCb.checked ? '' : 'none';
    if (!childrenCb || !childrenCb.checked) {
      if (childrenCount) childrenCount.value = '';
      var e = document.getElementById('wcv-children-count-error');
      var w = document.getElementById('wcv-children-count-warning');
      if (e) e.style.display = 'none';
      if (w) w.style.display = 'none';
    }
  }

  function checkChildrenCountWarning() {
    var warning = document.getElementById('wcv-children-count-warning');
    if (!warning) return;
    var count = childrenCount ? parseInt(childrenCount.value, 10) : 0;
    warning.style.display = (childrenCb && childrenCb.checked && count > 4) ? '' : 'none';
  }

  function toggleDisability() {
    if (disabilityTypeRow) disabilityTypeRow.style.display = disabilityCb && disabilityCb.checked ? '' : 'none';
    if (!disabilityCb || !disabilityCb.checked) { if (disabilityType) disabilityType.value = ''; }
  }

  /* ========== Serialize ========== */

  function serialize() {
    var data = {
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
    var val = parseInt(this.value, 10);
    var warning = document.getElementById('wcv-pregnant-months-warning');
    var exceeded = !isNaN(val) && val > 10;
    if (exceeded) this.value = 10;
    if (warning) warning.style.display = exceeded ? '' : 'none';
    serialize();
  });
  if (childrenCount) childrenCount.addEventListener('input', function () {
    var val = parseInt(this.value, 10);
    var error   = document.getElementById('wcv-children-count-error');
    var warning = document.getElementById('wcv-children-count-warning');
    var exceeded = !isNaN(val) && val > 20;
    if (exceeded) {
      this.value = '';
      if (error)   error.style.display   = '';
      if (warning) warning.style.display = 'none';
    } else {
      if (error) error.style.display = 'none';
      checkChildrenCountWarning();
    }
    serialize();
  });
  if (disabilityType) disabilityType.addEventListener('input', serialize);

  /* Section B psych symptoms — change listeners wired by populateCheckboxes */

  /* Serialize before form submit */
  var form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* Initial state */
  togglePregnancy();
  toggleChildren();
  toggleDisability();

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
      for (var i = 0; i < injuryTypeCheckboxes.length; i++) injuryTypeCheckboxes[i].checked = false;
      for (var j = 0; j < severityRadios.length; j++) severityRadios[j].checked = false;
      for (var k = 0; k < psychSymptoms.length; k++) psychSymptoms[k].checked = false;

      /* Section C */
      [conditionRadios, safetyRadios, consentRadios].forEach(function (radios) {
        for (var i = 0; i < radios.length; i++) radios[i].checked = false;
      });

      hiddenJson.value = '';
    }
  };

  /* Step validator: injury type + all radio groups mandatory */
  var panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    var step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      var warnings = [];
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
