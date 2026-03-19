/**
 * news-july-uprising-martyr.js
 * Reads martyr profile fields and serializes to #july-martyr-json
 * hidden input on input/change and before form submit.
 *
 * Name fields (first/last, EN + BN) are handled by window.newshubPersonName
 * (news-person-name.js — must load first). Slug auto-generated from EN name.
 *
 * Home location (district + upazila) is handled by news-july-martyr-home-location.js
 * which must load before this file.
 *
 * DOM dependencies:
 *   july-martyr-{first|last}-name-{en|bn}     — text inputs (via person-name-fields.html)
 *   #july-martyr-alias                         — text input
 *   #july-martyr-gender                        — select (from person-personal-info-fields.html)
 *   #july-martyr-religion                      — select
 *   #july-martyr-age                           — number input
 *   #july-martyr-dob                           — date input (max set to 2024-08-07)
 *   #july-martyr-district                      — select (home district)
 *   #july-martyr-contact                       — text input
 *   #july-martyr-occupation                    — select (from person-occupation-fields.html)
 *   #july-martyr-institution                   — text input
 *   input[name="july_martyr_status"]           — radio buttons (lives in Step 5)
 *   july-martyr-father-{firstname|lastname}     — text inputs (via person-name-fields.html)
 *   july-martyr-mother-{first|last}             — text inputs (via person-family-name-fields.html)
 *   window.julyMartyrHomeLocation              — home location cascade module
 *   #july-martyr-json                          — hidden JSON input for form submission
 *
 * Exposes: window.newshubJulyMartyr = { reset: fn }
 */
(function () {
  'use strict';

  var alias       = document.getElementById('july-martyr-alias');
  var gender      = document.getElementById('july-martyr-gender');
  var religion    = document.getElementById('july-martyr-religion');
  var age         = document.getElementById('july-martyr-age');
  var dob         = document.getElementById('july-martyr-dob');
  var district    = document.getElementById('july-martyr-district');
  var contact     = document.getElementById('july-martyr-contact');
  var occupation  = document.getElementById('july-martyr-occupation');
  var institution = document.getElementById('july-martyr-institution');
  var statusRadios = document.querySelectorAll('input[name="july_martyr_status"]');
  /* Father name now comes from person-name-fields.html (Name module) */
  var fatherFirst = document.getElementById('july-martyr-father-firstname');
  var fatherLast  = document.getElementById('july-martyr-father-lastname');
  var motherFirst = document.getElementById('july-martyr-mother-first');
  var motherLast  = document.getElementById('july-martyr-mother-last');
  var hiddenJson = document.getElementById('july-martyr-json');

  if (!hiddenJson) return;

  /* DOB cannot be after 07/08/2024 — martyrs existed before/during the uprising */
  if (dob) dob.max = '2024-08-07';

  function getStatus() {
    for (var i = 0; i < statusRadios.length; i++) {
      if (statusRadios[i].checked) return statusRadios[i].value;
    }
    return '';
  }

  function serialize() {
    var name = window.newshubPersonName ? window.newshubPersonName.read('july-martyr') : {};
    var loc  = window.julyMartyrHomeLocation ? window.julyMartyrHomeLocation.read() : {};
    var data = {
      firstNameEn:      name.firstNameEn || '',
      lastNameEn:       name.lastNameEn  || '',
      firstNameBn:      name.firstNameBn || '',
      lastNameBn:       name.lastNameBn  || '',
      slug:             name.slug        || '',
      alias:            alias       ? alias.value.trim()       : '',
      genderId:         gender   ? gender.value   : '',
      religionId:       religion ? religion.value : '',
      age:              age         ? age.value                : '',
      dob:              dob         ? dob.value                : '',
      districtId:       district    ? district.value           : '',
      contact:          contact     ? contact.value.trim()     : '',
      occupation:       occupation  ? occupation.value         : '',
      institution:      institution ? institution.value.trim() : '',
      status:           getStatus(),
      fatherFirstName:  name.fatherFirstName || '',
      fatherLastName:   name.fatherLastName  || '',
      motherFirstName:  motherFirst ? motherFirst.value.trim() : '',
      motherLastName:   motherLast  ? motherLast.value.trim()  : '',
      homeDistrictId:    loc.districtId    || 0,
      homeDistrictName:  loc.districtName  || '',
      homeUpazilaId:     loc.upazilaId     || 0,
      homeUpazilaName:   loc.upazilaName   || '',
      homeLocalBodyId:   loc.localBodyId   || 0,
      homeLocalBodyName: loc.localBodyName || '',
      homeWardId:        loc.wardId        || 0,
      homeWardName:      loc.wardName      || '',
    };
    hiddenJson.value = JSON.stringify(data);
  }

  /* Bind name fields via shared utility */
  if (window.newshubPersonName) {
    window.newshubPersonName.bind('july-martyr', serialize);
  }

  /* Listen for changes on date field (Flatpickr fires 'change' on original input) */
  if (dob) dob.addEventListener('change', serialize);

  /* Listen for input on text/number fields */
  /* Father name listeners handled by newshubPersonName.bind() above */
  var inputFields = [alias, age, institution, contact, motherFirst, motherLast];
  inputFields.forEach(function (el) {
    if (el) el.addEventListener('input', serialize);
  });

  /* Listen for changes on selects */
  if (gender)     gender.addEventListener('change', serialize);
  if (religion)   religion.addEventListener('change', serialize);
  if (district)   district.addEventListener('change', serialize);
  if (occupation) occupation.addEventListener('change', serialize);

  /* Listen for status radios (lives in Step 5) */
  for (var i = 0; i < statusRadios.length; i++) {
    statusRadios[i].addEventListener('change', serialize);
  }

  /* Re-serialize when home location changes */
  var homeDistrict  = document.getElementById('martyr-home-district-id');
  var homeUpazila   = document.getElementById('martyr-home-upazila-id');
  var homeLocalBody = document.getElementById('martyr-home-local-body-id');
  var homeWard      = document.getElementById('martyr-home-ward-id');
  if (homeDistrict)  homeDistrict.addEventListener('change', serialize);
  if (homeUpazila)   homeUpazila.addEventListener('change', serialize);
  if (homeLocalBody) homeLocalBody.addEventListener('change', serialize);
  if (homeWard)      homeWard.addEventListener('change', serialize);

  /* Serialize before form submit */
  var form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* Public API for form-clear */
  window.newshubJulyMartyr = {
    reset: function () {
      if (window.newshubPersonName) {
        window.newshubPersonName.reset('july-martyr');
      }
      if (alias)    alias.value    = '';
      if (gender)   gender.selectedIndex   = 0;
      if (religion) religion.selectedIndex = 0;
      if (age) age.value = '';
      if (dob) dob.value = '';
      if (district) {
        district.selectedIndex = 0;
        if (district.tomselect) district.tomselect.clear(true);
      }
      if (contact)     contact.value     = '';
      if (occupation) occupation.selectedIndex = 0;
      if (institution) institution.value = '';
      for (var k = 0; k < statusRadios.length; k++) {
        statusRadios[k].checked = false;
      }
      /* Father reset handled by newshubPersonName.reset() above */
      if (motherFirst) motherFirst.value = '';
      if (motherLast)  motherLast.value  = '';
      if (window.julyMartyrHomeLocation) window.julyMartyrHomeLocation.reset();
      hiddenJson.value = '';
    },
  };

  /* Step validator: require martyr first name (English + Bengali) */
  var panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    var step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      var warnings = [];
      var firstEn = document.getElementById('july-martyr-first-name-en');
      var firstBn = document.getElementById('july-martyr-first-name-bn');
      if (!firstEn || !firstEn.value.trim()) {
        warnings.push('\u09B6\u09B9\u09BF\u09A6\u09C7\u09B0 \u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE (English) \u09A6\u09BF\u09A8');
      }
      if (!firstBn || !firstBn.value.trim()) {
        warnings.push('\u09B6\u09B9\u09BF\u09A6\u09C7\u09B0 \u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE (\u09AC\u09BE\u0982\u09B2\u09BE) \u09A6\u09BF\u09A8');
      }
      return { warnings: warnings };
    }});
  }
})();
