/**
 * news-extortion-legal.js
 * Extortion — Legal Action & Support (form-specific module).
 * Builds form-specific checkboxes/select and serializes all legal data to #ext-legal.
 * GD/FIR state managed by shared news-law-gd-fir.js factory (prefix="legal").
 *
 * DOM dependencies (form-specific, in section#section-ext-legal):
 *   #ext-legal                       — hidden JSON input for form submission
 *   #ext-applicable-law-checkboxes   — container (populated from #ext-applicable-law-data)
 *   #ext-case-status                 — select (populated from #ext-case-status-data)
 *   #ext-support-service-checkboxes  — container (populated from #ext-support-service-data)
 *   #ext-retaliation-checkboxes      — container (populated from #ext-retaliation-data)
 *   #ext-remarks                     — textarea
 *
 * Shared GD/FIR DOM (from law-gd-fir-section.html, managed by news-law-gd-fir.js):
 *   #legal-fir-status-radios, #legal-police-station, #legal-case-number,
 *   #legal-police-refusal-statement, #legal-no-fir-reason
 *
 * Serializes to:
 *   { firStatusId, policeStation, caseNumber, policeRefusalStatement, noFirReason,
 *     applicableLawIds, caseStatusId, supportServiceIds, retaliationIds, remarks }
 *
 * Exposes: window.newshubExtortionLegal = { reset: fn }
 */
(function () {
  'use strict';

  const hiddenJson = document.getElementById('ext-legal');
  if (!hiddenJson) return;

  /* ========== DOM references ========== */

  const lawContainer         = document.getElementById('ext-applicable-law-checkboxes');
  const caseStatus           = document.getElementById('ext-case-status');
  const supportContainer     = document.getElementById('ext-support-service-checkboxes');
  const retaliationContainer = document.getElementById('ext-retaliation-checkboxes');
  const remarks              = document.getElementById('ext-remarks');

  /* ========== Init shared GD/FIR module ========== */

  let firApi = null;
  if (window.newshubLawGdFir) {
    firApi = window.newshubLawGdFir.initLawGdFirSection({
      prefix: 'legal',
      onChange: function () { serialize(); }
    });
  }

  /* ========== Parse reference data ========== */

  function parseJsonData(id) {
    const el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
  }

  const lawData         = parseJsonData('ext-applicable-law-data');
  const caseStatusData  = parseJsonData('ext-case-status-data');
  const supportData     = parseJsonData('ext-support-service-data');
  const retaliationData = parseJsonData('ext-retaliation-data');

  /* ========== Populate helpers ========== */

  function populateCheckboxes(container, checkboxName, items) {
    if (!container || !items.length) return;
    for (let i = 0; i < items.length; i++) {
      let s = items[i];
      const label = document.createElement('label');
      label.className = 'checkbox-inline';
      const input = document.createElement('input');
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
    for (let i = 0; i < items.length; i++) {
      const s = items[i];
      const opt = document.createElement('option');
      opt.value = s.status_id;
      opt.textContent = (s.status_name_bn || '') + ' (' + (s.status_name_en || '') + ')';
      selectEl.appendChild(opt);
    }
  }

  populateCheckboxes(lawContainer,         'ext_applicable_law',   lawData);
  populateSelect(caseStatus, caseStatusData);
  populateCheckboxes(supportContainer,     'ext_support_service',  supportData);
  populateCheckboxes(retaliationContainer, 'ext_retaliation',      retaliationData);

  /* Re-query after dynamic population */
  /* Query checkboxes fresh each time — they're created dynamically by populateCheckboxes() */
  function getLawCheckboxes()         { return document.querySelectorAll('input[name="ext_applicable_law"]'); }
  function getSupportCheckboxes()     { return document.querySelectorAll('input[name="ext_support_service"]'); }
  function getRetaliationCheckboxes() { return document.querySelectorAll('input[name="ext_retaliation"]'); }

  /* ========== Helpers ========== */

  function getCheckedIds(checkboxes) {
    const ids = [];
    for (let i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) ids.push(parseInt(checkboxes[i].value, 10));
    }
    return ids;
  }

  /* ========== Serialize ========== */

  function serialize() {
    const data = {
      firStatusId:            firApi ? firApi.getFirStatusId()            : 0,
      policeStation:          firApi ? firApi.getPoliceStation()          : '',
      caseNumber:             firApi ? firApi.getCaseNumber()             : '',
      policeRefusalStatement: firApi ? firApi.getPoliceRefusalStatement() : '',
      noFirReason:            firApi ? firApi.getNoFirReason()            : '',
      applicableLawIds:       getCheckedIds(getLawCheckboxes()),
      caseStatusId:           caseStatus ? (parseInt(caseStatus.value, 10) || 0) : 0,
      supportServiceIds:      getCheckedIds(getSupportCheckboxes()),
      retaliationIds:         getCheckedIds(getRetaliationCheckboxes()),
      remarks:                remarks ? remarks.value.trim() : ''
    };
    hiddenJson.value = JSON.stringify(data);
  }

  /* ========== Event listeners ========== */

  if (caseStatus) caseStatus.addEventListener('change', serialize);
  if (remarks)    remarks.addEventListener('input', serialize);

  const form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* Initial state — only serialize if hidden input is empty (skip if persist restored a value) */
  if (!hiddenJson.value) serialize();

  /* ========== Step validator ========== */

  const panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    const step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      const warnings = [];
      if (!firApi || !firApi.getFirStatusId()) {
        warnings.push('এফআইআর/জিডি অবস্থা নির্বাচন করুন (Please select FIR/GD status)');
      }
      if (firApi && firApi.isFirYes() && !firApi.getPoliceStation()) {
        warnings.push('থানার নাম দিন (Please enter police station name)');
      }
      return { warnings: warnings };
    }});
  }

  /* ========== Restore from saved hidden input (for form-persist) ========== */
  function restoreFromSavedData() {
    const raw = hiddenJson.value;
    if (!raw) return;
    let saved;
    try { saved = JSON.parse(raw); } catch (e) { return; }

    /* FIR status radio */
    if (saved.firStatusId) {
      const firRadio = document.querySelector('input[name="legal_fir_status"][value="' + saved.firStatusId + '"]');
      if (firRadio) {
        firRadio.checked = true;
        firRadio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    /* Applicable law checkboxes */
    if (saved.applicableLawIds && saved.applicableLawIds.length) {
      saved.applicableLawIds.forEach(function (id) {
        let callback = lawContainer && lawContainer.querySelector('input[value="' + id + '"]');
        if (callback) callback.checked = true;
      });
    }

    /* Case status select */
    if (saved.caseStatusId && caseStatus) caseStatus.value = saved.caseStatusId;

    /* Support service checkboxes */
    if (saved.supportServiceIds && saved.supportServiceIds.length) {
      saved.supportServiceIds.forEach(function (id) {
        let callback = supportContainer && supportContainer.querySelector('input[value="' + id + '"]');
        if (callback) callback.checked = true;
      });
    }

    /* Retaliation checkboxes */
    if (saved.retaliationIds && saved.retaliationIds.length) {
      saved.retaliationIds.forEach(function (id) {
        const callback = retaliationContainer && retaliationContainer.querySelector('input[value="' + id + '"]');
        if (callback) callback.checked = true;
      });
    }

    /* Remarks */
    if (saved.remarks && remarks) remarks.value = saved.remarks;
  }

  setTimeout(restoreFromSavedData, 100);

  /* ========== Public API ========== */

  window.newshubExtortionLegal = {
    reset: function () {
      const lc = getLawCheckboxes(), sc = getSupportCheckboxes(), rc = getRetaliationCheckboxes();
      for (let i = 0; i < lc.length; i++) lc[i].checked = false;
      for (let j = 0; j < sc.length; j++) sc[j].checked = false;
      for (let k = 0; k < rc.length; k++) rc[k].checked = false;
      if (caseStatus) caseStatus.selectedIndex = 0;
      if (remarks)    remarks.value = '';
      if (firApi) firApi.resetFir();
      hiddenJson.value = '';
    }
  };

})();
