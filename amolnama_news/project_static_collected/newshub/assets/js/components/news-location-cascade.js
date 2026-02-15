/**
 * news-location-cascade.js
 * Cascading location dropdowns:
 *   District → Constituency + Upazila
 *   Upazila  → Union Parishad
 */
(function () {
  var districtSelect = document.getElementById('news-district-id');
  var constituencySelect = document.getElementById('news-constituency-id');
  var upazilaSelect = document.getElementById('news-upazila-id');
  var unionSelect = document.getElementById('news-union-parishad-id');

  if (!districtSelect) return;

  /* ---- District change → load constituencies + upazilas ---- */
  districtSelect.addEventListener('change', function () {
    var districtId = districtSelect.value;

    /* Reset all dependent selects */
    if (constituencySelect) {
      constituencySelect.innerHTML = '<option value="">-- নির্বাচনী এলাকা লোড হচ্ছে... --</option>';
    }
    if (upazilaSelect) {
      upazilaSelect.innerHTML = '<option value="">-- উপজেলা লোড হচ্ছে... --</option>';
    }
    if (unionSelect) {
      unionSelect.innerHTML = '<option value="">-- প্রথমে উপজেলা নির্বাচন করুন --</option>';
    }

    if (!districtId) {
      if (constituencySelect) {
        constituencySelect.innerHTML = '<option value="">-- প্রথমে জেলা নির্বাচন করুন --</option>';
      }
      if (upazilaSelect) {
        upazilaSelect.innerHTML = '<option value="">-- প্রথমে জেলা নির্বাচন করুন --</option>';
      }
      return;
    }

    /* Fetch constituencies */
    if (constituencySelect) {
      fetch('/newshub/api/constituencies/' + districtId + '/')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var opts = '<option value="">-- নির্বাচনী এলাকা (ঐচ্ছিক) --</option>';
          if (data.constituencies && data.constituencies.length > 0) {
            data.constituencies.forEach(function (c) {
              var label = c.name_bn;
              if (c.name_en) label += ' (' + c.name_en + ')';
              if (c.area_bn) label += ' — ' + c.area_bn;
              opts += '<option value="' + c.id + '">' + label + '</option>';
            });
          }
          constituencySelect.innerHTML = opts;
        })
        .catch(function () {
          constituencySelect.innerHTML = '<option value="">-- লোড ব্যর্থ --</option>';
        });
    }

    /* Fetch upazilas */
    if (upazilaSelect) {
      fetch('/newshub/api/upazilas/' + districtId + '/')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var opts = '<option value="">-- উপজেলা (ঐচ্ছিক) --</option>';
          if (data.upazilas && data.upazilas.length > 0) {
            data.upazilas.forEach(function (u) {
              var label = u.name_bn;
              if (u.name_en) label += ' (' + u.name_en + ')';
              opts += '<option value="' + u.id + '">' + label + '</option>';
            });
          }
          upazilaSelect.innerHTML = opts;
        })
        .catch(function () {
          upazilaSelect.innerHTML = '<option value="">-- লোড ব্যর্থ --</option>';
        });
    }
  });

  /* ---- Upazila change → load union parishads ---- */
  if (upazilaSelect && unionSelect) {
    upazilaSelect.addEventListener('change', function () {
      var upazilaId = upazilaSelect.value;

      unionSelect.innerHTML = '<option value="">-- ইউনিয়ন পরিষদ লোড হচ্ছে... --</option>';

      if (!upazilaId) {
        unionSelect.innerHTML = '<option value="">-- প্রথমে উপজেলা নির্বাচন করুন --</option>';
        return;
      }

      fetch('/newshub/api/union-parishads/' + upazilaId + '/')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var opts = '<option value="">-- ইউনিয়ন পরিষদ (ঐচ্ছিক) --</option>';
          if (data.union_parishads && data.union_parishads.length > 0) {
            data.union_parishads.forEach(function (up) {
              var label = up.name_bn;
              if (up.name_en) label += ' (' + up.name_en + ')';
              opts += '<option value="' + up.id + '">' + label + '</option>';
            });
          }
          unionSelect.innerHTML = opts;
        })
        .catch(function () {
          unionSelect.innerHTML = '<option value="">-- লোড ব্যর্থ --</option>';
        });
    });
  }
})();
