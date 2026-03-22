/**
 * news-war-conflict-frontline.js
 * Reads frontline fields (territory status, territory description,
 * conflict intensity, weapon class, involvement level) and serializes to
 * #global-frontline-json hidden input on input/change and before form submit.
 *
 * DOM dependencies:
 *   #global-territory-status       — select (populated from territory-statuses-data)
 *   #global-territory-description  — text input
 *   #global-conflict-intensity     — select (populated from conflict-intensity-data, value=status_id)
 *   #global-weapon-class           — select
 *   #global-involvement-level      — select
 *   #global-frontline-json         — hidden JSON input for form submission
 *   #territory-statuses-data       — CSP-safe JSON with territory status list
 *   #involvement-levels-data       — CSP-safe JSON with involvement level list
 *
 * Exposes: window.newshubGlobalFrontline = { reset: fn }
 */
(function () {
  'use strict';

  var territoryStatus = document.getElementById('global-territory-status');
  var territoryDesc = document.getElementById('global-territory-description');
  var intensity = document.getElementById('global-conflict-intensity');
  var weaponClass = document.getElementById('global-weapon-class');
  var involvement = document.getElementById('global-involvement-level');
  var hiddenJson = document.getElementById('global-frontline-json');

  if (!hiddenJson) return;

  /* ========== Populate territory status dropdown from DB data ========== */

  function parseJsonData(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
  }

  var territoryStatuses = parseJsonData('territory-statuses-data');
  var conflictIntensities = parseJsonData('conflict-intensity-data');
  var weaponClasses = parseJsonData('weapon-classes-data');
  var involvementLevels = parseJsonData('involvement-levels-data');

  function populateSelect(selectEl, items) {
    if (!selectEl || !items.length) return;
    for (var i = 0; i < items.length; i++) {
      var s = items[i];
      var opt = document.createElement('option');
      opt.value = s.status_id;
      opt.textContent = (s.status_name_bn || '') + ' (' + (s.status_name_en || '') + ')';
      selectEl.appendChild(opt);
    }
  }

  /* Intensity: stores status_id (FK), shows status_code number in label */
  function populateIntensitySelect(selectEl, items) {
    if (!selectEl || !items.length) return;
    for (var i = 0; i < items.length; i++) {
      var s = items[i];
      var opt = document.createElement('option');
      opt.value = s.status_id;
      opt.textContent = s.status_code + ' — ' + (s.status_name_bn || '') + ' (' + (s.status_name_en || '') + ')';
      selectEl.appendChild(opt);
    }
  }

  populateSelect(territoryStatus, territoryStatuses);
  populateIntensitySelect(intensity, conflictIntensities);
  populateSelect(weaponClass, weaponClasses);
  populateSelect(involvement, involvementLevels);

  function serialize() {
    var data = {
      territoryStatusId: territoryStatus ? (parseInt(territoryStatus.value, 10) || 0) : 0,
      territoryDescription: territoryDesc ? territoryDesc.value.trim() : '',
      conflictIntensityId: intensity ? (parseInt(intensity.value, 10) || 0) : 0,
      weaponClassId: weaponClass ? (parseInt(weaponClass.value, 10) || 0) : 0,
      involvementLevelId: involvement ? (parseInt(involvement.value, 10) || 0) : 0,
    };

    hiddenJson.value = JSON.stringify(data);
  }

  /* Listen for input changes */
  if (territoryDesc) territoryDesc.addEventListener('input', serialize);

  var changeFields = [territoryStatus, intensity, weaponClass, involvement];
  changeFields.forEach(function (el) {
    if (el) el.addEventListener('change', serialize);
  });

  /* Serialize before form submit */
  var form = hiddenJson.closest('form');
  if (form) {
    form.addEventListener('submit', serialize);
  }

  /* ---- Restore UI from saved hidden input JSON ---- */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    try {
      var data = JSON.parse(hiddenJson.value);
      if (territoryStatus && data.territoryStatusId)   territoryStatus.value = data.territoryStatusId;
      if (territoryDesc && data.territoryDescription)   territoryDesc.value   = data.territoryDescription;
      if (intensity && data.conflictIntensityId)        intensity.value       = data.conflictIntensityId;
      if (weaponClass && data.weaponClassId)            weaponClass.value     = data.weaponClassId;
      if (involvement && data.involvementLevelId)       involvement.value     = data.involvementLevelId;
    } catch (e) { /* ignore parse errors */ }
  }

  setTimeout(restoreFromSavedData, 100);

  /* Public API for form-clear */
  window.newshubGlobalFrontline = {
    reset: function () {
      if (territoryStatus) territoryStatus.selectedIndex = 0;
      if (territoryDesc) territoryDesc.value = '';
      if (intensity) intensity.selectedIndex = 0;
      if (weaponClass) weaponClass.selectedIndex = 0;
      if (involvement) involvement.selectedIndex = 0;
      hiddenJson.value = '';
    },
  };
})();
