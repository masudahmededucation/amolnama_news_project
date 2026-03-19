/**
 * news-person-party-details.js
 * Shared utility for Party Details fields across all forms.
 * Single source of truth — change once, all forms update.
 *
 * Fields: Organization, Designation, Patron, Statement
 *
 * Two JS modes:
 *
 * A) HTML string builder (crime accused/victim/witness repeaters):
 *    buildPartyDetailsGroupHtml(index, actor, fieldClass)
 *    Generates data-index + data-field attributes for event delegation.
 *
 * B) DOM createElement builder (for future use):
 *    buildPartyDetailsGroupDom(classPrefix, borderColor)
 *    Returns { element, inputs } — inputs has refs to all elements.
 *
 * Exposes: window.newshubPersonPartyDetails
 */
(function () {
  'use strict';

  /* ========== Field definitions (single source of truth) ========== */

  var PARTY_FIELDS = [
    { key: 'organization', type: 'text',     labelBn: '\u09B8\u0982\u0997\u09A0\u09A8\u09C7\u09B0 \u09A8\u09BE\u09AE',                          labelEn: 'Organization Name',  phBn: '\u09B8\u0982\u09B6\u09CD\u09B2\u09BF\u09B7\u09CD\u099F \u09B8\u0982\u0997\u09A0\u09A8\u09C7\u09B0 \u09A8\u09BE\u09AE',           phEn: 'Organization name...', maxlength: 200 },
    { key: 'designation',  type: 'text',     labelBn: '\u09AA\u09A6\u09AC\u09C0',                                       labelEn: 'Designation',        phBn: '\u09AF\u09C7\u09AE\u09A8: \u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1 \u0995\u09AE\u09BF\u09B6\u09A8\u09BE\u09B0, \u099B\u09BE\u09A4\u09CD\u09B0, \u0997\u09C3\u09B9\u09BF\u09A3\u09C0', phEn: 'e.g. Ward Commissioner, Student, Homemaker', maxlength: 100 },
    { key: 'patron',       type: 'text',     labelBn: '\u0986\u09B6\u09CD\u09B0\u09AF\u09BC\u09A6\u09BE\u09A4\u09BE/\u09AA\u09C3\u09B7\u09CD\u09A0\u09AA\u09CB\u09B7\u0995', labelEn: 'Patron',             phBn: '\u0997\u09A1\u09AB\u09BE\u09A6\u09BE\u09B0, \u0986\u09B6\u09CD\u09B0\u09AF\u09BC\u09A6\u09BE\u09A4\u09BE \u09AC\u09BE \u09AC\u09A1\u09BC \u09AD\u09BE\u0987\u09AF\u09BC\u09C7\u09B0 \u09A8\u09BE\u09AE', phEn: 'Godfather, patron or elder name', maxlength: 200 },
    { key: 'statement',    type: 'textarea', labelBn: '\u09AC\u0995\u09CD\u09A4\u09AC\u09CD\u09AF',                                      labelEn: 'Statement',          phBn: '\u09AC\u0995\u09CD\u09A4\u09AC\u09CD\u09AF \u09B2\u09BF\u0996\u09C1\u09A8...',                       phEn: 'Write statement...', maxlength: 2000, rows: 2 }
  ];

  /* Group title */
  var GROUP_TITLE = {
    bn: '\u09B8\u0982\u09B6\u09CD\u09B2\u09BF\u09B7\u09CD\u099F \u09AA\u0995\u09CD\u09B7\u09C7\u09B0 \u09AC\u09BF\u09B8\u09CD\u09A4\u09BE\u09B0\u09BF\u09A4',
    en: 'Party Details'
  };

  /* ========== HTML helpers ========== */

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* Shared label builder — matches template and DOM mode output */
  function labelHtml(field) {
    return '<label data-bn="' + escapeAttr(field.labelBn)
      + '" data-en="' + escapeAttr(field.labelEn) + '">'
      + field.labelBn + ' (' + field.labelEn + ')</label>';
  }

  /* Build <input type="text"> HTML */
  function buildTextFieldHtml(index, fieldClass, field, value) {
    return '<div class="form-field">' + labelHtml(field)
      + '<input type="text" class="' + fieldClass + '" data-index="' + index
      + '" data-field="' + field.key + '" value="' + escapeAttr(value || '')
      + '" maxlength="' + (field.maxlength || 200)
      + '" data-ph-bn="' + escapeAttr(field.phBn || '') + '" data-ph-en="' + escapeAttr(field.phEn || '')
      + '" placeholder="' + escapeAttr(field.phBn || '') + '">'
      + '</div>';
  }

  /* Build <textarea> HTML */
  function buildTextareaHtml(index, fieldClass, field, value) {
    return '<div class="form-field">' + labelHtml(field)
      + '<textarea class="' + fieldClass + '" data-index="' + index
      + '" data-field="' + field.key + '" rows="' + (field.rows || 2)
      + '" maxlength="' + (field.maxlength || 2000)
      + '" data-ph-bn="' + escapeAttr(field.phBn || '') + '" data-ph-en="' + escapeAttr(field.phEn || '')
      + '" placeholder="' + escapeAttr(field.phBn || '') + '">'
      + escapeHtml(value || '') + '</textarea>'
      + '</div>';
  }

  /* ========== DOM helpers ========== */

  function makeDomFormField(labelBn, labelEn, inputEl) {
    var wrap = document.createElement('div');
    wrap.className = 'form-field';
    var label = document.createElement('label');
    label.setAttribute('data-bn', labelBn);
    label.setAttribute('data-en', labelEn);
    label.textContent = labelBn + ' (' + labelEn + ')';
    wrap.appendChild(label);
    wrap.appendChild(inputEl);
    return wrap;
  }

  function makeDomInput(classPrefix, field) {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = classPrefix + '-' + field.key;
    if (field.maxlength) input.maxLength = field.maxlength;
    if (field.phBn) {
      input.setAttribute('data-ph-bn', field.phBn);
      input.setAttribute('data-ph-en', field.phEn || '');
      input.placeholder = field.phBn;
    }
    return input;
  }

  function makeDomTextarea(classPrefix, field) {
    var textarea = document.createElement('textarea');
    textarea.className = classPrefix + '-' + field.key;
    textarea.rows = field.rows || 2;
    if (field.maxlength) textarea.maxLength = field.maxlength;
    if (field.phBn) {
      textarea.setAttribute('data-ph-bn', field.phBn);
      textarea.setAttribute('data-ph-en', field.phEn || '');
      textarea.placeholder = field.phBn;
    }
    return textarea;
  }

  /* ========== Public API ========== */

  window.newshubPersonPartyDetails = {

    /**
     * Default values for party details fields (for new actor objects).
     * Usage: Object.assign(actor, newshubPersonPartyDetails.partyDefaults())
     */
    partyDefaults: function () {
      return {
        organization: '',
        designation: '',
        patron: '',
        statement: ''
      };
    },

    /**
     * Build the full Party Details group as an HTML string.
     * @param {number} index     — card index (for data-index)
     * @param {object} actor     — actor data object
     * @param {string} fieldClass — CSS class for inputs (e.g. 'accused-field')
     * @returns {string} HTML string
     */
    buildPartyDetailsGroupHtml: function (index, actor, fieldClass) {
      var html = '<div class="actor-group actor-group-party">';
      html += '<h5 class="actor-group-title"'
        + ' data-bn="' + escapeAttr(GROUP_TITLE.bn) + '"'
        + ' data-en="' + escapeAttr(GROUP_TITLE.en) + '">'
        + GROUP_TITLE.bn + ' (' + GROUP_TITLE.en + ')</h5>';

      for (var i = 0; i < PARTY_FIELDS.length; i++) {
        var f = PARTY_FIELDS[i];
        if (f.type === 'textarea') {
          html += buildTextareaHtml(index, fieldClass, f, actor[f.key]);
        } else {
          html += buildTextFieldHtml(index, fieldClass, f, actor[f.key]);
        }
      }

      html += '</div>'; /* .actor-group-party */
      return html;
    },

    /**
     * Build the full Party Details group as DOM elements.
     * @param {string} classPrefix  — CSS class prefix (e.g. 'wcv-accused')
     * @param {string} [borderColor] — optional left border color
     * @returns {{ element: HTMLElement, inputs: object }}
     */
    buildPartyDetailsGroupDom: function (classPrefix, borderColor) {
      var group = document.createElement('div');
      group.className = 'actor-group actor-group-party';
      if (borderColor) group.style.borderLeftColor = borderColor;

      var h5 = document.createElement('h5');
      h5.className = 'actor-group-title';
      h5.setAttribute('data-bn', GROUP_TITLE.bn);
      h5.setAttribute('data-en', GROUP_TITLE.en);
      h5.textContent = GROUP_TITLE.bn + ' (' + GROUP_TITLE.en + ')';
      group.appendChild(h5);

      var allInputs = {};

      for (var i = 0; i < PARTY_FIELDS.length; i++) {
        var f = PARTY_FIELDS[i];
        var el;
        if (f.type === 'textarea') {
          el = makeDomTextarea(classPrefix, f);
        } else {
          el = makeDomInput(classPrefix, f);
        }
        group.appendChild(makeDomFormField(f.labelBn, f.labelEn, el));
        allInputs[f.key] = el;
      }

      return { element: group, inputs: allInputs };
    }
  };
})();
