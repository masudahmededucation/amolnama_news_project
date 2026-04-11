/**
 * news-person-identity.js
 * Shared utility for Personal Identity fields across all forms.
 * Single source of truth — change once, all forms update.
 *
 * Fields: Gender, Religion, Age, DOB, Home District, Contact
 *
 * Two JS modes:
 *
 * A) HTML string builder (crime accused/victim/witness repeaters):
 *    buildIdentityGroupHtml(index, actor, fieldClass, refData)
 *    Generates data-index + data-field attributes for event delegation.
 *
 * B) DOM createElement builder (WCV accused):
 *    buildIdentityGroupDom(classPrefix, refData, borderColor)
 *    Returns { element, inputs } — inputs has refs to all elements.
 *
 * Template mode uses person-personal-info-fields.html instead.
 *
 * refData = { genders: [], religions: [], districts: [] }
 *   genders/religions: [{ status_id, status_name_bn, status_name_en }, ...]
 *   districts: [{ district_id, district_name_bn, district_name_en }, ...]
 *
 * Exposes: window.newshubPersonIdentity
 */
(function () {
  'use strict';

  /* ========== Field definitions (single source of truth) ========== */

  /**
   * IDENTITY_FIELDS — ordered list of all Personal Identity fields.
   * Each field: { key, type, labelBn, labelEn, phBn, phEn, ... }
   * Rows: fields with the same `row` value are placed side by side.
   */
  const IDENTITY_ROWS = [
    /* Row 1 — Gender + Religion (selects) */
    [
      { key: 'genderId',   type: 'select', ref: 'genders',   labelBn: '\u09B2\u09BF\u0999\u09CD\u0997', labelEn: 'Gender',   defaultBn: '\u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8', defaultEn: 'Select' },
      { key: 'religionId', type: 'select', ref: 'religions',  labelBn: '\u09A7\u09B0\u09CD\u09AE',       labelEn: 'Religion', defaultBn: '\u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8', defaultEn: 'Select' }
    ],
    /* Row 2 — Age + DOB */
    [
      { key: 'age', type: 'number', labelBn: '\u09AC\u09AF\u09BC\u09B8',           labelEn: 'Age',           phBn: '\u09AF\u09C7\u09AE\u09A8: 25', phEn: 'e.g. 25', min: 1, max: 120 },
      { key: 'dob', type: 'date',   labelBn: '\u099C\u09A8\u09CD\u09AE \u09A4\u09BE\u09B0\u09BF\u0996', labelEn: 'Date of Birth', phBn: '',           phEn: '' }
    ],
    /* Row 3 — Home District + Contact */
    [
      { key: 'districtId', type: 'district', ref: 'districts', labelBn: '\u09A8\u09BF\u099C \u099C\u09C7\u09B2\u09BE',        labelEn: 'Home District', defaultBn: '\u099C\u09C7\u09B2\u09BE \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 (\u0987\u0982\u09B0\u09C7\u099C\u09BF \u09AC\u09B0\u09CD\u09A3\u09BE\u09A8\u09C1\u0995\u09CD\u09B0\u09AE\u09C7)', defaultEn: 'Select District (alphabetical A\u2013Z)' },
      { key: 'contact',    type: 'text',     labelBn: '\u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997',       labelEn: 'Contact',       phBn: '\u09AB\u09CB\u09A8 \u09A8\u09AE\u09CD\u09AC\u09B0 (\u09AC\u09BE\u0982\u09B2\u09BE)...',  phEn: 'Phone number...', maxlength: 200 }
    ]
  ];

  /* ========== HTML helpers ========== */

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Shared label builder — matches template and DOM mode output */
  function labelHtml(field) {
    return '<label data-bn="' + escapeAttr(field.labelBn)
      + '" data-en="' + escapeAttr(field.labelEn) + '">'
      + field.labelBn + ' (' + field.labelEn + ')</label>';
  }

  /* Default option — matches template format: "-- নির্বাচন করুন (Select) --" */
  function defaultOptionHtml(field) {
    return '<option value="" data-bn="-- ' + escapeAttr(field.defaultBn) + ' --"'
      + ' data-en="-- ' + escapeAttr(field.defaultEn) + ' --">'
      + '-- ' + field.defaultBn + ' (' + field.defaultEn + ') --</option>';
  }

  /* Build <select> HTML for gender/religion (status_id based) */
  function buildSelectHtml(index, fieldClass, field, items, selectedId) {
    let html = '<div class="form-field">' + labelHtml(field)
      + '<select class="' + fieldClass + '" data-index="' + index + '" data-field="' + field.key + '">'
      + defaultOptionHtml(field);
    for (let i = 0; i < items.length; i++) {
      let item = items[i];
      let sel = (item.status_id === selectedId) ? ' selected' : '';
      html += '<option value="' + item.status_id + '"' + sel + '>'
        + (item.status_name_bn || '') + ' (' + (item.status_name_en || '') + ')</option>';
    }
    html += '</select></div>';
    return html;
  }

  /* Build <select> HTML for district (district_id based) */
  function buildDistrictSelectHtml(index, field, items, selectedId) {
    let html = '<div class="form-field">' + labelHtml(field)
      + '<select class="actor-district-select" data-index="' + index + '">'
      + defaultOptionHtml(field);
    for (let i = 0; i < items.length; i++) {
      const d = items[i];
      const sel = (d.district_id === selectedId) ? ' selected' : '';
      html += '<option value="' + d.district_id + '"' + sel + '>'
        + (d.district_name_bn || '') + ' (' + (d.district_name_en || '') + ')</option>';
    }
    html += '</select></div>';
    return html;
  }

  /* Build <input type="number"> HTML */
  function buildNumberHtml(index, fieldClass, field, value) {
    return '<div class="form-field">' + labelHtml(field)
      + '<input type="number" class="' + fieldClass + '" data-index="' + index
      + '" data-field="' + field.key + '" value="' + escapeAttr(String(value || ''))
      + '" min="' + field.min + '" max="' + field.max
      + '" data-ph-bn="' + escapeAttr(field.phBn || '') + '" data-ph-en="' + escapeAttr(field.phEn || '')
      + '" placeholder="' + escapeAttr(field.phBn || '') + '">'
      + '</div>';
  }

  /* Build <input type="date"> HTML */
  function buildDateHtml(index, fieldClass, field, value) {
    return '<div class="form-field">' + labelHtml(field)
      + '<input type="date" class="' + fieldClass + '" data-index="' + index
      + '" data-field="' + field.key + '"'
      + (value ? ' value="' + escapeAttr(value) + '"' : '')
      + '></div>';
  }

  /* Build <input type="text"> HTML */
  function buildTextHtml(index, fieldClass, field, value) {
    return '<div class="form-field">' + labelHtml(field)
      + '<input type="text" class="' + fieldClass + '" data-index="' + index
      + '" data-field="' + field.key + '" value="' + escapeAttr(value || '')
      + '" maxlength="' + (field.maxlength || 200)
      + '" data-ph-bn="' + escapeAttr(field.phBn || '') + '" data-ph-en="' + escapeAttr(field.phEn || '')
      + '" placeholder="' + escapeAttr(field.phBn || '') + '">'
      + '</div>';
  }

  /* ========== DOM helpers ========== */

  function makeDomFormField(labelBn, labelEn, inputEl) {
    const wrap = document.createElement('div');
    wrap.className = 'form-field';
    const isDate = inputEl.type === 'date';
    const label = document.createElement(isDate ? 'span' : 'label');
    if (isDate) {
      label.className = 'form-field-label';
      if (inputEl.id) {
        label.id = inputEl.id + '-label';
        inputEl.setAttribute('aria-labelledby', inputEl.id + '-label');
      }
    } else {
      if (inputEl.id) label.setAttribute('for', inputEl.id);
    }
    label.setAttribute('data-bn', labelBn);
    label.setAttribute('data-en', labelEn);
    label.textContent = labelBn + ' (' + labelEn + ')';
    wrap.appendChild(label);
    wrap.appendChild(inputEl);
    return wrap;
  }

  function makeDomSelect(classPrefix, field, items, isDistrict) {
    const select = document.createElement('select');
    const selectSuffix = field.key.replace(/Id$/, '').replace(/([A-Z])/g, function (m) { return '-' + m.toLowerCase(); });
    select.className = classPrefix + '-' + selectSuffix;
    select.id = classPrefix + '-' + selectSuffix;
    select.name = (classPrefix + '_' + selectSuffix).replace(/-/g, '_');
    const def = document.createElement('option');
    def.value = '';
    def.setAttribute('data-bn', '-- ' + field.defaultBn + ' --');
    def.setAttribute('data-en', '-- ' + field.defaultEn + ' --');
    def.textContent = '-- ' + field.defaultBn + ' (' + field.defaultEn + ') --';
    select.appendChild(def);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const opt = document.createElement('option');
      if (isDistrict) {
        opt.value = item.district_id;
        opt.textContent = (item.district_name_bn || '') + ' (' + (item.district_name_en || '') + ')';
      } else {
        opt.value = item.status_id;
        opt.textContent = (item.status_name_bn || '') + ' (' + (item.status_name_en || '') + ')';
      }
      select.appendChild(opt);
    }
    return select;
  }

  function makeDomInput(classPrefix, field) {
    const input = document.createElement('input');
    input.type = field.type;
    input.className = classPrefix + '-' + field.key;
    input.id = classPrefix + '-' + field.key;
    input.name = (classPrefix + '_' + field.key).replace(/-/g, '_');
    if (field.type === 'number') {
      input.min = String(field.min || 0);
      input.max = String(field.max || 999);
    }
    if (field.maxlength) input.maxLength = field.maxlength;
    if (field.phBn) {
      input.setAttribute('data-ph-bn', field.phBn);
      input.setAttribute('data-ph-en', field.phEn || '');
      input.placeholder = field.phBn;
    }
    return input;
  }

  /* ========== Public API ========== */

  /* ========== Template-mode helpers (prefix-based IDs) ========== */

  /* Suffix map: key → ID suffix (must match person-personal-info-fields.html) */
  const TEMPLATE_FIELDS = [
    { key: 'genderId',   suffix: 'gender',   type: 'select' },
    { key: 'religionId', suffix: 'religion',  type: 'select' },
    { key: 'age',        suffix: 'age',       type: 'number' },
    { key: 'dob',        suffix: 'dob',       type: 'date' },
    { key: 'districtId', suffix: 'district',  type: 'select' },
    { key: 'contact',    suffix: 'contact',   type: 'text' }
  ];

  function tGetEl(prefix, suffix) {
    return document.getElementById(prefix + '-' + suffix);
  }

  window.newshubPersonIdentity = {

    /* --- Template mode --- */

    read: function (prefix) {
      const data = {};
      for (let i = 0; i < TEMPLATE_FIELDS.length; i++) {
        let f = TEMPLATE_FIELDS[i];
        let element = tGetEl(prefix, f.suffix);
        if (!element) { data[f.key] = f.type === 'text' || f.type === 'date' ? '' : 0; continue; }
        if (f.type === 'select') {
          data[f.key] = parseInt(element.value, 10) || 0;
        } else if (f.type === 'number') {
          data[f.key] = parseInt(element.value, 10) || 0;
        } else if (f.type === 'date') {
          data[f.key] = element.value || '';
        } else {
          data[f.key] = element.value.trim();
        }
      }
      return data;
    },

    bind: function (prefix, callback) {
      for (let i = 0; i < TEMPLATE_FIELDS.length; i++) {
        let f = TEMPLATE_FIELDS[i];
        let element = tGetEl(prefix, f.suffix);
        if (!element) continue;
        if (f.type === 'select' || f.type === 'date') {
          element.addEventListener('change', callback);
        } else {
          element.addEventListener('input', callback);
        }
      }
    },

    reset: function (prefix) {
      for (let i = 0; i < TEMPLATE_FIELDS.length; i++) {
        let f = TEMPLATE_FIELDS[i];
        let element = tGetEl(prefix, f.suffix);
        if (!element) continue;
        if (f.type === 'select') {
          element.selectedIndex = 0;
          if (element.tomselect) element.tomselect.clear(true);
        } else {
          element.value = '';
        }
      }
    },

    /**
     * Default values for identity fields (for new actor objects).
     * Usage: Object.assign(actor, newshubPersonIdentity.identityDefaults())
     */
    identityDefaults: function () {
      return {
        genderId: 0,
        religionId: 0,
        age: '',
        dob: '',
        districtId: 0,
        contact: ''
      };
    },

    /**
     * Build the full Personal Identity group as an HTML string.
     * @param {number} index     — card index (for data-index)
     * @param {object} actor     — actor data object
     * @param {string} fieldClass — CSS class for inputs (e.g. 'accused-field')
     * @param {object} refData   — { genders: [], religions: [], districts: [] }
     * @returns {string} HTML string
     */
    buildIdentityGroupHtml: function (index, actor, fieldClass, refData) {
      let html = '<div class="actor-group actor-group-identity">';
      html += '<h5 class="actor-group-title"'
        + ' data-bn="\u09AC\u09CD\u09AF\u0995\u09CD\u09A4\u09BF\u0997\u09A4 \u09AA\u09B0\u09BF\u099A\u09AF\u09BC"'
        + ' data-en="Personal Identity">'
        + '\u09AC\u09CD\u09AF\u0995\u09CD\u09A4\u09BF\u0997\u09A4 \u09AA\u09B0\u09BF\u099A\u09AF\u09BC (Personal Identity)</h5>';

      for (let r = 0; r < IDENTITY_ROWS.length; r++) {
        let row = IDENTITY_ROWS[r];
        html += '<div class="form-row-half">';
        for (let c = 0; c < row.length; c++) {
          let f = row[c];
          switch (f.type) {
            case 'select':
              html += buildSelectHtml(index, fieldClass, f, refData[f.ref] || [], actor[f.key] || 0);
              break;
            case 'district':
              html += buildDistrictSelectHtml(index, f, refData[f.ref] || [], actor[f.key] || 0);
              break;
            case 'number':
              html += buildNumberHtml(index, fieldClass, f, actor[f.key]);
              break;
            case 'date':
              html += buildDateHtml(index, fieldClass, f, actor[f.key]);
              break;
            case 'text':
              html += buildTextHtml(index, fieldClass, f, actor[f.key]);
              break;
          }
        }
        html += '</div>';
      }

      html += '</div>'; /* .actor-group-identity */
      return html;
    },

    /**
     * Build the full Personal Identity group as DOM elements.
     * @param {string} classPrefix  — CSS class prefix (e.g. 'wcv-accused')
     * @param {object} refData      — { genders: [], religions: [], districts: [] }
     * @param {string} [borderColor] — optional left border color
     * @returns {{ element: HTMLElement, inputs: object }}
     */
    buildIdentityGroupDom: function (classPrefix, refData, borderColor) {
      const group = document.createElement('div');
      group.className = 'actor-group actor-group-identity';
      if (borderColor) group.style.borderLeftColor = borderColor;

      const h5 = document.createElement('h5');
      h5.className = 'actor-group-title';
      h5.setAttribute('data-bn', '\u09AC\u09CD\u09AF\u0995\u09CD\u09A4\u09BF\u0997\u09A4 \u09AA\u09B0\u09BF\u099A\u09AF\u09BC');
      h5.setAttribute('data-en', 'Personal Identity');
      h5.textContent = '\u09AC\u09CD\u09AF\u0995\u09CD\u09A4\u09BF\u0997\u09A4 \u09AA\u09B0\u09BF\u099A\u09AF\u09BC (Personal Identity)';
      group.appendChild(h5);

      const allInputs = {};

      for (let r = 0; r < IDENTITY_ROWS.length; r++) {
        const row = IDENTITY_ROWS[r];
        const rowDiv = document.createElement('div');
        rowDiv.className = 'form-row-half';

        for (let c = 0; c < row.length; c++) {
          const f = row[c];
          let element;
          if (f.type === 'select' || f.type === 'district') {
            element = makeDomSelect(classPrefix, f, refData[f.ref] || [], f.type === 'district');
            rowDiv.appendChild(makeDomFormField(f.labelBn, f.labelEn, element));
            allInputs[f.key] = element;
          } else {
            element = makeDomInput(classPrefix, f);
            rowDiv.appendChild(makeDomFormField(f.labelBn, f.labelEn, element));
            allInputs[f.key] = element;
          }
        }

        group.appendChild(rowDiv);
      }

      return { element: group, inputs: allInputs };
    },

    /**
     * Initialize Tom Select on district dropdowns inside a container.
     * Call after render.
     * @param {HTMLElement} container — parent element to search in
     * @param {function} onChange     — callback(selectEl, value)
     */
    initDistrictTomSelects: function (container, onChange) {
      if (typeof TomSelect === 'undefined') return;
      const selects = container.querySelectorAll('.actor-district-select');
      for (let i = 0; i < selects.length; i++) {
        const element = selects[i];
        if (element.tomselect) continue;
        (function (selectEl) {
          new TomSelect(selectEl, {
            create: false,
            onChange: function (value) {
              if (onChange) onChange(selectEl, value);
            }
          });
        })(element);
      }
    }
  };

  /* SPA cleanup — destroy Tom Select instances on page transition */
  if (window.spaCleanupRegister) {
    window.spaCleanupRegister(function () {
      document.querySelectorAll('select').forEach(function (s) {
        if (s.tomselect) s.tomselect.destroy();
      });
    });
  }
})();
