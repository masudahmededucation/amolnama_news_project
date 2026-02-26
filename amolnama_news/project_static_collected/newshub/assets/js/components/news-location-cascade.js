/**
 * news-location-cascade.js
 * Cascading location dropdowns with parallel rural/urban/city paths:
 *   District → Subdistrict (Upazila / Metro Thana / City Corporation)
 *   Subdistrict → Local Body (Union Parishad / Municipality / City Corporation)
 *                 OR directly to Ward if City Corporation selected at subdistrict
 *   Local Body → Ward (UP Ward / Muni Ward / City Corp Ward)
 *   Ward → Village (rural path only, via union parishad ID)
 *
 * Each <option> carries data-type to determine which API to call next.
 * Constituency is a hidden input — auto-matched by upazila name.
 */
(function () {
  var districtSelect = document.getElementById('news-district-id');
  var constituencyInput = document.getElementById('news-constituency-id');
  var subDistrictSelect = document.getElementById('news-upazila-id');
  var localBodySelect = document.getElementById('news-union-parishad-id');
  var wardSelect = document.getElementById('news-ward-id');
  var villageSelect = document.getElementById('news-village-id');
  var villageOtherInput = document.getElementById('news-village-other');
  var villageRow = document.getElementById('news-village-row');

  /* Type tracking hidden inputs */
  var subDistrictTypeInput = document.getElementById('news-subdistrict-type');
  var localBodyTypeInput = document.getElementById('news-local-body-type');
  var wardTypeInput = document.getElementById('news-ward-type');

  if (!districtSelect) return;

  /* Cached constituency data from the most recent district fetch */
  var cachedConstituencies = [];

  /* When true, cascade changes won't center the map (used during search auto-fill) */
  var suppressMapCenter = false;

  /* ========== Helpers ========== */

  function getSelectedType(selectEl) {
    if (!selectEl || selectEl.selectedIndex < 0) return '';
    var opt = selectEl.options[selectEl.selectedIndex];
    return (opt && opt.dataset && opt.dataset.type) || '';
  }

  /* Human-readable type labels (Bengali) */
  var TYPE_LABELS = {
    'upazila': 'উপজেলা',
    'metropolitan_thana': 'থানা',
    'city_corporation': 'সিটি কর্পোরেশন',
    'union_parishad': 'ইউনিয়ন পরিষদ',
    'municipality': 'পৌরসভা',
    'union_parishad_ward': 'ওয়ার্ড',
    'municipality_ward': 'ওয়ার্ড',
    'city_corporation_ward': 'ওয়ার্ড'
  };

  function buildTypedOptions(items, placeholder) {
    var opts = '<option value="">' + placeholder + '</option>';
    items.forEach(function (item) {
      var label = item.name_bn || '';
      if (item.name_en) label += ' (' + item.name_en + ')';
      var typeLabel = TYPE_LABELS[item.type] || '';
      if (typeLabel) label += ' [' + typeLabel + ']';
      var latAttr = item.lat != null ? ' data-lat="' + item.lat + '"' : '';
      var lngAttr = item.lng != null ? ' data-lng="' + item.lng + '"' : '';
      opts += '<option value="' + item.id + '" data-type="' + (item.type || '') + '"'
            + latAttr + lngAttr + '>'
            + escapeHtml(label) + '</option>';
    });
    return opts;
  }

  function centerMapOnSelected(selectEl, zoom) {
    if (suppressMapCenter) return;
    if (!selectEl || selectEl.selectedIndex < 0) return;
    var opt = selectEl.options[selectEl.selectedIndex];
    if (!opt || !opt.value) return;
    var lat = opt.dataset.lat;
    var lng = opt.dataset.lng;
    if (lat && lng && window.newshubMapPinpoint) {
      window.newshubMapPinpoint.centerOn(lat, lng, zoom);
    } else if (window.newshubMapPinpoint && window.newshubMapPinpoint.geocodeAndCenter) {
      /* Fallback: geocode from option text + parent hierarchy */
      var query = buildGeocodingQuery(selectEl);
      if (query) window.newshubMapPinpoint.geocodeAndCenter(query, zoom);
    }
  }

  /** Build a Nominatim search query from selected cascade options (deepest → district).
   *  Uses English names (from parentheses) for better Nominatim matching. */
  function buildGeocodingQuery(upToSelect) {
    var parts = [];
    var selects = [villageSelect, wardSelect, localBodySelect, subDistrictSelect, districtSelect];
    var reached = false;
    for (var i = 0; i < selects.length; i++) {
      var sel = selects[i];
      if (sel === upToSelect) reached = true;
      if (!reached) continue;
      if (!sel || !sel.value) continue;
      var opt = sel.options[sel.selectedIndex];
      if (opt && opt.textContent) {
        var fullText = opt.textContent.trim();
        /* Extract English name from parentheses if available, else use Bengali */
        var match = fullText.match(/\(([^)]+)\)/);
        var text = match ? match[1].trim() : fullText.split('(')[0].trim();
        if (text) parts.push(text);
      }
    }
    if (parts.length === 0) return '';
    parts.push('Bangladesh');
    return parts.join(', ');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ---- Constituency matching (upazila path only) ---- */

  function matchConstituencyByUpazila() {
    if (!constituencyInput || !subDistrictSelect) return;
    var type = getSelectedType(subDistrictSelect);
    /* Only match constituency for upazilas, not metro thanas */
    if (type !== 'upazila') {
      constituencyInput.value = '';
      return;
    }
    var selectedOption = subDistrictSelect.options[subDistrictSelect.selectedIndex];
    if (!selectedOption || !selectedOption.value) {
      constituencyInput.value = '';
      return;
    }
    var upazilaText = selectedOption.textContent.trim();
    var upazilaName = upazilaText.split('(')[0].trim();

    for (var i = 0; i < cachedConstituencies.length; i++) {
      var c = cachedConstituencies[i];
      if (c.area_bn && c.area_bn.indexOf(upazilaName) !== -1) {
        constituencyInput.value = c.id;
        return;
      }
    }
    constituencyInput.value = '';
  }

  /* ========== Reset Helpers ========== */

  function resetSubDistrict() {
    if (subDistrictSelect) {
      subDistrictSelect.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A5\u09AE\u09C7 \u099C\u09C7\u09B2\u09BE \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --</option>';
    }
    if (subDistrictTypeInput) subDistrictTypeInput.value = '';
  }

  function resetLocalBody() {
    if (localBodySelect) {
      localBodySelect.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A5\u09AE\u09C7 \u0989\u09AA\u099C\u09C7\u09B2\u09BE/\u09A5\u09BE\u09A8\u09BE \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --</option>';
    }
    if (localBodyTypeInput) localBodyTypeInput.value = '';
  }

  function resetWard() {
    if (wardSelect) {
      wardSelect.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A5\u09AE\u09C7 \u09B8\u09CD\u09A5\u09BE\u09A8\u09C0\u09AF\u09BC \u09B8\u09B0\u0995\u09BE\u09B0 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --</option>';
    }
    if (wardTypeInput) wardTypeInput.value = '';
  }

  function resetVillageOptions() {
    if (villageSelect) {
      villageSelect.style.display = '';
      villageSelect.innerHTML = '<option value="">-- \u09AA\u09CD\u09B0\u09A5\u09AE\u09C7 \u0987\u0989\u09A8\u09BF\u09AF\u09BC\u09A8 \u09AA\u09B0\u09BF\u09B7\u09A6 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 --</option>';
    }
    if (villageOtherInput) {
      villageOtherInput.style.display = 'none';
      villageOtherInput.value = '';
    }
  }

  function resetVillage() {
    resetVillageOptions();
    showVillageRow(false);
  }

  function showVillageRow(show) {
    if (villageRow) {
      villageRow.style.display = show ? '' : 'none';
    }
  }

  /* ========== District Change ========== */

  districtSelect.addEventListener('change', function () {
    var districtId = districtSelect.value;

    cachedConstituencies = [];
    if (constituencyInput) constituencyInput.value = '';
    resetLocalBody();
    resetWard();
    resetVillage();

    if (!districtId) {
      resetSubDistrict();
      return;
    }

    if (subDistrictSelect) {
      subDistrictSelect.innerHTML = '<option value="">-- \u09B2\u09CB\u09A1 \u09B9\u099A\u09CD\u099B\u09C7... --</option>';
    }

    /* Fetch constituencies (cache, don't render) */
    if (constituencyInput) {
      fetch('/newshub/api/constituencies/' + districtId + '/')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          cachedConstituencies = data.constituencies || [];
          if (subDistrictSelect && subDistrictSelect.value) {
            matchConstituencyByUpazila();
          }
        })
        .catch(function () { cachedConstituencies = []; });
    }

    /* Fetch subdistricts (upazilas + metro thanas) */
    if (subDistrictSelect) {
      fetch('/newshub/api/subdistricts/' + districtId + '/')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var items = data.subdistricts || [];
          subDistrictSelect.innerHTML = buildTypedOptions(
            items, '-- \u0989\u09AA\u099C\u09C7\u09B2\u09BE/\u09A5\u09BE\u09A8\u09BE/\u09B8\u09BF\u099F\u09BF \u0995\u09B0\u09CD\u09AA\u09CB\u09B0\u09C7\u09B6\u09A8 (\u0990\u099A\u09CD\u099B\u09BF\u0995) --'
          );
        })
        .catch(function () {
          subDistrictSelect.innerHTML = '<option value="">-- \u09B2\u09CB\u09A1 \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 --</option>';
        });
    }
  });

  /* ========== Subdistrict (Upazila / Metro Thana / City Corporation) Change ========== */

  if (subDistrictSelect) {
    subDistrictSelect.addEventListener('change', function () {
      var subDistrictId = subDistrictSelect.value;
      var subDistrictType = getSelectedType(subDistrictSelect);

      if (subDistrictTypeInput) subDistrictTypeInput.value = subDistrictType;
      matchConstituencyByUpazila();
      centerMapOnSelected(subDistrictSelect, window.newshubMapPinpoint ? window.newshubMapPinpoint.SUBDISTRICT_CENTER_ZOOM : 12);
      resetWard();
      resetVillage();

      if (!subDistrictId) {
        resetLocalBody();
        return;
      }

      /* City Corp / Metro Thana / Municipality: skip local body, fetch wards directly */
      if (subDistrictType === 'city_corporation' || subDistrictType === 'metropolitan_thana' || subDistrictType === 'municipality') {
        resetLocalBody();
        if (localBodyTypeInput) localBodyTypeInput.value = subDistrictType;

        /* Show village/moholla row with text input only (no dropdown for urban areas) */
        showVillageRow(true);
        if (villageSelect) villageSelect.style.display = 'none';
        if (villageOtherInput) villageOtherInput.style.display = '';

        if (wardSelect) {
          wardSelect.innerHTML = '<option value="">-- \u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1 \u09B2\u09CB\u09A1 \u09B9\u099A\u09CD\u099B\u09C7... --</option>';

          var wardUrl;
          if (subDistrictType === 'city_corporation') {
            wardUrl = '/newshub/api/city-corporation-wards/' + subDistrictId + '/';
          } else if (subDistrictType === 'metropolitan_thana') {
            wardUrl = '/newshub/api/city-corporation-wards/metro-thana/' + subDistrictId + '/';
          } else {
            wardUrl = '/newshub/api/municipality-wards/' + subDistrictId + '/';
          }

          fetch(wardUrl)
            .then(function (r) { return r.json(); })
            .then(function (data) {
              var items = data.wards || [];
              wardSelect.innerHTML = buildTypedOptions(
                items, '-- \u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1 (\u0990\u099A\u09CD\u099B\u09BF\u0995) --'
              );
            })
            .catch(function () {
              wardSelect.innerHTML = '<option value="">-- \u09B2\u09CB\u09A1 \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 --</option>';
            });
        }
        return;
      }

      /* Upazila: fetch local bodies (union parishad) */
      if (localBodySelect) {
        localBodySelect.innerHTML = '<option value="">-- \u09B2\u09CB\u09A1 \u09B9\u099A\u09CD\u099B\u09C7... --</option>';

        fetch('/newshub/api/local-bodies/?parent_type=' + subDistrictType + '&parent_id=' + subDistrictId)
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var items = data.local_bodies || [];
            localBodySelect.innerHTML = buildTypedOptions(
              items, '-- \u0987\u0989\u09A8\u09BF\u09AF\u09BC\u09A8 \u09AA\u09B0\u09BF\u09B7\u09A6 (\u0990\u099A\u09CD\u099B\u09BF\u0995) --'
            );
          })
          .catch(function () {
            localBodySelect.innerHTML = '<option value="">-- \u09B2\u09CB\u09A1 \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 --</option>';
          });
      }
    });
  }

  /* ========== Local Body (Union / Municipality / City Corp) Change ========== */

  if (localBodySelect) {
    localBodySelect.addEventListener('change', function () {
      var localBodyId = localBodySelect.value;
      var localBodyType = getSelectedType(localBodySelect);

      if (localBodyTypeInput) localBodyTypeInput.value = localBodyType;
      centerMapOnSelected(localBodySelect, window.newshubMapPinpoint ? window.newshubMapPinpoint.LOCAL_BODY_CENTER_ZOOM : 13);
      resetWard();
      resetVillageOptions();

      if (!localBodyId) {
        showVillageRow(false);
        return;
      }

      /* Village row: visible only for union parishad (rural path) */
      if (localBodyType === 'union_parishad') {
        showVillageRow(true);
        fetchVillages(localBodyId);
      } else {
        showVillageRow(false);
      }

      /* Fetch wards */
      if (wardSelect) {
        wardSelect.innerHTML = '<option value="">-- \u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1 \u09B2\u09CB\u09A1 \u09B9\u099A\u09CD\u099B\u09C7... --</option>';

        var wardUrl;
        if (localBodyType === 'union_parishad') {
          wardUrl = '/newshub/api/union-parishad-wards/' + localBodyId + '/';
        } else if (localBodyType === 'municipality') {
          wardUrl = '/newshub/api/municipality-wards/' + localBodyId + '/';
        } else if (localBodyType === 'city_corporation') {
          wardUrl = '/newshub/api/city-corporation-wards/' + localBodyId + '/';
        } else {
          resetWard();
          return;
        }

        fetch(wardUrl)
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var items = data.wards || [];
            wardSelect.innerHTML = buildTypedOptions(
              items, '-- \u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1 (\u0990\u099A\u09CD\u099B\u09BF\u0995) --'
            );
          })
          .catch(function () {
            wardSelect.innerHTML = '<option value="">-- \u09B2\u09CB\u09A1 \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 --</option>';
          });
      }
    });
  }

  /* ========== Ward Change ========== */

  if (wardSelect) {
    wardSelect.addEventListener('change', function () {
      var wardType = getSelectedType(wardSelect);
      if (wardTypeInput) wardTypeInput.value = wardType;
      centerMapOnSelected(wardSelect, window.newshubMapPinpoint ? window.newshubMapPinpoint.WARD_CENTER_ZOOM : 14);
    });
  }

  /* ========== Fetch Villages for a Union Parishad ========== */

  function fetchVillages(unionParishadId) {
    if (!villageSelect || !unionParishadId) return;

    villageSelect.innerHTML = '<option value="">-- \u0997\u09CD\u09B0\u09BE\u09AE \u09B2\u09CB\u09A1 \u09B9\u099A\u09CD\u099B\u09C7... --</option>';

    fetch('/newshub/api/union-parishad-villages/' + unionParishadId + '/')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var opts = '<option value="">-- \u0997\u09CD\u09B0\u09BE\u09AE (\u0990\u099A\u09CD\u099B\u09BF\u0995) --</option>';
        if (data.villages && data.villages.length > 0) {
          data.villages.forEach(function (v) {
            var label = v.name_bn || '';
            if (v.name_en) label += ' (' + v.name_en + ')';
            var latAttr = v.lat != null ? ' data-lat="' + v.lat + '"' : '';
            var lngAttr = v.lng != null ? ' data-lng="' + v.lng + '"' : '';
            opts += '<option value="' + v.id + '"' + latAttr + lngAttr + '>' + escapeHtml(label) + '</option>';
          });
        }
        opts += '<option value="other">\u0985\u09A8\u09CD\u09AF\u09BE\u09A8\u09CD\u09AF (Other)</option>';
        villageSelect.innerHTML = opts;
      })
      .catch(function () {
        villageSelect.innerHTML = '<option value="">-- \u09B2\u09CB\u09A1 \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 --</option>';
      });
  }

  /* ========== Village "Other" → show/hide text input ========== */

  if (villageSelect) {
    villageSelect.addEventListener('change', function () {
      if (villageSelect.value === 'other') {
        if (villageOtherInput) {
          villageOtherInput.style.display = '';
          villageOtherInput.focus();
        }
      } else {
        if (villageOtherInput) {
          villageOtherInput.style.display = 'none';
          villageOtherInput.value = '';
        }
        centerMapOnSelected(villageSelect, window.newshubMapPinpoint ? window.newshubMapPinpoint.VILLAGE_CENTER_ZOOM : 15);
      }
    });
  }

  /* ========== Public API ========== */

  window.newshubLocationCascade = {
    getConstituencies: function () { return cachedConstituencies; },
    setConstituency: function (id) {
      if (constituencyInput) constituencyInput.value = id || '';
    },
    matchConstituency: function () { matchConstituencyByUpazila(); },
    getSelectedType: function (level) {
      if (level === 'subdistrict') return getSelectedType(subDistrictSelect);
      if (level === 'local_body') return getSelectedType(localBodySelect);
      if (level === 'ward') return getSelectedType(wardSelect);
      return '';
    },
    showVillageRow: function (show) { showVillageRow(show); },
    suppressMapCenter: function (suppress) { suppressMapCenter = suppress; },
    buildGeocodingQuery: function (fromSelect) { return buildGeocodingQuery(fromSelect || districtSelect); }
  };
})();
