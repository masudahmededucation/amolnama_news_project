/* Beauty Hub — Upload photo/video */
(function() {
  "use strict";

  const form = document.getElementById("bhUploadForm");
  const fileInput = document.getElementById("bh-file");
  const categorySelect = document.getElementById("bh-category");
  const festivalFields = document.getElementById("bhFestivalFields");
  const previewWrap = document.getElementById("bhFilePreview");
  const imgPreview = document.getElementById("bhImgPreview");
  const vidPreview = document.getElementById("bhVidPreview");
  const errorEl = document.getElementById("bhUploadError");
  const progressWrap = document.getElementById("bhUploadProgress");
  const progressBar = document.getElementById("bhProgressBar");
  const progressText = document.getElementById("bhProgressText");
  const submitBtn = document.getElementById("bhUploadSubmit");

  if (!form) return;

  // Init Quill rich text editor for description
  var descEditor = window.initQuillEditor ? window.initQuillEditor('quill-bh-desc', 'bh-desc-bn', {
    placeholder: 'ছবি বা ভিডিওর বিবরণ... (Describe the photo or video...)',
    minHeight: '120px',
  }) : null;

  // Show/hide festival fields based on category
  categorySelect.addEventListener("change", function() {
    var selectedText = categorySelect.options[categorySelect.selectedIndex]?.text || "";
    festivalFields.style.display = (selectedText.toLowerCase().includes("festival") || selectedText.includes("উৎসব")) ? "block" : "none";
  });

  // File preview
  fileInput.addEventListener("change", function() {
    var file = fileInput.files[0];
    if (!file) { previewWrap.style.display = "none"; return; }

    previewWrap.style.display = "block";
    imgPreview.style.display = "none";
    vidPreview.style.display = "none";
    errorEl.style.display = "none";

    if (file.type.startsWith("image/")) {
      var url = URL.createObjectURL(file);
      imgPreview.src = url;
      imgPreview.style.display = "block";
    } else if (file.type.startsWith("video/")) {
      if (file.size > 50 * 1024 * 1024) {
        errorEl.textContent = "ভিডিও ৫০MB এর বেশি হতে পারবে না।";
        errorEl.style.display = "block";
        return;
      }
      var vUrl = URL.createObjectURL(file);
      vidPreview.src = vUrl;
      vidPreview.style.display = "block";
      vidPreview.onloadedmetadata = function() {
        if (vidPreview.duration > 40) {
          errorEl.textContent = "ভিডিও সর্বোচ্চ ৪০ সেকেন্ড হতে পারবে।";
          errorEl.style.display = "block";
        }
      };
    }
  });

  // Upload
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    errorEl.style.display = "none";

    var file = fileInput.files[0];
    if (!file) { errorEl.textContent = "ফাইল নির্বাচন করুন"; errorEl.style.display = "block"; return; }
    if (!document.getElementById("bh-category").value) { errorEl.textContent = "ধরন নির্বাচন করুন"; errorEl.style.display = "block"; return; }

    // Sync Quill content to hidden textarea
    if (descEditor) descEditor.syncToHidden();

    var fd = new FormData();
    fd.append("file", file);
    fd.append("link_media_category_id", document.getElementById("bh-category").value);
    fd.append("media_title_bn", (document.getElementById("bh-title-bn").value || "").trim());
    fd.append("media_description_bn", (document.getElementById("bh-desc-bn").value || "").trim());
    fd.append("location_name_bn", (document.getElementById("bh-location-bn").value || "").trim());
    fd.append("link_season_id", document.getElementById("bh-season").value);
    fd.append("exif_camera_model", (document.getElementById("bh-camera").value || "").trim());
    fd.append("time_of_day", document.getElementById("bh-time-of-day").value);
    fd.append("event_date_from", document.getElementById("bh-event-date-from").value);
    fd.append("event_date_to", document.getElementById("bh-event-date-to").value);
    fd.append("is_yearly_event", document.getElementById("bh-yearly-event").checked ? "1" : "0");

    submitBtn.disabled = true;
    progressWrap.style.display = "block";

    var xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", function(ev) {
      if (ev.lengthComputable) {
        var pct = Math.round((ev.loaded / ev.total) * 100);
        progressBar.style.width = pct + "%";
        progressText.textContent = pct + "% আপলোড হচ্ছে...";
      }
    });
    xhr.addEventListener("load", function() {
      try {
        var data = JSON.parse(xhr.responseText);
        if (data.success) {
          progressText.textContent = "সফল! পুনঃনির্দেশ হচ্ছে...";
          window.location.href = "/bangladesh/beauty/";
        } else {
          errorEl.textContent = data.error;
          errorEl.style.display = "block";
          submitBtn.disabled = false;
          progressWrap.style.display = "none";
        }
      } catch (err) {
        errorEl.textContent = "সার্ভার ত্রুটি";
        errorEl.style.display = "block";
        submitBtn.disabled = false;
        progressWrap.style.display = "none";
      }
    });
    xhr.addEventListener("error", function() {
      errorEl.textContent = "নেটওয়ার্ক ত্রুটি";
      errorEl.style.display = "block";
      submitBtn.disabled = false;
      progressWrap.style.display = "none";
    });

    xhr.open("POST", "/bangladesh/api/media/upload/");
    xhr.setRequestHeader("X-CSRFToken", getCookie("csrftoken"));
    xhr.send(fd);
  });

  function getCookie(name) {
    var v = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return v ? v.pop() : "";
  }
})();
