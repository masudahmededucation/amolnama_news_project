/**
 * news-involved-parties.js
 * Dynamic repeater for involved parties (accused, victims, witnesses).
 * Users add person cards via quick-add buttons, fill in details,
 * and the data is serialized to a hidden JSON input for form submission.
 *
 * DOM dependencies:
 *   #involved-actors-json    — hidden input (JSON payload)
 *   #involved-actors-list    — container where cards are rendered
 *   #actor-add-buttons       — quick-add button group
 *   #actor-empty-state       — "no persons" message
 *   window.__actorInvolvementTypes — JSON array from view context
 *   window.__actorTypes            — JSON array from view context
 */
(function () {
  'use strict';

  const hiddenInput = document.getElementById('involved-actors-json');
  const listContainer = document.getElementById('involved-actors-list');
  const addButtonsContainer = document.getElementById('actor-add-buttons');
  const emptyState = document.getElementById('actor-empty-state');

  if (!hiddenInput || !listContainer || !addButtonsContainer) return;

  /* ========== Reference Data ========== */

  function parseJsonData(id) {
    let el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent); } catch (e) { return []; }
  }
  const involvementTypes = parseJsonData('actor-involvement-types-data');
  const actorTypes = parseJsonData('actor-types-data');
  const victimHealthStatuses = parseJsonData('victim-health-statuses-data');

  /* Crime-specific config: victim condition & medical location fields.
     Only present on the crime/violence form (via crime-actor-config JSON element). */
  const crimeActorConfig = (function () {
    const el = document.getElementById('crime-actor-config');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  })();
  const showVictimCondition = crimeActorConfig && crimeActorConfig.showVictimCondition;
  const showMedicalLocation = crimeActorConfig && crimeActorConfig.showMedicalLocation;

  /* Map role codes to involvement type IDs for quick-add buttons */
  const roleToInvolvementId = {};
  for (let i = 0; i < involvementTypes.length; i++) {
    const code = (involvementTypes[i].status_code || '').toLowerCase();
    roleToInvolvementId[code] = involvementTypes[i].status_id;
  }

  /* Role display config */
  const ROLE_CONFIG = {
    accused: {
      labelBn: '\u0985\u09AD\u09BF\u09AF\u09C1\u0995\u09CD\u09A4',
      labelEn: 'Accused/Criminal',
      cssClass: 'role-accused'
    },
    victim: {
      labelBn: '\u09AD\u09C1\u0995\u09CD\u09A4\u09AD\u09CB\u0997\u09C0',
      labelEn: 'Victim',
      cssClass: 'role-victim'
    },
    witness: {
      labelBn: '\u09B8\u09BE\u0995\u09CD\u09B7\u09C0',
      labelEn: 'Witness',
      cssClass: 'role-witness'
    },
    politician: {
      labelBn: '\u09B0\u09BE\u099C\u09A8\u09C8\u09A4\u09BF\u0995 \u09AC\u09BE \u0986\u09AE\u09B2\u09BE',
      labelEn: 'Politician / Bureaucrat',
      cssClass: 'role-politician'
    }
  };

  /* ========== State ========== */

  let actors = [];

  /* ========== Helpers ========== */

  /**
   * Get actor types filtered by role.
   * Accused          → all types
   * Victim / Witness → all types EXCEPT accused-only codes
   */
  /* status_codes that can only be an accused party, never a victim or witness */
  const ACCUSED_ONLY_TYPE_CODES = { kishore_gang: true, local_group_syndicate: true };

  function getFilteredActorTypes(role) {
    if (!actorTypes.length) return [];
    const roleUpper = (role || '');
    if (roleUpper === 'accused' || roleUpper === 'politician') return actorTypes;
    /* Victim / Witness: exclude accused-only types */
    const filtered = [];
    for (let i = 0; i < actorTypes.length; i++) {
      if (!ACCUSED_ONLY_TYPE_CODES[actorTypes[i].status_code]) {
        filtered.push(actorTypes[i]);
      }
    }
    return filtered;
  }

  /**
   * Get the role string from an involvement type ID.
   */
  function getRoleFromInvolvementId(involvementTypeId) {
    for (let code in roleToInvolvementId) {
      if (roleToInvolvementId[code] === involvementTypeId) return code;
    }
    return 'accused'; /* fallback */
  }

  /**
   * Get involvement type name for display.
   */
  function getInvolvementTypeName(involvementTypeId) {
    for (let i = 0; i < involvementTypes.length; i++) {
      if (involvementTypes[i].status_id === involvementTypeId) {
        return involvementTypes[i].status_name_bn
          || involvementTypes[i].status_name_en
          || '';
      }
    }
    return '';
  }

  /* ========== Sync to Hidden Input ========== */

  function syncToHiddenInput() {
    hiddenInput.value = actors.length ? JSON.stringify(actors) : '';
    /* Trigger change for form persist */
    const event = document.createEvent('Event');
    event.initEvent('change', true, true);
    hiddenInput.dispatchEvent(event);
  }

  /* ========== Build Card HTML ========== */

  const UNKNOWN_TYPE_CODE = 'unidentified_anonymous';

  function buildActorTypeOptions(role, selectedId) {
    const types = getFilteredActorTypes(role);
    let html = '<option value="">-- \u09A7\u09B0\u09A8 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 (Select Type) --</option>';

    // Put "অজ্ঞাতনামা ব্যক্তি" at the top, separated
    let unknownType = null;
    const otherTypes = [];
    for (let i = 0; i < types.length; i++) {
      if ((types[i].status_code || '').toLowerCase() === UNKNOWN_TYPE_CODE) {
        unknownType = types[i];
      } else {
        otherTypes.push(types[i]);
      }
    }

    if (unknownType) {
      let sel = (unknownType.status_id === selectedId) ? ' selected' : '';
      html += '<option value="' + unknownType.status_id + '"' + sel + '>'
        + (unknownType.status_name_bn || unknownType.status_name_en || '')
        + '</option>';
      html += '<option disabled>──────────────</option>';
    }

    for (let j = 0; j < otherTypes.length; j++) {
      const t = otherTypes[j];
      const selected = (t.status_id === selectedId) ? ' selected' : '';
      html += '<option value="' + t.status_id + '"' + selected + '>'
        + (t.status_name_bn || t.status_name_en || '')
        + '</option>';
    }
    return html;
  }

  function buildCardHtml(actor, index) {
    let role = actor.role || getRoleFromInvolvementId(actor.involvementTypeId);
    const config = ROLE_CONFIG[role] || ROLE_CONFIG.accused;

    let html = '<div class="actor-card actor-card-' + role + '" data-index="' + index + '">';

    /* Header: role badge + remove */
    html += '<div class="actor-card-header">';
    html += '<span class="actor-role-badge ' + config.cssClass + '">'
      + config.labelBn + ' (' + config.labelEn + ')</span>';
    html += '<button type="button" class="button-repeater-delete actor-remove-button" data-index="' + index
      + '" title="\u09A1\u09BF\u09B2\u09BF\u099F \u0995\u09B0\u09C1\u09A8 (Delete)">'
      + '\u09A1\u09BF\u09B2\u09BF\u099F <span class="button-delete-x">&times;</span></button>';
    html += '</div>';

    /* Primary row: type only */
    html += '<div class="actor-primary-row">';
    html += '<div class="form-field">';
    html += '<label>\u09A7\u09B0\u09A8 (Type)</label>';
    html += '<select class="actor-field" data-index="' + index + '" data-field="actorTypeId">';
    html += buildActorTypeOptions(role, actor.actorTypeId);
    html += '</select>';
    html += '</div>';
    html += '</div>';

    /* Name — English (first + last) */
    html += '<div class="form-field">';
    html += '<label>\u09A8\u09BE\u09AE \u2014 English <span class="field-required">*</span></label>';
    html += '<div class="form-name-split">';
    html += '<div>';
    html += '<label class="form-name-sublabel">First Name</label>';
    html += '<input type="text" class="actor-field" data-index="' + index
      + '" data-field="firstNameEn" value="' + escapeAttr(actor.firstNameEn || '')
      + '" maxlength="100" placeholder="First name...">';
    html += '</div>';
    html += '<div>';
    html += '<label class="form-name-sublabel">Last Name</label>';
    html += '<input type="text" class="actor-field" data-index="' + index
      + '" data-field="lastNameEn" value="' + escapeAttr(actor.lastNameEn || '')
      + '" maxlength="100" placeholder="Last name...">';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    /* Name — Bengali (first + last) */
    html += '<div class="form-field">';
    html += '<label>\u09A8\u09BE\u09AE \u2014 \u09AC\u09BE\u0982\u09B2\u09BE</label>';
    html += '<div class="form-name-split">';
    html += '<div>';
    html += '<label class="form-name-sublabel">\u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE</label>';
    html += '<input type="text" class="actor-field" data-index="' + index
      + '" data-field="firstNameBn" value="' + escapeAttr(actor.firstNameBn || '')
      + '" maxlength="100" placeholder="\u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE...">';
    html += '</div>';
    html += '<div>';
    html += '<label class="form-name-sublabel">\u09B6\u09C7\u09B7 \u09A8\u09BE\u09AE / \u09AA\u09A6\u09AC\u09C0</label>';
    html += '<input type="text" class="actor-field" data-index="' + index
      + '" data-field="lastNameBn" value="' + escapeAttr(actor.lastNameBn || '')
      + '" maxlength="100" placeholder="\u09B6\u09C7\u09B7 \u09A8\u09BE\u09AE...">';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    /* Details section — always visible */
    html += '<div class="actor-details">';

    html += '<div class="form-row-half">';
    html += buildTextField(index, 'alias',
      '\u0989\u09AA\u09A8\u09BE\u09AE (Alias)', actor.alias, 100,
      '\u09A1\u09BE\u0995\u09A8\u09BE\u09AE \u09AC\u09BE \u09AA\u09B0\u09BF\u099A\u09BF\u09A4 \u09A8\u09BE\u09AE');
    html += buildTextField(index, 'designation',
      '\u09AA\u09A6\u09AC\u09C0 (Designation)', actor.designation, 200,
      '\u09AF\u09C7\u09AE\u09A8: \u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1 \u0995\u09AE\u09BF\u09B6\u09A8\u09BE\u09B0');
    html += '</div>';

    html += '<div class="form-row-half">';
    html += buildTextField(index, 'organization',
      '\u09B8\u0982\u0997\u09A0\u09A8 (Organization)', actor.organization, 200,
      '\u09B8\u0982\u09B6\u09CD\u09B2\u09BF\u09B7\u09CD\u099F \u09B8\u0982\u0997\u09A0\u09A8\u09C7\u09B0 \u09A8\u09BE\u09AE');
    html += buildTextField(index, 'patron',
      '\u09AA\u09C3\u09B7\u09CD\u09A0\u09AA\u09CB\u09B7\u0995 (Patron)', actor.patron, 200,
      '\u09AA\u09C3\u09B7\u09CD\u09A0\u09AA\u09CB\u09B7\u0995\u09C7\u09B0 \u09A8\u09BE\u09AE');
    html += '</div>';

    html += '<div class="form-row-half">';
    html += buildTextField(index, 'contact',
      '\u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997 (Contact)', actor.contact, 50,
      '\u09AB\u09CB\u09A8 \u09A8\u09AE\u09CD\u09AC\u09B0');
    html += '<div class="form-field"></div>'; /* spacer */
    html += '</div>';

    /* Crime-specific: victim condition & medical location */
    if (role === 'victim' && showVictimCondition) {
      html += '<div class="form-row-half">';
      html += '<div class="form-field">';
      html += '<label>\u0985\u09AC\u09B8\u09CD\u09A5\u09BE (Condition)</label>';
      html += '<select class="actor-field" data-index="' + index + '" data-field="conditionId">';
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
          actor.medicalLocation, 200,
          '\u09B9\u09BE\u09B8\u09AA\u09BE\u09A4\u09BE\u09B2\u09C7\u09B0 \u09A8\u09BE\u09AE (Hospital name)');
      } else {
        html += '<div class="form-field"></div>';
      }
      html += '</div>';
    }

    html += '<div class="form-field">';
    html += '<label>\u09AC\u0995\u09CD\u09A4\u09AC\u09CD\u09AF (Statement)</label>';
    html += '<textarea class="actor-field" data-index="' + index
      + '" data-field="statement" rows="2" maxlength="2000"'
      + ' placeholder="\u0985\u09AD\u09BF\u09AF\u09C1\u0995\u09CD\u09A4/\u09AD\u09C1\u0995\u09CD\u09A4\u09AD\u09CB\u0997\u09C0\u09B0 \u09AC\u0995\u09CD\u09A4\u09AC\u09CD\u09AF">'
      + escapeHtml(actor.statement || '') + '</textarea>';
    html += '</div>';

    html += '</div>'; /* .actor-details */
    html += '</div>'; /* .actor-card */

    return html;
  }

  function buildTextField(index, field, label, value, maxlength, placeholder) {
    return '<div class="form-field">'
      + '<label>' + label + '</label>'
      + '<input type="text" class="actor-field" data-index="' + index
      + '" data-field="' + field + '" value="' + escapeAttr(value || '')
      + '" maxlength="' + maxlength + '" placeholder="' + (placeholder || '') + '">'
      + '</div>';
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    updateButtonCounts();
  }

  /* ========== Button Count Badges ========== */

  function updateButtonCounts() {
    const counts = { accused: 0, victim: 0, witness: 0, politician: 0 };
    for (let i = 0; i < actors.length; i++) {
      const r = actors[i].role || getRoleFromInvolvementId(actors[i].involvementTypeId);
      if (counts.hasOwnProperty(r)) counts[r]++;
    }
    const btns = addButtonsContainer.querySelectorAll('.actor-add-button');
    for (let j = 0; j < btns.length; j++) {
      let role = btns[j].getAttribute('data-role');
      let badge = btns[j].querySelector('.actor-count-badge');
      const count = counts[role] || 0;
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'actor-count-badge';
          btns[j].appendChild(badge);
        }
        badge.textContent = count;
      } else if (badge) {
        badge.parentNode.removeChild(badge);
      }
    }
  }

  /* ========== Add / Remove ========== */

  function addActor(role) {
    const involvementTypeId = roleToInvolvementId[role] || 0;
    const actor = {
      role: role,
      involvementTypeId: involvementTypeId,
      actorTypeId: 0,
      firstNameEn: '',
      lastNameEn: '',
      firstNameBn: '',
      lastNameBn: '',
      alias: '',
      designation: '',
      organization: '',
      patron: '',
      contact: '',
      statement: ''
    };
    /* Crime-specific: victim condition & medical location */
    if (showVictimCondition && role === 'victim') {
      actor.conditionId = 0;
      actor.medicalLocation = '';
    }
    actors.push(actor);
    render();
  }

  function removeActor(index) {
    actors.splice(index, 1);
    render();
  }

  /* ========== Event Listeners ========== */

  /* Quick-add buttons */
  addButtonsContainer.addEventListener('click', function (e) {
    const button = e.target.closest('.actor-add-button');
    if (!button) return;
    const role = button.getAttribute('data-role');
    if (role) addActor(role);
  });

  /* Card interactions: remove */
  listContainer.addEventListener('click', function (e) {
    const removeBtn = e.target.closest('.actor-remove-button');
    if (removeBtn) {
      let index = parseInt(removeBtn.getAttribute('data-index'), 10);
      removeActor(index);
    }
  });

  /* Field value changes — sync to actors array */
  listContainer.addEventListener('input', function (e) {
    let field = e.target.closest('.actor-field');
    if (!field) return;
    let index = parseInt(field.getAttribute('data-index'), 10);
    let key = field.getAttribute('data-field');
    if (isNaN(index) || !key || !actors[index]) return;

    if (field.tagName === 'SELECT') {
      actors[index][key] = parseInt(field.value, 10) || 0;
    } else {
      actors[index][key] = field.value;
    }
    syncToHiddenInput();
  });

  /* Also catch change events on selects */
  const integerSelectFields = { actorTypeId: true, conditionId: true };
  listContainer.addEventListener('change', function (e) {
    const field = e.target.closest('.actor-field');
    if (!field || field.tagName !== 'select') return;
    const index = parseInt(field.getAttribute('data-index'), 10);
    const key = field.getAttribute('data-field');
    if (isNaN(index) || !key || !actors[index]) return;
    actors[index][key] = integerSelectFields[key] ? (parseInt(field.value, 10) || 0) : field.value;
    syncToHiddenInput();
  });

  /* Re-sync right before form submit */
  const form = hiddenInput.closest('form');
  if (form) {
    form.addEventListener('submit', function () {
      syncToHiddenInput();
    });
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
    } catch (e) {
      /* Invalid JSON — ignore */
    }
  }

  /* ========== Public API ========== */

  window.newshubInvolvedParties = {
    reset: function () {
      actors = [];
      render();
    }
  };

  /* ========== Step Validator: validate actor cards on Next ========== */

  const partiesPanel = hiddenInput.closest('.step-panel[data-step]');
  if (partiesPanel) {
    const partiesStep = parseInt(partiesPanel.getAttribute('data-step'), 10);

    const validator = function () {
      const warnings = [];
      for (let i = 0; i < actors.length; i++) {
        if (!actors[i].firstNameEn || !actors[i].firstNameEn.trim()) {
          const roleConfig = ROLE_CONFIG[actors[i].role] || ROLE_CONFIG.accused;
          warnings.push(roleConfig.labelBn + ' #' + (i + 1) + ' — ইংরেজিতে প্রথম নাম দিন (Please enter a first name in English)');
        }
      }
      return { warnings: warnings };
    };

    /* Deferred queue — stepper loads after us */
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: partiesStep, fn: validator });
  }

  /* ========== Init ========== */

  restoreFromHiddenInput();
  if (!actors.length) render(); /* show empty state */

})();
