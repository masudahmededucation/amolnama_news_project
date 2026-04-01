/* Travel Hub — Add / Edit Destination (with Quill rich text editors) */
(function() {
  "use strict";

  var form = document.getElementById("travel-hub-add-form");
  var errorElement = document.getElementById("travel-hub-add-error");
  var submitButton = document.getElementById("travel-hub-add-submit-button");

  if (!form) return;

  /* ---- Init Quill editors ---- */
  var shortDescEditor = null;
  var descEditor = null;

  function initEditors() {
    if (typeof window.initQuillEditor !== 'function') {
      /* Quill not loaded yet — retry in 200ms */
      setTimeout(initEditors, 200);
      return;
    }
    shortDescEditor = window.initQuillEditor('quill-short-desc', 'travel-hub-short-desc-bn', {
      placeholder: 'সংক্ষেপে বর্ণনা করুন... (Brief description...)',
      minHeight: '100px',
    });
    descEditor = window.initQuillEditor('quill-desc', 'travel-hub-desc-bn', {
      placeholder: 'দর্শনীয় স্থানের বিস্তারিত বর্ণনা... (Detailed description...)',
      minHeight: '250px',
    });

    /* Pre-populate edit data into Quill editors */
    var editDataEl = document.getElementById("travel-hub-edit-data");
    if (editDataEl) {
      try {
        var editData = JSON.parse(editDataEl.textContent);
        if (editData.short_desc_bn && shortDescEditor) shortDescEditor.setContent(editData.short_desc_bn);
        if (editData.desc_bn && descEditor) descEditor.setContent(editData.desc_bn);
      } catch (e) { /* ignore parse errors */ }
    }
  }

  initEditors();

  /* ---- Edit mode: pre-populate non-Quill fields ---- */
  var editEntryIdEl = document.getElementById("travel-hub-edit-entry-id");
  var editEntryId = editEntryIdEl ? editEntryIdEl.value : null;

  var editDataEl = document.getElementById("travel-hub-edit-data");
  if (editDataEl) {
    try {
      var d = JSON.parse(editDataEl.textContent);
      if (d.category_id) document.getElementById("travel-hub-category").value = String(d.category_id);
      if (d.name_bn) document.getElementById("travel-hub-name-bn").value = d.name_bn;
      if (d.name_en) document.getElementById("travel-hub-name-en").value = d.name_en;
      if (d.season_id) document.getElementById("travel-hub-season").value = String(d.season_id);
      if (d.difficulty) document.getElementById("travel-hub-difficulty").value = d.difficulty;
      if (d.entry_fee) document.getElementById("travel-hub-entry-fee").value = d.entry_fee;
      if (d.visiting_hours) document.getElementById("travel-hub-visiting-hours").value = d.visiting_hours;
    } catch (e) { /* ignore parse errors */ }
  }

  /* ---- Submit: create or update ---- */
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    errorElement.style.display = "none";
    submitButton.disabled = true;
    submitButton.textContent = editEntryId ? "পরিবর্তন হচ্ছে..." : "প্রকাশ হচ্ছে...";

    /* Sync Quill content to hidden textareas */
    if (shortDescEditor) shortDescEditor.syncToHidden();
    if (descEditor) descEditor.syncToHidden();

    var payload = {
      link_destination_category_id: parseInt(document.getElementById("travel-hub-category").value) || null,
      destination_name_bn: document.getElementById("travel-hub-name-bn").value.trim(),
      destination_name_en: document.getElementById("travel-hub-name-en").value.trim(),
      destination_short_description_bn: document.getElementById("travel-hub-short-desc-bn").value.trim(),
      destination_description_bn: document.getElementById("travel-hub-desc-bn").value.trim(),
      link_best_season_id: parseInt(document.getElementById("travel-hub-season").value) || null,
      difficulty_level: document.getElementById("travel-hub-difficulty").value || null,
      entry_fee_bdt: parseFloat(document.getElementById("travel-hub-entry-fee").value) || null,
      visiting_hours_bn: document.getElementById("travel-hub-visiting-hours").value.trim() || null,
    };

    var url = editEntryId
      ? "/bangladesh-tourist-destinations/api/destinations/" + editEntryId + "/update/"
      : "/bangladesh-tourist-destinations/api/destinations/create/";

    fetch(url, {
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
        window.location.href = data.destination_slug ? "/bangladesh-tourist-destinations/travel/" + data.destination_slug + "/" : "/bangladesh-tourist-destinations/travel/id/" + data.destination_id + "/";
      } else {
        errorElement.textContent = data.error;
        errorElement.style.display = "block";
        submitButton.disabled = false;
        submitButton.textContent = editEntryId ? "পরিবর্তন করুন (Update)" : "প্রকাশ করুন (Publish)";
      }
    })
    .catch(function() {
      errorElement.textContent = "সার্ভার ত্রুটি। আবার চেষ্টা করুন।";
      errorElement.style.display = "block";
      submitButton.disabled = false;
      submitButton.textContent = editEntryId ? "পরিবর্তন করুন (Update)" : "প্রকাশ করুন (Publish)";
    });
  });

  function getCookie(name) {
    var v = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return v ? v.pop() : "";
  }
})();
