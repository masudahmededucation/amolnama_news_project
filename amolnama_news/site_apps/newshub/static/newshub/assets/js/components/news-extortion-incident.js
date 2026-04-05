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

  const hiddenInput = document.getElementById('extortion-incident-json');
  if (!hiddenInput) return;

  /* ---- Scalar element references ---- */
  const categoryHidden     = document.getElementById('extortion-category');
  const otherSectorRow     = document.getElementById('extortion-other-sector-row');
  const otherSectorDetail  = document.getElementById('extortion-other-sector-detail');
  const transportLocRow    = document.getElementById('extortion-transport-location-row');
  const transportLocHidden = document.getElementById('extortion-transport-location');
  const garmentTypeRow     = document.getElementById('extortion-garment-type-row');
  const garmentTypeHidden  = document.getElementById('extortion-garment-type');
  const amountDemanded     = document.getElementById('extortion-amount-demanded');
  const amountTaken        = document.getElementById('extortion-amount-taken');
  const frequencyHidden    = document.getElementById('extortion-frequency');
  const partyNameRow       = document.getElementById('extortion-party-name-row');
  const partyNameEl        = document.getElementById('extortion-party-name');
  const damageRows         = document.getElementById('extortion-damage-rows');
  const damageAmount       = document.getElementById('extortion-damage-amount');
  const damageDesc         = document.getElementById('extortion-prop-damage-desc');
  const incidentRemarks    = document.getElementById('extortion-incident-remarks');

  /* ---- Checkbox container references ---- */
  const affiliationContainer = document.getElementById('extortion-affiliation-checkboxes');
  const threatContainer      = document.getElementById('extortion-threat-checkboxes');
  const consequenceContainer = document.getElementById('extortion-consequence-checkboxes');
  const contextContainer     = document.getElementById('extortion-context-checkboxes');

  /* ---- Bind radio card group → hidden input + optional callback ---- */
  function bindRadioCardGroup(gridId, hiddenEl, onChangeCb) {
    const grid = document.getElementById(gridId);
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
    const group = document.getElementById(groupId);
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
    if (otherSectorRow)  (code === 'other')             ? otherSectorRow.classList.remove('display-hidden')  : otherSectorRow.classList.add('display-hidden');
    if (code !== 'other' && otherSectorDetail) otherSectorDetail.value = '';
    if (transportLocRow) (code === 'transport_vehicle') ? transportLocRow.classList.remove('display-hidden') : transportLocRow.classList.add('display-hidden');
    if (garmentTypeRow)  (code === 'garment_factory')   ? garmentTypeRow.classList.remove('display-hidden')  : garmentTypeRow.classList.add('display-hidden');
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
    const checked = container.querySelectorAll('input[type="checkbox"]:checked');
    for (let i = 0; i < checked.length; i++) {
      if ((checked[i].dataset.code || '') === (code || '')) return true;
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
    let hasPolitic = containerHasCode(affiliationContainer, 'POLITICAL_PARTY_STUDENT_YOUTH_WING');
    if (partyNameRow) hasPolitic ? partyNameRow.classList.remove('display-hidden') : partyNameRow.classList.add('display-hidden');
    if (!hasPolitic && partyNameEl) partyNameEl.value = '';

    /* Update damage detail rows (shown when PROPERTY_VANDALIZED_ARSON is checked) */
    let hasDamage = containerHasCode(consequenceContainer, 'PROPERTY_VANDALIZED_ARSON');
    if (damageRows) hasDamage ? damageRows.classList.remove('display-hidden') : damageRows.classList.add('display-hidden');

    const data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  /* Sync on any input/change inside the section */
  const section = document.getElementById('section-incident-details');
  if (section) {
    section.addEventListener('input', syncToHiddenInput);
    section.addEventListener('change', syncToHiddenInput);
  }

  /* Re-sync before form submit */
  const form = hiddenInput.closest('form');
  if (form) form.addEventListener('submit', syncToHiddenInput);

  /* ---- Restore from saved hidden input (for form-persist) ---- */
  function restoreFromSavedData() {
    const raw = hiddenInput.value;
    if (!raw) return;
    let saved;
    try { saved = JSON.parse(raw); } catch (e) { return; }

    /* 1. Sector radio */
    if (saved.sectorId) {
      const sectorRadio = document.querySelector('input[name="extortion_category_radio"][value="' + saved.sectorId + '"]');
      if (sectorRadio) {
        sectorRadio.checked = true;
        if (categoryHidden) categoryHidden.value = saved.sectorId;
        const code = (sectorRadio.dataset.code || '');
        if (otherSectorRow) (code === 'other') ? otherSectorRow.classList.remove('display-hidden') : otherSectorRow.classList.add('display-hidden');
        if (transportLocRow) (code === 'transport_vehicle') ? transportLocRow.classList.remove('display-hidden') : transportLocRow.classList.add('display-hidden');
        if (garmentTypeRow) (code === 'garment_factory') ? garmentTypeRow.classList.remove('display-hidden') : garmentTypeRow.classList.add('display-hidden');
      }
    }
    if (saved.sectorOther && otherSectorDetail) otherSectorDetail.value = saved.sectorOther;

    /* Transport location radio */
    if (saved.transportLocation) {
      const tlRadio = document.querySelector('input[name="extortion_transport_location_radio"][value="' + saved.transportLocation + '"]');
      if (tlRadio) { tlRadio.checked = true; if (transportLocHidden) transportLocHidden.value = saved.transportLocation; }
    }
    /* Garment type radio */
    if (saved.garmentType) {
      const gtRadio = document.querySelector('input[name="extortion_garment_type_radio"][value="' + saved.garmentType + '"]');
      if (gtRadio) { gtRadio.checked = true; if (garmentTypeHidden) garmentTypeHidden.value = saved.garmentType; }
    }

    /* 2. Financial */
    if (saved.amountDemanded && amountDemanded) amountDemanded.value = saved.amountDemanded;
    if (saved.amountTaken && amountTaken) amountTaken.value = saved.amountTaken;
    if (saved.frequencyId) {
      const freqRadio = document.querySelector('input[name="extortion_frequency_radio"][value="' + saved.frequencyId + '"]');
      if (freqRadio) { freqRadio.checked = true; if (frequencyHidden) frequencyHidden.value = saved.frequencyId; }
    }

    /* 3. Affiliation checkboxes */
    if (saved.affiliationIds && saved.affiliationIds.length && affiliationContainer) {
      saved.affiliationIds.forEach(function (id) {
        let cb = affiliationContainer.querySelector('input[type="checkbox"][value="' + id + '"]');
        if (cb) cb.checked = true;
      });
      /* Show party name row if political affiliation checked */
      const hasPolitic = containerHasCode(affiliationContainer, 'POLITICAL_PARTY_STUDENT_YOUTH_WING');
      if (partyNameRow) hasPolitic ? partyNameRow.classList.remove('display-hidden') : partyNameRow.classList.add('display-hidden');
    }
    if (saved.partyName && partyNameEl) partyNameEl.value = saved.partyName;

    /* 4. Threat method checkboxes */
    if (saved.threatMethodIds && saved.threatMethodIds.length && threatContainer) {
      saved.threatMethodIds.forEach(function (id) {
        let cb = threatContainer.querySelector('input[type="checkbox"][value="' + id + '"]');
        if (cb) cb.checked = true;
      });
    }

    /* 5. Consequence checkboxes */
    if (saved.consequenceIds && saved.consequenceIds.length && consequenceContainer) {
      saved.consequenceIds.forEach(function (id) {
        let cb = consequenceContainer.querySelector('input[type="checkbox"][value="' + id + '"]');
        if (cb) cb.checked = true;
      });
      const hasDamage = containerHasCode(consequenceContainer, 'PROPERTY_VANDALIZED_ARSON');
      if (damageRows) hasDamage ? damageRows.classList.remove('display-hidden') : damageRows.classList.add('display-hidden');
    }
    if (saved.damageAmount && damageAmount) damageAmount.value = saved.damageAmount;
    if (saved.damageDesc && damageDesc) damageDesc.value = saved.damageDesc;

    /* 6. Bangladesh context checkboxes */
    if (saved.bangladeshContextIds && saved.bangladeshContextIds.length && contextContainer) {
      saved.bangladeshContextIds.forEach(function (id) {
        const cb = contextContainer.querySelector('input[type="checkbox"][value="' + id + '"]');
        if (cb) cb.checked = true;
      });
    }

    /* 7. Remarks */
    if (saved.remarks && incidentRemarks) incidentRemarks.value = saved.remarks;
  }

  /* Run restore after a short delay to let DB-driven checkboxes render first */
  setTimeout(restoreFromSavedData, 300);

  /* ---- Public API for form-clear.js ---- */
  window.newshubExtortionIncident = {
    reset: function () {
      /* 1. Category */
      document.querySelectorAll('input[name="extortion_category_radio"]')
        .forEach(function (r) { r.checked = false; });
      if (categoryHidden) categoryHidden.value = '';
      if (otherSectorRow) otherSectorRow.classList.add('display-hidden');
      if (otherSectorDetail) otherSectorDetail.value = '';
      if (transportLocRow) transportLocRow.classList.add('display-hidden');
      document.querySelectorAll('input[name="extortion_transport_location_radio"]')
        .forEach(function (r) { r.checked = false; });
      if (transportLocHidden) transportLocHidden.value = '';
      if (garmentTypeRow) garmentTypeRow.classList.add('display-hidden');
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
      if (partyNameRow) partyNameRow.classList.add('display-hidden');
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
      if (damageRows)   damageRows.classList.add('display-hidden');
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
