/**
 * news-land-grab-legal.js
 * Land Grabbing — Legal Action & Support (form-specific module).
 * Builds form-specific checkboxes/select and serializes all legal data to #land-legal.
 * GD/FIR state managed by shared news-law-gd-fir.js factory (prefix="legal").
 *
 * DOM dependencies (form-specific, in section#section-land-legal):
 *   #land-legal                       — hidden JSON input for form submission
 *   #land-applicable-law-checkboxes   — container (populated from #land-applicable-law-data)
 *   #land-case-status                 — select (populated from #land-case-status-data)
 *   #land-support-service-checkboxes  — container (populated from #land-support-service-data)
 *   #land-retaliation-checkboxes      — container (populated from #land-retaliation-data)
 *   #land-remarks                     — textarea
 *
 * Shared GD/FIR DOM (from law-gd-fir-section.html, managed by news-law-gd-fir.js):
 *   #legal-fir-status-radios, #legal-police-station, #legal-case-number,
 *   #legal-police-refusal-statement, #legal-no-fir-reason
 *
 * Serializes to:
 *   { firStatusId, policeStation, caseNumber, policeRefusalStatement, noFirReason,
 *     applicableLawIds, caseStatusId, supportServiceIds, retaliationIds, remarks }
 *
 * Exposes: window.newshubLandGrabLegal = { reset: fn }
 */
(function () {
  'use strict';

  var hiddenJson = document.getElementById('land-legal');
  if (!hiddenJson) return;

  /* ========== DOM references ========== */

  var lawContainer         = document.getElementById('land-applicable-law-checkboxes');
  var caseStatus           = document.getElementById('land-case-status');
  var supportContainer     = document.getElementById('land-support-service-checkboxes');
  var retaliationContainer = document.getElementById('land-retaliation-checkboxes');
  var remarks              = document.getElementById('land-remarks');

  /* ========== Init shared GD/FIR module ========== */

  var firApi = null;
  if (window.newshubLawGdFir) {
    firApi = window.newshubLawGdFir.initLawGdFirSection({
      prefix: 'legal',
      onChange: function () { serialize(); }
    });
  }

  /* ========== Parse reference data ========== */

  function parseJsonData(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
  }

  var lawData         = parseJsonData('land-applicable-law-data');
  var caseStatusData  = parseJsonData('land-case-status-data');
  var supportData     = parseJsonData('land-support-service-data');
  var retaliationData = parseJsonData('land-retaliation-data');

  /* ========== Populate helpers ========== */

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
      input.id = checkboxName + '-' + s.status_id;
      label.appendChild(input);
      label.appendChild(document.createTextNode(
        ' ' + (s.status_name_bn || '') + ' (' + (s.status_name_en || '') + ')'
      ));
      container.appendChild(label);
      input.addEventListener('change', serialize);
    }
  }

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

  populateCheckboxes(lawContainer,         'land_applicable_law',  lawData);
  populateSelect(caseStatus, caseStatusData);
  populateCheckboxes(supportContainer,     'land_support_service', supportData);
  populateCheckboxes(retaliationContainer, 'land_retaliation',     retaliationData);

  /* Re-query after dynamic population */
  var lawCheckboxes         = document.querySelectorAll('input[name="land_applicable_law"]');
  var supportCheckboxes     = document.querySelectorAll('input[name="land_support_service"]');
  var retaliationCheckboxes = document.querySelectorAll('input[name="land_retaliation"]');

  /* ========== Helpers ========== */

  function getCheckedIds(checkboxes) {
    var ids = [];
    for (var i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) ids.push(parseInt(checkboxes[i].value, 10));
    }
    return ids;
  }

  /* ========== Serialize ========== */

  function serialize() {
    var data = {
      firStatusId:            firApi ? firApi.getFirStatusId()            : 0,
      policeStation:          firApi ? firApi.getPoliceStation()          : '',
      caseNumber:             firApi ? firApi.getCaseNumber()             : '',
      policeRefusalStatement: firApi ? firApi.getPoliceRefusalStatement() : '',
      noFirReason:            firApi ? firApi.getNoFirReason()            : '',
      applicableLawIds:       getCheckedIds(lawCheckboxes),
      caseStatusId:           caseStatus ? (parseInt(caseStatus.value, 10) || 0) : 0,
      supportServiceIds:      getCheckedIds(supportCheckboxes),
      retaliationIds:         getCheckedIds(retaliationCheckboxes),
      remarks:                remarks ? remarks.value.trim() : ''
    };
    hiddenJson.value = JSON.stringify(data);
  }

  /* ========== Event listeners ========== */

  if (caseStatus) caseStatus.addEventListener('change', serialize);
  if (remarks)    remarks.addEventListener('input', serialize);

  var form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* Initial state — skip if persist already restored a value */
  if (!hiddenJson.value) serialize();

  /* ========== Step validator ========== */

  var panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    var step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      var warnings = [];
      if (!firApi || !firApi.getFirStatusId()) {
        warnings.push('এফআইআর/জিডি অবস্থা নির্বাচন করুন (Please select FIR/GD status)');
      }
      if (firApi && firApi.isFirYes() && !firApi.getPoliceStation()) {
        warnings.push('থানার নাম দিন (Please enter police station name)');
      }
      return { warnings: warnings };
    }});
  }

  /* ========== Restore from saved data ========== */

  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    var saved;
    try { saved = JSON.parse(hiddenJson.value); } catch (e) { return; }
    if (!saved) return;

    if (saved.firStatusId) {
      var firRadio = document.querySelector('input[name="legal_fir_status"][value="' + saved.firStatusId + '"]');
      if (firRadio) {
        firRadio.checked = true;
        firRadio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    if (saved.applicableLawIds && saved.applicableLawIds.length) {
      for (var i = 0; i < lawCheckboxes.length; i++) {
        if (saved.applicableLawIds.indexOf(parseInt(lawCheckboxes[i].value, 10)) !== -1) {
          lawCheckboxes[i].checked = true;
        }
      }
    }

    if (saved.caseStatusId && caseStatus) {
      caseStatus.value = saved.caseStatusId;
    }

    if (saved.supportServiceIds && saved.supportServiceIds.length) {
      for (var j = 0; j < supportCheckboxes.length; j++) {
        if (saved.supportServiceIds.indexOf(parseInt(supportCheckboxes[j].value, 10)) !== -1) {
          supportCheckboxes[j].checked = true;
        }
      }
    }

    if (saved.retaliationIds && saved.retaliationIds.length) {
      for (var k = 0; k < retaliationCheckboxes.length; k++) {
        if (saved.retaliationIds.indexOf(parseInt(retaliationCheckboxes[k].value, 10)) !== -1) {
          retaliationCheckboxes[k].checked = true;
        }
      }
    }

    if (saved.remarks && remarks) {
      remarks.value = saved.remarks;
    }
  }

  setTimeout(restoreFromSavedData, 100);

  /* ========== Public API ========== */

  window.newshubLandGrabLegal = {
    reset: function () {
      for (var i = 0; i < lawCheckboxes.length; i++)         lawCheckboxes[i].checked         = false;
      for (var j = 0; j < supportCheckboxes.length; j++)     supportCheckboxes[j].checked     = false;
      for (var k = 0; k < retaliationCheckboxes.length; k++) retaliationCheckboxes[k].checked = false;
      if (caseStatus) caseStatus.selectedIndex = 0;
      if (remarks)    remarks.value = '';
      if (firApi) firApi.resetFir();
      hiddenJson.value = '';
    }
  };

})();
