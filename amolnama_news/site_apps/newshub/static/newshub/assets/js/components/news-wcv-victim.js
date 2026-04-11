/**
 * news-wcv-victim.js
 * Reads victim demographics and serializes to #wcv-victim.
 *
 * Uses shared modules:
 *   - newshubPersonName.read/bind/reset('wcv-victim')   — Name Group (template-rendered)
 *   - newshubPersonIdentity.read/bind/reset('wcv-victim') — Personal Identity Group (template-rendered)
 *
 * WCV-specific fields (Group 3): Marital Status, Husband, Occupation, Institution
 * These are JS-populated from JSON and handled directly here.
 *
 * Exposes: window.newshubWcvVictim = { reset: callback }
 */
(function () {
  'use strict';

  const hiddenJson = document.getElementById('wcv-victim');
  if (!hiddenJson) return;

  /* ---- WCV-specific fields (Group 3) ---- */
  const marital         = document.getElementById('wcv-victim-marital');
  const husbandRow      = document.getElementById('wcv-husband-row');
  const husbandFirstName = document.getElementById('wcv-victim-husband-firstname');
  const husbandLastName  = document.getElementById('wcv-victim-husband-lastname');
  const marriageDate     = document.getElementById('wcv-victim-marriage-date');
  const occupation       = document.getElementById('wcv-victim-occupation');
  const institution      = document.getElementById('wcv-victim-institution');

  /* ========== Parse reference data (for JS-populated fields only) ========== */

  function parseJsonData(id) {
    const element = document.getElementById(id);
    if (!element) return [];
    try { return JSON.parse(element.textContent) || []; } catch (e) { return []; }
  }

  const maritalStatuses   = parseJsonData('wcv-marital-statuses-data');
  const victimOccupations = parseJsonData('wcv-victim-occupations-data');

  /* ========== Populate JS-driven selects (marital, occupation) ========== */

  function populateSelect(selectEl, items) {
    if (!selectEl || !items.length) return;
    for (let i = 0; i < items.length; i++) {
      const s = items[i];
      let opt = document.createElement('option');
      opt.value = s.status_id;
      opt.textContent = (s.status_name_bn || '') + ' (' + (s.status_name_en || '') + ')';
      selectEl.appendChild(opt);
    }
  }

  populateSelect(marital, maritalStatuses);
  populateSelect(occupation, victimOccupations);

  /* ========== Helpers ========== */

  function getSelectText(selectEl) {
    if (!selectEl || !selectEl.value) return '';
    const opt = selectEl.options[selectEl.selectedIndex];
    return opt ? opt.textContent.trim() : '';
  }

  /* ========== Conditional: husband row ========== */

  const marriedStatusIds = [];
  for (let m = 0; m < maritalStatuses.length; m++) {
    const code = (maritalStatuses[m].status_code || '');
    if (code === 'married' || code === 'divorced' || code === 'widowed' || code === 'separated') {
      marriedStatusIds.push(String(maritalStatuses[m].status_id));
    }
  }

  function toggleHusband() {
    if (!husbandRow || !marital) return;
    const show = marriedStatusIds.indexOf(marital.value) !== -1;
    husbandRow.hidden = !show;
    if (!show) {
      if (husbandFirstName) husbandFirstName.value = '';
      if (husbandLastName)  husbandLastName.value  = '';
      if (marriageDate)     marriageDate.value      = '';
    }
  }

  /* ========== Serialize ========== */

  const PREFIX = 'wcv-victim';

  function serialize() {
    /* Read standard groups via shared modules */
    let nameData     = window.newshubPersonName.read(PREFIX);
    const identityData = window.newshubPersonIdentity.read(PREFIX);

    /* Merge with WCV-specific fields */
    const data = {};
    const k;
    for (k in nameData)     { data[k] = nameData[k]; }
    for (k in identityData) { data[k] = identityData[k]; }

    /* WCV-specific: Group 3 */
    data.husbandFirstName = husbandFirstName ? husbandFirstName.value.trim() : '';
    data.husbandLastName  = husbandLastName  ? husbandLastName.value.trim()  : '';
    data.marriageDate     = marriageDate     ? marriageDate.value             : '';
    data.maritalStatus    = getSelectText(marital);
    data.maritalStatusId  = marital ? (parseInt(marital.value, 10) || 0) : 0;
    data.occupation       = getSelectText(occupation);
    data.occupationId     = occupation ? (parseInt(occupation.value, 10) || 0) : 0;
    data.institution      = institution ? institution.value.trim() : '';

    hiddenJson.value = JSON.stringify(data);
  }

  /* ========== Event listeners ========== */

  /* Standard groups — use shared bind */
  window.newshubPersonName.bind(PREFIX, serialize);
  window.newshubPersonIdentity.bind(PREFIX, serialize);

  /* Age — extra validation (WCV-specific clamping) */
  const ageEl = document.getElementById('wcv-victim-age');
  if (ageEl) ageEl.addEventListener('input', function () {
    const val = parseInt(this.value, 10);
    const ageError   = document.getElementById('wcv-age-error');
    const ageWarning = document.getElementById('wcv-age-warning');
    const exceeded = !isNaN(val) && val > 100;
    if (exceeded) this.value = 100;
    if (ageError)   ageError.hidden = !exceeded;
    if (ageWarning) (!exceeded && !isNaN(val) && val > ageWarning.hidden = !50);
    serialize();
  });

  /* WCV-specific fields */
  [husbandFirstName, husbandLastName, institution]
    .forEach(function (element) { if (element) element.addEventListener('input', serialize); });
  if (marriageDate) marriageDate.addEventListener('change', serialize);
  if (marital)    marital.addEventListener('change', function () { toggleHusband(); serialize(); });
  if (occupation) occupation.addEventListener('change', serialize);

  /* Serialize before form submit */
  const form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* Initial state */
  toggleHusband();

  /* ========== Public API ========== */

  window.newshubWcvVictim = {
    reset: function () {
      /* Standard groups — use shared reset */
      window.newshubPersonName.reset(PREFIX);
      window.newshubPersonIdentity.reset(PREFIX);
      /* WCV-specific fields */
      [husbandFirstName, husbandLastName, marriageDate, institution]
        .forEach(function (element) { if (element) element.value = ''; });
      if (marital) marital.selectedIndex = 0;
      if (occupation) occupation.selectedIndex = 0;
      toggleHusband();
      hiddenJson.value = '';
    },
  };

  /* Step validator: require all mandatory victim fields */
  const panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    const step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, callback: function () {
      const warnings = [];
      const nameData = window.newshubPersonName.read(PREFIX);
      if (!nameData.firstNameEn) {
        warnings.push('\u09AD\u09C1\u0995\u09CD\u09A4\u09AD\u09CB\u0997\u09C0\u09B0 \u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE (\u0987\u0982\u09B0\u09C7\u099C\u09BF) \u09A6\u09BF\u09A8 (Please enter victim first name in English)');
      }
      if (!nameData.lastNameEn) {
        warnings.push('\u09AD\u09C1\u0995\u09CD\u09A4\u09AD\u09CB\u0997\u09C0\u09B0 \u09B6\u09C7\u09B7 \u09A8\u09BE\u09AE (\u0987\u0982\u09B0\u09C7\u099C\u09BF) \u09A6\u09BF\u09A8 (Please enter victim last name in English)');
      }
      const idData = window.newshubPersonIdentity.read(PREFIX);
      if (!idData.age || idData.age <= 0) {
        warnings.push('\u09AD\u09C1\u0995\u09CD\u09A4\u09AD\u09CB\u0997\u09C0\u09B0 \u09AC\u09AF\u09BC\u09B8 \u09A6\u09BF\u09A8 (Please enter victim age)');
      }
      if (!idData.genderId) {
        warnings.push('\u09B2\u09BF\u0999\u09CD\u0997 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 (Please select gender)');
      }
      if (!marital || !marital.value) {
        warnings.push('\u09AC\u09C8\u09AC\u09BE\u09B9\u09BF\u0995 \u0985\u09AC\u09B8\u09CD\u09A5\u09BE \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 (Please select marital status)');
      }
      if (marital && marriedStatusIds.indexOf(marital.value) !== -1) {
        if (!husbandFirstName || !husbandFirstName.value.trim()) {
          warnings.push('\u09B8\u09CD\u09AC\u09BE\u09AE\u09C0\u09B0 \u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE \u09A6\u09BF\u09A8 (Please enter husband\'s first name)');
        }
        if (!husbandLastName || !husbandLastName.value.trim()) {
          warnings.push('\u09B8\u09CD\u09AC\u09BE\u09AE\u09C0\u09B0 \u09B6\u09C7\u09B7 \u09A8\u09BE\u09AE \u09A6\u09BF\u09A8 (Please enter husband\'s last name)');
        }
      }
      if (!occupation || !occupation.value) {
        warnings.push('\u09AA\u09C7\u09B6\u09BE \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 (Please select occupation)');
      }
      return { warnings: warnings };
    }});
  }
})();
