/* ========== Photo Album Maker — Client-Side ========== */
(function () {
  'use strict';

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const DPI = 300;

  const PAGE_SIZES = {
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
    const mx = 2, my = 1.5;
    const gx = 2, gy = 2;
    let fw = (100 - mx * 2 - gx * (cols - 1)) / cols;
    let fh = (100 - my * 2 - gy * (rows - 1)) / rows;
    let frames = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
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

  const LAYOUTS = [
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

  const pageSizeSelect    = document.getElementById('album-page-size');
  const canvasWrap        = document.getElementById('album-canvas-wrap');
  const canvasInner       = document.getElementById('album-canvas-inner');
  const borderSlider      = document.getElementById('album-border-slider');
  const borderValue       = document.getElementById('album-border-value');
  const roundSlider       = document.getElementById('album-round-slider');
  const roundValue        = document.getElementById('album-round-value');
  const createBtn         = document.getElementById('album-create-button');
  const resetBtn          = document.getElementById('album-reset-button');
  const swapHint          = document.getElementById('album-swap-hint');
  const infoEl            = document.getElementById('album-info');
  const customColorPicker = document.getElementById('album-custom-color');
  const resultSection     = document.getElementById('album-result');
  const resultPreview     = document.getElementById('album-result-preview');
  const resultInfo        = document.getElementById('album-result-info');
  const dlJpgBtn          = document.getElementById('album-dl-jpg');
  const dlPngBtn          = document.getElementById('album-dl-png');
  const dlPdfBtn          = document.getElementById('album-dl-pdf');

  /* ================================================================
     STATE
     ================================================================ */

  let currentPageSize = '5x7';
  let currentLayout   = LAYOUTS[0];
  let bgColor         = '#FFFFFF';
  let borderPx        = 12;
  let roundPx         = 0;
  let frameImages     = [];       // Image objects or null
  let frameObjectUrls = [];       // blob URLs to revoke
  let framePans       = [];       // { x: 0, y: 0 } — pan offset in display px
  let frameZooms      = [];       // per-frame zoom multiplier (1.0 = contain fit)
  let swapSourceIdx   = -1;
  let displayScale    = 1;

  // Drag-to-reposition state
  let panDragIdx      = -1;
  let panDragStartX   = 0;
  let panDragStartY   = 0;
  let panDragOrigX    = 0;
  let panDragOrigY    = 0;
  let panRafPending   = false;  // rAF throttle for pan moves

  // Keyboard/pinch zoom state
  let activeFrameIdx  = -1;    // last hovered/touched frame (for Ctrl+/- zoom)
  let pinchStartDist  = 0;     // initial pinch distance
  let pinchStartZoom  = 1;     // zoom at pinch start
  let pinchFrameIdx   = -1;    // frame being pinch-zoomed
  let pinchRafPending = false; // rAF throttle for pinch rebuilds

  // Result
  let resultCanvas    = null;

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
    const btns = document.querySelectorAll('.album-layout-button');
    for (let i = 0; i < btns.length; i++) {
      (function (button) {
        button.addEventListener('click', function () {
          const id = button.getAttribute('data-layout');
          for (let j = 0; j < LAYOUTS.length; j++) {
            if (LAYOUTS[j].id === id) { currentLayout = LAYOUTS[j]; break; }
          }
          let all = document.querySelectorAll('.album-layout-button');
          for (let k = 0; k < all.length; k++) all[k].classList.remove('active');
          button.classList.add('active');
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
    let ps = PAGE_SIZES[currentPageSize];
    let w = Math.round(ps.wInch * DPI);
    let h = Math.round(ps.hInch * DPI);
    // For tall multi-row layouts, multiply height by ratio
    const hr = currentLayout.heightRatio || 1;
    return { w: w, h: Math.round(h * hr) };
  }

  /* ================================================================
     BACKGROUND
     ================================================================ */

  function bindBgSwatches() {
    const swatches = document.querySelectorAll('.album-swatch');
    for (let i = 0; i < swatches.length; i++) {
      (function (sw) {
        sw.addEventListener('click', function () {
          let all = document.querySelectorAll('.album-swatch');
          for (let j = 0; j < all.length; j++) all[j].classList.remove('active');
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
        const all = document.querySelectorAll('.album-swatch');
        for (let j = 0; j < all.length; j++) all[j].classList.remove('active');
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
    let pp = getPagePixels();
    let containerW = canvasWrap.parentElement.offsetWidth;
    let maxDisplayW = Math.min(containerW, 800);
    displayScale = maxDisplayW / pp.w;
    let displayW = Math.round(pp.w * displayScale);
    let displayH = Math.round(pp.h * displayScale);

    canvasWrap.style.width = displayW + 'px';
    canvasWrap.style.height = displayH + 'px';
    applyBackground();

    // Preserve existing images
    const oldImages = frameImages.slice();
    const oldUrls = frameObjectUrls.slice();
    const oldPans = framePans.slice();
    const oldZooms = frameZooms.slice();
    let frameCount = currentLayout.frames.length;
    frameImages = [];
    frameObjectUrls = [];
    framePans = [];
    frameZooms = [];
    for (let i = 0; i < frameCount; i++) {
      frameImages[i] = (i < oldImages.length) ? oldImages[i] : null;
      frameObjectUrls[i] = (i < oldUrls.length) ? oldUrls[i] : null;
      framePans[i] = (i < oldPans.length) ? oldPans[i] : { x: 0, y: 0 };
      frameZooms[i] = (i < oldZooms.length) ? oldZooms[i] : 1;
    }
    for (let j = frameCount; j < oldUrls.length; j++) {
      if (oldUrls[j]) URL.revokeObjectURL(oldUrls[j]);
    }

    swapSourceIdx = -1;
    activeFrameIdx = -1;
    pinchFrameIdx = -1;
    updateSwapHint('');

    canvasInner.innerHTML = '';
    for (let fi = 0; fi < frameCount; fi++) {
      createFrameElement(fi, displayW, displayH);
    }

    updateInfo();
    updateCreateState();
  }

  /* ================================================================
     CREATE FRAME ELEMENT
     ================================================================ */

  function createFrameElement(index, displayW, displayH) {
    let fd = currentLayout.frames[index];
    let padScale = borderPx * displayScale;

    const fx = (fd.x / 100) * displayW + padScale;
    const fy = (fd.y / 100) * displayH + padScale;
    let fw = (fd.w / 100) * displayW - padScale * 2;
    let fh = (fd.h / 100) * displayH - padScale * 2;
    if (fw < 40) fw = 40;
    if (fh < 40) fh = 40;

    let frame = document.createElement('div');
    frame.className = 'album-frame';
    frame.setAttribute('data-index', index);
    frame.style.left = fx + 'px';
    frame.style.top = fy + 'px';
    frame.style.width = fw + 'px';
    frame.style.height = fh + 'px';
    frame.style.borderRadius = roundPx + 'px';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'album-frame-file-' + index;
    fileInput.name = 'album_frame_file_' + index;
    fileInput.accept = 'image/*';
    frame.appendChild(fileInput);

    if (frameImages[index]) {
      let zoom = frameZooms[index] || 1;

      // Positioned image — manual absolute position for pan + zoom
      let img = document.createElement('img');
      img.src = frameImages[index].src;
      img.draggable = false;
      img.style.borderRadius = Math.max(0, roundPx - 2) + 'px';

      // Calculate cover dimensions × zoom
      let con = getContainDimensions(frameImages[index], fw, fh);
      let zoomedW = con.w * zoom;
      let zoomedH = con.h * zoom;
      img.style.width = zoomedW + 'px';
      img.style.height = zoomedH + 'px';
      img.style.position = 'absolute';

      // Apply pan with clamping
      let pan = framePans[index];
      const clampedX = clampPan(pan.x, zoomedW, fw);
      const clampedY = clampPan(pan.y, zoomedH, fh);
      img.style.left = clampedX + 'px';
      img.style.top = clampedY + 'px';

      frame.appendChild(img);
      frame.classList.add('has-image');

      // Action toolbar (top-right, hover): swap, remove
      const actionBar = document.createElement('div');
      actionBar.className = 'album-frame-toolbar';

      const swapBtn = document.createElement('button');
      swapBtn.className = 'album-frame-tool-button';
      swapBtn.type = 'button';
      swapBtn.title = 'Swap';
      swapBtn.textContent = '↔';
      actionBar.appendChild(swapBtn);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'album-frame-tool-button';
      removeBtn.type = 'button';
      removeBtn.title = 'Remove';
      removeBtn.textContent = '✕';
      actionBar.appendChild(removeBtn);

      frame.appendChild(actionBar);

      // Zoom toolbar (bottom-right, always visible)
      const zoomBar = document.createElement('div');
      zoomBar.className = 'album-frame-zoom-bar';

      const zoomOutBtn = document.createElement('button');
      zoomOutBtn.className = 'album-frame-tool-button';
      zoomOutBtn.type = 'button';
      zoomOutBtn.title = 'Zoom out';
      zoomOutBtn.textContent = '−';
      zoomBar.appendChild(zoomOutBtn);

      const zoomInBtn = document.createElement('button');
      zoomInBtn.className = 'album-frame-tool-button';
      zoomInBtn.type = 'button';
      zoomInBtn.title = 'Zoom in';
      zoomInBtn.textContent = '+';
      zoomBar.appendChild(zoomInBtn);

      frame.appendChild(zoomBar);

      // Zoom indicator (bottom-left, only if not 1x)
      if (zoom !== 1) {
        const zoomBadge = document.createElement('span');
        zoomBadge.className = 'album-frame-zoom-badge';
        zoomBadge.textContent = Math.round(zoom * 100) + '%';
        frame.appendChild(zoomBadge);
      }

      zoomInBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        applyFrameZoom(index, 0.1);
      });
      zoomOutBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        applyFrameZoom(index, -0.1);
      });
      swapBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        startSwap(index);
      });
      removeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        removeImage(index);
      });

      // Mouse wheel zoom on frame (also handles Ctrl+wheel)
      frame.addEventListener('wheel', function (e) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        applyFrameZoom(index, delta);
      }, { passive: false });

      // Track active frame for Ctrl+/- keyboard zoom
      frame.addEventListener('mouseenter', function () { activeFrameIdx = index; });
      frame.addEventListener('mouseleave', function () {
        if (activeFrameIdx === index) activeFrameIdx = -1;
      });

      // Drag to reposition + pinch-to-zoom
      bindFramePan(frame, index);
    } else {
      const ph = document.createElement('div');
      ph.className = 'album-frame-placeholder';
      ph.innerHTML = '<span class="album-frame-placeholder-icon">🖼️</span>' +
                     '<span class="album-frame-placeholder-text">Drop or Click</span>';
      frame.appendChild(ph);
    }

    // Click to browse (empty frame or swap mode)
    frame.addEventListener('click', function (e) {
      if (swapSourceIdx >= 0) {
        completeSwap(index);
        e.stopPropagation();
        return;
      }
      if (!frameImages[index]) {
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', function () {
      if (this.files && this.files[0]) loadImageToFrame(index, this.files[0]);
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
      if (swapSourceIdx >= 0) { completeSwap(index); return; }
      const files = e.dataTransfer.files;
      if (files && files[0] && files[0].type.indexOf('image') === 0) {
        loadImageToFrame(index, files[0]);
      }
    });

    canvasInner.appendChild(frame);
  }

  /* ================================================================
     COVER DIMENSIONS & PAN HELPERS
     ================================================================ */

  // Contain-fit: entire image visible within frame (may have gaps)
  function getContainDimensions(img, frameW, frameH) {
    let iw = img.naturalWidth;
    let ih = img.naturalHeight;
    let frameRatio = frameW / frameH;
    let imgRatio = iw / ih;
    let w, h;
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
    let iw = img.naturalWidth;
    let ih = img.naturalHeight;
    const frameRatio = frameW / frameH;
    const imgRatio = iw / ih;
    let w, h;
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
    const center = (frameDim - imgDim) / 2;
    if (imgDim <= frameDim) {
      // Image smaller than frame — center it, no panning allowed
      return center;
    }
    // Image larger than frame — allow panning within bounds
    const min = frameDim - imgDim;
    const max = 0;
    return Math.max(min, Math.min(max, center + offset));
  }

  /* ================================================================
     FRAME ZOOM — per-frame zoom in/out
     ================================================================ */

  function applyFrameZoom(index, delta) {
    let newZoom = (frameZooms[index] || 1) + delta;
    newZoom = Math.max(1, Math.min(5, Math.round(newZoom * 100) / 100));
    frameZooms[index] = newZoom;
    hideResult();
    updateFrameZoomVisual(index);
  }

  // In-place zoom update — no DOM removal, just update img size/position + badge
  function updateFrameZoomVisual(index) {
    const zoom = frameZooms[index] || 1;
    let frame = canvasInner.querySelector('[data-index="' + index + '"]');
    if (!frame || !frameImages[index]) return;
    let img = frame.querySelector('img');
    if (!img) return;

    let fw = frame.offsetWidth;
    let fh = frame.offsetHeight;
    // Base = contain-fit (whole image visible), zoom multiplies from there
    const con = getContainDimensions(frameImages[index], fw, fh);
    const zoomedW = con.w * zoom;
    const zoomedH = con.h * zoom;
    img.style.width = zoomedW + 'px';
    img.style.height = zoomedH + 'px';

    const pan = framePans[index];
    img.style.left = clampPan(pan.x, zoomedW, fw) + 'px';
    img.style.top = clampPan(pan.y, zoomedH, fh) + 'px';

    // Update zoom badge
    let badge = frame.querySelector('.album-frame-zoom-badge');
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

  function bindFramePan(frame, index) {
    function isToolBtn(e) {
      return e.target.closest('.album-frame-toolbar') || e.target.closest('.album-frame-zoom-bar');
    }

    // Mouse
    frame.addEventListener('mousedown', function (e) {
      if (swapSourceIdx >= 0) return;
      if (isToolBtn(e)) return;
      e.preventDefault();
      startPanDrag(index, e.clientX, e.clientY);
    });

    // Touch — single finger = pan, two fingers = pinch zoom
    frame.addEventListener('touchstart', function (e) {
      if (swapSourceIdx >= 0) return;
      if (isToolBtn(e)) return;

      if (e.touches.length === 2 && frameImages[index]) {
        // Start pinch-to-zoom
        e.preventDefault();
        endPanDrag(); // cancel any active pan
        pinchFrameIdx = index;
        pinchStartDist = getTouchDistance(e.touches);
        pinchStartZoom = frameZooms[index] || 1;
        activeFrameIdx = index;
        return;
      }

      if (e.touches.length !== 1) return;
      e.preventDefault();
      activeFrameIdx = index;
      startPanDrag(index, e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
  }

  function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function startPanDrag(index, clientX, clientY) {
    panDragIdx = index;
    panDragStartX = clientX;
    panDragStartY = clientY;
    panDragOrigX = framePans[index].x;
    panDragOrigY = framePans[index].y;

    let frame = canvasInner.querySelector('[data-index="' + index + '"]');
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
        let frame = canvasInner.querySelector('[data-index="' + panDragIdx + '"]');
        if (!frame) return;
        let img = frame.querySelector('img');
        if (!img) return;
        const fw = frame.offsetWidth;
        const fh = frame.offsetHeight;
        const imgW = parseFloat(img.style.width);
        const imgH = parseFloat(img.style.height);
        img.style.left = clampPan(framePans[panDragIdx].x, imgW, fw) + 'px';
        img.style.top = clampPan(framePans[panDragIdx].y, imgH, fh) + 'px';
      });
    }
  }

  function endPanDrag() {
    if (panDragIdx >= 0) {
      const frame = canvasInner.querySelector('[data-index="' + panDragIdx + '"]');
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
      const dist = getTouchDistance(e.touches);
      const scale = dist / pinchStartDist;
      const newZoom = Math.max(1, Math.min(3, Math.round(pinchStartZoom * scale * 100) / 100));
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
    let frames = canvasInner.querySelectorAll('.album-frame');
    for (let i = 0; i < frames.length; i++) {
      frames[i].style.borderRadius = roundPx + 'px';
      let img = frames[i].querySelector('img');
      if (img) img.style.borderRadius = Math.max(0, roundPx - 2) + 'px';
    }
  }

  /* ================================================================
     LOAD IMAGE INTO FRAME
     ================================================================ */

  function loadImageToFrame(index, file) {
    if (frameObjectUrls[index]) {
      URL.revokeObjectURL(frameObjectUrls[index]);
      frameObjectUrls[index] = null;
    }

    let url = URL.createObjectURL(file);
    frameObjectUrls[index] = url;

    // Use createImageBitmap for non-blocking decode when available
    const img = new Image();
    img.onload = function () {
      if (typeof createImageBitmap === 'function') {
        // Decode off main thread, then close bitmap to free GPU memory
        createImageBitmap(img).then(function (bmp) {
          bmp.close();
          frameImages[index] = img;
          framePans[index] = { x: 0, y: 0 };
          frameZooms[index] = 1;
          hideResult();
          rebuildFrame(index);
          updateCreateState();
        }).catch(function (error) {
          console.error('createImageBitmap failed for frame ' + index + ':', error);
          frameImages[index] = img;
          framePans[index] = { x: 0, y: 0 };
          frameZooms[index] = 1;
          hideResult();
          rebuildFrame(index);
          updateCreateState();
        });
      } else {
        frameImages[index] = img;
        framePans[index] = { x: 0, y: 0 };
        frameZooms[index] = 1;
        hideResult();
        rebuildFrame(index);
        updateCreateState();
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      frameObjectUrls[index] = null;
    };
    img.src = url;
  }

  function rebuildFrame(index) {
    let pp = getPagePixels();
    const containerW = canvasWrap.parentElement.offsetWidth;
    const maxDisplayW = Math.min(containerW, 800);
    displayScale = maxDisplayW / pp.w;
    const displayW = Math.round(pp.w * displayScale);
    const displayH = Math.round(pp.h * displayScale);

    const oldFrame = canvasInner.querySelector('[data-index="' + index + '"]');
    if (oldFrame) oldFrame.remove();

    createFrameElement(index, displayW, displayH);

    // Re-sort by data-index
    const allFrames = canvasInner.querySelectorAll('.album-frame');
    const sorted = Array.prototype.slice.call(allFrames);
    sorted.sort(function (a, b) {
      return parseInt(a.getAttribute('data-index'), 10) - parseInt(b.getAttribute('data-index'), 10);
    });
    for (let i = 0; i < sorted.length; i++) canvasInner.appendChild(sorted[i]);
  }

  /* ================================================================
     REMOVE IMAGE
     ================================================================ */

  function removeImage(index) {
    if (frameObjectUrls[index]) {
      URL.revokeObjectURL(frameObjectUrls[index]);
      frameObjectUrls[index] = null;
    }
    frameImages[index] = null;
    framePans[index] = { x: 0, y: 0 };
    frameZooms[index] = 1;
    hideResult();
    rebuildFrame(index);
    updateCreateState();
  }

  /* ================================================================
     SWAP
     ================================================================ */

  function startSwap(index) {
    swapSourceIdx = index;
    let frames = canvasInner.querySelectorAll('.album-frame');
    for (let i = 0; i < frames.length; i++) {
      frames[i].classList.remove('swap-source', 'swap-target');
      let fi = parseInt(frames[i].getAttribute('data-index'), 10);
      if (fi === index) frames[i].classList.add('swap-source');
      else frames[i].classList.add('swap-target');
    }
    updateSwapHint('Click another frame to swap — অন্য ফ্রেমে ক্লিক করুন');
  }

  function completeSwap(targetIdx) {
    if (swapSourceIdx < 0 || swapSourceIdx === targetIdx) { cancelSwap(); return; }

    // Swap images, URLs, pans, and zooms
    const srcIdx = swapSourceIdx;
    const tmpImg = frameImages[srcIdx];
    const tmpUrl = frameObjectUrls[srcIdx];
    const tmpPan = framePans[srcIdx];
    const tmpZoom = frameZooms[srcIdx];
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
    const frames = canvasInner.querySelectorAll('.album-frame');
    for (let i = 0; i < frames.length; i++) {
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
      let pp = getPagePixels();
      const canvas = document.createElement('canvas');
      canvas.width = pp.w;
      canvas.height = pp.h;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, pp.w, pp.h);

      const wrapW = canvasWrap.offsetWidth || 1;
      const wrapH = canvasWrap.offsetHeight || 1;
      const printScale = pp.w / wrapW;
      const borderPrint = Math.round(borderPx * displayScale * printScale);
      const roundPrint = Math.round(roundPx * displayScale * printScale);
      const padScale = borderPx * displayScale;

      const frameCount = currentLayout.frames.length;
      let fi = 0;

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
          const fd = currentLayout.frames[fi];
          let dfw = (fd.w / 100) * wrapW - padScale * 2;
          let dfh = (fd.h / 100) * wrapH - padScale * 2;
          if (dfw < 40) dfw = 40;
          if (dfh < 40) dfh = 40;

          const pfx = (fd.x / 100) * pp.w + borderPrint;
          const pfy = (fd.y / 100) * pp.h + borderPrint;
          let pfw = (fd.w / 100) * pp.w - borderPrint * 2;
          let pfh = (fd.h / 100) * pp.h - borderPrint * 2;
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
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    // Calculate contain-fit dimensions in display space
    const displayCon = getContainDimensions(img, displayFrameW, displayFrameH);
    const zoomedDisplayW = displayCon.w * zoom;
    const zoomedDisplayH = displayCon.h * zoom;

    // Scale ratio from display frame to print frame
    const scaleX = dw / displayFrameW;
    const scaleY = dh / displayFrameH;

    // Calculate where the image sits in the print frame
    const printImgW = zoomedDisplayW * scaleX;
    const printImgH = zoomedDisplayH * scaleY;

    // Apply pan (clamped same way as display)
    const printLeft = clampPan(pan.x * scaleX, printImgW, dw);
    const printTop  = clampPan(pan.y * scaleY, printImgH, dh);

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

    let pp = getPagePixels();
    let ps = PAGE_SIZES[currentPageSize];
    resultInfo.textContent = ps.label + ' — ' + pp.w + '×' + pp.h + 'px @ ' + DPI + ' DPI';
    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideResult() {
    resultSection.hidden = true;
    resultCanvas = null;
    resultPreview.innerHTML = '';
  }

  /* ================================================================
     DOWNLOAD — JPG, PNG, PDF
     ================================================================ */

  function downloadAs(format) {
    if (!resultCanvas) return;

    let ps = PAGE_SIZES[currentPageSize];
    const baseName = 'album-' + ps.wInch + 'x' + ps.hInch;

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
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) {
      infoEl.textContent = 'PDF library not loaded — try JPG or PNG instead';
      return;
    }

    let ps = PAGE_SIZES[currentPageSize];
    const orientation = ps.wInch > ps.hInch ? 'l' : 'p';
    const pdfW = Math.min(ps.wInch, ps.hInch);
    const pdfH = Math.max(ps.wInch, ps.hInch);

    const doc = new jsPDF({ orientation: orientation, unit: 'in', format: [pdfW, pdfH] });
    const imgData = resultCanvas.toDataURL('image/jpeg', 0.95);

    const pageW = orientation === 'l' ? pdfH : pdfW;
    const pageH = orientation === 'l' ? pdfW : pdfH;
    doc.addImage(imgData, 'JPEG', 0, 0, pageW, pageH);

    doc.save(baseName + '.pdf');
  }

  function triggerDownload(blob, filename) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
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
    for (let i = 0; i < frameObjectUrls.length; i++) {
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
    let hasAny = false;
    for (let i = 0; i < frameImages.length; i++) {
      if (frameImages[i]) { hasAny = true; break; }
    }
    createBtn.disabled = !hasAny;
  }

  function updateInfo(msg) {
    if (msg) { infoEl.textContent = msg; return; }
    const pp = getPagePixels();
    const ps = PAGE_SIZES[currentPageSize];
    infoEl.textContent = ps.label + ' — ' + pp.w + '×' + pp.h + 'px @ ' + DPI + ' DPI — ' +
                         currentLayout.frames.length + ' frame' + (currentLayout.frames.length > 1 ? 's' : '');
  }

  /* ================================================================
     WINDOW RESIZE
     ================================================================ */

  let resizeTimer;
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
