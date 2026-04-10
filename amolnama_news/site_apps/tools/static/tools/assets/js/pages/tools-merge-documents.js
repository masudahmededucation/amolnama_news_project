/* ========== Merge Documents Tool ========== */
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}
(function () {
  'use strict';

  /* ---- Smooth show / hide helpers ---- */
  function showSection(el) {
    el.hidden = false;
    el.classList.remove('tool-section-reveal');
    void el.offsetWidth;
    el.classList.add('tool-section-reveal');
  }
  function hideSection(el) {
    el.hidden = true;
    el.classList.remove('tool-section-reveal');
  }

  /* ---- DOM refs ---- */
  const dropzone      = document.getElementById('mgr-dropzone');
  const fileInput      = document.getElementById('mgr-file-input');
  const browseBtn      = document.getElementById('mgr-browse-button');
  const errorSection   = document.getElementById('mgr-error');
  const errorText      = document.getElementById('mgr-error-text');
  const tryAgainBtn    = document.getElementById('mgr-try-again-button');
  const workspace      = document.getElementById('mgr-workspace');
  const fileGrid       = document.getElementById('mgr-file-grid');
  const fileCountSpan  = document.getElementById('mgr-file-count');
  const totalSizeSpan  = document.getElementById('mgr-total-size');
  const sortAzBtn      = document.getElementById('mgr-sort-az');
  const sortZaBtn      = document.getElementById('mgr-sort-za');
  const addMoreBtn     = document.getElementById('mgr-add-more-button');
  const outputNameInput = document.getElementById('mgr-output-name');
  const mergeBtn       = document.getElementById('mgr-merge-button');
  const resetBtn       = document.getElementById('mgr-reset-button');
  const progressSection = document.getElementById('mgr-progress');
  const progressFill   = document.getElementById('mgr-progress-fill');
  const progressText   = document.getElementById('mgr-progress-text');
  const resultSection  = document.getElementById('mgr-result');
  const resultPages    = document.getElementById('mgr-result-pages');
  const resultSize     = document.getElementById('mgr-result-size');
  const downloadBtn    = document.getElementById('mgr-download-button');

  /* ---- Constants ---- */
  const MAX_FILES = 20;
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB per file
  const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

  /* ---- State ---- */
  let fileEntries = [];  // { id, file, name, size, type, thumbUrl, pageCount }
  let nextId = 1;
  let mergedBlob = null;
  let merging = false;

  /* ---- Helpers ---- */
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function isPdf(file) {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }

  function isImage(file) {
    return file.type.startsWith('image/');
  }

  function showError(msg) {
    errorText.textContent = msg;
    showSection(errorSection);
  }

  function clearError() {
    hideSection(errorSection);
  }

  /* ---- Update stats display ---- */
  function updateStats() {
    const count = fileEntries.length;
    let totalBytes = 0;
    for (let i = 0; i < count; i++) totalBytes += fileEntries[i].size;
    fileCountSpan.textContent = count + ' ফাইল (' + count + ' files)';
    totalSizeSpan.textContent = formatSize(totalBytes);
    mergeBtn.disabled = count === 0;
  }

  /* ---- Update order badges ---- */
  function updateOrderBadges() {
    let cards = fileGrid.querySelectorAll('.mgr-file-card');
    cards.forEach(function (card, index) {
      let badge = card.querySelector('.mgr-file-order');
      if (badge) badge.textContent = index + 1;
    });
  }

  /* ---- Generate thumbnail for a file ---- */
  function generateThumb(entry) {
    return new Promise(function (resolve) {
      if (isImage(entry.file)) {
        let url = URL.createObjectURL(entry.file);
        entry.thumbUrl = url;
        entry.pageCount = 1;
        resolve();
      } else if (isPdf(entry.file)) {
        let reader = new FileReader();
        reader.onload = function (e) {
          const data = new Uint8Array(e.target.result);
          pdfjsLib.getDocument({ data: data }).promise.then(function (pdf) {
            entry.pageCount = pdf.numPages;
            return pdf.getPage(1);
          }).then(function (page) {
            const viewport = page.getViewport({ scale: 0.5 });
            let canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            let ctx = canvas.getContext('2d');
            return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
              entry.thumbUrl = canvas.toDataURL('image/jpeg', 0.6);
              resolve();
            });
          }).catch(function () {
            entry.thumbUrl = null;
            entry.pageCount = entry.pageCount || 0;
            resolve();
          });
        };
        reader.onerror = function () { resolve(); };
        reader.readAsArrayBuffer(entry.file);
      } else {
        resolve();
      }
    });
  }

  /* ---- Create a file card DOM element ---- */
  function createFileCard(entry, index) {
    let card = document.createElement('div');
    card.className = 'mgr-file-card';
    card.setAttribute('draggable', 'true');
    card.dataset.id = entry.id;

    /* Order badge */
    const badge = document.createElement('span');
    badge.className = 'mgr-file-order';
    badge.textContent = index + 1;
    card.appendChild(badge);

    /* Remove button */
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'mgr-file-remove';
    removeBtn.textContent = '\u00D7';
    removeBtn.title = 'সরান (Remove)';
    removeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      removeFile(entry.id);
    });
    card.appendChild(removeBtn);

    /* Thumbnail */
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'mgr-file-thumb';

    if (entry.thumbUrl) {
      let img = document.createElement('img');
      img.src = entry.thumbUrl;
      img.alt = entry.name;
      thumbWrap.appendChild(img);
    } else {
      const icon = document.createElement('span');
      icon.className = 'mgr-file-thumb-icon';
      icon.textContent = isPdf(entry.file) ? '📄' : '🖼️';
      thumbWrap.appendChild(icon);
    }
    card.appendChild(thumbWrap);

    /* Name */
    const nameEl = document.createElement('div');
    nameEl.className = 'mgr-file-name';
    nameEl.textContent = entry.name;
    nameEl.title = entry.name;
    card.appendChild(nameEl);

    /* Meta */
    const meta = document.createElement('div');
    meta.className = 'mgr-file-meta';
    const parts = [formatSize(entry.size)];
    if (isPdf(entry.file) && entry.pageCount > 0) {
      parts.push(entry.pageCount + ' পৃষ্ঠা');
    }
    meta.textContent = parts.join(' · ');
    card.appendChild(meta);

    return card;
  }

  /* ---- Render the file grid ---- */
  function renderGrid() {
    fileGrid.innerHTML = '';
    for (let i = 0; i < fileEntries.length; i++) {
      let card = createFileCard(fileEntries[i], i);
      fileGrid.appendChild(card);
    }
    updateStats();
    setupDragAndDrop();
  }

  /* ---- Add files ---- */
  function addFiles(files) {
    clearError();
    const validFiles = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];

      /* Validate type */
      if (!isPdf(f) && !isImage(f)) {
        showError(f.name + ' — এই ফরম্যাট সমর্থিত নয়। শুধুমাত্র PDF ও ছবি গ্রহণযোগ্য। (Unsupported format. Only PDF and images accepted.)');
        continue;
      }

      /* Validate size */
      if (f.size > MAX_FILE_SIZE) {
        showError(f.name + ' — ফাইল ৫০ MB এর বেশি (File exceeds 50 MB limit)');
        continue;
      }

      /* Check limit */
      if (fileEntries.length + validFiles.length >= MAX_FILES) {
        showError('সর্বোচ্চ ' + MAX_FILES + ' ফাইল যোগ করা যাবে (Maximum ' + MAX_FILES + ' files allowed)');
        break;
      }

      validFiles.push(f);
    }

    if (validFiles.length === 0) return;

    /* Show workspace if hidden */
    if (workspace.hidden) {
      showSection(workspace);
    }

    /* Create entries and generate thumbnails */
    const newEntries = [];
    for (let j = 0; j < validFiles.length; j++) {
      const entry = {
        id: nextId++,
        file: validFiles[j],
        name: validFiles[j].name,
        size: validFiles[j].size,
        type: validFiles[j].type,
        thumbUrl: null,
        pageCount: 0
      };
      newEntries.push(entry);
      fileEntries.push(entry);
    }

    /* Render immediately with placeholder thumbs, then update */
    renderGrid();

    /* Generate thumbs async */
    const thumbPromises = newEntries.map(function (entry) {
      return generateThumb(entry);
    });

    Promise.all(thumbPromises).then(function () {
      renderGrid();
    });

    /* Clear merged result */
    hideMergedResult();
  }

  /* ---- Remove a file ---- */
  function removeFile(id) {
    for (let i = 0; i < fileEntries.length; i++) {
      if (fileEntries[i].id === id) {
        if (fileEntries[i].thumbUrl && isImage(fileEntries[i].file)) {
          URL.revokeObjectURL(fileEntries[i].thumbUrl);
        }
        break;
      }
    }
    fileEntries = fileEntries.filter(function (e) { return e.id !== id; });
    renderGrid();

    if (fileEntries.length === 0) {
      hideSection(workspace);
    }

    hideMergedResult();
  }

  /* ---- Sort files ---- */
  function sortFiles(order) {
    fileEntries.sort(function (a, b) {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      if (order === 'az') return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
      return nameA > nameB ? -1 : nameA < nameB ? 1 : 0;
    });
    renderGrid();
    hideMergedResult();
  }

  /* ---- Drag-and-drop reorder with placeholder ---- */
  let dragSrcId = null;
  let placeholder = null;
  let dropInsertIdx = -1; /* The index in fileEntries where the item will be inserted */

  function createPlaceholder() {
    const el = document.createElement('div');
    el.className = 'mgr-drop-placeholder';
    const txt = document.createElement('span');
    txt.className = 'mgr-drop-placeholder-text';
    txt.textContent = 'এখানে ছাড়ুন (Drop here)';
    el.appendChild(txt);
    return el;
  }

  function removePlaceholder() {
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }
    placeholder = null;
    dropInsertIdx = -1;
  }

  /**
   * Find the insertion index among cards based on cursor position.
   * Uses a simple row-aware scan: iterate cards in DOM order, skip the
   * dragged card, and find the first card the cursor is "before" in
   * reading order (left-to-right, top-to-bottom).
   *
   * IMPORTANT: The placeholder must be removed from the DOM before
   * calling this so that card positions are not shifted.
   */
  function findInsertPosition(clientX, clientY) {
    let cards = fileGrid.querySelectorAll('.mgr-file-card');
    if (cards.length === 0) return 0;

    for (let i = 0; i < cards.length; i++) {
      /* Skip the card being dragged — it's faded but still in flow */
      if (parseInt(cards[i].dataset.id, 10) === dragSrcId) continue;

      const rect = cards[i].getBoundingClientRect();

      /* Cursor is above this card entirely → insert before it */
      if (clientY < rect.top) return i;

      /* Cursor is in the same row (overlaps vertically) and left of center → before */
      if (clientY <= rect.bottom && clientX < rect.left + rect.width / 2) return i;
    }

    /* Cursor is past all cards → append at end */
    return cards.length;
  }

  /**
   * Convert a DOM child index (accounting for the placeholder) to a fileEntries index.
   * Counts only real cards (.mgr-file-card) before the given position.
   */
  function domIdxToEntryIdx(domIdx) {
    const children = fileGrid.children;
    let entryIdx = 0;
    for (let i = 0; i < children.length && i < domIdx; i++) {
      if (children[i].classList.contains('mgr-file-card')) entryIdx++;
    }
    return entryIdx;
  }

  function updatePlaceholder(clientX, clientY) {
    /* Step 1: Remove placeholder so card positions are accurate */
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }

    let cards = fileGrid.querySelectorAll('.mgr-file-card');
    if (cards.length === 0) return;

    /* Step 2: Compute insertion index against clean (un-shifted) layout */
    const domIdx = findInsertPosition(clientX, clientY);

    /* Step 3: Insert placeholder at computed position */
    if (!placeholder) placeholder = createPlaceholder();

    const allChildren = fileGrid.children;
    if (domIdx >= allChildren.length) {
      fileGrid.appendChild(placeholder);
    } else {
      fileGrid.insertBefore(placeholder, allChildren[domIdx]);
    }

    /* Step 4: Derive the entry-array index for the drop */
    dropInsertIdx = domIdxToEntryIdx(
      Array.prototype.indexOf.call(fileGrid.children, placeholder)
    );
  }

  function executeDrop() {
    if (dragSrcId === null || dropInsertIdx === -1) {
      removePlaceholder();
      return;
    }

    let srcIdx = -1;
    for (let i = 0; i < fileEntries.length; i++) {
      if (fileEntries[i].id === dragSrcId) { srcIdx = i; break; }
    }
    if (srcIdx === -1) { removePlaceholder(); return; }

    let destIdx = dropInsertIdx;
    /* If dragging from before the destination, adjust because removing shifts indices */
    if (srcIdx < destIdx) destIdx--;

    if (srcIdx !== destIdx) {
      const moved = fileEntries.splice(srcIdx, 1)[0];
      fileEntries.splice(destIdx, 0, moved);
    }

    removePlaceholder();
    renderGrid();
    hideMergedResult();
  }

  function setupDragAndDrop() {
    const cards = fileGrid.querySelectorAll('.mgr-file-card');

    cards.forEach(function (card) {
      card.addEventListener('dragstart', function (e) {
        dragSrcId = parseInt(card.dataset.id, 10);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.id);

        /* Create a compact ghost image */
        const ghost = card.cloneNode(true);
        ghost.style.width = card.offsetWidth + 'px';
        ghost.style.opacity = '0.8';
        ghost.style.transform = 'scale(0.85)';
        ghost.style.position = 'absolute';
        ghost.style.top = '-9999px';
        ghost.style.left = '-9999px';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, card.offsetWidth / 2, 30);
        setTimeout(function () { document.body.removeChild(ghost); }, 0);

        /* Fade source card into dashed outline */
        setTimeout(function () { card.classList.add('mgr-dragging'); }, 0);
      });

      card.addEventListener('dragend', function () {
        card.classList.remove('mgr-dragging');
        dragSrcId = null;
        removePlaceholder();
      });
    });
  }

  /* Grid-level dragover — calculates nearest slot and shows placeholder */
  fileGrid.addEventListener('dragover', function (e) {
    if (dragSrcId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    updatePlaceholder(e.clientX, e.clientY);
  });

  /* Grid-level drop — execute the reorder */
  fileGrid.addEventListener('drop', function (e) {
    if (dragSrcId === null) return;
    e.preventDefault();
    e.stopPropagation();
    executeDrop();
  });

  /* ---- Touch drag reorder for mobile ---- */
  let touchDragEntry = null;
  let touchSrcCard = null;
  let touchStartY = 0;
  let touchStartX = 0;
  let touchMoved = false;

  fileGrid.addEventListener('touchstart', function (e) {
    const card = e.target.closest('.mgr-file-card');
    if (!card || e.target.closest('.mgr-file-remove')) return;

    touchDragEntry = parseInt(card.dataset.id, 10);
    touchSrcCard = card;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchMoved = false;
  }, { passive: true });

  fileGrid.addEventListener('touchmove', function (e) {
    if (touchDragEntry === null) return;

    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (!touchMoved && Math.abs(dx) < 10 && Math.abs(dy) < 10) return;

    if (!touchMoved) {
      touchMoved = true;
      dragSrcId = touchDragEntry; /* Reuse drag state for placeholder logic */
      touchSrcCard.classList.add('mgr-dragging');
    }
    e.preventDefault();

    /* Show placeholder at nearest slot */
    updatePlaceholder(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  fileGrid.addEventListener('touchend', function () {
    if (touchDragEntry === null || !touchMoved) {
      touchDragEntry = null;
      touchSrcCard = null;
      return;
    }

    if (touchSrcCard) touchSrcCard.classList.remove('mgr-dragging');

    /* Execute the drop using the same logic as desktop */
    executeDrop();
    dragSrcId = null;
    touchDragEntry = null;
    touchSrcCard = null;
  }, { passive: true });

  /* ---- Merge ---- */
  function doMerge() {
    if (merging || fileEntries.length === 0) return;

    merging = true;
    mergeBtn.disabled = true;
    hideSection(resultSection);
    showSection(progressSection);
    progressFill.style.width = '0%';
    progressText.textContent = 'মার্জ শুরু হচ্ছে… (Starting merge…)';

    const PDFDocument = PDFLib.PDFDocument;
    const total = fileEntries.length;
    let totalPages = 0;

    PDFDocument.create().then(function (mergedPdf) {
      let chain = Promise.resolve();

      fileEntries.forEach(function (entry, index) {
        chain = chain.then(function () {
          const pct = Math.round(((index + 1) / total) * 90);
          progressFill.style.width = pct + '%';
          progressText.textContent = (index + 1) + '/' + total + ' প্রসেস হচ্ছে… (Processing ' + (index + 1) + '/' + total + '…)';

          return readFileAsArrayBuffer(entry.file).then(function (arrayBuf) {
            if (isPdf(entry.file)) {
              return PDFLib.PDFDocument.load(arrayBuf, { ignoreEncryption: true }).then(function (srcPdf) {
                const pageIndices = [];
                for (let p = 0; p < srcPdf.getPageCount(); p++) pageIndices.push(p);
                totalPages += srcPdf.getPageCount();
                return mergedPdf.copyPages(srcPdf, pageIndices);
              }).then(function (copiedPages) {
                copiedPages.forEach(function (page) { mergedPdf.addPage(page); });
              });
            } else {
              /* Image — embed as a full page */
              const bytes = new Uint8Array(arrayBuf);
              let embedPromise;

              if (entry.file.type === 'image/png') {
                /* Try PNG embed, fall back to canvas conversion if file is mislabeled */
                embedPromise = mergedPdf.embedPng(bytes).catch(function () {
                  return convertImageToJpgBytes(entry.file).then(function (jpgBytes) {
                    return mergedPdf.embedJpg(jpgBytes);
                  });
                });
              } else {
                /* JPG, WebP, or unknown — convert to JPG via canvas for pdf-lib compatibility */
                embedPromise = convertImageToJpgBytes(entry.file).then(function (jpgBytes) {
                  return mergedPdf.embedJpg(jpgBytes);
                });
              }

              return embedPromise.then(function (image) {
                const dims = image.scaleToFit(595.28, 841.89); /* A4 */
                const page = mergedPdf.addPage([595.28, 841.89]);
                page.drawImage(image, {
                  x: (595.28 - dims.width) / 2,
                  y: (841.89 - dims.height) / 2,
                  width: dims.width,
                  height: dims.height
                });
                totalPages += 1;
              });
            }
          });
        });
      });

      return chain.then(function () {
        progressFill.style.width = '95%';
        progressText.textContent = 'PDF তৈরি হচ্ছে… (Building PDF…)';
        return mergedPdf.save();
      });
    }).then(function (pdfBytes) {
      mergedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      progressFill.style.width = '100%';

      setTimeout(function () {
        hideSection(progressSection);
        resultPages.textContent = totalPages + ' পৃষ্ঠা (' + totalPages + ' pages)';
        resultSize.textContent = formatSize(mergedBlob.size);
        showSection(resultSection);
        merging = false;
        mergeBtn.disabled = false;
      }, 300);
    }).catch(function (err) {
      hideSection(progressSection);
      showError('মার্জ করতে সমস্যা হয়েছে: ' + (err.message || 'Unknown error') + ' (Merge failed)');
      merging = false;
      mergeBtn.disabled = false;
    });
  }

  function readFileAsArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      let reader = new FileReader();
      reader.onload = function (e) { resolve(e.target.result); };
      reader.onerror = function () { reject(new Error('Failed to read file')); };
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Convert any image to JPG bytes via canvas.
   * Needed because pdf-lib only supports PNG and JPG natively,
   * and WebP must be converted first.
   */
  function convertImageToJpgBytes(file) {
    return new Promise(function (resolve, reject) {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(function (blob) {
          if (!blob) { reject(new Error('Canvas conversion failed')); return; }
          const reader = new FileReader();
          reader.onload = function (e) { resolve(new Uint8Array(e.target.result)); };
          reader.onerror = function () { reject(new Error('Failed to read blob')); };
          reader.readAsArrayBuffer(blob);
        }, 'image/jpeg', 0.92);
      };
      img.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };
      img.src = objectUrl;
    });
  }

  /* ---- Download merged PDF ---- */
  function downloadMerged() {
    if (!mergedBlob) return;
    const name = (outputNameInput.value.trim() || 'merged-document') + '.pdf';
    const url = URL.createObjectURL(mergedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  /* ---- Hide merged result ---- */
  function hideMergedResult() {
    hideSection(resultSection);
    hideSection(progressSection);
    mergedBlob = null;
  }

  /* ---- Reset all ---- */
  function resetAll() {
    for (let i = 0; i < fileEntries.length; i++) {
      if (fileEntries[i].thumbUrl && isImage(fileEntries[i].file)) {
        URL.revokeObjectURL(fileEntries[i].thumbUrl);
      }
    }
    fileEntries = [];
    nextId = 1;
    mergedBlob = null;
    merging = false;
    fileGrid.innerHTML = '';
    hideSection(workspace);
    hideSection(errorSection);
    hideSection(resultSection);
    hideSection(progressSection);
    showSection(dropzone);
    fileInput.value = '';
    outputNameInput.value = 'merged-document';
  }

  /* ============================================================
     Event listeners
     ============================================================ */

  /* Dropzone */
  browseBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    fileInput.click();
  });
  dropzone.addEventListener('click', function (e) {
    if (e.target !== browseBtn) fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length) {
      addFiles(fileInput.files);
      fileInput.value = ''; /* Allow re-selecting same files */
    }
  });

  dropzone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', function () {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  /* Add more files */
  addMoreBtn.addEventListener('click', function () { fileInput.click(); });

  /* Sort */
  sortAzBtn.addEventListener('click', function () { sortFiles('az'); });
  sortZaBtn.addEventListener('click', function () { sortFiles('za'); });

  /* Merge */
  mergeBtn.addEventListener('click', doMerge);

  /* Download */
  downloadBtn.addEventListener('click', downloadMerged);

  /* Reset */
  resetBtn.addEventListener('click', resetAll);
  tryAgainBtn.addEventListener('click', resetAll);

  /* Also allow dropping files onto the workspace area (but not during card reorder) */
  workspace.addEventListener('dragover', function (e) {
    if (dragSrcId !== null) return; /* Skip during internal reorder */
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  workspace.addEventListener('dragleave', function () {
    dropzone.classList.remove('dragover');
  });
  workspace.addEventListener('drop', function (e) {
    if (dragSrcId !== null) return; /* Skip during internal reorder */
    if (e.dataTransfer.files.length > 0) {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      addFiles(e.dataTransfer.files);
    }
  });

})();
