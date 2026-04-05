/**
 * news-civic-impact-duration.js
 * Reads civic impact & duration fields and serializes to
 * #civic-impact-json hidden input on input/change and before form submit.
 * Populates impact type and duration unit selects from DB-driven JSON.
 *
 * DOM dependencies:
 *   #civic-people-affected        — number input
 *   #civic-impact-type            — select (populated from #impact-categories-data)
 *   #civic-duration-value         — number input
 *   #civic-duration-unit          — select (populated from #duration-units-data)
 *   #civic-previous-complaint     — checkbox
 *   #civic-complaint-details      — textarea (shown/hidden by checkbox)
 *   #civic-budget-info            — textarea
 *   #civic-impact-json            — hidden JSON input for form submission
 *   #impact-categories-data       — CSP-safe JSON with impact categories
 *   #duration-units-data          — CSP-safe JSON with duration units
 *
 * Exposes: window.newshubCivicImpact = { reset: fn }
 */
(function () {
  'use strict';

  const peopleAffected = document.getElementById('civic-people-affected');
  const impactType = document.getElementById('civic-impact-type');
  const durationValue = document.getElementById('civic-duration-value');
  const durationUnit = document.getElementById('civic-duration-unit');
  const prevComplaint = document.getElementById('civic-previous-complaint');
  const complaintDetails = document.getElementById('civic-complaint-details');
  const complaintRow = document.getElementById('civic-complaint-details-row');
  const budgetInfo = document.getElementById('civic-budget-info');
  const hiddenJson = document.getElementById('civic-impact-json');

  if (!hiddenJson) return;

  /* ---- Parse JSON helper ---- */
  function parseJsonData(id) {
    const el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; }
    catch (e) { return []; }
  }

  /* ---- Populate impact type select from DB ---- */
  const impactCategories = parseJsonData('impact-categories-data');
  if (impactType && impactCategories.length) {
    impactCategories.forEach(function (cat) {
      let opt = document.createElement('option');
      opt.value = cat.status_id;
      opt.textContent = cat.status_name_bn + ' (' + cat.status_name_en + ')';
      impactType.appendChild(opt);
    });
  }

  /* ---- Populate duration unit select from DB ---- */
  const durationUnits = parseJsonData('duration-units-data');
  if (durationUnit && durationUnits.length) {
    durationUnits.forEach(function (unit) {
      const opt = document.createElement('option');
      opt.value = unit.status_id;
      opt.textContent = unit.status_name_bn + ' (' + unit.status_name_en + ')';
      durationUnit.appendChild(opt);
    });
  }

  /* Toggle complaint details row visibility */
  function toggleComplaintRow() {
    if (!prevComplaint || !complaintRow) return;
    prevComplaint.checked ? complaintRow.classList.remove('display-hidden') : complaintRow.classList.add('display-hidden');
    if (!prevComplaint.checked && complaintDetails) {
      complaintDetails.value = '';
    }
  }

  function serialize() {
    let data = {
      peopleAffected: peopleAffected ? (parseInt(peopleAffected.value, 10) || 0) : 0,
      impactCategoryId: impactType ? (parseInt(impactType.value, 10) || 0) : 0,
      durationValue: durationValue ? (parseInt(durationValue.value, 10) || 0) : 0,
      durationUnitId: durationUnit ? (parseInt(durationUnit.value, 10) || 0) : 0,
      previousComplaint: prevComplaint ? prevComplaint.checked : false,
      complaintDetails: complaintDetails ? complaintDetails.value.trim() : '',
      budgetInfo: budgetInfo ? budgetInfo.value.trim() : '',
    };

    hiddenJson.value = JSON.stringify(data);
  }

  /* Listen for input changes on all fields */
  const inputFields = [peopleAffected, durationValue, complaintDetails, budgetInfo];
  inputFields.forEach(function (el) {
    if (el) el.addEventListener('input', serialize);
  });

  const changeFields = [impactType, durationUnit];
  changeFields.forEach(function (el) {
    if (el) el.addEventListener('change', serialize);
  });

  /* Checkbox: toggle + serialize */
  if (prevComplaint) {
    prevComplaint.addEventListener('change', function () {
      toggleComplaintRow();
      serialize();
    });
  }

  /* Serialize before form submit */
  const form = hiddenJson.closest('form');
  if (form) {
    form.addEventListener('submit', serialize);
  }

  /* Initial state */
  toggleComplaintRow();

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    let data;
    try { data = JSON.parse(hiddenJson.value); } catch (e) { return; }

    if (peopleAffected && data.peopleAffected)     peopleAffected.value = data.peopleAffected;
    if (impactType && data.impactCategoryId)        impactType.value     = data.impactCategoryId;
    if (durationValue && data.durationValue)        durationValue.value  = data.durationValue;
    if (durationUnit && data.durationUnitId)        durationUnit.value   = data.durationUnitId;
    if (prevComplaint)                              prevComplaint.checked = !!data.previousComplaint;
    if (complaintDetails && data.complaintDetails)  complaintDetails.value = data.complaintDetails;
    if (budgetInfo && data.budgetInfo)              budgetInfo.value     = data.budgetInfo;
    toggleComplaintRow();
  }
  setTimeout(restoreFromSavedData, 100);

  /* Public API for form-clear */
  window.newshubCivicImpact = {
    reset: function () {
      if (peopleAffected) peopleAffected.value = '';
      if (impactType) impactType.selectedIndex = 0;
      if (durationValue) durationValue.value = '';
      if (durationUnit) durationUnit.selectedIndex = 0;
      if (prevComplaint) prevComplaint.checked = false;
      if (complaintDetails) complaintDetails.value = '';
      if (budgetInfo) budgetInfo.value = '';
      toggleComplaintRow();
      hiddenJson.value = '';
    },
  };
})();
