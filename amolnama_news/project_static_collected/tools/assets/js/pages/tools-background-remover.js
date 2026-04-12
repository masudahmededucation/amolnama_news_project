/* ========== Background Remover Tool — Optimized ========== */
(function () {
  'use strict';

  /* ---- Smooth show / hide helpers ---- */
  function showSection(element) {
    element.hidden = false;
    element.classList.remove('tool-section-reveal');
    void element.offsetWidth;
    element.classList.add('tool-section-reveal');
  }
  function hideSection(element) {
    element.hidden = true;
    element.classList.remove('tool-section-reveal');
  }

  /* ---- DOM refs ---- */
  const dropzone        = document.getElementById('bgr-dropzone');
  const fileInput       = document.getElementById('bgr-file-input');
  const browseBtn       = document.getElementById('bgr-browse-button');
  const processingOverlay = document.getElementById('bgr-processing-overlay');
  const processingText  = document.getElementById('bgr-processing-text');
  const errorSection    = document.getElementById('bgr-error');
  const errorText       = document.getElementById('bgr-error-text');
  const tryAgainBtn     = document.getElementById('bgr-try-again-button');
  const editor          = document.getElementById('bgr-editor');
  const originalCanvas  = document.getElementById('bgr-original-canvas');
  const resultCanvas    = document.getElementById('bgr-result-canvas');
  const resultWrap      = document.getElementById('bgr-result-wrap');
  const swatches        = document.querySelectorAll('.bgr-swatch');
  const customColorInput = document.getElementById('bgr-custom-color');
  const edgeSlider      = document.getElementById('bgr-edge-slider');
  const edgeValue       = document.getElementById('bgr-edge-value');
  const downloadPng     = document.getElementById('bgr-download-png');
  const downloadJpg     = document.getElementById('bgr-download-jpg');
  const resetBtn        = document.getElementById('bgr-reset-button');

  /* Brush DOM refs */
  const brushTools      = document.getElementById('bgr-brush-tools');
  const brushMoveBtn    = document.getElementById('bgr-brush-move');
  const brushEraseBtn   = document.getElementById('bgr-brush-erase');
  const brushRestoreBtn = document.getElementById('bgr-brush-restore');
  const brushUndoBtn    = document.getElementById('bgr-brush-undo');
  const brushSizeSlider = document.getElementById('bgr-brush-size');
  const brushSizeValue  = document.getElementById('bgr-brush-size-value');
  const brushCursor     = document.getElementById('bgr-brush-cursor');

  /* Auto-refine DOM refs */
  const autoRefineBtn   = document.getElementById('bgr-auto-refine');

  /* Zoom & compare DOM refs */
  const resultTools     = document.getElementById('bgr-result-tools');
  const tipsBar         = document.getElementById('bgr-tips');
  const compareBtn      = document.getElementById('bgr-compare-button');
  const zoomInBtn       = document.getElementById('bgr-zoom-in');
  const zoomOutBtn      = document.getElementById('bgr-zoom-out');
  const zoomLevelSpan   = document.getElementById('bgr-zoom-level');

  /* Edge shift DOM refs */
  const edgeShiftSlider = document.getElementById('bgr-edge-shift');
  const edgeShiftValue  = document.getElementById('bgr-edge-shift-value');

  /* Shadow DOM refs */
  const shadowBlurSlider = document.getElementById('bgr-shadow-blur');
  const shadowBlurValue = document.getElementById('bgr-shadow-blur-value');

  /* Copy & clipboard */
  const copyBtn         = document.getElementById('bgr-copy-button');

  /* ---- State ---- */
  let segmenter     = null;
  let modelLoaded   = false;
  let processing    = false;
  let originalImage = null;
  let maskData      = null;
  let maskWidth     = 0;
  let maskHeight    = 0;
  let currentBg     = 'transparent';
  let fileName      = 'image';

  /* Mask layers */
  let featheredMask = null;
  let brushDelta    = null;
  let workingMask   = null;

  /* Brush state */
  let brushMode     = null;
  let painting      = false;
  let lastPaintX    = -1;
  let lastPaintY    = -1;

  /* Undo history */
  let undoStack     = [];
  const MAX_UNDO      = 30;

  /* Auto-refine state */
  let autoRefineOn      = false;
  let refinedPixelData  = null;

  /* Zoom state */
  let zoomLevel         = 1;
  const ZOOM_STEPS        = [1, 1.5, 2, 3, 4];
  let baseCanvasWidth   = 0;
  let baseCanvasHeight  = 0;

  /* Shadow state */
  let shadowBlur        = 0;

  /* Compare state */
  let comparing         = false;
  let savedResultData   = null;

  /* Pan state */
  let panning           = false;
  let panStartX         = 0;
  let panStartY         = 0;
  let panScrollStartX   = 0;
  let panScrollStartY   = 0;
  let spaceHeld         = false;

  /* Touch pan state */
  let touchPanning      = false;
  let touchStartX       = 0;
  let touchStartY       = 0;
  let touchScrollStartX = 0;
  let touchScrollStartY = 0;

  /* Cached original pixel data */
  let origPixelData = null;

  /* ---- Constants ---- */
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_IMAGE_DIM = 2048; /* Cap image size to prevent browser freeze */
  const BRUSH_INTENSITY = 0.35;

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
          let mask = results.segmentationMask;
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = mask.width;
          tempCanvas.height = mask.height;
          let canvasContext = tempCanvas.getContext('2d');
          canvasContext.drawImage(mask, 0, 0);
          const imgData = canvasContext.getImageData(0, 0, mask.width, mask.height);

          maskWidth = mask.width;
          maskHeight = mask.height;
          maskData = new Float32Array(mask.width * mask.height);
          for (let i = 0; i < maskData.length; i++) {
            maskData[i] = imgData.data[i * 4] / 255;
          }

          modelLoaded = true;

          let w = originalImage.naturalWidth;
          let h = originalImage.naturalHeight;

          /* Downscale if too large */
          let scale = 1;
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
            resultTools.hidden = false;
            if (tipsBar) tipsBar.hidden = false;
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

    const buf = new Float32Array(src);
    let out = new Float32Array(src.length);
    let i, x, y, sum, count, li, ri;

    for (let pass = 0; pass < 3; pass++) {
      /* Horizontal pass */
      for (y = 0; y < h; y++) {
        const rowOff = y * w;
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
    let range = high - low;
    if (range <= 0) range = 0.01;
    let out = new Float32Array(mask.length);
    for (let i = 0; i < mask.length; i++) {
      let v = mask[i];
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
    const blurred = boxBlurFast(raw, w, h, radius);
    return applyThreshold(blurred, threshLow, threshHigh);
  }

  /* ============================================================
     Build working mask = featheredMask + brushDelta (clamped 0-1)
     ============================================================ */
  function buildWorkingMask() {
    if (!featheredMask || !brushDelta) return;
    const len = featheredMask.length;
    if (!workingMask || workingMask.length !== len) {
      workingMask = new Float32Array(len);
    }
    for (let i = 0; i < len; i++) {
      let v = featheredMask[i] + brushDelta[i];
      workingMask[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }

  /* ============================================================
     Auto-refine — color decontamination (chunked to avoid freeze)
     ============================================================ */
  function computeEdgeRefinement(callback) {
    if (!workingMask || !origPixelData) { if (callback) callback(); return; }

    let w = resultCanvas.width;
    let h = resultCanvas.height;
    let src = origPixelData.data;
    const refined = new Uint8ClampedArray(src);

    const EDGE_LOW  = 0.02;
    const EDGE_HIGH = 0.92;
    const SEARCH_R  = 5;

    let y = 0;
    const CHUNK = 50; /* rows per frame */

    function processChunk() {
      const yEnd = Math.min(y + CHUNK, h);

      for (; y < yEnd; y++) {
        for (let x = 0; x < w; x++) {
          let index = y * w + x;
          let alpha = workingMask[index];
          if (alpha <= EDGE_LOW || alpha >= EDGE_HIGH) continue;

          let sumR = 0, sumG = 0, sumB = 0, totalW = 0;
          const nx0 = Math.max(0, x - SEARCH_R);
          const nx1 = Math.min(w - 1, x + SEARCH_R);
          const ny0 = Math.max(0, y - SEARCH_R);
          const ny1 = Math.min(h - 1, y + SEARCH_R);

          for (let ny = ny0; ny <= ny1; ny++) {
            for (let nx = nx0; nx <= nx1; nx++) {
              const nIdx = ny * w + nx;
              if (workingMask[nIdx] < EDGE_HIGH) continue;
              const ddx = nx - x, ddy = ny - y;
              let dist = Math.sqrt(ddx * ddx + ddy * ddy);
              if (dist > SEARCH_R) continue;
              const wt = 1 / (1 + dist);
              const pIdx = nIdx * 4;
              sumR += src[pIdx] * wt;
              sumG += src[pIdx + 1] * wt;
              sumB += src[pIdx + 2] * wt;
              totalW += wt;
            }
          }

          if (totalW > 0) {
            const pIdx2 = index * 4;
            let t = (alpha - EDGE_LOW) / (EDGE_HIGH - EDGE_LOW);
            const fgR = sumR / totalW, fgG = sumG / totalW, fgB = sumB / totalW;
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
    for (let i = 0; i < ZOOM_STEPS.length; i++) {
      if (ZOOM_STEPS[i] > zoomLevel) { zoomLevel = ZOOM_STEPS[i]; break; }
    }
    applyZoom();
  }

  function zoomOut() {
    for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
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
  let opGen = 0;

  /* Reusable offscreen canvas for shadow compositing */
  let shadowCanvas = null;
  let shadowCtx = null;

  function renderFullResult() {
    if (!workingMask || !origPixelData) return;

    let w = resultCanvas.width;
    let h = resultCanvas.height;
    let resCtx = resultCanvas.getContext('2d');

    let bgR = 0, bgG = 0, bgB = 0;
    if (currentBg !== 'transparent') {
      let parsed = parseHexColor(currentBg);
      bgR = parsed.r; bgG = parsed.g; bgB = parsed.b;
      resultWrap.classList.remove('bgr-checkerboard');
    } else {
      resultWrap.classList.add('bgr-checkerboard');
    }

    const result = resCtx.createImageData(w, h);
    let srcData = getSourcePixels();
    let src = srcData.data;
    let dst = result.data;
    const isTransp = (currentBg === 'transparent');

    for (let i = 0; i < workingMask.length; i++) {
      const alpha = workingMask[i];
      const index = i * 4;

      if (isTransp) {
        dst[index]     = src[index];
        dst[index + 1] = src[index + 1];
        dst[index + 2] = src[index + 2];
        dst[index + 3] = (alpha * 255 + 0.5) | 0;
      } else {
        dst[index]     = (src[index] * alpha + bgR * (1 - alpha) + 0.5) | 0;
        dst[index + 1] = (src[index + 1] * alpha + bgG * (1 - alpha) + 0.5) | 0;
        dst[index + 2] = (src[index + 2] * alpha + bgB * (1 - alpha) + 0.5) | 0;
        dst[index + 3] = 255;
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

      const transpResult = shadowCtx.createImageData(w, h);
      const transpDst = transpResult.data;
      for (let j = 0; j < workingMask.length; j++) {
        const a2 = workingMask[j];
        const j4 = j * 4;
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
  let compositeTimer = null;

  function compositeResultAsync(callback) {
    if (!originalImage || !maskData) return;

    let gen = ++opGen;
    processingText.textContent = 'প্রয়োগ হচ্ছে… (Applying…)';
    processingOverlay.hidden = false;
    clearTimeout(compositeTimer);

    let w = originalCanvas.width;
    let h = originalCanvas.height;
    const radius = parseInt(edgeSlider.value, 10);
    const shift = parseInt(edgeShiftSlider.value, 10);
    const threshLow = Math.max(0.01, 0.15 - shift * 0.04);
    const threshHigh = Math.min(0.99, 0.85 - shift * 0.04);

    /* Step 1: Scale mask (yield) */
    compositeTimer = setTimeout(function () {
      if (gen !== opGen) return; /* cancelled */
      const scaledMask = scaleMask(maskData, maskWidth, maskHeight, w, h);

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
              processingOverlay.hidden = true;
              if (callback) callback();
            });
          } else {
            renderFullResult();
            processingOverlay.hidden = true;
            if (callback) callback();
          }
        }, 0);
      }, 0);
    }, 0);
  }

  /* Quick render-only async (bg/shadow changes — no re-feathering needed) */
  function renderAsync(callback) {
    const gen = ++opGen;
    processingText.textContent = 'প্রয়োগ হচ্ছে… (Applying…)';
    processingOverlay.hidden = false;
    clearTimeout(compositeTimer);
    compositeTimer = setTimeout(function () {
      if (gen !== opGen) return;
      renderFullResult();
      processingOverlay.hidden = true;
      if (callback) callback();
    }, 0);
  }

  /* ============================================================
     Brush painting — fast local update
     ============================================================ */

  function pointerToCanvas(e) {
    let rect = resultCanvas.getBoundingClientRect();
    const scaleX = resultCanvas.width / rect.width;
    const scaleY = resultCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function getBrushCanvasRadius() {
    const displayPx = parseInt(brushSizeSlider.value, 10);
    let rect = resultCanvas.getBoundingClientRect();
    let scale = resultCanvas.width / rect.width;
    return displayPx * scale * 0.5;
  }

  function paintDab(cx, cy) {
    if (!workingMask || !origPixelData) return;

    let w = resultCanvas.width;
    let h = resultCanvas.height;
    let r = getBrushCanvasRadius();
    const rSq = r * r;

    let x0 = Math.max(0, Math.floor(cx - r));
    let y0 = Math.max(0, Math.floor(cy - r));
    let x1 = Math.min(w, Math.ceil(cx + r));
    let y1 = Math.min(h, Math.ceil(cy + r));

    if (x0 >= x1 || y0 >= y1) return;

    const rw = x1 - x0;
    const rh = y1 - y0;
    let resCtx = resultCanvas.getContext('2d');
    const regionData = resCtx.getImageData(x0, y0, rw, rh);
    const dst = regionData.data;
    const srcData = getSourcePixels();
    const src = srcData.data;

    let bgR = 0, bgG = 0, bgB = 0;
    const isTransparent = (currentBg === 'transparent');
    if (!isTransparent) {
      const parsed = parseHexColor(currentBg);
      bgR = parsed.r; bgG = parsed.g; bgB = parsed.b;
    }

    const erasing = (brushMode === 'erase');

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        let dx = px - cx;
        let dy = py - cy;
        const distSq = dx * dx + dy * dy;
        if (distSq > rSq) continue;

        let dist = Math.sqrt(distSq);
        let strength = 1 - (dist / r);
        strength = strength * strength * BRUSH_INTENSITY;

        const maskIdx = py * w + px;

        if (erasing) {
          brushDelta[maskIdx] -= strength;
        } else {
          brushDelta[maskIdx] += strength;
        }

        let v = featheredMask[maskIdx] + brushDelta[maskIdx];
        v = v < 0 ? 0 : v > 1 ? 1 : v;
        workingMask[maskIdx] = v;

        const localIdx = ((py - y0) * rw + (px - x0)) * 4;
        const srcIdx = maskIdx * 4;

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
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const r = getBrushCanvasRadius();
    const step = Math.max(1, r * 0.3);
    const steps = Math.ceil(dist / step);

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      paintDab(fromX + dx * t, fromY + dy * t);
    }
  }

  /* ============================================================
     Brush cursor
     ============================================================ */
  function updateBrushCursor(e) {
    if (!brushMode) return;
    const rect = resultWrap.getBoundingClientRect();
    let x = e.clientX - rect.left + resultWrap.scrollLeft;
    let y = e.clientY - rect.top + resultWrap.scrollTop;
    const size = parseInt(brushSizeSlider.value, 10);
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

    const out = new Float32Array(tw * th);
    const xRatio = mw / tw;
    const yRatio = mh / th;

    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const srcX = x * xRatio;
        const srcY = y * yRatio;
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = Math.min(x0 + 1, mw - 1);
        const y1 = Math.min(y0 + 1, mh - 1);
        const xFrac = srcX - x0;
        const yFrac = srcY - y0;

        const tl = mask[y0 * mw + x0];
        const tr = mask[y0 * mw + x1];
        const bl = mask[y1 * mw + x0];
        const br = mask[y1 * mw + x1];

        const top = tl + (tr - tl) * xFrac;
        const bot = bl + (br - bl) * xFrac;
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

    const img = new Image();
    img.onload = function () {
      originalImage = img;

      let w = img.naturalWidth;
      let h = img.naturalHeight;

      /* Downscale for processing if too large */
      let scale = 1;
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

    const reader = new FileReader();
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
    resultTools.hidden = true;
    if (tipsBar) tipsBar.hidden = true;

    swatches.forEach(function (s) { s.classList.remove('active'); });
    const transparentSwatch = document.querySelector('.bgr-swatch--transparent');
    if (transparentSwatch) {
      transparentSwatch.classList.add('active');
    }
    resultWrap.classList.add('bgr-checkerboard');
  }

  /* ============================================================
     Download helpers
     ============================================================ */
  function downloadCanvas(format) {
    if (!resultCanvas.width || processing) return;
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpg' ? '.jpg' : '.png';
    const quality = format === 'jpg' ? 0.92 : undefined;

    let canvas = resultCanvas;
    if (format === 'jpg' && currentBg === 'transparent') {
      canvas = document.createElement('canvas');
      canvas.width = resultCanvas.width;
      canvas.height = resultCanvas.height;
      const canvasContext = canvas.getContext('2d');
      canvasContext.fillStyle = '#FFFFFF';
      canvasContext.fillRect(0, 0, canvas.width, canvas.height);
      canvasContext.drawImage(resultCanvas, 0, 0);
    }

    canvas.toBlob(function (blob) {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
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
      const bg = swatch.getAttribute('data-bg');
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
    const customSwatch = document.querySelector('.bgr-swatch--custom');
    if (customSwatch) {
      customSwatch.classList.add('active');
      customSwatch.style.background = customColorInput.value;
    }
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

    const resCtx = resultCanvas.getContext('2d');
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
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
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
      processingOverlay.hidden = false;
      computeEdgeRefinement(function () {
        renderFullResult();
        processingOverlay.hidden = true;
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
    const snapshot = undoStack.pop();
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
    let pt = pointerToCanvas(e);
    lastPaintX = pt.x;
    lastPaintY = pt.y;
    paintDab(pt.x, pt.y);
  });

  resultCanvas.addEventListener('pointermove', function (e) {
    updateBrushCursor(e);
    if (!painting) return;
    e.preventDefault();
    const pt = pointerToCanvas(e);
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
      let midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      let midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      touchStartX = midX;
      touchStartY = midY;
      touchScrollStartX = resultWrap.scrollLeft;
      touchScrollStartY = resultWrap.scrollTop;
    }
  }, { passive: false });

  resultWrap.addEventListener('touchmove', function (e) {
    if (!touchPanning || e.touches.length < 2) return;
    e.preventDefault();
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    resultWrap.scrollLeft = touchScrollStartX - (midX - touchStartX);
    resultWrap.scrollTop = touchScrollStartY - (midY - touchStartY);
  }, { passive: false });

  resultWrap.addEventListener('touchend', function (e) {
    if (touchPanning && e.touches.length < 2) {
      touchPanning = false;
    }
  });

})();
