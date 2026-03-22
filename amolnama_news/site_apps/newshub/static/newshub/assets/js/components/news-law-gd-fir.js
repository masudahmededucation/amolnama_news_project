/**
 * news-law-gd-fir.js
 * Shared GD/FIR (General Diary / First Information Report) module.
 * Factory pattern — one init per legal form, prefix-based IDs.
 *
 * Template: law-gd-fir-section.html (single source of truth for all GD/FIR UI).
 *
 * ID convention (from prefix, e.g., "legal" or "wcv"):
 *   {prefix}-fir-status-radios        — radio group container
 *   {prefix}-fir-status-data          — JSON data element
 *   {prefix}-fir-details-row          — conditional row (FIR = YES)
 *   {prefix}-police-station           — thana search input (Tom Select)
 *   {prefix}-case-number              — case/GD number input
 *   {prefix}-police-refused-row       — conditional row (FIR = POLICE_REFUSED)
 *   {prefix}-police-refusal-statement — textarea
 *   {prefix}-no-fir-row               — conditional row (FIR = NO)
 *   {prefix}-no-fir-reason            — textarea
 *
 * Usage:
 *   var firApi = window.newshubLawGdFir.initLawGdFirSection({
 *     prefix: 'legal',
 *     onChange: function () { serialize(); }
 *   });
 *
 * Returns API: {
 *   isFirYes, isFirPoliceRefused, isFirNo,
 *   getFirStatusId, getPoliceStation, getCaseNumber,
 *   getPoliceRefusalStatement, getNoFirReason,
 *   resetFir
 * }
 *
 * Exposes: window.newshubLawGdFir = { initLawGdFirSection: fn }
 */
(function () {
  'use strict';

  function parseJsonData(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
  }

  /**
   * Initialise a GD/FIR section for the given prefix.
   *
   * @param {object} config
   * @param {string} config.prefix   — ID prefix (e.g., "legal", "wcv")
   * @param {function} [config.onChange] — called when FIR status or any field changes
   * @returns {object|null} — public API, or null if DOM elements not found
   */
  function initLawGdFirSection(config) {
    if (!config || !config.prefix) return null;

    var prefix = config.prefix;
    var onChangeFn = typeof config.onChange === 'function' ? config.onChange : function () {};

    /* ---- DOM references ---- */

    var radiosContainer     = document.getElementById(prefix + '-fir-status-radios');
    var statusDataId        = prefix + '-fir-status-data';
    var detailsRow          = document.getElementById(prefix + '-fir-details-row');
    var policeStation       = document.getElementById(prefix + '-police-station');
    var caseNumber          = document.getElementById(prefix + '-case-number');
    var policeRefusedRow    = document.getElementById(prefix + '-police-refused-row');
    var policeRefusalStmt   = document.getElementById(prefix + '-police-refusal-statement');
    var noFirRow            = document.getElementById(prefix + '-no-fir-row');
    var noFirReason         = document.getElementById(prefix + '-no-fir-reason');

    if (!radiosContainer) return null;

    /* ---- Parse FIR status data ---- */

    var firStatusData = parseJsonData(statusDataId);
    var radioName = prefix + '_fir_status';

    /* ---- Build radio group ---- */

    for (var i = 0; i < firStatusData.length; i++) {
      var s = firStatusData[i];
      var label = document.createElement('label');
      label.className = 'radio-inline';
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = radioName;
      input.value = s.status_id;
      input.dataset.code = s.status_code || '';
      label.appendChild(input);
      label.appendChild(document.createTextNode(
        ' ' + (s.status_name_bn || '') + ' (' + (s.status_name_en || '') + ')'
      ));
      radiosContainer.appendChild(label);
      input.addEventListener('change', function () { toggleFirDetails(); fireFirChangedEvent(); onChangeFn(); });
    }

    /* ---- Internal helpers ---- */

    function getSelectedFirRadio() {
      var radios = document.querySelectorAll('input[name="' + radioName + '"]');
      for (var j = 0; j < radios.length; j++) {
        if (radios[j].checked) return radios[j];
      }
      return null;
    }

    function isFirYes()           { var r = getSelectedFirRadio(); return r ? (r.dataset.code || '').toUpperCase() === 'YES'            : false; }
    function isFirPoliceRefused() { var r = getSelectedFirRadio(); return r ? (r.dataset.code || '').toUpperCase() === 'POLICE_REFUSED' : false; }
    function isFirNo()            { var r = getSelectedFirRadio(); return r ? (r.dataset.code || '').toUpperCase() === 'NO'             : false; }

    /* ---- Conditional row toggling ---- */

    function toggleFirDetails() {
      var yes     = isFirYes();
      var refused = isFirPoliceRefused();
      var no      = isFirNo();

      if (detailsRow) detailsRow.style.display = yes ? '' : 'none';
      if (!yes) {
        if (policeStation) {
          if (policeStation.tomselect) {
            policeStation.tomselect.clear(true);
            policeStation.tomselect.clearOptions();
          } else {
            policeStation.value = '';
          }
        }
        if (caseNumber) caseNumber.value = '';
      }

      if (policeRefusedRow) policeRefusedRow.style.display = refused ? '' : 'none';
      if (!refused && policeRefusalStmt) policeRefusalStmt.value = '';

      if (noFirRow) noFirRow.style.display = no ? '' : 'none';
      if (!no && noFirReason) noFirReason.value = '';
    }

    /* ---- Custom event for form-specific JS to listen ---- */

    function fireFirChangedEvent() {
      var event;
      try {
        event = new CustomEvent('law-gd-fir-changed', { bubbles: true });
      } catch (e) {
        event = document.createEvent('CustomEvent');
        event.initCustomEvent('law-gd-fir-changed', true, false, null);
      }
      radiosContainer.dispatchEvent(event);
    }

    /* ---- Tom Select on police station — via reusable thana search module ---- */

    if (policeStation && window.newshubThanaSearchSelect) {
      window.newshubThanaSearchSelect.initThanaSearchSelect(policeStation, {
        onChange: function () { onChangeFn(); }
      });
    }

    /* ---- Event listeners on conditional fields ---- */

    if (policeStation && !policeStation.tomselect) {
      policeStation.addEventListener('input', onChangeFn);
    }
    if (caseNumber)        caseNumber.addEventListener('input', onChangeFn);
    if (policeRefusalStmt) policeRefusalStmt.addEventListener('input', onChangeFn);
    if (noFirReason)       noFirReason.addEventListener('input', onChangeFn);

    /* ---- Initial state ---- */

    toggleFirDetails();

    /* ---- Public API ---- */

    return {
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
        return (policeRefusalStmt && isFirPoliceRefused()) ? policeRefusalStmt.value.trim() : '';
      },
      getNoFirReason: function () {
        return (noFirReason && isFirNo()) ? noFirReason.value.trim() : '';
      },
      resetFir: function () {
        var radios = document.querySelectorAll('input[name="' + radioName + '"]');
        for (var k = 0; k < radios.length; k++) radios[k].checked = false;
        if (policeStation) {
          if (policeStation.tomselect) {
            policeStation.tomselect.clear(true);
            policeStation.tomselect.clearOptions();
          } else {
            policeStation.value = '';
          }
        }
        if (caseNumber)        caseNumber.value        = '';
        if (policeRefusalStmt) policeRefusalStmt.value  = '';
        if (noFirReason)       noFirReason.value        = '';
        toggleFirDetails();
      },
      /** DOM reference for event listeners (e.g., 'law-gd-fir-changed') */
      radiosContainer: radiosContainer,
      /** DOM reference for step validation */
      policeStation: policeStation
    };
  }

  /* ========== Public API ========== */

  window.newshubLawGdFir = {
    initLawGdFirSection: initLawGdFirSection
  };

})();
