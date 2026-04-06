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
 *   const firApi = window.newshubLawGdFir.initLawGdFirSection({
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
    const el = document.getElementById(id);
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

    const prefix = config.prefix;
    const onChangeFn = typeof config.onChange === 'function' ? config.onChange : function () {};

    /* ---- DOM references ---- */

    const radiosContainer     = document.getElementById(prefix + '-fir-status-radios');
    const statusDataId        = prefix + '-fir-status-data';
    const detailsRow          = document.getElementById(prefix + '-fir-details-row');
    const policeStation       = document.getElementById(prefix + '-police-station');
    const caseNumber          = document.getElementById(prefix + '-case-number');
    const policeRefusedRow    = document.getElementById(prefix + '-police-refused-row');
    const policeRefusalStmt   = document.getElementById(prefix + '-police-refusal-statement');
    const noFirRow            = document.getElementById(prefix + '-no-fir-row');
    const noFirReason         = document.getElementById(prefix + '-no-fir-reason');

    if (!radiosContainer) return null;

    /* ---- Parse FIR status data ---- */

    const firStatusData = parseJsonData(statusDataId);
    const radioName = prefix + '_fir_status';

    /* ---- Build radio group ---- */

    for (let i = 0; i < firStatusData.length; i++) {
      const s = firStatusData[i];
      const label = document.createElement('label');
      label.className = 'radio-inline';
      const input = document.createElement('input');
      input.type = 'radio';
      input.id = radioName + '-' + s.status_id;
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
      let radios = document.querySelectorAll('input[name="' + radioName + '"]');
      for (let j = 0; j < radios.length; j++) {
        if (radios[j].checked) return radios[j];
      }
      return null;
    }

    function isFirYes()           { let r = getSelectedFirRadio(); return r ? (r.dataset.code || '') === 'yes'            : false; }
    function isFirPoliceRefused() { let r = getSelectedFirRadio(); return r ? (r.dataset.code || '') === 'police_refused' : false; }
    function isFirNo()            { let r = getSelectedFirRadio(); return r ? (r.dataset.code || '') === 'no'             : false; }

    /* ---- Conditional row toggling ---- */

    function toggleFirDetails() {
      const yes     = isFirYes();
      const refused = isFirPoliceRefused();
      const no      = isFirNo();

      if (detailsRow) detailsRow.hidden = !yes;
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

      if (policeRefusedRow) policeRefusedRow.hidden = !refused;
      if (!refused && policeRefusalStmt) policeRefusalStmt.value = '';

      if (noFirRow) noFirRow.hidden = !no;
      if (!no && noFirReason) noFirReason.value = '';
    }

    /* ---- Custom event for form-specific JS to listen ---- */

    function fireFirChangedEvent() {
      let event;
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
        const r = getSelectedFirRadio();
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
        const radios = document.querySelectorAll('input[name="' + radioName + '"]');
        for (let k = 0; k < radios.length; k++) radios[k].checked = false;
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
