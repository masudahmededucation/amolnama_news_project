/**
 * news-sports-scoreboard.js
 * Reads scoreboard fields (sport type, competition type, match status,
 * tournament level, scores, key performance) and serializes to
 * #sports-scoreboard-json hidden input on input/change and before form submit.
 *
 * DOM dependencies:
 *   #sports-sport-type                    — select
 *   input[name="sports_competition_type"] — radio buttons
 *   #sports-match-status                  — select
 *   #sports-tournament-level              — select
 *   #sports-score-a                       — text input
 *   #sports-score-b                       — text input
 *   #sports-key-performance               — textarea
 *   #sports-scoreboard-json               — hidden JSON input for form submission
 *
 * Exposes: window.newshubSportsScoreboard = { reset: fn }
 */
(function () {
  'use strict';

  var sportType = document.getElementById('sports-sport-type');
  var competitionRadios = document.querySelectorAll('input[name="sports_competition_type"]');
  var matchStatus = document.getElementById('sports-match-status');
  var tournamentLevel = document.getElementById('sports-tournament-level');
  var scoreA = document.getElementById('sports-score-a');
  var scoreB = document.getElementById('sports-score-b');
  var keyPerformance = document.getElementById('sports-key-performance');
  var hiddenJson = document.getElementById('sports-scoreboard-json');

  if (!hiddenJson) return;

  function getCompetitionType() {
    for (var i = 0; i < competitionRadios.length; i++) {
      if (competitionRadios[i].checked) return competitionRadios[i].value;
    }
    return 'team_vs_team';
  }

  function serialize() {
    var data = {
      sportType: sportType ? sportType.value : '',
      competitionType: getCompetitionType(),
      matchStatus: matchStatus ? matchStatus.value : '',
      tournamentLevel: tournamentLevel ? tournamentLevel.value : '',
      scoreA: scoreA ? scoreA.value.trim() : '',
      scoreB: scoreB ? scoreB.value.trim() : '',
      keyPerformance: keyPerformance ? keyPerformance.value.trim() : '',
    };

    hiddenJson.value = JSON.stringify(data);
  }

  /* Listen for changes on selects */
  var changeFields = [sportType, matchStatus, tournamentLevel];
  changeFields.forEach(function (el) {
    if (el) el.addEventListener('change', serialize);
  });

  /* Listen for changes on competition type radios */
  for (var i = 0; i < competitionRadios.length; i++) {
    competitionRadios[i].addEventListener('change', serialize);
  }

  /* Listen for input on text fields */
  var inputFields = [scoreA, scoreB, keyPerformance];
  inputFields.forEach(function (el) {
    if (el) el.addEventListener('input', serialize);
  });

  /* Serialize before form submit */
  var form = hiddenJson.closest('form');
  if (form) {
    form.addEventListener('submit', serialize);
  }

  /* Public API for form-clear */
  window.newshubSportsScoreboard = {
    reset: function () {
      if (sportType) sportType.selectedIndex = 0;
      if (competitionRadios.length > 0) competitionRadios[0].checked = true;
      if (matchStatus) matchStatus.selectedIndex = 0;
      if (tournamentLevel) tournamentLevel.selectedIndex = 0;
      if (scoreA) scoreA.value = '';
      if (scoreB) scoreB.value = '';
      if (keyPerformance) keyPerformance.value = '';
      hiddenJson.value = '';
    },
  };

  /* Step validator: require sport type */
  var panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    var step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      var warnings = [];
      if (!sportType || !sportType.value) {
        warnings.push('খেলার ধরন নির্বাচন করুন (Please select a sport type)');
      }
      return { warnings: warnings };
    }});
  }
})();
