/**
 * PDF Splitter Tool — পিডিএফ স্প্লিট
 *
 * Two modes:
 *   1. Split All  — all pages selected by default, each → its own PDF
 *   2. By Range   — user-defined ranges, each range → one PDF
 *
 * Pages are ALWAYS clickable to select/deselect regardless of mode.
 * Quick-select buttons (Odd/Even/All/None) always available.
 * Smart download: 1 result → direct PDF, 2+ → ZIP.
 * 100% client-side using pdf-lib + pdf.js + JSZip.
 */
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}
(function () {
  'use strict';

  /* ================================================================
     DOM REFERENCES
     ================================================================ */

  const dropzone      = document.getElementById('spl-dropzone');
  const fileInput     = document.getElementById('spl-file-input');
  const browseBtn     = document.getElementById('spl-browse-btn');
  const errorSection  = document.getElementById('spl-error');
  const errorText     = document.getElementById('spl-error-text');
  const tryAgainBtn   = document.getElementById('spl-try-again-btn');
  const workspace     = document.getElementById('spl-workspace');
  const fileNameEl    = document.getElementById('spl-file-name');
  const filePagesEl   = document.getElementById('spl-file-pages');
  const fileSizeEl    = document.getElementById('spl-file-size');
  const changeBtn     = document.getElementById('spl-change-btn');
  const pageGrid      = document.getElementById('spl-page-grid');
  const tabAll        = document.getElementById('spl-tab-all');     // Split All = Select All
  const tabRange      = document.getElementById('spl-tab-range');
  const panelRange    = document.getElementById('spl-panel-range');
  const pickCounter   = document.getElementById('spl-pick-counter');
  const pickOddBtn    = document.getElementById('spl-pick-odd');
  const pickEvenBtn   = document.getElementById('spl-pick-even');
  const pickNoneBtn   = document.getElementById('spl-pick-none');
  const rangeInput    = document.getElementById('spl-range-input');
  const rangeHint     = document.getElementById('spl-range-hint');
  const outputName    = document.getElementById('spl-output-name');
  const splitBtn      = document.getElementById('spl-split-btn');
  const resetBtn      = document.getElementById('spl-reset-btn');
  const progressEl    = document.getElementById('spl-progress');
  const progressFill  = document.getElementById('spl-progress-fill');
  const progressText  = document.getElementById('spl-progress-text');
  const resultEl      = document.getElementById('spl-result');
  const resultPages   = document.getElementById('spl-result-pages');
  const resultSize    = document.getElementById('spl-result-size');
  const downloadBtn   = document.getElementById('spl-download-btn');

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB
  const MODE_ALL   = 'all';
  const MODE_RANGE = 'range';

  /* ================================================================
     STATE
     ================================================================ */

  let pdfBytes      = null;   // Uint8Array of loaded PDF
  let totalPages    = 0;
  let splitResult   = null;   // { type: 'zip'|'pdf', blob, fileName }
  let splitting     = false;
  let currentMode   = MODE_ALL;
  let selectedPages = {};     // { 0: true, 2: true, ... }

  /* ================================================================
     HELPERS
     ================================================================ */

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function zeroPad(num, total) {
    let digits = String(total).length;
    if (digits < 4) digits = 4;
    let s = String(num);
    while (s.length < digits) s = '0' + s;
    return s;
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorSection.hidden = false;
    dropzone.hidden = true;
    workspace.hidden = true;
  }

  function clearError() {
    errorSection.hidden = true;
  }

  function hideResult() {
    resultEl.hidden = true;
    progressEl.hidden = true;
    splitResult = null;
  }

  function setProgress(pct, text) {
    progressEl.hidden = false;
    progressFill.style.width = pct + '%';
    if (text) progressText.textContent = text;
  }

  function getSelectedCount() {
    let count = 0;
    for (let key in selectedPages) {
      if (selectedPages[key]) count++;
    }
    return count;
  }

  function getSelectedIndices() {
    let indices = [];
    for (let i = 0; i < totalPages; i++) {
      if (selectedPages[i]) indices.push(i);
    }
    return indices;
  }

  /* ================================================================
     PAGE SELECTION — always active
     ================================================================ */

  const allToolbarBtns = [tabAll, pickOddBtn, pickEvenBtn, pickNoneBtn, tabRange];

  function setActiveToolbarBtn(btn) {
    for (let i = 0; i < allToolbarBtns.length; i++) {
      allToolbarBtns[i].classList.toggle('active', allToolbarBtns[i] === btn);
    }
  }

  function clearActiveToolbarBtn() {
    for (let i = 0; i < allToolbarBtns.length; i++) {
      allToolbarBtns[i].classList.remove('active');
    }
  }

  function updatePickCounter() {
    let count = getSelectedCount();
    if (count === 0) {
      pickCounter.textContent = 'কোনো পৃষ্ঠা নির্বাচিত নেই (No pages selected)';
      pickCounter.className = 'spl-pick-counter';
    } else {
      let label = count + 'টি পৃষ্ঠা নির্বাচিত (' + count + ' page' + (count > 1 ? 's' : '') + ' selected)';
      if (currentMode === MODE_ALL) {
        if (count === 1) {
          label += ' — সরাসরি PDF ডাউনলোড হবে';
        } else {
          label += ' — ZIP এ ডাউনলোড হবে';
        }
      }
      pickCounter.textContent = label;
      pickCounter.className = 'spl-pick-counter spl-pick-counter--active';
    }

    // Update split button state
    if (currentMode === MODE_ALL) {
      splitBtn.disabled = (count === 0);
    }
  }

  function updateCardVisuals() {
    let cards = pageGrid.querySelectorAll('.spl-page-card');
    for (let i = 0; i < cards.length; i++) {
      cards[i].classList.toggle('spl-selected', !!selectedPages[i]);
    }
  }

  // Auto-re-split after selection changes (debounced to avoid rapid re-triggers)
  let autoSplitTimer = null;
  function autoSplitAfterSelectionChange() {
    if (currentMode !== MODE_ALL) return;
    if (autoSplitTimer) clearTimeout(autoSplitTimer);
    const count = getSelectedCount();
    if (count === 0) {
      hideResult();
      return;
    }
    // Brief delay so rapid clicks don't cause multiple splits
    autoSplitTimer = setTimeout(function () { doSplit(); }, 300);
  }

  function togglePageSelection(index) {
    selectedPages[index] = !selectedPages[index];
    const cards = pageGrid.querySelectorAll('.spl-page-card');
    if (cards[index]) {
      cards[index].classList.toggle('spl-selected', !!selectedPages[index]);
    }
    clearActiveToolbarBtn();
    updatePickCounter();
    autoSplitAfterSelectionChange();
  }

  function setAllSelections(value) {
    for (let i = 0; i < totalPages; i++) {
      selectedPages[i] = value;
    }
    setActiveToolbarBtn(value ? tabAll : pickNoneBtn);
    updateCardVisuals();
    updatePickCounter();
    autoSplitAfterSelectionChange();
  }

  function selectOddPages() {
    for (let i = 0; i < totalPages; i++) {
      selectedPages[i] = ((i + 1) % 2 !== 0);
    }
    setActiveToolbarBtn(pickOddBtn);
    updateCardVisuals();
    updatePickCounter();
    autoSplitAfterSelectionChange();
  }

  function selectEvenPages() {
    for (let i = 0; i < totalPages; i++) {
      selectedPages[i] = ((i + 1) % 2 === 0);
    }
    setActiveToolbarBtn(pickEvenBtn);
    updateCardVisuals();
    updatePickCounter();
    autoSplitAfterSelectionChange();
  }

  /* ================================================================
     MODE SWITCHING
     ================================================================ */

  function switchMode(mode) {
    currentMode = mode;
    hideResult();

    // Range panel visibility
    panelRange.hidden = mode !== MODE_RANGE;

    // Toolbar button highlight
    if (mode === MODE_ALL) {
      setActiveToolbarBtn(tabAll);
      // Select all pages when switching to Split All
      for (let i = 0; i < totalPages; i++) selectedPages[i] = true;
      updateCardVisuals();
      updatePickCounter();
    } else {
      setActiveToolbarBtn(tabRange);
      validateRangeInput();
    }
  }

  /* ================================================================
     RANGE PARSING & VALIDATION
     ================================================================ */

  function parseRanges(str) {
    if (!str || !str.trim()) return null;

    const parts = str.split(',');
    let groups = [];

    for (let p = 0; p < parts.length; p++) {
      const part = parts[p].trim();
      if (!part) continue;

      let rangeParts = part.split('-');
      let group = [];

      if (rangeParts.length === 1) {
        const num = parseInt(rangeParts[0], 10);
        if (isNaN(num) || num < 1 || num > totalPages) return null;
        group.push(num - 1);
      } else if (rangeParts.length === 2) {
        let start = parseInt(rangeParts[0], 10);
        let end = parseInt(rangeParts[1], 10);
        if (isNaN(start) || isNaN(end)) return null;
        if (start < 1 || end < 1 || start > totalPages || end > totalPages) return null;
        if (start > end) { const tmp = start; start = end; end = tmp; }
        for (let j = start; j <= end; j++) {
          group.push(j - 1);
        }
      } else {
        return null;
      }

      if (group.length > 0) groups.push(group);
    }

    return groups.length > 0 ? groups : null;
  }

  function validateRangeInput() {
    const val = rangeInput.value.trim();
    if (!val) {
      rangeHint.textContent = '';
      rangeHint.className = 'spl-range-hint';
      splitBtn.disabled = true;
      return;
    }

    let groups = parseRanges(val);
    if (!groups) {
      rangeHint.textContent = '⚠ অবৈধ পরিসীমা — সঠিক ফরম্যাট: 1-3, 5, 8-10 (Invalid range)';
      rangeHint.className = 'spl-range-hint spl-range-hint--error';
      splitBtn.disabled = true;
      return;
    }

    let totalPagesInRanges = 0;
    for (let i = 0; i < groups.length; i++) totalPagesInRanges += groups[i].length;

    const desc = groups.length + 'টি PDF তৈরি হবে: ';
    const rangeParts = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (g.length === 1) {
        rangeParts.push('পৃষ্ঠা ' + (g[0] + 1));
      } else {
        rangeParts.push('পৃষ্ঠা ' + (g[0] + 1) + '-' + (g[g.length - 1] + 1));
      }
    }

    let hint = desc + rangeParts.join(', ');
    if (groups.length === 1 && totalPagesInRanges === 1) {
      hint += ' — সরাসরি PDF ডাউনলোড হবে';
    } else {
      hint += ' — ZIP এ ডাউনলোড হবে';
    }

    rangeHint.textContent = hint;
    rangeHint.className = 'spl-range-hint spl-range-hint--ok';
    splitBtn.disabled = false;
  }

  /* ================================================================
     LOAD PDF
     ================================================================ */

  function loadPdf(file) {
    if (!file || file.type !== 'application/pdf') {
      showError('শুধুমাত্র PDF ফাইল গ্রহণযোগ্য। (Only PDF files are accepted.)');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showError('ফাইল সাইজ ' + formatSize(file.size) + ' — সর্বোচ্চ ২০০ MB। (Max 200 MB.)');
      return;
    }

    clearError();
    dropzone.hidden = true;

    const reader = new FileReader();
    reader.onload = function () {
      pdfBytes = new Uint8Array(reader.result);

      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice() });
      loadingTask.promise.then(function (pdfDoc) {
        totalPages = pdfDoc.numPages;

        fileNameEl.textContent = file.name;
        filePagesEl.textContent = totalPages + ' পৃষ্ঠা';
        fileSizeEl.textContent = formatSize(file.size);
        outputName.value = file.name.replace(/\.pdf$/i, '');

        // Select all pages by default
        selectedPages = {};
        for (let i = 0; i < totalPages; i++) selectedPages[i] = true;

        buildPageGrid(pdfDoc);

        workspace.hidden = false;
        switchMode(MODE_ALL);
        setActiveToolbarBtn(tabAll);

        // Auto-split so download is immediately ready
        setTimeout(function () { doSplit(); }, 200);
      }).catch(function (err) {
        showError('PDF পড়া যাচ্ছে না — ফাইলটি ক্ষতিগ্রস্ত বা পাসওয়ার্ড-সুরক্ষিত হতে পারে। (' + (err.message || err) + ')');
      });
    };
    reader.onerror = function () {
      showError('ফাইল পড়া সম্ভব হয়নি। (Could not read file.)');
    };
    reader.readAsArrayBuffer(file);
  }

  /* ================================================================
     PAGE GRID — always selectable thumbnails
     ================================================================ */

  function buildPageGrid(pdfDoc) {
    pageGrid.innerHTML = '';

    let pageIdx = 0;

    function renderNext() {
      if (pageIdx >= totalPages) return;
      let i = pageIdx;
      pageIdx++;

      let card = createPageCard(i);
      pageGrid.appendChild(card);

      pdfDoc.getPage(i + 1).then(function (page) {
        const scale = 0.4;
        const viewport = page.getViewport({ scale: scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
          const thumbContainer = card.querySelector('.spl-page-thumb');
          thumbContainer.innerHTML = '';
          thumbContainer.appendChild(canvas);
        });
      });

      requestAnimationFrame(renderNext);
    }

    requestAnimationFrame(renderNext);
  }

  function createPageCard(index) {
    const card = document.createElement('div');
    card.className = 'spl-page-card spl-selectable';
    if (selectedPages[index]) card.classList.add('spl-selected');
    card.setAttribute('data-page-index', index);

    const numBadge = document.createElement('span');
    numBadge.className = 'spl-page-num';
    numBadge.textContent = index + 1;
    card.appendChild(numBadge);

    // Check circle
    const check = document.createElement('span');
    check.className = 'spl-page-check';
    check.textContent = '✓';
    card.appendChild(check);

    const thumb = document.createElement('div');
    thumb.className = 'spl-page-thumb';
    thumb.innerHTML = '<span style="color:var(--muted);font-size:.7rem;">লোড হচ্ছে…</span>';
    card.appendChild(thumb);

    let label = document.createElement('span');
    label.className = 'spl-page-label';
    label.textContent = 'পৃষ্ঠা ' + (index + 1);
    card.appendChild(label);

    // Always clickable
    card.addEventListener('click', function () {
      togglePageSelection(index);
    });

    return card;
  }

  /* ================================================================
     SPLIT OPERATION
     ================================================================ */

  function doSplit() {
    if (splitting || totalPages === 0) return;

    // Determine what to split
    let groups; // array of arrays of 0-indexed page indices
    if (currentMode === MODE_ALL) {
      const indices = getSelectedIndices();
      if (indices.length === 0) return;
      groups = [];
      for (let i = 0; i < indices.length; i++) {
        groups.push([indices[i]]);
      }
    } else {
      groups = parseRanges(rangeInput.value);
      if (!groups) return;
    }

    splitting = true;
    splitBtn.disabled = true;
    splitBtn.querySelector('.spl-btn-text').textContent = '⏳ প্রক্রিয়াধীন… (Processing…)';
    resultEl.hidden = true;
    setProgress(0, 'স্প্লিট হচ্ছে… (Splitting…)');

    // Smart download: 1 result → direct PDF, otherwise → ZIP
    const isSinglePdf = (groups.length === 1);

    setTimeout(function () {
      const PDFLib = window.PDFLib;
      const baseName = outputName.value.trim() || 'split';

      PDFLib.PDFDocument.load(pdfBytes.slice(), { ignoreEncryption: true }).then(function (srcDoc) {
        const zip = isSinglePdf ? null : new JSZip();
        let singlePdfBytes = null;
        let singleFileName = '';
        let idx = 0;

        function splitNext() {
          if (idx >= groups.length) {
            if (isSinglePdf) {
              const blob = new Blob([singlePdfBytes], { type: 'application/pdf' });
              splitResult = { type: 'pdf', blob: blob, fileName: singleFileName };

              setProgress(100, 'সম্পন্ন! (Done!)');
              resultPages.textContent = '১টি PDF ফাইল';
              resultSize.textContent = formatSize(blob.size);
              downloadBtn.textContent = '⬇️ PDF ডাউনলোড (Download PDF)';
              resultEl.hidden = false;

              splitting = false;
              splitBtn.disabled = false;
              splitBtn.querySelector('.spl-btn-text').textContent = '✂️ স্প্লিট করুন (Split PDF)';
              return;
            }

            setProgress(90, 'ZIP তৈরি হচ্ছে… (Building ZIP…)');

            return zip.generateAsync({ type: 'blob' }).then(function (zipBlob) {
              splitResult = { type: 'zip', blob: zipBlob, fileName: baseName + '.zip' };
              setProgress(100, 'সম্পন্ন! (Done!)');

              resultPages.textContent = groups.length + 'টি PDF ফাইল';
              resultSize.textContent = formatSize(zipBlob.size);
              downloadBtn.textContent = '⬇️ ZIP ডাউনলোড (Download ZIP)';
              resultEl.hidden = false;

              splitting = false;
              splitBtn.disabled = false;
              splitBtn.querySelector('.spl-btn-text').textContent = '✂️ স্প্লিট করুন (Split PDF)';
            });
          }

          const group = groups[idx];
          const pct = Math.round((idx / groups.length) * (isSinglePdf ? 95 : 85));
          let label;

          if (group.length === 1) {
            label = 'পৃষ্ঠা ' + (group[0] + 1);
          } else {
            label = 'পৃষ্ঠা ' + (group[0] + 1) + '-' + (group[group.length - 1] + 1);
          }
          setProgress(pct, label + ' আলাদা হচ্ছে… (' + (idx + 1) + '/' + groups.length + ')');

          return PDFLib.PDFDocument.create().then(function (newDoc) {
            return newDoc.copyPages(srcDoc, group).then(function (copiedPages) {
              for (let c = 0; c < copiedPages.length; c++) {
                newDoc.addPage(copiedPages[c]);
              }
              return newDoc.save();
            }).then(function (pdfBytesOut) {
              let fileName;
              if (group.length === 1) {
                fileName = baseName + '-' + zeroPad(group[0] + 1, totalPages) + '.pdf';
              } else {
                fileName = baseName + '-' + zeroPad(group[0] + 1, totalPages) + '-to-' + zeroPad(group[group.length - 1] + 1, totalPages) + '.pdf';
              }

              if (isSinglePdf) {
                singlePdfBytes = pdfBytesOut;
                singleFileName = fileName;
              } else {
                zip.file(fileName, pdfBytesOut);
              }

              idx++;
              return splitNext();
            });
          });
        }

        return splitNext();
      }).catch(function (err) {
        showError('স্প্লিট ব্যর্থ — ' + (err.message || err));
        splitting = false;
        splitBtn.disabled = false;
        splitBtn.querySelector('.spl-btn-text').textContent = '✂️ স্প্লিট করুন (Split PDF)';
        progressEl.hidden = true;
      });
    }, 50);
  }

  /* ================================================================
     DOWNLOAD
     ================================================================ */

  function downloadSplit() {
    if (!splitResult) return;
    const url = URL.createObjectURL(splitResult.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = splitResult.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }

  /* ================================================================
     RESET
     ================================================================ */

  function resetAll() {
    pdfBytes = null;
    totalPages = 0;
    splitResult = null;
    splitting = false;
    currentMode = MODE_ALL;
    selectedPages = {};
    pageGrid.innerHTML = '';
    rangeInput.value = '';
    rangeHint.textContent = '';
    pickCounter.textContent = '';
    outputName.value = 'split-document';
    workspace.hidden = true;
    resultEl.hidden = true;
    progressEl.hidden = true;
    clearError();
    dropzone.hidden = false;
    splitBtn.disabled = false;
    splitBtn.querySelector('.spl-btn-text').textContent = '✂️ স্প্লিট করুন (Split PDF)';
    fileInput.value = '';
    switchMode(MODE_ALL);
  }

  /* ================================================================
     EVENT LISTENERS
     ================================================================ */

  // Dropzone
  dropzone.addEventListener('click', function (e) {
    if (e.target === browseBtn || browseBtn.contains(e.target)) return;
    fileInput.click();
  });

  browseBtn.addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    if (this.files && this.files[0]) loadPdf(this.files[0]);
  });

  // Drag & drop
  dropzone.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', function () {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files && files[0]) loadPdf(files[0]);
  });

  // Change file
  changeBtn.addEventListener('click', function () {
    resetAll();
    fileInput.click();
  });

  // Toolbar buttons
  tabAll.addEventListener('click', function () { switchMode(MODE_ALL); });
  tabRange.addEventListener('click', function () { switchMode(MODE_RANGE); });
  pickOddBtn.addEventListener('click', selectOddPages);
  pickEvenBtn.addEventListener('click', selectEvenPages);
  pickNoneBtn.addEventListener('click', function () { setAllSelections(false); });

  // Range input validation
  rangeInput.addEventListener('input', validateRangeInput);
  rangeInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!splitBtn.disabled) doSplit();
    }
  });

  // Split, download, reset
  splitBtn.addEventListener('click', doSplit);
  downloadBtn.addEventListener('click', downloadSplit);
  resetBtn.addEventListener('click', resetAll);
  tryAgainBtn.addEventListener('click', resetAll);

})();
