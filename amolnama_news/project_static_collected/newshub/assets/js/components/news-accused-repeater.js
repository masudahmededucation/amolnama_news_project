/**
 * news-accused-repeater.js
 * Single-role repeater for accused persons (অভিযুক্ত/আসামি).
 * Users add person cards via an "Add Accused" button, fill in details,
 * and the data is serialized to a hidden JSON input for form submission.
 *
 * DOM dependencies:
 *   #accused-json                  — hidden input (JSON payload, name="accused_json")
 *   #accused-list                  — container where cards are rendered
 *   #accused-add-button               — single add button
 *   #accused-empty-state           — "no persons" message
 *   #actor-involvement-types-data  — CSP-safe JSON (shared; in accused-form.html)
 *   #actor-types-data              — CSP-safe JSON (shared; in accused-form.html)
 *
 * JSON per card:
 *   { role, involvementTypeId, actorTypeId, firstNameEn, lastNameEn, firstNameBn, lastNameBn,
 *     fatherFirstName, fatherLastName, genderId, religionId,
 *     age, dob, districtId, alias, designation, organization, patron,
 *     contact, statement }
 *
 * Exposes: window.newshubAccused = { reset: fn }
 */
(function () {
  'use strict';

  const hiddenInput = document.getElementById('accused-json');
  const listContainer = document.getElementById('accused-list');
  const addBtn = document.getElementById('accused-add-button');
  const emptyState = document.getElementById('accused-empty-state');

  if (!hiddenInput || !listContainer || !addBtn) return;

  /* ========== Reference Data ========== */

  function parseJsonData(id) {
    const el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent); } catch (e) { return []; }
  }

  const involvementTypes = parseJsonData('actor-involvement-types-data');
  const actorTypes = parseJsonData('actor-types-data');
  const genders   = parseJsonData('actor-genders-data');
  const religions = parseJsonData('actor-religions-data');
  const districts = parseJsonData('actor-districts-data');

  const identityRefData = { genders: genders, religions: religions, districts: districts };

  /* Map role codes to involvement type IDs */
  const roleToInvolvementId = {};
  for (let i = 0; i < involvementTypes.length; i++) {
    let code = (involvementTypes[i].status_code || '').toLowerCase();
    roleToInvolvementId[code] = involvementTypes[i].status_id;
  }

  /* Map actorTypeId → status_code (for dynamic placeholder) */
  const actorTypeIdToCode = {};
  for (let i = 0; i < actorTypes.length; i++) {
    actorTypeIdToCode[actorTypes[i].status_id] = (actorTypes[i].status_code || '');
  }

  /* Context-appropriate placeholder per incident_involved_actor_type code (lowercase) */
  const actorTypeDetailPlaceholders = {
    'BUSINESS_ORGANIZATION':    '\u09AF\u09C7\u09AE\u09A8: \u09A1\u09C7\u09AD\u09C7\u09B2\u09AA\u09BE\u09B0 \u0995\u09CB\u09AE\u09CD\u09AA\u09BE\u09A8\u09BF, \u09B0\u09BF\u09AF\u09BC\u09C7\u09B2 \u098F\u09B8\u09CD\u099F\u09C7\u099F \u09AB\u09BE\u09B0\u09CD\u09AE',
    'CONSTRUCTION_CONTRACTOR':  '\u09AF\u09C7\u09AE\u09A8: \u09B0\u09BE\u09B8\u09CD\u09A4\u09BE \u09A0\u09BF\u0995\u09BE\u09A6\u09BE\u09B0, \u09AD\u09AC\u09A8 \u09A8\u09BF\u09B0\u09CD\u09AE\u09BE\u09A3 \u09AA\u09CD\u09B0\u09A4\u09BF\u09B7\u09CD\u09A0\u09BE\u09A8',
    'GENERAL_CITIZEN':          '\u09AF\u09C7\u09AE\u09A8: \u0995\u09C3\u09B7\u0995, \u09A6\u09BF\u09A8\u09AE\u099C\u09C1\u09B0, \u0997\u09C3\u09B9\u09B8\u09CD\u09A5',
    'GOVERNMENT_OFFICIAL_OFFICE':'\u09AF\u09C7\u09AE\u09A8: \u0987\u0989\u098F\u09A8\u0993 \u0995\u09B0\u09CD\u09AE\u0995\u09B0\u09CD\u09A4\u09BE, \u09AD\u09C2\u09AE\u09BF \u0985\u09AB\u09BF\u09B8, \u09B8\u09BF\u099F\u09BF \u0995\u09B0\u09CD\u09AA\u09CB\u09B0\u09C7\u09B6\u09A8',
    'INDIVIDUAL_IDENTIFIED_PERSON': '\u09AF\u09C7\u09AE\u09A8: \u09B8\u09BE\u09AC\u09C7\u0995 \u09AA\u09C1\u09B2\u09BF\u09B6, \u09AA\u09CD\u09B0\u09A4\u09BF\u09AC\u09C7\u09B6\u09C0',
    'KISHORE_GANG':             '\u09AF\u09C7\u09AE\u09A8: \u09B8\u09CD\u09A5\u09BE\u09A8\u09C0\u09AF\u09BC \u0995\u09BF\u09B6\u09CB\u09B0 \u0997\u09CD\u09AF\u09BE\u0982\u09AF\u09BC\u09C7\u09B0 \u09A8\u09BE\u09AE',
    'LAW_ENFORCEMENT_AGENCY':   '\u09AF\u09C7\u09AE\u09A8: \u09AA\u09C1\u09B2\u09BF\u09B6 \u09AA\u09B0\u09BF\u09A6\u09B0\u09CD\u09B6\u0995, \u09B0\u09CD\u09AF\u09BE\u09AC \u09B8\u09A6\u09B8\u09CD\u09AF, \u0986\u09A8\u09B8\u09BE\u09B0',
    'LOCAL_GROUP_SYNDICATE':    '\u09AF\u09C7\u09AE\u09A8: \u0987\u0989\u09AA\u09BF \u099A\u09C7\u09AF\u09BC\u09BE\u09B0\u09AE\u09CD\u09AF\u09BE\u09A8, \u09AE\u09BE\u09A4\u09AC\u09CD\u09AC\u09B0, \u09B8\u09BF\u09A8\u09CD\u09A1\u09BF\u0995\u09C7\u099F',
    'MEDIA_PRESS':              '\u09AF\u09C7\u09AE\u09A8: \u09B8\u09BE\u0982\u09AC\u09BE\u09A6\u09BF\u0995, \u099F\u09BF\u09AD\u09BF \u099A\u09CD\u09AF\u09BE\u09A8\u09C7\u09B2, \u09AA\u09A4\u09CD\u09B0\u09BF\u0995\u09BE',
    'POLITICAL_LEADER_PARTY':   '\u09AF\u09C7\u09AE\u09A8: \u09AC\u09BF\u098F\u09A8\u09AA\u09BF \u0995\u09B0\u09CD\u09AE\u09C0, \u0986\u0993\u09AF\u09BC\u09BE\u09AE\u09C0 \u09B2\u09C0\u0997 \u09A8\u09C7\u09A4\u09BE',
    'SHOPKEEPER_RETAILER':      '\u09AF\u09C7\u09AE\u09A8: \u09A6\u09CB\u0995\u09BE\u09A8\u09A6\u09BE\u09B0, \u09AA\u09BE\u0987\u0995\u09BE\u09B0\u09BF \u09AC\u09CD\u09AF\u09AC\u09B8\u09BE\u09AF\u09BC\u09C0',
    'STREET_HAWKER_VENDOR':     '\u09AF\u09C7\u09AE\u09A8: \u09AB\u09C1\u099F\u09AA\u09BE\u09A4 \u09B9\u0995\u09BE\u09B0, \u09AD\u09CD\u09B0\u09BE\u09AE\u09CD\u09AF\u09AE\u09BE\u09A3 \u09AC\u09BF\u0995\u09CD\u09B0\u09C7\u09A4\u09BE',
    'TRANSPORT_OWNER':          '\u09AF\u09C7\u09AE\u09A8: \u09AC\u09BE\u09B8 \u09AE\u09BE\u09B2\u09BF\u0995, \u09B2\u09BE\u0987\u09A8\u09AE\u09CD\u09AF\u09BE\u09A8',
    'TRANSPORT_WORKER_DRIVER':  '\u09AF\u09C7\u09AE\u09A8: \u09AC\u09BE\u09B8 \u099A\u09BE\u09B2\u0995, \u099F\u09CD\u09B0\u09BE\u0995 \u09B9\u09C7\u09B2\u09CD\u09AA\u09BE\u09B0',
    'UNIDENTIFIED_ANONYMOUS':   '\u09AF\u09C7\u09AE\u09A8: \u0985\u099C\u09CD\u099E\u09BE\u09A4 \u09AC\u09CD\u09AF\u0995\u09CD\u09A4\u09BF, \u09AE\u09C1\u0996\u09CB\u09B6 \u09A7\u09BE\u09B0\u09C0',
  };
  const actorTypeDetailDefaultPlaceholder ='\u09AF\u09C7\u09AE\u09A8: \u09AC\u09BF\u098F\u09A8\u09AA\u09BF \u0995\u09B0\u09CD\u09AE\u09C0, \u0986\u0993\u09AF\u09BC\u09BE\u09AE\u09C0 \u09B2\u09C0\u0997 \u09A8\u09C7\u09A4\u09BE';

  /* Actor types for accused: exclude victim-only types */
  function getAccusedActorTypes() {
    if (!actorTypes.length) return [];
    let hasGroupCodes = false;
    const filtered = [];
    for (let i = 0; i < actorTypes.length; i++) {
      const g = (actorTypes[i].actor_group_code || '');
      if (g) hasGroupCodes = true;
      if (g !== 'victim') filtered.push(actorTypes[i]);
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
    const types = getAccusedActorTypes();
    let html = '<option value="">-- \u09A7\u09B0\u09A8 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 (Select Type) --</option>';
    /* Put অজ্ঞাতনামা ব্যক্তি (unknown_person) first, separated from others */
    let unknownItem = null;
    const otherItems = [];
    for (let i = 0; i < types.length; i++) {
      const code = (types[i].status_code || '').toLowerCase();
      if (code === 'unidentified_anonymous' || code === 'unknown_person' || code === 'unknown') {
        unknownItem = types[i];
      } else {
        otherItems.push(types[i]);
      }
    }
    if (unknownItem) {
      const sel = (unknownItem.status_id === selectedId) ? ' selected' : '';
      html += '<option value="' + unknownItem.status_id + '"' + sel + '>'
        + (unknownItem.status_name_bn || unknownItem.status_name_en || '') + '</option>';
      html += '<option disabled>\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500</option>';
    }
    for (let j = 0; j < otherItems.length; j++) {
      const t = otherItems[j];
      const s = (t.status_id === selectedId) ? ' selected' : '';
      html += '<option value="' + t.status_id + '"' + s + '>'
        + (t.status_name_bn || t.status_name_en || '') + '</option>';
    }
    return html;
  }

  function buildTextField(index, field, label, value, maxlength, placeholder) {
    return '<div class="form-field">'
      + '<label>' + label + '</label>'
      + '<input type="text" class="accused-field" data-index="' + index
      + '" data-field="' + field + '" value="' + escapeAttr(value || '')
      + '" maxlength="' + maxlength + '" placeholder="' + escapeAttr(placeholder || '') + '">'
      + '</div>';
  }


  function buildCardHtml(actor, index) {
    let html = '<div class="actor-card actor-card-accused" data-index="' + index + '">';

    /* Header */
    html += '<div class="actor-card-header">';
    html += '<span class="actor-role-badge role-accused">'
      + '\u0985\u09AD\u09BF\u09AF\u09C1\u0995\u09CD\u09A4 (Accused/Suspect)</span>';
    html += '<button type="button" class="button-repeater-delete accused-remove-button" data-index="' + index
      + '" title="\u09A1\u09BF\u09B2\u09BF\u099F \u0995\u09B0\u09C1\u09A8 (Delete)">'
      + '\u09A1\u09BF\u09B2\u09BF\u099F <span class="button-delete-x">&times;</span></button>';
    html += '</div>';

    /* Type — own row */
    html += '<div class="form-field">';
    html += '<label>\u09B8\u0982\u09B6\u09CD\u09B2\u09BF\u09B7\u09CD\u099F \u09AA\u0995\u09CD\u09B7\u09C7\u09B0 \u09A7\u09B0\u09A3 (Type of Involved Party)</label>';
    html += '<select class="accused-field" data-index="' + index + '" data-field="actorTypeId">';
    html += buildActorTypeOptions(actor.actorTypeId);
    html += '</select>';
    html += '</div>';

    /* Type detail — freetext elaboration (placeholder driven by selected type) */
    const typeDetailPh = (function () {
      const tc = actorTypeIdToCode[actor.actorTypeId] || '';
      return actorTypeDetailPlaceholders[tc] || actorTypeDetailDefaultPlaceholder;
    })();
    html += buildTextField(index, 'actorTypeDetail',
      '\u09A7\u09B0\u09A8\u09C7\u09B0 \u09AC\u09BF\u09B8\u09CD\u09A4\u09BE\u09B0\u09BF\u09A4 (Type Details)',
      actor.actorTypeDetail, 100, typeDetailPh);

    /* Name group — shared module (news-person-name.js) */
    html += window.newshubPersonName.buildNameGroupHtml(index, actor, 'accused-field');

    /* Details */
    html += '<div class="actor-details">';

    /* --- Group 1: Personal Identity (shared module) --- */
    html += window.newshubPersonIdentity.buildIdentityGroupHtml(index, actor, 'accused-field', identityRefData);

    /* --- Group 2: Party Details (shared module: news-person-party-details.js) --- */
    html += window.newshubPersonPartyDetails.buildPartyDetailsGroupHtml(index, actor, 'accused-field');

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
    const button = e.target.closest('.accused-remove-button');
    if (!button) return;
    let index = parseInt(button.getAttribute('data-index'), 10);
    if (isNaN(index)) return;
    actors.splice(index, 1);
    render();
  });

  /* Text / number input */
  listContainer.addEventListener('input', function (e) {
    let field = e.target.closest('.accused-field');
    if (!field || field.tagName === 'SELECT') return;
    let index = parseInt(field.getAttribute('data-index'), 10);
    let key = field.getAttribute('data-field');
    if (isNaN(index) || !key || !actors[index]) return;
    actors[index][key] = field.value;
    syncToHiddenInput();
  });

  /* Select change + date change (Flatpickr fires change on original input) */
  listContainer.addEventListener('change', function (e) {
    let field = e.target.closest('.accused-field');
    if (!field) return;
    const index = parseInt(field.getAttribute('data-index'), 10);
    const key = field.getAttribute('data-field');
    if (isNaN(index) || !key || !actors[index]) return;
    if (field.tagName === 'SELECT') {
      /* All selects now store numeric IDs (actorTypeId, genderId, religionId) */
      let parsed = parseInt(field.value, 10);
      actors[index][key] = isNaN(parsed) ? 0 : parsed;

      /* Update actorTypeDetail placeholder based on selected type */
      if (key === 'actorTypeId') {
        const typeCode = actorTypeIdToCode[parsed] || '';
        const ph = actorTypeDetailPlaceholders[typeCode] || actorTypeDetailDefaultPlaceholder;
        const card = field.closest('.actor-card');
        if (card) {
          const detailInput = card.querySelector('[data-field="actorTypeDetail"]');
          if (detailInput) detailInput.placeholder = ph;
        }
      }
    } else {
      actors[index][key] = field.value;
    }
    syncToHiddenInput();
  });

  /* Add button */
  const nameDefaults = window.newshubPersonName.nameDefaults;
  const identityDefaults = window.newshubPersonIdentity.identityDefaults;
  const partyDefaults = window.newshubPersonPartyDetails.partyDefaults;

  addBtn.addEventListener('click', function () {
    actors.push(Object.assign({
      role: 'accused',
      involvementTypeId: roleToInvolvementId['accused'] || 0,
      actorTypeId: 0,
      actorTypeDetail: ''
    }, nameDefaults(), identityDefaults(), partyDefaults()));
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
            warnings.push('\u0985\u09AD\u09BF\u09AF\u09C1\u0995\u09CD\u09A4 #' + (i + 1)
              + ' \u2014 \u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE \u09A6\u09BF\u09A8 (Please enter first name)');
          }
        }
        return { warnings: warnings };
      }
    });
  }

  /* ========== Public API ========== */

  window.newshubAccused = {
    reset: function () {
      actors = [];
      render();
    }
  };

  /* ========== Init ========== */

  restoreFromHiddenInput();
  /* Do NOT auto-add a blank card — accused is optional */
  render();

})();
