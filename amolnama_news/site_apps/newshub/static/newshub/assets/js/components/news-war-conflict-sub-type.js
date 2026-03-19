/**
 * news-war-conflict-sub-type.js
 * Builds radio cards from DB-driven JSON (#conflict-sub-types-data),
 * reads selected sub-type and stores in #global-sub-type hidden input.
 *
 * DOM dependencies:
 *   #global-sub-type-picker      — container for radio cards
 *   #global-sub-type             — hidden input for form submission
 *   #conflict-sub-types-data     — CSP-safe JSON with conflict sub-types
 *
 * Exposes: window.newshubGlobalSubType = { reset: fn }
 */
(function () {
  'use strict';

  var picker = document.getElementById('global-sub-type-picker');
  var hidden = document.getElementById('global-sub-type');
  var dataEl = document.getElementById('conflict-sub-types-data');
  if (!picker || !hidden || !dataEl) return;

  var subTypes = [];
  try { subTypes = JSON.parse(dataEl.textContent) || []; } catch (e) { return; }

  subTypes.forEach(function (st) {
    var label = document.createElement('label');
    label.className = 'radio-card';

    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'global_sub_type_radio';
    input.value = st.status_id;

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
  window.newshubGlobalSubType = {
    reset: function () {
      var radios = document.querySelectorAll('input[name="global_sub_type_radio"]');
      for (var i = 0; i < radios.length; i++) {
        radios[i].checked = false;
      }
      hidden.value = '';
    }
  };
})();
