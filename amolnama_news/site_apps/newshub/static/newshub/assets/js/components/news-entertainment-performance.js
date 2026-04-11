/**
 * news-entertainment-performance.js
 * Serializes the Performance & Reception form (Step 6 of the Entertainment form)
 * into a hidden JSON input #entertainment-performance-json.
 *
 * DB table: [investigation].[entertainment_form_fact]
 * Saved keys: boxOffice, viewsStreams, rating, audienceResponse
 *
 * DOM dependencies:
 *   #entertainment-performance-json        — hidden input (JSON payload)
 *   #entertainment-box-office              — text
 *   #entertainment-views-streams           — text
 *   #entertainment-rating                  — text
 *   #entertainment-audience-response-select— select
 */
(function () {
  'use strict';

  const hiddenInput         = document.getElementById('entertainment-performance-json');
  if (!hiddenInput) return;

  const boxOfficeEl         = document.getElementById('entertainment-box-office');
  const viewsStreamsEl      = document.getElementById('entertainment-views-streams');
  const ratingEl            = document.getElementById('entertainment-rating');
  const audienceSelect      = document.getElementById('entertainment-audience-response-select');

  function v(element) { return element && element.value.trim() || ''; }
  function sel(element) { return element && element.value || ''; }

  function collectData() {
    return {
      boxOffice:        v(boxOfficeEl),
      viewsStreams:     v(viewsStreamsEl),
      rating:           v(ratingEl),
      audienceResponse: sel(audienceSelect)
    };
  }

  function hasAnyData(d) {
    return d.boxOffice || d.viewsStreams || d.rating || d.audienceResponse;
  }

  function syncToHiddenInput() {
    let data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  const section = document.getElementById('section-entertainment-performance');
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

    if (boxOfficeEl && data.boxOffice)         boxOfficeEl.value    = data.boxOffice;
    if (viewsStreamsEl && data.viewsStreams)    viewsStreamsEl.value = data.viewsStreams;
    if (ratingEl && data.rating)               ratingEl.value       = data.rating;
    if (audienceSelect && data.audienceResponse) audienceSelect.value = data.audienceResponse;
  }
  setTimeout(restoreFromSavedData, 100);

  /* ---- Public API for form-clear.js ---- */
  window.newshubEntertainmentPerformance = {
    reset: function () {
      if (boxOfficeEl)    boxOfficeEl.value    = '';
      if (viewsStreamsEl) viewsStreamsEl.value  = '';
      if (ratingEl)       ratingEl.value        = '';
      if (audienceSelect) audienceSelect.value  = '';
      hiddenInput.value = '';
    }
  };
})();
