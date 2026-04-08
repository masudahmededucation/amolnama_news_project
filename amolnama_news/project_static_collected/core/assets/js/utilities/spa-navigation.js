/* spa-navigation.js — SPA hybrid navigation (PJAX pattern)
   Intercepts sidebar nav clicks, fetches content via AJAX, swaps <main> only.
   Sidebar/header/footer never reload. URL updates via pushState. SEO untouched. */

/* ---- SPA Cleanup Registry ----
   Page-specific scripts register cleanup functions (e.g., flatpickr.destroy()).
   SPA navigation calls all registered cleanups before swapping content. */
(function () {
  var cleanupFunctions = [];
  window.spaCleanupRegister = function (fn) {
    if (typeof fn === 'function') cleanupFunctions.push(fn);
  };
  window.spaCleanupRun = function () {
    cleanupFunctions.forEach(function (fn) {
      try { fn(); } catch (error) { console.error('SPA cleanup error:', error); }
    });
    cleanupFunctions = [];
  };
})();

(function () {
  'use strict';

  const mainElement = document.querySelector('main');
  if (!mainElement) return;

  let isNavigating = false;
  let currentAbortController = null;
  let isPushState = true; // false during popstate (back/forward)

  const sidebarNav = document.getElementById('sidebar-navigation');
  if (!sidebarNav) return;

  // Prefetch on hover — start HTML download before click
  const prefetchCache = {};
  sidebarNav.addEventListener('mouseenter', function (event) {
    let link = event.target.closest('a.sidebar-navigation-item');
    if (!link) return;
    let url = link.getAttribute('href');
    if (!url || url === window.location.pathname || prefetchCache[url]) return;
    prefetchCache[url] = fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then(function (response) {
      return response.ok ? response.text() : null;
    }).catch(function () { return null; });
  }, true);

  // Intercept sidebar nav link clicks
  sidebarNav.addEventListener('click', function (event) {
    const link = event.target.closest('a.sidebar-navigation-item');
    if (!link) return;

    const url = link.getAttribute('href');
    if (!url) return;

    if (link.target === '_blank') return;
    if (url.startsWith('http') && !url.startsWith(window.location.origin)) return;
    if (url.startsWith('#')) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (url === window.location.pathname) return;

    event.preventDefault();
    isPushState = true;
    navigateTo(url);
  });

  function navigateTo(url, restoreScrollY) {
    if (isNavigating && currentAbortController) currentAbortController.abort();

    isNavigating = true;
    currentAbortController = new AbortController();
    showLoadingBar();

    // Use prefetch cache if available, otherwise fetch fresh
    const fetchPromise = prefetchCache[url]
      ? prefetchCache[url].then(function (cached) {
          delete prefetchCache[url];
          if (cached) return cached;
          return fetch(url, { signal: currentAbortController.signal, headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then(function (r) { return r.ok ? r.text() : null; }).catch(function () { return null; });
        })
      : fetch(url, { signal: currentAbortController.signal, headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        });

    fetchPromise.then(function (html) {
        if (!html) { window.location.href = url; return; }
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const newMain = parsed.querySelector('main');
        const newTitle = parsed.querySelector('title');

        if (!newMain) {
          window.location.href = url;
          return;
        }

        // Step 0: Save scroll position before leaving (for back/forward restore)
        history.replaceState(
          { url: window.location.pathname, scrollY: window.scrollY },
          '', window.location.pathname
        );

        // Step 0b: Run registered cleanup functions (destroy third-party instances)
        window.spaCleanupRun();

        // Step 0c: Fallback — remove any orphaned DOM that destroy() missed
        document.querySelectorAll(
          '.flatpickr-calendar, .ts-dropdown, .pwa-tooltip, .quill-avro-suggestions, .ql-toolbar, .ql-tooltip'
        ).forEach(function (orphan) {
          orphan.remove();
        });

        // Step 1: Hide content INSTANTLY — disable transition so opacity jumps to 0
        mainElement.style.transition = 'none';
        mainElement.style.opacity = '0';
        // Force reflow — browser commits opacity:0 before we swap content
        void mainElement.offsetHeight;

        // Step 2: Load CSS and wait for it to finish before showing content
        const cssReadyPromise = loadPageCss(parsed);

        // Step 3: Swap content (guaranteed hidden — opacity is 0, no transition)
        mainElement.innerHTML = newMain.innerHTML;

        // Step 4: Update title
        if (newTitle) document.title = newTitle.textContent;

        // Step 5: Update URL (only on click, not on back/forward)
        if (isPushState) {
          history.pushState({ url: url }, '', url);
        }

        // Step 6: Update sidebar highlight
        updateSidebarActiveState(url);

        // Step 7: Load page-specific JS
        loadPageJs(parsed);

        // Step 8: Scroll — restore position on back/forward, top on new navigation
        mainElement.scrollTop = 0;
        if (!isPushState && restoreScrollY !== undefined) {
          window.scrollTo(0, restoreScrollY);
        } else {
          window.scrollTo(0, 0);
        }

        // Step 9: Show content ONLY after CSS is ready (or 500ms timeout)
        function revealContent() {
          requestAnimationFrame(function () {
            // Restore transition for smooth fade-in (was disabled in Step 1)
            mainElement.style.transition = 'opacity .15s ease';
            mainElement.style.opacity = '1';
          });
          hideLoadingBar();
          isNavigating = false;
        }

        // Race: CSS load vs 500ms timeout (never leave page invisible)
        let revealed = false;
        function revealOnce() {
          if (revealed) return;
          revealed = true;
          revealContent();
        }

        cssReadyPromise.then(revealOnce);
        setTimeout(revealOnce, 500);
      })
      .catch(function (error) {
        if (error.name === 'AbortError') return;
        hideLoadingBar();
        isNavigating = false;
        window.location.href = url;
      });
  }

  // =========================================================
  // SIDEBAR ACTIVE STATE
  // =========================================================

  function updateSidebarActiveState(url) {
    sidebarNav.querySelectorAll('.sidebar-navigation-item').forEach(function (item) {
      let href = item.getAttribute('href') || '';
      const isActive = (href === '/' && url === '/') || (href !== '/' && url.startsWith(href));
      item.classList.toggle('sidebar-navigation-item-active', isActive);
    });
  }

  // =========================================================
  // PAGE-SPECIFIC CSS — load before content swap
  // =========================================================

  // Track which CSS hrefs are part of the base template (never change)
  const baseCssHrefs = new Set();
  document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
    baseCssHrefs.add(link.getAttribute('href'));
  });

  function loadPageCss(parsedDocument) {
    // Find what the new page needs (external CSS only — no inline styles in templates)
    const newPageCssHrefs = new Set();
    parsedDocument.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      const href = link.getAttribute('href');
      if (href && !baseCssHrefs.has(href)) newPageCssHrefs.add(href);
    });

    // Find what's currently loaded (page-specific only)
    const currentSpaCssHrefs = new Set();
    document.querySelectorAll('link[data-spa-css]').forEach(function (link) {
      currentSpaCssHrefs.add(link.getAttribute('href'));
    });

    // Remove CSS that the new page doesn't need
    document.querySelectorAll('link[data-spa-css]').forEach(function (link) {
      if (!newPageCssHrefs.has(link.getAttribute('href'))) link.remove();
    });

    // Add CSS that's new (not already loaded) — return Promise that resolves when all loaded
    const cssLoadPromises = [];
    newPageCssHrefs.forEach(function (href) {
      if (!currentSpaCssHrefs.has(href)) {
        const newLink = document.createElement('link');
        newLink.rel = 'stylesheet';
        newLink.href = href;
        newLink.setAttribute('data-spa-css', 'true');
        cssLoadPromises.push(new Promise(function (resolve) {
          newLink.onload = resolve;
          newLink.onerror = resolve;
        }));
        document.head.appendChild(newLink);
      }
    });

    // If no new CSS needed, resolve immediately
    return cssLoadPromises.length > 0 ? Promise.all(cssLoadPromises) : Promise.resolve();
  }

  // =========================================================
  // PAGE-SPECIFIC JS — load after content swap
  // =========================================================

  // Track which script srcs are part of the base template
  const baseScriptSrcs = new Set();
  document.querySelectorAll('script[src]').forEach(function (script) {
    baseScriptSrcs.add(script.getAttribute('src'));
  });

  function loadPageJs(parsedDocument) {
    // Remove old page-specific scripts
    document.querySelectorAll('[data-spa-js]').forEach(function (script) {
      script.remove();
    });

    // Only process scripts from the parsed <body> (where extra_js lives)
    const parsedBody = parsedDocument.querySelector('body');
    if (!parsedBody) return;

    // Split scripts into external (CDN) and local groups
    // External CDN scripts must load FIRST — local scripts depend on them
    const externalScripts = [];
    const localScripts = [];

    parsedBody.querySelectorAll('script').forEach(function (script) {
      // Skip non-JS script types (speculationrules, application/json, etc.)
      const scriptType = script.getAttribute('type');
      if (scriptType && scriptType !== 'text/javascript') return;

      const src = script.getAttribute('src');

      if (src) {
        if (baseScriptSrcs.has(src)) return; // Skip base scripts
        // CDN = starts with http (not same origin)
        if (src.startsWith('http')) {
          externalScripts.push({ src: src });
        } else {
          localScripts.push({ src: src });
        }
      } else if (script.textContent.trim()) {
        localScripts.push({ inline: script.textContent });
      }
    });

    // Load external CDN scripts first — wait for all to finish
    const externalLoadPromises = externalScripts.map(function (scriptInfo) {
      return new Promise(function (resolve) {
        const newScript = document.createElement('script');
        newScript.src = scriptInfo.src;
        newScript.setAttribute('data-spa-js', 'true');
        newScript.onload = resolve;
        newScript.onerror = resolve; // Don't block on CDN failure
        document.body.appendChild(newScript);
      });
    });

    // After external scripts are ready, load local scripts in order
    const externalReady = externalLoadPromises.length > 0
      ? Promise.all(externalLoadPromises)
      : Promise.resolve();

    externalReady.then(function () {
      localScripts.forEach(function (scriptInfo) {
        const newScript = document.createElement('script');
        if (scriptInfo.src) {
          newScript.src = scriptInfo.src;
        } else {
          newScript.textContent = scriptInfo.inline;
        }
        newScript.setAttribute('data-spa-js', 'true');
        document.body.appendChild(newScript);
      });
    });
  }

  // =========================================================
  // BROWSER BACK/FORWARD
  // =========================================================

  history.replaceState({ url: window.location.pathname, scrollY: 0 }, '', window.location.pathname);

  window.addEventListener('popstate', function (event) {
    if (event.state && event.state.url) {
      isPushState = false;
      navigateTo(event.state.url, event.state.scrollY);
    }
  });

  // =========================================================
  // LOADING BAR
  // =========================================================

  const loadingBar = document.createElement('div');
  loadingBar.style.cssText = 'position:fixed;top:0;left:0;height:3px;background:var(--primary);z-index:9999;transition:width .3s;width:0;display:none;';
  document.body.appendChild(loadingBar);

  function showLoadingBar() {
    loadingBar.style.width = '0';
    loadingBar.style.display = 'block';
    requestAnimationFrame(function () { loadingBar.style.width = '70%'; });
  }

  function hideLoadingBar() {
    loadingBar.style.width = '100%';
    setTimeout(function () { loadingBar.style.display = 'none'; }, 300);
  }

})();
