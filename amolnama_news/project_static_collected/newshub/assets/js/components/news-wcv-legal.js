/**
 * news-wcv-legal.js
 * Women & Child Violence — Legal Action & Support (form-specific module).
 * Builds form-specific checkboxes/select and serializes all legal data to #wcv-legal.
 * GD/FIR state managed by shared news-law-gd-fir.js factory (prefix="wcv").
 *
 * DOM dependencies (form-specific, in section#section-wcv-legal):
 *   #wcv-legal                      — hidden JSON input for form submission
 *   #wcv-applicable-law-checkboxes  — container (populated from #wcv-applicable-law-data)
 *   #wcv-case-status                — select (populated from #wcv-case-status-data)
 *   #wcv-support-service-checkboxes — container (populated from #wcv-support-service-data)
 *   #wcv-retaliation-checkboxes     — container (populated from #wcv-retaliation-data)
 *   #wcv-legal-remarks              — textarea
 *
 * Shared GD/FIR DOM (from law-gd-fir-section.html, managed by news-law-gd-fir.js):
 *   #wcv-fir-status-radios, #wcv-police-station, #wcv-case-number,
 *   #wcv-police-refusal-statement, #wcv-no-fir-reason
 *
 * Serializes to:
 *   { firStatusId, policeStation, caseNumber, policeRefusalStatement, noFirReason,
 *     applicableLawIds, caseStatusId, supportServiceIds, retaliationIds, remarks }
 *
 * Exposes: window.newshubWcvLegal = { reset: fn }
 */
(function () {
  'use strict';

  var hiddenJson = document.getElementById('wcv-legal');
  if (!hiddenJson) return;

  /* ========== DOM references ========== */

  var applicableLawContainer = document.getElementById('wcv-applicable-law-checkboxes');
  var caseStatus             = document.getElementById('wcv-case-status');
  var supportServiceContainer = document.getElementById('wcv-support-service-checkboxes');
  var retaliationContainer   = document.getElementById('wcv-retaliation-checkboxes');
  var legalRemarks           = document.getElementById('wcv-legal-remarks');

  /* ========== Init shared GD/FIR module ========== */

  var firApi = null;
  if (window.newshubLawGdFir) {
    firApi = window.newshubLawGdFir.initLawGdFirSection({
      prefix: 'wcv',
      onChange: function () { serialize(); }
    });
  }

  /* ========== Parse reference data ========== */

  function parseJsonData(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
  }

  var applicableLawData = parseJsonData('wcv-applicable-law-data');
  var caseStatusData    = parseJsonData('wcv-case-status-data');
  var supportServiceData = parseJsonData('wcv-support-service-data');
  var retaliationData   = parseJsonData('wcv-retaliation-data');

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
      var text = document.createTextNode(
        ' ' + (s.status_name_bn || '') + ' (' + (s.status_name_en || '') + ')'
      );
      label.appendChild(input);
      label.appendChild(text);
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

  populateCheckboxes(applicableLawContainer, 'wcv_applicable_law', applicableLawData);
  populateSelect(caseStatus, caseStatusData);
  populateCheckboxes(supportServiceContainer, 'wcv_support_service', supportServiceData);
  populateCheckboxes(retaliationContainer, 'wcv_retaliation', retaliationData);

  /* Re-query after dynamic population */
  var lawCheckboxes         = document.querySelectorAll('input[name="wcv_applicable_law"]');
  var supportCheckboxes     = document.querySelectorAll('input[name="wcv_support_service"]');
  var retaliationCheckboxes = document.querySelectorAll('input[name="wcv_retaliation"]');

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
      remarks:                legalRemarks ? legalRemarks.value.trim() : ''
    };
    hiddenJson.value = JSON.stringify(data);
  }

  /* ========== Event listeners ========== */

  if (caseStatus)    caseStatus.addEventListener('change', serialize);
  if (legalRemarks)  legalRemarks.addEventListener('input', serialize);

  var form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* Initial state */
  serialize();

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

  /* ========== Public API ========== */

  window.newshubWcvLegal = {
    reset: function () {
      for (var i = 0; i < lawCheckboxes.length; i++)         lawCheckboxes[i].checked         = false;
      for (var j = 0; j < supportCheckboxes.length; j++)     supportCheckboxes[j].checked     = false;
      for (var k = 0; k < retaliationCheckboxes.length; k++) retaliationCheckboxes[k].checked = false;
      if (caseStatus)   caseStatus.selectedIndex = 0;
      if (legalRemarks) legalRemarks.value = '';
      if (firApi) firApi.resetFir();
      hiddenJson.value = '';
    }
  };

})();
