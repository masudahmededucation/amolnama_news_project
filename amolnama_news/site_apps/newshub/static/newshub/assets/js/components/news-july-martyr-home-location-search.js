/**
 * news-july-martyr-home-location-search.js
 * Thin wrapper — creates the martyr home address Tom Select location search
 * using window.newshubCreateLocationSearch (news-location-search.js).
 *
 * Must load AFTER news-location-search.js.
 *
 * DOM dependencies (on the July uprising form page):
 *   #martyr-home-location-search — Tom Select search element
 *   #martyr-home-district-id     — cascade district select
 *   #martyr-home-upazila-id      — cascade upazila select
 *   #martyr-home-local-body-id   — cascade local body select
 *   #martyr-home-ward-id         — cascade ward select
 *
 * Exposes: window.newshubMartyrHomeLocationSearch = { clear() }
 */
(function () {
  'use strict';

  if (typeof TomSelect === 'undefined') return;
  if (!window.newshubCreateLocationSearch) return;

  window.newshubCreateLocationSearch({
    searchInputId: 'martyr-home-location-search',
    districtId:    'martyr-home-district-id',
    upazilaId:     'martyr-home-upazila-id',
    localBodyId:   'martyr-home-local-body-id',
    wardId:        'martyr-home-ward-id',
    hasMap:        false,
    placeholder:   'এলাকার নাম যেমন: রূপনগর, সাভার......লিখে খুজুন',
    publicApi:     'newshubMartyrHomeLocationSearch',
  });

})();
