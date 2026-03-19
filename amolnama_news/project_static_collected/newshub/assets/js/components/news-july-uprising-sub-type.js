/**
 * news-july-uprising-sub-type.js
 * Syncs the July 2024 incident type radio cards to the
 * #july-sub-type hidden input (stores status_id from DB).
 *
 * DOM dependencies:
 *   input[name="july_sub_type_radio"]  — radio buttons (value = status_id)
 *   #july-sub-type                     — hidden input for form submission
 *
 * Exposes: window.newshubJulySubType = { reset: fn }
 */
(function () {
  'use strict';

  var radios = document.querySelectorAll('input[name="july_sub_type_radio"]');
  var hidden = document.getElementById('july-sub-type');

  if (!hidden) return;

  function syncToHidden() {
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked) {
        hidden.value = radios[i].value;
        return;
      }
    }
    hidden.value = '';
  }

  for (var i = 0; i < radios.length; i++) {
    radios[i].addEventListener('change', syncToHidden);
  }

  window.newshubJulySubType = {
    reset: function () {
      for (var j = 0; j < radios.length; j++) {
        radios[j].checked = false;
      }
      hidden.value = '';
    },
  };
})();
