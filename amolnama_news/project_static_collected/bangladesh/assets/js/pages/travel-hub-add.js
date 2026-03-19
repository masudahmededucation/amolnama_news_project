/* Travel Hub — Add Destination */
(function() {
  "use strict";

  var form = document.getElementById("thAddForm");
  var errorEl = document.getElementById("thAddError");
  var submitBtn = document.getElementById("thAddSubmit");

  if (!form) return;

  form.addEventListener("submit", function(e) {
    e.preventDefault();
    errorEl.style.display = "none";
    submitBtn.disabled = true;
    submitBtn.textContent = "প্রকাশ হচ্ছে...";

    var payload = {
      link_destination_category_id: parseInt(document.getElementById("th-category").value) || null,
      destination_name_bn: document.getElementById("th-name-bn").value.trim(),
      destination_name_en: document.getElementById("th-name-en").value.trim(),
      destination_short_description_bn: document.getElementById("th-short-desc-bn").value.trim(),
      destination_description_bn: document.getElementById("th-desc-bn").value.trim(),
      link_best_season_id: parseInt(document.getElementById("th-season").value) || null,
      difficulty_level: document.getElementById("th-difficulty").value || null,
      entry_fee_bdt: parseFloat(document.getElementById("th-entry-fee").value) || null,
      visiting_hours_bn: document.getElementById("th-visiting-hours").value.trim() || null,
    };

    fetch("/bangladesh/api/destinations/create/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
      },
      body: JSON.stringify(payload),
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        window.location.href = "/bangladesh/travel/" + data.destination_id + "/";
      } else {
        errorEl.textContent = data.error;
        errorEl.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.textContent = "প্রকাশ করুন (Publish)";
      }
    })
    .catch(function() {
      errorEl.textContent = "সার্ভার ত্রুটি। আবার চেষ্টা করুন।";
      errorEl.style.display = "block";
      submitBtn.disabled = false;
      submitBtn.textContent = "প্রকাশ করুন (Publish)";
    });
  });

  function getCookie(name) {
    var v = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return v ? v.pop() : "";
  }
})();
