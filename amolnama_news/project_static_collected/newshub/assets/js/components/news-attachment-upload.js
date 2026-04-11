/**
 * news-attachment-upload.js
 * Incremental file attachment manager for the news collection form.
 * Supports multiple independent upload sections (e.g., attachments + evidence).
 * Users can add files one-by-one or multi-select, remove individual files,
 * up to a configurable maximum. Syncs collected files into a hidden
 * file input for form submission.
 *
 * Featured image: each image file gets a radio button; the first image
 * is auto-selected. A hidden input tracks which file index the user
 * chose as the cover/featured image.
 */
(function () {

  /* ===== Load file validation rules from ref_asset_type (CSP-safe JSON) ===== */

  const assetTypeRules = (function () {
    const element = document.getElementById('asset-type-rules-data');
    if (!element) return [];
    try { return JSON.parse(element.textContent); } catch (e) { return []; }
  })();

  /**
   * Find the matching ref_asset_type rule for a file.
   * Returns { rule, error } — rule is null if type not allowed.
   */
  function findAssetRule(file) {
    if (!assetTypeRules.length) return { rule: null, error: null };

    /* Find matching rule by MIME type */
    let rule = null;
    for (let i = 0; i < assetTypeRules.length; i++) {
      if (assetTypeRules[i].mime_type === file.type) {
        rule = assetTypeRules[i];
        break;
      }
    }

    /* Fallback: match by extension */
    if (!rule) {
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      for (let j = 0; j < assetTypeRules.length; j++) {
        if (assetTypeRules[j].allowed_extension === ext) {
          rule = assetTypeRules[j];
          break;
        }
      }
    }

    if (!rule) {
      return {
        rule: null,
        error: file.name + ': \u098F\u0987 \u09A7\u09B0\u09A8\u09C7\u09B0 \u09AB\u09BE\u0987\u09B2 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 \u09A8\u09AF\u09BC (File type not allowed)'
      };
    }

    return { rule: rule, error: null };
  }

  /**
   * Validate file type only (size is handled by compressor).
   * Returns null if type is valid, or an error message string.
   */
  function validateFileType(file) {
    const result = findAssetRule(file);
    return result.error;
  }

  /**
   * Initialize a file upload section.
   * @param {Object} config
   * @param {string} config.pickerId        — file picker input ID
   * @param {string} config.hiddenInputId   — hidden file input ID (synced before submit)
   * @param {string} config.addButtonId     — "add files" button ID
   * @param {string} config.fileListId      — file list container ID
   * @param {string} [config.featuredInputId] — featured file index hidden input ID (optional)
   * @param {string} [config.descriptionsInputId] — hidden input ID for per-file descriptions JSON (optional)
   * @param {number} [config.maxCount]      — max files allowed (default 4)
   * @returns {Object|null} public API or null if DOM elements missing
   */
  function initFileUploadSection(config) {
    const MAX_COUNT = config.maxCount || 4;

    const filePicker = document.getElementById(config.pickerId);
    const hiddenFileInput = document.getElementById(config.hiddenInputId);
    const addFileButton = document.getElementById(config.addButtonId);
    const fileListContainer = document.getElementById(config.fileListId);
    const featuredInput = config.featuredInputId
      ? document.getElementById(config.featuredInputId)
      : null;
    const descriptionsInput = config.descriptionsInputId
      ? document.getElementById(config.descriptionsInputId)
      : null;

    if (!filePicker || !hiddenFileInput || !addFileButton || !fileListContainer) return null;

    let attachedFiles = [];
    let fileDescriptions = [];
    let featuredIndex = -1;

    /* Unique radio name per section to avoid conflicts */
    const radioName = '_featured_radio_' + config.hiddenInputId;

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
      for (let i = 0; i < attachedFiles.length; i++) {
        if (attachedFiles[i].name === file.name && attachedFiles[i].size === file.size) {
          return true;
        }
      }
      return false;
    }

    /* ===== Sync featured index ===== */

    function syncFeaturedInput() {
      if (featuredInput) {
        featuredInput.value = featuredIndex >= 0 ? featuredIndex : '';
      }
    }

    function autoSelectFeatured() {
      if (!featuredInput) return;
      if (featuredIndex >= 0 && featuredIndex < attachedFiles.length
          && isImageFile(attachedFiles[featuredIndex])) {
        syncFeaturedInput();
        return;
      }
      featuredIndex = -1;
      for (let i = 0; i < attachedFiles.length; i++) {
        if (isImageFile(attachedFiles[i])) {
          featuredIndex = i;
          break;
        }
      }
      syncFeaturedInput();
    }

    /* ===== Sync files to hidden input ===== */

    function syncFilesToFormInput() {
      const dataTransfer = new DataTransfer();
      for (let i = 0; i < attachedFiles.length; i++) {
        dataTransfer.items.add(attachedFiles[i]);
      }
      hiddenFileInput.files = dataTransfer.files;
    }

    /* ===== Sync descriptions to hidden JSON input ===== */

    function syncDescriptions() {
      if (!descriptionsInput) return;
      descriptionsInput.value = JSON.stringify(fileDescriptions);
    }

    /* ===== Build file row HTML ===== */

    function buildFileRowHtml(file, index) {
      const isImage = isImageFile(file);
      const isChecked = featuredInput && (index === featuredIndex);

      let html = '<div class="file-info-block' + (isChecked ? ' file-info-featured' : '') + '">';

      /* Top row: file meta + remove button */
      html += '<div class="file-info-row">';
      if (featuredInput && isImage) {
        html += '<label class="file-featured-radio">'
          + '<input type="radio" name="' + radioName + '" value="' + index + '"'
          + (isChecked ? ' checked' : '') + '>'
          + ' \u09AA\u09CD\u09B0\u099A\u09CD\u099B\u09A6 \u099B\u09AC\u09BF (Cover Image)'
          + '</label>';
      }
      html += '<span class="file-info-name">' + file.name + '</span>'
        + '<span class="file-info-size">' + formatFileSize(file.size) + '</span>'
        + '<span class="file-info-type">' + (file.type || 'unknown') + '</span>'
        + '<button type="button" class="button-repeater-delete file-info-remove" data-index="' + index + '"'
        + ' title="\u09A1\u09BF\u09B2\u09BF\u099F \u0995\u09B0\u09C1\u09A8 (Delete)">'
        + '\u09A1\u09BF\u09B2\u09BF\u099F <span class="button-delete-x">&times;</span></button>';
      html += '</div>';

      /* Description row */
      if (descriptionsInput) {
        const description = fileDescriptions[index] || '';
        html += '<div class="file-description-row">'
          + '<input type="text" class="file-description-input" data-index="' + index + '"'
          + ' value="' + description.replace(/"/g, '&quot;') + '"'
          + ' maxlength="1000"'
          + ' placeholder="\u09AC\u09BF\u09AC\u09B0\u09A3 (Description)">'
          + '</div>';
      }

      html += '</div>';
      return html;
    }

    /* ===== Update button label ===== */

    function updateAddButtonState() {
      /* Read default label from data attribute so each section has its own label */
      const defaultLabel = addFileButton.getAttribute('data-default-label')
        || addFileButton.textContent;
      if (!addFileButton.getAttribute('data-default-label')) {
        addFileButton.setAttribute('data-default-label', defaultLabel);
      }

      if (attachedFiles.length >= MAX_COUNT) {
        addFileButton.textContent = '\u09B8\u09B0\u09CD\u09AC\u09CB\u099A\u09CD\u099A ' + MAX_COUNT
          + ' \u099F\u09BF \u09AB\u09BE\u0987\u09B2 \u0986\u09AA\u09B2\u09CB\u09A1 \u09B9\u09DF\u09C7\u099B\u09C7 (Max ' + MAX_COUNT + ' reached)';
        addFileButton.disabled = true;
      } else if (attachedFiles.length > 0) {
        addFileButton.textContent = '+ \u0986\u09B0\u09CB \u09AB\u09BE\u0987\u09B2 ('
          + attachedFiles.length + '/' + MAX_COUNT + ')';
        addFileButton.disabled = false;
      } else {
        addFileButton.textContent = defaultLabel;
        addFileButton.disabled = false;
      }
    }

    /* ===== Render the file list ===== */

    function renderFileList() {
      autoSelectFeatured();
      if (!attachedFiles.length) {
        fileListContainer.hidden = true;
        fileListContainer.innerHTML = '';
      } else {
        let html = '';
        for (let i = 0; i < attachedFiles.length; i++) {
          html += buildFileRowHtml(attachedFiles[i], i);
        }
        fileListContainer.innerHTML = html;
        fileListContainer.hidden = false;
      }
      updateAddButtonState();
    }

    /* ===== Validation error display ===== */

    function showValidationErrors(errors) {
      let existing = fileListContainer.parentNode.querySelector('.file-upload-errors');
      if (existing) existing.parentNode.removeChild(existing);
      let div = document.createElement('div');
      div.className = 'file-upload-errors';
      div.innerHTML = errors.join('<br>');
      fileListContainer.parentNode.insertBefore(div, fileListContainer);
      setTimeout(function () {
        if (div.parentNode) div.parentNode.removeChild(div);
      }, 6000);
    }

    /* ===== Show compression warnings ===== */

    function showCompressionWarnings(warnings) {
      const existing = fileListContainer.parentNode.querySelector('.file-upload-warnings');
      if (existing) existing.parentNode.removeChild(existing);
      if (!warnings.length) return;
      const div = document.createElement('div');
      div.className = 'file-upload-warnings';
      div.innerHTML = warnings.join('<br>');
      fileListContainer.parentNode.insertBefore(div, fileListContainer);
      setTimeout(function () {
        if (div.parentNode) div.parentNode.removeChild(div);
      }, 8000);
    }

    /* ===== Add selected files (with auto-compression) ===== */

    function addSelectedFiles(fileList) {
      const slotsAvailable = MAX_COUNT - attachedFiles.length;
      const errors = [];
      const warnings = [];
      const compressor = window.newshubFileCompressor;

      /* Collect files that pass type validation */
      const candidates = [];
      for (let i = 0; i < fileList.length && candidates.length < slotsAvailable; i++) {
        if (isDuplicateFile(fileList[i])) continue;
        const typeErr = validateFileType(fileList[i]);
        if (typeErr) {
          errors.push(typeErr);
          continue;
        }
        candidates.push(fileList[i]);
      }

      if (!candidates.length) {
        if (errors.length) showValidationErrors(errors);
        return;
      }

      /* Process each candidate — compress if oversized */
      const promises = [];
      for (let c = 0; c < candidates.length; c++) {
        (function (file) {
          const ruleResult = findAssetRule(file);
          const maxKb = ruleResult.rule ? ruleResult.rule.max_size_kb : 0;
          const maxBytes = maxKb ? maxKb * 1024 : 0;

          if (!maxBytes || file.size <= maxBytes) {
            /* Already within limit */
            promises.push(Promise.resolve({ file: file, wasCompressed: false, originalSize: file.size }));
          } else if (compressor) {
            /* Try to compress */
            promises.push(
              compressor.compress(file, maxBytes).then(function (result) {
                result.originalSize = file.size;
                return result;
              }).catch(function () {
                /* Compression failed — add anyway */
                return { file: file, wasCompressed: false, originalSize: file.size };
              })
            );
          } else {
            /* No compressor available — add anyway */
            promises.push(Promise.resolve({ file: file, wasCompressed: false, originalSize: file.size }));
          }
        })(candidates[c]);
      }

      Promise.all(promises).then(function (results) {
        for (let r = 0; r < results.length; r++) {
          const res = results[r];
          attachedFiles.push(res.file);
          fileDescriptions.push('');

          if (res.wasCompressed) {
            const origMb = (res.originalSize / (1024 * 1024)).toFixed(2);
            const newMb = (res.file.size / (1024 * 1024)).toFixed(2);
            warnings.push(
              res.file.name + ': \u09AB\u09BE\u0987\u09B2\u09C7\u09B0 \u0986\u0995\u09BE\u09B0 \u0995\u09AE\u09BE\u09A8\u09CB \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 '
              + origMb + ' MB \u2192 ' + newMb + ' MB '
              + '(File was auto-compressed because it exceeded the recommended size)'
            );
          }
        }

        if (errors.length) showValidationErrors(errors);
        if (warnings.length) showCompressionWarnings(warnings);

        syncFilesToFormInput();
        syncDescriptions();
        renderFileList();
      });
    }

    /* ===== Remove a file ===== */

    function removeFileAtIndex(index) {
      attachedFiles.splice(index, 1);
      fileDescriptions.splice(index, 1);
      if (index === featuredIndex) {
        featuredIndex = -1;
      } else if (index < featuredIndex) {
        featuredIndex--;
      }
      syncFilesToFormInput();
      syncDescriptions();
      renderFileList();
    }

    /* ===== Event listeners ===== */

    addFileButton.addEventListener('click', function () {
      if (attachedFiles.length >= MAX_COUNT) return;
      filePicker.value = '';
      filePicker.click();
    });

    filePicker.addEventListener('change', function () {
      if (filePicker.files && filePicker.files.length) {
        addSelectedFiles(filePicker.files);
      }
    });

    fileListContainer.addEventListener('click', function (e) {
      const removeButton = e.target.closest('.file-info-remove');
      if (removeButton) {
        const index = parseInt(removeButton.getAttribute('data-index'), 10);
        removeFileAtIndex(index);
        return;
      }
      const radio = e.target.closest('input[name="' + radioName + '"]');
      if (radio) {
        featuredIndex = parseInt(radio.value, 10);
        syncFeaturedInput();
        renderFileList();
      }
    });

    /* Description input changes */
    fileListContainer.addEventListener('input', function (e) {
      const descInput = e.target.closest('.file-description-input');
      if (!descInput) return;
      const index = parseInt(descInput.getAttribute('data-index'), 10);
      if (!isNaN(index) && index < fileDescriptions.length) {
        fileDescriptions[index] = descInput.value;
        syncDescriptions();
      }
    });

    /* Re-sync right before form submit */
    const form = hiddenFileInput.closest('form');
    if (form) {
      form.addEventListener('submit', function () {
        syncFilesToFormInput();
        syncDescriptions();
      });
    }

    /* Initial render */
    renderFileList();

    return {
      reset: function () {
        attachedFiles = [];
        fileDescriptions = [];
        featuredIndex = -1;
        syncFilesToFormInput();
        syncDescriptions();
        renderFileList();
      }
    };
  }

  /* ===== Initialize upload sections =====
     ID convention: {prefix}-picker, {prefix}-real, {prefix}-add-button,
     {prefix}-file-list, {prefix}-descriptions-json
     Generated by shared template: file-upload-section.html */

  const attachmentApi = initFileUploadSection({
    pickerId: 'attachment-picker',
    hiddenInputId: 'attachment-real',
    addButtonId: 'attachment-add-button',
    fileListId: 'attachment-file-list',
    featuredInputId: 'featured-file-index',
    descriptionsInputId: 'attachment-descriptions-json',
    maxCount: 4
  });

  /* Evidence section (extortion & land-grab forms — only if DOM exists) */

  const evidenceApi = initFileUploadSection({
    pickerId: 'evidence-picker',
    hiddenInputId: 'evidence-real',
    addButtonId: 'evidence-add-button',
    fileListId: 'evidence-file-list',
    featuredInputId: null,
    descriptionsInputId: 'evidence-descriptions-json',
    maxCount: 4
  });

  /* Crime evidence section (crime/violence form — only if DOM exists) */

  const crimeEvidenceApi = initFileUploadSection({
    pickerId: 'crime-evidence-picker',
    hiddenInputId: 'crime-evidence-real',
    addButtonId: 'crime-evidence-add-button',
    fileListId: 'crime-evidence-file-list',
    featuredInputId: null,
    descriptionsInputId: 'crime-evidence-descriptions-json',
    maxCount: 4
  });

  /* ===== Initialize accused photos section (accused step — only if DOM exists) ===== */

  const accusedPhotosApi = initFileUploadSection({
    pickerId: 'accused-photos-picker',
    hiddenInputId: 'accused-photos-real',
    addButtonId: 'accused-photos-add-button',
    fileListId: 'accused-photos-file-list',
    featuredInputId: null,
    descriptionsInputId: 'accused-photos-descriptions-json',
    maxCount: 3
  });

  /* ===== Initialize victim photos section (victim step — only if DOM exists) ===== */

  const victimPhotosApi = initFileUploadSection({
    pickerId: 'victim-photos-picker',
    hiddenInputId: 'victim-photos-real',
    addButtonId: 'victim-photos-add-button',
    fileListId: 'victim-photos-file-list',
    featuredInputId: null,
    descriptionsInputId: 'victim-photos-descriptions-json',
    maxCount: 3
  });

  /* ===== Initialize witness photos section (witness step — only if DOM exists) ===== */

  const witnessPhotosApi = initFileUploadSection({
    pickerId: 'witness-photos-picker',
    hiddenInputId: 'witness-photos-real',
    addButtonId: 'witness-photos-add-button',
    fileListId: 'witness-photos-file-list',
    featuredInputId: null,
    descriptionsInputId: 'witness-photos-descriptions-json',
    maxCount: 3
  });

  /* ===== Public API for other scripts (e.g. news-form-clear.js) ===== */

  window.newshubAttachments = {
    reset: function () {
      if (attachmentApi) attachmentApi.reset();
      if (evidenceApi) evidenceApi.reset();
      if (crimeEvidenceApi) crimeEvidenceApi.reset();
      if (accusedPhotosApi) accusedPhotosApi.reset();
      if (victimPhotosApi) victimPhotosApi.reset();
      if (witnessPhotosApi) witnessPhotosApi.reset();
    }
  };
})();
