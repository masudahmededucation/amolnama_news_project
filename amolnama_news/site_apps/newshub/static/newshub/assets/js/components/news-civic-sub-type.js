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
 * Exposes: window.newshubCivicSubType = { reset: callback }
 */
(function () {
  'use strict';

  const picker = document.getElementById('civic-sub-type-picker');
  const hidden = document.getElementById('civic-sub-type');
  const dataEl = document.getElementById('issue-sub-types-data');
  if (!picker || !hidden || !dataEl) return;

  let subTypes = [];
  try { subTypes = JSON.parse(dataEl.textContent) || []; } catch (e) { return; }

  subTypes.forEach(function (st) {
    const label = document.createElement('label');
    label.className = 'radio-card';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'civic_sub_type_radio';
    input.value = st.status_id;
    input.id = 'civic_sub_type_radio-' + st.status_id;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'radio-card-icon';
    iconSpan.textContent = st.status_icon || '';

    const labelSpan = document.createElement('span');
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
      const radios = document.querySelectorAll('input[name="civic_sub_type_radio"]');
      for (let i = 0; i < radios.length; i++) {
        radios[i].checked = false;
      }
      hidden.value = '';
    },
  };
})();
