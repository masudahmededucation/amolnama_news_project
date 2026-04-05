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

  const sportType = document.getElementById('sports-sport-type');
  const competitionRadios = document.querySelectorAll('input[name="sports_competition_type"]');
  const matchStatus = document.getElementById('sports-match-status');
  const tournamentLevel = document.getElementById('sports-tournament-level');
  const scoreA = document.getElementById('sports-score-a');
  const scoreB = document.getElementById('sports-score-b');
  const keyPerformance = document.getElementById('sports-key-performance');
  const hiddenJson = document.getElementById('sports-scoreboard-json');

  if (!hiddenJson) return;

  function getCompetitionType() {
    for (let i = 0; i < competitionRadios.length; i++) {
      if (competitionRadios[i].checked) return competitionRadios[i].value;
    }
    return 'team_vs_team';
  }

  function serialize() {
    let data = {
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
  const changeFields = [sportType, matchStatus, tournamentLevel];
  changeFields.forEach(function (el) {
    if (el) el.addEventListener('change', serialize);
  });

  /* Listen for changes on competition type radios */
  for (let i = 0; i < competitionRadios.length; i++) {
    competitionRadios[i].addEventListener('change', serialize);
  }

  /* Listen for input on text fields */
  const inputFields = [scoreA, scoreB, keyPerformance];
  inputFields.forEach(function (el) {
    if (el) el.addEventListener('input', serialize);
  });

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

    if (sportType && data.sportType)           sportType.value       = data.sportType;
    if (data.competitionType) {
      for (let j = 0; j < competitionRadios.length; j++) {
        if (competitionRadios[j].value === data.competitionType) {
          competitionRadios[j].checked = true;
          break;
        }
      }
    }
    if (matchStatus && data.matchStatus)       matchStatus.value     = data.matchStatus;
    if (tournamentLevel && data.tournamentLevel) tournamentLevel.value = data.tournamentLevel;
    if (scoreA && data.scoreA)                 scoreA.value          = data.scoreA;
    if (scoreB && data.scoreB)                 scoreB.value          = data.scoreB;
    if (keyPerformance && data.keyPerformance) keyPerformance.value  = data.keyPerformance;
  }
  setTimeout(restoreFromSavedData, 100);

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
  const panel = hiddenJson.closest('.step-panel[data-step]');
  if (panel) {
    const step = parseInt(panel.getAttribute('data-step'), 10);
    window.__newshubStepValidators = window.__newshubStepValidators || [];
    window.__newshubStepValidators.push({ step: step, fn: function () {
      const warnings = [];
      if (!sportType || !sportType.value) {
        warnings.push('খেলার ধরন নির্বাচন করুন (Please select a sport type)');
      }
      return { warnings: warnings };
    }});
  }
})();
