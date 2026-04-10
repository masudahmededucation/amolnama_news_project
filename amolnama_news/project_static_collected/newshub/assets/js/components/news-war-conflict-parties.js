/**
 * news-war-conflict-parties.js
 * Dynamic repeater for country-level conflict parties (aggressor, defender, ally).
 * Each party card has a searchable country dropdown (Tom Select), alliance,
 * leader name, and statement fields.
 * Data is serialized to a hidden JSON input for form submission.
 *
 * DOM dependencies:
 *   #global-conflict-parties-json   — hidden input (JSON payload)
 *   #conflict-parties-list          — container where cards are rendered
 *   #conflict-party-add-buttons     — quick-add button group
 *   #conflict-party-empty-state     — "no countries" message
 *   #actor-involvement-types-data   — CSP-safe JSON with involvement types
 *   #countries-data                 — CSP-safe JSON with country list
 *
 * Exposes: window.newshubGlobalConflictParties = { reset: fn }
 */
(function () {
  'use strict';

  const hiddenInput = document.getElementById('global-conflict-parties-json');
  const listContainer = document.getElementById('conflict-parties-list');
  const addButtonsContainer = document.getElementById('conflict-party-add-buttons');
  const emptyState = document.getElementById('conflict-party-empty-state');

  if (!hiddenInput || !listContainer || !addButtonsContainer) return;

  /* ========== Reference Data ========== */

  function parseJsonData(id) {
    let el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
  }

  const involvementTypes = parseJsonData('actor-involvement-types-data');
  const countries = parseJsonData('countries-data');

  /* Map role codes to involvement type IDs for quick-add buttons */
  const roleToInvolvementId = {};
  for (let i = 0; i < involvementTypes.length; i++) {
    const code = (involvementTypes[i].status_code || '').toLowerCase();
    roleToInvolvementId[code] = involvementTypes[i].status_id;
  }

  /* Role display config — keys match actor_involvement_type_code (lowercased) */
  const ROLE_CONFIG = {
    accused: {
      labelBn: '\u0986\u0995\u09CD\u09B0\u09AE\u09A3\u0995\u09BE\u09B0\u09C0',
      labelEn: 'Aggressor',
      cssClass: 'role-accused',
      cardClass: 'actor-card-accused'
    },
    victim: {
      labelBn: '\u09AA\u09CD\u09B0\u09A4\u09BF\u09B0\u0995\u09CD\u09B7\u09BE\u0995\u09BE\u09B0\u09C0',
      labelEn: 'Defender',
      cssClass: 'role-victim',
      cardClass: 'actor-card-victim'
    },
    witness: {
      labelBn: '\u09AE\u09BF\u09A4\u09CD\u09B0/\u09AA\u09B0\u09CD\u09AF\u09AC\u09C7\u0995\u09CD\u09B7\u0995',
      labelEn: 'Ally/Observer',
      cssClass: 'role-witness',
      cardClass: 'actor-card-witness'
    }
  };

  /* ========== State ========== */

  let parties = [];
  let tomSelectInstances = [];

  /* ========== Helpers ========== */

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ========== Sync to Hidden Input ========== */

  function syncToHiddenInput() {
    hiddenInput.value = parties.length ? JSON.stringify(parties) : '';
    const event = document.createEvent('Event');
    event.initEvent('change', true, true);
    hiddenInput.dispatchEvent(event);
  }

  /* ========== Build Card HTML ========== */

  function buildCountryOptions(selectedId) {
    let html = '<option value="">-- \u09A6\u09C7\u09B6 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 (Select Country) --</option>';
    for (let i = 0; i < countries.length; i++) {
      const c = countries[i];
      const selected = (c.country_id === selectedId) ? ' selected' : '';
      html += '<option value="' + c.country_id + '"' + selected + '>'
        + (c.country_name_bn || '') + ' (' + (c.country_name_en || '') + ')'
        + '</option>';
    }
    return html;
  }

  function buildCardHtml(party, index) {
    let config = ROLE_CONFIG[party.role] || ROLE_CONFIG.accused;

    let html = '<div class="actor-card ' + config.cardClass + '" data-index="' + index + '">';

    /* Header: role badge + remove */
    html += '<div class="actor-card-header">';
    html += '<span class="actor-role-badge ' + config.cssClass + '">'
      + config.labelBn + ' (' + config.labelEn + ')</span>';
    html += '<button type="button" class="button-repeater-delete actor-remove-button" data-index="' + index
      + '" title="\u09A1\u09BF\u09B2\u09BF\u099F \u0995\u09B0\u09C1\u09A8 (Delete)">'
      + '\u09A1\u09BF\u09B2\u09BF\u099F <span class="button-delete-x">&times;</span></button>';
    html += '</div>';

    /* Country select */
    html += '<div class="form-field">';
    html += '<label>\u09A6\u09C7\u09B6 (Country) <span class="field-required">*</span></label>';
    html += '<select class="conflict-party-field conflict-party-country" data-index="' + index + '" data-field="countryId">';
    html += buildCountryOptions(party.countryId);
    html += '</select>';
    html += '</div>';

    /* Alliance + Leader row */
    html += '<div class="form-row-half">';
    html += '<div class="form-field">';
    html += '<label>\u099C\u09CB\u099F/\u09AE\u09C8\u09A4\u09CD\u09B0\u09C0 (Alliance/Coalition)</label>';
    html += '<input type="text" class="conflict-party-field" data-index="' + index
      + '" data-field="alliance" value="' + escapeAttr(party.alliance || '')
      + '" maxlength="200" placeholder="\u09AF\u09C7\u09AE\u09A8: NATO, BRICS, AUKUS...">';
    html += '</div>';
    html += '<div class="form-field">';
    html += '<label>\u09A8\u09C7\u09A4\u09BE/\u09B8\u09BF\u09A6\u09CD\u09A7\u09BE\u09A8\u09CD\u09A4\u0995\u09BE\u09B0\u09C0 (Leader/Decision Maker)</label>';
    html += '<input type="text" class="conflict-party-field" data-index="' + index
      + '" data-field="leaderName" value="' + escapeAttr(party.leaderName || '')
      + '" maxlength="200" placeholder="\u09B0\u09BE\u09B7\u09CD\u099F\u09CD\u09B0\u09AA\u09CD\u09B0\u09A7\u09BE\u09A8/\u09AA\u09CD\u09B0\u09A7\u09BE\u09A8\u09AE\u09A8\u09CD\u09A4\u09CD\u09B0\u09C0\u09B0 \u09A8\u09BE\u09AE">';
    html += '</div>';
    html += '</div>';

    /* Statement */
    html += '<div class="form-field">';
    html += '<label>\u0985\u09AC\u09B8\u09CD\u09A5\u09BE\u09A8/\u09AC\u0995\u09CD\u09A4\u09AC\u09CD\u09AF (Official Statement/Position)</label>';
    html += '<textarea class="conflict-party-field" data-index="' + index
      + '" data-field="statement" rows="2" maxlength="2000"'
      + ' placeholder="\u09A6\u09C7\u09B6\u09C7\u09B0 \u0986\u09A8\u09C1\u09B7\u09CD\u09A0\u09BE\u09A8\u09BF\u0995 \u0985\u09AC\u09B8\u09CD\u09A5\u09BE\u09A8 \u09AC\u09BE \u09AC\u0995\u09CD\u09A4\u09AC\u09CD\u09AF... (Official position or statement...)">'
      + escapeHtml(party.statement || '') + '</textarea>';
    html += '</div>';

    html += '</div>'; /* .actor-card */

    return html;
  }

  /* ========== Render ========== */

  function render() {
    /* Destroy existing Tom Select instances */
    for (let t = 0; t < tomSelectInstances.length; t++) {
      tomSelectInstances[t].destroy();
    }
    tomSelectInstances = [];

    if (!parties.length) {
      listContainer.innerHTML = '';
      if (emptyState) emptyState.style.display = '';
      syncToHiddenInput();
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    let html = '';
    for (let i = 0; i < parties.length; i++) {
      html += buildCardHtml(parties[i], i);
    }
    listContainer.innerHTML = html;

    /* Init Tom Select on country dropdowns */
    const selects = listContainer.querySelectorAll('.conflict-party-country');
    for (let s = 0; s < selects.length; s++) {
      try {
        const ts = new TomSelect(selects[s], {
          allowEmptyOption: true,
          create: false,
          sortField: { field: 'text', direction: 'asc' }
        });
        tomSelectInstances.push(ts);
      } catch (e) {
        /* TomSelect not loaded — native select fallback */
      }
    }

    /* Wire events */
    wireCardEvents();
    syncToHiddenInput();
  }

  /* ========== Card Events ========== */

  function wireCardEvents() {
    /* Field changes */
    const fields = listContainer.querySelectorAll('.conflict-party-field');
    for (let i = 0; i < fields.length; i++) {
      fields[i].addEventListener('input', onFieldChange);
      fields[i].addEventListener('change', onFieldChange);
    }

    /* Remove buttons */
    const removeBtns = listContainer.querySelectorAll('.actor-remove-button');
    for (let r = 0; r < removeBtns.length; r++) {
      removeBtns[r].addEventListener('click', onRemove);
    }
  }

  function onFieldChange(e) {
    const el = e.target;
    let index = parseInt(el.getAttribute('data-index'), 10);
    const field = el.getAttribute('data-field');
    if (isNaN(index) || !field || !parties[index]) return;

    if (field === 'countryId') {
      parties[index][field] = parseInt(el.value, 10) || 0;
    } else {
      parties[index][field] = el.value;
    }
    syncToHiddenInput();
  }

  function onRemove(e) {
    const index = parseInt(e.currentTarget.getAttribute('data-index'), 10);
    if (isNaN(index)) return;
    parties.splice(index, 1);
    render();
  }

  /* ========== Add Party ========== */

  function addParty(role) {
    const involvementTypeId = roleToInvolvementId[role] || 0;
    parties.push({
      role: role,
      involvementTypeId: involvementTypeId,
      countryId: 0,
      alliance: '',
      leaderName: '',
      statement: ''
    });
    render();
  }

  /* ========== Button Wiring ========== */

  const addButtons = addButtonsContainer.querySelectorAll('.actor-add-button');
  for (let b = 0; b < addButtons.length; b++) {
    addButtons[b].addEventListener('click', function () {
      const role = this.getAttribute('data-role') || 'accused';
      addParty(role);
    });
  }

  /* Serialize before form submit */
  const form = hiddenInput.closest('form');
  if (form) {
    form.addEventListener('submit', syncToHiddenInput);
  }

  /* ========== Step Validation ========== */
  /* Register validator: at least one party with a country selected */
  if (window.newshubStepValidators) {
    window.newshubStepValidators.push({
      panelId: 'section-conflict-parties',
      validate: function () {
        if (!parties.length) return [];
        const errors = [];
        for (let i = 0; i < parties.length; i++) {
          if (!parties[i].countryId) {
            const config = ROLE_CONFIG[parties[i].role] || ROLE_CONFIG.accused;
            errors.push(config.labelBn + ' #' + (i + 1) + ': \u09A6\u09C7\u09B6 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 (Select a country)');
          }
        }
        return errors;
      }
    });
  }

  /* ========== Initial Render ========== */

  render();

  /* ========== Restore from saved hidden input JSON ========== */

  function restoreFromSavedData() {
    if (!hiddenInput.value) return;
    try {
      const saved = JSON.parse(hiddenInput.value);
      if (!Array.isArray(saved) || !saved.length) return;
      parties = saved;
      render();
    } catch (e) { /* ignore parse errors */ }
  }

  setTimeout(restoreFromSavedData, 100);

  /* ========== Public API ========== */

  window.newshubGlobalConflictParties = {
    reset: function () {
      parties = [];
      render();
    }
  };

  /* SPA cleanup — destroy Tom Select instances on page transition */
  if (window.spaCleanupRegister) {
    window.spaCleanupRegister(function () {
      for (var i = 0; i < tomSelectInstances.length; i++) {
        tomSelectInstances[i].destroy();
      }
      tomSelectInstances = [];
    });
  }
})();
