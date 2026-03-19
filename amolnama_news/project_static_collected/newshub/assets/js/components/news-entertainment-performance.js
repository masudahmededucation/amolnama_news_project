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

  var hiddenInput         = document.getElementById('entertainment-performance-json');
  if (!hiddenInput) return;

  var boxOfficeEl         = document.getElementById('entertainment-box-office');
  var viewsStreamsEl      = document.getElementById('entertainment-views-streams');
  var ratingEl            = document.getElementById('entertainment-rating');
  var audienceSelect      = document.getElementById('entertainment-audience-response-select');

  function v(el) { return el && el.value.trim() || ''; }
  function sel(el) { return el && el.value || ''; }

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
    var data = collectData();
    hiddenInput.value = hasAnyData(data) ? JSON.stringify(data) : '';
  }

  var section = document.getElementById('section-entertainment-performance');
  if (section) {
    section.addEventListener('input',  syncToHiddenInput);
    section.addEventListener('change', syncToHiddenInput);
  }

  var form = hiddenInput.closest('form');
  if (form) form.addEventListener('submit', syncToHiddenInput);

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
