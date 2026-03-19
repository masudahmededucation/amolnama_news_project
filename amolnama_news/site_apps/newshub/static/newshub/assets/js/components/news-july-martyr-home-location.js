/**
 * news-july-martyr-home-location.js
 * Thin wrapper — creates the martyr home address location cascade using
 * window.newshubCreateLocationCascade (news-location-cascade.js).
 *
 * Must load AFTER news-location-cascade.js.
 *
 * DOM dependencies (on the July uprising form page):
 *   #martyr-home-district-id   — District select (template-populated)
 *   #martyr-home-upazila-id    — Upazila/Metro Thana/City Corp (dynamic)
 *   #martyr-home-local-body-id — Union Parishad / Local Body (dynamic)
 *   #martyr-home-ward-id       — Ward (dynamic)
 *
 * Exposes: window.julyMartyrHomeLocation = { read(), reset() }
 *   read() returns: { districtId, districtName, upazilaId, upazilaName,
 *                     localBodyId, localBodyName, wardId, wardName }
 */
(function () {
  'use strict';

  if (!window.newshubCreateLocationCascade) return;

  window.newshubCreateLocationCascade({
    districtId:  'martyr-home-district-id',
    upazilaId:   'martyr-home-upazila-id',
    localBodyId: 'martyr-home-local-body-id',
    wardId:      'martyr-home-ward-id',
    hasMap:      false,
    publicApi:   'julyMartyrHomeLocation',
  });

})();
