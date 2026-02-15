/**
 * news-attachment-upload.js
 * Incremental file attachment manager for the news collection form.
 * Users can add files one-by-one or multi-select, remove individual files,
 * up to a configurable maximum. Syncs collected files into a hidden
 * <input name="attachment_file"> for form submission.
 *
 * Featured image: each image file gets a radio button; the first image
 * is auto-selected. A hidden input "featured_file_index" tracks which
 * file index the user chose as the cover/featured image.
 */
(function () {
  var MAX_ATTACHMENT_COUNT = 4;

  /* ===== DOM references ===== */

  var filePicker = document.getElementById('attachment-file-picker');
  var hiddenFileInput = document.getElementById('attachment-file-real');
  var addFileButton = document.getElementById('attachment-add-btn');
  var fileListContainer = document.getElementById('attachment-file-list');
  var featuredInput = document.getElementById('featured-file-index');

  if (!filePicker || !hiddenFileInput || !addFileButton || !fileListContainer) return;

  var attachedFiles = [];
  var featuredIndex = -1; // index of the file marked as featured (-1 = none)

  /* ===== Utilities ===== */

  function isImageFile(file) {
    return (file.type || '').indexOf('image/') === 0;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function isDuplicateFile(file) {
    for (var i = 0; i < attachedFiles.length; i++) {
      if (attachedFiles[i].name === file.name && attachedFiles[i].size === file.size) {
        return true;
      }
    }
    return false;
  }

  /* ===== Sync featured index to hidden input ===== */

  function syncFeaturedInput() {
    if (featuredInput) {
      featuredInput.value = featuredIndex >= 0 ? featuredIndex : '';
    }
  }

  /* ===== Auto-select first image as featured if none selected ===== */

  function autoSelectFeatured() {
    /* If current featured is still valid, keep it */
    if (featuredIndex >= 0 && featuredIndex < attachedFiles.length
        && isImageFile(attachedFiles[featuredIndex])) {
      syncFeaturedInput();
      return;
    }
    /* Find first image */
    featuredIndex = -1;
    for (var i = 0; i < attachedFiles.length; i++) {
      if (isImageFile(attachedFiles[i])) {
        featuredIndex = i;
        break;
      }
    }
    syncFeaturedInput();
  }

  /* ===== Sync files to hidden input ===== */

  function syncFilesToFormInput() {
    var dataTransfer = new DataTransfer();
    for (var i = 0; i < attachedFiles.length; i++) {
      dataTransfer.items.add(attachedFiles[i]);
    }
    hiddenFileInput.files = dataTransfer.files;
  }

  /* ===== Build file row HTML ===== */

  function buildFileRowHtml(file, index) {
    var isImage = isImageFile(file);
    var isChecked = (index === featuredIndex);

    var html = '<div class="file-info-row' + (isChecked ? ' file-info-featured' : '') + '">';

    /* Featured radio — only for images */
    if (isImage) {
      html += '<label class="file-featured-radio">'
        + '<input type="radio" name="_featured_radio" value="' + index + '"'
        + (isChecked ? ' checked' : '') + '>'
        + ' \u09AA\u09CD\u09B0\u099A\u09CD\u099B\u09A6 \u099B\u09AC\u09BF (Cover Image)'
        + '</label>';
    }

    html += '<span class="file-info-name">' + file.name + '</span>'
      + '<span class="file-info-size">' + formatFileSize(file.size) + '</span>'
      + '<span class="file-info-type">' + (file.type || 'unknown') + '</span>'
      + '<button type="button" class="file-info-remove" data-index="' + index + '"'
      + ' title="সরান (Remove)">&times;</button>'
      + '</div>';
    return html;
  }

  /* ===== Update button label ===== */

  function updateAddButtonState() {
    if (attachedFiles.length >= MAX_ATTACHMENT_COUNT) {
      addFileButton.textContent = 'সর্বোচ্চ ' + MAX_ATTACHMENT_COUNT
        + ' টি ফাইল আপলোড হয়েছে (Max ' + MAX_ATTACHMENT_COUNT + ' reached)';
      addFileButton.disabled = true;
    } else if (attachedFiles.length > 0) {
      addFileButton.textContent = '+ আরো ফাইল আপলোড করুন (Add more — '
        + attachedFiles.length + '/' + MAX_ATTACHMENT_COUNT + ')';
      addFileButton.disabled = false;
    } else {
      addFileButton.textContent = '+ ফাইল আপলোড করুন (Upload files)';
      addFileButton.disabled = false;
    }
  }

  /* ===== Render the file list ===== */

  function renderFileList() {
    autoSelectFeatured();

    if (!attachedFiles.length) {
      fileListContainer.style.display = 'none';
      fileListContainer.innerHTML = '';
    } else {
      var html = '';
      for (var i = 0; i < attachedFiles.length; i++) {
        html += buildFileRowHtml(attachedFiles[i], i);
      }
      fileListContainer.innerHTML = html;
      fileListContainer.style.display = 'block';
    }
    updateAddButtonState();
  }

  /* ===== Add selected files to the list ===== */

  function addSelectedFiles(fileList) {
    var slotsAvailable = MAX_ATTACHMENT_COUNT - attachedFiles.length;

    for (var i = 0; i < fileList.length && slotsAvailable > 0; i++) {
      if (!isDuplicateFile(fileList[i])) {
        attachedFiles.push(fileList[i]);
        slotsAvailable--;
      }
    }

    syncFilesToFormInput();
    renderFileList();
  }

  /* ===== Remove a file by index ===== */

  function removeFileAtIndex(index) {
    attachedFiles.splice(index, 1);

    /* Adjust featuredIndex after removal */
    if (index === featuredIndex) {
      featuredIndex = -1; // autoSelectFeatured will pick next image
    } else if (index < featuredIndex) {
      featuredIndex--;
    }

    syncFilesToFormInput();
    renderFileList();
  }

  /* ===== Event listeners ===== */

  addFileButton.addEventListener('click', function () {
    if (attachedFiles.length >= MAX_ATTACHMENT_COUNT) return;
    filePicker.value = '';
    filePicker.click();
  });

  filePicker.addEventListener('change', function () {
    if (filePicker.files && filePicker.files.length) {
      addSelectedFiles(filePicker.files);
    }
  });

  fileListContainer.addEventListener('click', function (e) {
    /* Remove button */
    var removeButton = e.target.closest('.file-info-remove');
    if (removeButton) {
      var index = parseInt(removeButton.getAttribute('data-index'), 10);
      removeFileAtIndex(index);
      return;
    }

    /* Featured radio */
    var radio = e.target.closest('input[name="_featured_radio"]');
    if (radio) {
      featuredIndex = parseInt(radio.value, 10);
      syncFeaturedInput();
      /* Re-render to update highlight */
      renderFileList();
    }
  });

  /* ===== Re-sync files right before form submits ===== */

  var form = hiddenFileInput.closest('form');
  if (form) {
    form.addEventListener('submit', function () {
      syncFilesToFormInput();
    });
  }

  /* ===== Initial render ===== */

  renderFileList();

  /* ===== Public API for other scripts (e.g. news-form-clear.js) ===== */
  window.newshubAttachments = {
    /** reset() — clear all attached files and re-render */
    reset: function () {
      attachedFiles = [];
      featuredIndex = -1;
      syncFilesToFormInput();
      renderFileList();
    }
  };
})();
