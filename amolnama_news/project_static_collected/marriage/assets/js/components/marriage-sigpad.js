/**
 * marriage-sigpad.js
 * Canvas-based signature pad with velocity-sensitive line width.
 * Each .sig-zone gets draw/upload toggle + mouse/touch drawing on canvas.
 */
(function () {
  'use strict';

  const MIN_WIDTH = 1;
  const MAX_WIDTH = 3.5;
  const VELOCITY_FILTER = 0.7; /* smoothing factor for velocity (0–1, higher = smoother) */
  const WIDTH_FILTER = 0.6;    /* smoothing factor for line width transitions */

  const zones = document.querySelectorAll('.sig-zone');
  if (!zones.length) return;

  zones.forEach(function (zone) {
    const key = zone.dataset.sigKey;
    const canvas = zone.querySelector('.sig-canvas');
    const drawArea = zone.querySelector('.sig-draw-area');
    const uploadArea = zone.querySelector('.marriage-sig-upload') || zone.querySelector('.cert-sig-upload');
    const clearBtn = zone.querySelector('.sig-clear-button');
    const radios = zone.querySelectorAll('input[name="sig-mode-' + key + '"]');
    const dropEl = document.getElementById('sig-' + key + '-drop');

    if (!canvas || !drawArea) return;

    const canvasContext = canvas.getContext('2d');
    let drawing = false;
    let hasStrokes = false;
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;
    let lastVelocity = 0;
    let lastWidth = (MIN_WIDTH + MAX_WIDTH) / 2;

    /* --- Base style --- */
    function styleCtx() {
      canvasContext.strokeStyle = '#1a1a1a';
      canvasContext.lineCap = 'round';
      canvasContext.lineJoin = 'round';
    }

    /* --- Canvas sizing --- */
    function resizeCanvas() {
      const cssW = canvas.offsetWidth || 400;
      const cssH = canvas.offsetHeight || 120;
      if (canvas.width !== cssW || canvas.height !== cssH) {
        canvas.width = cssW;
        canvas.height = cssH;
        styleCtx();
      }
    }
    setTimeout(resizeCanvas, 0);

    /* --- Get mouse/touch position --- */
    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    }

    /* --- Compute line width from velocity --- */
    function widthFromVelocity(velocity) {
      /* Higher velocity → thinner line (like a real pen) */
      const clamped = Math.min(velocity, 6);
      const target = MAX_WIDTH - (MAX_WIDTH - MIN_WIDTH) * (clamped / 6);
      return target;
    }

    /* --- Draw a line segment with variable width --- */
    function drawSegment(fromX, fromY, toX, toY, width) {
      canvasContext.beginPath();
      canvasContext.lineWidth = width;
      canvasContext.moveTo(fromX, fromY);
      canvasContext.lineTo(toX, toY);
      canvasContext.stroke();
    }

    function startDraw(e) {
      e.preventDefault();
      drawing = true;
      let pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
      lastTime = Date.now();
      lastVelocity = 0;
      lastWidth = (MIN_WIDTH + MAX_WIDTH) / 2;

      /* Draw a dot for taps / starting point */
      canvasContext.beginPath();
      canvasContext.fillStyle = '#1a1a1a';
      canvasContext.arc(pos.x, pos.y, lastWidth / 2, 0, Math.PI * 2);
      canvasContext.fill();
    }

    function moveDraw(e) {
      if (!drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      const now = Date.now();
      hasStrokes = true;

      /* Calculate velocity (pixels per millisecond) */
      const dx = pos.x - lastX;
      const dy = pos.y - lastY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const elapsed = now - lastTime || 1;
      const velocity = dist / elapsed;

      /* Smooth velocity to avoid jumps */
      const smoothVelocity = VELOCITY_FILTER * velocity + (1 - VELOCITY_FILTER) * lastVelocity;

      /* Calculate target width and smooth it */
      const targetWidth = widthFromVelocity(smoothVelocity);
      const smoothWidth = WIDTH_FILTER * lastWidth + (1 - WIDTH_FILTER) * targetWidth;

      drawSegment(lastX, lastY, pos.x, pos.y, smoothWidth);

      lastX = pos.x;
      lastY = pos.y;
      lastTime = now;
      lastVelocity = smoothVelocity;
      lastWidth = smoothWidth;
    }

    function endDraw() {
      if (!drawing) return;
      drawing = false;
      /* Save canvas data to drop element for preview */
      if (hasStrokes && dropEl) {
        dropEl.dataset.sigUrl = canvas.toDataURL('image/png');
      }
    }

    /* Mouse events */
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', moveDraw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);

    /* Touch events */
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', moveDraw, { passive: false });
    canvas.addEventListener('touchend', endDraw);

    /* Clear button */
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);
        hasStrokes = false;
        if (dropEl) dropEl.dataset.sigUrl = '';
      });
    }

    /* Toggle draw / upload */
    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.value === 'draw') {
          drawArea.hidden = false;
          if (uploadArea) uploadArea.hidden = true;
          setTimeout(resizeCanvas, 0);
        } else {
          drawArea.hidden = true;
          if (uploadArea) uploadArea.hidden = false;
        }
      });
    });

    /* Resize canvas on window resize (debounced) */
    let resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (!drawArea.hidden) {
          resizeCanvas();
        }
      }, 200);
    });
  });
})();
