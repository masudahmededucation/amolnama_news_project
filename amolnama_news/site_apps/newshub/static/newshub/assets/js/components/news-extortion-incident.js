/**
 * news-extortion-incident.js
 * Serializes the Extortion Incident Details form into a hidden JSON input.
 * Saved to [investigation].[incident_evidence_impact_extortion] on the server.
 *
 * All radio/checkbox values are status_ids from [investigation].[ref_status].
 * Conditional show/hide uses data-code attributes instead of hardcoded string values.
 *
 * Sections:
 *   1. Extortion sector (DB-driven radio cards) — OTHER / TRANSPORT_VEHICLE / GARMENT_FACTORY sub-rows
 *   2. Financial demand (amounts, frequency — DB-driven inline radios)
 *   3. Perpetrator affiliation (DB-driven checkboxes) — POLITICAL_PARTY... triggers party name row
 *   4. Threat methods (DB-driven checkboxes)
 *   5. Victim consequences (DB-driven checkboxes) — PROPERTY_VANDALIZED_ARSON triggers damage rows
 *   6. Bangladesh context (DB-driven checkboxes)
 */
(function () {
  'use strict';

  var hiddenInput = document.getElementById('extortion-incident-json');
  if (!hiddenInput) return;

  /* ---- Scalar element references ---- */
  var categoryHidden     = document.getElementById('extortion-category');
  var otherSectorRow     = document.getElementById('extortion-other-sector-row');
  var otherSectorDetail  = document.getElementById('extortion-other-sector-detail');
  var transportLocRow    = document.getElementById('extortion-transport-location-row');
  var transportLocHidden = document.getElementById('extortion-transport-location');
  var garmentTypeRow     = document.getElementById('extortion-garment-type-row');
  var garmentTypeHidden  = document.getElementById('extortion-garment-type');
  var amountDemanded     = document.getElementById('extortion-amount-demanded');
  var amountTaken        = document.getElementById('extortion-amount-taken');
  var frequencyHidden    = document.getElementById('extortion-frequency');
  var partyNameRow       = document.getElementById('extortion-party-name-row');
  var partyNameEl        = document.getElementById('extortion-party-name');
  var damageRows         = document.getElementById('extortion-damage-rows');
  var damageAmount       = document.getElementById('extortion-damage-amount');
  var damageDesc         = document.getElementById('extortion-prop-damage-desc');
  var incidentRemarks    = document.getElementById('extortion-incident-remarks');

  /* ---- Checkbox container references ---- */
  var affiliationContainer = document.getElementById('extortion-affiliation-checkboxes');
  var threatContainer      = document.getElementById('extortion-threat-checkboxes');
  var consequenceContainer = document.getElementById('extortion-consequence-checkboxes');
  var contextContainer     = document.getElementById('extortion-context-checkboxes');

  /* ---- Bind radio card group → hidden input + optional callback ---- */
  function bindRadioCardGroup(gridId, hiddenEl, onChangeCb) {
    var grid = document.getElementById(gridId);
    if (!grid || !hiddenEl) return;
    grid.addEventListener('change', function (e) {
      if (e.target.type === 'radio') {
        hiddenEl.value = e.target.value;
        if (onChangeCb) onChangeCb(e.target.value, e.target.dataset.code || '');
        syncToHiddenInput();
      }
    });
  }

  /* ---- Bind inline radio group → hidden input ---- */
  function bindInlineRadioGroup(groupId, hiddenEl) {
    var group = document.getElementById(groupId);
    if (!group || !hiddenEl) return;
    group.addEventListener('change', function (e) {
      if (e.target.type === 'radio') {
        hiddenEl.value = e.target.value;
        syncToHiddenInput();
      }
    });
  }

  /* Category → show/hide sub-rows (uses data-code since value is a status_id) */
  bindRadioCardGroup('extortion-category-grid', categoryHidden, function (val, code) {
    if (otherSectorRow)  otherSectorRow.style.display  = (code === 'OTHER')             ? '' : 'none';
    if (code !== 'OTHER' && otherSectorDetail) otherSectorDetail.value = '';
    if (transportLocRow) transportLocRow.style.display = (code === 'TRANSPORT_VEHICLE') ? '' : 'none';
    if (garmentTypeRow)  garmentTypeRow.style.display  = (code === 'GARMENT_FACTORY')   ? '' : 'none';
  });

  bindInlineRadioGroup('extortion-transport-location-group', transportLocHidden);
  bindInlineRadioGroup('extortion-garment-type-group', garmentTypeHidden);
  bindInlineRadioGroup('extortion-frequency-group', frequencyHidden);

  /* ---- Collect status_ids of all checked checkboxes in a container ---- */
  function collectContainerValues(container) {
    if (!container) return [];
    return Array.prototype.slice.call(
      container.querySelectorAll('input[type="checkbox"]:checked')
    ).map(function (cb) { return parseInt(cb.value, 10); });
  }

  /* ---- Check if any checked checkbox in container has given data-code ---- */
  function containerHasCode(container, code) {
    if (!container) return false;
    var checked = container.querySelectorAll('input[type="checkbox"]:checked');
    for (var i = 0; i < checked.length; i++) {
      if ((checked[i].dataset.code || '').toUpperCase() === (code || '').toUpperCase()) return true;
    }
    return false;
  }

  /* ---- Collect all data ---- */
  function collectData() {
    return {
      /* 1. Sector */
      sectorId:          parseInt(categoryHidden && categoryHidden.value, 10) || 0,
      sectorOther:       (otherSectorDetail  && otherSectorDetail.value.trim())  || '',
      transportLocation: (transportLocHidden && transportLocHidden.value) || '',
      garmentType:       (garmentTypeHidden  && garmentTypeHidden.value)  || '',
      /* 2. Financial */
      amountDemanded:    parseFloat(amountDemanded && amountDemanded.value) || 0,
      amountTaken:       parseFloat(amountTaken    && amountTaken.value)    || 0,
      frequencyId:       parseInt(frequencyHidden && frequencyHidden.value, 10) || 0,
      /* 3. Perpetrator affiliation (status_ids from extortion_form_extortion_accused_affiliation) */
      affiliationIds:    collectContainerValues(affiliationContainer),
      partyName:         (partyNameEl && partyNameEl.value.trim()) || '',
      /* 4. Threat methods (status_ids from extortion_form_extortion_threat_pressure_method) */
      threatMethodIds:   collectContainerValues(threatContainer),
      /* 5. Consequences (status_ids from extortion_form_extortion_victim_consequence) */
      consequenceIds:    collectContainerValues(consequenceContainer),
      damageAmount:      parseFloat(damageAmount && damageAmount.value) || 0,
      damageDesc:        (damageDesc && damageDesc.value.trim()) || '',
      /* 6. Bangladesh context (status_ids from extortion_form_extortion_bangladesh_context) */
      bangladeshContextIds: collectContainerValues(contextContainer),
      /* 7. General remarks */
      remarks:              (incidentRemarks && incidentRemarks.value.trim()) || '',
    };
  }

  function hasAnyData(d) {
    return d.sectorId > 0 || d.amountDemanded > 0 || d.amountTaken > 0
      || d.frequencyId > 0 || d.affiliationIds.length > 0
      || d.threatMethodIds.length > 0 || d.consequenceIds.length > 0
      || d.bangladeshContextIds.length > 0;
  }

  function syncToHiddenInput() {
    /* Update party name row (shown when POLITICAL_PARTY_STUDENT_YOUTH_WING is checked) */
    var hasPolitic = containerHasCode(affiliationContainer, 'POLITICAL_PARTY_STUDENT_YOUTH_WING');
    if (partyNameRow) partyNameRow.style.display = hasPolitic ? '' : 'none';
    if (!hasPolitic && partyNameEl) partyNameEl.value = '';

    /* Update damage detail rows (shown when PROPERTY_VANDALIZED_ARSON is checked) */
    var hasDamage = containerHasCode(consequenceContainer, 'PROPERTY_VANDALIZED_ARSON');
    if (damageRows) damageRows.style.display = hasDamage ? '' : 'none';

    var data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  /* Sync on any input/change inside the section */
  var section = document.getElementById('section-incident-details');
  if (section) {
    section.addEventListener('input', syncToHiddenInput);
    section.addEventListener('change', syncToHiddenInput);
  }

  /* Re-sync before form submit */
  var form = hiddenInput.closest('form');
  if (form) form.addEventListener('submit', syncToHiddenInput);

  /* ---- Public API for form-clear.js ---- */
  window.newshubExtortionIncident = {
    reset: function () {
      /* 1. Category */
      document.querySelectorAll('input[name="extortion_category_radio"]')
        .forEach(function (r) { r.checked = false; });
      if (categoryHidden) categoryHidden.value = '';
      if (otherSectorRow) otherSectorRow.style.display = 'none';
      if (otherSectorDetail) otherSectorDetail.value = '';
      if (transportLocRow) transportLocRow.style.display = 'none';
      document.querySelectorAll('input[name="extortion_transport_location_radio"]')
        .forEach(function (r) { r.checked = false; });
      if (transportLocHidden) transportLocHidden.value = '';
      if (garmentTypeRow) garmentTypeRow.style.display = 'none';
      document.querySelectorAll('input[name="extortion_garment_type_radio"]')
        .forEach(function (r) { r.checked = false; });
      if (garmentTypeHidden) garmentTypeHidden.value = '';

      /* 2. Financial */
      if (amountDemanded) amountDemanded.value = '';
      if (amountTaken)    amountTaken.value    = '';
      document.querySelectorAll('input[name="extortion_frequency_radio"]')
        .forEach(function (r) { r.checked = false; });
      if (frequencyHidden) frequencyHidden.value = '';

      /* 3. Affiliation */
      if (affiliationContainer) {
        affiliationContainer.querySelectorAll('input[type="checkbox"]')
          .forEach(function (cb) { cb.checked = false; });
      }
      if (partyNameRow) partyNameRow.style.display = 'none';
      if (partyNameEl)  partyNameEl.value = '';

      /* 4. Threat methods */
      if (threatContainer) {
        threatContainer.querySelectorAll('input[type="checkbox"]')
          .forEach(function (cb) { cb.checked = false; });
      }

      /* 5. Consequences */
      if (consequenceContainer) {
        consequenceContainer.querySelectorAll('input[type="checkbox"]')
          .forEach(function (cb) { cb.checked = false; });
      }
      if (damageRows)   damageRows.style.display = 'none';
      if (damageAmount) damageAmount.value = '';
      if (damageDesc)   damageDesc.value   = '';

      /* 6. Bangladesh context */
      if (contextContainer) {
        contextContainer.querySelectorAll('input[type="checkbox"]')
          .forEach(function (cb) { cb.checked = false; });
      }

      /* 7. General remarks */
      if (incidentRemarks) incidentRemarks.value = '';

      hiddenInput.value = '';
    }
  };
})();
