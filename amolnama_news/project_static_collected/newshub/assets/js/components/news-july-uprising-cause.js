/**
 * news-july-uprising-cause.js
 * Reads cause-of-death/injury fields (weapon type, injury site,
 * time of injury, hospital, time of death, autopsy/cert/docs flags)
 * and serializes to #july-cause-json hidden input on input/change
 * and before form submit.
 *
 * DOM dependencies:
 *   #july-weapon-type        — select
 *   #july-injury-site        — select
 *   #july-time-of-injury     — text input
 *   #july-hospital           — text input
 *   #july-time-of-death      — text input
 *   #july-autopsy-done       — checkbox
 *   #july-death-certificate  — checkbox
 *   #july-medical-docs       — checkbox
 *   #july-cause-json         — hidden JSON input for form submission
 *
 * Exposes: window.newshubJulyCause = { reset: fn }
 */
(function () {
  'use strict';

  const weaponType = document.getElementById('july-weapon-type');
  const injurySite = document.getElementById('july-injury-site');
  const timeOfInjury = document.getElementById('july-time-of-injury');
  const hospital = document.getElementById('july-hospital');
  const timeOfDeath = document.getElementById('july-time-of-death');
  const autopsyDone = document.getElementById('july-autopsy-done');
  const deathCertificate = document.getElementById('july-death-certificate');
  const medicalDocs = document.getElementById('july-medical-docs');
  const hiddenJson = document.getElementById('july-cause-json');

  if (!hiddenJson) return;

  function serialize() {
    let data = {
      weaponType: weaponType ? weaponType.value : '',
      injurySite: injurySite ? injurySite.value : '',
      timeOfInjury: timeOfInjury ? timeOfInjury.value.trim() : '',
      hospital: hospital ? hospital.value.trim() : '',
      timeOfDeath: timeOfDeath ? timeOfDeath.value.trim() : '',
      autopsyDone: autopsyDone ? autopsyDone.checked : false,
      deathCertificate: deathCertificate ? deathCertificate.checked : false,
      medicalDocs: medicalDocs ? medicalDocs.checked : false,
    };
    hiddenJson.value = JSON.stringify(data);
  }

  const changeFields = [weaponType, injurySite];
  changeFields.forEach(function (el) {
    if (el) el.addEventListener('change', serialize);
  });

  const inputFields = [timeOfInjury, hospital, timeOfDeath];
  inputFields.forEach(function (el) {
    if (el) el.addEventListener('input', serialize);
  });

  const checkboxes = [autopsyDone, deathCertificate, medicalDocs];
  checkboxes.forEach(function (el) {
    if (el) el.addEventListener('change', serialize);
  });

  const form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  /* ========== Restore from saved data ========== */
  function restoreFromSavedData() {
    if (!hiddenJson.value) return;
    let data;
    try { data = JSON.parse(hiddenJson.value); } catch (e) { return; }
    if (!data || typeof data !== 'object') return;

    if (weaponType && data.weaponType) {
      weaponType.value = data.weaponType;
      if (weaponType.tomselect) weaponType.tomselect.setValue(data.weaponType, true);
    }
    if (injurySite && data.injurySite) {
      injurySite.value = data.injurySite;
      if (injurySite.tomselect) injurySite.tomselect.setValue(data.injurySite, true);
    }
    if (timeOfInjury && data.timeOfInjury) timeOfInjury.value = data.timeOfInjury;
    if (hospital && data.hospital) hospital.value = data.hospital;
    if (timeOfDeath && data.timeOfDeath) timeOfDeath.value = data.timeOfDeath;
    if (autopsyDone && data.autopsyDone) autopsyDone.checked = true;
    if (deathCertificate && data.deathCertificate) deathCertificate.checked = true;
    if (medicalDocs && data.medicalDocs) medicalDocs.checked = true;
  }

  setTimeout(restoreFromSavedData, 100);

  window.newshubJulyCause = {
    reset: function () {
      if (weaponType) weaponType.selectedIndex = 0;
      if (injurySite) injurySite.selectedIndex = 0;
      if (timeOfInjury) timeOfInjury.value = '';
      if (hospital) hospital.value = '';
      if (timeOfDeath) timeOfDeath.value = '';
      if (autopsyDone) autopsyDone.checked = false;
      if (deathCertificate) deathCertificate.checked = false;
      if (medicalDocs) medicalDocs.checked = false;
      hiddenJson.value = '';
    },
  };
})();
