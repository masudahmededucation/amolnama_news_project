/**
 * news-victim-repeater.js
 * Single-role repeater for victims (ভুক্তভোগী).
 * Supports optional crime-specific fields (condition dropdown + medical location)
 * when #crime-actor-config JSON element is present in the DOM.
 *
 * DOM dependencies:
 *   #victim-json                   — hidden input (JSON payload, name="victim_json")
 *   #victim-list                   — container where cards are rendered
 *   #victim-add-button                — single add button
 *   #victim-empty-state            — "no persons" message
 *   #actor-involvement-types-data  — CSP-safe JSON (in accused-form.html, shared)
 *   #actor-types-data              — CSP-safe JSON (in accused-form.html, shared)
 *   #victim-health-statuses-data   — CSP-safe JSON (in victim-form-crime.html, crime only)
 *   #crime-actor-config            — CSP-safe JSON flag (in victim-form-crime.html, crime only)
 *
 * JSON per card:
 *   { role, involvementTypeId, actorTypeId, firstNameEn, lastNameEn, firstNameBn, lastNameBn,
 *     fatherFirstName, fatherLastName, genderId, religionId,
 *     age, dob, districtId, alias, designation, organization, patron,
 *     contact, statement [, conditionId, medicalLocation] }
 *
 * Exposes: window.newshubVictim = { reset: fn }
 */
(function () {
  'use strict';

  const hiddenInput = document.getElementById('victim-json');
  const listContainer = document.getElementById('victim-list');
  const addBtn = document.getElementById('victim-add-button');
  const emptyState = document.getElementById('victim-empty-state');

  if (!hiddenInput || !listContainer || !addBtn) return;

  /* ========== Reference Data ========== */

  function parseJsonData(id) {
    let el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent); } catch (e) { return []; }
  }

  const involvementTypes = parseJsonData('actor-involvement-types-data');
  const actorTypes = parseJsonData('actor-types-data');
  const genders   = parseJsonData('actor-genders-data');
  const religions = parseJsonData('actor-religions-data');
  const districts = parseJsonData('actor-districts-data');
  const identityRefData = { genders: genders, religions: religions, districts: districts };

  const victimHealthStatuses = parseJsonData('victim-health-statuses-data');

  /* Crime-specific: show victim condition & medical location fields */
  const crimeActorConfig = (function () {
    const el = document.getElementById('crime-actor-config');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  })();
  const showVictimCondition = crimeActorConfig && crimeActorConfig.showVictimCondition;
  const showMedicalLocation = crimeActorConfig && crimeActorConfig.showMedicalLocation;

  /* Map role codes to involvement type IDs */
  const roleToInvolvementId = {};
  for (let i = 0; i < involvementTypes.length; i++) {
    const code = (involvementTypes[i].status_code || '').toLowerCase();
    roleToInvolvementId[code] = involvementTypes[i].status_id;
  }

  /* Actor types for victim: exclude accused-only types */
  function getVictimActorTypes() {
    if (!actorTypes.length) return [];
    let hasGroupCodes = false;
    const filtered = [];
    for (let i = 0; i < actorTypes.length; i++) {
      const g = (actorTypes[i].actor_group_code || '');
      if (g) hasGroupCodes = true;
      if (g !== 'accused') filtered.push(actorTypes[i]);
    }
    return hasGroupCodes ? filtered : actorTypes;
  }

  /* ========== State ========== */

  let actors = [];

  /* ========== Helpers ========== */

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ========== Sync to Hidden Input ========== */

  function syncToHiddenInput() {
    hiddenInput.value = actors.length ? JSON.stringify(actors) : '';
    const event = document.createEvent('Event');
    event.initEvent('change', true, true);
    hiddenInput.dispatchEvent(event);
  }

  /* ========== Build Card HTML ========== */

  function buildActorTypeOptions(selectedId) {
    const types = getVictimActorTypes();
    let html = '<option value="">-- \u09A7\u09B0\u09A8 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 (Select Type) --</option>';
    for (let i = 0; i < types.length; i++) {
      const t = types[i];
      let sel = (t.status_id === selectedId) ? ' selected' : '';
      html += '<option value="' + t.status_id + '"' + sel + '>'
        + (t.status_name_bn || t.status_name_en || '') + '</option>';
    }
    return html;
  }

  function buildTextField(index, field, label, value, maxlength, placeholder) {
    return '<div class="form-field">'
      + '<label>' + label + '</label>'
      + '<input type="text" class="victim-field" data-index="' + index
      + '" data-field="' + field + '" value="' + escapeAttr(value || '')
      + '" maxlength="' + maxlength + '" placeholder="' + escapeAttr(placeholder || '') + '">'
      + '</div>';
  }

  function buildCardHtml(actor, index) {
    let html = '<div class="actor-card actor-card-victim" data-index="' + index + '">';

    /* Header */
    html += '<div class="actor-card-header">';
    html += '<span class="actor-role-badge role-victim">'
      + '\u09AD\u09C1\u0995\u09CD\u09A4\u09AD\u09CB\u0997\u09C0 (Victim)</span>';
    html += '<button type="button" class="button-repeater-delete victim-remove-button" data-index="' + index
      + '" title="\u09A1\u09BF\u09B2\u09BF\u099F \u0995\u09B0\u09C1\u09A8 (Delete)">'
      + '\u09A1\u09BF\u09B2\u09BF\u099F <span class="button-delete-x">&times;</span></button>';
    html += '</div>';

    /* Type — own row */
    html += '<div class="form-field">';
    html += '<label>\u09B8\u0982\u09B6\u09CD\u09B2\u09BF\u09B7\u09CD\u099F \u09AA\u0995\u09CD\u09B7\u09C7\u09B0 \u09A7\u09B0\u09A3 (Type of Involved Party)</label>';
    html += '<select class="victim-field" data-index="' + index + '" data-field="actorTypeId">';
    html += buildActorTypeOptions(actor.actorTypeId);
    html += '</select>';
    html += '</div>';

    /* Type detail — freetext elaboration */
    html += buildTextField(index, 'actorTypeDetail',
      '\u09A7\u09B0\u09A8\u09C7\u09B0 \u09AC\u09BF\u09B8\u09CD\u09A4\u09BE\u09B0\u09BF\u09A4 (Type Details)',
      actor.actorTypeDetail, 100,
      '\u09AF\u09C7\u09AE\u09A8: \u0997\u09C3\u09B9\u09BF\u09A3\u09C0, \u09B6\u09BF\u0995\u09CD\u09B7\u09BE\u09B0\u09CD\u09A5\u09C0, \u09B6\u09CD\u09B0\u09AE\u09BF\u0995');

    /* Name group — shared module (news-person-name.js) */
    html += window.newshubPersonName.buildNameGroupHtml(index, actor, 'victim-field');

    /* --- Condition & Medical (crime-specific, after name group) --- */
    if (showVictimCondition) {
      html += '<div class="actor-group actor-group-condition">';
      html += '<h5 class="actor-group-title">\u0985\u09AC\u09B8\u09CD\u09A5\u09BE \u0993 \u099A\u09BF\u0995\u09BF\u09CE\u09B8\u09BE (Condition & Medical)</h5>';
      html += '<div class="form-row-half">';
      html += '<div class="form-field">';
      html += '<label>\u0985\u09AC\u09B8\u09CD\u09A5\u09BE (Condition)</label>';
      html += '<select class="victim-field" data-index="' + index + '" data-field="conditionId">';
      html += '<option value="">-- \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 (Select) --</option>';
      for (let c = 0; c < victimHealthStatuses.length; c++) {
        const hs = victimHealthStatuses[c];
        const sel = (actor.conditionId === hs.status_id) ? ' selected' : '';
        html += '<option value="' + hs.status_id + '"' + sel + '>'
          + hs.status_name_bn + ' (' + hs.status_name_en + ')</option>';
      }
      html += '</select>';
      html += '</div>';
      if (showMedicalLocation) {
        html += buildTextField(index, 'medicalLocation',
          '\u099A\u09BF\u0995\u09BF\u09CE\u09B8\u09BE \u09B8\u09CD\u09A5\u09BE\u09A8 (Medical Location)',
          actor.medicalLocation, 100,
          '\u09B9\u09BE\u09B8\u09AA\u09BE\u09A4\u09BE\u09B2\u09C7\u09B0 \u09A8\u09BE\u09AE (Hospital name)');
      } else {
        html += '<div class="form-field"></div>';
      }
      html += '</div>';
      html += '</div>'; /* .actor-group (Condition & Medical) */
    }

    /* Details */
    html += '<div class="actor-details">';

    /* --- Group 1: Personal Identity (shared module) --- */
    html += window.newshubPersonIdentity.buildIdentityGroupHtml(index, actor, 'victim-field', identityRefData);

    /* --- Group 2: Party Details (shared module: news-person-party-details.js) --- */
    html += window.newshubPersonPartyDetails.buildPartyDetailsGroupHtml(index, actor, 'victim-field');

    html += '</div>'; /* .actor-details */
    html += '</div>'; /* .actor-card */

    return html;
  }

  /* ========== Render ========== */

  function render() {
    if (!actors.length) {
      listContainer.innerHTML = '';
      if (emptyState) emptyState.style.display = '';
    } else {
      let html = '';
      for (let i = 0; i < actors.length; i++) {
        html += buildCardHtml(actors[i], i);
      }
      listContainer.innerHTML = html;
      if (emptyState) emptyState.style.display = 'none';
    }
    syncToHiddenInput();
    /* Initialize Flatpickr on date inputs and Tom Select on district selects */
    if (window.newshubDatePicker) window.newshubDatePicker.init();
    window.newshubPersonIdentity.initDistrictTomSelects(listContainer, function(selectEl, value) {
      let index = parseInt(selectEl.getAttribute('data-index'), 10);
      if (!isNaN(index) && actors[index]) {
        actors[index].districtId = parseInt(value, 10) || 0;
        syncToHiddenInput();
      }
    });
  }

  /* ========== Event Delegation ========== */

  listContainer.addEventListener('click', function (e) {
    const button = e.target.closest('.victim-remove-button');
    if (!button) return;
    let index = parseInt(button.getAttribute('data-index'), 10);
    if (isNaN(index)) return;
    actors.splice(index, 1);
    render();
  });

  /* Text / number input */
  listContainer.addEventListener('input', function (e) {
    let field = e.target.closest('.victim-field');
    if (!field || field.tagName === 'SELECT') return;
    let index = parseInt(field.getAttribute('data-index'), 10);
    let key = field.getAttribute('data-field');
    if (isNaN(index) || !key || !actors[index]) return;
    actors[index][key] = field.value;
    syncToHiddenInput();
  });

  /* Select change + date change (Flatpickr fires change on original input) */
  listContainer.addEventListener('change', function (e) {
    const field = e.target.closest('.victim-field');
    if (!field) return;
    const index = parseInt(field.getAttribute('data-index'), 10);
    const key = field.getAttribute('data-field');
    if (isNaN(index) || !key || !actors[index]) return;
    if (field.tagName === 'SELECT') {
      /* All selects store numeric IDs (actorTypeId, genderId, religionId, conditionId) */
      let parsed = parseInt(field.value, 10);
      actors[index][key] = isNaN(parsed) ? 0 : parsed;
    } else {
      actors[index][key] = field.value;
    }
    syncToHiddenInput();
  });

  const nameDefaults = window.newshubPersonName.nameDefaults;
  const identityDefaults = window.newshubPersonIdentity.identityDefaults;
  const partyDefaults = window.newshubPersonPartyDetails.partyDefaults;

  /* Add button */
  addBtn.addEventListener('click', function () {
    const actor = Object.assign({
      role: 'victim',
      involvementTypeId: roleToInvolvementId['victim'] || 0,
      actorTypeId: 0,
      actorTypeDetail: ''
    }, nameDefaults(), identityDefaults(), partyDefaults());
    if (showVictimCondition) {
      actor.conditionId = 0;
      actor.medicalLocation = '';
    }
    actors.push(actor);
    render();
  });

  /* Re-sync before form submit */
  const form = hiddenInput.closest('form');
  if (form) {
    form.addEventListener('submit', syncToHiddenInput);
  }

  /* ========== Restore from Hidden Input ========== */

  function restoreFromHiddenInput() {
    const raw = hiddenInput.value;
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        actors = parsed;
        render();
      }
    } catch (e) { /* ignore */ }
  }

  /* ========== Step Validator ========== */

  const panel = hiddenInput.closest('.step-panel[data-step]');
  if (panel) {
    const step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({
      step: step,
      fn: function () {
        const warnings = [];
        for (let i = 0; i < actors.length; i++) {
          if (!actors[i].firstNameEn || !actors[i].firstNameEn.trim()) {
            warnings.push('\u09AD\u09C1\u0995\u09CD\u09A4\u09AD\u09CB\u0997\u09C0 #' + (i + 1)
              + ' \u2014 \u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE \u09A6\u09BF\u09A8 (Please enter first name)');
          }
        }
        return { warnings: warnings };
      }
    });
  }

  /* ========== Public API ========== */

  window.newshubVictim = {
    reset: function () {
      actors = [];
      render();
    }
  };

  /* ========== Init ========== */

  restoreFromHiddenInput();
  /* Do NOT auto-add a blank card — victim is optional */
  render();

})();
