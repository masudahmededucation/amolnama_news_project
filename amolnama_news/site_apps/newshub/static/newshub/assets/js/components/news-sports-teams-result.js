/**
 * news-sports-teams-result.js
 * Serializes the Teams/Players & Result form (Step 5 of the Sports form)
 * into a hidden JSON input #sports-teams-result-json.
 *
 * DB table: [investigation].[sports_form_fact]
 * Saved keys: teamA, teamB, scoreA, scoreB, result, tossWinner, tossDecision, playerOfMatch
 *
 * DOM dependencies:
 *   #sports-teams-result-json — hidden input (JSON payload)
 *   #sports-team-a            — text (Team/Player A)
 *   #sports-team-b            — text (Team/Player B)
 *   #sports-score-a           — text (Score A)
 *   #sports-score-b           — text (Score B)
 *   #sports-result-summary    — text (result description)
 *   #sports-toss-winner       — text (toss winner team name)
 *   #sports-toss-decision     — text (toss decision e.g. batting/fielding)
 *   #sports-player-of-match   — text (POTM name)
 */
(function () {
  'use strict';

  var hiddenInput    = document.getElementById('sports-teams-result-json');
  if (!hiddenInput) return;

  var teamAEl        = document.getElementById('sports-team-a');
  var teamBEl        = document.getElementById('sports-team-b');
  var scoreAEl       = document.getElementById('sports-score-a');
  var scoreBEl       = document.getElementById('sports-score-b');
  var resultEl       = document.getElementById('sports-result-summary');
  var tossWinnerEl   = document.getElementById('sports-toss-winner');
  var tossDecisionEl = document.getElementById('sports-toss-decision');
  var potmEl         = document.getElementById('sports-player-of-match');

  function collectData() {
    return {
      teamA:         (teamAEl        && teamAEl.value.trim())        || '',
      teamB:         (teamBEl        && teamBEl.value.trim())        || '',
      scoreA:        (scoreAEl       && scoreAEl.value.trim())       || '',
      scoreB:        (scoreBEl       && scoreBEl.value.trim())       || '',
      result:        (resultEl       && resultEl.value.trim())       || '',
      tossWinner:    (tossWinnerEl   && tossWinnerEl.value.trim())   || '',
      tossDecision:  (tossDecisionEl && tossDecisionEl.value.trim()) || '',
      playerOfMatch: (potmEl         && potmEl.value.trim())         || ''
    };
  }

  function hasAnyData(d) {
    return d.teamA || d.teamB || d.scoreA || d.scoreB || d.result || d.playerOfMatch;
  }

  function syncToHiddenInput() {
    var data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  var section = document.getElementById('section-sports-teams-result');
  if (section) {
    section.addEventListener('input',  syncToHiddenInput);
    section.addEventListener('change', syncToHiddenInput);
  }

  var form = hiddenInput.closest('form');
  if (form) form.addEventListener('submit', syncToHiddenInput);

  /* ---- Public API for form-clear.js ---- */
  window.newshubSportsTeamsResult = {
    reset: function () {
      if (teamAEl)        teamAEl.value        = '';
      if (teamBEl)        teamBEl.value        = '';
      if (scoreAEl)       scoreAEl.value       = '';
      if (scoreBEl)       scoreBEl.value       = '';
      if (resultEl)       resultEl.value       = '';
      if (tossWinnerEl)   tossWinnerEl.value   = '';
      if (tossDecisionEl) tossDecisionEl.value = '';
      if (potmEl)         potmEl.value         = '';
      hiddenInput.value = '';
    }
  };
})();
