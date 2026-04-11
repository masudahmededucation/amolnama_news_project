/* Travel Hub — Add / Edit Destination (with Quill rich text editors) */
(function() {
  "use strict";

  const form = document.getElementById("travel-hub-add-form");
  const errorElement = document.getElementById("travel-hub-add-error");
  const submitButton = document.getElementById("travel-hub-add-submit-button");

  if (!form) return;

  /* ---- Init Quill editors ---- */
  let shortDescEditor = null;
  let descEditor = null;

  function initEditors() {
    if (typeof window.initQuillEditor !== 'function') {
      /* Quill not loaded yet — retry in 200ms */
      setTimeout(initEditors, 200);
      return;
    }
    shortDescEditor = window.initQuillEditor('quill-short-description', 'travel-hub-short-description-bn', {
      placeholder: 'সংক্ষেপে বর্ণনা করুন... (Brief description...)',
      minHeight: '100px',
    });
    descEditor = window.initQuillEditor('quill-description', 'travel-hub-description-bn', {
      placeholder: 'দর্শনীয় স্থানের বিস্তারিত বর্ণনা... (Detailed description...)',
      minHeight: '250px',
    });

    /* Pre-populate edit data into Quill editors */
    const editDataEl = document.getElementById("travel-hub-edit-data");
    if (editDataEl) {
      try {
        const editData = JSON.parse(editDataEl.textContent);
        if (editData.short_desc_bn && shortDescEditor) shortDescEditor.setContent(editData.short_desc_bn);
        if (editData.desc_bn && descEditor) descEditor.setContent(editData.desc_bn);
      } catch (e) { /* ignore parse errors */ }
    }
  }

  initEditors();

  /* ---- Edit mode: pre-populate non-Quill fields ---- */
  const editEntryIdEl = document.getElementById("travel-hub-edit-entry-id");
  const editEntryId = editEntryIdEl ? editEntryIdEl.value : null;

  const editDataElFields = document.getElementById("travel-hub-edit-data");
  if (editDataElFields) {
    try {
      const d = JSON.parse(editDataElFields.textContent);
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
    errorElement.classList.remove("form-error-visible");
    submitButton.disabled = true;
    submitButton.textContent = editEntryId ? "পরিবর্তন হচ্ছে..." : "প্রকাশ হচ্ছে...";

    /* Sync Quill content to hidden textareas */
    if (shortDescEditor) shortDescEditor.syncToHidden();
    if (descEditor) descEditor.syncToHidden();

    const payload = {
      link_content_ref_content_subcategory_id: parseInt(document.getElementById("travel-hub-category").value) || null,
      destination_name_bn: document.getElementById("travel-hub-name-bn").value.trim(),
      destination_name_en: document.getElementById("travel-hub-name-en").value.trim(),
      destination_short_description_bn: document.getElementById("travel-hub-short-description-bn").value.trim(),
      destination_description_bn: document.getElementById("travel-hub-description-bn").value.trim(),
      link_best_season_id: parseInt(document.getElementById("travel-hub-season").value) || null,
      difficulty_level: document.getElementById("travel-hub-difficulty").value || null,
      entry_fee_bdt: parseFloat(document.getElementById("travel-hub-entry-fee").value) || null,
      visiting_hours_bn: document.getElementById("travel-hub-visiting-hours").value.trim() || null,
    };

    const url = editEntryId
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
    .then(function(res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
    .then(function(data) {
      if (data.success) {
        window.location.href = data.destination_slug ? "/bangladesh-tourist-destinations/travel/" + data.destination_slug + "/" : "/bangladesh-tourist-destinations/travel/id/" + data.destination_id + "/";
      } else {
        errorElement.textContent = data.error;
        errorElement.classList.add("form-error-visible");
        submitButton.disabled = false;
        submitButton.textContent = editEntryId ? "পরিবর্তন করুন (Update)" : "প্রকাশ করুন (Publish)";
      }
    })
    .catch(function() {
      errorElement.textContent = "সার্ভার ত্রুটি। আবার চেষ্টা করুন।";
      errorElement.classList.add("form-error-visible");
      submitButton.disabled = false;
      submitButton.textContent = editEntryId ? "পরিবর্তন করুন (Update)" : "প্রকাশ করুন (Publish)";
    });
  });

  function getCookie(name) {
    const v = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return v ? v.pop() : "";
  }
})();
