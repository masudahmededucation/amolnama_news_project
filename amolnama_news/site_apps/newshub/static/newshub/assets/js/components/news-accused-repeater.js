/**
 * news-accused-repeater.js
 * Single-role repeater for accused persons (অভিযুক্ত/আসামি).
 * Users add person cards via an "Add Accused" button, fill in details,
 * and the data is serialized to a hidden JSON input for form submission.
 *
 * DOM dependencies:
 *   #accused-json                  — hidden input (JSON payload, name="accused_json")
 *   #accused-list                  — container where cards are rendered
 *   #accused-add-btn               — single add button
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

  var hiddenInput = document.getElementById('accused-json');
  var listContainer = document.getElementById('accused-list');
  var addBtn = document.getElementById('accused-add-btn');
  var emptyState = document.getElementById('accused-empty-state');

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

  /* Map actorTypeId → status_code (for dynamic placeholder) */
  var actorTypeIdToCode = {};
  for (var i = 0; i < actorTypes.length; i++) {
    actorTypeIdToCode[actorTypes[i].status_id] = (actorTypes[i].status_code || '').toUpperCase();
  }

  /* Context-appropriate placeholder per incident_involved_actor_type code (lowercase) */
  var actorTypeDetailPlaceholders = {
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
  var actorTypeDetailDefaultPlaceholder = '\u09AF\u09C7\u09AE\u09A8: \u09AC\u09BF\u098F\u09A8\u09AA\u09BF \u0995\u09B0\u09CD\u09AE\u09C0, \u0986\u0993\u09AF\u09BC\u09BE\u09AE\u09C0 \u09B2\u09C0\u0997 \u09A8\u09C7\u09A4\u09BE';

  /* Actor types for accused: exclude victim-only types */
  function getAccusedActorTypes() {
    if (!actorTypes.length) return [];
    var hasGroupCodes = false;
    var filtered = [];
    for (var i = 0; i < actorTypes.length; i++) {
      var g = (actorTypes[i].actor_group_code || '').toUpperCase();
      if (g) hasGroupCodes = true;
      if (g !== 'VICTIM') filtered.push(actorTypes[i]);
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
    var types = getAccusedActorTypes();
    var html = '<option value="">-- \u09A7\u09B0\u09A8 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 (Select Type) --</option>';
    /* Put অজ্ঞাতনামা ব্যক্তি (unknown_person) first, separated from others */
    var unknownItem = null;
    var otherItems = [];
    for (var i = 0; i < types.length; i++) {
      var code = (types[i].status_code || '').toLowerCase();
      if (code === 'unidentified_anonymous' || code === 'unknown_person' || code === 'unknown') {
        unknownItem = types[i];
      } else {
        otherItems.push(types[i]);
      }
    }
    if (unknownItem) {
      var sel = (unknownItem.status_id === selectedId) ? ' selected' : '';
      html += '<option value="' + unknownItem.status_id + '"' + sel + '>'
        + (unknownItem.status_name_bn || unknownItem.status_name_en || '') + '</option>';
      html += '<option disabled>\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500</option>';
    }
    for (var j = 0; j < otherItems.length; j++) {
      var t = otherItems[j];
      var s = (t.status_id === selectedId) ? ' selected' : '';
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
    var html = '<div class="actor-card actor-card-accused" data-index="' + index + '">';

    /* Header */
    html += '<div class="actor-card-header">';
    html += '<span class="actor-role-badge role-accused">'
      + '\u0985\u09AD\u09BF\u09AF\u09C1\u0995\u09CD\u09A4 (Accused/Suspect)</span>';
    html += '<button type="button" class="btn-repeater-delete accused-remove-btn" data-index="' + index
      + '" title="\u09A1\u09BF\u09B2\u09BF\u099F \u0995\u09B0\u09C1\u09A8 (Delete)">'
      + '\u09A1\u09BF\u09B2\u09BF\u099F <span class="btn-delete-x">&times;</span></button>';
    html += '</div>';

    /* Type — own row */
    html += '<div class="form-field">';
    html += '<label>\u09B8\u0982\u09B6\u09CD\u09B2\u09BF\u09B7\u09CD\u099F \u09AA\u0995\u09CD\u09B7\u09C7\u09B0 \u09A7\u09B0\u09A3 (Type of Involved Party)</label>';
    html += '<select class="accused-field" data-index="' + index + '" data-field="actorTypeId">';
    html += buildActorTypeOptions(actor.actorTypeId);
    html += '</select>';
    html += '</div>';

    /* Type detail — freetext elaboration (placeholder driven by selected type) */
    var typeDetailPh = (function () {
      var tc = actorTypeIdToCode[actor.actorTypeId] || '';
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
    var btn = e.target.closest('.accused-remove-btn');
    if (!btn) return;
    var idx = parseInt(btn.getAttribute('data-index'), 10);
    if (isNaN(idx)) return;
    actors.splice(idx, 1);
    render();
  });

  /* Text / number input */
  listContainer.addEventListener('input', function (e) {
    var field = e.target.closest('.accused-field');
    if (!field || field.tagName === 'SELECT') return;
    var idx = parseInt(field.getAttribute('data-index'), 10);
    var key = field.getAttribute('data-field');
    if (isNaN(idx) || !key || !actors[idx]) return;
    actors[idx][key] = field.value;
    syncToHiddenInput();
  });

  /* Select change + date change (Flatpickr fires change on original input) */
  listContainer.addEventListener('change', function (e) {
    var field = e.target.closest('.accused-field');
    if (!field) return;
    var idx = parseInt(field.getAttribute('data-index'), 10);
    var key = field.getAttribute('data-field');
    if (isNaN(idx) || !key || !actors[idx]) return;
    if (field.tagName === 'SELECT') {
      /* All selects now store numeric IDs (actorTypeId, genderId, religionId) */
      var parsed = parseInt(field.value, 10);
      actors[idx][key] = isNaN(parsed) ? 0 : parsed;

      /* Update actorTypeDetail placeholder based on selected type */
      if (key === 'actorTypeId') {
        var typeCode = actorTypeIdToCode[parsed] || '';
        var ph = actorTypeDetailPlaceholders[typeCode] || actorTypeDetailDefaultPlaceholder;
        var card = field.closest('.actor-card');
        if (card) {
          var detailInput = card.querySelector('[data-field="actorTypeDetail"]');
          if (detailInput) detailInput.placeholder = ph;
        }
      }
    } else {
      actors[idx][key] = field.value;
    }
    syncToHiddenInput();
  });

  /* Add button */
  var nameDefaults = window.newshubPersonName.nameDefaults;
  var identityDefaults = window.newshubPersonIdentity.identityDefaults;
  var partyDefaults = window.newshubPersonPartyDetails.partyDefaults;

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
