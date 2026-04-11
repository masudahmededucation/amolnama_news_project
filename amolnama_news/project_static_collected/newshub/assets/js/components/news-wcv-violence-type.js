/**
 * news-wcv-violence-type.js
 * Reads violence type checkboxes (DB-driven, multi-select), other-type text,
 * location type, recurring flag, and duration; serializes to hidden inputs.
 *
 * DOM dependencies:
 *   #wcv-violence-types-checkboxes — container (populated from wcv-violence-types-data)
 *   #wcv-other-type-row            — conditional row (shown when HAS_OTHER_VIOLENCE checked)
 *   #wcv-other-type                — text input for custom violence type
 *   #wcv-sub-type                  — hidden input (first checked ID, for step validator)
 *   #wcv-location-type             — select (populated from wcv-location-types-data)
 *   #wcv-recurring                 — checkbox
 *   #wcv-duration-row              — conditional row
 *   #wcv-duration                  — text input
 *   #wcv-violence-context          — hidden input for form submission
 *
 * Exposes: window.newshubWcvType = { reset: callback }
 */
(function () {
  'use strict';

  const violenceTypesContainer = document.getElementById('wcv-violence-types-checkboxes');
  const otherTypeRow = document.getElementById('wcv-other-type-row');
  const otherTypeInput = document.getElementById('wcv-other-type');
  const subTypeHidden = document.getElementById('wcv-sub-type');
  const locationType = document.getElementById('wcv-location-type');
  const recurringCb = document.getElementById('wcv-recurring');
  const durationRow = document.getElementById('wcv-duration-row');
  const duration = document.getElementById('wcv-duration');
  const hiddenJson = document.getElementById('wcv-violence-context');

  if (!hiddenJson) return;

  /* ========== Parse reference data ========== */

  function parseJsonData(id) {
    const element = document.getElementById(id);
    if (!element) return [];
    try { return JSON.parse(element.textContent) || []; } catch (e) { return []; }
  }

  const violenceTypesData = parseJsonData('wcv-violence-types-data');
  const locationTypesData = parseJsonData('wcv-location-types-data');

  /* ========== Populate location type select ========== */

  function populateSelect(selectEl, items) {
    if (!selectEl || !items.length) return;
    for (let i = 0; i < items.length; i++) {
      let s = items[i];
      const opt = document.createElement('option');
      opt.value = s.status_id;
      opt.textContent = (s.status_name_bn || '') + ' (' + (s.status_name_en || '') + ')';
      selectEl.appendChild(opt);
    }
  }

  populateSelect(locationType, locationTypesData);

  /* ========== Populate violence type checkboxes ========== */

  function populateCheckboxes(container, items) {
    if (!container || !items.length) return;
    for (let i = 0; i < items.length; i++) {
      const s = items[i];
      const label = document.createElement('label');
      label.className = 'checkbox-inline';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'wcv_violence_type-' + s.status_id;
      input.name = 'wcv_violence_type';
      input.value = s.status_id;
      input.dataset.code = s.status_code || '';
      const text = document.createTextNode(
        ' ' + (s.status_name_bn || '') + ' (' + (s.status_name_en || '') + ')'
      );
      label.appendChild(input);
      label.appendChild(text);
      container.appendChild(label);
      input.addEventListener('change', function () {
        toggleOtherType();
        serialize();
      });
    }
  }

  populateCheckboxes(violenceTypesContainer, violenceTypesData);

  /* Re-query after dynamic population */
  const violenceTypeCheckboxes = document.querySelectorAll('input[name="wcv_violence_type"]');

  /* Find the HAS_OTHER_VIOLENCE checkbox by data-code */
  const otherViolenceCb = violenceTypesContainer
    ? violenceTypesContainer.querySelector('input[data-code="HAS_OTHER_VIOLENCE"]')
    : null;

  /* ========== Helpers ========== */

  function getCheckedIds(checkboxes) {
    let ids = [];
    for (let i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) ids.push(parseInt(checkboxes[i].value, 10));
    }
    return ids;
  }

  /* ========== Conditional toggles ========== */

  function toggleOtherType() {
    let isOther = otherViolenceCb ? otherViolenceCb.checked : false;
    if (otherTypeRow) otherTypeRow.hidden = !isOther;
    if (!isOther && otherTypeInput) otherTypeInput.value = '';
  }

  function toggleDuration() {
    if (durationRow) {
      (recurringCb && durationRow.hidden = !recurringCb.checked);
    }
    if ((!recurringCb || !recurringCb.checked) && duration) duration.value = '';
  }

  /* ========== Serialize ========== */

  function serialize() {
    const ids = getCheckedIds(violenceTypeCheckboxes);
    /* #wcv-sub-type: first checked ID (used by step validator) */
    if (subTypeHidden) subTypeHidden.value = ids.length ? String(ids[0]) : '';
    const isOther = otherViolenceCb ? otherViolenceCb.checked : false;
    let data = {
      violenceTypeIds: ids,
      otherType: isOther && otherTypeInput ? otherTypeInput.value.trim() : '',
      locationTypeId: locationType ? (parseInt(locationType.value, 10) || 0) : 0,
      recurring: recurringCb ? recurringCb.checked : false,
      duration: recurringCb && recurringCb.checked && duration ? duration.value.trim() : ''
    };
    hiddenJson.value = JSON.stringify(data);
  }

  /* ========== Event listeners ========== */

  if (otherTypeInput) otherTypeInput.addEventListener('input', serialize);
  if (locationType) locationType.addEventListener('change', serialize);
  if (recurringCb) {
    recurringCb.addEventListener('change', function () { toggleDuration(); serialize(); });
  }
  if (duration) duration.addEventListener('input', serialize);

  const form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* Initial state */
  toggleOtherType();
  toggleDuration();

  /* ========== Restore from saved data ========== */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    let data;
    try { data = JSON.parse(hiddenJson.value); } catch (e) { return; }
    if (!data || typeof data !== 'object') return;

    /* Violence type checkboxes */
    if (data.violenceTypeIds && data.violenceTypeIds.length) {
      for (let c = 0; c < violenceTypeCheckboxes.length; c++) {
        const val = parseInt(violenceTypeCheckboxes[c].value, 10);
        violenceTypeCheckboxes[c].checked = data.violenceTypeIds.indexOf(val) !== -1;
      }
    }

    /* Other type text */
    if (otherTypeInput && data.otherType) otherTypeInput.value = data.otherType;

    /* Sub-type hidden */
    if (subTypeHidden && data.violenceTypeIds && data.violenceTypeIds.length) {
      subTypeHidden.value = String(data.violenceTypeIds[0]);
    }

    /* Location type select */
    if (locationType && data.locationTypeId) {
      locationType.value = String(data.locationTypeId);
      if (locationType.tomselect) locationType.tomselect.setValue(String(data.locationTypeId), true);
    }

    /* Recurring checkbox */
    if (recurringCb && data.recurring) recurringCb.checked = true;

    /* Duration */
    if (duration && data.duration) duration.value = data.duration;

    toggleOtherType();
    toggleDuration();
  }

  setTimeout(restoreFromSavedData, 100);

  /* ========== Public API ========== */

  window.newshubWcvType = {
    reset: function () {
      for (let i = 0; i < violenceTypeCheckboxes.length; i++) violenceTypeCheckboxes[i].checked = false;
      if (subTypeHidden) subTypeHidden.value = '';
      if (otherTypeInput) otherTypeInput.value = '';
      if (locationType) locationType.selectedIndex = 0;
      if (recurringCb) recurringCb.checked = false;
      if (duration) duration.value = '';
      toggleOtherType();
      toggleDuration();
      hiddenJson.value = '';
    }
  };

  /* Step validator: require at least one violence type selected */
  const panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    const step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, callback: function () {
      const warnings = [];
      if (!getCheckedIds(violenceTypeCheckboxes).length) {
        warnings.push('সহিংসতার ধরন নির্বাচন করুন (Please select at least one violence type)');
      }
      if (otherViolenceCb && otherViolenceCb.checked && otherTypeInput && !otherTypeInput.value.trim()) {
        warnings.push('সহিংসতার ধরন বিস্তারিত লিখুন (Please describe the type of violence)');
      }
      if (!locationType || !parseInt(locationType.value, 10)) {
        warnings.push('ঘটনাস্থলের ধরন নির্বাচন করুন (Please select incident location type)');
      }
      return { warnings: warnings };
    }});
  }
})();
