/**
 * Reusable address module JS.
 *
 * Expects an element #address-module with data attributes:
 *   data-api-upazilas   — URL for the upazilas JSON endpoint
 *   data-api-unions     — URL for the union parishads JSON endpoint
 *   data-saved-upazila  — pre-selected upazila ID (for page-load cascade)
 *   data-saved-union    — pre-selected union parishad ID (for page-load cascade)
 *
 * Handles:
 *   1. Bangladesh / international address field toggle based on country select
 *   2. Cascading dropdowns: district → upazila → union parishad
 */
(function () {
  var module = document.getElementById("address-module");
  if (!module) return;

  var apiUpazilasUrl = module.dataset.apiUpazilas;
  var apiUnionsUrl   = module.dataset.apiUnions;
  var savedUpazila   = module.dataset.savedUpazila;
  var savedUnion     = module.dataset.savedUnion;

  var countrySelect  = document.getElementById("id_country");
  var bdFields       = document.getElementById("bd-address-fields");
  var intlFields     = document.getElementById("intl-address-fields");

  // ── 1. Bangladesh / international toggle ──

  function isBangladesh() {
    return countrySelect && countrySelect.value === "+880";
  }

  function toggleAddressFields() {
    var bd = isBangladesh();
    bdFields.style.display   = bd ? "" : "none";
    intlFields.style.display = bd ? "none" : "";
  }

  if (countrySelect) {
    countrySelect.addEventListener("change", toggleAddressFields);
    toggleAddressFields();
  }

  // ── 2. Cascading location dropdowns ──

  var districtSelect = document.getElementById("id_link_district_id");
  var upazilaSelect  = document.getElementById("id_link_upazila_id");
  var unionSelect    = document.getElementById("id_link_union_parishad_id");

  function resetSelect(sel, placeholder) {
    sel.innerHTML = '<option value="">' + placeholder + "</option>";
  }

  function loadUpazilas(districtId, preselect) {
    resetSelect(upazilaSelect, "-- Select upazila --");
    resetSelect(unionSelect, "-- Select union parishad --");
    if (!districtId) return;

    fetch(apiUpazilasUrl + "?district_id=" + districtId)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        data.forEach(function (u) {
          var opt = document.createElement("option");
          opt.value = u.upazila_id;
          opt.textContent = u.upazila_name_en;
          upazilaSelect.appendChild(opt);
        });
        if (preselect) {
          upazilaSelect.value = preselect;
          loadUnions(preselect, savedUnion);
        }
      });
  }

  function loadUnions(upazilaId, preselect) {
    resetSelect(unionSelect, "-- Select union parishad --");
    if (!upazilaId) return;

    fetch(apiUnionsUrl + "?upazila_id=" + upazilaId)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        data.forEach(function (u) {
          var opt = document.createElement("option");
          opt.value = u.union_parishad_id;
          opt.textContent = u.union_parishad_name_en;
          unionSelect.appendChild(opt);
        });
        if (preselect) unionSelect.value = preselect;
      });
  }

  districtSelect.addEventListener("change", function () {
    loadUpazilas(this.value, null);
  });

  upazilaSelect.addEventListener("change", function () {
    loadUnions(this.value, null);
  });

  // On page load: if district is pre-selected, cascade down
  if (districtSelect.value) {
    loadUpazilas(districtSelect.value, savedUpazila);
  }
})();
