/**
 * news-contributor-self.js
 * Handles contributor type–driven defaults:
 *
 * 1. "Citizen" (contributor_type_id=2) selected:
 *    → Sets organisation type to "Citizen Safety…" (organisation_type_id=22)
 *    → Triggers cascade to load organisations for that type
 *
 * 2. "Self" (contributor_type_id=1) selected (logged-in only):
 *    → Auto-fills name, email, phone from profile data
 *    → Hides all contributor detail fields
 *    → Switching away clears auto-filled values and shows fields
 */
(function () {
  var section = document.getElementById('section-contributor-info');
  if (!section) return;

  var typeSelect = document.getElementById('contributor-type');
  if (!typeSelect) return;

  /* === IDs === */
  var SELF_TYPE_ID = '1';
  var CITIZEN_TYPE_ID = '2';
  var CITIZEN_ORG_TYPE_ID = '22';
  var MEDIA_ORG_TYPE_ID = '17';

  /* === DOM refs === */
  var nameInput = document.getElementById('contributor-full-name');
  var emailInput = document.getElementById('contributor-email');
  var phoneInput = document.getElementById('contributor-phone');
  var details = document.getElementById('contributor-details');
  var orgTypeSelect = document.getElementById('contributor-org-type');

  /* === Self profile data (logged-in only) === */
  var isSelfAvailable = section.hasAttribute('data-is-self');
  var selfName = section.getAttribute('data-self-name') || '';
  var selfEmail = section.getAttribute('data-self-email') || '';
  var selfPhone = section.getAttribute('data-self-phone') || '';

  var autoFilled = false;
  var userChangedOrg = false;

  function applyState() {
    var selectedType = typeSelect.value;

    /* --- Default org type based on contributor type --- */
    if (orgTypeSelect && !userChangedOrg) {
      var targetOrg = (selectedType === CITIZEN_TYPE_ID) ? CITIZEN_ORG_TYPE_ID : MEDIA_ORG_TYPE_ID;
      if (selectedType && selectedType !== SELF_TYPE_ID) {
        orgTypeSelect.value = targetOrg;
        orgTypeSelect.dispatchEvent(new Event('change'));
      }
    }

    /* --- Self: hide details + auto-fill (logged-in only) --- */
    if (isSelfAvailable && details) {
      if (selectedType === SELF_TYPE_ID) {
        if (nameInput && selfName) nameInput.value = selfName;
        if (emailInput && selfEmail) emailInput.value = selfEmail;
        if (phoneInput && selfPhone) phoneInput.value = selfPhone;
        autoFilled = true;
        details.style.display = 'none';
      } else {
        if (autoFilled) {
          if (nameInput) nameInput.value = '';
          if (emailInput) emailInput.value = '';
          if (phoneInput) phoneInput.value = '';
          autoFilled = false;
        }
        details.style.display = '';
      }
    }
  }

  typeSelect.addEventListener('change', applyState);

  /* Track manual org type changes so we don't override user choice */
  if (orgTypeSelect) {
    orgTypeSelect.addEventListener('mousedown', function () { userChangedOrg = true; });
  }

  /* Reset manual flag when contributor type changes, so new default applies */
  typeSelect.addEventListener('change', function () { userChangedOrg = false; });

  /* Apply on page load */
  applyState();
})();
