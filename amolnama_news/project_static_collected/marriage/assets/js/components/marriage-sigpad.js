/**
 * marriage-sigpad.js
 * Canvas-based signature pad with velocity-sensitive line width.
 * Each .sig-zone gets draw/upload toggle + mouse/touch drawing on canvas.
 */
(function () {
  'use strict';

  var MIN_WIDTH = 1;
  var MAX_WIDTH = 3.5;
  var VELOCITY_FILTER = 0.7; /* smoothing factor for velocity (0–1, higher = smoother) */
  var WIDTH_FILTER = 0.6;    /* smoothing factor for line width transitions */

  var zones = document.querySelectorAll('.sig-zone');
  if (!zones.length) return;

  zones.forEach(function (zone) {
    var key = zone.dataset.sigKey;
    var canvas = zone.querySelector('.sig-canvas');
    var drawArea = zone.querySelector('.sig-draw-area');
    var uploadArea = zone.querySelector('.marriage-sig-upload') || zone.querySelector('.cert-sig-upload');
    var clearBtn = zone.querySelector('.sig-clear-btn');
    var radios = zone.querySelectorAll('input[name="sig-mode-' + key + '"]');
    var dropEl = document.getElementById('sig-' + key + '-drop');

    if (!canvas || !drawArea) return;

    var ctx = canvas.getContext('2d');
    var drawing = false;
    var hasStrokes = false;
    var lastX = 0;
    var lastY = 0;
    var lastTime = 0;
    var lastVelocity = 0;
    var lastWidth = (MIN_WIDTH + MAX_WIDTH) / 2;

    /* --- Base style --- */
    function styleCtx() {
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    /* --- Canvas sizing --- */
    function resizeCanvas() {
      var cssW = canvas.offsetWidth || 400;
      var cssH = canvas.offsetHeight || 120;
      if (canvas.width !== cssW || canvas.height !== cssH) {
        canvas.width = cssW;
        canvas.height = cssH;
        styleCtx();
      }
    }
    setTimeout(resizeCanvas, 0);

    /* --- Get mouse/touch position --- */
    function getPos(e) {
      var rect = canvas.getBoundingClientRect();
      var touch = e.touches ? e.touches[0] : e;
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    }

    /* --- Compute line width from velocity --- */
    function widthFromVelocity(velocity) {
      /* Higher velocity → thinner line (like a real pen) */
      var clamped = Math.min(velocity, 6);
      var target = MAX_WIDTH - (MAX_WIDTH - MIN_WIDTH) * (clamped / 6);
      return target;
    }

    /* --- Draw a line segment with variable width --- */
    function drawSegment(fromX, fromY, toX, toY, width) {
      ctx.beginPath();
      ctx.lineWidth = width;
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
    }

    function startDraw(e) {
      e.preventDefault();
      drawing = true;
      var pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
      lastTime = Date.now();
      lastVelocity = 0;
      lastWidth = (MIN_WIDTH + MAX_WIDTH) / 2;

      /* Draw a dot for taps / starting point */
      ctx.beginPath();
      ctx.fillStyle = '#1a1a1a';
      ctx.arc(pos.x, pos.y, lastWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    function moveDraw(e) {
      if (!drawing) return;
      e.preventDefault();
      var pos = getPos(e);
      var now = Date.now();
      hasStrokes = true;

      /* Calculate velocity (pixels per millisecond) */
      var dx = pos.x - lastX;
      var dy = pos.y - lastY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var elapsed = now - lastTime || 1;
      var velocity = dist / elapsed;

      /* Smooth velocity to avoid jumps */
      var smoothVelocity = VELOCITY_FILTER * velocity + (1 - VELOCITY_FILTER) * lastVelocity;

      /* Calculate target width and smooth it */
      var targetWidth = widthFromVelocity(smoothVelocity);
      var smoothWidth = WIDTH_FILTER * lastWidth + (1 - WIDTH_FILTER) * targetWidth;

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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasStrokes = false;
        if (dropEl) dropEl.dataset.sigUrl = '';
      });
    }

    /* Toggle draw / upload */
    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.value === 'draw') {
          drawArea.style.display = '';
          if (uploadArea) uploadArea.style.display = 'none';
          setTimeout(resizeCanvas, 0);
        } else {
          drawArea.style.display = 'none';
          if (uploadArea) uploadArea.style.display = '';
        }
      });
    });

    /* Resize canvas on window resize (debounced) */
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (drawArea.style.display !== 'none') {
          resizeCanvas();
        }
      }, 200);
    });
  });
})();
