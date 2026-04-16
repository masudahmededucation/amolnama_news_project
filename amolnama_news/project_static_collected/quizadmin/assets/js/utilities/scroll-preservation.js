/* Quiz Panel scroll preservation across full reloads.
 *
 * Problem: in-page <a href> clicks and JS location.href navigations cause
 * a full page reload. Browser defaults to scrollY=0 after reload, forcing
 * the reviewer to chase their work. Even `#anchor` fragments don't help
 * when the URL already has the same fragment (browser treats it as no-op
 * fragment change → falls back to scrollY=0 default).
 *
 * Fix: save scrollY in sessionStorage BEFORE any quizadmin navigation,
 * restore on page load IF the saved key exists. One key per pathname so
 * different quizadmin pages don't cross-contaminate.
 */
(function () {
  'use strict';

  const STORAGE_KEY_PREFIX = 'quizadmin-scroll:';
  const storageKeyForCurrentPath = () => STORAGE_KEY_PREFIX + window.location.pathname;

  // Save scrollY BEFORE we navigate away. Delegated click on the shell,
  // so any new quizadmin link added later is covered automatically.
  const shellElement = document.getElementById('quizadmin-shell');
  if (shellElement) {
    shellElement.addEventListener('click', function (event) {
      const anchor = event.target.closest('a[href]');
      if (!anchor) return;
      if (anchor.target === '_blank') return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (href.startsWith('http') && !href.startsWith(window.location.origin)) return;
      // Save scrollY keyed by the DESTINATION path so the next page can
      // restore it. For same-path clicks (filter apply, etc.) this also
      // works because the destination path equals the current path.
      try {
        const destinationUrl = new URL(anchor.href, window.location.origin);
        const destinationKey = STORAGE_KEY_PREFIX + destinationUrl.pathname;
        sessionStorage.setItem(destinationKey, String(window.scrollY));
      } catch (error) {
        // If URL parsing fails, fall back to current path.
        sessionStorage.setItem(storageKeyForCurrentPath(), String(window.scrollY));
      }
    }, true);
  }

  // Save scrollY before any programmatic navigation too (JS location.href).
  // Exposed as a global helper so JS code paths can opt in.
  window.quizadminSaveScrollForPath = function (destinationPath) {
    const destinationKey = STORAGE_KEY_PREFIX + (destinationPath || window.location.pathname);
    sessionStorage.setItem(destinationKey, String(window.scrollY));
  };

  // Restore scrollY on load, AFTER the browser has done its default
  // fragment scroll (so we override any unwanted default).
  window.addEventListener('load', function () {
    const restoreKey = storageKeyForCurrentPath();
    const savedScrollY = sessionStorage.getItem(restoreKey);
    if (savedScrollY === null) return;
    sessionStorage.removeItem(restoreKey);
    const targetScrollY = parseInt(savedScrollY, 10);
    if (Number.isNaN(targetScrollY)) return;
    // Defer one frame so anything that sets scrollY=0 during load has run.
    requestAnimationFrame(function () {
      window.scrollTo(0, targetScrollY);
    });
  });
})();
