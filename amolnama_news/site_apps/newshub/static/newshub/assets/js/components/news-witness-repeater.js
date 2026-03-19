/**
 * news-witness-repeater.js
 * Single-role repeater for witnesses (সাক্ষী).
 *
 * DOM dependencies:
 *   #witness-json                  — hidden input (JSON payload, name="witness_json")
 *   #witness-list                  — container where cards are rendered
 *   #witness-add-btn               — single add button
 *   #witness-empty-state           — "no persons" message
 *   #actor-involvement-types-data  — CSP-safe JSON (in accused-form.html, shared)
 *   #actor-types-data              — CSP-safe JSON (in accused-form.html, shared)
 *
 * JSON per card:
 *   { role, involvementTypeId, actorTypeId, firstNameEn, lastNameEn, firstNameBn, lastNameBn,
 *     fatherFirstName, fatherLastName, genderId, religionId,
 *     age, dob, districtId, alias, designation, organization, patron,
 *     contact, statement }
 *
 * Exposes: window.newshubWitness = { reset: fn }
 */
(function () {
  'use strict';

  var hiddenInput = document.getElementById('witness-json');
  var listContainer = document.getElementById('witness-list');
  var addBtn = document.getElementById('witness-add-btn');
  var emptyState = document.getElementById('witness-empty-state');

  if (!hiddenInput || !listContainer || !addBtn) return;

  /* ========== Reference Data ========== */

  function parseJsonData(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent); } catch (e) { return []; }
  }

  var involvementTypes = parseJsonData('actor-involvement-types-data');
  var actorTypes = parseJsonData('actor-types-data');
  var genders   = parseJsonData('actor-genders-data');
  var religions = parseJsonData('actor-religions-data');
  var districts = parseJsonData('actor-districts-data');

  var identityRefData = { genders: genders, religions: religions, districts: districts };

  /* Map role codes to involvement type IDs */
  var roleToInvolvementId = {};
  for (var i = 0; i < involvementTypes.length; i++) {
    var code = (involvementTypes[i].status_code || '').toLowerCase();
    roleToInvolvementId[code] = involvementTypes[i].status_id;
  }

  /* Actor types for witness: exclude accused-only types */
  function getWitnessActorTypes() {
    if (!actorTypes.length) return [];
    var hasGroupCodes = false;
    var filtered = [];
    for (var i = 0; i < actorTypes.length; i++) {
      var g = (actorTypes[i].actor_group_code || '').toUpperCase();
      if (g) hasGroupCodes = true;
      if (g !== 'ACCUSED') filtered.push(actorTypes[i]);
    }
    return hasGroupCodes ? filtered : actorTypes;
  }

  /* ========== State ========== */

  var actors = [];

  /* ========== Helpers ========== */

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ========== Sync to Hidden Input ========== */

  function syncToHiddenInput() {
    hiddenInput.value = actors.length ? JSON.stringify(actors) : '';
    var event = document.createEvent('Event');
    event.initEvent('change', true, true);
    hiddenInput.dispatchEvent(event);
  }

  /* ========== Build Card HTML ========== */

  function buildActorTypeOptions(selectedId) {
    var types = getWitnessActorTypes();
    var html = '<option value="">-- \u09A7\u09B0\u09A8 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 (Select Type) --</option>';
    for (var i = 0; i < types.length; i++) {
      var t = types[i];
      var sel = (t.status_id === selectedId) ? ' selected' : '';
      html += '<option value="' + t.status_id + '"' + sel + '>'
        + (t.status_name_bn || t.status_name_en || '') + '</option>';
    }
    return html;
  }

  function buildTextField(index, field, label, value, maxlength, placeholder) {
    return '<div class="form-field">'
      + '<label>' + label + '</label>'
      + '<input type="text" class="witness-field" data-index="' + index
      + '" data-field="' + field + '" value="' + escapeAttr(value || '')
      + '" maxlength="' + maxlength + '" placeholder="' + escapeAttr(placeholder || '') + '">'
      + '</div>';
  }

  function buildCardHtml(actor, index) {
    var html = '<div class="actor-card actor-card-witness" data-index="' + index + '">';

    /* Header */
    html += '<div class="actor-card-header">';
    html += '<span class="actor-role-badge role-witness">'
      + '\u09B8\u09BE\u0995\u09CD\u09B7\u09C0 (Witness)</span>';
    html += '<button type="button" class="btn-repeater-delete witness-remove-btn" data-index="' + index
      + '" title="\u09A1\u09BF\u09B2\u09BF\u099F \u0995\u09B0\u09C1\u09A8 (Delete)">'
      + '\u09A1\u09BF\u09B2\u09BF\u099F <span class="btn-delete-x">&times;</span></button>';
    html += '</div>';

    /* Type — own row */
    html += '<div class="form-field">';
    html += '<label>\u09B8\u0982\u09B6\u09CD\u09B2\u09BF\u09B7\u09CD\u099F \u09AA\u0995\u09CD\u09B7\u09C7\u09B0 \u09A7\u09B0\u09A3 (Type of Involved Party)</label>';
    html += '<select class="witness-field" data-index="' + index + '" data-field="actorTypeId">';
    html += buildActorTypeOptions(actor.actorTypeId);
    html += '</select>';
    html += '</div>';

    /* Type detail — freetext elaboration */
    html += buildTextField(index, 'actorTypeDetail',
      '\u09A7\u09B0\u09A8\u09C7\u09B0 \u09AC\u09BF\u09B8\u09CD\u09A4\u09BE\u09B0\u09BF\u09A4 (Type Details)',
      actor.actorTypeDetail, 100,
      '\u09AF\u09C7\u09AE\u09A8: \u09AA\u09CD\u09B0\u09A4\u09CD\u09AF\u0995\u09CD\u09B7\u09A6\u09B0\u09CD\u09B6\u09C0, \u09AA\u09CD\u09B0\u09A4\u09BF\u09AC\u09C7\u09B6\u09C0, \u09B8\u09B9\u0995\u09B0\u09CD\u09AE\u09C0');

    /* Name group — shared module (news-person-name.js) */
    html += window.newshubPersonName.buildNameGroupHtml(index, actor, 'witness-field');

    /* Details */
    html += '<div class="actor-details">';

    /* --- Group 1: Personal Identity (shared module) --- */
    html += window.newshubPersonIdentity.buildIdentityGroupHtml(index, actor, 'witness-field', identityRefData);

    /* --- Group 2: Party Details (shared module: news-person-party-details.js) --- */
    html += window.newshubPersonPartyDetails.buildPartyDetailsGroupHtml(index, actor, 'witness-field');

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
      var html = '';
      for (var i = 0; i < actors.length; i++) {
        html += buildCardHtml(actors[i], i);
      }
      listContainer.innerHTML = html;
      if (emptyState) emptyState.style.display = 'none';
    }
    syncToHiddenInput();
    /* Initialize Flatpickr on date inputs and Tom Select on district selects */
    if (window.newshubDatePicker) window.newshubDatePicker.init();
    window.newshubPersonIdentity.initDistrictTomSelects(listContainer, function(selectEl, value) {
      var idx = parseInt(selectEl.getAttribute('data-index'), 10);
      if (!isNaN(idx) && actors[idx]) {
        actors[idx].districtId = parseInt(value, 10) || 0;
        syncToHiddenInput();
      }
    });
  }

  /* ========== Event Delegation ========== */

  listContainer.addEventListener('click', function (e) {
    var btn = e.target.closest('.witness-remove-btn');
    if (!btn) return;
    var idx = parseInt(btn.getAttribute('data-index'), 10);
    if (isNaN(idx)) return;
    actors.splice(idx, 1);
    render();
  });

  /* Text / number input */
  listContainer.addEventListener('input', function (e) {
    var field = e.target.closest('.witness-field');
    if (!field || field.tagName === 'SELECT') return;
    var idx = parseInt(field.getAttribute('data-index'), 10);
    var key = field.getAttribute('data-field');
    if (isNaN(idx) || !key || !actors[idx]) return;
    actors[idx][key] = field.value;
    syncToHiddenInput();
  });

  /* Select change + date change (Flatpickr fires change on original input) */
  listContainer.addEventListener('change', function (e) {
    var field = e.target.closest('.witness-field');
    if (!field) return;
    var idx = parseInt(field.getAttribute('data-index'), 10);
    var key = field.getAttribute('data-field');
    if (isNaN(idx) || !key || !actors[idx]) return;
    if (field.tagName === 'SELECT') {
      /* All selects store numeric IDs (actorTypeId, genderId, religionId) */
      var parsed = parseInt(field.value, 10);
      actors[idx][key] = isNaN(parsed) ? 0 : parsed;
    } else {
      actors[idx][key] = field.value;
    }
    syncToHiddenInput();
  });

  var nameDefaults = window.newshubPersonName.nameDefaults;
  var identityDefaults = window.newshubPersonIdentity.identityDefaults;
  var partyDefaults = window.newshubPersonPartyDetails.partyDefaults;

  /* Add button */
  addBtn.addEventListener('click', function () {
    actors.push(Object.assign({
      role: 'witness',
      involvementTypeId: roleToInvolvementId['witness'] || 0,
      actorTypeId: 0,
      actorTypeDetail: ''
    }, nameDefaults(), identityDefaults(), partyDefaults()));
    render();
  });

  /* Re-sync before form submit */
  var form = hiddenInput.closest('form');
  if (form) {
    form.addEventListener('submit', syncToHiddenInput);
  }

  /* ========== Restore from Hidden Input ========== */

  function restoreFromHiddenInput() {
    var raw = hiddenInput.value;
    if (!raw) return;
    try {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        actors = parsed;
        render();
      }
    } catch (e) { /* ignore */ }
  }

  /* ========== Step Validator ========== */

  var panel = hiddenInput.closest('.step-panel[data-step]');
  if (panel) {
    var step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({
      step: step,
      fn: function () {
        var warnings = [];
        for (var i = 0; i < actors.length; i++) {
          if (!actors[i].firstNameEn || !actors[i].firstNameEn.trim()) {
            warnings.push('\u09B8\u09BE\u0995\u09CD\u09B7\u09C0 #' + (i + 1)
              + ' \u2014 \u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE \u09A6\u09BF\u09A8 (Please enter first name)');
          }
        }
        return { warnings: warnings };
      }
    });
  }

  /* ========== Public API ========== */

  window.newshubWitness = {
    reset: function () {
      actors = [];
      render();
    }
  };

  /* ========== Init ========== */

  restoreFromHiddenInput();
  if (!actors.length) {
    /* Pre-add one witness card so fields are visible without a button click */
    actors.push(Object.assign({
      role: 'witness',
      involvementTypeId: roleToInvolvementId['witness'] || 0,
      actorTypeId: 0,
      actorTypeDetail: ''
    }, nameDefaults(), identityDefaults(), partyDefaults()));
  }
  render();

})();
