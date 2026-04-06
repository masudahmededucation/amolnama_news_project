/* Beauty Hub — Upload photo/video */
(function() {
  "use strict";

  const uploadForm = document.getElementById("beauty-hub-upload-form");
  const fileInput = document.getElementById("beauty-hub-file");
  const categorySelect = document.getElementById("beauty-hub-category");
  const festivalFields = document.getElementById("beauty-hub-festival-fields");
  const filePreviewWrapper = document.getElementById("beauty-hub-file-preview");
  const imagePreview = document.getElementById("beauty-hub-image-preview");
  const videoPreview = document.getElementById("beauty-hub-video-preview");
  const uploadError = document.getElementById("beauty-hub-upload-error");
  const uploadProgress = document.getElementById("beauty-hub-upload-progress");
  const progressBar = document.getElementById("beauty-hub-progress-bar");
  const progressText = document.getElementById("beauty-hub-progress-text");
  const submitButton = document.getElementById("beauty-hub-upload-submit-button");

  if (!uploadForm) return;

  // Init Quill rich text editor for description
  const descriptionEditor = window.initQuillEditor ? window.initQuillEditor('quill-beauty-hub-description', 'beauty-hub-description-bn', {
    placeholder: 'ছবি বা ভিডিওর বিবরণ... (Describe the photo or video...)',
    minHeight: '120px',
  }) : null;

  // Show/hide festival fields based on category
  categorySelect.addEventListener("change", function() {
    const selectedText = categorySelect.options[categorySelect.selectedIndex]?.text || "";
    const isFestival = selectedText.toLowerCase().includes("festival") || selectedText.includes("উৎসব");
    festivalFields.hidden = !isFestival);
  });

  // File preview
  fileInput.addEventListener("change", function() {
    let file = fileInput.files[0];
    if (!file) { filePreviewWrapper.hidden = true; return; }

    filePreviewWrapper.hidden = false;
    imagePreview.hidden = true;
    videoPreview.hidden = true;
    uploadError.hidden = true;

    if (file.type.startsWith("image/")) {
      const objectUrl = URL.createObjectURL(file);
      imagePreview.src = objectUrl;
      imagePreview.hidden = false;
    } else if (file.type.startsWith("video/")) {
      if (file.size > 50 * 1024 * 1024) {
        uploadError.textContent = "ভিডিও ৫০MB এর বেশি হতে পারবে না।";
        uploadError.hidden = false;
        return;
      }
      const videoObjectUrl = URL.createObjectURL(file);
      videoPreview.src = videoObjectUrl;
      videoPreview.hidden = false;
      videoPreview.onloadedmetadata = function() {
        if (videoPreview.duration > 40) {
          uploadError.textContent = "ভিডিও সর্বোচ্চ ৪০ সেকেন্ড হতে পারবে।";
          uploadError.hidden = false;
        }
      };
    }
  });

  // Upload
  uploadForm.addEventListener("submit", function(event) {
    event.preventDefault();
    uploadError.hidden = true;

    const file = fileInput.files[0];
    if (!file) { uploadError.textContent = "ফাইল নির্বাচন করুন"; uploadError.hidden = false; return; }
    if (!categorySelect.value) { uploadError.textContent = "ধরন নির্বাচন করুন"; uploadError.hidden = false; return; }

    // Sync Quill content to hidden textarea
    if (descriptionEditor) descriptionEditor.syncToHidden();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("link_media_category_id", categorySelect.value);
    formData.append("media_title_bn", (document.getElementById("beauty-hub-title-bn").value || "").trim());
    formData.append("media_description_bn", (document.getElementById("beauty-hub-description-bn").value || "").trim());
    formData.append("location_name_bn", (document.getElementById("beauty-hub-location-bn").value || "").trim());
    formData.append("link_season_id", document.getElementById("beauty-hub-season").value);
    formData.append("exif_camera_model", (document.getElementById("beauty-hub-camera").value || "").trim());
    formData.append("time_of_day", document.getElementById("beauty-hub-time-of-day").value);
    formData.append("event_date_from", document.getElementById("beauty-hub-event-date-from").value);
    formData.append("event_date_to", document.getElementById("beauty-hub-event-date-to").value);
    formData.append("is_yearly_event", document.getElementById("beauty-hub-yearly-event").checked ? "1" : "0");

    submitButton.disabled = true;
    uploadProgress.hidden = false;

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", function(progressEvent) {
      if (progressEvent.lengthComputable) {
        const percentage = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        progressBar.style.width = percentage + "%";
        progressText.textContent = percentage + "% আপলোড হচ্ছে...";
      }
    });
    xhr.addEventListener("load", function() {
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.success) {
          progressText.textContent = "সফল! পুনঃনির্দেশ হচ্ছে...";
          window.location.href = "/bangladesh-tourist-destinations/beauty/";
        } else {
          uploadError.textContent = data.error;
          uploadError.hidden = false;
          submitButton.disabled = false;
          uploadProgress.hidden = true;
        }
      } catch (parseError) {
        uploadError.textContent = "সার্ভার ত্রুটি";
        uploadError.hidden = false;
        submitButton.disabled = false;
        uploadProgress.hidden = true;
      }
    });
    xhr.addEventListener("error", function() {
      uploadError.textContent = "নেটওয়ার্ক ত্রুটি";
      uploadError.hidden = false;
      submitButton.disabled = false;
      uploadProgress.hidden = true;
    });

    xhr.open("POST", "/bangladesh-tourist-destinations/api/media/upload/");
    xhr.setRequestHeader("X-CSRFToken", getCsrfTokenValue());
    xhr.send(formData);
  });

})();
