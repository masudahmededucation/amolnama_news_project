/**
 * PWA Install — One-click install, with clear guidance when already installed.
 */
(function () {
  'use strict';

  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
                  || (window.navigator.standalone === true);
  if (isStandalone) return;

  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  const isChromium = /Chrome|Edg/.test(ua) && !isIOS;

  const headerBtn = document.getElementById('pwa-header-install');
  let deferredPrompt = null;
  let pendingClick = false;

  if (headerBtn) headerBtn.classList.remove('display-hidden');

  /* ---- Capture beforeinstallprompt ---- */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;

    if (pendingClick) {
      pendingClick = false;
      fireInstall();
    }
  });

  function fireInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () {
      deferredPrompt = null;
    });
  }

  /* ---- Header button click ---- */
  if (headerBtn) {
    headerBtn.addEventListener('click', function () {
      if (deferredPrompt) {
        fireInstall();
        return;
      }

      // Queue — wait for beforeinstallprompt
      pendingClick = true;

      setTimeout(function () {
        if (!pendingClick) return;
        pendingClick = false;

        // Chromium and no prompt = already installed
        if (isChromium && isAndroid) {
          showTooltip(
            '<strong>Already installed!</strong><br>'
            + 'If you deleted it, long-press the app icon on home screen '
            + '\u2192 <strong>Uninstall</strong>, then come back and tap Install again.'
            + '<br><small>Or: Chrome \u22EE \u2192 Settings \u2192 Apps \u2192 Amolnama News \u2192 Uninstall</small>'
          );
        } else if (isChromium) {
          showTooltip(
            '<strong>Already installed!</strong><br>'
            + 'To reinstall: open Chrome menu (<strong>\u22EE</strong>) '
            + '\u2192 look for <strong>"Uninstall Amolnama News"</strong>. '
            + 'After uninstalling, come back and click Install again.'
            + '<br><small>Or type <code>chrome://apps</code> in the address bar \u2192 right-click \u2192 Remove</small>'
          );
        } else if (isIOS) {
          showTooltip(
            'Tap <strong>\u2B06 Share</strong> below, then <strong>"Add to Home Screen"</strong>'
          );
        } else {
          // Firefox, other browsers
          showTooltip(
            'Open browser menu \u2192 <strong>"Install"</strong> or <strong>"Add to Home Screen"</strong>'
          );
        }
      }, 2000);
    });
  }

  /* ---- After install ---- */
  window.addEventListener('appinstalled', function () {
    removeTooltip();
  });

  /* ====== Tooltip ====== */

  let tooltipEl = null;
  let tooltipTimer = null;

  function showTooltip(msg) {
    removeTooltip();
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'pwa-tooltip';
    tooltipEl.innerHTML = msg;
    document.body.appendChild(tooltipEl);

    if (headerBtn) {
      const rect = headerBtn.getBoundingClientRect();
      tooltipEl.style.top = (rect.bottom + 8) + 'px';
      tooltipEl.style.right = Math.max(8, window.innerWidth - rect.right) + 'px';
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (tooltipEl) tooltipEl.classList.add('pwa-tooltip--visible');
      });
    });

    tooltipTimer = setTimeout(removeTooltip, 12000);
    document.addEventListener('click', onOutsideClick, true);
  }

  function removeTooltip() {
    if (tooltipTimer) { clearTimeout(tooltipTimer); tooltipTimer = null; }
    document.removeEventListener('click', onOutsideClick, true);
    if (tooltipEl) {
      tooltipEl.classList.remove('pwa-tooltip--visible');
      const el = tooltipEl;
      tooltipEl = null;
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }
  }

  function onOutsideClick(e) {
    if (tooltipEl && !tooltipEl.contains(e.target) && e.target !== headerBtn) {
      removeTooltip();
    }
  }

})();
