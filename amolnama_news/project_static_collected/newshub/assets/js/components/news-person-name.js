/**
 * news-person-name.js
 * Shared utility for name fields across all forms.
 *
 * Three modes of use:
 *
 * A) Template-rendered forms (person-name-fields.html):
 *    Field IDs: {prefix}-first-name-en, {prefix}-last-name-bn, etc.
 *    Use: read(prefix), bind(prefix, fn), reset(prefix)
 *
 * B) JS-built repeater cards using HTML strings (crime accused/victim/witness):
 *    Use: buildNameGroupHtml(index, actor, fieldClass)
 *         nameDefaults()
 *
 * C) JS-built repeater cards using DOM createElement (WCV accused):
 *    Use: buildNameGroupDom(classPrefix)
 *         nameDefaults()
 *    Returns { element, inputs } where inputs has refs to all 6 input elements.
 *
 * Name fields are a single source of truth — change once, all forms update.
 *
 * Exposes: window.newshubPersonName
 */
(function () {
  'use strict';

  /* ========== Template-mode helpers (prefix-based IDs) ========== */

  var SUFFIXES = [
    'first-name-en', 'last-name-en',
    'first-name-bn', 'last-name-bn',
    'alias',
    'father-firstname', 'father-lastname'
  ];

  function getEl(prefix, suffix) {
    return document.getElementById(prefix + '-' + suffix);
  }

  function val(prefix, suffix) {
    var el = getEl(prefix, suffix);
    return el ? el.value.trim() : '';
  }

  function generateSlug(firstEn, lastEn) {
    return (firstEn + ' ' + lastEn)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /* ========== Shared field definitions (single source of truth) ========== */

  /**
   * Name field rows — each row is a pair of fields displayed side by side.
   * Structure: [ [field1, field2], ... ]
   * Each field: { key, labelBn, labelEn, phBn, phEn }
   */
  var NAME_ROWS = [
    /* Row 1 — English names */
    [
      { key: 'firstNameEn', labelBn: '\u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE', labelEn: 'First Name \u2014 English', phBn: '\u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE (\u0987\u0982\u09B0\u09C7\u099C\u09BF\u09A4\u09C7)...', phEn: 'First name (English)...', required: true },
      { key: 'lastNameEn',  labelBn: '\u09B6\u09C7\u09B7 \u09A8\u09BE\u09AE', labelEn: 'Last Name \u2014 English', phBn: '\u09B6\u09C7\u09B7 \u09A8\u09BE\u09AE (\u0987\u0982\u09B0\u09C7\u099C\u09BF\u09A4\u09C7)...', phEn: 'Last name (English)...' }
    ],
    /* Row 2 — Bengali names */
    [
      { key: 'firstNameBn', labelBn: '\u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE', labelEn: 'First Name \u2014 Bengali', phBn: '\u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE (\u09AC\u09BE\u0982\u09B2\u09BE)...', phEn: 'First name (Bengali)...' },
      { key: 'lastNameBn',  labelBn: '\u09B6\u09C7\u09B7 \u09A8\u09BE\u09AE', labelEn: 'Last Name \u2014 Bengali', phBn: '\u09B6\u09C7\u09B7 \u09A8\u09BE\u09AE (\u09AC\u09BE\u0982\u09B2\u09BE)...', phEn: 'Last name (Bengali)...' }
    ],
    /* Row 3 — Father's name */
    [
      { key: 'fatherFirstName', labelBn: '\u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE', labelEn: 'First Name', phBn: '\u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE (\u09AC\u09BE\u0982\u09B2\u09BE)...', phEn: 'First name...' },
      { key: 'fatherLastName',  labelBn: '\u09B6\u09C7\u09B7 \u09A8\u09BE\u09AE', labelEn: 'Last Name', phBn: '\u09B6\u09C7\u09B7 \u09A8\u09BE\u09AE (\u09AC\u09BE\u0982\u09B2\u09BE)...', phEn: 'Last name...' }
    ]
  ];

  /* Alias — single field after the rows */
  var ALIAS_FIELD = { key: 'alias', labelBn: '\u09A1\u09BE\u0995\u09A8\u09BE\u09AE \u09AC\u09BE \u09AA\u09B0\u09BF\u099A\u09BF\u09A4 \u09A8\u09BE\u09AE', labelEn: 'Alias / Nickname', phBn: '\u09A1\u09BE\u0995\u09A8\u09BE\u09AE (\u09AC\u09BE\u0982\u09B2\u09BE)...', phEn: 'Alias...' };

  /* Row-level block labels — shared by HTML-string and DOM builders */
  var ROW_LABELS = [
    { bn: '\u09A8\u09BE\u09AE \u2014 \u0987\u0982\u09B0\u09C7\u099C\u09BF', en: 'Name \u2014 English' },
    { bn: '\u09A8\u09BE\u09AE \u2014 \u09AC\u09BE\u0982\u09B2\u09BE',       en: 'Name \u2014 Bengali' },
    { bn: '\u09AA\u09BF\u09A4\u09BE\u09B0 \u09A8\u09BE\u09AE',              en: "Father's Name" }
  ];

  /* ========== Repeater-mode helpers (HTML string builder) ========== */

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Build a name row as HTML string with block label + form-name-split structure.
   * Matches template (person-name-core-fields.html) and DOM (buildNameGroupDom) output.
   */
  function makeNameRowHtml(index, fieldClass, rowIndex, rowFields, actor) {
    var rl = ROW_LABELS[rowIndex];
    var html = '<div class="form-field">';
    html += '<label class="field-label-block" data-bn="' + escapeAttr(rl.bn)
      + '" data-en="' + escapeAttr(rl.en) + '">'
      + rl.bn + ' (' + rl.en + ')';
    if (rowIndex === 0) html += ' <span class="field-required">*</span>';
    html += '</label>';
    html += '<div class="form-name-split">';
    for (var c = 0; c < rowFields.length; c++) {
      var f = rowFields[c];
      html += '<div>';
      html += '<label class="form-name-sublabel" data-bn="' + escapeAttr(f.labelBn)
        + '" data-en="' + escapeAttr(f.labelEn) + '">' + f.labelBn + '</label>';
      html += '<input type="text" class="' + fieldClass + '" data-index="' + index
        + '" data-field="' + f.key + '" value="' + escapeAttr(actor[f.key] || '')
        + '" maxlength="100" placeholder="' + escapeAttr(f.phBn || '') + '">';
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  }

  /* ========== DOM-mode helpers (createElement builder) ========== */

  /* Map camelCase keys → CSS class suffixes (must match existing querySelector usage) */
  var KEY_TO_CLASS_SUFFIX = {
    firstNameEn: 'firstname-en',
    lastNameEn: 'lastname-en',
    firstNameBn: 'firstname-bn',
    lastNameBn: 'lastname-bn',
    fatherFirstName: 'father-firstname',
    fatherLastName: 'father-lastname',
    alias: 'alias'
  };

  function makeDomNameRow(classPrefix, fieldDefs) {
    var row = document.createElement('div');
    row.className = 'form-name-split';
    var inputs = {};
    for (var i = 0; i < fieldDefs.length; i++) {
      var f = fieldDefs[i];
      var wrap = document.createElement('div');
      var inputId = classPrefix + '-' + (KEY_TO_CLASS_SUFFIX[f.key] || f.key) + '-' + i;
      var inputName = inputId.replace(/-/g, '_');
      var sublabel = document.createElement('label');
      sublabel.className = 'form-name-sublabel';
      sublabel.setAttribute('for', inputId);
      sublabel.setAttribute('data-bn', f.labelBn);
      sublabel.setAttribute('data-en', f.labelEn);
      sublabel.textContent = f.labelBn;
      var input = document.createElement('input');
      input.type = 'text';
      input.id = inputId;
      input.name = inputName;
      input.className = classPrefix + '-' + (KEY_TO_CLASS_SUFFIX[f.key] || f.key);
      input.setAttribute('data-ph-bn', f.phBn);
      input.setAttribute('data-ph-en', f.phEn);
      input.placeholder = f.phBn;
      wrap.appendChild(sublabel);
      wrap.appendChild(input);
      row.appendChild(wrap);
      inputs[f.key] = input;
    }
    return { row: row, inputs: inputs };
  }

  /* ========== Public API ========== */

  window.newshubPersonName = {

    /* --- Template mode --- */

    read: function (prefix) {
      var firstEn = val(prefix, 'first-name-en');
      var lastEn  = val(prefix, 'last-name-en');
      return {
        firstNameEn:     firstEn,
        lastNameEn:      lastEn,
        firstNameBn:     val(prefix, 'first-name-bn'),
        lastNameBn:      val(prefix, 'last-name-bn'),
        alias:           val(prefix, 'alias'),
        fatherFirstName: val(prefix, 'father-firstname'),
        fatherLastName:  val(prefix, 'father-lastname'),
        slug: generateSlug(firstEn, lastEn),
      };
    },

    bind: function (prefix, callback) {
      SUFFIXES.forEach(function (suffix) {
        var el = getEl(prefix, suffix);
        if (el) el.addEventListener('input', callback);
      });
    },

    reset: function (prefix) {
      SUFFIXES.forEach(function (suffix) {
        var el = getEl(prefix, suffix);
        if (el) el.value = '';
      });
    },

    /* --- Repeater mode --- */

    /**
     * Returns default name fields for a new actor object.
     * Spread into your default: Object.assign(actor, newshubPersonName.nameDefaults())
     */
    nameDefaults: function () {
      return {
        firstNameEn: '',
        lastNameEn: '',
        firstNameBn: '',
        lastNameBn: '',
        fatherFirstName: '',
        fatherLastName: '',
        alias: ''
      };
    },

    /**
     * Build the full Name group as an HTML string (for crime repeaters).
     * @param {number} index  — card index (for data-index)
     * @param {object} actor  — actor data object
     * @param {string} fieldClass — CSS class for inputs (e.g. 'accused-field')
     * @returns {string} HTML string
     */
    buildNameGroupHtml: function (index, actor, fieldClass) {
      var html = '<div class="actor-group actor-group-name">';
      html += '<h5 class="actor-group-title" data-bn="\u09A8\u09BE\u09AE" data-en="Name">\u09A8\u09BE\u09AE (Name)</h5>';

      /* Rows 0-1: EN names, BN names — block label + form-name-split */
      html += makeNameRowHtml(index, fieldClass, 0, NAME_ROWS[0], actor);
      html += makeNameRowHtml(index, fieldClass, 1, NAME_ROWS[1], actor);

      /* Alias (before Father) */
      html += '<div class="form-field">'
        + '<label data-bn="' + escapeAttr(ALIAS_FIELD.labelBn)
        + '" data-en="' + escapeAttr(ALIAS_FIELD.labelEn) + '">'
        + ALIAS_FIELD.labelBn + ' (' + ALIAS_FIELD.labelEn + ')</label>'
        + '<input type="text" class="' + fieldClass + '" data-index="' + index
        + '" data-field="' + ALIAS_FIELD.key + '" value="' + escapeAttr(actor[ALIAS_FIELD.key] || '')
        + '" maxlength="100" placeholder="' + escapeAttr(ALIAS_FIELD.phBn) + '">'
        + '</div>';

      /* Row 2: Father's name — block label + form-name-split */
      html += makeNameRowHtml(index, fieldClass, 2, NAME_ROWS[2], actor);

      html += '</div>'; /* .actor-group (Name) */
      return html;
    },

    /**
     * Build the full Name group as DOM elements (for WCV accused etc.).
     * @param {string} classPrefix — CSS class prefix (e.g. 'wcv-accused')
     *   Generates input classes: {classPrefix}-first-name-en, etc.
     * @param {string} [borderColor] — optional left border color for the group
     * @returns {{ element: HTMLElement, inputs: object }}
     *   inputs has keys: firstNameEn, lastNameEn, firstNameBn, lastNameBn,
     *                     fatherFirstName, fatherLastName, alias
     */
    buildNameGroupDom: function (classPrefix, borderColor) {
      var group = document.createElement('div');
      group.className = 'actor-group actor-group-name';
      if (borderColor) group.style.borderLeftColor = borderColor;
      var h5 = document.createElement('h5');
      h5.className = 'actor-group-title';
      h5.setAttribute('data-bn', '\u09A8\u09BE\u09AE');
      h5.setAttribute('data-en', 'Name');
      h5.textContent = '\u09A8\u09BE\u09AE (Name)';
      group.appendChild(h5);

      var allInputs = {};

      function appendNameRow(r) {
        var rowDef = NAME_ROWS[r];
        var formField = document.createElement('div');
        formField.className = 'form-field';
        var rl = ROW_LABELS[r] || { bn: '', en: '' };
        var rowLabel = document.createElement('span');
        rowLabel.className = 'field-label-block form-field-label';
        rowLabel.setAttribute('data-bn', rl.bn);
        rowLabel.setAttribute('data-en', rl.en);
        rowLabel.textContent = rl.bn + ' (' + rl.en + ')';
        if (r === 0) rowLabel.innerHTML += ' <span class="field-required">*</span>';
        formField.appendChild(rowLabel);
        var result = makeDomNameRow(classPrefix, rowDef);
        formField.appendChild(result.row);
        group.appendChild(formField);
        for (var k in result.inputs) { allInputs[k] = result.inputs[k]; }
      }

      /* Rows 0-1: EN names, BN names */
      appendNameRow(0);
      appendNameRow(1);

      /* Alias (before Father) */
      var aliasField = document.createElement('div');
      aliasField.className = 'form-field';
      var aliasId = classPrefix + '-alias';
      var aliasLabel = document.createElement('label');
      aliasLabel.setAttribute('for', aliasId);
      aliasLabel.setAttribute('data-bn', ALIAS_FIELD.labelBn);
      aliasLabel.setAttribute('data-en', ALIAS_FIELD.labelEn);
      aliasLabel.textContent = ALIAS_FIELD.labelBn + ' (' + ALIAS_FIELD.labelEn + ')';
      aliasField.appendChild(aliasLabel);
      var aliasInput = document.createElement('input');
      aliasInput.type = 'text';
      aliasInput.id = aliasId;
      aliasInput.name = aliasId.replace(/-/g, '_');
      aliasInput.className = classPrefix + '-' + (KEY_TO_CLASS_SUFFIX[ALIAS_FIELD.key] || ALIAS_FIELD.key);
      aliasInput.setAttribute('data-ph-bn', ALIAS_FIELD.phBn);
      aliasInput.setAttribute('data-ph-en', ALIAS_FIELD.phEn);
      aliasInput.placeholder = ALIAS_FIELD.phBn;
      aliasField.appendChild(aliasInput);
      group.appendChild(aliasField);
      allInputs.alias = aliasInput;

      /* Row 2: Father's name */
      appendNameRow(2);

      return { element: group, inputs: allInputs };
    },
  };
})();
