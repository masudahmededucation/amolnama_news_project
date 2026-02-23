/**
 * news-map-reverse-geocode.js
 * Converts map coordinates (latitude/longitude) into a human-readable
 * Bengali address string using Nominatim reverse geocoding API.
 * Debounced at 1200ms to respect Nominatim's 1 request/second limit.
 *
 * To swap to Google Maps later: replace nominatimReverseGeocodeRequest()
 * with google.maps.Geocoder.geocode({ location: {lat, lng} }).
 *
 * Depends on: window.newshubMapPinpoint (news-map-pinpoint.js)
 */
(function () {
  'use strict';

  /* ===== Provider Config (swap for Google Geocoding API) ===== */
  var NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
  var REVERSE_GEOCODE_DEBOUNCE_MS = 1200;

  /* ===== State ===== */
  var reverseGeocodeDebounceTimer = null;

  /* ========== Nominatim Reverse Geocode ========== */

  function nominatimReverseGeocodeRequest(latitude, longitude) {
    var requestUrl = NOMINATIM_BASE_URL + '/reverse?format=json' +
      '&lat=' + latitude +
      '&lon=' + longitude +
      '&accept-language=bn' +
      '&zoom=18' +
      '&addressdetails=1';

    fetch(requestUrl, { headers: { 'Accept': 'application/json' } })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data && data.display_name) {
          if (window.newshubMapPinpoint) {
            window.newshubMapPinpoint.updateAddress(data.display_name);
          }
          if (window.newshubMapSearch) {
            window.newshubMapSearch.setSearchText(data.display_name);
          }
        }
        if (data && data.address && window.newshubMapLocationAutofill) {
          window.newshubMapLocationAutofill.fillFromAddress(data.address, data.display_name, latitude, longitude);
        }
      })
      .catch(function () { /* Silent fail — address is optional */ });
  }

  /* ========== Debounced Entry Point ========== */

  function reverseGeocodeFromCoordinatesDebounced(latitude, longitude) {
    clearTimeout(reverseGeocodeDebounceTimer);
    reverseGeocodeDebounceTimer = setTimeout(function () {
      nominatimReverseGeocodeRequest(latitude, longitude);
    }, REVERSE_GEOCODE_DEBOUNCE_MS);
  }

  /* ========== Public API ========== */

  window.newshubMapReverseGeocode = {
    /** Called by news-map-pinpoint.js on marker place/drag */
    reverseGeocodeFromCoordinates: function (latitude, longitude) {
      reverseGeocodeFromCoordinatesDebounced(latitude, longitude);
    }
  };
})();
