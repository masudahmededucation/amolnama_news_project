/**
 * marriage-saved-office.js
 * Save/load/delete office info for the Marriage Certificate form (Step 1).
 * Only active when #saved-office-bar exists (logged-in users).
 */
(function () {
  'use strict';
  const getCsrf = window.getCsrfTokenValue;

  const bar = document.getElementById('saved-office-bar');
  if (!bar) return;

  const select    = document.getElementById('saved-office-select');
  const btnLoad   = document.getElementById('button-load-office');
  const btnDelete = document.getElementById('button-delete-office');
  const btnSave   = document.getElementById('button-save-office');
  const labelInput = document.getElementById('save-office-label');
  const defaultChk = document.getElementById('save-office-default');

  /* Field IDs that map to the saved office columns */
  const FIELD_MAP = {
    'govt_title':     'cert-govt-title',
    'office_name':    'cert-office-name',
    'office_address': 'cert-office-address',
    'reg_no':         'cert-reg-no',
    'office_date':    'cert-date'
  };

  const API_LIST   = '/bangladesh-marriage-registration/api/saved-offices/';
  const API_SAVE   = '/bangladesh-marriage-registration/api/saved-offices/save/';
  const API_DELETE  = '/bangladesh-marriage-registration/api/saved-offices/delete/';

  /* ── CSRF ── */

  /* ── Populate select dropdown ── */
  function loadList() {
    fetch(API_LIST, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (offices) {
        /* Clear existing options except placeholder */
        while (select.options.length > 1) select.remove(1);

        offices.forEach(function (o) {
          let opt = document.createElement('option');
          opt.value = o.user_saved_office_id;
          let label = o.office_label || o.office_name || 'Office #' + o.user_saved_office_id;
          if (o.is_default) label += ' *';
          opt.textContent = label;
          opt.dataset.office = JSON.stringify(o);
          select.appendChild(opt);
        });

        /* Auto-select and load default office */
        const defaultOffice = offices.find(function (o) { return o.is_default; });
        if (defaultOffice) {
          select.value = defaultOffice.user_saved_office_id;
          fillForm(defaultOffice);
          updateButtons();
        }
      })
      .catch(function () {});
  }

  /* ── Fill form fields from office data ── */
  function fillForm(office) {
    Object.keys(FIELD_MAP).forEach(function (key) {
      let el = document.getElementById(FIELD_MAP[key]);
      if (el) el.value = office[key] || '';
    });
  }

  /* ── Read form fields into object ── */
  function readForm() {
    let data = {};
    Object.keys(FIELD_MAP).forEach(function (key) {
      const el = document.getElementById(FIELD_MAP[key]);
      data[key] = el ? el.value : '';
    });
    return data;
  }

  /* ── Enable/disable load & delete buttons ── */
  function updateButtons() {
    const hasSelection = select.value !== '';
    btnLoad.disabled = !hasSelection;
    btnDelete.disabled = !hasSelection;
  }

  /* ── Events ── */
  select.addEventListener('change', updateButtons);

  btnLoad.addEventListener('click', function () {
    const opt = select.options[select.selectedIndex];
    if (!opt || !opt.dataset.office) return;
    const office = JSON.parse(opt.dataset.office);
    fillForm(office);
  });

  btnSave.addEventListener('click', function () {
    const data = readForm();
    data.office_label = (labelInput.value || '').trim();
    data.is_default = defaultChk.checked;

    /* If an office is selected, update it; otherwise create new */
    if (select.value) {
      data.office_id = parseInt(select.value, 10);
    }

    fetch(API_SAVE, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrf()
      },
      body: JSON.stringify(data)
    })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (result) {
      if (result.ok) {
        loadList();
        labelInput.value = '';
        defaultChk.checked = false;
      }
    })
    .catch(function () {});
  });

  let deleteConfirmPending = false;
  btnDelete.addEventListener('click', function () {
    if (!select.value) return;
    if (!deleteConfirmPending) {
      deleteConfirmPending = true;
      btnDelete.textContent = 'নিশ্চিত? আবার ক্লিক করুন';
      btnDelete.style.color = 'var(--danger)';
      setTimeout(function () { deleteConfirmPending = false; btnDelete.textContent = 'Delete'; btnDelete.style.color = ''; }, 3000);
      return;
    }
    deleteConfirmPending = false;
    btnDelete.textContent = 'Delete';
    btnDelete.style.color = '';

    fetch(API_DELETE, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrf()
      },
      body: JSON.stringify({ office_id: parseInt(select.value, 10) })
    })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (result) {
      if (result.ok) loadList();
    })
    .catch(function () {});
  });

  /* ── Init: load saved offices on page load ── */
  loadList();
})();
