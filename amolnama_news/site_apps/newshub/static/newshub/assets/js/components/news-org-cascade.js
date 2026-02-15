/**
 * news-org-cascade.js
 * 1) Org-type dropdown → loads orgs into org-name dropdown.
 * 2) Custom text input → live autocomplete search across orgs (EN + BN).
 *    Selecting a suggestion sets the dropdown value.
 */
(function () {
  var typeSelect = document.getElementById('contributor-org-type');
  var orgSelect = document.getElementById('contributor-organization');
  var customInput = document.getElementById('contributor-org-custom');

  if (!typeSelect || !orgSelect) return;

  var contribTypeSelect = document.getElementById('contributor-type');

  /* ===== Contributor type → org type default ===== */

  function setOrgTypeDefault(contribTypeId) {
    var id = parseInt(contribTypeId, 10);
    var orgTypeId = (id === 1) ? '22' : '17';
    if (typeSelect.value !== orgTypeId) {
      typeSelect.value = orgTypeId;
      loadOrgs(orgTypeId);
      if (customInput) customInput.value = '';
    }
  }

  if (contribTypeSelect) {
    contribTypeSelect.addEventListener('change', function () {
      if (contribTypeSelect.value) {
        setOrgTypeDefault(contribTypeSelect.value);
      }
    });
  }

  /* ===== Dropdown cascade: type → orgs ===== */

  function loadOrgs(typeId) {
    orgSelect.innerHTML = '<option value="">-- লোড হচ্ছে... --</option>';

    if (!typeId) {
      orgSelect.innerHTML = '<option value="">-- প্রথমে ধরন নির্বাচন করুন --</option>';
      return;
    }

    fetch('/newshub/api/organisations/' + typeId + '/')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var opts = '<option value="">-- প্রতিষ্ঠানের নাম (ঐচ্ছিক) --</option>';
        if (data.organisations && data.organisations.length > 0) {
          data.organisations.forEach(function (o) {
            var label = o.name_bn || o.name_en;
            if (o.name_en && o.name_bn) label = o.name_bn + ' (' + o.name_en + ')';
            opts += '<option value="' + o.id + '">' + label + '</option>';
          });
        }
        orgSelect.innerHTML = opts;
      })
      .catch(function () {
        orgSelect.innerHTML = '<option value="">-- লোড ব্যর্থ --</option>';
      });
  }

  /* Selecting from dropdown clears the custom text */
  orgSelect.addEventListener('change', function () {
    if (orgSelect.value && customInput) {
      customInput.value = '';
      hideSuggestions();
    }
  });

  typeSelect.addEventListener('change', function () {
    loadOrgs(typeSelect.value);
    if (customInput) customInput.value = '';
    hideSuggestions();
  });

  /* Set initial org type based on contributor type, then load orgs */
  if (contribTypeSelect && contribTypeSelect.value) {
    setOrgTypeDefault(contribTypeSelect.value);
  } else if (typeSelect.value) {
    loadOrgs(typeSelect.value);
  }

  /* ===== Autocomplete on custom text input ===== */

  if (!customInput) return;

  /* Build suggestions container */
  var wrapper = customInput.parentElement;
  wrapper.style.position = 'relative';

  var suggestBox = document.createElement('ul');
  suggestBox.className = 'org-autocomplete';
  suggestBox.style.display = 'none';
  wrapper.appendChild(suggestBox);

  var debounceTimer = null;

  customInput.addEventListener('input', function () {
    /* Reset dropdown when typing */
    orgSelect.value = '';

    var q = customInput.value.trim();
    if (q.length < 2) {
      hideSuggestions();
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { searchOrgs(q); }, 250);
  });

  function searchOrgs(q) {
    var url = '/newshub/api/organisations/search/?q=' + encodeURIComponent(q);
    var typeId = typeSelect.value;
    if (typeId) url += '&type_id=' + typeId;

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.organisations || data.organisations.length === 0) {
          hideSuggestions();
          return;
        }
        renderSuggestions(data.organisations);
      })
      .catch(function () { hideSuggestions(); });
  }

  function renderSuggestions(orgs) {
    suggestBox.innerHTML = '';
    orgs.forEach(function (o) {
      var li = document.createElement('li');
      li.className = 'org-autocomplete-item';

      var label = o.name_bn || o.name_en;
      if (o.name_en && o.name_bn) label = o.name_bn + ' (' + o.name_en + ')';
      li.textContent = label;

      li.addEventListener('mousedown', function (e) {
        e.preventDefault(); /* prevent input blur before click registers */
        selectSuggestion(o);
      });

      suggestBox.appendChild(li);
    });
    suggestBox.style.display = 'block';
  }

  function selectSuggestion(o) {
    /* Try to select in the existing dropdown */
    var found = false;
    for (var i = 0; i < orgSelect.options.length; i++) {
      if (orgSelect.options[i].value === String(o.id)) {
        orgSelect.value = String(o.id);
        found = true;
        break;
      }
    }

    /* If not in current list, add a temporary option */
    if (!found) {
      var label = o.name_bn || o.name_en;
      if (o.name_en && o.name_bn) label = o.name_bn + ' (' + o.name_en + ')';
      var opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = label;
      orgSelect.appendChild(opt);
      orgSelect.value = String(o.id);
    }

    customInput.value = '';
    hideSuggestions();
  }

  function hideSuggestions() {
    suggestBox.style.display = 'none';
    suggestBox.innerHTML = '';
  }

  customInput.addEventListener('blur', function () {
    /* Delay so mousedown on suggestion fires first */
    setTimeout(hideSuggestions, 150);
  });

  customInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideSuggestions();
  });
})();
