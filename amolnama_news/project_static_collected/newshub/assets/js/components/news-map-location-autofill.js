/**
 * news-map-location-autofill.js
 * Auto-fills district, upazila, and union parishad dropdowns from
 * Nominatim reverse-geocode / search address data.
 *
 * Nominatim address fields for Bangladesh:
 *   address.state_district → District (জেলা)
 *   address.county         → Upazila (উপজেলা)
 *   address.town / village → locality (used for union best-effort match)
 *
 * Matching strategy:
 *   Text match: extract name before "জেলা"/"উপজেলা" keyword, compare Bengali text
 *   with substring/similarity scoring for dialect/spelling variations
 *
 * Depends on:
 *   window.newshubMapPinpoint (news-map-pinpoint.js) — suppress district auto-center
 *   news-location-cascade.js — cascade fetch populates upazila/union options
 *
 * Called by:
 *   news-map-reverse-geocode.js — after reverse geocode completes
 *   news-map-search.js — after user selects a search result
 */
(function () {
  'use strict';

  const districtSelect = document.getElementById('news-district-id');
  const upazilaSelect = document.getElementById('news-upazila-id');
  const unionSelect = document.getElementById('news-union-parishad-id');

  if (!districtSelect) return;

  /* ========== Name Extraction from Nominatim Response ========== */

  function extractLocationNames(address, displayName) {
    const result = { district: '', upazila: '', union: '' };

    if (!address) return result;

    /* District: address.state_district (e.g. "ঢাকা জেলা") */
    if (address.state_district) {
      result.district = extractNameBefore(address.state_district, 'জেলা');
    }

    /* Upazila: address.county — only if it contains "উপজেলা" (skip city corporations) */
    if (address.county && address.county.indexOf('উপজেলা') !== -1) {
      result.upazila = extractNameBefore(address.county, 'উপজেলা');
    }

    /* Union: best-effort from address.village, town, or suburb */
    const unionCandidate = address.village || address.town || address.suburb || '';
    if (unionCandidate && unionCandidate !== result.upazila) {
      result.union = unionCandidate.trim();
    }

    /* Fallback: always parse display_name for district if not found */
    if (displayName) {
      const parts = displayName.split(',');
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (!result.district && part.indexOf('জেলা') !== -1) {
          result.district = extractNameBefore(part, 'জেলা');
        }
        if (!result.upazila && part.indexOf('উপজেলা') !== -1) {
          result.upazila = extractNameBefore(part, 'উপজেলা');
        }
      }
    }

    return result;
  }

  function extractNameBefore(text, keyword) {
    const index = text.indexOf(keyword);
    if (index === -1) return text.trim();
    return text.substring(0, index).trim();
  }

  /* ========== Dropdown Matching (Text) ========== */

  function matchDropdownOption(selectEl, searchName) {
    if (!searchName || !selectEl) return null;
    const normalized = searchName.trim();
    if (!normalized) return null;

    let bestMatch = null;
    let bestScore = 0;

    for (let i = 0; i < selectEl.options.length; i++) {
      const opt = selectEl.options[i];
      if (!opt.value) continue;

      /* Extract Bengali part (before parentheses with English name) */
      const optText = opt.textContent.trim();
      const bnPart = optText.split('(')[0].trim();

      /* Exact match — best */
      if (bnPart === normalized) return opt;

      /* Substring match — score by length similarity */
      if (bnPart.indexOf(normalized) !== -1 || normalized.indexOf(bnPart) !== -1) {
        const shorter = Math.min(bnPart.length, normalized.length);
        const longer = Math.max(bnPart.length, normalized.length);
        const score = shorter / longer;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = opt;
        }
      }
    }

    return bestScore > 0.5 ? bestMatch : null;
  }

  /* ========== Select Value Helper (Tom Select aware) ========== */

  function setSelectValue(selectEl, value) {
    if (selectEl.tomselect) {
      selectEl.tomselect.setValue(value, true);
    } else {
      selectEl.value = value;
    }
    selectEl.dispatchEvent(new Event('change'));
  }

  /* ========== Cascade Wait + Auto-Select ========== */

  function waitForOptionsAndSelect(selectEl, name) {
    if (!name || !selectEl) return;

    const observer = new MutationObserver(function () {
      observer.disconnect();
      const matched = matchDropdownOption(selectEl, name);
      if (matched) {
        setSelectValue(selectEl, matched.value);
      }
    });

    observer.observe(selectEl, { childList: true });
  }

  /* ========== Main: Auto-Fill Location Dropdowns ========== */

  function fillLocationFromAddress(address, displayName, latitude, longitude) {
    const names = extractLocationNames(address, displayName);

    /* 1. Match district by text */
    let districtOption = null;
    if (names.district) {
      districtOption = matchDropdownOption(districtSelect, names.district);
    }
    if (!districtOption) return;

    /* Skip if already the correct district */
    const currentDistrict = districtSelect.tomselect ? districtSelect.tomselect.getValue() : districtSelect.value;
    if (currentDistrict === districtOption.value) {
      if (names.upazila) {
        /* Constituency is auto-matched by news-location-cascade.js when upazila changes */
        /* Upazila */
        if (upazilaSelect && upazilaSelect.options.length > 1) {
          let upazilaMatch = matchDropdownOption(upazilaSelect, names.upazila);
          if (upazilaMatch && upazilaSelect.value !== upazilaMatch.value) {
            setSelectValue(upazilaSelect, upazilaMatch.value);
            if (names.union) waitForOptionsAndSelect(unionSelect, names.union);
          }
        }
      }
      return;
    }

    /* Suppress map auto-center — user pinpointed a spot, don't zoom out */
    if (window.newshubMapPinpoint && window.newshubMapPinpoint.suppressNextDistrictCenter) {
      window.newshubMapPinpoint.suppressNextDistrictCenter();
    }

    /* Select district and trigger cascade */
    setSelectValue(districtSelect, districtOption.value);

    /* Constituency is auto-matched by news-location-cascade.js when upazila changes */

    /* 2. Wait for upazila cascade, then match */
    if (names.upazila && upazilaSelect) {
      const upazilaObserver = new MutationObserver(function () {
        upazilaObserver.disconnect();
        const upazilaMatch = matchDropdownOption(upazilaSelect, names.upazila);
        if (upazilaMatch) {
          setSelectValue(upazilaSelect, upazilaMatch.value);

          if (names.union && unionSelect) {
            waitForOptionsAndSelect(unionSelect, names.union);
          }
        }
      });
      upazilaObserver.observe(upazilaSelect, { childList: true });
    }
  }

  /* ========== Public API ========== */

  window.newshubMapLocationAutofill = {
    fillFromAddress: function (address, displayName, latitude, longitude) {
      fillLocationFromAddress(address, displayName, latitude, longitude);
    }
  };
})();
