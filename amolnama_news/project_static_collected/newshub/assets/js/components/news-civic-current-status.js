/**
 * news-civic-current-status.js
 * Builds radio cards from DB-driven JSON (#issue-statuses-data),
 * reads selected status + description and serializes to
 * #civic-status-json hidden input on input/change and before form submit.
 *
 * DOM dependencies:
 *   #civic-status-picker           — container for radio cards
 *   #civic-status-description      — status description textarea
 *   #civic-status-json             — hidden JSON input for form submission
 *   #issue-statuses-data           — CSP-safe JSON with issue statuses
 *
 * Exposes: window.newshubCivicStatus = { reset: fn }
 */
(function () {
  'use strict';

  var picker = document.getElementById('civic-status-picker');
  var descriptionEl = document.getElementById('civic-status-description');
  var hiddenJson = document.getElementById('civic-status-json');

  if (!hiddenJson || !picker) return;

  /* ---- Parse JSON helper ---- */
  function parseJsonData(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; }
    catch (e) { return []; }
  }

  /* ---- Build radio cards from DB data ---- */
  var issueStatuses = parseJsonData('issue-statuses-data');
  issueStatuses.forEach(function (status) {
    var label = document.createElement('label');
    label.className = 'radio-list-item';

    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'civic_status_radio';
    input.value = status.status_id;

    var iconSpan = document.createElement('span');
    iconSpan.className = 'radio-list-icon';
    iconSpan.textContent = status.status_icon || '';

    var labelSpan = document.createElement('span');
    labelSpan.className = 'radio-list-label';
    labelSpan.textContent = status.status_name_bn + ' (' + status.status_name_en + ')';

    label.appendChild(input);
    label.appendChild(iconSpan);
    label.appendChild(labelSpan);
    picker.appendChild(label);

    input.addEventListener('change', serialize);
  });

  function serialize() {
    var radios = document.querySelectorAll('input[name="civic_status_radio"]');
    var selectedStatusId = 0;
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked) {
        selectedStatusId = parseInt(radios[i].value, 10) || 0;
        break;
      }
    }

    var data = {
      issueStatusId: selectedStatusId,
      description: descriptionEl ? descriptionEl.value.trim() : '',
    };

    hiddenJson.value = JSON.stringify(data);
  }

  /* Listen for input on description */
  if (descriptionEl) {
    descriptionEl.addEventListener('input', serialize);
  }

  /* Serialize before form submit */
  var form = hiddenJson.closest('form');
  if (form) {
    form.addEventListener('submit', serialize);
  }

  /* Public API for form-clear */
  window.newshubCivicStatus = {
    reset: function () {
      var radios = document.querySelectorAll('input[name="civic_status_radio"]');
      for (var i = 0; i < radios.length; i++) {
        radios[i].checked = false;
      }
      if (descriptionEl) descriptionEl.value = '';
      hiddenJson.value = '';
    },
  };
})();
