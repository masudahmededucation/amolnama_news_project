/**
 * news-map-pinpoint.js
 * Core map initialisation, draggable marker, district auto-center,
 * and public API for other scripts (geo-collect, form-clear, form-persist).
 *
 * Provider abstraction:
 *   TILE_URL and TILE_ATTRIBUTION are defined at top.
 *   To swap to Google Maps later: change these + map/marker init.
 *   Public API (window.newshubMapPinpoint) stays identical.
 *
 * DOM dependencies:
 *   #map-pinpoint-container    — map div
 *   #news-latitude             — hidden input (shared with news-geo-collect.js)
 *   #news-longitude            — hidden input (shared with news-geo-collect.js)
 *   #news-formatted-address-bn — hidden input for reverse-geocoded address
 *   #map-address-display       — visible address text below map
 *   #news-district-id          — district select (for auto-center on change)
 *
 * Requires: Leaflet.js CSS + JS (CDN)
 * Consumed by: news-map-search.js, news-map-reverse-geocode.js
 */
(function () {
  'use strict';

  if (typeof L === 'undefined') return;

  /* ===== Provider Config (swap these for Google Maps) ===== */
  var TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  /* ===== Map Constants ===== */
  var BANGLADESH_CENTER_LATITUDE = 23.685;
  var BANGLADESH_CENTER_LONGITUDE = 90.3563;
  var BANGLADESH_DEFAULT_ZOOM = 7;
  var MARKER_PINPOINT_ZOOM = 13;
  var DISTRICT_CENTER_ZOOM = 10;
  var SUBDISTRICT_CENTER_ZOOM = 12;
  var LOCAL_BODY_CENTER_ZOOM = 13;
  var WARD_CENTER_ZOOM = 14;
  var VILLAGE_CENTER_ZOOM = 15;

  /* ===== DOM References ===== */
  var mapContainerElement = document.getElementById('map-pinpoint-container');
  var latitudeHiddenInput = document.getElementById('news-latitude');
  var longitudeHiddenInput = document.getElementById('news-longitude');
  var formattedAddressHiddenInput = document.getElementById('news-formatted-address-bn');
  var addressDisplayElement = document.getElementById('map-address-display');
  var districtSelectElement = document.getElementById('news-district-id');

  if (!mapContainerElement) return;

  /* ===== State ===== */
  var leafletMap = null;
  var draggableMarker = null;
  var suppressAutoCenter = false;
  var isZoomingOrPanning = false;

  /* ========== Map Initialisation ========== */

  function mapInitialise() {
    leafletMap = L.map('map-pinpoint-container', {
      center: [BANGLADESH_CENTER_LATITUDE, BANGLADESH_CENTER_LONGITUDE],
      zoom: BANGLADESH_DEFAULT_ZOOM,
      scrollWheelZoom: true,
      zoomControl: true
    });

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19
    }).addTo(leafletMap);

    /* Track zoom/pan to ignore accidental clicks during these operations */
    leafletMap.on('zoomstart', function () { isZoomingOrPanning = true; });
    leafletMap.on('movestart', function () { isZoomingOrPanning = true; });
    leafletMap.on('zoomend', function () { setTimeout(function () { isZoomingOrPanning = false; }, 300); });
    leafletMap.on('moveend', function () { setTimeout(function () { isZoomingOrPanning = false; }, 300); });

    leafletMap.on('click', function (e) {
      if (isZoomingOrPanning) return;
      mapMarkerPlaceOrMove(e.latlng.lat, e.latlng.lng, true);
    });

    mapMarkerRestoreFromHiddenInputs();
  }

  /* ========== Marker: Place, Move, Remove ========== */

  function mapMarkerPlaceOrMove(latitude, longitude, triggerReverseGeocode) {
    latitude = parseFloat(latitude);
    longitude = parseFloat(longitude);
    if (isNaN(latitude) || isNaN(longitude)) return;

    if (draggableMarker) {
      draggableMarker.setLatLng([latitude, longitude]);
    } else {
      draggableMarker = L.marker([latitude, longitude], { draggable: true }).addTo(leafletMap);
      draggableMarker.on('dragend', mapMarkerHandleDragEnd);
    }

    mapMarkerUpdateHiddenInputs(latitude, longitude);

    if (triggerReverseGeocode && window.newshubMapReverseGeocode) {
      window.newshubMapReverseGeocode.reverseGeocodeFromCoordinates(latitude, longitude);
    }
  }

  function mapMarkerRemoveAndClearInputs() {
    if (draggableMarker && leafletMap) {
      leafletMap.removeLayer(draggableMarker);
      draggableMarker = null;
    }
    latitudeHiddenInput.value = '';
    longitudeHiddenInput.value = '';
    if (formattedAddressHiddenInput) formattedAddressHiddenInput.value = '';
    if (addressDisplayElement) addressDisplayElement.textContent = '';
  }

  function mapMarkerUpdateHiddenInputs(latitude, longitude) {
    latitudeHiddenInput.value = latitude.toFixed(6);
    longitudeHiddenInput.value = longitude.toFixed(6);
    latitudeHiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function mapMarkerHandleDragEnd() {
    var position = draggableMarker.getLatLng();
    mapMarkerUpdateHiddenInputs(position.lat, position.lng);

    if (window.newshubMapReverseGeocode) {
      window.newshubMapReverseGeocode.reverseGeocodeFromCoordinates(position.lat, position.lng);
    }
  }

  /* ========== Marker: Restore from Saved Values ========== */

  function mapMarkerRestoreFromHiddenInputs() {
    var latitude = parseFloat(latitudeHiddenInput.value);
    var longitude = parseFloat(longitudeHiddenInput.value);
    if (!isNaN(latitude) && !isNaN(longitude) && latitude !== 0 && longitude !== 0) {
      mapMarkerPlaceOrMove(latitude, longitude, false);
      leafletMap.setView([latitude, longitude], MARKER_PINPOINT_ZOOM);
    }
    if (formattedAddressHiddenInput && formattedAddressHiddenInput.value && addressDisplayElement) {
      addressDisplayElement.textContent = formattedAddressHiddenInput.value;
    }
  }

  /* ========== District Auto-Center ========== */

  function mapCenterOnDistrictChange() {
    /* Skip auto-center when district was set by map autofill (user already pinpointed a spot) */
    if (suppressAutoCenter) { suppressAutoCenter = false; return; }

    if (!districtSelectElement) return;
    var selectedOption = districtSelectElement.options[districtSelectElement.selectedIndex];
    if (!selectedOption || !selectedOption.value) return;

    var latitude = parseFloat(selectedOption.dataset.lat);
    var longitude = parseFloat(selectedOption.dataset.lng);
    if (!isNaN(latitude) && !isNaN(longitude) && latitude !== 0 && longitude !== 0) {
      leafletMap.setView([latitude, longitude], DISTRICT_CENTER_ZOOM);
    }
  }

  if (districtSelectElement) {
    districtSelectElement.addEventListener('change', mapCenterOnDistrictChange);
  }

  /* ========== Address Display Helper ========== */

  function mapAddressUpdateDisplay(addressText) {
    if (formattedAddressHiddenInput) {
      formattedAddressHiddenInput.value = addressText;
      formattedAddressHiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (addressDisplayElement) {
      addressDisplayElement.textContent = addressText;
    }
  }

  /* ========== Public API ========== */

  window.newshubMapPinpoint = {
    /** Expose Leaflet map instance for search/geocode modules */
    getMap: function () { return leafletMap; },

    /** Check if user has already placed a marker manually */
    hasMarker: function () { return !!draggableMarker; },

    /** Place or move marker and optionally reverse geocode */
    placeOrMoveMarker: function (latitude, longitude, triggerReverseGeocode) {
      mapMarkerPlaceOrMove(latitude, longitude, triggerReverseGeocode);
    },

    /** Update the visible address text and hidden input */
    updateAddress: function (addressText) {
      mapAddressUpdateDisplay(addressText);
    },

    /** Called by news-geo-collect.js when browser geolocation completes */
    setMarkerFromBrowserGeolocation: function (latitude, longitude) {
      if (!leafletMap) return;
      if (draggableMarker) return; /* Don't overwrite user-placed marker */
      mapMarkerPlaceOrMove(latitude, longitude, true);
      leafletMap.setView([latitude, longitude], MARKER_PINPOINT_ZOOM);
    },

    /** Called by news-form-clear.js to reset map to initial state */
    resetMapToDefault: function () {
      mapMarkerRemoveAndClearInputs();
      if (leafletMap) leafletMap.setView(
        [BANGLADESH_CENTER_LATITUDE, BANGLADESH_CENTER_LONGITUDE],
        BANGLADESH_DEFAULT_ZOOM
      );
    },

    /** Called by news-form-persist.js after restoring saved lat/lng */
    restoreMarkerFromSavedInputs: function () {
      mapMarkerRestoreFromHiddenInputs();
    },

    /** Center map and place marker on given coordinates (used by cascade JS) */
    centerOn: function (latitude, longitude, zoom) {
      if (!leafletMap) return;
      latitude = parseFloat(latitude);
      longitude = parseFloat(longitude);
      if (isNaN(latitude) || isNaN(longitude)) return;
      leafletMap.setView([latitude, longitude], zoom || DISTRICT_CENTER_ZOOM);
      mapMarkerPlaceOrMove(latitude, longitude, false);
    },

    /** Geocode a text query via Nominatim, center map and place marker on first result */
    geocodeAndCenter: function (queryText, zoom) {
      if (!leafletMap || !queryText) return;
      var url = 'https://nominatim.openstreetmap.org/search?format=json'
        + '&q=' + encodeURIComponent(queryText)
        + '&countrycodes=bd&limit=1&accept-language=en';
      fetch(url, { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (results) {
          if (results && results.length > 0) {
            var lat = parseFloat(results[0].lat);
            var lon = parseFloat(results[0].lon);
            if (!isNaN(lat) && !isNaN(lon)) {
              leafletMap.setView([lat, lon], zoom || DISTRICT_CENTER_ZOOM);
              mapMarkerPlaceOrMove(lat, lon, false);
              /* Update address display + search box from Nominatim result */
              if (results[0].display_name) {
                mapAddressUpdateDisplay(results[0].display_name);
                if (window.newshubMapSearch) {
                  window.newshubMapSearch.setSearchText(results[0].display_name);
                }
              }
            }
          }
        })
        .catch(function () { /* silent — geocoding is best-effort */ });
    },

    /** Prevent district auto-center on next change (used by map-location-autofill) */
    suppressNextDistrictCenter: function () { suppressAutoCenter = true; },

    /** Zoom constants exposed for cascade/search/geocode modules */
    MARKER_PINPOINT_ZOOM: MARKER_PINPOINT_ZOOM,
    DISTRICT_CENTER_ZOOM: DISTRICT_CENTER_ZOOM,
    SUBDISTRICT_CENTER_ZOOM: SUBDISTRICT_CENTER_ZOOM,
    LOCAL_BODY_CENTER_ZOOM: LOCAL_BODY_CENTER_ZOOM,
    WARD_CENTER_ZOOM: WARD_CENTER_ZOOM,
    VILLAGE_CENTER_ZOOM: VILLAGE_CENTER_ZOOM
  };

  /* ===== Init ===== */
  mapInitialise();
})();
