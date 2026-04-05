/**
 * news-sports-match-event.js
 * Serializes the Match & Event Details form (Step 4 of the Sports form)
 * into a hidden JSON input #sports-match-event-json.
 *
 * DB table: [investigation].[sports_form_fact]
 * Saved keys: competitionName, stage, stageName, venue, matchDate, matchStatus
 *
 * NOTE: matchFormat (cricket-only) has no DB column — NOT serialized.
 *       The template field is kept for future use but excluded from JSON.
 *
 * DOM dependencies:
 *   #sports-match-event-json   — hidden input (JSON payload)
 *   #sports-competition-name   — text input
 *   #sports-match-stage-select — select (round/stage — value = status_code)
 *   #sports-venue              — text input
 *   #sports-match-date         — date input
 *   #sports-match-status-select— select (match status — value = status_code)
 */
(function () {
  'use strict';

  const hiddenInput       = document.getElementById('sports-match-event-json');
  if (!hiddenInput) return;

  const competitionNameEl = document.getElementById('sports-competition-name');
  const stageSelect       = document.getElementById('sports-match-stage-select');
  const venueEl           = document.getElementById('sports-venue');
  const matchDateEl       = document.getElementById('sports-match-date');
  const statusSelect      = document.getElementById('sports-match-status-select');

  function collectData() {
    const stageVal  = (stageSelect  && stageSelect.value)  || '';
    let stageName = '';
    if (stageSelect && stageSelect.selectedIndex > 0) {
      stageName = stageSelect.options[stageSelect.selectedIndex].text || '';
    }
    return {
      competitionName: (competitionNameEl && competitionNameEl.value.trim()) || '',
      stage:           stageVal,
      stageName:       stageName,
      venue:           (venueEl           && venueEl.value.trim())           || '',
      matchDate:       (matchDateEl       && matchDateEl.value)              || '',
      matchStatus:     (statusSelect      && statusSelect.value)             || ''
    };
  }

  function hasAnyData(d) {
    return d.competitionName || d.stage || d.venue || d.matchDate || d.matchStatus;
  }

  function syncToHiddenInput() {
    let data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  const section = document.getElementById('section-sports-match-event');
  if (section) {
    section.addEventListener('input',  syncToHiddenInput);
    section.addEventListener('change', syncToHiddenInput);
  }

  const form = hiddenInput.closest('form');
  if (form) form.addEventListener('submit', syncToHiddenInput);

  /* ---- Restore from saved data ---- */
  function restoreFromSavedData() {
    if (!hiddenInput.value) return;
    let data;
    try { data = JSON.parse(hiddenInput.value); } catch (e) { return; }

    if (competitionNameEl && data.competitionName) competitionNameEl.value = data.competitionName;
    if (stageSelect && data.stage)                 stageSelect.value      = data.stage;
    if (venueEl && data.venue)                     venueEl.value          = data.venue;
    if (matchDateEl && data.matchDate)             matchDateEl.value      = data.matchDate;
    if (statusSelect && data.matchStatus)          statusSelect.value     = data.matchStatus;
  }
  setTimeout(restoreFromSavedData, 100);

  /* ---- Public API for form-clear.js ---- */
  window.newshubSportsMatchEvent = {
    reset: function () {
      if (competitionNameEl) competitionNameEl.value = '';
      if (stageSelect)       stageSelect.value       = '';
      if (venueEl)           venueEl.value           = '';
      if (matchDateEl)       matchDateEl.value        = '';
      if (statusSelect)      statusSelect.value       = '';
      hiddenInput.value = '';
    }
  };
})();
