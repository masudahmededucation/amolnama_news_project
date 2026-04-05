/* spa-navigation.js — SPA hybrid navigation (PJAX pattern)
   Intercepts sidebar nav clicks, fetches content via AJAX, swaps <main> only.
   Sidebar/header/footer never reload. URL updates via pushState. SEO untouched. */
(function () {
  'use strict';

  const mainElement = document.querySelector('main');
  if (!mainElement) return;

  let isNavigating = false;
  let currentAbortController = null;
  let isPushState = true; // false during popstate (back/forward)

  const sidebarNav = document.getElementById('sidebar-navigation');
  if (!sidebarNav) return;

  // Prefetch on hover — start download before click + preload page CSS
  const prefetchCache = {};
  sidebarNav.addEventListener('mouseenter', function (event) {
    let link = event.target.closest('a.sidebar-navigation-item');
    if (!link) return;
    let url = link.getAttribute('href');
    if (!url || url === window.location.pathname || prefetchCache[url]) return;
    prefetchCache[url] = fetch(url).then(function (response) {
      if (!response.ok) return null;
      return response.text().then(function (html) {
        // Preload page-specific CSS so it's cached before navigation
        preloadPageCss(html);
        return html;
      });
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
          return fetch(url, { signal: currentAbortController.signal }).then(function (r) { return r.ok ? r.text() : null; }).catch(function () { return null; });
        })
      : fetch(url, { signal: currentAbortController.signal }).then(function (r) {
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

        // Step 1: Hide content instantly (prevents flash of old content)
        mainElement.style.opacity = '0';

        // Step 2: Load CSS and wait for it to finish before showing content
        const cssReadyPromise = loadPageCss(parsed);

        // Step 3: Swap content (hidden — opacity is 0)
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

  // Preload page-specific CSS from prefetched HTML (hover prefetch)
  // Injects <link rel="preload" as="style"> so CSS is cached before navigation
  function preloadPageCss(html) {
    var parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href || baseCssHrefs.has(href)) return;
      // Skip if already preloaded or loaded
      if (document.querySelector('link[href="' + href + '"]')) return;
      var preload = document.createElement('link');
      preload.rel = 'preload';
      preload.as = 'style';
      preload.href = href;
      preload.setAttribute('data-spa-preload', 'true');
      document.head.appendChild(preload);
    });
  }

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

    // Clean up preload hints (they've done their job — browser has cached the CSS)
    document.querySelectorAll('link[data-spa-preload]').forEach(function (link) {
      link.remove();
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

    parsedBody.querySelectorAll('script').forEach(function (script) {
      const src = script.getAttribute('src');

      if (src) {
        if (!baseScriptSrcs.has(src)) {
          let newScript = document.createElement('script');
          newScript.src = src;
          newScript.setAttribute('data-spa-js', 'true');
          document.body.appendChild(newScript);
        }
      } else if (script.textContent.trim()) {
        const newScript = document.createElement('script');
        newScript.textContent = script.textContent;
        newScript.setAttribute('data-spa-js', 'true');
        document.body.appendChild(newScript);
      }
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
