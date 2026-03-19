/**
 * tools-passport-photo-resizer.js
 *
 * Client-side passport photo & signature resizer.
 * All processing happens in the browser — nothing is uploaded.
 *
 * Features:
 *   - Interactive drag-to-position crop with dotted frame overlay
 *   - Zoom slider for fine control
 *   - Live preview canvas updates as user drags
 *   - Preset dimensions (Teletalk, BCS, Passport, Visa, Bank)
 *   - Signature resize (300×80 etc.)
 *   - Background color change (white, blue, grey, red)
 *   - JPEG quality reduction to meet max KB limit
 *   - Download as JPG
 */

(function () {
  'use strict';

  /* ===== DOM refs ===== */
  var modeButtons     = document.querySelectorAll('.photo-resizer-mode-btn');
  var presetSelect    = document.getElementById('photo-resizer-preset-select');
  var widthInput      = document.getElementById('photo-resizer-width');
  var heightInput     = document.getElementById('photo-resizer-height');
  var minKbInput      = document.getElementById('photo-resizer-min-kb');
  var maxKbInput      = document.getElementById('photo-resizer-max-kb');
  var bgOptions       = document.getElementById('photo-resizer-bg-options');
  var bgSwatches      = document.querySelectorAll('.photo-resizer-swatch');
  var dropzone        = document.getElementById('photo-resizer-dropzone');
  var fileInput       = document.getElementById('photo-resizer-file-input');
  var browseBtn       = document.getElementById('photo-resizer-browse-btn');
  var editor          = document.getElementById('photo-resizer-editor');
  var viewport        = document.getElementById('photo-resizer-viewport');
  var sourceImg       = document.getElementById('photo-resizer-source-img');
  var cropFrame       = document.getElementById('photo-resizer-crop-frame');
  var zoomRange       = document.getElementById('photo-resizer-zoom-range');
  var zoomValueEl     = document.getElementById('photo-resizer-zoom-value');
  var previewCanvas   = document.getElementById('photo-resizer-preview-canvas');
  var previewCtx      = previewCanvas.getContext('2d');
  var infoEl          = document.getElementById('photo-resizer-info');
  var cropBtn         = document.getElementById('photo-resizer-crop-btn');
  var downloadBtn     = document.getElementById('photo-resizer-download-btn');
  var resetBtn        = document.getElementById('photo-resizer-reset-btn');

  /* ===== State ===== */
  var currentMode     = 'photo';
  var bgColor         = '#FFFFFF';
  var originalImage   = null;
  var resultBlob      = null;

  // Image display state (pixels within the viewport)
  var imgLeft = 0;          // image CSS left
  var imgTop = 0;           // image CSS top
  var baseW = 0;            // image display width at zoom=1
  var baseH = 0;            // image display height at zoom=1
  var currentZoom = 1;

  // Drag state
  var isDragging = false;
  var dragStartX, dragStartY;
  var dragImgLeft, dragImgTop;

  // Pinch-to-zoom state
  var isPinching = false;
  var pinchStartDist = 0;
  var pinchStartZoom = 1;
  var pinchCenterX = 0;
  var pinchCenterY = 0;
  var pinchStartImgLeft = 0;
  var pinchStartImgTop = 0;

  /* ===== Preset dimensions map ===== */
  /* minKb: minimum file size (0 = no minimum) */
  /* kb: maximum file size */
  var PRESETS = {
    /* সরকারি চাকরি (Government Jobs — Teletalk / BPSC) */
    'teletalk_photo':     { w: 300, h: 300, minKb: 0,  kb: 100  },
    'teletalk_sig':       { w: 300, h: 80,  minKb: 0,  kb: 60   },
    'bcs_photo':          { w: 300, h: 300, minKb: 0,  kb: 100  },
    'bcs_sig':            { w: 300, h: 80,  minKb: 0,  kb: 60   },
    /* পাসপোর্ট (Bangladesh Passport) */
    'bd_passport':        { w: 1063, h: 1299, minKb: 0,  kb: 300  },  /* 45×55mm @600dpi */
    'bd_epassport':       { w: 591,  h: 709,  minKb: 0,  kb: 240  },  /* 25×30mm @600dpi */
    /* ভিসা (Visa) */
    'us_visa':            { w: 600,  h: 600,  minKb: 0,  kb: 240  },  /* 2×2 inch, JPEG only */
    'uk_visa':            { w: 600,  h: 750,  minKb: 50, kb: 10000 }, /* min 50KB, max 10MB */
    'schengen_visa':      { w: 827,  h: 1063, minKb: 50, kb: 500  },  /* 35×45mm @600dpi */
    /* বাংলাদেশ স্ট্যান্ডার্ড পাসপোর্ট সাইজ (Standard passport size photo) */
    'bd_passport_size':   { w: 413,  h: 531,  minKb: 0,  kb: 300  },  /* 35×45mm @300dpi */
    /* ব্যাংক ও অন্যান্য (Bank & Others) */
    'bank_photo':         { w: 300, h: 300, minKb: 0, kb: 100 },
    'bank_sig':           { w: 300, h: 80,  minKb: 0, kb: 60  }
  };

  /* ===== Smooth show/hide helpers ===== */

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

  /* ===== Helpers ===== */

  function getTargetW() { return parseInt(widthInput.value, 10) || 300; }
  function getTargetH() { return parseInt(heightInput.value, 10) || 300; }

  /** Calculate crop frame size (pixels) to fit within viewport while keeping target aspect ratio */
  function getCropFrameSize() {
    var tw = getTargetW();
    var th = getTargetH();
    var ratio = tw / th;
    var vpW = viewport.clientWidth;
    var vpH = viewport.clientHeight;
    var maxFrameW = vpW * 0.85;
    var maxFrameH = vpH * 0.85;
    var frameW, frameH;

    if (ratio >= 1) {
      frameW = Math.min(maxFrameW, maxFrameH * ratio);
      frameH = frameW / ratio;
    } else {
      frameH = Math.min(maxFrameH, maxFrameW / ratio);
      frameW = frameH * ratio;
    }

    // Ensure it doesn't exceed viewport
    if (frameW > maxFrameW) { frameW = maxFrameW; frameH = frameW / ratio; }
    if (frameH > maxFrameH) { frameH = maxFrameH; frameW = frameH * ratio; }

    return { w: Math.round(frameW), h: Math.round(frameH) };
  }

  /** Position crop frame centered in viewport */
  function updateCropFrame() {
    var size = getCropFrameSize();
    var vpW = viewport.clientWidth;
    var vpH = viewport.clientHeight;

    cropFrame.style.width = size.w + 'px';
    cropFrame.style.height = size.h + 'px';
    cropFrame.style.left = Math.round((vpW - size.w) / 2) + 'px';
    cropFrame.style.top = Math.round((vpH - size.h) / 2) + 'px';
  }

  /** Position the image in the viewport (center it initially) */
  function centerImage() {
    if (!originalImage) return;
    var vpW = viewport.clientWidth;
    var vpH = viewport.clientHeight;

    // Fit image to viewport at zoom=1
    var natW = originalImage.naturalWidth;
    var natH = originalImage.naturalHeight;
    var scale = Math.min(vpW / natW, vpH / natH);
    baseW = Math.round(natW * scale);
    baseH = Math.round(natH * scale);

    // Center
    imgLeft = Math.round((vpW - baseW) / 2);
    imgTop = Math.round((vpH - baseH) / 2);

    applyImagePosition();
  }

  /** Apply current position + zoom to the <img> element */
  function applyImagePosition() {
    var w = Math.round(baseW * currentZoom);
    var h = Math.round(baseH * currentZoom);

    // When zooming, keep the center of the image at the same viewport position
    // Adjust left/top so the center stays put
    sourceImg.style.left = imgLeft + 'px';
    sourceImg.style.top = imgTop + 'px';
    sourceImg.style.width = w + 'px';
    sourceImg.style.height = h + 'px';
    sourceImg.style.transform = 'none';
  }

  /**
   * Map crop frame region to source image coordinates.
   * Returns { srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH }
   * with proper clamping so partial overlaps don't stretch.
   */
  function getCropRegion(tw, th) {
    var frameSize = getCropFrameSize();
    var vpW = viewport.clientWidth;
    var vpH = viewport.clientHeight;

    var frameLeft = (vpW - frameSize.w) / 2;
    var frameTop = (vpH - frameSize.h) / 2;

    var dispW = baseW * currentZoom;
    var dispH = baseH * currentZoom;
    var natW = originalImage.naturalWidth;
    var natH = originalImage.naturalHeight;
    var pxRatioX = natW / dispW;
    var pxRatioY = natH / dispH;

    // Unclamped source region
    var srcX = (frameLeft - imgLeft) * pxRatioX;
    var srcY = (frameTop - imgTop) * pxRatioY;
    var srcW = frameSize.w * pxRatioX;
    var srcH = frameSize.h * pxRatioY;

    // Destination starts at (0,0) filling full canvas
    var dstX = 0, dstY = 0, dstW = tw, dstH = th;

    // Scale factor: how many destination pixels per source pixel
    var scaleX = tw / srcW;
    var scaleY = th / srcH;

    // Clamp left/top — shift destination proportionally
    if (srcX < 0) {
      dstX = (-srcX) * scaleX;
      dstW -= dstX;
      srcW += srcX;  // reduce srcW by the overshoot
      srcX = 0;
    }
    if (srcY < 0) {
      dstY = (-srcY) * scaleY;
      dstH -= dstY;
      srcH += srcY;
      srcY = 0;
    }

    // Clamp right/bottom
    if (srcX + srcW > natW) {
      var overshoot = (srcX + srcW) - natW;
      srcW -= overshoot;
      dstW -= overshoot * scaleX;
    }
    if (srcY + srcH > natH) {
      var overshootY = (srcY + srcH) - natH;
      srcH -= overshootY;
      dstH -= overshootY * scaleY;
    }

    return {
      srcX: srcX, srcY: srcY, srcW: srcW, srcH: srcH,
      dstX: dstX, dstY: dstY, dstW: dstW, dstH: dstH
    };
  }

  /** Draw live preview based on what's under the crop frame */
  function updatePreview() {
    if (!originalImage) return;

    var tw = getTargetW();
    var th = getTargetH();

    previewCanvas.width = tw;
    previewCanvas.height = th;
    previewCtx.clearRect(0, 0, tw, th);

    // Always fill background (white for photo/signature, chosen color for background mode)
    previewCtx.fillStyle = currentMode === 'background' ? bgColor : '#FFFFFF';
    previewCtx.fillRect(0, 0, tw, th);

    var r = getCropRegion(tw, th);
    if (r.srcW > 0 && r.srcH > 0 && r.dstW > 0 && r.dstH > 0) {
      previewCtx.drawImage(originalImage,
        r.srcX, r.srcY, r.srcW, r.srcH,
        r.dstX, r.dstY, r.dstW, r.dstH);
    }

    infoEl.textContent = 'আউটপুট: ' + tw + '×' + th + 'px';
  }

  /* ===== Mode switching ===== */
  modeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      modeButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentMode = btn.getAttribute('data-mode');
      if (currentMode === 'background') { showSection(bgOptions); } else { hideSection(bgOptions); }

      if (currentMode === 'signature') {
        widthInput.value = 300; heightInput.value = 80; minKbInput.value = 0; maxKbInput.value = 100;
      } else {
        widthInput.value = 300; heightInput.value = 300; minKbInput.value = 0; maxKbInput.value = 100;
      }

      if (originalImage) { updateCropFrame(); updatePreview(); }
    });
  });

  /* ===== Preset change ===== */
  presetSelect.addEventListener('change', function () {
    var preset = PRESETS[presetSelect.value];
    if (preset) {
      widthInput.value = preset.w;
      heightInput.value = preset.h;
      minKbInput.value = preset.minKb || 0;
      maxKbInput.value = preset.kb;
      if (originalImage) { updateCropFrame(); updatePreview(); }
    }
  });

  /* ===== Custom size change ===== */
  widthInput.addEventListener('input', function () {
    if (originalImage) { updateCropFrame(); updatePreview(); }
  });
  heightInput.addEventListener('input', function () {
    if (originalImage) { updateCropFrame(); updatePreview(); }
  });

  /* ===== Background swatch ===== */
  bgSwatches.forEach(function (swatch) {
    swatch.addEventListener('click', function () {
      bgSwatches.forEach(function (s) { s.classList.remove('active'); });
      swatch.classList.add('active');
      bgColor = swatch.getAttribute('data-color');
      if (originalImage) updatePreview();
    });
  });

  /* ===== Zoom ===== */
  zoomRange.addEventListener('input', function () {
    var oldZoom = currentZoom;
    currentZoom = parseFloat(zoomRange.value);
    zoomValueEl.textContent = Math.round(currentZoom * 100) + '%';

    // Zoom from center of viewport
    var vpW = viewport.clientWidth;
    var vpH = viewport.clientHeight;
    var cx = vpW / 2;
    var cy = vpH / 2;

    // The point under viewport center before zoom
    var imgCenterX = (cx - imgLeft) / (baseW * oldZoom);
    var imgCenterY = (cy - imgTop) / (baseH * oldZoom);

    // After zoom, keep that point under center
    imgLeft = Math.round(cx - imgCenterX * baseW * currentZoom);
    imgTop = Math.round(cy - imgCenterY * baseH * currentZoom);

    applyImagePosition();
    updatePreview();
  });

  /* ===== Mouse wheel zoom on viewport ===== */
  viewport.addEventListener('wheel', function (e) {
    if (!originalImage) return;
    e.preventDefault();

    var oldZoom = currentZoom;
    var delta = e.deltaY > 0 ? -0.1 : 0.1;
    currentZoom = Math.min(3, Math.max(0.2, currentZoom + delta));

    // Zoom towards mouse pointer
    var rect = viewport.getBoundingClientRect();
    var cx = e.clientX - rect.left;
    var cy = e.clientY - rect.top;

    var imgPointX = (cx - imgLeft) / (baseW * oldZoom);
    var imgPointY = (cy - imgTop) / (baseH * oldZoom);

    imgLeft = Math.round(cx - imgPointX * baseW * currentZoom);
    imgTop = Math.round(cy - imgPointY * baseH * currentZoom);

    zoomRange.value = currentZoom;
    zoomValueEl.textContent = Math.round(currentZoom * 100) + '%';

    applyImagePosition();
    updatePreview();
  }, { passive: false });

  /* ===== File drop zone ===== */
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
    if (e.dataTransfer.files.length > 0) loadImage(e.dataTransfer.files[0]);
  });
  browseBtn.addEventListener('click', function () { fileInput.click(); });
  dropzone.addEventListener('click', function (e) {
    if (e.target !== browseBtn) fileInput.click();
  });
  fileInput.addEventListener('change', function () {
    if (fileInput.files.length > 0) loadImage(fileInput.files[0]);
  });

  /* ===== Load image ===== */
  function loadImage(file) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('ফাইল সাইজ ১০ MB এর বেশি হতে পারবে না।');
      return;
    }

    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        originalImage = img;
        sourceImg.src = img.src;

        currentZoom = 1;
        zoomRange.value = 1;
        zoomValueEl.textContent = '100%';

        hideSection(dropzone);
        showSection(editor);
        hideSection(downloadBtn);
        resultBlob = null;

        requestAnimationFrame(function () {
          centerImage();
          updateCropFrame();
          updatePreview();
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* ===== Drag image within viewport (mouse + single-finger touch) ===== */
  viewport.addEventListener('mousedown', startDrag);

  function startDrag(e) {
    e.preventDefault();
    isDragging = true;

    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragImgLeft = imgLeft;
    dragImgTop = imgTop;

    viewport.classList.add('dragging');

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
  }

  function onDrag(e) {
    if (!isDragging) return;
    e.preventDefault();

    imgLeft = dragImgLeft + (e.clientX - dragStartX);
    imgTop = dragImgTop + (e.clientY - dragStartY);

    applyImagePosition();
    updatePreview();
  }

  function endDrag() {
    isDragging = false;
    viewport.classList.remove('dragging');
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
  }

  /* ===== Touch: single-finger drag + two-finger pinch-to-zoom ===== */
  function getTouchDist(t1, t2) {
    var dx = t1.clientX - t2.clientX;
    var dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getTouchCenter(t1, t2) {
    return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
  }

  viewport.addEventListener('touchstart', function (e) {
    e.preventDefault();

    if (e.touches.length === 2) {
      // Start pinch — cancel any ongoing drag
      isDragging = false;
      isPinching = true;
      pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
      pinchStartZoom = currentZoom;
      pinchStartImgLeft = imgLeft;
      pinchStartImgTop = imgTop;

      var center = getTouchCenter(e.touches[0], e.touches[1]);
      pinchCenterX = center.x;
      pinchCenterY = center.y;
    } else if (e.touches.length === 1 && !isPinching) {
      // Single finger drag
      isDragging = true;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      dragImgLeft = imgLeft;
      dragImgTop = imgTop;
      viewport.classList.add('dragging');
    }
  }, { passive: false });

  document.addEventListener('touchmove', function (e) {
    if (isPinching && e.touches.length === 2) {
      e.preventDefault();
      var newDist = getTouchDist(e.touches[0], e.touches[1]);
      var scale = newDist / pinchStartDist;
      var newZoom = Math.min(3, Math.max(0.2, pinchStartZoom * scale));

      // Zoom around the pinch center point
      var rect = viewport.getBoundingClientRect();
      var cx = pinchCenterX - rect.left;
      var cy = pinchCenterY - rect.top;

      // Image point under pinch center at start
      var imgPointX = (cx - pinchStartImgLeft) / (baseW * pinchStartZoom);
      var imgPointY = (cy - pinchStartImgTop) / (baseH * pinchStartZoom);

      currentZoom = newZoom;
      imgLeft = Math.round(cx - imgPointX * baseW * currentZoom);
      imgTop = Math.round(cy - imgPointY * baseH * currentZoom);

      // Sync the slider
      zoomRange.value = currentZoom;
      zoomValueEl.textContent = Math.round(currentZoom * 100) + '%';

      applyImagePosition();
      updatePreview();
    } else if (isDragging && e.touches.length === 1) {
      e.preventDefault();
      imgLeft = dragImgLeft + (e.touches[0].clientX - dragStartX);
      imgTop = dragImgTop + (e.touches[0].clientY - dragStartY);

      applyImagePosition();
      updatePreview();
    }
  }, { passive: false });

  document.addEventListener('touchend', function (e) {
    if (isPinching) {
      // If fewer than 2 fingers remain, end pinch
      if (e.touches.length < 2) {
        isPinching = false;
      }
    }
    if (e.touches.length === 0) {
      isDragging = false;
      isPinching = false;
      viewport.classList.remove('dragging');
    }
  });

  /* ===== Crop & Resize (final output) ===== */
  cropBtn.addEventListener('click', function () {
    if (!originalImage) return;

    var tw = getTargetW();
    var th = getTargetH();
    var minKb = parseInt(minKbInput.value, 10) || 0;
    var maxKb = parseInt(maxKbInput.value, 10) || 100;

    previewCanvas.width = tw;
    previewCanvas.height = th;
    previewCtx.clearRect(0, 0, tw, th);

    // Fill background
    previewCtx.fillStyle = currentMode === 'background' ? bgColor : '#FFFFFF';
    previewCtx.fillRect(0, 0, tw, th);

    var r = getCropRegion(tw, th);
    if (r.srcW > 0 && r.srcH > 0 && r.dstW > 0 && r.dstH > 0) {
      previewCtx.drawImage(originalImage,
        r.srcX, r.srcY, r.srcW, r.srcH,
        r.dstX, r.dstY, r.dstW, r.dstH);
    }

    compressToRange(previewCanvas, minKb, maxKb, function (blob, quality, warning) {
      resultBlob = blob;
      var sizeKb = (blob.size / 1024).toFixed(1);
      var info =
        'আউটপুট: ' + tw + '×' + th + 'px | ' +
        sizeKb + ' KB | ' +
        'কোয়ালিটি: ' + Math.round(quality * 100) + '%';
      if (warning) info += ' | ⚠️ ' + warning;
      infoEl.textContent = info;
      showSection(downloadBtn);
    });
  });

  /* ===== Compress JPEG to fit within min–max KB range ===== */
  function compressToRange(canvas, minKb, maxKb, callback) {
    var quality = 0.95;
    var minQuality = 0.1;
    var step = 0.05;
    var minBytes = minKb * 1024;
    var maxBytes = maxKb * 1024;

    function tryCompress() {
      canvas.toBlob(function (blob) {
        if (!blob) return;

        if (blob.size <= maxBytes || quality <= minQuality) {
          // Fits within max (or we hit minimum quality)
          var warning = '';
          if (minKb > 0 && blob.size < minBytes) {
            warning = 'ফাইল সর্বনিম্ন ' + minKb + 'KB এর নিচে — ছবির রেজোলিউশন বাড়ান (Below min ' + minKb + 'KB — use a higher resolution image)';
          }
          if (quality <= minQuality && blob.size > maxBytes) {
            warning = 'সর্বনিম্ন কোয়ালিটিতেও ' + maxKb + 'KB এর মধ্যে আনা যাচ্ছে না (Cannot fit within ' + maxKb + 'KB even at lowest quality)';
          }
          callback(blob, quality, warning);
        } else {
          // Still over max — if lowering quality would drop below min, stop here
          if (minKb > 0) {
            var nextQuality = quality - step;
            if (nextQuality < minQuality) nextQuality = minQuality;
            canvas.toBlob(function (testBlob) {
              if (testBlob && testBlob.size < minBytes) {
                // Next step would go below minimum — use current (over max but above min)
                callback(blob, quality, 'সর্বনিম্ন ও সর্বোচ্চ সীমার মধ্যে রাখা সম্ভব হচ্ছে না — ছবির সাইজ সামঞ্জস্য করুন (Cannot fit between ' + minKb + '–' + maxKb + 'KB)');
              } else {
                quality = nextQuality;
                tryCompress();
              }
            }, 'image/jpeg', nextQuality);
          } else {
            quality -= step;
            if (quality < minQuality) quality = minQuality;
            tryCompress();
          }
        }
      }, 'image/jpeg', quality);
    }

    tryCompress();
  }

  /* ===== Download ===== */
  downloadBtn.addEventListener('click', function () {
    if (!resultBlob) return;
    var a = document.createElement('a');
    a.href = URL.createObjectURL(resultBlob);
    a.download = 'photo-' + getTargetW() + 'x' + getTargetH() + '.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  });

  /* ===== Reset ===== */
  resetBtn.addEventListener('click', function () {
    originalImage = null;
    resultBlob = null;
    fileInput.value = '';
    sourceImg.src = '';
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    infoEl.textContent = '';
    imgLeft = 0; imgTop = 0;
    currentZoom = 1;
    zoomRange.value = 1;
    zoomValueEl.textContent = '100%';
    hideSection(editor);
    showSection(dropzone);
    hideSection(downloadBtn);
  });

})();
