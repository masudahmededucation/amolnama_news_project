if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}
(function () {
  'use strict';

  /* ====== Constants ====== */
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

  /* ====== Quality helpers ====== */

  function sliderToQuality(val) {
    return 0.92 - (val / 100) * 0.82;
  }

  function sliderToMaxDimension(val, originalW) {
    if (val <= 33) return null;
    if (val <= 66) return originalW > 2000 ? 2000 : null;
    return originalW > 1200 ? 1200 : null;
  }

  const SNAP_POINTS = { low: 15, medium: 50, high: 85 };

  function getActiveLevel(val) {
    if (val <= 33) return 'low';
    if (val <= 66) return 'medium';
    return 'high';
  }

  function getEstimateRange(val) {
    const minReduction = 0.05 + (val / 100) * 0.55;
    let maxReduction = 0.15 + (val / 100) * 0.65;
    if (maxReduction > 0.85) maxReduction = 0.85;
    return [minReduction, maxReduction];
  }

  function getLevelLabel(val) {
    if (val <= 33) return 'Low — best quality';
    if (val <= 66) return 'Medium — balanced';
    return 'High — smallest file';
  }

  /* ====== File type helpers ====== */

  function isImage(file) {
    return /^image\//i.test(file.type);
  }

  function isPdf(file) {
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  }

  function getFileCategory(file) {
    if (isImage(file)) return 'image';
    if (isPdf(file)) return 'pdf';
    return 'other';
  }

  function getFileIcon(file) {
    let cat = getFileCategory(file);
    if (cat === 'pdf') return '📄';
    let ext = (file.name.split('.').pop() || '').toLowerCase();
    if (['doc', 'docx', 'odt', 'rtf', 'txt'].indexOf(ext) !== -1) return '📝';
    if (['xls', 'xlsx', 'csv', 'ods'].indexOf(ext) !== -1) return '📊';
    if (['ppt', 'pptx', 'odp'].indexOf(ext) !== -1) return '📊';
    if (['zip', 'rar', '7z', 'tar', 'gz'].indexOf(ext) !== -1) return '📦';
    if (['mp4', 'avi', 'mkv', 'mov', 'webm'].indexOf(ext) !== -1) return '🎬';
    if (['mp3', 'wav', 'flac', 'ogg', 'aac'].indexOf(ext) !== -1) return '🎵';
    return '📁';
  }

  function getExtFromType(mimeType) {
    const map = {
      'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/png': '.png',
      'image/gif': '.gif', 'image/bmp': '.bmp'
    };
    return map[mimeType] || '';
  }

  /* ====== State ====== */
  let selectedFiles = [];    // { file, thumbUrl, id, status }
  let compressedResults = []; // { name, originalSize, blob, thumbUrl, category, originalThumbUrl, outputFormat }

  /* ====== DOM refs ====== */
  const dropzone        = document.getElementById('compress-dropzone');
  const fileInput       = document.getElementById('compress-file-input');
  const browseBtn       = document.getElementById('compress-browse-btn');
  const fileListSection = document.getElementById('compress-file-list');
  const fileItemsEl     = document.getElementById('compress-file-items');
  const clearBtn        = document.getElementById('compress-clear-btn');
  const settingsSection = document.getElementById('compress-settings');
  const slider          = document.getElementById('compress-slider');
  const sliderLabels    = document.querySelectorAll('.compress-slider-label');
  const estimateText    = document.getElementById('compress-estimate-text');
  const formatSelect    = document.getElementById('compress-format');
  const resizeCheck     = document.getElementById('compress-resize-check');
  const resizeWidth     = document.getElementById('compress-resize-width');
  const stripMetaCheck  = document.getElementById('compress-strip-meta');
  const actionBtn       = document.getElementById('compress-action-btn');
  const resultsSection  = document.getElementById('compress-results');
  const resultsSummary  = document.getElementById('compress-results-summary');
  const resultsItems    = document.getElementById('compress-results-items');
  const downloadAllBtn  = document.getElementById('compress-download-all-btn');

  // Comparison modal
  const compareOverlay   = document.getElementById('compress-compare-overlay');
  const compareClose     = document.getElementById('compress-compare-close');
  const compareTitle     = document.getElementById('compress-compare-title');
  const compareBeforeImg = document.getElementById('compress-compare-before-img');
  const compareAfterImg  = document.getElementById('compress-compare-after-img');
  const compareBefore    = document.getElementById('compress-compare-before');
  const compareSlider    = document.getElementById('compress-compare-slider');
  const compareDivider   = document.getElementById('compress-compare-divider');
  const compareInfo      = document.getElementById('compress-compare-info');

  /* ====== Smooth show/hide ====== */

  function showSection(el) {
    el.classList.remove('display-hidden');
    el.classList.remove('tool-section-reveal');
    void el.offsetWidth;
    el.classList.add('tool-section-reveal');
  }

  function hideSection(el) {
    el.classList.add('display-hidden');
    el.classList.remove('tool-section-reveal');
  }

  /* ====== Utilities ====== */

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
  }

  function getTotalSize() {
    let total = 0;
    for (let i = 0; i < selectedFiles.length; i++) total += selectedFiles[i].file.size;
    return total;
  }


  /* ====== Drag & Drop ====== */

  dropzone.addEventListener('click', function (e) {
    if (e.target === browseBtn || browseBtn.contains(e.target)) return;
    fileInput.click();
  });

  browseBtn.addEventListener('click', function () { fileInput.click(); });

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length) { addFiles(fileInput.files); fileInput.value = ''; }
  });

  dropzone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', function () { dropzone.classList.remove('dragover'); });

  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  /* ====== File Management ====== */

  function addFiles(fileList) {
    let added = 0;
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (f.size > MAX_FILE_SIZE) continue;
      let dup = false;
      for (let j = 0; j < selectedFiles.length; j++) {
        if (selectedFiles[j].file.name === f.name && selectedFiles[j].file.size === f.size) { dup = true; break; }
      }
      if (dup) continue;

      selectedFiles.push({
        file: f,
        thumbUrl: isImage(f) ? URL.createObjectURL(f) : '',
        id: generateId(),
        status: 'pending'
      });
      added++;
    }
    if (added > 0) {
      renderFileList();
      updateEstimate();
      hideSection(resultsSection);
      compressedResults = [];
    }
  }

  function removeFile(id) {
    for (let i = 0; i < selectedFiles.length; i++) {
      if (selectedFiles[i].id === id) {
        if (selectedFiles[i].thumbUrl) URL.revokeObjectURL(selectedFiles[i].thumbUrl);
        selectedFiles.splice(i, 1);
        break;
      }
    }
    renderFileList();
    updateEstimate();
  }

  function revokeResultThumbs() {
    for (let i = 0; i < compressedResults.length; i++) {
      if (compressedResults[i].thumbUrl && compressedResults[i].thumbUrl !== compressedResults[i].originalThumbUrl) {
        URL.revokeObjectURL(compressedResults[i].thumbUrl);
      }
    }
  }

  function clearAllFiles() {
    for (let i = 0; i < selectedFiles.length; i++) {
      if (selectedFiles[i].thumbUrl) URL.revokeObjectURL(selectedFiles[i].thumbUrl);
    }
    selectedFiles = [];
    revokeResultThumbs();
    compressedResults = [];
    renderFileList();
    updateEstimate();
    hideSection(resultsSection);
  }

  clearBtn.addEventListener('click', clearAllFiles);

  /* ====== Render File List ====== */

  function renderFileList() {
    if (selectedFiles.length === 0) {
      hideSection(fileListSection);
      hideSection(settingsSection);
      actionBtn.disabled = true;
      return;
    }

    showSection(fileListSection);
    showSection(settingsSection);
    actionBtn.disabled = false;

    let html = '';
    for (let i = 0; i < selectedFiles.length; i++) {
      let sf = selectedFiles[i];
      let thumbHtml;
      if (sf.thumbUrl) {
        thumbHtml = '<img class="compress-file-thumb" src="' + sf.thumbUrl + '" alt="">';
      } else {
        thumbHtml = '<div class="compress-file-thumb compress-file-thumb--icon">' + getFileIcon(sf.file) + '</div>';
      }

      let cat = getFileCategory(sf.file);
      const catLabel = cat === 'image' ? 'Image' : cat === 'pdf' ? 'PDF' : 'Other';

      let statusHtml = '';
      if (sf.status === 'processing') {
        statusHtml = '<span class="compress-file-status compress-file-status--processing"><span class="compress-file-status-spinner"></span> Processing</span>';
      } else if (sf.status === 'done') {
        statusHtml = '<span class="compress-file-status compress-file-status--done">✓ Done</span>';
      } else if (sf.status === 'skip') {
        statusHtml = '<span class="compress-file-status compress-file-status--skip">— Skipped</span>';
      }

      html += '<div class="compress-file-item" data-id="' + sf.id + '">'
            + thumbHtml
            + '<div class="compress-file-info">'
            + '<div class="compress-file-name">' + escapeHtml(sf.file.name) + '</div>'
            + '<div class="compress-file-size">' + formatSize(sf.file.size) + ' · ' + catLabel + '</div>'
            + '</div>'
            + statusHtml
            + '<button type="button" class="compress-file-remove" data-id="' + sf.id + '" title="Remove">&times;</button>'
            + '</div>';
    }
    fileItemsEl.innerHTML = html;

    const removeBtns = fileItemsEl.querySelectorAll('.compress-file-remove');
    for (let r = 0; r < removeBtns.length; r++) {
      removeBtns[r].addEventListener('click', function () {
        removeFile(this.getAttribute('data-id'));
      });
    }
  }

  function updateFileStatus(id, status) {
    for (let i = 0; i < selectedFiles.length; i++) {
      if (selectedFiles[i].id === id) {
        selectedFiles[i].status = status;
        break;
      }
    }
    // Update just the status badge in DOM (avoid full re-render during compression)
    const item = fileItemsEl.querySelector('[data-id="' + id + '"]');
    if (!item) return;
    const existing = item.querySelector('.compress-file-status');
    let newBadge;
    if (status === 'processing') {
      newBadge = '<span class="compress-file-status compress-file-status--processing"><span class="compress-file-status-spinner"></span> Processing</span>';
    } else if (status === 'done') {
      newBadge = '<span class="compress-file-status compress-file-status--done">✓ Done</span>';
    } else if (status === 'skip') {
      newBadge = '<span class="compress-file-status compress-file-status--skip">— Skipped</span>';
    } else {
      newBadge = '';
    }
    if (existing) existing.remove();
    const removeBtn = item.querySelector('.compress-file-remove');
    if (removeBtn && newBadge) {
      removeBtn.insertAdjacentHTML('beforebegin', newBadge);
    }
  }

  /* ====== Slider ====== */

  function sliderToColor(val) {
    let r, g, b;
    if (val <= 50) {
      const t = val / 50;
      r = Math.round(67 + t * (253 - 67));
      g = Math.round(160 + t * (216 - 160));
      b = Math.round(71 + t * (53 - 71));
    } else {
      const t2 = (val - 50) / 50;
      r = Math.round(253 + t2 * (198 - 253));
      g = Math.round(216 + t2 * (40 - 216));
      b = Math.round(53 + t2 * (40 - 53));
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  const sliderValueEl = document.getElementById('compress-slider-value');

  function updateSliderUI() {
    let val = parseInt(slider.value, 10);
    const level = getActiveLevel(val);
    sliderValueEl.textContent = 'Compression: ' + val + '%';
    slider.style.setProperty('--thumb-color', sliderToColor(val));
    for (let i = 0; i < sliderLabels.length; i++) {
      const pos = sliderLabels[i].getAttribute('data-pos');
      sliderLabels[i].classList.toggle('active', pos === level);
    }
    updateEstimate();
  }

  slider.addEventListener('input', updateSliderUI);

  for (let sl = 0; sl < sliderLabels.length; sl++) {
    sliderLabels[sl].addEventListener('click', function () {
      slider.value = SNAP_POINTS[this.getAttribute('data-pos')];
      updateSliderUI();
    });
  }

  updateSliderUI();

  /* ====== Estimation ====== */

  function updateEstimate() {
    if (selectedFiles.length === 0) {
      estimateText.innerHTML = 'Select files and a compression level to see the estimated output size.';
      return;
    }

    const val = parseInt(slider.value, 10);
    let total = getTotalSize();
    const range = getEstimateRange(val);
    let compressibleSize = 0, otherSize = 0;
    for (let i = 0; i < selectedFiles.length; i++) {
      let cat = getFileCategory(selectedFiles[i].file);
      if (cat === 'image' || cat === 'pdf') compressibleSize += selectedFiles[i].file.size;
      else otherSize += selectedFiles[i].file.size;
    }

    const estMin = compressibleSize * (1 - range[1]) + otherSize;
    const estMax = compressibleSize * (1 - range[0]) + otherSize;
    const label = getLevelLabel(val);

    const note = otherSize > 0
      ? '<br><span class="estimate-note">Note: non-image/PDF files will be kept as-is</span>'
      : '';

    estimateText.innerHTML =
      '<span class="estimate-original">Original: <strong>' + formatSize(total) + '</strong></span>'
      + ' &nbsp;&rarr;&nbsp; '
      + '<span class="estimate-result">' + formatSize(estMin) + ' – ' + formatSize(estMax) + '</span>'
      + '<br>'
      + '<span class="estimate-savings">' + label + ' &middot; ~' + Math.round(range[0] * 100) + '–' + Math.round(range[1] * 100) + '% savings (images & PDFs)</span>'
      + note;
  }

  resizeCheck.addEventListener('change', updateEstimate);
  resizeWidth.addEventListener('input', updateEstimate);

  /* ====== Image Compression Engine ====== */

  function drawToCanvas(img, w, h, fillWhiteBg) {
    let canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    let ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (fillWhiteBg) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, type, quality);
    });
  }

  function compressImage(file, sliderVal, userMaxWidth, preferredFormat) {
    return new Promise(function (resolve) {
      let quality = sliderToQuality(sliderVal);
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = function () {
        URL.revokeObjectURL(objectUrl);

        let w = img.naturalWidth;
        let h = img.naturalHeight;

        // User max width
        if (userMaxWidth && w > userMaxWidth) {
          h = Math.round(h * (userMaxWidth / w));
          w = userMaxWidth;
        }

        // Slider-based dimension cap
        const sliderMax = sliderToMaxDimension(sliderVal, w);
        if (sliderMax && w > sliderMax) {
          h = Math.round(h * (sliderMax / w));
          w = sliderMax;
        }

        // High compression extra scale-down
        if (sliderVal > 75) {
          let sf = 1.0 - ((sliderVal - 75) / 25) * 0.3;
          if (sf < 0.5) sf = 0.5;
          w = Math.round(w * sf);
          h = Math.round(h * sf);
        }

        if (w < 50) w = 50;
        if (h < 50) h = 50;

        const canvasWhite = drawToCanvas(img, w, h, true);
        const canvasTransparent = drawToCanvas(img, w, h, false);

        const promises = [];
        const formats = [];

        if (preferredFormat === 'auto' || !preferredFormat) {
          // Try all formats, pick smallest
          promises.push(canvasToBlob(canvasWhite, 'image/jpeg', quality));
          formats.push('image/jpeg');
          promises.push(canvasToBlob(canvasTransparent, 'image/webp', quality));
          formats.push('image/webp');

          const aggressiveQ = Math.max(quality - 0.15, 0.05);
          promises.push(canvasToBlob(canvasWhite, 'image/jpeg', aggressiveQ));
          formats.push('image/jpeg');
          promises.push(canvasToBlob(canvasTransparent, 'image/webp', aggressiveQ));
          formats.push('image/webp');

          if (w > 800 && sliderVal >= 30) {
            const sw = Math.round(w * 0.75);
            const sh = Math.round(h * 0.75);
            const canvasSmall = drawToCanvas(img, sw, sh, true);
            promises.push(canvasToBlob(canvasSmall, 'image/jpeg', quality));
            formats.push('image/jpeg');
          }
        } else if (preferredFormat === 'original') {
          // Re-encode in original format (still strips metadata via canvas)
          const origType = file.type || 'image/jpeg';
          const origCanvas = (origType === 'image/jpeg') ? canvasWhite : canvasTransparent;
          promises.push(canvasToBlob(origCanvas, origType, quality));
          formats.push(origType);
        } else {
          // Specific format chosen
          const useCanvas = (preferredFormat === 'image/jpeg') ? canvasWhite : canvasTransparent;
          promises.push(canvasToBlob(useCanvas, preferredFormat, quality));
          formats.push(preferredFormat);

          const agQ = Math.max(quality - 0.15, 0.05);
          promises.push(canvasToBlob(useCanvas, preferredFormat, agQ));
          formats.push(preferredFormat);
        }

        Promise.all(promises).then(function (blobs) {
          let bestBlob = null;
          let bestType = file.type;
          let bestSize = file.size;

          for (let i = 0; i < blobs.length; i++) {
            if (blobs[i] && blobs[i].size < bestSize) {
              bestBlob = blobs[i];
              bestType = formats[i];
              bestSize = blobs[i].size;
            }
          }

          if (bestBlob) {
            resolve({ blob: bestBlob, outputType: bestType });
          } else {
            resolve({ blob: file, outputType: file.type });
          }
        });
      };

      img.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        resolve({ blob: file, outputType: file.type });
      };

      img.src = objectUrl;
    });
  }

  /* ====== PDF Compression Engine ====== */

  function compressPdf(file, sliderVal) {
    const quality = sliderToQuality(sliderVal);

    return file.arrayBuffer().then(function (arrayBuf) {
      const uint8 = new Uint8Array(arrayBuf);

      return pdfjsLib.getDocument({ data: uint8 }).promise.then(function (pdfDoc) {
        const numPages = pdfDoc.numPages;
        const renderScale = sliderVal <= 33 ? 1.5 : sliderVal <= 66 ? 1.2 : 0.9;

        return PDFLib.PDFDocument.create().then(function (newPdf) {
          function processPage(pageNum) {
            return pdfDoc.getPage(pageNum).then(function (page) {
              const viewport = page.getViewport({ scale: renderScale });
              const canvas = document.createElement('canvas');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);

              return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
                return canvasToBlob(canvas, 'image/jpeg', quality);
              }).then(function (blob) {
                return blob.arrayBuffer();
              }).then(function (jpgBuf) {
                return newPdf.embedJpg(new Uint8Array(jpgBuf)).then(function (jpgImage) {
                  const origViewport = page.getViewport({ scale: 1.0 });
                  const pageW = origViewport.width * 0.75;
                  const pageH = origViewport.height * 0.75;
                  const newPage = newPdf.addPage([pageW, pageH]);
                  newPage.drawImage(jpgImage, { x: 0, y: 0, width: pageW, height: pageH });
                });
              });
            });
          }

          let chain = Promise.resolve();
          for (let p = 1; p <= numPages; p++) {
            (function (pageNum) {
              chain = chain.then(function () { return processPage(pageNum); });
            })(p);
          }

          return chain.then(function () { return newPdf.save(); }).then(function (pdfBytes) {
            const newBlob = new Blob([pdfBytes], { type: 'application/pdf' });
            return newBlob.size < file.size
              ? { blob: newBlob, outputType: 'application/pdf' }
              : { blob: file, outputType: 'application/pdf' };
          });
        });
      });
    }).catch(function () {
      return { blob: file, outputType: file.type };
    });
  }

  /* ====== Compress Action ====== */

  actionBtn.addEventListener('click', function () {
    if (selectedFiles.length === 0) return;

    const sliderVal = parseInt(slider.value, 10);
    let userMaxWidth = null;
    if (resizeCheck.checked) {
      const w = parseInt(resizeWidth.value, 10);
      if (w && w >= 100) userMaxWidth = w;
    }
    const preferredFormat = formatSelect.value;

    const labelEl = actionBtn.querySelector('.compress-action-label');
    const spinnerEl = actionBtn.querySelector('.compress-action-spinner');
    labelEl.textContent = 'Compressing...';
    spinnerEl.classList.remove('display-hidden');
    actionBtn.disabled = true;

    revokeResultThumbs();
    compressedResults = [];
    const total = selectedFiles.length;
    let completed = 0;

    // Reset all statuses
    for (let r = 0; r < selectedFiles.length; r++) {
      selectedFiles[r].status = 'pending';
    }
    renderFileList();

    // Process files sequentially to show per-file progress
    const queue = selectedFiles.slice();
    let idx = 0;

    function processNext() {
      if (idx >= queue.length) {
        labelEl.textContent = 'Compress Files';
        spinnerEl.classList.add('display-hidden');
        actionBtn.disabled = false;
        renderResults();
        return;
      }

      const sf = queue[idx];
      const cat = getFileCategory(sf.file);

      updateFileStatus(sf.id, 'processing');

      let compressionPromise;
      if (cat === 'image') {
        compressionPromise = compressImage(sf.file, sliderVal, userMaxWidth, preferredFormat);
      } else if (cat === 'pdf') {
        compressionPromise = compressPdf(sf.file, sliderVal);
      } else {
        compressionPromise = Promise.resolve({ blob: sf.file, outputType: sf.file.type });
      }

      compressionPromise.then(function (result) {
        let name = sf.file.name;
        const outputType = result.outputType;

        // Update extension if image format changed
        if (cat === 'image' && outputType !== sf.file.type) {
          const newExt = getExtFromType(outputType);
          let dotIdx = name.lastIndexOf('.');
          if (dotIdx > 0 && newExt) name = name.substring(0, dotIdx) + newExt;
        }

        let thumbUrl = '';
        if (isImage(sf.file) && result.blob !== sf.file) {
          thumbUrl = URL.createObjectURL(result.blob);
        } else if (sf.thumbUrl) {
          thumbUrl = sf.thumbUrl;
        }

        compressedResults.push({
          name: name,
          originalSize: sf.file.size,
          blob: result.blob,
          thumbUrl: thumbUrl,
          category: cat,
          originalThumbUrl: sf.thumbUrl || '',
          outputFormat: outputType
        });

        updateFileStatus(sf.id, cat === 'other' ? 'skip' : 'done');

        // Update button text with progress
        completed++;
        labelEl.textContent = 'Compressing... (' + completed + '/' + total + ')';

        idx++;
        processNext();
      }).catch(function (err) {
        // Keep original file on error
        compressedResults.push({
          name: sf.file.name,
          originalSize: sf.file.size,
          blob: sf.file,
          thumbUrl: sf.thumbUrl || '',
          category: cat,
          originalThumbUrl: sf.thumbUrl || '',
          outputFormat: sf.file.type
        });
        updateFileStatus(sf.id, 'skip');
        completed++;
        labelEl.textContent = 'Compressing... (' + completed + '/' + total + ')';
        idx++;
        processNext();
      });
    }

    processNext();
  });

  /* ====== Results Rendering ====== */

  function renderResults() {
    if (compressedResults.length === 0) {
      hideSection(resultsSection);
      return;
    }

    showSection(resultsSection);

    let totalOriginal = 0;
    let totalCompressed = 0;

    let html = '';
    for (let i = 0; i < compressedResults.length; i++) {
      let r = compressedResults[i];
      totalOriginal += r.originalSize;
      totalCompressed += r.blob.size;

      let saved = r.originalSize > 0 ? Math.round((1 - r.blob.size / r.originalSize) * 100) : 0;
      if (saved < 0) saved = 0;

      // Thumb
      let thumbHtml;
      if (r.thumbUrl) {
        thumbHtml = '<img class="compress-result-thumb" src="' + r.thumbUrl + '" alt="">';
      } else {
        thumbHtml = '<div class="compress-result-thumb compress-result-thumb--icon">' + getFileIcon({ name: r.name, type: r.blob.type }) + '</div>';
      }

      // Format badge with "best" indicator for auto mode
      let formatBadge = '';
      if (r.category === 'image') {
        const ext = getExtFromType(r.outputFormat).replace('.', '') || '?';
        const isBest = (formatSelect.value === 'auto');
        formatBadge = '<span class="compress-result-format ' + (isBest ? 'compress-result-format--best' : 'compress-result-format--other') + '">'
          + (isBest ? '✓ ' : '') + ext + '</span> ';
      }

      // Status
      let statusClass = '';
      let statusText = '-' + saved + '%';
      if (r.category === 'other') {
        statusClass = ' compress-result-percent--skip';
        statusText = 'skipped';
      } else if (saved === 0) {
        statusClass = ' compress-result-percent--same';
        statusText = 'same size';
      }

      // Compare button for images
      let compareBtn = '';
      if (r.category === 'image' && r.originalThumbUrl && r.thumbUrl && r.blob.size < r.originalSize) {
        compareBtn = '<button type="button" class="compress-result-compare" data-idx="' + i + '" title="Compare before/after">👁</button>';
      }

      html += '<div class="compress-result-item">'
            + thumbHtml
            + '<div class="compress-result-info">'
            + '<div class="compress-result-name">' + formatBadge + escapeHtml(r.name) + '</div>'
            + '<div class="compress-result-sizes">'
            + '<span class="compress-result-original">' + formatSize(r.originalSize) + '</span>'
            + '<span class="compress-result-arrow">&rarr;</span>'
            + '<span class="compress-result-new">' + formatSize(r.blob.size) + '</span>'
            + '<span class="compress-result-percent' + statusClass + '">' + statusText + '</span>'
            + '</div>'
            + '</div>'
            + compareBtn
            + '<button type="button" class="compress-result-download" data-idx="' + i + '" title="Download">&#8595;</button>'
            + '</div>';
    }

    resultsItems.innerHTML = html;

    let totalSaved = totalOriginal > 0 ? Math.round((1 - totalCompressed / totalOriginal) * 100) : 0;
    if (totalSaved < 0) totalSaved = 0;

    resultsSummary.innerHTML =
      '&#10003; Processed <strong>' + compressedResults.length + ' file' + (compressedResults.length > 1 ? 's' : '') + '</strong> &mdash; '
      + '<span class="summary-saved">' + formatSize(totalOriginal - totalCompressed) + ' saved (' + totalSaved + '% reduction)</span>';

    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Download buttons
    const dlBtns = resultsItems.querySelectorAll('.compress-result-download');
    for (let d = 0; d < dlBtns.length; d++) {
      dlBtns[d].addEventListener('click', function () {
        downloadFile(compressedResults[parseInt(this.getAttribute('data-idx'), 10)]);
      });
    }

    // Compare buttons
    const cmpBtns = resultsItems.querySelectorAll('.compress-result-compare');
    for (let c = 0; c < cmpBtns.length; c++) {
      cmpBtns[c].addEventListener('click', function () {
        openCompare(parseInt(this.getAttribute('data-idx'), 10));
      });
    }
  }

  /* ====== Before/After Comparison ====== */

  function openCompare(idx) {
    let r = compressedResults[idx];
    if (!r || !r.originalThumbUrl || !r.thumbUrl) return;

    compareBeforeImg.src = r.originalThumbUrl;
    compareAfterImg.src = r.thumbUrl;
    compareTitle.textContent = r.name + ' — Before / After';

    const saved = r.originalSize > 0 ? Math.round((1 - r.blob.size / r.originalSize) * 100) : 0;
    compareInfo.innerHTML =
      '<strong>Original:</strong> ' + formatSize(r.originalSize)
      + ' &nbsp;&rarr;&nbsp; <strong>Compressed:</strong> ' + formatSize(r.blob.size)
      + ' &nbsp;(' + saved + '% smaller)';

    compareSlider.value = 50;
    updateComparePosition(50);
    compareOverlay.classList.remove('display-hidden');
  }

  function updateComparePosition(val) {
    const pct = val + '%';
    compareBefore.style.clipPath = 'inset(0 ' + (100 - val) + '% 0 0)';
    compareDivider.style.left = pct;
  }

  compareSlider.addEventListener('input', function () {
    updateComparePosition(parseInt(this.value, 10));
  });

  compareClose.addEventListener('click', function () {
    compareOverlay.classList.add('display-hidden');
  });

  compareOverlay.addEventListener('click', function (e) {
    if (e.target === compareOverlay) compareOverlay.classList.add('display-hidden');
  });

  // Escape key closes modal
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !compareOverlay.classList.contains('display-hidden')) {
      compareOverlay.classList.add('display-hidden');
    }
  });

  /* ====== Download ====== */

  function downloadFile(result) {
    let url = URL.createObjectURL(result.blob);
    let a = document.createElement('a');
    a.href = url;
    let dotIdx = result.name.lastIndexOf('.');
    if (dotIdx > 0) {
      a.download = result.name.substring(0, dotIdx) + '_compressed' + result.name.substring(dotIdx);
    } else {
      a.download = result.name + '_compressed';
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }

  /* ====== Batch Download as ZIP ====== */

  downloadAllBtn.addEventListener('click', function () {
    if (compressedResults.length === 0) return;

    // Single file — just download directly
    if (compressedResults.length === 1) {
      downloadFile(compressedResults[0]);
      return;
    }

    // Use JSZip if available
    if (typeof JSZip !== 'undefined') {
      downloadAllBtn.disabled = true;
      downloadAllBtn.textContent = 'Creating ZIP...';

      const zip = new JSZip();
      for (let i = 0; i < compressedResults.length; i++) {
        const r = compressedResults[i];
        let name = r.name;
        const dotIdx = name.lastIndexOf('.');
        if (dotIdx > 0) {
          name = name.substring(0, dotIdx) + '_compressed' + name.substring(dotIdx);
        } else {
          name = name + '_compressed';
        }
        zip.file(name, r.blob);
      }

      zip.generateAsync({ type: 'blob' }).then(function (zipBlob) {
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'compressed_files.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
        downloadAllBtn.disabled = false;
        downloadAllBtn.textContent = 'Download All (ZIP)';
      });
    } else {
      // Fallback: sequential individual downloads
      for (let j = 0; j < compressedResults.length; j++) {
        (function (idx) {
          setTimeout(function () { downloadFile(compressedResults[idx]); }, idx * 300);
        })(j);
      }
    }
  });

})();
