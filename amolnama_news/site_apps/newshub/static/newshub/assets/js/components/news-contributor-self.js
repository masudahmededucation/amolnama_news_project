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
  const section = document.getElementById('section-contributor-info');
  if (!section) return;

  const typeSelect = document.getElementById('contributor-type');
  if (!typeSelect) return;

  /* === IDs === */
  const SELF_TYPE_ID = '1';
  const CITIZEN_TYPE_ID = '2';
  const CITIZEN_ORG_TYPE_ID = '22';
  const MEDIA_ORG_TYPE_ID = '17';

  /* === DOM refs === */
  const nameInput = document.getElementById('contributor-full-name');
  const emailInput = document.getElementById('contributor-email');
  const phoneInput = document.getElementById('contributor-phone');
  const details = document.getElementById('contributor-details');
  const orgTypeSelect = document.getElementById('contributor-org-type');

  /* === Self profile data (logged-in only) === */
  const isSelfAvailable = section.hasAttribute('data-is-self');
  const selfName = section.getAttribute('data-self-name') || '';
  const selfEmail = section.getAttribute('data-self-email') || '';
  const selfPhone = section.getAttribute('data-self-phone') || '';

  let autoFilled = false;
  let userChangedOrg = false;

  function applyState() {
    const selectedType = typeSelect.value;

    /* --- Default org type based on contributor type --- */
    if (orgTypeSelect && !userChangedOrg) {
      const targetOrg = (selectedType === CITIZEN_TYPE_ID) ? CITIZEN_ORG_TYPE_ID : MEDIA_ORG_TYPE_ID;
      if (selectedType && selectedType !== SELF_TYPE_ID) {
        orgTypeSelect.value = targetOrg;
        orgTypeSelect.dispatchEvent(new Event('change'));
      }
    }

    /* --- Self: auto-fill + hide details only if name populated (logged-in only) --- */
    if (isSelfAvailable && details) {
      if (selectedType === SELF_TYPE_ID) {
        if (nameInput && selfName) nameInput.value = selfName;
        if (emailInput && selfEmail) emailInput.value = selfEmail;
        if (phoneInput && selfPhone) phoneInput.value = selfPhone;
        autoFilled = true;
        /* Only hide if name was actually filled — otherwise keep visible so user can type */
        details.style.display = selfName ? 'none' : '';
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
