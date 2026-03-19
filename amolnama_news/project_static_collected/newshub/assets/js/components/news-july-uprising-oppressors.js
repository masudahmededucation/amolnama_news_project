/**
 * news-july-uprising-oppressors.js
 * Reads oppressor fields (forces checkboxes, unit, commanding officer,
 * OC/DC, directives) and serializes to #july-oppressors-json hidden input
 * on input/change and before form submit.
 *
 * DOM dependencies:
 *   input[name="july_force"]      — checkboxes (multiple)
 *   #july-unit-badge              — text input
 *   #july-commanding-officer      — text input
 *   #july-oc-dc                   — text input
 *   #july-directives              — textarea
 *   #july-oppressors-json         — hidden JSON input for form submission
 *
 * Exposes: window.newshubJulyOppressors = { reset: fn }
 */
(function () {
  'use strict';

  var forceCheckboxes = document.querySelectorAll('input[name="july_force"]');
  var unitBadge = document.getElementById('july-unit-badge');
  var commandingOfficer = document.getElementById('july-commanding-officer');
  var ocDc = document.getElementById('july-oc-dc');
  var directives = document.getElementById('july-directives');
  var hiddenJson = document.getElementById('july-oppressors-json');

  if (!hiddenJson) return;

  function getForces() {
    var forces = [];
    for (var i = 0; i < forceCheckboxes.length; i++) {
      if (forceCheckboxes[i].checked) forces.push(forceCheckboxes[i].value);
    }
    return forces;
  }

  function serialize() {
    var data = {
      forces: getForces(),
      unitBadge: unitBadge ? unitBadge.value.trim() : '',
      commandingOfficer: commandingOfficer ? commandingOfficer.value.trim() : '',
      ocDc: ocDc ? ocDc.value.trim() : '',
      directives: directives ? directives.value.trim() : '',
    };
    hiddenJson.value = JSON.stringify(data);
  }

  for (var i = 0; i < forceCheckboxes.length; i++) {
    forceCheckboxes[i].addEventListener('change', serialize);
  }

  var inputFields = [unitBadge, commandingOfficer, ocDc];
  inputFields.forEach(function (el) {
    if (el) el.addEventListener('input', serialize);
  });

  if (directives) directives.addEventListener('input', serialize);

  var form = hiddenJson.closest('form');
  if (form) form.addEventListener('submit', serialize);

  window.newshubJulyOppressors = {
    reset: function () {
      for (var j = 0; j < forceCheckboxes.length; j++) {
        forceCheckboxes[j].checked = false;
      }
      if (unitBadge) unitBadge.value = '';
      if (commandingOfficer) commandingOfficer.value = '';
      if (ocDc) ocDc.value = '';
      if (directives) directives.value = '';
      hiddenJson.value = '';
    },
  };
})();
