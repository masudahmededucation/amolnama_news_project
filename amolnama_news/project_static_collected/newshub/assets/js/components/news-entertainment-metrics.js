/**
 * news-entertainment-metrics.js
 * Reads metrics fields (views/streams, rating source, rating score,
 * revenue, opening weekend) and serializes to #entertainment-metrics-json
 * hidden input on input/change and before form submit.
 *
 * DOM dependencies:
 *   #entertainment-views              — text input
 *   #entertainment-rating-source      — select
 *   #entertainment-rating-score       — text input
 *   #entertainment-revenue            — text input
 *   #entertainment-opening-weekend    — text input
 *   #entertainment-metrics-json       — hidden JSON input for form submission
 *
 * Exposes: window.newshubEntertainmentMetrics = { reset: fn }
 */
(function () {
  'use strict';

  const views = document.getElementById('entertainment-views');
  const ratingSource = document.getElementById('entertainment-rating-source');
  const ratingScore = document.getElementById('entertainment-rating-score');
  const revenue = document.getElementById('entertainment-revenue');
  const openingWeekend = document.getElementById('entertainment-opening-weekend');
  const hiddenJson = document.getElementById('entertainment-metrics-json');

  if (!hiddenJson) return;

  function serialize() {
    let data = {
      views: views ? views.value.trim() : '',
      ratingSource: ratingSource ? ratingSource.value : '',
      ratingScore: ratingScore ? ratingScore.value.trim() : '',
      revenue: revenue ? revenue.value.trim() : '',
      openingWeekend: openingWeekend ? openingWeekend.value.trim() : '',
    };

    hiddenJson.value = JSON.stringify(data);
  }

  /* Listen for changes on select */
  if (ratingSource) ratingSource.addEventListener('change', serialize);

  /* Listen for input on text fields */
  const inputFields = [views, ratingScore, revenue, openingWeekend];
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

    if (views && data.views)                     views.value        = data.views;
    if (ratingSource && data.ratingSource)       ratingSource.value = data.ratingSource;
    if (ratingScore && data.ratingScore)         ratingScore.value  = data.ratingScore;
    if (revenue && data.revenue)                 revenue.value      = data.revenue;
    if (openingWeekend && data.openingWeekend)   openingWeekend.value = data.openingWeekend;
  }
  setTimeout(restoreFromSavedData, 100);

  /* Public API for form-clear */
  window.newshubEntertainmentMetrics = {
    reset: function () {
      if (views) views.value = '';
      if (ratingSource) ratingSource.selectedIndex = 0;
      if (ratingScore) ratingScore.value = '';
      if (revenue) revenue.value = '';
      if (openingWeekend) openingWeekend.value = '';
      hiddenJson.value = '';
    },
  };
})();
