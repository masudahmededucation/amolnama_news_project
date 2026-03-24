/**
 * marriage-saved-office.js
 * Save/load/delete office info for the Marriage Certificate form (Step 1).
 * Only active when #saved-office-bar exists (logged-in users).
 */
(function () {
  'use strict';

  var bar = document.getElementById('saved-office-bar');
  if (!bar) return;

  var select    = document.getElementById('saved-office-select');
  var btnLoad   = document.getElementById('btn-load-office');
  var btnDelete = document.getElementById('btn-delete-office');
  var btnSave   = document.getElementById('btn-save-office');
  var labelInput = document.getElementById('save-office-label');
  var defaultChk = document.getElementById('save-office-default');

  /* Field IDs that map to the saved office columns */
  var FIELD_MAP = {
    'govt_title':     'cert-govt-title',
    'office_name':    'cert-office-name',
    'office_address': 'cert-office-address',
    'reg_no':         'cert-reg-no',
    'office_date':    'cert-date'
  };

  var API_LIST   = '/bangladesh-marriage-registration/api/saved-offices/';
  var API_SAVE   = '/bangladesh-marriage-registration/api/saved-offices/save/';
  var API_DELETE  = '/bangladesh-marriage-registration/api/saved-offices/delete/';

  /* ── CSRF ── */
  function getCsrf() {
    var match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? match[1] : '';
  }

  /* ── Populate select dropdown ── */
  function loadList() {
    fetch(API_LIST, { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (offices) {
        /* Clear existing options except placeholder */
        while (select.options.length > 1) select.remove(1);

        offices.forEach(function (o) {
          var opt = document.createElement('option');
          opt.value = o.user_saved_office_id;
          var label = o.office_label || o.office_name || 'Office #' + o.user_saved_office_id;
          if (o.is_default) label += ' *';
          opt.textContent = label;
          opt.dataset.office = JSON.stringify(o);
          select.appendChild(opt);
        });

        /* Auto-select and load default office */
        var defaultOffice = offices.find(function (o) { return o.is_default; });
        if (defaultOffice) {
          select.value = defaultOffice.user_saved_office_id;
          fillForm(defaultOffice);
          updateButtons();
        }
      });
  }

  /* ── Fill form fields from office data ── */
  function fillForm(office) {
    Object.keys(FIELD_MAP).forEach(function (key) {
      var el = document.getElementById(FIELD_MAP[key]);
      if (el) el.value = office[key] || '';
    });
  }

  /* ── Read form fields into object ── */
  function readForm() {
    var data = {};
    Object.keys(FIELD_MAP).forEach(function (key) {
      var el = document.getElementById(FIELD_MAP[key]);
      data[key] = el ? el.value : '';
    });
    return data;
  }

  /* ── Enable/disable load & delete buttons ── */
  function updateButtons() {
    var hasSelection = select.value !== '';
    btnLoad.disabled = !hasSelection;
    btnDelete.disabled = !hasSelection;
  }

  /* ── Events ── */
  select.addEventListener('change', updateButtons);

  btnLoad.addEventListener('click', function () {
    var opt = select.options[select.selectedIndex];
    if (!opt || !opt.dataset.office) return;
    var office = JSON.parse(opt.dataset.office);
    fillForm(office);
  });

  btnSave.addEventListener('click', function () {
    var data = readForm();
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
    .then(function (r) { return r.json(); })
    .then(function (result) {
      if (result.ok) {
        loadList();
        labelInput.value = '';
        defaultChk.checked = false;
      }
    });
  });

  btnDelete.addEventListener('click', function () {
    if (!select.value) return;
    var opt = select.options[select.selectedIndex];
    var label = opt ? opt.textContent : '';
    if (!confirm('Delete "' + label + '"?')) return;

    fetch(API_DELETE, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrf()
      },
      body: JSON.stringify({ office_id: parseInt(select.value, 10) })
    })
    .then(function (r) { return r.json(); })
    .then(function (result) {
      if (result.ok) loadList();
    });
  });

  /* ── Init: load saved offices on page load ── */
  loadList();
})();
