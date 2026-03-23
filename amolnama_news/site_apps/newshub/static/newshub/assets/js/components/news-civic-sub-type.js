/**
 * news-civic-sub-type.js
 * Builds radio cards from DB-driven JSON (#issue-sub-types-data),
 * reads selected sub-type and stores in #civic-sub-type hidden input.
 *
 * DOM dependencies:
 *   #civic-sub-type-picker      — container for radio cards
 *   #civic-sub-type             — hidden input for form submission
 *   #issue-sub-types-data       — CSP-safe JSON with issue sub-types
 *
 * Exposes: window.newshubCivicSubType = { reset: fn }
 */
(function () {
  'use strict';

  var picker = document.getElementById('civic-sub-type-picker');
  var hidden = document.getElementById('civic-sub-type');
  var dataEl = document.getElementById('issue-sub-types-data');
  if (!picker || !hidden || !dataEl) return;

  var subTypes = [];
  try { subTypes = JSON.parse(dataEl.textContent) || []; } catch (e) { return; }

  subTypes.forEach(function (st) {
    var label = document.createElement('label');
    label.className = 'radio-card';

    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'civic_sub_type_radio';
    input.value = st.status_id;
    input.id = 'civic_sub_type_radio-' + st.status_id;

    var iconSpan = document.createElement('span');
    iconSpan.className = 'radio-card-icon';
    iconSpan.textContent = st.status_icon || '';

    var labelSpan = document.createElement('span');
    labelSpan.className = 'radio-card-label';
    labelSpan.textContent = st.status_name_bn + ' (' + st.status_name_en + ')';

    label.appendChild(input);
    label.appendChild(iconSpan);
    label.appendChild(labelSpan);
    picker.appendChild(label);

    input.addEventListener('change', function () { hidden.value = this.value; });
  });

  /* Public API for form-clear */
  window.newshubCivicSubType = {
    reset: function () {
      var radios = document.querySelectorAll('input[name="civic_sub_type_radio"]');
      for (var i = 0; i < radios.length; i++) {
        radios[i].checked = false;
      }
      hidden.value = '';
    },
  };
})();
