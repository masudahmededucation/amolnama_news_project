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

  const picker = document.getElementById('civic-status-picker');
  const descriptionEl = document.getElementById('civic-status-description');
  const hiddenJson = document.getElementById('civic-status-json');

  if (!hiddenJson || !picker) return;

  /* ---- Parse JSON helper ---- */
  function parseJsonData(id) {
    const el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; }
    catch (e) { return []; }
  }

  /* ---- Build radio cards from DB data ---- */
  const issueStatuses = parseJsonData('issue-statuses-data');
  issueStatuses.forEach(function (status) {
    const label = document.createElement('label');
    label.className = 'radio-list-item';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'civic_status_radio';
    input.value = status.status_id;
    input.id = 'civic_status_radio-' + status.status_id;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'radio-list-icon';
    iconSpan.textContent = status.status_icon || '';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'radio-list-label';
    labelSpan.textContent = status.status_name_bn + ' (' + status.status_name_en + ')';

    label.appendChild(input);
    label.appendChild(iconSpan);
    label.appendChild(labelSpan);
    picker.appendChild(label);

    input.addEventListener('change', serialize);
  });

  function serialize() {
    let radios = document.querySelectorAll('input[name="civic_status_radio"]');
    let selectedStatusId = 0;
    for (let i = 0; i < radios.length; i++) {
      if (radios[i].checked) {
        selectedStatusId = parseInt(radios[i].value, 10) || 0;
        break;
      }
    }

    let data = {
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
  const form = hiddenJson.closest('form');
  if (form) {
    form.addEventListener('submit', serialize);
  }

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    let data;
    try { data = JSON.parse(hiddenJson.value); } catch (e) { return; }

    if (data.issueStatusId) {
      let radios = document.querySelectorAll('input[name="civic_status_radio"]');
      for (let i = 0; i < radios.length; i++) {
        if (parseInt(radios[i].value, 10) === data.issueStatusId) {
          radios[i].checked = true;
          break;
        }
      }
    }
    if (descriptionEl && data.description) descriptionEl.value = data.description;
  }
  setTimeout(restoreFromSavedData, 100);

  /* Public API for form-clear */
  window.newshubCivicStatus = {
    reset: function () {
      const radios = document.querySelectorAll('input[name="civic_status_radio"]');
      for (let i = 0; i < radios.length; i++) {
        radios[i].checked = false;
      }
      if (descriptionEl) descriptionEl.value = '';
      hiddenJson.value = '';
    },
  };
})();
