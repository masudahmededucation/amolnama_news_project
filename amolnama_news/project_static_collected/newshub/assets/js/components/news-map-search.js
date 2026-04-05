/**
 * news-map-search.js
 * Place search input for the map — queries Nominatim for Bangladesh locations,
 * shows results dropdown, and places marker on selection.
 *
 * To swap to Google Maps later: replace nominatimPlaceSearchRequest()
 * with google.maps.places.AutocompleteService.getPlacePredictions().
 *
 * DOM dependencies:
 *   #map-search-input — text input above the map
 *
 * Depends on: window.newshubMapPinpoint (news-map-pinpoint.js)
 */
(function () {
  'use strict';

  /* ===== Provider Config (swap for Google Places API) ===== */
  const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
  const SEARCH_DEBOUNCE_MS = 500;
  const SEARCH_MINIMUM_CHARACTERS = 3;
  const SEARCH_MAX_RESULTS = 5;

  /* ===== DOM References ===== */
  const searchInputElement = document.getElementById('map-search-input');

  if (!searchInputElement) return;

  /* ===== State ===== */
  let searchResultsListElement = null;
  let searchDebounceTimer = null;

  /* ========== Initialise Search UI ========== */

  function mapSearchInitialise() {
    searchResultsListElement = document.createElement('ul');
    searchResultsListElement.className = 'map-search-results';
    searchInputElement.parentNode.appendChild(searchResultsListElement);

    searchInputElement.addEventListener('input', mapSearchHandleInputChange);

    /* Prevent Enter from submitting the parent form */
    searchInputElement.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') event.preventDefault();
    });

    document.addEventListener('click', function (event) {
      if (!searchInputElement.contains(event.target) &&
          !searchResultsListElement.contains(event.target)) {
        mapSearchResultsHide();
      }
    });
  }

  /* ========== Input Handler (Debounced) ========== */

  function mapSearchHandleInputChange() {
    clearTimeout(searchDebounceTimer);
    const queryText = searchInputElement.value.trim();
    if (queryText.length < SEARCH_MINIMUM_CHARACTERS) {
      mapSearchResultsHide();
      return;
    }
    searchDebounceTimer = setTimeout(function () {
      nominatimPlaceSearchRequest(queryText);
    }, SEARCH_DEBOUNCE_MS);
  }

  /* ========== Nominatim Place Search ========== */

  function nominatimPlaceSearchRequest(queryText) {
    const requestUrl = NOMINATIM_BASE_URL + '/search?format=json' +
      '&q=' + encodeURIComponent(queryText) +
      '&countrycodes=bd' +
      '&limit=' + SEARCH_MAX_RESULTS +
      '&accept-language=bn' +
      '&addressdetails=1';

    fetch(requestUrl, { headers: { 'Accept': 'application/json' } })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (results) {
        mapSearchResultsRender(results);
      })
      .catch(function () { mapSearchResultsHide(); });
  }

  /* ========== Render / Hide Search Results ========== */

  function mapSearchResultsRender(results) {
    searchResultsListElement.innerHTML = '';
    if (!results || results.length === 0) {
      mapSearchResultsHide();
      return;
    }

    results.forEach(function (result) {
      const listItem = document.createElement('li');
      listItem.className = 'map-search-item';
      listItem.textContent = result.display_name;
      listItem.addEventListener('click', function () {
        mapSearchResultSelectPlace(result);
      });
      searchResultsListElement.appendChild(listItem);
    });

    searchResultsListElement.style.display = 'block';
  }

  function mapSearchResultsHide() {
    if (searchResultsListElement) searchResultsListElement.style.display = 'none';
  }

  /* ========== Handle Place Selection ========== */

  function mapSearchResultSelectPlace(selectedResult) {
    searchInputElement.value = selectedResult.display_name;
    mapSearchResultsHide();

    const latitude = parseFloat(selectedResult.lat);
    const longitude = parseFloat(selectedResult.lon);

    if (!window.newshubMapPinpoint) return;

    const leafletMap = window.newshubMapPinpoint.getMap();
    if (leafletMap) {
      leafletMap.setView([latitude, longitude], window.newshubMapPinpoint.MARKER_PINPOINT_ZOOM);
    }
    window.newshubMapPinpoint.placeOrMoveMarker(latitude, longitude, false);
    window.newshubMapPinpoint.updateAddress(selectedResult.display_name);

    if (window.newshubMapLocationAutofill && selectedResult.address) {
      window.newshubMapLocationAutofill.fillFromAddress(selectedResult.address, selectedResult.display_name, latitude, longitude);
    }
  }

  /* ========== Public API ========== */

  window.newshubMapSearch = {
    /** Called by news-form-clear.js to clear search state */
    clearSearchInput: function () {
      if (searchInputElement) searchInputElement.value = '';
      mapSearchResultsHide();
    },
    /** No-op: address already shown in map-address-display below the map */
    setSearchText: function () {}
  };

  /* ===== Init ===== */
  mapSearchInitialise();
})();
