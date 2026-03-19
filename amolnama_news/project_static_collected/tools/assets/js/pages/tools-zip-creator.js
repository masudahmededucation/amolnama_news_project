(function () {
  'use strict';

  /* ============================================================
     ZIP Creator Tool — client-side
     Uses store-only ZIP (no compression) for speed & simplicity.
     ============================================================ */

  // ---- Already-compressed formats (DEFLATE won't help) ----
  var COMPRESSED_EXTS = {
    png:1, jpg:1, jpeg:1, gif:1, webp:1, avif:1, heic:1, heif:1,
    pdf:1, zip:1, rar:1, '7z':1, gz:1, bz2:1, xz:1, zst:1, br:1, lz4:1,
    mp3:1, aac:1, ogg:1, opus:1, flac:1, m4a:1, wma:1,
    mp4:1, mkv:1, webm:1, mov:1, avi:1, wmv:1, flv:1,
    docx:1, xlsx:1, pptx:1, odt:1, ods:1, odp:1, epub:1,
    jar:1, apk:1, woff2:1, woff:1
  };

  // ---- Extension → colour for the icon badge ----
  var EXT_COLORS = {
    png: '#4caf50', jpg: '#ff9800', jpeg: '#ff9800', ico: '#ff9800',
    webp: '#7b1fa2', bmp: '#795548', gif: '#e91e63', svg: '#00bcd4',
    tiff: '#607d8b', tif: '#607d8b', avif: '#7b1fa2',
    pdf: '#e53935', doc: '#2b579a', docx: '#2b579a', rtf: '#2b579a',
    odt: '#2b579a', ppt: '#d24726', pptx: '#d24726',
    xls: '#217346', xlsx: '#217346',
    csv: '#217346', tsv: '#217346',
    json: '#fdd835', xml: '#ff7043', yaml: '#cb171e', yml: '#cb171e',
    txt: '#78909c', html: '#e44d26', htm: '#e44d26',
    md: '#083fa1', css: '#264de4', js: '#f7df1e', sql: '#e97b00',
    mp4: '#1565c0', mov: '#1565c0', mkv: '#1565c0', webm: '#1565c0',
    avi: '#1565c0', mp3: '#e91e63', wav: '#e91e63', m4a: '#e91e63',
    flac: '#e91e63', ogg: '#e91e63', aac: '#e91e63',
    zip: '#ffa000', rar: '#ffa000', '7z': '#ffa000', tar: '#ffa000', gz: '#ffa000',
    dwg: '#546e7a', dxf: '#546e7a', ai: '#ff6f00', eps: '#546e7a'
  };

  // ---- DOM refs ----
  var dropzone     = document.getElementById('zip-dropzone');
  var fileInput    = document.getElementById('zip-file-input');
  var browseBtn    = document.getElementById('zip-browse-btn');
  var panel        = document.getElementById('zip-panel');
  var addBtn       = document.getElementById('zip-add-btn');
  var clearBtn     = document.getElementById('zip-clear-btn');
  var fileList     = document.getElementById('zip-file-list');
  var fileCountEl  = document.getElementById('zip-file-count');
  var totalSizeEl  = document.getElementById('zip-total-size');
  var nameInput    = document.getElementById('zip-name-input');
  var actionBtn    = document.getElementById('zip-action-btn');
  var actionLabel  = actionBtn.querySelector('.zip-action-label');
  var actionSpinner = actionBtn.querySelector('.zip-action-spinner');
  var resultSection = document.getElementById('zip-result');
  var resultDetails = document.getElementById('zip-result-details');
  var downloadBtn  = document.getElementById('zip-download-btn');
  var anotherBtn   = document.getElementById('zip-another-btn');

  var files = [];        // Array of File objects
  var resultBlob = null;
  var resultFileName = '';
  var lastZipStats = [];  // per-file compression stats

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
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  }

  function getExtColor(ext) {
    return EXT_COLORS[ext] || '#9e9e9e';
  }

  function formatDate(date) {
    var d = new Date(date);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() +
      ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
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
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length) addFiles(fileInput.files);
    fileInput.value = '';
  });

  // ---- Add more files button ----
  addBtn.addEventListener('click', function () {
    fileInput.click();
  });

  // ---- Add files to list ----

  function addFiles(newFiles) {
    for (var i = 0; i < newFiles.length; i++) {
      // Skip duplicates (same name + same size + same lastModified)
      var dup = false;
      for (var j = 0; j < files.length; j++) {
        if (files[j].name === newFiles[i].name &&
            files[j].size === newFiles[i].size &&
            files[j].lastModified === newFiles[i].lastModified) {
          dup = true;
          break;
        }
      }
      if (!dup) files.push(newFiles[i]);
    }
    renderFileList();
    showPanel();
  }

  // ---- Render file list ----

  function renderFileList() {
    fileList.innerHTML = '';
    var totalSize = 0;

    files.forEach(function (file, idx) {
      totalSize += file.size;
      var ext = getExt(file.name);
      var extLabel = ext.toUpperCase();
      if (extLabel.length > 4) extLabel = extLabel.substring(0, 4);

      var item = document.createElement('div');
      item.className = 'zip-file-item';

      var icon = document.createElement('div');
      icon.className = 'zip-file-item-icon';
      icon.textContent = extLabel || '?';
      icon.style.background = getExtColor(ext);
      icon.style.fontSize = extLabel.length > 3 ? '.65rem' : '.75rem';

      var info = document.createElement('div');
      info.className = 'zip-file-item-info';

      var name = document.createElement('div');
      name.className = 'zip-file-item-name';
      name.textContent = file.name;

      var meta = document.createElement('div');
      meta.className = 'zip-file-item-meta';
      meta.textContent = formatSize(file.size) + ' \u00B7 ' + (ext.toUpperCase() || 'Unknown') +
        ' \u00B7 ' + formatDate(file.lastModified);

      info.appendChild(name);
      info.appendChild(meta);

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'zip-file-item-remove';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = 'Remove file';
      removeBtn.dataset.idx = idx;
      removeBtn.addEventListener('click', function () {
        files.splice(parseInt(this.dataset.idx, 10), 1);
        if (files.length === 0) {
          resetAll();
        } else {
          renderFileList();
        }
      });

      item.appendChild(icon);
      item.appendChild(info);
      item.appendChild(removeBtn);
      fileList.appendChild(item);
    });

    fileCountEl.textContent = files.length;
    totalSizeEl.textContent = formatSize(totalSize);
  }

  // ---- Show/hide panel ----

  function showPanel() {
    hideSection(dropzone);
    showSection(panel);
    hideSection(resultSection);
  }

  // ---- Clear all ----

  clearBtn.addEventListener('click', resetAll);
  anotherBtn.addEventListener('click', resetAll);

  function resetAll() {
    files = [];
    resultBlob = null;
    resultFileName = '';
    lastZipStats = [];
    fileInput.value = '';
    nameInput.value = 'archive';
    fileList.innerHTML = '';
    fileCountEl.textContent = '0';
    totalSizeEl.textContent = '0 B';
    showSection(dropzone);
    hideSection(panel);
    hideSection(resultSection);
    actionLabel.textContent = 'Create ZIP';
    actionSpinner.style.display = 'none';
    actionBtn.disabled = false;
  }

  // ---- Create ZIP action ----

  actionBtn.addEventListener('click', function () {
    if (!files.length) return;
    createZip();
  });

  function createZip() {
    actionBtn.disabled = true;
    actionLabel.textContent = 'Creating ZIP...';
    actionSpinner.style.display = '';

    var zipName = (nameInput.value.trim() || 'archive') + '.zip';
    resultFileName = zipName;

    // Read all files as ArrayBuffer
    var fileReads = files.map(function (file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          resolve({
            name: file.name,
            data: new Uint8Array(reader.result),
            lastModified: new Date(file.lastModified)
          });
        };
        reader.onerror = function () { reject(new Error('Failed to read ' + file.name)); };
        reader.readAsArrayBuffer(file);
      });
    });

    Promise.all(fileReads).then(function (entries) {
      return buildZipBlob(entries);
    }).then(function (result) {
      resultBlob = result.blob;
      lastZipStats = result.stats;
      showResult();
    }).catch(function (err) {
      alert('ZIP creation failed: ' + err.message);
    }).finally(function () {
      actionBtn.disabled = false;
      actionLabel.textContent = 'Create ZIP';
      actionSpinner.style.display = 'none';
    });
  }

  // ---- DEFLATE compression using browser CompressionStream API ----

  function deflateData(data) {
    // Use browser-native DEFLATE (CompressionStream 'deflate-raw')
    if (typeof CompressionStream !== 'undefined') {
      var cs = new CompressionStream('deflate-raw');
      var writer = cs.writable.getWriter();
      writer.write(data);
      writer.close();
      return new Response(cs.readable).arrayBuffer().then(function (buf) {
        return new Uint8Array(buf);
      });
    }
    // Fallback: store-only (no compression)
    return Promise.resolve(data);
  }

  // ---- ZIP builder with DEFLATE compression ----

  function buildZipBlob(entries) {
    // Compress all entries in parallel; skip DEFLATE for already-compressed formats
    var compressionPromises = entries.map(function (entry) {
      var ext = getExt(entry.name);
      if (COMPRESSED_EXTS[ext]) {
        // Already compressed — DEFLATE would make it larger, skip
        return Promise.resolve({
          name: entry.name,
          rawData: entry.data,
          compressedData: entry.data,
          method: 0,
          lastModified: entry.lastModified,
          skippedReason: 'already-compressed'
        });
      }
      return deflateData(entry.data).then(function (compressed) {
        var useDeflate = typeof CompressionStream !== 'undefined' && compressed.length < entry.data.length;
        return {
          name: entry.name,
          rawData: entry.data,
          compressedData: useDeflate ? compressed : entry.data,
          method: useDeflate ? 8 : 0,
          lastModified: entry.lastModified,
          skippedReason: useDeflate ? null : 'no-gain'
        };
      });
    });

    return Promise.all(compressionPromises).then(function (prepared) {
      var localHeaders = [];
      var centralHeaders = [];
      var offset = 0;

      prepared.forEach(function (entry) {
        var nameBytes = new TextEncoder().encode(entry.name);
        var compData = entry.compressedData;
        var rawSize = entry.rawData.length;
        var compSize = compData.length;
        var crc = crc32(entry.rawData);

        // DOS date/time
        var dt = entry.lastModified;
        var dosTime = ((dt.getHours() & 0x1f) << 11) | ((dt.getMinutes() & 0x3f) << 5) | ((dt.getSeconds() >> 1) & 0x1f);
        var dosDate = (((dt.getFullYear() - 1980) & 0x7f) << 9) | (((dt.getMonth() + 1) & 0x0f) << 5) | (dt.getDate() & 0x1f);

        // Local file header (30 + name + compressed data)
        var localHeader = new ArrayBuffer(30 + nameBytes.length + compSize);
        var lv = new DataView(localHeader);
        var lba = new Uint8Array(localHeader);
        lv.setUint32(0, 0x04034b50, true);  // signature
        lv.setUint16(4, 20, true);           // version needed
        lv.setUint16(6, 0, true);            // flags
        lv.setUint16(8, entry.method, true); // compression method
        lv.setUint16(10, dosTime, true);     // mod time
        lv.setUint16(12, dosDate, true);     // mod date
        lv.setUint32(14, crc, true);         // crc32
        lv.setUint32(18, compSize, true);    // compressed size
        lv.setUint32(22, rawSize, true);     // uncompressed size
        lv.setUint16(26, nameBytes.length, true);
        lv.setUint16(28, 0, true);           // extra length
        lba.set(nameBytes, 30);
        lba.set(compData, 30 + nameBytes.length);
        localHeaders.push(localHeader);

        // Central directory header (46 + name)
        var centralHeader = new ArrayBuffer(46 + nameBytes.length);
        var cv = new DataView(centralHeader);
        var cba = new Uint8Array(centralHeader);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);            // version made by
        cv.setUint16(6, 20, true);            // version needed
        cv.setUint16(8, 0, true);             // flags
        cv.setUint16(10, entry.method, true); // compression method
        cv.setUint16(12, dosTime, true);
        cv.setUint16(14, dosDate, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, compSize, true);     // compressed size
        cv.setUint32(24, rawSize, true);      // uncompressed size
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint16(30, 0, true);
        cv.setUint16(32, 0, true);
        cv.setUint16(34, 0, true);
        cv.setUint16(36, 0, true);
        cv.setUint32(38, 0, true);
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
      ev.setUint32(0, 0x06054b50, true);
      ev.setUint16(4, 0, true);
      ev.setUint16(6, 0, true);
      ev.setUint16(8, prepared.length, true);
      ev.setUint16(10, prepared.length, true);
      ev.setUint32(12, centralDirSize, true);
      ev.setUint32(16, centralDirOffset, true);
      ev.setUint16(20, 0, true);

      var parts = localHeaders.concat(centralHeaders, [eocd]);
      var blob = new Blob(parts, { type: 'application/zip' });

      // Gather per-file stats
      var stats = prepared.map(function (entry) {
        return {
          name: entry.name,
          originalSize: entry.rawData.length,
          compressedSize: entry.compressedData.length,
          method: entry.method,
          skippedReason: entry.skippedReason || null
        };
      });

      return { blob: blob, stats: stats };
    });
  }

  // ---- CRC32 ----

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

  // ---- Show result ----

  function showResult() {
    showSection(resultSection);

    var totalOriginal = 0;
    files.forEach(function (f) { totalOriginal += f.size; });
    var zipSize = resultBlob.size;
    var saved = totalOriginal - zipSize;
    var pct = totalOriginal > 0 ? ((saved / totalOriginal) * 100).toFixed(1) : '0.0';
    var savingsClass = saved > 0 ? 'zip-savings-positive' : 'zip-savings-neutral';

    // Count file types
    var typeCounts = {};
    files.forEach(function (f) {
      var ext = getExt(f.name).toUpperCase() || 'OTHER';
      typeCounts[ext] = (typeCounts[ext] || 0) + 1;
    });
    var typeBreakdown = Object.keys(typeCounts).map(function (ext) {
      return typeCounts[ext] + ' ' + ext;
    }).join(', ');

    // Find largest/smallest file
    var largest = files[0];
    var smallest = files[0];
    files.forEach(function (f) {
      if (f.size > largest.size) largest = f;
      if (f.size < smallest.size) smallest = f;
    });

    // Build per-file compression breakdown
    var compressedCount = 0;
    var storedCount = 0;
    var alreadyCompressedCount = 0;
    var perFileRows = '';
    lastZipStats.forEach(function (s) {
      if (s.method === 8) {
        compressedCount++;
      } else {
        storedCount++;
        if (s.skippedReason === 'already-compressed') alreadyCompressedCount++;
      }
      var fileSaved = s.originalSize - s.compressedSize;
      var filePct = s.originalSize > 0 ? ((fileSaved / s.originalSize) * 100).toFixed(1) : '0.0';
      var methodLabel = s.method === 8 ? 'DEFLATE' : 'STORE';
      var reasonNote = s.skippedReason === 'already-compressed' ? ' (already compressed)' : '';
      perFileRows +=
        '<tr>' +
          '<td>' + truncName(s.name, 24) + '</td>' +
          '<td>' + formatSize(s.originalSize) + '</td>' +
          '<td>' + formatSize(s.compressedSize) + '</td>' +
          '<td>' + methodLabel + reasonNote + '</td>' +
          '<td>' + (fileSaved > 0 ? '-' + filePct + '%' : '0%') + '</td>' +
        '</tr>';
    });

    // Note about already-compressed formats
    var compressionNote = '';
    if (alreadyCompressedCount > 0) {
      compressionNote =
        '<div class="zip-compression-note">' +
          '<strong>ℹ Note:</strong> ' + alreadyCompressedCount + ' of ' + files.length +
          ' file(s) are already compressed formats (e.g. PNG, PDF, JPEG, DOCX, MP4). ' +
          'These formats use internal compression, so ZIP cannot reduce them further. ' +
          'Text-based files (TXT, CSV, JSON, HTML, XML) typically compress 50–80%.' +
        '</div>';
    }

    resultDetails.innerHTML =
      '<div class="zip-stat-grid">' +
        '<div class="zip-stat-item"><span class="zip-stat-label">Archive Name</span><span class="zip-stat-value">' + resultFileName + '</span></div>' +
        '<div class="zip-stat-item"><span class="zip-stat-label">Files Included</span><span class="zip-stat-value">' + files.length + '</span></div>' +
        '<div class="zip-stat-item"><span class="zip-stat-label">Original Total</span><span class="zip-stat-value">' + formatSize(totalOriginal) + '</span></div>' +
        '<div class="zip-stat-item"><span class="zip-stat-label">ZIP Size</span><span class="zip-stat-value">' + formatSize(zipSize) + '</span></div>' +
        '<div class="zip-stat-item"><span class="zip-stat-label">Size Difference</span><span class="zip-stat-value ' + savingsClass + '">' +
          (saved > 0 ? '-' : saved < 0 ? '+' : '') + formatSize(Math.abs(saved)) + ' (' + pct + '%)' +
        '</span></div>' +
        '<div class="zip-stat-item"><span class="zip-stat-label">Compression</span><span class="zip-stat-value">' +
          compressedCount + ' compressed, ' + storedCount + ' stored' +
        '</span></div>' +
        '<div class="zip-stat-item"><span class="zip-stat-label">File Types</span><span class="zip-stat-value">' + typeBreakdown + '</span></div>' +
        '<div class="zip-stat-item"><span class="zip-stat-label">Largest File</span><span class="zip-stat-value">' + truncName(largest.name, 28) + ' (' + formatSize(largest.size) + ')</span></div>' +
        '<div class="zip-stat-item"><span class="zip-stat-label">Smallest File</span><span class="zip-stat-value">' + truncName(smallest.name, 28) + ' (' + formatSize(smallest.size) + ')</span></div>' +
      '</div>' +
      compressionNote +
      '<div class="zip-file-breakdown">' +
        '<table class="zip-breakdown-table">' +
          '<thead><tr><th>File</th><th>Original</th><th>In ZIP</th><th>Method</th><th>Saved</th></tr></thead>' +
          '<tbody>' + perFileRows + '</tbody>' +
        '</table>' +
      '</div>';
  }

  function truncName(name, maxLen) {
    if (name.length <= maxLen) return name;
    var ext = getExt(name);
    var base = name.substring(0, name.length - ext.length - 1);
    var keep = maxLen - ext.length - 4; // 4 for "..." + "."
    return base.substring(0, keep) + '...' + (ext ? '.' + ext : '');
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

})();
