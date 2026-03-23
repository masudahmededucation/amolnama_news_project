/* ========== Photo Album Maker — Client-Side ========== */
(function () {
  'use strict';

  /* ================================================================
     CONSTANTS
     ================================================================ */

  var DPI = 300;

  var PAGE_SIZES = {
    '5x7':      { label: '5″ × 7″ (Portrait)',  wInch: 5,     hInch: 7     },
    '7x5':      { label: '7″ × 5″ (Landscape)',  wInch: 7,     hInch: 5     },
    '4x6':      { label: '4″ × 6″ (Portrait)',   wInch: 4,     hInch: 6     },
    '6x4':      { label: '6″ × 4″ (Landscape)',  wInch: 6,     hInch: 4     },
    '8x10':     { label: '8″ × 10″ (Portrait)',  wInch: 8,     hInch: 10    },
    '10x8':     { label: '10″ × 8″ (Landscape)', wInch: 10,    hInch: 8     },
    'a4_p':     { label: 'A4 Portrait',           wInch: 8.27,  hInch: 11.69 },
    'a4_l':     { label: 'A4 Landscape',          wInch: 11.69, hInch: 8.27  },
    'letter_p': { label: 'Letter Portrait',       wInch: 8.5,   hInch: 11    },
    'letter_l': { label: 'Letter Landscape',      wInch: 11,    hInch: 8.5   }
  };

  // Generate 2-column grid layout: cols=2, rows=N, gap=2%, margin=2%
  function makeGrid(cols, rows) {
    var mx = 2, my = 1.5;
    var gx = 2, gy = 2;
    var fw = (100 - mx * 2 - gx * (cols - 1)) / cols;
    var fh = (100 - my * 2 - gy * (rows - 1)) / rows;
    var frames = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        frames.push({
          x: mx + c * (fw + gx),
          y: my + r * (fh + gy),
          w: fw,
          h: fh
        });
      }
    }
    return frames;
  }

  var LAYOUTS = [
    { id: '2h',   frames: [{ x:2,y:5,w:47,h:90 },{ x:51,y:5,w:47,h:90 }] },
    { id: '3h',   frames: [{ x:2,y:5,w:30.67,h:90 },{ x:34.67,y:5,w:30.67,h:90 },{ x:67.33,y:5,w:30.67,h:90 }] },
    { id: '1',    frames: [{ x:3,y:3,w:94,h:94 }] },
    { id: '4g',   frames: makeGrid(2, 2) },
    { id: '2x3',  frames: makeGrid(2, 3), heightRatio: 1.5 },
    { id: '2x4',  frames: makeGrid(2, 4), heightRatio: 2 },
    { id: '2x5',  frames: makeGrid(2, 5), heightRatio: 2.5 },
    { id: '2x6',  frames: makeGrid(2, 6), heightRatio: 3 },
    { id: '2x7',  frames: makeGrid(2, 7), heightRatio: 3.5 },
    { id: '2x8',  frames: makeGrid(2, 8), heightRatio: 4 },
    { id: '1l2r', frames: [{ x:2,y:2.5,w:47,h:95 },{ x:51,y:2.5,w:47,h:46 },{ x:51,y:51.5,w:47,h:46 }] },
    { id: '2l1r', frames: [{ x:2,y:2.5,w:47,h:46 },{ x:2,y:51.5,w:47,h:46 },{ x:51,y:2.5,w:47,h:95 }] },
    { id: '1t2b', frames: [{ x:2,y:2.5,w:96,h:46 },{ x:2,y:51.5,w:47,h:46 },{ x:51,y:51.5,w:47,h:46 }] },
    { id: '2t1b', frames: [{ x:2,y:2.5,w:47,h:46 },{ x:51,y:2.5,w:47,h:46 },{ x:2,y:51.5,w:96,h:46 }] }
  ];

  /* ================================================================
     DOM REFS
     ================================================================ */

  var pageSizeSelect    = document.getElementById('album-page-size');
  var canvasWrap        = document.getElementById('album-canvas-wrap');
  var canvasInner       = document.getElementById('album-canvas-inner');
  var borderSlider      = document.getElementById('album-border-slider');
  var borderValue       = document.getElementById('album-border-value');
  var roundSlider       = document.getElementById('album-round-slider');
  var roundValue        = document.getElementById('album-round-value');
  var createBtn         = document.getElementById('album-create-btn');
  var resetBtn          = document.getElementById('album-reset-btn');
  var swapHint          = document.getElementById('album-swap-hint');
  var infoEl            = document.getElementById('album-info');
  var customColorPicker = document.getElementById('album-custom-color');
  var resultSection     = document.getElementById('album-result');
  var resultPreview     = document.getElementById('album-result-preview');
  var resultInfo        = document.getElementById('album-result-info');
  var dlJpgBtn          = document.getElementById('album-dl-jpg');
  var dlPngBtn          = document.getElementById('album-dl-png');
  var dlPdfBtn          = document.getElementById('album-dl-pdf');

  /* ================================================================
     STATE
     ================================================================ */

  var currentPageSize = '5x7';
  var currentLayout   = LAYOUTS[0];
  var bgColor         = '#FFFFFF';
  var borderPx        = 12;
  var roundPx         = 0;
  var frameImages     = [];       // Image objects or null
  var frameObjectUrls = [];       // blob URLs to revoke
  var framePans       = [];       // { x: 0, y: 0 } — pan offset in display px
  var frameZooms      = [];       // per-frame zoom multiplier (1.0 = contain fit)
  var swapSourceIdx   = -1;
  var displayScale    = 1;

  // Drag-to-reposition state
  var panDragIdx      = -1;
  var panDragStartX   = 0;
  var panDragStartY   = 0;
  var panDragOrigX    = 0;
  var panDragOrigY    = 0;
  var panRafPending   = false;  // rAF throttle for pan moves

  // Keyboard/pinch zoom state
  var activeFrameIdx  = -1;    // last hovered/touched frame (for Ctrl+/- zoom)
  var pinchStartDist  = 0;     // initial pinch distance
  var pinchStartZoom  = 1;     // zoom at pinch start
  var pinchFrameIdx   = -1;    // frame being pinch-zoomed
  var pinchRafPending = false; // rAF throttle for pinch rebuilds

  // Result
  var resultCanvas    = null;

  /* ================================================================
     INIT
     ================================================================ */

  function init() {
    buildLayoutButtons();
    bindPageSizeChange();
    bindBgSwatches();
    bindSliders();
    bindActions();
    applyLayout();
  }

  /* ================================================================
     LAYOUT BUTTONS
     ================================================================ */

  function buildLayoutButtons() {
    var btns = document.querySelectorAll('.album-layout-btn');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-layout');
          for (var j = 0; j < LAYOUTS.length; j++) {
            if (LAYOUTS[j].id === id) { currentLayout = LAYOUTS[j]; break; }
          }
          var all = document.querySelectorAll('.album-layout-btn');
          for (var k = 0; k < all.length; k++) all[k].classList.remove('active');
          btn.classList.add('active');
          hideResult();
          applyLayout();
        });
      })(btns[i]);
    }
    if (btns.length) btns[0].classList.add('active');
  }

  /* ================================================================
     PAGE SIZE
     ================================================================ */

  function bindPageSizeChange() {
    pageSizeSelect.addEventListener('change', function () {
      currentPageSize = this.value;
      hideResult();
      applyLayout();
    });
  }

  function getPagePixels() {
    var ps = PAGE_SIZES[currentPageSize];
    var w = Math.round(ps.wInch * DPI);
    var h = Math.round(ps.hInch * DPI);
    // For tall multi-row layouts, multiply height by ratio
    var hr = currentLayout.heightRatio || 1;
    return { w: w, h: Math.round(h * hr) };
  }

  /* ================================================================
     BACKGROUND
     ================================================================ */

  function bindBgSwatches() {
    var swatches = document.querySelectorAll('.album-swatch');
    for (var i = 0; i < swatches.length; i++) {
      (function (sw) {
        sw.addEventListener('click', function () {
          var all = document.querySelectorAll('.album-swatch');
          for (var j = 0; j < all.length; j++) all[j].classList.remove('active');
          sw.classList.add('active');
          bgColor = sw.getAttribute('data-color');
          if (customColorPicker) customColorPicker.value = bgColor;
          applyBackground();
          hideResult();
        });
      })(swatches[i]);
    }
    if (swatches.length) swatches[0].classList.add('active');

    if (customColorPicker) {
      customColorPicker.addEventListener('input', function () {
        bgColor = this.value;
        var all = document.querySelectorAll('.album-swatch');
        for (var j = 0; j < all.length; j++) all[j].classList.remove('active');
        applyBackground();
        hideResult();
      });
    }
  }

  function applyBackground() {
    canvasWrap.style.backgroundColor = bgColor;
  }

  /* ================================================================
     SLIDERS
     ================================================================ */

  function bindSliders() {
    borderSlider.addEventListener('input', function () {
      borderPx = parseInt(this.value, 10);
      borderValue.textContent = borderPx + 'px';
      hideResult();
      applyLayout();
    });
    roundSlider.addEventListener('input', function () {
      roundPx = parseInt(this.value, 10);
      roundValue.textContent = roundPx + 'px';
      hideResult();
      applyFrameStyles();
    });
  }

  /* ================================================================
     APPLY LAYOUT — builds frame DOM
     ================================================================ */

  function applyLayout() {
    var pp = getPagePixels();
    var containerW = canvasWrap.parentElement.offsetWidth;
    var maxDisplayW = Math.min(containerW, 800);
    displayScale = maxDisplayW / pp.w;
    var displayW = Math.round(pp.w * displayScale);
    var displayH = Math.round(pp.h * displayScale);

    canvasWrap.style.width = displayW + 'px';
    canvasWrap.style.height = displayH + 'px';
    applyBackground();

    // Preserve existing images
    var oldImages = frameImages.slice();
    var oldUrls = frameObjectUrls.slice();
    var oldPans = framePans.slice();
    var oldZooms = frameZooms.slice();
    var frameCount = currentLayout.frames.length;
    frameImages = [];
    frameObjectUrls = [];
    framePans = [];
    frameZooms = [];
    for (var i = 0; i < frameCount; i++) {
      frameImages[i] = (i < oldImages.length) ? oldImages[i] : null;
      frameObjectUrls[i] = (i < oldUrls.length) ? oldUrls[i] : null;
      framePans[i] = (i < oldPans.length) ? oldPans[i] : { x: 0, y: 0 };
      frameZooms[i] = (i < oldZooms.length) ? oldZooms[i] : 1;
    }
    for (var j = frameCount; j < oldUrls.length; j++) {
      if (oldUrls[j]) URL.revokeObjectURL(oldUrls[j]);
    }

    swapSourceIdx = -1;
    activeFrameIdx = -1;
    pinchFrameIdx = -1;
    updateSwapHint('');

    canvasInner.innerHTML = '';
    for (var fi = 0; fi < frameCount; fi++) {
      createFrameElement(fi, displayW, displayH);
    }

    updateInfo();
    updateCreateState();
  }

  /* ================================================================
     CREATE FRAME ELEMENT
     ================================================================ */

  function createFrameElement(idx, displayW, displayH) {
    var fd = currentLayout.frames[idx];
    var padScale = borderPx * displayScale;

    var fx = (fd.x / 100) * displayW + padScale;
    var fy = (fd.y / 100) * displayH + padScale;
    var fw = (fd.w / 100) * displayW - padScale * 2;
    var fh = (fd.h / 100) * displayH - padScale * 2;
    if (fw < 40) fw = 40;
    if (fh < 40) fh = 40;

    var frame = document.createElement('div');
    frame.className = 'album-frame';
    frame.setAttribute('data-idx', idx);
    frame.style.left = fx + 'px';
    frame.style.top = fy + 'px';
    frame.style.width = fw + 'px';
    frame.style.height = fh + 'px';
    frame.style.borderRadius = roundPx + 'px';

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'album-frame-file-' + idx;
    fileInput.name = 'album_frame_file_' + idx;
    fileInput.accept = 'image/*';
    frame.appendChild(fileInput);

    if (frameImages[idx]) {
      var zoom = frameZooms[idx] || 1;

      // Positioned image — manual absolute position for pan + zoom
      var img = document.createElement('img');
      img.src = frameImages[idx].src;
      img.draggable = false;
      img.style.borderRadius = Math.max(0, roundPx - 2) + 'px';

      // Calculate cover dimensions × zoom
      var con = getContainDimensions(frameImages[idx], fw, fh);
      var zoomedW = con.w * zoom;
      var zoomedH = con.h * zoom;
      img.style.width = zoomedW + 'px';
      img.style.height = zoomedH + 'px';
      img.style.position = 'absolute';

      // Apply pan with clamping
      var pan = framePans[idx];
      var clampedX = clampPan(pan.x, zoomedW, fw);
      var clampedY = clampPan(pan.y, zoomedH, fh);
      img.style.left = clampedX + 'px';
      img.style.top = clampedY + 'px';

      frame.appendChild(img);
      frame.classList.add('has-image');

      // Action toolbar (top-right, hover): swap, remove
      var actionBar = document.createElement('div');
      actionBar.className = 'album-frame-toolbar';

      var swapBtn = document.createElement('button');
      swapBtn.className = 'album-frame-tool-btn';
      swapBtn.type = 'button';
      swapBtn.title = 'Swap';
      swapBtn.textContent = '↔';
      actionBar.appendChild(swapBtn);

      var removeBtn = document.createElement('button');
      removeBtn.className = 'album-frame-tool-btn';
      removeBtn.type = 'button';
      removeBtn.title = 'Remove';
      removeBtn.textContent = '✕';
      actionBar.appendChild(removeBtn);

      frame.appendChild(actionBar);

      // Zoom toolbar (bottom-right, always visible)
      var zoomBar = document.createElement('div');
      zoomBar.className = 'album-frame-zoom-bar';

      var zoomOutBtn = document.createElement('button');
      zoomOutBtn.className = 'album-frame-tool-btn';
      zoomOutBtn.type = 'button';
      zoomOutBtn.title = 'Zoom out';
      zoomOutBtn.textContent = '−';
      zoomBar.appendChild(zoomOutBtn);

      var zoomInBtn = document.createElement('button');
      zoomInBtn.className = 'album-frame-tool-btn';
      zoomInBtn.type = 'button';
      zoomInBtn.title = 'Zoom in';
      zoomInBtn.textContent = '+';
      zoomBar.appendChild(zoomInBtn);

      frame.appendChild(zoomBar);

      // Zoom indicator (bottom-left, only if not 1x)
      if (zoom !== 1) {
        var zoomBadge = document.createElement('span');
        zoomBadge.className = 'album-frame-zoom-badge';
        zoomBadge.textContent = Math.round(zoom * 100) + '%';
        frame.appendChild(zoomBadge);
      }

      zoomInBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        applyFrameZoom(idx, 0.1);
      });
      zoomOutBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        applyFrameZoom(idx, -0.1);
      });
      swapBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        startSwap(idx);
      });
      removeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        removeImage(idx);
      });

      // Mouse wheel zoom on frame (also handles Ctrl+wheel)
      frame.addEventListener('wheel', function (e) {
        e.preventDefault();
        var delta = e.deltaY < 0 ? 0.05 : -0.05;
        applyFrameZoom(idx, delta);
      }, { passive: false });

      // Track active frame for Ctrl+/- keyboard zoom
      frame.addEventListener('mouseenter', function () { activeFrameIdx = idx; });
      frame.addEventListener('mouseleave', function () {
        if (activeFrameIdx === idx) activeFrameIdx = -1;
      });

      // Drag to reposition + pinch-to-zoom
      bindFramePan(frame, idx);
    } else {
      var ph = document.createElement('div');
      ph.className = 'album-frame-placeholder';
      ph.innerHTML = '<span class="album-frame-placeholder-icon">🖼️</span>' +
                     '<span class="album-frame-placeholder-text">Drop or Click</span>';
      frame.appendChild(ph);
    }

    // Click to browse (empty frame or swap mode)
    frame.addEventListener('click', function (e) {
      if (swapSourceIdx >= 0) {
        completeSwap(idx);
        e.stopPropagation();
        return;
      }
      if (!frameImages[idx]) {
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', function () {
      if (this.files && this.files[0]) loadImageToFrame(idx, this.files[0]);
    });

    // Drag & drop files
    frame.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      frame.classList.add('dragover');
    });
    frame.addEventListener('dragleave', function () {
      frame.classList.remove('dragover');
    });
    frame.addEventListener('drop', function (e) {
      e.preventDefault();
      frame.classList.remove('dragover');
      if (swapSourceIdx >= 0) { completeSwap(idx); return; }
      var files = e.dataTransfer.files;
      if (files && files[0] && files[0].type.indexOf('image') === 0) {
        loadImageToFrame(idx, files[0]);
      }
    });

    canvasInner.appendChild(frame);
  }

  /* ================================================================
     COVER DIMENSIONS & PAN HELPERS
     ================================================================ */

  // Contain-fit: entire image visible within frame (may have gaps)
  function getContainDimensions(img, frameW, frameH) {
    var iw = img.naturalWidth;
    var ih = img.naturalHeight;
    var frameRatio = frameW / frameH;
    var imgRatio = iw / ih;
    var w, h;
    if (imgRatio > frameRatio) {
      // Image wider → width fits, height has gaps
      w = frameW;
      h = frameW / imgRatio;
    } else {
      // Image taller → height fits, width has gaps
      h = frameH;
      w = frameH * imgRatio;
    }
    return { w: w, h: h };
  }

  // Cover-fit: frame fully filled (image may overflow)
  function getCoverDimensions(img, frameW, frameH) {
    var iw = img.naturalWidth;
    var ih = img.naturalHeight;
    var frameRatio = frameW / frameH;
    var imgRatio = iw / ih;
    var w, h;
    if (imgRatio > frameRatio) {
      h = frameH;
      w = frameH * imgRatio;
    } else {
      w = frameW;
      h = frameW / imgRatio;
    }
    return { w: w, h: h };
  }

  function clampPan(offset, imgDim, frameDim) {
    var center = (frameDim - imgDim) / 2;
    if (imgDim <= frameDim) {
      // Image smaller than frame — center it, no panning allowed
      return center;
    }
    // Image larger than frame — allow panning within bounds
    var min = frameDim - imgDim;
    var max = 0;
    return Math.max(min, Math.min(max, center + offset));
  }

  /* ================================================================
     FRAME ZOOM — per-frame zoom in/out
     ================================================================ */

  function applyFrameZoom(idx, delta) {
    var newZoom = (frameZooms[idx] || 1) + delta;
    newZoom = Math.max(1, Math.min(5, Math.round(newZoom * 100) / 100));
    frameZooms[idx] = newZoom;
    hideResult();
    updateFrameZoomVisual(idx);
  }

  // In-place zoom update — no DOM removal, just update img size/position + badge
  function updateFrameZoomVisual(idx) {
    var zoom = frameZooms[idx] || 1;
    var frame = canvasInner.querySelector('[data-idx="' + idx + '"]');
    if (!frame || !frameImages[idx]) return;
    var img = frame.querySelector('img');
    if (!img) return;

    var fw = frame.offsetWidth;
    var fh = frame.offsetHeight;
    // Base = contain-fit (whole image visible), zoom multiplies from there
    var con = getContainDimensions(frameImages[idx], fw, fh);
    var zoomedW = con.w * zoom;
    var zoomedH = con.h * zoom;
    img.style.width = zoomedW + 'px';
    img.style.height = zoomedH + 'px';

    var pan = framePans[idx];
    img.style.left = clampPan(pan.x, zoomedW, fw) + 'px';
    img.style.top = clampPan(pan.y, zoomedH, fh) + 'px';

    // Update zoom badge
    var badge = frame.querySelector('.album-frame-zoom-badge');
    if (zoom !== 1) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'album-frame-zoom-badge';
        frame.appendChild(badge);
      }
      badge.textContent = Math.round(zoom * 100) + '%';
    } else if (badge) {
      badge.remove();
    }
  }

  /* ================================================================
     FRAME PAN — drag to reposition image inside frame
     ================================================================ */

  function bindFramePan(frame, idx) {
    function isToolBtn(e) {
      return e.target.closest('.album-frame-toolbar') || e.target.closest('.album-frame-zoom-bar');
    }

    // Mouse
    frame.addEventListener('mousedown', function (e) {
      if (swapSourceIdx >= 0) return;
      if (isToolBtn(e)) return;
      e.preventDefault();
      startPanDrag(idx, e.clientX, e.clientY);
    });

    // Touch — single finger = pan, two fingers = pinch zoom
    frame.addEventListener('touchstart', function (e) {
      if (swapSourceIdx >= 0) return;
      if (isToolBtn(e)) return;

      if (e.touches.length === 2 && frameImages[idx]) {
        // Start pinch-to-zoom
        e.preventDefault();
        endPanDrag(); // cancel any active pan
        pinchFrameIdx = idx;
        pinchStartDist = getTouchDistance(e.touches);
        pinchStartZoom = frameZooms[idx] || 1;
        activeFrameIdx = idx;
        return;
      }

      if (e.touches.length !== 1) return;
      e.preventDefault();
      activeFrameIdx = idx;
      startPanDrag(idx, e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
  }

  function getTouchDistance(touches) {
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function startPanDrag(idx, clientX, clientY) {
    panDragIdx = idx;
    panDragStartX = clientX;
    panDragStartY = clientY;
    panDragOrigX = framePans[idx].x;
    panDragOrigY = framePans[idx].y;

    var frame = canvasInner.querySelector('[data-idx="' + idx + '"]');
    if (frame) frame.classList.add('panning');
  }

  function onPanDragMove(clientX, clientY) {
    if (panDragIdx < 0) return;
    framePans[panDragIdx].x = panDragOrigX + (clientX - panDragStartX);
    framePans[panDragIdx].y = panDragOrigY + (clientY - panDragStartY);

    // Throttle DOM updates to rAF for smooth 60fps panning
    if (!panRafPending) {
      panRafPending = true;
      requestAnimationFrame(function () {
        panRafPending = false;
        if (panDragIdx < 0) return;
        var frame = canvasInner.querySelector('[data-idx="' + panDragIdx + '"]');
        if (!frame) return;
        var img = frame.querySelector('img');
        if (!img) return;
        var fw = frame.offsetWidth;
        var fh = frame.offsetHeight;
        var imgW = parseFloat(img.style.width);
        var imgH = parseFloat(img.style.height);
        img.style.left = clampPan(framePans[panDragIdx].x, imgW, fw) + 'px';
        img.style.top = clampPan(framePans[panDragIdx].y, imgH, fh) + 'px';
      });
    }
  }

  function endPanDrag() {
    if (panDragIdx >= 0) {
      var frame = canvasInner.querySelector('[data-idx="' + panDragIdx + '"]');
      if (frame) frame.classList.remove('panning');
      hideResult();
    }
    panDragIdx = -1;
  }

  // Global mouse/touch move & up
  document.addEventListener('mousemove', function (e) {
    if (panDragIdx >= 0) { e.preventDefault(); onPanDragMove(e.clientX, e.clientY); }
  });
  document.addEventListener('mouseup', endPanDrag);
  document.addEventListener('touchmove', function (e) {
    // Pinch-to-zoom (two fingers on a frame) — rAF throttled, in-place update
    if (pinchFrameIdx >= 0 && e.touches.length === 2) {
      e.preventDefault();
      var dist = getTouchDistance(e.touches);
      var scale = dist / pinchStartDist;
      var newZoom = Math.max(1, Math.min(3, Math.round(pinchStartZoom * scale * 100) / 100));
      if (newZoom !== frameZooms[pinchFrameIdx]) {
        frameZooms[pinchFrameIdx] = newZoom;
        if (!pinchRafPending) {
          pinchRafPending = true;
          requestAnimationFrame(function () {
            pinchRafPending = false;
            if (pinchFrameIdx >= 0) {
              hideResult();
              updateFrameZoomVisual(pinchFrameIdx);
            }
          });
        }
      }
      return;
    }
    // Single-finger pan
    if (panDragIdx >= 0 && e.touches.length === 1) {
      e.preventDefault();
      onPanDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  document.addEventListener('touchend', function (e) {
    if (pinchFrameIdx >= 0) { pinchFrameIdx = -1; }
    endPanDrag();
  });
  document.addEventListener('touchcancel', function () {
    pinchFrameIdx = -1;
    endPanDrag();
  });

  // Ctrl + / Ctrl - keyboard zoom (on hovered frame)
  document.addEventListener('keydown', function (e) {
    if (!e.ctrlKey && !e.metaKey) return;
    if (activeFrameIdx < 0 || !frameImages[activeFrameIdx]) return;

    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      applyFrameZoom(activeFrameIdx, 0.1);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      applyFrameZoom(activeFrameIdx, -0.1);
    }
  });

  /* ================================================================
     APPLY FRAME STYLES (border-radius only)
     ================================================================ */

  function applyFrameStyles() {
    var frames = canvasInner.querySelectorAll('.album-frame');
    for (var i = 0; i < frames.length; i++) {
      frames[i].style.borderRadius = roundPx + 'px';
      var img = frames[i].querySelector('img');
      if (img) img.style.borderRadius = Math.max(0, roundPx - 2) + 'px';
    }
  }

  /* ================================================================
     LOAD IMAGE INTO FRAME
     ================================================================ */

  function loadImageToFrame(idx, file) {
    if (frameObjectUrls[idx]) {
      URL.revokeObjectURL(frameObjectUrls[idx]);
      frameObjectUrls[idx] = null;
    }

    var url = URL.createObjectURL(file);
    frameObjectUrls[idx] = url;

    // Use createImageBitmap for non-blocking decode when available
    var img = new Image();
    img.onload = function () {
      if (typeof createImageBitmap === 'function') {
        // Decode off main thread, then close bitmap to free GPU memory
        createImageBitmap(img).then(function (bmp) {
          bmp.close();
          frameImages[idx] = img;
          framePans[idx] = { x: 0, y: 0 };
          frameZooms[idx] = 1;
          hideResult();
          rebuildFrame(idx);
          updateCreateState();
        });
      } else {
        frameImages[idx] = img;
        framePans[idx] = { x: 0, y: 0 };
        frameZooms[idx] = 1;
        hideResult();
        rebuildFrame(idx);
        updateCreateState();
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      frameObjectUrls[idx] = null;
    };
    img.src = url;
  }

  function rebuildFrame(idx) {
    var pp = getPagePixels();
    var containerW = canvasWrap.parentElement.offsetWidth;
    var maxDisplayW = Math.min(containerW, 800);
    displayScale = maxDisplayW / pp.w;
    var displayW = Math.round(pp.w * displayScale);
    var displayH = Math.round(pp.h * displayScale);

    var oldFrame = canvasInner.querySelector('[data-idx="' + idx + '"]');
    if (oldFrame) oldFrame.remove();

    createFrameElement(idx, displayW, displayH);

    // Re-sort by data-idx
    var allFrames = canvasInner.querySelectorAll('.album-frame');
    var sorted = Array.prototype.slice.call(allFrames);
    sorted.sort(function (a, b) {
      return parseInt(a.getAttribute('data-idx'), 10) - parseInt(b.getAttribute('data-idx'), 10);
    });
    for (var i = 0; i < sorted.length; i++) canvasInner.appendChild(sorted[i]);
  }

  /* ================================================================
     REMOVE IMAGE
     ================================================================ */

  function removeImage(idx) {
    if (frameObjectUrls[idx]) {
      URL.revokeObjectURL(frameObjectUrls[idx]);
      frameObjectUrls[idx] = null;
    }
    frameImages[idx] = null;
    framePans[idx] = { x: 0, y: 0 };
    frameZooms[idx] = 1;
    hideResult();
    rebuildFrame(idx);
    updateCreateState();
  }

  /* ================================================================
     SWAP
     ================================================================ */

  function startSwap(idx) {
    swapSourceIdx = idx;
    var frames = canvasInner.querySelectorAll('.album-frame');
    for (var i = 0; i < frames.length; i++) {
      frames[i].classList.remove('swap-source', 'swap-target');
      var fi = parseInt(frames[i].getAttribute('data-idx'), 10);
      if (fi === idx) frames[i].classList.add('swap-source');
      else frames[i].classList.add('swap-target');
    }
    updateSwapHint('Click another frame to swap — অন্য ফ্রেমে ক্লিক করুন');
  }

  function completeSwap(targetIdx) {
    if (swapSourceIdx < 0 || swapSourceIdx === targetIdx) { cancelSwap(); return; }

    // Swap images, URLs, pans, and zooms
    var srcIdx = swapSourceIdx;
    var tmpImg = frameImages[srcIdx];
    var tmpUrl = frameObjectUrls[srcIdx];
    var tmpPan = framePans[srcIdx];
    var tmpZoom = frameZooms[srcIdx];
    frameImages[srcIdx] = frameImages[targetIdx];
    frameObjectUrls[srcIdx] = frameObjectUrls[targetIdx];
    framePans[srcIdx] = framePans[targetIdx];
    frameZooms[srcIdx] = frameZooms[targetIdx];
    frameImages[targetIdx] = tmpImg;
    frameObjectUrls[targetIdx] = tmpUrl;
    framePans[targetIdx] = tmpPan;
    frameZooms[targetIdx] = tmpZoom;

    swapSourceIdx = -1;
    hideResult();
    applyLayout();
    updateSwapHint('');
  }

  function cancelSwap() {
    swapSourceIdx = -1;
    var frames = canvasInner.querySelectorAll('.album-frame');
    for (var i = 0; i < frames.length; i++) {
      frames[i].classList.remove('swap-source', 'swap-target');
    }
    updateSwapHint('');
  }

  function updateSwapHint(text) {
    swapHint.textContent = text;
    swapHint.classList.toggle('active', !!text);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && swapSourceIdx >= 0) cancelSwap();
  });

  /* ================================================================
     CREATE ALBUM — render full-DPI canvas
     ================================================================ */

  function bindActions() {
    createBtn.addEventListener('click', createAlbum);
    resetBtn.addEventListener('click', resetAll);
    dlJpgBtn.addEventListener('click', function () { downloadAs('jpg'); });
    dlPngBtn.addEventListener('click', function () { downloadAs('png'); });
    dlPdfBtn.addEventListener('click', function () { downloadAs('pdf'); });
  }

  function createAlbum() {
    createBtn.disabled = true;
    createBtn.textContent = '⏳ তৈরি হচ্ছে...';

    // Yield to let UI show the loading state, then render frame-by-frame
    setTimeout(function () {
      var pp = getPagePixels();
      var canvas = document.createElement('canvas');
      canvas.width = pp.w;
      canvas.height = pp.h;
      var ctx = canvas.getContext('2d');

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, pp.w, pp.h);

      var wrapW = canvasWrap.offsetWidth || 1;
      var wrapH = canvasWrap.offsetHeight || 1;
      var printScale = pp.w / wrapW;
      var borderPrint = Math.round(borderPx * displayScale * printScale);
      var roundPrint = Math.round(roundPx * displayScale * printScale);
      var padScale = borderPx * displayScale;

      var frameCount = currentLayout.frames.length;
      var fi = 0;

      // Draw one frame per rAF tick to prevent jank on large images
      function drawNextFrame() {
        if (fi >= frameCount) {
          resultCanvas = canvas;
          showResult();
          createBtn.disabled = false;
          createBtn.textContent = '🖼️ অ্যালবাম তৈরি করুন (Create Album)';
          return;
        }

        if (frameImages[fi]) {
          var fd = currentLayout.frames[fi];
          var dfw = (fd.w / 100) * wrapW - padScale * 2;
          var dfh = (fd.h / 100) * wrapH - padScale * 2;
          if (dfw < 40) dfw = 40;
          if (dfh < 40) dfh = 40;

          var pfx = (fd.x / 100) * pp.w + borderPrint;
          var pfy = (fd.y / 100) * pp.h + borderPrint;
          var pfw = (fd.w / 100) * pp.w - borderPrint * 2;
          var pfh = (fd.h / 100) * pp.h - borderPrint * 2;
          if (pfw < 1) pfw = 1;
          if (pfh < 1) pfh = 1;

          ctx.save();
          if (roundPrint > 0) {
            roundedRect(ctx, pfx, pfy, pfw, pfh, roundPrint);
          } else {
            ctx.rect(pfx, pfy, pfw, pfh);
          }
          ctx.clip();
          drawCoverWithPan(ctx, frameImages[fi], pfx, pfy, pfw, pfh, framePans[fi], frameZooms[fi] || 1, dfw, dfh);
          ctx.restore();
        }

        fi++;
        requestAnimationFrame(drawNextFrame);
      }

      requestAnimationFrame(drawNextFrame);
    }, 30);
  }

  function drawCoverWithPan(ctx, img, dx, dy, dw, dh, pan, zoom, displayFrameW, displayFrameH) {
    var iw = img.naturalWidth;
    var ih = img.naturalHeight;

    // Calculate contain-fit dimensions in display space
    var displayCon = getContainDimensions(img, displayFrameW, displayFrameH);
    var zoomedDisplayW = displayCon.w * zoom;
    var zoomedDisplayH = displayCon.h * zoom;

    // Scale ratio from display frame to print frame
    var scaleX = dw / displayFrameW;
    var scaleY = dh / displayFrameH;

    // Calculate where the image sits in the print frame
    var printImgW = zoomedDisplayW * scaleX;
    var printImgH = zoomedDisplayH * scaleY;

    // Apply pan (clamped same way as display)
    var printLeft = clampPan(pan.x * scaleX, printImgW, dw);
    var printTop  = clampPan(pan.y * scaleY, printImgH, dh);

    // Draw the entire source image into the calculated print rectangle
    // Source: full image. Dest: positioned within the frame.
    ctx.drawImage(img, 0, 0, iw, ih, dx + printLeft, dy + printTop, printImgW, printImgH);
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ================================================================
     SHOW / HIDE RESULT
     ================================================================ */

  function showResult() {
    if (!resultCanvas) return;
    resultPreview.innerHTML = '';
    resultPreview.appendChild(resultCanvas);
    resultCanvas.style.maxWidth = '100%';
    resultCanvas.style.height = 'auto';

    var pp = getPagePixels();
    var ps = PAGE_SIZES[currentPageSize];
    resultInfo.textContent = ps.label + ' — ' + pp.w + '×' + pp.h + 'px @ ' + DPI + ' DPI';
    resultSection.style.display = '';
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideResult() {
    resultSection.style.display = 'none';
    resultCanvas = null;
    resultPreview.innerHTML = '';
  }

  /* ================================================================
     DOWNLOAD — JPG, PNG, PDF
     ================================================================ */

  function downloadAs(format) {
    if (!resultCanvas) return;

    var ps = PAGE_SIZES[currentPageSize];
    var baseName = 'album-' + ps.wInch + 'x' + ps.hInch;

    if (format === 'jpg') {
      resultCanvas.toBlob(function (blob) {
        triggerDownload(blob, baseName + '.jpg');
      }, 'image/jpeg', 0.95);
    } else if (format === 'png') {
      resultCanvas.toBlob(function (blob) {
        triggerDownload(blob, baseName + '.png');
      }, 'image/png');
    } else if (format === 'pdf') {
      downloadAsPdf(baseName);
    }
  }

  function downloadAsPdf(baseName) {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) {
      infoEl.textContent = 'PDF library not loaded — try JPG or PNG instead';
      return;
    }

    var ps = PAGE_SIZES[currentPageSize];
    var orientation = ps.wInch > ps.hInch ? 'l' : 'p';
    var pdfW = Math.min(ps.wInch, ps.hInch);
    var pdfH = Math.max(ps.wInch, ps.hInch);

    var doc = new jsPDF({ orientation: orientation, unit: 'in', format: [pdfW, pdfH] });
    var imgData = resultCanvas.toDataURL('image/jpeg', 0.95);

    var pageW = orientation === 'l' ? pdfH : pdfW;
    var pageH = orientation === 'l' ? pdfW : pdfH;
    doc.addImage(imgData, 'JPEG', 0, 0, pageW, pageH);

    doc.save(baseName + '.pdf');
  }

  function triggerDownload(blob, filename) {
    if (!blob) return;
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }

  /* ================================================================
     RESET
     ================================================================ */

  function resetAll() {
    for (var i = 0; i < frameObjectUrls.length; i++) {
      if (frameObjectUrls[i]) URL.revokeObjectURL(frameObjectUrls[i]);
    }
    frameImages = [];
    frameObjectUrls = [];
    framePans = [];
    frameZooms = [];
    swapSourceIdx = -1;
    updateSwapHint('');
    hideResult();
    applyLayout();
  }

  /* ================================================================
     UI HELPERS
     ================================================================ */

  function updateCreateState() {
    var hasAny = false;
    for (var i = 0; i < frameImages.length; i++) {
      if (frameImages[i]) { hasAny = true; break; }
    }
    createBtn.disabled = !hasAny;
  }

  function updateInfo(msg) {
    if (msg) { infoEl.textContent = msg; return; }
    var pp = getPagePixels();
    var ps = PAGE_SIZES[currentPageSize];
    infoEl.textContent = ps.label + ' — ' + pp.w + '×' + pp.h + 'px @ ' + DPI + ' DPI — ' +
                         currentLayout.frames.length + ' frame' + (currentLayout.frames.length > 1 ? 's' : '');
  }

  /* ================================================================
     WINDOW RESIZE
     ================================================================ */

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { applyLayout(); }, 200);
  });

  /* ================================================================
     BOOT
     ================================================================ */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
