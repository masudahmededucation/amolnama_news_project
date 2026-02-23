/**
 * news-geo-collect.js
 * Auto-collects browser geolocation into hidden form fields.
 */
(function () {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(function (pos) {
    var lat = document.getElementById('news-latitude');
    var lng = document.getElementById('news-longitude');
    if (lat) lat.value = pos.coords.latitude.toFixed(6);
    if (lng) lng.value = pos.coords.longitude.toFixed(6);

    /* Notify map pinpoint (if loaded) to show browser location marker */
    if (window.newshubMapPinpoint && window.newshubMapPinpoint.setMarkerFromBrowserGeolocation) {
      window.newshubMapPinpoint.setMarkerFromBrowserGeolocation(
        pos.coords.latitude, pos.coords.longitude
      );
    }
  });
})();
