/**
 * news-legal-fir.js
 * Shared FIR/GD section module for Crime, Extortion, and Land Grab legal forms.
 * Builds FIR status radio group and handles conditional row toggling.
 * Does NOT serialize — each form's own JS handles that via window.newshubLegalFir API.
 *
 * DOM dependencies (shared IDs — one legal form per page, no conflicts):
 *   #legal-fir-status-radios        — radio group container
 *   #legal-fir-details-row          — conditional row (FIR = YES)
 *   #legal-police-station           — text input (Tom Select init done in form-specific JS)
 *   #legal-case-number              — text input
 *   #legal-police-refused-row       — conditional row (FIR = POLICE_REFUSED)
 *   #legal-police-refusal-statement — textarea
 *   #legal-no-fir-row               — conditional row (FIR = NO)
 *   #legal-no-fir-reason            — textarea
 *   #legal-fir-status-data          — JSON data element
 *
 * Exposes: window.newshubLegalFir = {
 *   isFirYes, isFirPoliceRefused, isFirNo,
 *   getFirStatusId, getPoliceStation, getCaseNumber,
 *   getPoliceRefusalStatement, getNoFirReason,
 *   resetFir
 * }
 */
(function () {
  'use strict';

  var firRadiosContainer     = document.getElementById('legal-fir-status-radios');
  var firDetailsRow          = document.getElementById('legal-fir-details-row');
  var policeStation          = document.getElementById('legal-police-station');
  var caseNumber             = document.getElementById('legal-case-number');
  var policeRefusedRow       = document.getElementById('legal-police-refused-row');
  var policeRefusalStatement = document.getElementById('legal-police-refusal-statement');
  var noFirRow               = document.getElementById('legal-no-fir-row');
  var noFirReason            = document.getElementById('legal-no-fir-reason');

  if (!firRadiosContainer) return;

  /* ---- Parse FIR status data ---- */

  function parseJsonData(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
  }

  var firStatusData = parseJsonData('legal-fir-status-data');

  /* ---- Build radio group ---- */

  for (var i = 0; i < firStatusData.length; i++) {
    var s = firStatusData[i];
    var label = document.createElement('label');
    label.className = 'radio-inline';
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'legal_fir_status';
    input.value = s.status_id;
    input.dataset.code = s.status_code || '';
    label.appendChild(input);
    label.appendChild(document.createTextNode(
      ' ' + (s.status_name_bn || '') + ' (' + (s.status_name_en || '') + ')'
    ));
    firRadiosContainer.appendChild(label);
    input.addEventListener('change', function () { toggleFirDetails(); fireFirChangedEvent(); });
  }

  /* ---- Conditional row toggling ---- */

  function toggleFirDetails() {
    var yes     = isFirYes();
    var refused = isFirPoliceRefused();
    var no      = isFirNo();

    if (firDetailsRow) firDetailsRow.style.display = yes ? '' : 'none';
    if (!yes) {
      if (policeStation && !policeStation.tomselect) policeStation.value = '';
      if (caseNumber) caseNumber.value = '';
    }

    if (policeRefusedRow) policeRefusedRow.style.display = refused ? '' : 'none';
    if (!refused && policeRefusalStatement) policeRefusalStatement.value = '';

    if (noFirRow) noFirRow.style.display = no ? '' : 'none';
    if (!no && noFirReason) noFirReason.value = '';
  }

  /* Dispatch custom event so form-specific JS can react (e.g., re-serialize) */
  function fireFirChangedEvent() {
    var event;
    try {
      event = new CustomEvent('legal-fir-changed', { bubbles: true });
    } catch (e) {
      event = document.createEvent('CustomEvent');
      event.initCustomEvent('legal-fir-changed', true, false, null);
    }
    firRadiosContainer.dispatchEvent(event);
  }

  /* Initial state */
  toggleFirDetails();

  /* ---- Internal helpers ---- */

  function getSelectedFirRadio() {
    var radios = document.querySelectorAll('input[name="legal_fir_status"]');
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked) return radios[i];
    }
    return null;
  }

  function isFirYes()           { var r = getSelectedFirRadio(); return r ? r.dataset.code === 'YES'            : false; }
  function isFirPoliceRefused() { var r = getSelectedFirRadio(); return r ? r.dataset.code === 'POLICE_REFUSED' : false; }
  function isFirNo()            { var r = getSelectedFirRadio(); return r ? r.dataset.code === 'NO'             : false; }

  /* ---- Public API ---- */

  window.newshubLegalFir = {
    isFirYes:           isFirYes,
    isFirPoliceRefused: isFirPoliceRefused,
    isFirNo:            isFirNo,
    getFirStatusId: function () {
      var r = getSelectedFirRadio();
      return r ? (parseInt(r.value, 10) || 0) : 0;
    },
    getPoliceStation: function () {
      return (policeStation && isFirYes()) ? policeStation.value.trim() : '';
    },
    getCaseNumber: function () {
      return (caseNumber && isFirYes()) ? caseNumber.value.trim() : '';
    },
    getPoliceRefusalStatement: function () {
      return (policeRefusalStatement && isFirPoliceRefused()) ? policeRefusalStatement.value.trim() : '';
    },
    getNoFirReason: function () {
      return (noFirReason && isFirNo()) ? noFirReason.value.trim() : '';
    },
    resetFir: function () {
      var radios = document.querySelectorAll('input[name="legal_fir_status"]');
      for (var i = 0; i < radios.length; i++) radios[i].checked = false;
      if (policeStation) {
        if (policeStation.tomselect) {
          policeStation.tomselect.clear(true);
          policeStation.tomselect.clearOptions();
        } else {
          policeStation.value = '';
        }
      }
      if (caseNumber)             caseNumber.value             = '';
      if (policeRefusalStatement) policeRefusalStatement.value = '';
      if (noFirReason)            noFirReason.value            = '';
      toggleFirDetails();
    }
  };

})();
