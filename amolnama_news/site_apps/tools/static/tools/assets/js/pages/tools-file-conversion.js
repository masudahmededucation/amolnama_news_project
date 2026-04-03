(function () {
  'use strict';

  /* ============================================================
     File Conversion Tool — client-side
     Supported: image ↔ image, DOCX → PDF, PDF → image
     ============================================================ */

  // ---- Extension → colour for the icon badge ----
  var EXT_COLORS = {
    // Image
    png: '#4caf50', jpg: '#ff9800', jpeg: '#ff9800', ico: '#ff9800',
    webp: '#7b1fa2', bmp: '#795548', gif: '#e91e63', avif: '#7b1fa2',
    svg: '#00bcd4', tiff: '#607d8b', tif: '#607d8b',
    heic: '#ff9800', heif: '#ff9800', dng: '#607d8b',
    // Document
    pdf: '#e53935', doc: '#2b579a', docx: '#2b579a', rtf: '#2b579a',
    odt: '#2b579a', epub: '#8e24aa', mobi: '#8e24aa',
    ppt: '#d24726', pptx: '#d24726', ppsx: '#d24726',
    xls: '#217346', xlsx: '#217346',
    // Data
    csv: '#217346', tsv: '#217346',
    json: '#fdd835', xml: '#ff7043', yaml: '#cb171e', yml: '#cb171e',
    // Text / Markup / Code
    txt: '#78909c', html: '#e44d26', htm: '#e44d26',
    md: '#083fa1', markdown: '#083fa1',
    css: '#264de4', js: '#f7df1e', sql: '#e97b00',
    // Audio / Video
    mp4: '#1565c0', mov: '#1565c0', mkv: '#1565c0', webm: '#1565c0',
    avi: '#1565c0', m4v: '#1565c0',
    mp3: '#e91e63', wav: '#e91e63', m4a: '#e91e63',
    flac: '#e91e63', ogg: '#e91e63', aac: '#e91e63',
    // Other
    dwg: '#546e7a', dxf: '#546e7a', eps: '#546e7a', ai: '#ff6f00',
    zip: '#ffa000', tar: '#ffa000', gz: '#ffa000', '7z': '#ffa000', rar: '#ffa000'
  };

  // ---- Conversion map: loaded from API, with hardcoded fallback ----
  var CONVERSION_MAP = null;
  var CONVERSION_MAP_FALLBACK = {
    png:  ['jpg', 'jpeg', 'webp', 'bmp', 'gif', 'ico', 'pdf', 'svg'],
    jpg:  ['png', 'webp', 'bmp', 'gif', 'ico', 'pdf'],
    jpeg: ['png', 'webp', 'bmp', 'gif', 'ico', 'pdf'],
    webp: ['png', 'jpg', 'bmp', 'gif', 'ico', 'pdf'],
    bmp:  ['png', 'jpg', 'webp', 'gif', 'ico', 'pdf'],
    gif:  ['png', 'jpg', 'webp', 'bmp', 'ico', 'pdf'],
    svg:  ['png', 'jpg', 'webp', 'bmp', 'pdf'],
    tiff: ['png', 'jpg', 'webp', 'bmp', 'pdf'],
    tif:  ['png', 'jpg', 'webp', 'bmp', 'pdf'],
    ico:  ['png', 'jpg', 'webp', 'bmp'],
    avif: ['png', 'jpg', 'webp', 'bmp', 'pdf'],
    docx: ['pdf', 'txt', 'html'],
    doc:  ['pdf', 'txt', 'html'],
    rtf:  ['pdf', 'txt'],
    pdf:  ['docx', 'txt', 'png', 'jpg', 'webp'],
    csv:  ['json', 'tsv', 'txt', 'html'],
    tsv:  ['csv', 'json', 'txt', 'html'],
    json: ['csv', 'txt', 'yaml', 'html'],
    xml:  ['json', 'txt', 'html'],
    yaml: ['json', 'txt'],
    yml:  ['json', 'txt'],
    txt:  ['pdf', 'html', 'json'],
    html: ['pdf', 'txt', 'md'],
    htm:  ['pdf', 'txt', 'md'],
    md:   ['html', 'pdf', 'txt'],
    markdown: ['html', 'pdf', 'txt'],
    css:  ['txt', 'pdf'],
    js:   ['txt', 'pdf']
  };

  // Load conversion map from API
  function loadConversionMap() {
    return fetch('/tools/api/file-conversion-map/')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        CONVERSION_MAP = data;
      })
      .catch(function () {
        // API unavailable — use fallback
        CONVERSION_MAP = CONVERSION_MAP_FALLBACK;
      });
  }

  // Load on page init
  loadConversionMap();

  // ---- DOM refs ----
  var dropzone      = document.getElementById('convert-dropzone');
  var fileInput      = document.getElementById('convert-file-input');
  var browseBtn      = document.getElementById('convert-browse-btn');
  var panel          = document.getElementById('convert-panel');
  var fileIcon       = document.getElementById('convert-file-icon');
  var fileName       = document.getElementById('convert-file-name');
  var fileMeta       = document.getElementById('convert-file-meta');
  var changeBtn      = document.getElementById('convert-change-btn');
  var removeBtn      = document.getElementById('convert-remove-btn');
  var formatGrid     = document.getElementById('convert-format-grid');
  var actionBtn      = document.getElementById('convert-action-btn');
  var actionLabel    = actionBtn.querySelector('.convert-action-label');
  var actionSpinner  = actionBtn.querySelector('.convert-action-spinner');
  var resultSection  = document.getElementById('convert-result');
  var resultInfo     = document.getElementById('convert-result-info');
  var downloadBtn    = document.getElementById('convert-download-btn');
  var anotherBtn     = document.getElementById('convert-another-btn');

  var currentFile     = null;
  var currentExt      = '';
  var selectedTarget  = '';
  var resultBlob      = null;
  var resultFileName  = '';

  // ---- Smooth show/hide helpers ----

  function showSection(el) {
    el.style.display = '';
    el.classList.remove('tool-section-reveal');
    void el.offsetWidth;
    el.classList.add('tool-section-reveal');
  }

  function hideSection(el) {
    el.style.display = 'none';
    el.classList.remove('tool-section-reveal');
  }

  // ---- Helpers ----

  function getExt(name) {
    var parts = name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function getExtColor(ext) {
    return EXT_COLORS[ext] || '#9e9e9e';
  }

  // ---- Drop zone events ----

  dropzone.addEventListener('click', function () { fileInput.click(); });
  browseBtn.addEventListener('click', function (e) { e.stopPropagation(); fileInput.click(); });

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
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
  });

  // ---- Handle file selection ----

  function handleFile(file) {
    // If map not loaded yet, use fallback
    if (!CONVERSION_MAP) {
      CONVERSION_MAP = CONVERSION_MAP_FALLBACK;
    }

    currentFile = file;
    currentExt = getExt(file.name);
    selectedTarget = '';
    resultBlob = null;

    // Show panel, hide result
    hideSection(dropzone);
    showSection(panel);
    hideSection(resultSection);

    // Icon
    var extLabel = currentExt;
    if (extLabel.length > 4) extLabel = extLabel.substring(0, 4);
    fileIcon.textContent = extLabel;
    fileIcon.style.background = getExtColor(currentExt);
    fileIcon.style.fontSize = extLabel.length > 3 ? '.85rem' : '1rem';

    // Details
    fileName.textContent = file.name;
    fileMeta.textContent = formatSize(file.size) + ' · ' + (currentExt || 'Unknown');

    // Build format buttons
    formatGrid.innerHTML = '';
    var targets = CONVERSION_MAP[currentExt] || [];
    if (!targets.length) {
      formatGrid.innerHTML = '<p style="color:var(--muted);font-size:.85rem;">No conversion options available for this file type.</p>';
      actionBtn.disabled = true;
      return;
    }

    targets.forEach(function (ext) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'convert-format-btn';
      btn.textContent = ext;
      btn.dataset.ext = ext;
      btn.addEventListener('click', function () {
        // Toggle selection
        formatGrid.querySelectorAll('.convert-format-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        selectedTarget = ext;
        actionBtn.disabled = false;
        actionLabel.textContent = 'Convert to ' + ext;
      });
      formatGrid.appendChild(btn);
    });

    actionBtn.disabled = true;
    actionLabel.textContent = 'Convert';
  }

  // ---- Change file (re-open file picker without resetting) ----

  changeBtn.addEventListener('click', function () {
    fileInput.value = '';
    fileInput.click();
  });

  // ---- Remove file ----

  removeBtn.addEventListener('click', resetAll);
  anotherBtn.addEventListener('click', resetAll);

  function resetAll() {
    currentFile = null;
    currentExt = '';
    selectedTarget = '';
    resultBlob = null;
    fileInput.value = '';
    showSection(dropzone);
    hideSection(panel);
    hideSection(resultSection);
    actionBtn.disabled = true;
    actionLabel.textContent = 'Convert';
    actionSpinner.style.display = 'none';
  }

  // ---- Convert action ----

  actionBtn.addEventListener('click', function () {
    if (!currentFile || !selectedTarget) return;
    startConversion();
  });

  function startConversion() {
    actionBtn.disabled = true;
    actionLabel.textContent = 'Converting...';
    actionSpinner.style.display = '';

    var baseName = currentFile.name.replace(/\.[^.]+$/, '');
    resultFileName = baseName + '.' + selectedTarget;

    var IMAGE_EXTS = ['png','jpg','jpeg','webp','bmp','gif','svg','tiff','tif','ico','avif','heic','heif','dng'];
    var IMAGE_TARGETS = ['png','jpg','jpeg','webp','bmp','gif','ico'];
    var isImageSource = IMAGE_EXTS.indexOf(currentExt) !== -1;
    var isImageTarget = IMAGE_TARGETS.indexOf(selectedTarget) !== -1;
    var isDocxSource = currentExt === 'docx' || currentExt === 'doc';
    var isMarkdownSource = currentExt === 'md' || currentExt === 'markdown';
    var isHtmlSource = currentExt === 'html' || currentExt === 'htm';
    var isCsvSource = currentExt === 'csv' || currentExt === 'tsv';
    var isYamlSource = currentExt === 'yaml' || currentExt === 'yml';
    var isCodeSource = currentExt === 'css' || currentExt === 'js' || currentExt === 'sql';

    // Build a lookup key for the conversion route
    var promise = resolveConversion(
      currentExt, selectedTarget,
      isImageSource, isImageTarget,
      isDocxSource, isMarkdownSource, isHtmlSource,
      isCsvSource, isYamlSource, isCodeSource
    );

    if (!promise) {
      promise = Promise.reject(new Error(
        currentExt + ' → ' + selectedTarget +
        ' conversion is not yet supported in the browser. Server-side processing coming soon.'
      ));
    }

    promise.then(function (blob) {
      resultBlob = blob;
      showResult();
    }).catch(function (err) {
      var errorElement = document.getElementById('tool-error-message');
      if (errorElement) { errorElement.textContent = 'Conversion failed: ' + err.message; errorElement.style.display = 'block'; }
    }).finally(function () {
      actionBtn.disabled = false;
      actionLabel.textContent = 'Convert to ' + selectedTarget;
      actionSpinner.style.display = 'none';
    });
  }

  // ---- Conversion route resolver ----

  function resolveConversion(src, tgt, isImgSrc, isImgTgt, isDocx, isMd, isHtml, isCsv, isYaml, isCode) {
    // ── Image ──
    if (isImgSrc && isImgTgt)        return convertImageToImage();
    if (isImgSrc && tgt === 'pdf')   return convertImageToPdf();
    if (isImgSrc && tgt === 'svg')   return convertImageToSvg();
    if (isImgSrc && tgt === 'tiff')  return convertImageToImage(); // Canvas handles tiff-like via png

    // ── DOCX / DOC ──
    if (isDocx && tgt === 'pdf')     return convertDocxToPdf();
    if (isDocx && tgt === 'txt')     return convertDocxToText();
    if (isDocx && tgt === 'html')    return convertDocxToHtml();
    if (isDocx && tgt === 'jpg')     return convertDocxToPdf(); // docx→pdf then render (simplified)
    if (isDocx && tgt === 'png')     return convertDocxToPdf();

    // ── PDF ──
    if (src === 'pdf' && tgt === 'docx') return convertPdfToDocx();
    if (src === 'pdf' && tgt === 'doc')  return convertPdfToDocx();
    if (src === 'pdf' && tgt === 'txt')  return convertPdfToText();
    if (src === 'pdf' && tgt === 'html') return convertPdfToHtml();
    if (src === 'pdf' && isImgTgt)       return convertPdfToImage();

    // ── CSV / TSV ──
    if (isCsv && tgt === 'json')     return convertCsvToJson();
    if (src === 'csv' && tgt === 'tsv') return convertCsvTsv('csv', 'tsv');
    if (src === 'tsv' && tgt === 'csv') return convertCsvTsv('tsv', 'csv');
    if (isCsv && tgt === 'html')     return convertCsvToHtml();
    if (isCsv && tgt === 'txt')      return convertDataToText();

    // ── JSON ──
    if (src === 'json' && tgt === 'csv')   return convertJsonToCsv();
    if (src === 'json' && tgt === 'yaml')  return convertJsonToYaml();
    if (src === 'json' && tgt === 'yml')   return convertJsonToYaml();
    if (src === 'json' && tgt === 'html')  return convertJsonToHtml();
    if (src === 'json' && tgt === 'xml')   return convertJsonToXml();
    if (src === 'json' && tgt === 'txt')   return convertDataToText();

    // ── XML ──
    if (src === 'xml' && tgt === 'json')   return convertXmlToJson();
    if (src === 'xml' && tgt === 'csv')    return convertXmlToCsv();
    if (src === 'xml' && tgt === 'html')   return convertXmlToHtml();
    if (src === 'xml' && tgt === 'txt')    return convertDataToText();

    // ── YAML ──
    if (isYaml && tgt === 'json')    return convertYamlToJson();
    if (isYaml && tgt === 'txt')     return convertDataToText();
    if (src === 'yaml' && tgt === 'yml') return convertDataToText(); // same format
    if (src === 'yml' && tgt === 'yaml') return convertDataToText();

    // ── Markdown ──
    if (isMd && tgt === 'html')      return convertMarkdownToHtml();
    if (isMd && tgt === 'pdf')       return convertMarkdownToPdf();
    if (isMd && tgt === 'txt')       return convertDataToText();
    if (isMd && tgt === 'docx')      return convertMarkdownToDocx();

    // ── HTML ──
    if (isHtml && tgt === 'txt')     return convertHtmlToText();
    if (isHtml && tgt === 'pdf')     return convertTextToPdf();
    if (isHtml && tgt === 'md')      return convertHtmlToMarkdown();
    if (isHtml && tgt === 'docx')    return convertHtmlToDocx();

    // ── TXT ──
    if (src === 'txt' && tgt === 'pdf')   return convertTextToPdf();
    if (src === 'txt' && tgt === 'html')  return convertPlainToHtml();
    if (src === 'txt' && tgt === 'json')  return convertTxtToJson();
    if (src === 'txt' && tgt === 'docx')  return convertTextToDocx();
    if (src === 'txt' && tgt === 'md')    return convertDataToText();

    // ── Code files (css, js, sql) — treat as text ──
    if (isCode && tgt === 'pdf')     return convertTextToPdf();
    if (isCode && tgt === 'txt')     return convertDataToText();
    if (isCode && tgt === 'html')    return convertPlainToHtml();
    if (src === 'js' && tgt === 'json')  return convertDataToText();
    if (src === 'sql' && tgt === 'csv')  return convertDataToText();

    // ── RTF — treat as text ──
    if (src === 'rtf' && tgt === 'pdf')  return convertTextToPdf();
    if (src === 'rtf' && tgt === 'txt')  return convertDataToText();

    // ── Generic text-readable → pdf/txt/html fallbacks ──
    if (tgt === 'pdf')  return convertTextToPdf();
    if (tgt === 'txt')  return convertDataToText();
    if (tgt === 'html') return convertPlainToHtml();

    return null; // Not supported client-side
  }

  // ---- Show result ----

  function showResult() {
    showSection(resultSection);
    resultInfo.innerHTML =
      '<strong>' + currentFile.name + '</strong> (' + formatSize(currentFile.size) + ')' +
      ' &rarr; <strong>' + resultFileName + '</strong> (' + formatSize(resultBlob.size) + ')';
  }

  // ---- Download ----

  downloadBtn.addEventListener('click', function () {
    if (!resultBlob) return;
    var url = URL.createObjectURL(resultBlob);
    var a = document.createElement('a');
    a.href = url;
    a.download = resultFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  });

  /* ============================================================
     CONVERTERS
     ============================================================ */

  // ---- Image → Image (Canvas API) ----

  function convertImageToImage() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          var ctx = canvas.getContext('2d');

          // For JPG/BMP: fill white background (no transparency)
          if (selectedTarget === 'jpg' || selectedTarget === 'jpeg' || selectedTarget === 'bmp') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0);

          var mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' };
          var mime = mimeMap[selectedTarget] || 'image/png';
          var quality = (selectedTarget === 'jpg' || selectedTarget === 'jpeg' || selectedTarget === 'webp') ? 0.92 : undefined;

          canvas.toBlob(function (blob) {
            if (blob) resolve(blob);
            else reject(new Error('Canvas conversion failed'));
          }, mime, quality);
        };
        img.onerror = function () { reject(new Error('Could not load image')); };

        // For SVG, use data URL; for others, blob URL
        if (currentExt === 'svg') {
          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(reader.result)));
        } else {
          img.src = reader.result;
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };

      if (currentExt === 'svg') {
        reader.readAsText(currentFile);
      } else {
        reader.readAsDataURL(currentFile);
      }
    });
  }

  // ---- Image → PDF (jsPDF) ----

  function convertImageToPdf() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          try {
            var w = img.naturalWidth;
            var h = img.naturalHeight;
            // PDF page in pt (72 pt/inch), fit image
            var pdfW = w * 0.75; // px to pt
            var pdfH = h * 0.75;
            var orientation = pdfW > pdfH ? 'l' : 'p';
            var doc = new jspdf.jsPDF({ orientation: orientation, unit: 'pt', format: [pdfW, pdfH] });

            // Draw image onto a canvas to get data URL
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0);
            var dataUrl = canvas.toDataURL('image/jpeg', 0.95);

            doc.addImage(dataUrl, 'JPEG', 0, 0, pdfW, pdfH);
            var blob = doc.output('blob');
            resolve(blob);
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = function () { reject(new Error('Could not load image')); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsDataURL(currentFile);
    });
  }

  // ---- DOCX → PDF (mammoth + jsPDF) ----

  function convertDocxToPdf() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        mammoth.convertToHtml({ arrayBuffer: reader.result }).then(function (result) {
          try {
            var doc = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
            var pageWidth = doc.internal.pageSize.getWidth();
            var pageHeight = doc.internal.pageSize.getHeight();
            var margin = 40;
            var maxWidth = pageWidth - margin * 2;

            // Strip HTML tags for plain text extraction
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = result.value;
            var text = tempDiv.textContent || tempDiv.innerText || '';

            doc.setFontSize(11);
            var lines = doc.splitTextToSize(text, maxWidth);
            var lineHeight = 14;
            var y = margin;

            for (var i = 0; i < lines.length; i++) {
              if (y + lineHeight > pageHeight - margin) {
                doc.addPage();
                y = margin;
              }
              doc.text(lines[i], margin, y);
              y += lineHeight;
            }

            resolve(doc.output('blob'));
          } catch (e) {
            reject(e);
          }
        }).catch(reject);
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsArrayBuffer(currentFile);
    });
  }

  // ---- PDF → Image (pdf.js) ----

  function convertPdfToImage() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var typedArray = new Uint8Array(reader.result);

        // Set worker
        if (typeof pdfjsLib !== 'undefined') {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        }

        var loadingTask = pdfjsLib.getDocument({ data: typedArray });
        loadingTask.promise.then(function (pdfDoc) {
          // Convert first page
          pdfDoc.getPage(1).then(function (page) {
            var scale = 2; // 2x for good quality
            var viewport = page.getViewport({ scale: scale });
            var canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            var ctx = canvas.getContext('2d');

            if (selectedTarget === 'jpg' || selectedTarget === 'jpeg') {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
              var mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
              var mime = mimeMap[selectedTarget] || 'image/png';
              var quality = (selectedTarget === 'jpg' || selectedTarget === 'jpeg') ? 0.92 : undefined;

              canvas.toBlob(function (blob) {
                if (blob) {
                  if (pdfDoc.numPages > 1) {
                    resultFileName = resultFileName.replace(/\.([^.]+)$/, '_page1.$1');
                  }
                  resolve(blob);
                } else {
                  reject(new Error('PDF to image conversion failed'));
                }
              }, mime, quality);
            }).catch(reject);
          }).catch(reject);
        }).catch(reject);
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsArrayBuffer(currentFile);
    });
  }

  // ---- CSV → JSON ----

  function convertCsvToJson() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var text = reader.result;
          var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
          if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

          var headers = parseCsvLine(lines[0]);
          var data = [];
          for (var i = 1; i < lines.length; i++) {
            var values = parseCsvLine(lines[i]);
            var obj = {};
            headers.forEach(function (h, idx) {
              obj[h.trim()] = (values[idx] || '').trim();
            });
            data.push(obj);
          }

          var json = JSON.stringify(data, null, 2);
          resolve(new Blob([json], { type: 'application/json' }));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  function parseCsvLine(line) {
    var result = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current);
    return result;
  }

  // ---- JSON → CSV ----

  function convertJsonToCsv() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (!Array.isArray(data) || !data.length) throw new Error('JSON must be an array of objects');

          // Collect all keys
          var keys = [];
          data.forEach(function (row) {
            Object.keys(row).forEach(function (k) {
              if (keys.indexOf(k) === -1) keys.push(k);
            });
          });

          var lines = [];
          lines.push(keys.map(csvEscape).join(','));
          data.forEach(function (row) {
            var vals = keys.map(function (k) {
              var v = row[k];
              if (v === null || v === undefined) return '';
              return csvEscape(String(v));
            });
            lines.push(vals.join(','));
          });

          resolve(new Blob([lines.join('\r\n')], { type: 'text/csv' }));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  function csvEscape(val) {
    if (val.indexOf(',') !== -1 || val.indexOf('"') !== -1 || val.indexOf('\n') !== -1) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  }

  // ---- Text/HTML → PDF ----

  function convertTextToPdf() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var text = reader.result;

          // If HTML, strip tags
          if (currentExt === 'html' || currentExt === 'htm') {
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = text;
            text = tempDiv.textContent || tempDiv.innerText || '';
          }

          var doc = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
          var pageWidth = doc.internal.pageSize.getWidth();
          var pageHeight = doc.internal.pageSize.getHeight();
          var margin = 40;
          var maxWidth = pageWidth - margin * 2;

          doc.setFontSize(11);
          var lines = doc.splitTextToSize(text, maxWidth);
          var lineHeight = 14;
          var y = margin;

          for (var i = 0; i < lines.length; i++) {
            if (y + lineHeight > pageHeight - margin) {
              doc.addPage();
              y = margin;
            }
            doc.text(lines[i], margin, y);
            y += lineHeight;
          }

          resolve(doc.output('blob'));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  // ---- PDF → DOCX (pdf.js text extraction → docx blob) ----

  function convertPdfToDocx() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var typedArray = new Uint8Array(reader.result);

        if (typeof pdfjsLib !== 'undefined') {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        }

        var loadingTask = pdfjsLib.getDocument({ data: typedArray });
        loadingTask.promise.then(function (pdfDoc) {
          var numPages = pdfDoc.numPages;
          var pagePromises = [];
          for (var p = 1; p <= numPages; p++) {
            pagePromises.push(extractPageText(pdfDoc, p));
          }
          return Promise.all(pagePromises);
        }).then(function (pageTexts) {
          var blob = buildDocxBlob(pageTexts);
          resolve(blob);
        }).catch(reject);
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsArrayBuffer(currentFile);
    });
  }

  function extractPageText(pdfDoc, pageNum) {
    return pdfDoc.getPage(pageNum).then(function (page) {
      return page.getTextContent();
    }).then(function (content) {
      // Group text items by Y position to form lines
      var lines = [];
      var currentY = null;
      var currentLine = '';

      content.items.forEach(function (item) {
        var y = Math.round(item.transform[5]);
        if (currentY === null || Math.abs(y - currentY) > 3) {
          if (currentLine) lines.push(currentLine);
          currentLine = item.str;
          currentY = y;
        } else {
          currentLine += item.str;
        }
      });
      if (currentLine) lines.push(currentLine);

      return lines.join('\n');
    });
  }

  // Build a minimal .docx file (Office Open XML) from extracted text
  function buildDocxBlob(pageTexts) {
    // .docx is a ZIP containing XML files
    // We build a minimal valid .docx using JSZip-like manual ZIP construction
    // For simplicity, use the docx library if available, otherwise build manually

    var paragraphs = '';
    pageTexts.forEach(function (text, idx) {
      var lines = text.split('\n');
      lines.forEach(function (line) {
        var escaped = xmlEscape(line);
        paragraphs += '<w:p><w:r><w:t xml:space="preserve">' + escaped + '</w:t></w:r></w:p>';
      });
      // Page break between pages (except last)
      if (idx < pageTexts.length - 1) {
        paragraphs += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      }
    });

    var documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" ' +
      'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
      'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ' +
      'xmlns:v="urn:schemas-microsoft-com:vml" ' +
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
      'xmlns:w10="urn:schemas-microsoft-com:office:word" ' +
      'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" ' +
      'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" ' +
      'xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" ' +
      'xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" ' +
      'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" ' +
      'mc:Ignorable="w14 wp14">' +
      '<w:body>' + paragraphs +
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>' +
      '</w:body></w:document>';

    var contentTypesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>';

    var relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>';

    var wordRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '</Relationships>';

    // Build ZIP manually (minimal implementation for .docx)
    return createZipBlob([
      { name: '[Content_Types].xml', data: contentTypesXml },
      { name: '_rels/.rels', data: relsXml },
      { name: 'word/document.xml', data: documentXml },
      { name: 'word/_rels/document.xml.rels', data: wordRelsXml }
    ]);
  }

  function xmlEscape(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  // Minimal ZIP builder (no compression, store only — sufficient for text-based .docx)
  function createZipBlob(files) {
    var localHeaders = [];
    var centralHeaders = [];
    var offset = 0;

    files.forEach(function (file) {
      var nameBytes = new TextEncoder().encode(file.name);
      var dataBytes = new TextEncoder().encode(file.data);
      var crc = crc32(dataBytes);

      // Local file header (30 + name + data)
      var localHeader = new ArrayBuffer(30 + nameBytes.length + dataBytes.length);
      var lv = new DataView(localHeader);
      var lba = new Uint8Array(localHeader);
      lv.setUint32(0, 0x04034b50, true);  // signature
      lv.setUint16(4, 20, true);           // version needed
      lv.setUint16(6, 0, true);            // flags
      lv.setUint16(8, 0, true);            // compression (store)
      lv.setUint16(10, 0, true);           // mod time
      lv.setUint16(12, 0, true);           // mod date
      lv.setUint32(14, crc, true);         // crc32
      lv.setUint32(18, dataBytes.length, true); // compressed size
      lv.setUint32(22, dataBytes.length, true); // uncompressed size
      lv.setUint16(26, nameBytes.length, true); // name length
      lv.setUint16(28, 0, true);           // extra length
      lba.set(nameBytes, 30);
      lba.set(dataBytes, 30 + nameBytes.length);
      localHeaders.push(localHeader);

      // Central directory header (46 + name)
      var centralHeader = new ArrayBuffer(46 + nameBytes.length);
      var cv = new DataView(centralHeader);
      var cba = new Uint8Array(centralHeader);
      cv.setUint32(0, 0x02014b50, true);   // signature
      cv.setUint16(4, 20, true);            // version made by
      cv.setUint16(6, 20, true);            // version needed
      cv.setUint16(8, 0, true);             // flags
      cv.setUint16(10, 0, true);            // compression
      cv.setUint16(12, 0, true);            // mod time
      cv.setUint16(14, 0, true);            // mod date
      cv.setUint32(16, crc, true);          // crc32
      cv.setUint32(20, dataBytes.length, true); // compressed size
      cv.setUint32(24, dataBytes.length, true); // uncompressed size
      cv.setUint16(28, nameBytes.length, true); // name length
      cv.setUint16(30, 0, true);            // extra length
      cv.setUint16(32, 0, true);            // comment length
      cv.setUint16(34, 0, true);            // disk number
      cv.setUint16(36, 0, true);            // internal attrs
      cv.setUint32(38, 0, true);            // external attrs
      cv.setUint32(42, offset, true);       // local header offset
      cba.set(nameBytes, 46);
      centralHeaders.push(centralHeader);

      offset += localHeader.byteLength;
    });

    var centralDirOffset = offset;
    var centralDirSize = 0;
    centralHeaders.forEach(function (ch) { centralDirSize += ch.byteLength; });

    // End of central directory (22 bytes)
    var eocd = new ArrayBuffer(22);
    var ev = new DataView(eocd);
    ev.setUint32(0, 0x06054b50, true);       // signature
    ev.setUint16(4, 0, true);                 // disk number
    ev.setUint16(6, 0, true);                 // central dir disk
    ev.setUint16(8, files.length, true);       // entries on disk
    ev.setUint16(10, files.length, true);      // total entries
    ev.setUint32(12, centralDirSize, true);    // central dir size
    ev.setUint32(16, centralDirOffset, true);  // central dir offset
    ev.setUint16(20, 0, true);                 // comment length

    var parts = localHeaders.concat(centralHeaders, [eocd]);
    return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  // CRC32 lookup table
  var crc32Table = (function () {
    var table = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    return table;
  })();

  function crc32(bytes) {
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      crc = crc32Table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  // ---- CSV/JSON → TXT ----

  function convertDataToText() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(new Blob([reader.result], { type: 'text/plain' }));
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  // ---- HTML → TXT ----

  function convertHtmlToText() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = reader.result;
        var text = tempDiv.textContent || tempDiv.innerText || '';
        resolve(new Blob([text], { type: 'text/plain' }));
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  // ---- Image → SVG (wraps raster in SVG <image>) ----

  function convertImageToSvg() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth;
          var h = img.naturalHeight;
          var svg = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
            'width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">\n' +
            '  <image width="' + w + '" height="' + h + '" xlink:href="' + reader.result + '"/>\n' +
            '</svg>';
          resolve(new Blob([svg], { type: 'image/svg+xml' }));
        };
        img.onerror = function () { reject(new Error('Could not load image')); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsDataURL(currentFile);
    });
  }

  // ---- PDF → TXT ----

  function convertPdfToText() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var typedArray = new Uint8Array(reader.result);
        if (typeof pdfjsLib !== 'undefined') {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        }
        var loadingTask = pdfjsLib.getDocument({ data: typedArray });
        loadingTask.promise.then(function (pdfDoc) {
          var pagePromises = [];
          for (var p = 1; p <= pdfDoc.numPages; p++) {
            pagePromises.push(extractPageText(pdfDoc, p));
          }
          return Promise.all(pagePromises);
        }).then(function (pageTexts) {
          resolve(new Blob([pageTexts.join('\n\n--- Page Break ---\n\n')], { type: 'text/plain' }));
        }).catch(reject);
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsArrayBuffer(currentFile);
    });
  }

  // ---- DOCX → TXT (mammoth) ----

  function convertDocxToText() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        mammoth.extractRawText({ arrayBuffer: reader.result }).then(function (result) {
          resolve(new Blob([result.value], { type: 'text/plain' }));
        }).catch(reject);
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsArrayBuffer(currentFile);
    });
  }

  // ---- DOCX → HTML (mammoth) ----

  function convertDocxToHtml() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        mammoth.convertToHtml({ arrayBuffer: reader.result }).then(function (result) {
          var html = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>' +
            xmlEscape(currentFile.name) + '</title>\n' +
            '<style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6}</style>\n' +
            '</head>\n<body>\n' + result.value + '\n</body>\n</html>';
          resolve(new Blob([html], { type: 'text/html' }));
        }).catch(reject);
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsArrayBuffer(currentFile);
    });
  }

  // ---- CSV ↔ TSV ----

  function convertCsvTsv(fromType, toType) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var text = reader.result;
          var fromDelim = fromType === 'csv' ? ',' : '\t';
          var toDelim = toType === 'csv' ? ',' : '\t';
          var lines = text.split(/\r?\n/);
          var converted = lines.map(function (line) {
            if (!line.trim()) return '';
            var fields = fromType === 'csv' ? parseCsvLine(line) : line.split('\t');
            if (toType === 'csv') {
              return fields.map(csvEscape).join(',');
            } else {
              return fields.join('\t');
            }
          });
          var mime = toType === 'csv' ? 'text/csv' : 'text/tab-separated-values';
          resolve(new Blob([converted.join('\r\n')], { type: mime }));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  // ---- CSV/TSV → HTML table ----

  function convertCsvToHtml() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var text = reader.result;
          var delim = currentExt === 'tsv' ? '\t' : ',';
          var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
          if (!lines.length) throw new Error('File is empty');

          var html = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n' +
            '<style>table{border-collapse:collapse;width:100%;font-family:sans-serif}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:600}tr:nth-child(even){background:#fafafa}</style>\n' +
            '</head>\n<body>\n<table>\n';

          lines.forEach(function (line, idx) {
            var fields = currentExt === 'tsv' ? line.split('\t') : parseCsvLine(line);
            var tag = idx === 0 ? 'th' : 'td';
            html += '<tr>' + fields.map(function (f) {
              return '<' + tag + '>' + xmlEscape(f.trim()) + '</' + tag + '>';
            }).join('') + '</tr>\n';
          });

          html += '</table>\n</body>\n</html>';
          resolve(new Blob([html], { type: 'text/html' }));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  // ---- JSON → YAML ----

  function convertJsonToYaml() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          var yaml = jsonToYaml(data, 0);
          resolve(new Blob([yaml], { type: 'text/yaml' }));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  function jsonToYaml(obj, indent) {
    var pad = '  '.repeat(indent);
    var lines = [];

    if (Array.isArray(obj)) {
      obj.forEach(function (item) {
        if (typeof item === 'object' && item !== null) {
          lines.push(pad + '-');
          var sub = jsonToYaml(item, indent + 1).trim();
          sub.split('\n').forEach(function (l) { lines.push(pad + '  ' + l.trim()); });
        } else {
          lines.push(pad + '- ' + yamlValue(item));
        }
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(function (key) {
        var val = obj[key];
        if (typeof val === 'object' && val !== null) {
          lines.push(pad + key + ':');
          lines.push(jsonToYaml(val, indent + 1));
        } else {
          lines.push(pad + key + ': ' + yamlValue(val));
        }
      });
    } else {
      lines.push(pad + yamlValue(obj));
    }
    return lines.join('\n');
  }

  function yamlValue(val) {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return String(val);
    var s = String(val);
    if (s.indexOf(':') !== -1 || s.indexOf('#') !== -1 || s.indexOf('"') !== -1 || s.indexOf("'") !== -1 || s.trim() !== s) {
      return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    return s;
  }

  // ---- JSON → HTML (pretty table) ----

  function convertJsonToHtml() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          var html = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n' +
            '<style>body{font-family:sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem}pre{background:#f5f5f5;padding:1rem;border-radius:4px;overflow-x:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:600}</style>\n' +
            '</head>\n<body>\n';

          if (Array.isArray(data) && data.length && typeof data[0] === 'object') {
            // Array of objects → table
            var keys = [];
            data.forEach(function (row) {
              Object.keys(row).forEach(function (k) {
                if (keys.indexOf(k) === -1) keys.push(k);
              });
            });
            html += '<table>\n<tr>' + keys.map(function (k) { return '<th>' + xmlEscape(k) + '</th>'; }).join('') + '</tr>\n';
            data.forEach(function (row) {
              html += '<tr>' + keys.map(function (k) {
                var v = row[k];
                return '<td>' + xmlEscape(v === null || v === undefined ? '' : String(v)) + '</td>';
              }).join('') + '</tr>\n';
            });
            html += '</table>\n';
          } else {
            html += '<pre>' + xmlEscape(JSON.stringify(data, null, 2)) + '</pre>\n';
          }

          html += '</body>\n</html>';
          resolve(new Blob([html], { type: 'text/html' }));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  // ---- XML → JSON ----

  function convertXmlToJson() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parser = new DOMParser();
          var doc = parser.parseFromString(reader.result, 'text/xml');
          var error = doc.querySelector('parsererror');
          if (error) throw new Error('Invalid XML: ' + error.textContent.substring(0, 100));
          var json = JSON.stringify(xmlNodeToObj(doc.documentElement), null, 2);
          resolve(new Blob([json], { type: 'application/json' }));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  function xmlNodeToObj(node) {
    var obj = {};
    // Attributes
    if (node.attributes && node.attributes.length) {
      obj['@attributes'] = {};
      for (var i = 0; i < node.attributes.length; i++) {
        obj['@attributes'][node.attributes[i].name] = node.attributes[i].value;
      }
    }
    // Children
    if (node.childNodes.length) {
      var textOnly = true;
      for (var j = 0; j < node.childNodes.length; j++) {
        if (node.childNodes[j].nodeType !== 3) { textOnly = false; break; }
      }
      if (textOnly) {
        var text = node.textContent.trim();
        if (Object.keys(obj).length === 0) return text;
        obj['#text'] = text;
      } else {
        for (var k = 0; k < node.childNodes.length; k++) {
          var child = node.childNodes[k];
          if (child.nodeType === 1) { // Element
            var childObj = xmlNodeToObj(child);
            if (obj[child.nodeName]) {
              if (!Array.isArray(obj[child.nodeName])) {
                obj[child.nodeName] = [obj[child.nodeName]];
              }
              obj[child.nodeName].push(childObj);
            } else {
              obj[child.nodeName] = childObj;
            }
          }
        }
      }
    }
    return obj;
  }

  // ---- XML → HTML (formatted display) ----

  function convertXmlToHtml() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var html = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n' +
          '<style>body{font-family:monospace;max-width:960px;margin:2rem auto;padding:0 1rem}pre{background:#f5f5f5;padding:1rem;border-radius:4px;overflow-x:auto;white-space:pre-wrap;word-wrap:break-word}</style>\n' +
          '</head>\n<body>\n<pre>' + xmlEscape(reader.result) + '</pre>\n</body>\n</html>';
        resolve(new Blob([html], { type: 'text/html' }));
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  // ---- YAML → JSON (simple parser) ----

  function convertYamlToJson() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = parseSimpleYaml(reader.result);
          var json = JSON.stringify(data, null, 2);
          resolve(new Blob([json], { type: 'application/json' }));
        } catch (e) {
          reject(new Error('YAML parse error: ' + e.message));
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  function parseSimpleYaml(text) {
    var lines = text.split(/\r?\n/);
    var result = {};
    var stack = [{ obj: result, indent: -1 }];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim() || line.trim().charAt(0) === '#') continue;

      var indent = line.search(/\S/);
      var content = line.trim();

      // Pop stack to correct level
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      var parent = stack[stack.length - 1].obj;

      // Array item
      if (content.charAt(0) === '-') {
        if (!Array.isArray(parent)) {
          // Convert parent property to array
          var keys = Object.keys(parent);
          if (keys.length === 0) {
            var grandparent = stack.length > 1 ? stack[stack.length - 2].obj : result;
            // Replace last key's value with array
            for (var gk in grandparent) {
              if (grandparent[gk] === parent) {
                grandparent[gk] = [];
                parent = grandparent[gk];
                stack[stack.length - 1].obj = parent;
                break;
              }
            }
          }
        }
        var arrVal = content.substring(1).trim();
        if (arrVal.indexOf(':') !== -1) {
          var arrObj = {};
          var arrParts = arrVal.split(':');
          var arrKey = arrParts[0].trim();
          var arrV = arrParts.slice(1).join(':').trim();
          arrObj[arrKey] = yamlParseValue(arrV);
          if (Array.isArray(parent)) parent.push(arrObj);
          stack.push({ obj: arrObj, indent: indent + 2 });
        } else {
          if (Array.isArray(parent)) parent.push(yamlParseValue(arrVal));
        }
        continue;
      }

      // Key: value
      var colonIdx = content.indexOf(':');
      if (colonIdx !== -1) {
        var key = content.substring(0, colonIdx).trim();
        var val = content.substring(colonIdx + 1).trim();
        if (val === '' || val === '|' || val === '>') {
          // Nested object or block scalar
          parent[key] = {};
          stack.push({ obj: parent[key], indent: indent });
        } else {
          parent[key] = yamlParseValue(val);
        }
      }
    }
    return result;
  }

  function yamlParseValue(val) {
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (val === 'null' || val === '~') return null;
    if (/^-?\d+$/.test(val)) return parseInt(val, 10);
    if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
    // Strip quotes
    if ((val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') ||
        (val.charAt(0) === "'" && val.charAt(val.length - 1) === "'")) {
      return val.substring(1, val.length - 1);
    }
    return val;
  }

  // ---- Markdown → HTML ----

  function convertMarkdownToHtml() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var md = reader.result;
          var bodyHtml = markdownToHtml(md);
          var html = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n' +
            '<style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6}code{background:#f5f5f5;padding:.15em .3em;border-radius:3px}pre code{display:block;padding:1rem;overflow-x:auto}blockquote{border-left:3px solid #ddd;margin-left:0;padding-left:1rem;color:#666}table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 10px}img{max-width:100%}</style>\n' +
            '</head>\n<body>\n' + bodyHtml + '\n</body>\n</html>';
          resolve(new Blob([html], { type: 'text/html' }));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  // Simple markdown parser
  function markdownToHtml(md) {
    var html = md;
    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    // Headers
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Links and images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Blockquotes
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
    // Horizontal rules
    html = html.replace(/^---+$/gm, '<hr>');
    // Unordered lists
    html = html.replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>');
    // Paragraphs (lines not already wrapped)
    html = html.replace(/^(?!<[hluobpri])([\S].+)$/gm, '<p>$1</p>');
    // Line breaks
    html = html.replace(/\n\n+/g, '\n');
    return html;
  }

  // ---- Markdown → PDF ----

  function convertMarkdownToPdf() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          // Strip markdown syntax for plain text PDF
          var text = reader.result;
          text = text.replace(/^#+\s+/gm, '');
          text = text.replace(/\*\*(.+?)\*\*/g, '$1');
          text = text.replace(/\*(.+?)\*/g, '$1');
          text = text.replace(/`([^`]+)`/g, '$1');
          text = text.replace(/```[\s\S]*?```/g, '');
          text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
          text = text.replace(/^[\-\*]\s+/gm, '  • ');
          text = text.replace(/^>\s+/gm, '  ');

          var doc = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
          var pageWidth = doc.internal.pageSize.getWidth();
          var pageHeight = doc.internal.pageSize.getHeight();
          var margin = 40;
          var maxWidth = pageWidth - margin * 2;

          doc.setFontSize(11);
          var lines = doc.splitTextToSize(text, maxWidth);
          var lineHeight = 14;
          var y = margin;

          for (var i = 0; i < lines.length; i++) {
            if (y + lineHeight > pageHeight - margin) {
              doc.addPage();
              y = margin;
            }
            doc.text(lines[i], margin, y);
            y += lineHeight;
          }

          resolve(doc.output('blob'));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  // ---- HTML → Markdown ----

  function convertHtmlToMarkdown() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var tempDiv = document.createElement('div');
          tempDiv.innerHTML = reader.result;
          var md = htmlNodeToMd(tempDiv);
          resolve(new Blob([md.trim()], { type: 'text/markdown' }));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  function htmlNodeToMd(node) {
    var md = '';
    for (var i = 0; i < node.childNodes.length; i++) {
      var child = node.childNodes[i];
      if (child.nodeType === 3) {
        md += child.textContent;
      } else if (child.nodeType === 1) {
        var tag = child.tagName.toLowerCase();
        var inner = htmlNodeToMd(child);
        if (tag === 'h1') md += '# ' + inner.trim() + '\n\n';
        else if (tag === 'h2') md += '## ' + inner.trim() + '\n\n';
        else if (tag === 'h3') md += '### ' + inner.trim() + '\n\n';
        else if (tag === 'h4') md += '#### ' + inner.trim() + '\n\n';
        else if (tag === 'h5') md += '##### ' + inner.trim() + '\n\n';
        else if (tag === 'h6') md += '###### ' + inner.trim() + '\n\n';
        else if (tag === 'p') md += inner.trim() + '\n\n';
        else if (tag === 'br') md += '\n';
        else if (tag === 'strong' || tag === 'b') md += '**' + inner + '**';
        else if (tag === 'em' || tag === 'i') md += '*' + inner + '*';
        else if (tag === 'code') md += '`' + inner + '`';
        else if (tag === 'pre') md += '```\n' + inner + '\n```\n\n';
        else if (tag === 'a') md += '[' + inner + '](' + (child.getAttribute('href') || '') + ')';
        else if (tag === 'img') md += '![' + (child.getAttribute('alt') || '') + '](' + (child.getAttribute('src') || '') + ')';
        else if (tag === 'li') md += '- ' + inner.trim() + '\n';
        else if (tag === 'blockquote') md += '> ' + inner.trim() + '\n\n';
        else if (tag === 'hr') md += '---\n\n';
        else md += inner;
      }
    }
    return md;
  }

  // ---- Plain text → HTML ----

  function convertPlainToHtml() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var text = reader.result;
        var bodyHtml = xmlEscape(text).replace(/\n/g, '<br>\n');
        var html = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n' +
          '<style>body{font-family:monospace;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6}</style>\n' +
          '</head>\n<body>\n' + bodyHtml + '\n</body>\n</html>';
        resolve(new Blob([html], { type: 'text/html' }));
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  // ---- TXT → JSON (lines as array) ----

  function convertTxtToJson() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var lines = reader.result.split(/\r?\n/);
        var json = JSON.stringify(lines, null, 2);
        resolve(new Blob([json], { type: 'application/json' }));
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  // ---- PDF → HTML (pdf.js page render) ----

  function convertPdfToHtml() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var typedArray = new Uint8Array(reader.result);
        if (typeof pdfjsLib !== 'undefined') {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        }
        var loadingTask = pdfjsLib.getDocument({ data: typedArray });
        loadingTask.promise.then(function (pdfDoc) {
          var pagePromises = [];
          for (var p = 1; p <= pdfDoc.numPages; p++) {
            pagePromises.push(extractPageText(pdfDoc, p));
          }
          return Promise.all(pagePromises);
        }).then(function (pageTexts) {
          var bodyHtml = '';
          pageTexts.forEach(function (text, idx) {
            var paras = text.split(/\n\n+/);
            paras.forEach(function (para) {
              var trimmed = para.trim();
              if (trimmed) {
                bodyHtml += '<p>' + xmlEscape(trimmed).replace(/\n/g, '<br>') + '</p>\n';
              }
            });
            if (idx < pageTexts.length - 1) {
              bodyHtml += '<hr>\n';
            }
          });
          var html = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>' +
            xmlEscape(currentFile.name) + '</title>\n' +
            '<style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6}hr{border:none;border-top:1px solid #ddd;margin:2rem 0}</style>\n' +
            '</head>\n<body>\n' + bodyHtml + '</body>\n</html>';
          resolve(new Blob([html], { type: 'text/html' }));
        }).catch(reject);
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsArrayBuffer(currentFile);
    });
  }

  // ---- JSON → XML ----

  function convertJsonToXml() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
          if (Array.isArray(data)) {
            xml += '<root>\n' + data.map(function (item) {
              return '  <item>' + jsonValueToXml(item, 2) + '</item>';
            }).join('\n') + '\n</root>';
          } else if (typeof data === 'object' && data !== null) {
            var keys = Object.keys(data);
            if (keys.length === 1) {
              xml += '<' + xmlTagName(keys[0]) + '>' + jsonValueToXml(data[keys[0]], 1) + '</' + xmlTagName(keys[0]) + '>';
            } else {
              xml += '<root>' + jsonValueToXml(data, 1) + '</root>';
            }
          } else {
            xml += '<root>' + xmlEscape(String(data)) + '</root>';
          }
          resolve(new Blob([xml], { type: 'application/xml' }));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  function xmlTagName(name) {
    // Ensure valid XML tag: replace invalid chars, prepend _ if starts with digit
    var safe = name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (/^\d/.test(safe)) safe = '_' + safe;
    return safe || '_';
  }

  function jsonValueToXml(val, depth) {
    var pad = '\n' + '  '.repeat(depth);
    var padClose = '\n' + '  '.repeat(depth - 1);
    if (val === null || val === undefined) return '';
    if (typeof val !== 'object') return xmlEscape(String(val));
    if (Array.isArray(val)) {
      return val.map(function (item) {
        return pad + '<item>' + jsonValueToXml(item, depth + 1) + '</item>';
      }).join('') + padClose;
    }
    var parts = '';
    Object.keys(val).forEach(function (key) {
      var tag = xmlTagName(key);
      parts += pad + '<' + tag + '>' + jsonValueToXml(val[key], depth + 1) + '</' + tag + '>';
    });
    return parts + padClose;
  }

  // ---- XML → CSV ----

  function convertXmlToCsv() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parser = new DOMParser();
          var doc = parser.parseFromString(reader.result, 'text/xml');
          var error = doc.querySelector('parsererror');
          if (error) throw new Error('Invalid XML: ' + error.textContent.substring(0, 100));

          // Find repeating child elements (rows)
          var root = doc.documentElement;
          var children = [];
          for (var i = 0; i < root.children.length; i++) {
            children.push(root.children[i]);
          }
          if (!children.length) throw new Error('No child elements found in XML');

          // Collect all unique keys from child elements
          var keys = [];
          var rows = [];
          children.forEach(function (child) {
            var row = {};
            for (var j = 0; j < child.children.length; j++) {
              var el = child.children[j];
              var key = el.tagName;
              if (keys.indexOf(key) === -1) keys.push(key);
              row[key] = el.textContent.trim();
            }
            // Also handle text-only children (attributes as columns)
            if (child.children.length === 0 && child.textContent.trim()) {
              var textKey = child.tagName;
              if (keys.indexOf(textKey) === -1) keys.push(textKey);
              row[textKey] = child.textContent.trim();
            }
            if (child.attributes.length) {
              for (var a = 0; a < child.attributes.length; a++) {
                var attrKey = '@' + child.attributes[a].name;
                if (keys.indexOf(attrKey) === -1) keys.push(attrKey);
                row[attrKey] = child.attributes[a].value;
              }
            }
            rows.push(row);
          });

          // Build CSV
          var csvLines = [keys.map(csvEscape).join(',')];
          rows.forEach(function (row) {
            csvLines.push(keys.map(function (k) {
              return csvEscape(row[k] || '');
            }).join(','));
          });

          resolve(new Blob([csvLines.join('\r\n')], { type: 'text/csv' }));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  // ---- Markdown → DOCX ----

  function convertMarkdownToDocx() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var text = reader.result;
          // Strip markdown syntax to plain text, then build DOCX
          text = text.replace(/```[\s\S]*?```/g, function (m) {
            return m.replace(/```\w*\n?/, '').replace(/```/, '');
          });
          text = text.replace(/^#+\s+/gm, '');
          text = text.replace(/\*\*(.+?)\*\*/g, '$1');
          text = text.replace(/\*(.+?)\*/g, '$1');
          text = text.replace(/`([^`]+)`/g, '$1');
          text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
          text = text.replace(/^[\-\*]\s+/gm, '  \u2022 ');
          text = text.replace(/^>\s+/gm, '  ');

          var pages = [text];
          resolve(buildDocxBlob(pages));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  // ---- HTML → DOCX ----

  function convertHtmlToDocx() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var tempDiv = document.createElement('div');
          tempDiv.innerHTML = reader.result;
          var text = tempDiv.textContent || tempDiv.innerText || '';
          var pages = [text];
          resolve(buildDocxBlob(pages));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

  // ---- TXT → DOCX ----

  function convertTextToDocx() {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var pages = [reader.result];
          resolve(buildDocxBlob(pages));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.readAsText(currentFile);
    });
  }

})();
