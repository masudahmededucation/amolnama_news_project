/* ========== Background Remover Tool — Optimized ========== */
(function () {
  'use strict';

  /* ---- Smooth show / hide helpers ---- */
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

  /* ---- DOM refs ---- */
  var dropzone        = document.getElementById('bgr-dropzone');
  var fileInput       = document.getElementById('bgr-file-input');
  var browseBtn       = document.getElementById('bgr-browse-btn');
  var processingOverlay = document.getElementById('bgr-processing-overlay');
  var processingText  = document.getElementById('bgr-processing-text');
  var errorSection    = document.getElementById('bgr-error');
  var errorText       = document.getElementById('bgr-error-text');
  var tryAgainBtn     = document.getElementById('bgr-try-again-btn');
  var editor          = document.getElementById('bgr-editor');
  var originalCanvas  = document.getElementById('bgr-original-canvas');
  var resultCanvas    = document.getElementById('bgr-result-canvas');
  var resultWrap      = document.getElementById('bgr-result-wrap');
  var swatches        = document.querySelectorAll('.bgr-swatch');
  var customColorInput = document.getElementById('bgr-custom-color');
  var edgeSlider      = document.getElementById('bgr-edge-slider');
  var edgeValue       = document.getElementById('bgr-edge-value');
  var downloadPng     = document.getElementById('bgr-download-png');
  var downloadJpg     = document.getElementById('bgr-download-jpg');
  var resetBtn        = document.getElementById('bgr-reset-btn');

  /* Brush DOM refs */
  var brushTools      = document.getElementById('bgr-brush-tools');
  var brushMoveBtn    = document.getElementById('bgr-brush-move');
  var brushEraseBtn   = document.getElementById('bgr-brush-erase');
  var brushRestoreBtn = document.getElementById('bgr-brush-restore');
  var brushUndoBtn    = document.getElementById('bgr-brush-undo');
  var brushSizeSlider = document.getElementById('bgr-brush-size');
  var brushSizeValue  = document.getElementById('bgr-brush-size-value');
  var brushCursor     = document.getElementById('bgr-brush-cursor');

  /* Auto-refine DOM refs */
  var autoRefineBtn   = document.getElementById('bgr-auto-refine');

  /* Zoom & compare DOM refs */
  var resultTools     = document.getElementById('bgr-result-tools');
  var tipsBar         = document.getElementById('bgr-tips');
  var compareBtn      = document.getElementById('bgr-compare-btn');
  var zoomInBtn       = document.getElementById('bgr-zoom-in');
  var zoomOutBtn      = document.getElementById('bgr-zoom-out');
  var zoomLevelSpan   = document.getElementById('bgr-zoom-level');

  /* Edge shift DOM refs */
  var edgeShiftSlider = document.getElementById('bgr-edge-shift');
  var edgeShiftValue  = document.getElementById('bgr-edge-shift-value');

  /* Shadow DOM refs */
  var shadowBlurSlider = document.getElementById('bgr-shadow-blur');
  var shadowBlurValue = document.getElementById('bgr-shadow-blur-value');

  /* Copy & clipboard */
  var copyBtn         = document.getElementById('bgr-copy-btn');

  /* ---- State ---- */
  var segmenter     = null;
  var modelLoaded   = false;
  var processing    = false;
  var originalImage = null;
  var maskData      = null;
  var maskWidth     = 0;
  var maskHeight    = 0;
  var currentBg     = 'transparent';
  var fileName      = 'image';

  /* Mask layers */
  var featheredMask = null;
  var brushDelta    = null;
  var workingMask   = null;

  /* Brush state */
  var brushMode     = null;
  var painting      = false;
  var lastPaintX    = -1;
  var lastPaintY    = -1;

  /* Undo history */
  var undoStack     = [];
  var MAX_UNDO      = 30;

  /* Auto-refine state */
  var autoRefineOn      = false;
  var refinedPixelData  = null;

  /* Zoom state */
  var zoomLevel         = 1;
  var ZOOM_STEPS        = [1, 1.5, 2, 3, 4];
  var baseCanvasWidth   = 0;
  var baseCanvasHeight  = 0;

  /* Shadow state */
  var shadowBlur        = 0;

  /* Compare state */
  var comparing         = false;
  var savedResultData   = null;

  /* Pan state */
  var panning           = false;
  var panStartX         = 0;
  var panStartY         = 0;
  var panScrollStartX   = 0;
  var panScrollStartY   = 0;
  var spaceHeld         = false;

  /* Touch pan state */
  var touchPanning      = false;
  var touchStartX       = 0;
  var touchStartY       = 0;
  var touchScrollStartX = 0;
  var touchScrollStartY = 0;

  /* Cached original pixel data */
  var origPixelData = null;

  /* ---- Constants ---- */
  var MAX_FILE_SIZE = 10 * 1024 * 1024;
  var MAX_IMAGE_DIM = 2048; /* Cap image size to prevent browser freeze */
  var BRUSH_INTENSITY = 0.35;

  /* ---- Enable / disable controls while processing ---- */
  function setControlsEnabled(enabled) {
    processing = !enabled;
    downloadPng.disabled = !enabled;
    downloadJpg.disabled = !enabled;
    edgeSlider.disabled = !enabled;
    downloadPng.style.opacity = enabled ? '' : '.5';
    downloadJpg.style.opacity = enabled ? '' : '.5';
  }

  /* ============================================================
     MediaPipe SelfieSegmentation
     ============================================================ */
  function initSegmenter() {
    if (segmenter) return Promise.resolve();

    return new Promise(function (resolve, reject) {
      try {
        segmenter = new SelfieSegmentation({
          locateFile: function (file) {
            return 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/' + file;
          }
        });

        segmenter.setOptions({ modelSelection: 1 });

        segmenter.onResults(function (results) {
          var mask = results.segmentationMask;
          var tempCanvas = document.createElement('canvas');
          tempCanvas.width = mask.width;
          tempCanvas.height = mask.height;
          var ctx = tempCanvas.getContext('2d');
          ctx.drawImage(mask, 0, 0);
          var imgData = ctx.getImageData(0, 0, mask.width, mask.height);

          maskWidth = mask.width;
          maskHeight = mask.height;
          maskData = new Float32Array(mask.width * mask.height);
          for (var i = 0; i < maskData.length; i++) {
            maskData[i] = imgData.data[i * 4] / 255;
          }

          modelLoaded = true;

          var w = originalImage.naturalWidth;
          var h = originalImage.naturalHeight;

          /* Downscale if too large */
          var scale = 1;
          if (w > MAX_IMAGE_DIM || h > MAX_IMAGE_DIM) {
            scale = Math.min(MAX_IMAGE_DIM / w, MAX_IMAGE_DIM / h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
            /* Redraw original canvas at capped size */
            originalCanvas.width = w;
            originalCanvas.height = h;
            originalCanvas.getContext('2d').drawImage(originalImage, 0, 0, w, h);
          }

          origPixelData = originalCanvas.getContext('2d').getImageData(0, 0, w, h);
          brushDelta = new Float32Array(w * h);

          /* Use async composite to avoid freeze */
          compositeResultAsync(function () {
            showSection(brushTools);
            resultTools.style.display = '';
            if (tipsBar) tipsBar.style.display = '';
            hideSection(processingOverlay);
            setControlsEnabled(true);
            requestAnimationFrame(function () { captureBaseSize(); });
          });
        });

        segmenter.initialize().then(function () {
          resolve();
        }).catch(function (err) {
          reject(err);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  /* ============================================================
     Optimized box blur — running-sum approach, O(w*h) per pass
     ============================================================ */
  function boxBlurFast(src, w, h, radius) {
    if (radius < 1) return new Float32Array(src);

    var buf = new Float32Array(src);
    var out = new Float32Array(src.length);
    var i, x, y, sum, count, li, ri;

    for (var pass = 0; pass < 3; pass++) {
      /* Horizontal pass */
      for (y = 0; y < h; y++) {
        var rowOff = y * w;
        sum = 0;
        count = 0;
        /* Seed the window */
        for (x = 0; x <= radius && x < w; x++) {
          sum += buf[rowOff + x];
          count++;
        }
        for (x = 0; x < w; x++) {
          out[rowOff + x] = sum / count;
          /* Expand right edge */
          ri = x + radius + 1;
          if (ri < w) { sum += buf[rowOff + ri]; count++; }
          /* Shrink left edge */
          li = x - radius;
          if (li >= 0) { sum -= buf[rowOff + li]; count--; }
        }
      }

      /* Vertical pass */
      for (x = 0; x < w; x++) {
        sum = 0;
        count = 0;
        for (y = 0; y <= radius && y < h; y++) {
          sum += out[y * w + x];
          count++;
        }
        for (y = 0; y < h; y++) {
          buf[y * w + x] = sum / count;
          ri = y + radius + 1;
          if (ri < h) { sum += out[ri * w + x]; count++; }
          li = y - radius;
          if (li >= 0) { sum -= out[li * w + x]; count--; }
        }
      }
    }

    return buf;
  }

  function applyThreshold(mask, low, high) {
    if (low === undefined) low = 0.15;
    if (high === undefined) high = 0.85;
    var range = high - low;
    if (range <= 0) range = 0.01;
    var out = new Float32Array(mask.length);
    for (var i = 0; i < mask.length; i++) {
      var v = mask[i];
      if (v <= low) { out[i] = 0; }
      else if (v >= high) { out[i] = 1; }
      else {
        out[i] = (v - low) / range;
        out[i] = out[i] * out[i] * (3 - 2 * out[i]);
      }
    }
    return out;
  }

  function featherMaskFn(raw, w, h, radius, threshLow, threshHigh) {
    if (radius < 1) return applyThreshold(raw, threshLow, threshHigh);
    var blurred = boxBlurFast(raw, w, h, radius);
    return applyThreshold(blurred, threshLow, threshHigh);
  }

  /* ============================================================
     Build working mask = featheredMask + brushDelta (clamped 0-1)
     ============================================================ */
  function buildWorkingMask() {
    if (!featheredMask || !brushDelta) return;
    var len = featheredMask.length;
    if (!workingMask || workingMask.length !== len) {
      workingMask = new Float32Array(len);
    }
    for (var i = 0; i < len; i++) {
      var v = featheredMask[i] + brushDelta[i];
      workingMask[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }

  /* ============================================================
     Auto-refine — color decontamination (chunked to avoid freeze)
     ============================================================ */
  function computeEdgeRefinement(callback) {
    if (!workingMask || !origPixelData) { if (callback) callback(); return; }

    var w = resultCanvas.width;
    var h = resultCanvas.height;
    var src = origPixelData.data;
    var refined = new Uint8ClampedArray(src);

    var EDGE_LOW  = 0.02;
    var EDGE_HIGH = 0.92;
    var SEARCH_R  = 5;

    var y = 0;
    var CHUNK = 50; /* rows per frame */

    function processChunk() {
      var yEnd = Math.min(y + CHUNK, h);

      for (; y < yEnd; y++) {
        for (var x = 0; x < w; x++) {
          var idx = y * w + x;
          var alpha = workingMask[idx];
          if (alpha <= EDGE_LOW || alpha >= EDGE_HIGH) continue;

          var sumR = 0, sumG = 0, sumB = 0, totalW = 0;
          var nx0 = Math.max(0, x - SEARCH_R);
          var nx1 = Math.min(w - 1, x + SEARCH_R);
          var ny0 = Math.max(0, y - SEARCH_R);
          var ny1 = Math.min(h - 1, y + SEARCH_R);

          for (var ny = ny0; ny <= ny1; ny++) {
            for (var nx = nx0; nx <= nx1; nx++) {
              var nIdx = ny * w + nx;
              if (workingMask[nIdx] < EDGE_HIGH) continue;
              var ddx = nx - x, ddy = ny - y;
              var dist = Math.sqrt(ddx * ddx + ddy * ddy);
              if (dist > SEARCH_R) continue;
              var wt = 1 / (1 + dist);
              var pIdx = nIdx * 4;
              sumR += src[pIdx] * wt;
              sumG += src[pIdx + 1] * wt;
              sumB += src[pIdx + 2] * wt;
              totalW += wt;
            }
          }

          if (totalW > 0) {
            var pIdx2 = idx * 4;
            var t = (alpha - EDGE_LOW) / (EDGE_HIGH - EDGE_LOW);
            var fgR = sumR / totalW, fgG = sumG / totalW, fgB = sumB / totalW;
            refined[pIdx2]     = Math.round(src[pIdx2] * t + fgR * (1 - t));
            refined[pIdx2 + 1] = Math.round(src[pIdx2 + 1] * t + fgG * (1 - t));
            refined[pIdx2 + 2] = Math.round(src[pIdx2 + 2] * t + fgB * (1 - t));
          }
        }
      }

      if (y < h) {
        setTimeout(processChunk, 0); /* yield to browser */
      } else {
        refinedPixelData = new ImageData(refined, w, h);
        if (callback) callback();
      }
    }

    processChunk();
  }

  function getSourcePixels() {
    return (autoRefineOn && refinedPixelData) ? refinedPixelData : origPixelData;
  }

  /* ============================================================
     Zoom
     ============================================================ */
  function captureBaseSize() {
    baseCanvasWidth = resultCanvas.clientWidth;
    baseCanvasHeight = resultCanvas.clientHeight;
  }

  function applyZoom() {
    if (zoomLevel <= 1) {
      resultCanvas.style.width = '';
      resultCanvas.style.height = '';
      resultCanvas.style.maxWidth = '';
      resultCanvas.style.maxHeight = '';
      resultWrap.classList.remove('bgr-zoomed');
    } else {
      resultCanvas.style.maxWidth = 'none';
      resultCanvas.style.maxHeight = 'none';
      resultCanvas.style.width = Math.round(baseCanvasWidth * zoomLevel) + 'px';
      resultCanvas.style.height = Math.round(baseCanvasHeight * zoomLevel) + 'px';
      resultWrap.classList.add('bgr-zoomed');
    }
    zoomLevelSpan.textContent = zoomLevel + '×';
    zoomOutBtn.disabled = (zoomLevel <= ZOOM_STEPS[0]);
    zoomInBtn.disabled = (zoomLevel >= ZOOM_STEPS[ZOOM_STEPS.length - 1]);
  }

  function zoomIn() {
    for (var i = 0; i < ZOOM_STEPS.length; i++) {
      if (ZOOM_STEPS[i] > zoomLevel) { zoomLevel = ZOOM_STEPS[i]; break; }
    }
    applyZoom();
  }

  function zoomOut() {
    for (var i = ZOOM_STEPS.length - 1; i >= 0; i--) {
      if (ZOOM_STEPS[i] < zoomLevel) { zoomLevel = ZOOM_STEPS[i]; break; }
    }
    applyZoom();
  }

  function resetZoom() {
    zoomLevel = 1;
    applyZoom();
  }

  /* ============================================================
     Composite + Render — async pipeline with yields between steps
     ============================================================ */

  /* Generation counter — prevents stale callbacks from old operations */
  var opGen = 0;

  /* Reusable offscreen canvas for shadow compositing */
  var shadowCanvas = null;
  var shadowCtx = null;

  function renderFullResult() {
    if (!workingMask || !origPixelData) return;

    var w = resultCanvas.width;
    var h = resultCanvas.height;
    var resCtx = resultCanvas.getContext('2d');

    var bgR = 0, bgG = 0, bgB = 0;
    if (currentBg !== 'transparent') {
      var parsed = parseHexColor(currentBg);
      bgR = parsed.r; bgG = parsed.g; bgB = parsed.b;
      resultWrap.classList.remove('bgr-checkerboard');
    } else {
      resultWrap.classList.add('bgr-checkerboard');
    }

    var result = resCtx.createImageData(w, h);
    var srcData = getSourcePixels();
    var src = srcData.data;
    var dst = result.data;
    var isTransp = (currentBg === 'transparent');

    for (var i = 0; i < workingMask.length; i++) {
      var alpha = workingMask[i];
      var idx = i * 4;

      if (isTransp) {
        dst[idx]     = src[idx];
        dst[idx + 1] = src[idx + 1];
        dst[idx + 2] = src[idx + 2];
        dst[idx + 3] = (alpha * 255 + 0.5) | 0;
      } else {
        dst[idx]     = (src[idx] * alpha + bgR * (1 - alpha) + 0.5) | 0;
        dst[idx + 1] = (src[idx + 1] * alpha + bgG * (1 - alpha) + 0.5) | 0;
        dst[idx + 2] = (src[idx + 2] * alpha + bgB * (1 - alpha) + 0.5) | 0;
        dst[idx + 3] = 255;
      }
    }

    if (shadowBlur > 0) {
      /* Reuse shadow canvas */
      if (!shadowCanvas) {
        shadowCanvas = document.createElement('canvas');
        shadowCtx = shadowCanvas.getContext('2d');
      }
      shadowCanvas.width = w;
      shadowCanvas.height = h;

      var transpResult = shadowCtx.createImageData(w, h);
      var transpDst = transpResult.data;
      for (var j = 0; j < workingMask.length; j++) {
        var a2 = workingMask[j];
        var j4 = j * 4;
        transpDst[j4]     = src[j4];
        transpDst[j4 + 1] = src[j4 + 1];
        transpDst[j4 + 2] = src[j4 + 2];
        transpDst[j4 + 3] = (a2 * 255 + 0.5) | 0;
      }
      shadowCtx.putImageData(transpResult, 0, 0);

      resCtx.clearRect(0, 0, w, h);
      if (!isTransp) {
        resCtx.fillStyle = currentBg;
        resCtx.fillRect(0, 0, w, h);
      }
      resCtx.shadowColor = 'rgba(0,0,0,0.3)';
      resCtx.shadowBlur = shadowBlur;
      resCtx.shadowOffsetX = 4;
      resCtx.shadowOffsetY = 6;
      resCtx.drawImage(shadowCanvas, 0, 0);
      resCtx.shadowColor = 'transparent';
    } else {
      resCtx.putImageData(result, 0, 0);
    }
  }

  /**
   * Async composite pipeline — chains heavy steps with setTimeout yields
   * so the browser can paint and handle input between each step.
   * A generation counter cancels stale callbacks if a new operation starts.
   */
  var compositeTimer = null;

  function compositeResultAsync(callback) {
    if (!originalImage || !maskData) return;

    var gen = ++opGen;
    processingText.textContent = 'প্রয়োগ হচ্ছে… (Applying…)';
    processingOverlay.style.display = '';
    clearTimeout(compositeTimer);

    var w = originalCanvas.width;
    var h = originalCanvas.height;
    var radius = parseInt(edgeSlider.value, 10);
    var shift = parseInt(edgeShiftSlider.value, 10);
    var threshLow = Math.max(0.01, 0.15 - shift * 0.04);
    var threshHigh = Math.min(0.99, 0.85 - shift * 0.04);

    /* Step 1: Scale mask (yield) */
    compositeTimer = setTimeout(function () {
      if (gen !== opGen) return; /* cancelled */
      var scaledMask = scaleMask(maskData, maskWidth, maskHeight, w, h);

      /* Step 2: Blur + threshold (yield) */
      setTimeout(function () {
        if (gen !== opGen) return;
        featheredMask = featherMaskFn(scaledMask, w, h, radius, threshLow, threshHigh);

        /* Step 3: Build working mask + render (yield) */
        setTimeout(function () {
          if (gen !== opGen) return;
          buildWorkingMask();
          resultCanvas.width = w;
          resultCanvas.height = h;

          if (autoRefineOn) {
            computeEdgeRefinement(function () {
              if (gen !== opGen) return;
              renderFullResult();
              processingOverlay.style.display = 'none';
              if (callback) callback();
            });
          } else {
            renderFullResult();
            processingOverlay.style.display = 'none';
            if (callback) callback();
          }
        }, 0);
      }, 0);
    }, 0);
  }

  /* Quick render-only async (bg/shadow changes — no re-feathering needed) */
  function renderAsync(callback) {
    var gen = ++opGen;
    processingText.textContent = 'প্রয়োগ হচ্ছে… (Applying…)';
    processingOverlay.style.display = '';
    clearTimeout(compositeTimer);
    compositeTimer = setTimeout(function () {
      if (gen !== opGen) return;
      renderFullResult();
      processingOverlay.style.display = 'none';
      if (callback) callback();
    }, 0);
  }

  /* ============================================================
     Brush painting — fast local update
     ============================================================ */

  function pointerToCanvas(e) {
    var rect = resultCanvas.getBoundingClientRect();
    var scaleX = resultCanvas.width / rect.width;
    var scaleY = resultCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function getBrushCanvasRadius() {
    var displayPx = parseInt(brushSizeSlider.value, 10);
    var rect = resultCanvas.getBoundingClientRect();
    var scale = resultCanvas.width / rect.width;
    return displayPx * scale * 0.5;
  }

  function paintDab(cx, cy) {
    if (!workingMask || !origPixelData) return;

    var w = resultCanvas.width;
    var h = resultCanvas.height;
    var r = getBrushCanvasRadius();
    var rSq = r * r;

    var x0 = Math.max(0, Math.floor(cx - r));
    var y0 = Math.max(0, Math.floor(cy - r));
    var x1 = Math.min(w, Math.ceil(cx + r));
    var y1 = Math.min(h, Math.ceil(cy + r));

    if (x0 >= x1 || y0 >= y1) return;

    var rw = x1 - x0;
    var rh = y1 - y0;
    var resCtx = resultCanvas.getContext('2d');
    var regionData = resCtx.getImageData(x0, y0, rw, rh);
    var dst = regionData.data;
    var srcData = getSourcePixels();
    var src = srcData.data;

    var bgR = 0, bgG = 0, bgB = 0;
    var isTransparent = (currentBg === 'transparent');
    if (!isTransparent) {
      var parsed = parseHexColor(currentBg);
      bgR = parsed.r; bgG = parsed.g; bgB = parsed.b;
    }

    var erasing = (brushMode === 'erase');

    for (var py = y0; py < y1; py++) {
      for (var px = x0; px < x1; px++) {
        var dx = px - cx;
        var dy = py - cy;
        var distSq = dx * dx + dy * dy;
        if (distSq > rSq) continue;

        var dist = Math.sqrt(distSq);
        var strength = 1 - (dist / r);
        strength = strength * strength * BRUSH_INTENSITY;

        var maskIdx = py * w + px;

        if (erasing) {
          brushDelta[maskIdx] -= strength;
        } else {
          brushDelta[maskIdx] += strength;
        }

        var v = featheredMask[maskIdx] + brushDelta[maskIdx];
        v = v < 0 ? 0 : v > 1 ? 1 : v;
        workingMask[maskIdx] = v;

        var localIdx = ((py - y0) * rw + (px - x0)) * 4;
        var srcIdx = maskIdx * 4;

        if (isTransparent) {
          dst[localIdx]     = src[srcIdx];
          dst[localIdx + 1] = src[srcIdx + 1];
          dst[localIdx + 2] = src[srcIdx + 2];
          dst[localIdx + 3] = Math.round(v * 255);
        } else {
          dst[localIdx]     = Math.round(src[srcIdx] * v + bgR * (1 - v));
          dst[localIdx + 1] = Math.round(src[srcIdx + 1] * v + bgG * (1 - v));
          dst[localIdx + 2] = Math.round(src[srcIdx + 2] * v + bgB * (1 - v));
          dst[localIdx + 3] = 255;
        }
      }
    }

    resCtx.putImageData(regionData, x0, y0);
  }

  function paintLine(fromX, fromY, toX, toY) {
    var dx = toX - fromX;
    var dy = toY - fromY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var r = getBrushCanvasRadius();
    var step = Math.max(1, r * 0.3);
    var steps = Math.ceil(dist / step);

    for (var i = 0; i <= steps; i++) {
      var t = steps === 0 ? 0 : i / steps;
      paintDab(fromX + dx * t, fromY + dy * t);
    }
  }

  /* ============================================================
     Brush cursor
     ============================================================ */
  function updateBrushCursor(e) {
    if (!brushMode) return;
    var rect = resultWrap.getBoundingClientRect();
    var x = e.clientX - rect.left + resultWrap.scrollLeft;
    var y = e.clientY - rect.top + resultWrap.scrollTop;
    var size = parseInt(brushSizeSlider.value, 10);
    brushCursor.style.width = size + 'px';
    brushCursor.style.height = size + 'px';
    brushCursor.style.left = x + 'px';
    brushCursor.style.top = y + 'px';
    brushCursor.style.display = 'block';
  }

  function hideBrushCursor() {
    brushCursor.style.display = 'none';
  }

  /* ============================================================
     Scale mask (bilinear)
     ============================================================ */
  function scaleMask(mask, mw, mh, tw, th) {
    if (mw === tw && mh === th) return new Float32Array(mask);

    var out = new Float32Array(tw * th);
    var xRatio = mw / tw;
    var yRatio = mh / th;

    for (var y = 0; y < th; y++) {
      for (var x = 0; x < tw; x++) {
        var srcX = x * xRatio;
        var srcY = y * yRatio;
        var x0 = Math.floor(srcX);
        var y0 = Math.floor(srcY);
        var x1 = Math.min(x0 + 1, mw - 1);
        var y1 = Math.min(y0 + 1, mh - 1);
        var xFrac = srcX - x0;
        var yFrac = srcY - y0;

        var tl = mask[y0 * mw + x0];
        var tr = mask[y0 * mw + x1];
        var bl = mask[y1 * mw + x0];
        var br = mask[y1 * mw + x1];

        var top = tl + (tr - tl) * xFrac;
        var bot = bl + (br - bl) * xFrac;
        out[y * tw + x] = top + (bot - top) * yFrac;
      }
    }
    return out;
  }

  function parseHexColor(hex) {
    hex = hex.replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16)
    };
  }

  /* ============================================================
     Process image through segmenter
     ============================================================ */
  function processImage(file) {
    if (!file || !file.type.startsWith('image/')) {
      showError('শুধুমাত্র ছবি ফাইল সমর্থিত (Only image files are supported)');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showError('ফাইল সাইজ ১০ MB এর বেশি (File exceeds 10 MB limit)');
      return;
    }

    fileName = file.name.replace(/\.[^.]+$/, '') || 'image';

    var img = new Image();
    img.onload = function () {
      originalImage = img;

      var w = img.naturalWidth;
      var h = img.naturalHeight;

      /* Downscale for processing if too large */
      var scale = 1;
      if (w > MAX_IMAGE_DIM || h > MAX_IMAGE_DIM) {
        scale = Math.min(MAX_IMAGE_DIM / w, MAX_IMAGE_DIM / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      originalCanvas.width = w;
      originalCanvas.height = h;
      originalCanvas.getContext('2d').drawImage(img, 0, 0, w, h);

      resultCanvas.width = w;
      resultCanvas.height = h;

      hideSection(dropzone);
      hideSection(errorSection);
      showSection(editor);

      setControlsEnabled(false);
      processingText.textContent = 'AI মডেল লোড হচ্ছে… (Loading AI model…)';
      showSection(processingOverlay);

      initSegmenter().then(function () {
        processingText.textContent = 'ব্যাকগ্রাউন্ড সনাক্ত হচ্ছে… (Detecting background…)';
        return segmenter.send({ image: img });
      }).catch(function (err) {
        hideSection(processingOverlay);
        hideSection(editor);
        showError('AI মডেল লোড করতে সমস্যা হয়েছে। পেজ রিফ্রেশ করে আবার চেষ্টা করুন। (Failed to load AI model. Please refresh and try again.)');
      });
    };
    img.onerror = function () {
      showError('ছবি পড়তে সমস্যা হয়েছে (Failed to read image)');
    };

    var reader = new FileReader();
    reader.onload = function (e) { img.src = e.target.result; };
    reader.readAsDataURL(file);
  }

  function showError(msg) {
    errorText.textContent = msg;
    hideSection(editor);
    hideSection(processingOverlay);
    showSection(errorSection);
  }

  function resetAll() {
    hideSection(editor);
    hideSection(errorSection);
    hideSection(processingOverlay);
    hideSection(brushTools);
    showSection(dropzone);
    originalImage = null;
    maskData = null;
    featheredMask = null;
    brushDelta = null;
    workingMask = null;
    origPixelData = null;
    refinedPixelData = null;
    autoRefineOn = false;
    autoRefineBtn.classList.remove('active');
    undoStack = [];
    fileInput.value = '';
    currentBg = 'transparent';
    edgeSlider.value = 3;
    edgeValue.textContent = '3';
    shadowBlurSlider.value = 0;
    shadowBlurValue.textContent = '0';
    shadowBlur = 0;
    edgeShiftSlider.value = 0;
    edgeShiftValue.textContent = '0';
    savedResultData = null;
    setControlsEnabled(true);
    deactivateBrush();
    updateUndoBtn();
    resetZoom();
    resultTools.style.display = 'none';
    if (tipsBar) tipsBar.style.display = 'none';

    swatches.forEach(function (s) { s.classList.remove('active'); });
    document.querySelector('.bgr-swatch--transparent').classList.add('active');
    resultWrap.classList.add('bgr-checkerboard');
  }

  /* ============================================================
     Download helpers
     ============================================================ */
  function downloadCanvas(format) {
    if (!resultCanvas.width || processing) return;
    var mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    var ext = format === 'jpg' ? '.jpg' : '.png';
    var quality = format === 'jpg' ? 0.92 : undefined;

    var canvas = resultCanvas;
    if (format === 'jpg' && currentBg === 'transparent') {
      canvas = document.createElement('canvas');
      canvas.width = resultCanvas.width;
      canvas.height = resultCanvas.height;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(resultCanvas, 0, 0);
    }

    canvas.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName + '-no-bg' + ext;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    }, mime, quality);
  }

  /* ============================================================
     Brush mode management
     ============================================================ */
  function activateBrush(mode) {
    brushMode = mode;
    brushMoveBtn.classList.toggle('active', false);
    brushEraseBtn.classList.toggle('active', mode === 'erase');
    brushRestoreBtn.classList.toggle('active', mode === 'restore');
    resultWrap.classList.add('bgr-brush-active');
  }

  function deactivateBrush() {
    brushMode = null;
    painting = false;
    brushMoveBtn.classList.add('active');
    brushEraseBtn.classList.remove('active');
    brushRestoreBtn.classList.remove('active');
    resultWrap.classList.remove('bgr-brush-active');
    hideBrushCursor();
  }

  /* ============================================================
     Event listeners
     ============================================================ */

  /* Dropzone */
  browseBtn.addEventListener('click', function () { fileInput.click(); });
  dropzone.addEventListener('click', function (e) {
    if (e.target !== browseBtn) fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length) processImage(fileInput.files[0]);
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
    if (e.dataTransfer.files.length) processImage(e.dataTransfer.files[0]);
  });

  /* Background swatches */
  swatches.forEach(function (swatch) {
    swatch.addEventListener('click', function () {
      if (processing) return;
      var bg = swatch.getAttribute('data-bg');
      if (!bg) return;

      swatches.forEach(function (s) { s.classList.remove('active'); });
      swatch.classList.add('active');
      currentBg = bg;

      if (workingMask) renderAsync();
    });
  });

  /* Custom color picker */
  customColorInput.addEventListener('input', function () {
    if (processing) return;
    swatches.forEach(function (s) { s.classList.remove('active'); });
    var customSwatch = document.querySelector('.bgr-swatch--custom');
    customSwatch.classList.add('active');
    customSwatch.style.background = customColorInput.value;
    currentBg = customColorInput.value;

    if (workingMask) renderAsync();
  });

  /* Edge slider */
  edgeSlider.addEventListener('input', function () {
    edgeValue.textContent = edgeSlider.value;
  });
  edgeSlider.addEventListener('change', function () {
    if (!processing) compositeResultAsync();
  });

  /* Edge shift slider */
  edgeShiftSlider.addEventListener('input', function () {
    edgeShiftValue.textContent = edgeShiftSlider.value;
  });
  edgeShiftSlider.addEventListener('change', function () {
    if (!processing) compositeResultAsync();
  });

  /* Shadow blur slider */
  shadowBlurSlider.addEventListener('input', function () {
    shadowBlur = parseInt(shadowBlurSlider.value, 10);
    shadowBlurValue.textContent = shadowBlur;
  });
  shadowBlurSlider.addEventListener('change', function () {
    shadowBlur = parseInt(shadowBlurSlider.value, 10);
    if (workingMask) renderAsync();
  });

  /* Hold-to-compare */
  compareBtn.addEventListener('pointerdown', function (e) {
    if (!workingMask || processing) return;
    e.preventDefault();
    comparing = true;
    compareBtn.classList.add('active');

    var resCtx = resultCanvas.getContext('2d');
    savedResultData = resCtx.getImageData(0, 0, resultCanvas.width, resultCanvas.height);
    resCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    resCtx.drawImage(originalCanvas, 0, 0, resultCanvas.width, resultCanvas.height);
    resultWrap.classList.remove('bgr-checkerboard');
  });

  function endCompare() {
    if (!comparing) return;
    comparing = false;
    compareBtn.classList.remove('active');
    if (savedResultData) {
      resultCanvas.getContext('2d').putImageData(savedResultData, 0, 0);
      savedResultData = null;
    }
    if (currentBg === 'transparent') {
      resultWrap.classList.add('bgr-checkerboard');
    }
  }

  compareBtn.addEventListener('pointerup', endCompare);
  compareBtn.addEventListener('pointerleave', endCompare);
  compareBtn.addEventListener('pointercancel', endCompare);

  /* Copy to clipboard */
  copyBtn.addEventListener('click', function () {
    if (!resultCanvas.width || processing) return;
    resultCanvas.toBlob(function (blob) {
      if (!blob) return;
      if (navigator.clipboard && navigator.clipboard.write) {
        navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]).then(function () {
          copyBtn.textContent = '✅ কপি হয়েছে!';
          copyBtn.classList.add('bgr-copied');
          setTimeout(function () {
            copyBtn.textContent = '📋 কপি (Copy)';
            copyBtn.classList.remove('bgr-copied');
          }, 2000);
        }).catch(function () {
          copyBtn.textContent = '❌ কপি ব্যর্থ';
          setTimeout(function () {
            copyBtn.textContent = '📋 কপি (Copy)';
          }, 2000);
        });
      }
    }, 'image/png');
  });

  /* Paste from clipboard */
  document.addEventListener('paste', function (e) {
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        var file = items[i].getAsFile();
        if (file) processImage(file);
        break;
      }
    }
  });

  /* Download buttons */
  downloadPng.addEventListener('click', function () { downloadCanvas('png'); });
  downloadJpg.addEventListener('click', function () { downloadCanvas('jpg'); });

  /* Reset */
  resetBtn.addEventListener('click', resetAll);
  tryAgainBtn.addEventListener('click', resetAll);

  /* ---- Auto-refine toggle ---- */
  autoRefineBtn.addEventListener('click', function () {
    if (processing || !workingMask) return;

    autoRefineOn = !autoRefineOn;
    autoRefineBtn.classList.toggle('active', autoRefineOn);

    if (autoRefineOn) {
      processingText.textContent = 'কিনারা পরিষ্কার হচ্ছে… (Refining edges…)';
      processingOverlay.style.display = '';
      computeEdgeRefinement(function () {
        renderFullResult();
        processingOverlay.style.display = 'none';
      });
    } else {
      refinedPixelData = null;
      renderFullResult();
    }
  });

  /* ---- Zoom buttons ---- */
  zoomInBtn.addEventListener('click', function () { zoomIn(); });
  zoomOutBtn.addEventListener('click', function () { zoomOut(); });

  /* Mouse wheel zoom on result canvas */
  resultWrap.addEventListener('wheel', function (e) {
    if (!modelLoaded) return;
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    if (e.deltaY < 0) { zoomIn(); } else { zoomOut(); }
  }, { passive: false });

  /* ---- Brush tool buttons ---- */
  brushMoveBtn.addEventListener('click', function () {
    deactivateBrush();
  });
  brushEraseBtn.addEventListener('click', function () {
    if (brushMode === 'erase') { deactivateBrush(); } else { activateBrush('erase'); }
  });
  brushRestoreBtn.addEventListener('click', function () {
    if (brushMode === 'restore') { deactivateBrush(); } else { activateBrush('restore'); }
  });

  /* Brush undo */
  function updateUndoBtn() {
    brushUndoBtn.disabled = undoStack.length === 0;
  }

  brushUndoBtn.addEventListener('click', function () {
    if (!brushDelta || undoStack.length === 0) return;
    var snapshot = undoStack.pop();
    brushDelta = snapshot;
    buildWorkingMask();
    renderFullResult();
    updateUndoBtn();
  });

  /* Brush size slider */
  brushSizeSlider.addEventListener('input', function () {
    brushSizeValue.textContent = brushSizeSlider.value + 'px';
  });

  /* ---- Pointer events on result canvas for brush painting ---- */
  resultCanvas.addEventListener('pointerdown', function (e) {
    if (!brushMode || processing) return;
    if (spaceHeld || e.button === 1) return;
    e.preventDefault();
    resultCanvas.setPointerCapture(e.pointerId);

    if (brushDelta) {
      if (undoStack.length >= MAX_UNDO) undoStack.shift();
      undoStack.push(new Float32Array(brushDelta));
    }

    painting = true;
    var pt = pointerToCanvas(e);
    lastPaintX = pt.x;
    lastPaintY = pt.y;
    paintDab(pt.x, pt.y);
  });

  resultCanvas.addEventListener('pointermove', function (e) {
    updateBrushCursor(e);
    if (!painting) return;
    e.preventDefault();
    var pt = pointerToCanvas(e);
    paintLine(lastPaintX, lastPaintY, pt.x, pt.y);
    lastPaintX = pt.x;
    lastPaintY = pt.y;
  });

  resultCanvas.addEventListener('pointerup', function (e) {
    if (painting) {
      painting = false;
      resultCanvas.releasePointerCapture(e.pointerId);
      updateUndoBtn();
    }
  });

  resultCanvas.addEventListener('pointerleave', function () {
    painting = false;
    hideBrushCursor();
  });

  resultWrap.addEventListener('pointerenter', function (e) {
    if (brushMode && !spaceHeld) updateBrushCursor(e);
  });
  resultWrap.addEventListener('pointerleave', function () {
    hideBrushCursor();
  });

  /* ---- Pan: click+drag when no brush or middle-click or space+drag ---- */

  function shouldPan(e) {
    if (e.button === 1) return true;
    if (spaceHeld) return true;
    if (!brushMode) return true;
    return false;
  }

  resultWrap.addEventListener('pointerdown', function (e) {
    if (!modelLoaded || zoomLevel <= 1) return;
    if (!shouldPan(e)) return;
    if (brushMode && !spaceHeld && e.button !== 1) return;

    e.preventDefault();
    panning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panScrollStartX = resultWrap.scrollLeft;
    panScrollStartY = resultWrap.scrollTop;
    resultWrap.setPointerCapture(e.pointerId);
    resultWrap.classList.add('bgr-panning');
    hideBrushCursor();
  });

  resultWrap.addEventListener('pointermove', function (e) {
    if (!panning) return;
    e.preventDefault();
    resultWrap.scrollLeft = panScrollStartX - (e.clientX - panStartX);
    resultWrap.scrollTop = panScrollStartY - (e.clientY - panStartY);
  });

  resultWrap.addEventListener('pointerup', function (e) {
    if (!panning) return;
    panning = false;
    resultWrap.releasePointerCapture(e.pointerId);
    resultWrap.classList.remove('bgr-panning');
  });

  /* Space key for pan mode */
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && !e.repeat && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      spaceHeld = true;
      resultWrap.classList.add('bgr-pan-ready');
      hideBrushCursor();
    }
  });

  document.addEventListener('keyup', function (e) {
    if (e.code === 'Space') {
      spaceHeld = false;
      resultWrap.classList.remove('bgr-pan-ready');
    }
  });

  /* ---- Touch: two-finger pan ---- */

  resultWrap.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2 && zoomLevel > 1) {
      e.preventDefault();
      touchPanning = true;
      var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      touchStartX = midX;
      touchStartY = midY;
      touchScrollStartX = resultWrap.scrollLeft;
      touchScrollStartY = resultWrap.scrollTop;
    }
  }, { passive: false });

  resultWrap.addEventListener('touchmove', function (e) {
    if (!touchPanning || e.touches.length < 2) return;
    e.preventDefault();
    var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    resultWrap.scrollLeft = touchScrollStartX - (midX - touchStartX);
    resultWrap.scrollTop = touchScrollStartY - (midY - touchStartY);
  }, { passive: false });

  resultWrap.addEventListener('touchend', function (e) {
    if (touchPanning && e.touches.length < 2) {
      touchPanning = false;
    }
  });

})();
