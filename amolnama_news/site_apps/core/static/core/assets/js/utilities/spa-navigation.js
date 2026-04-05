/* spa-navigation.js — SPA hybrid navigation (PJAX pattern)
   Intercepts sidebar nav clicks, fetches content via AJAX, swaps <main> only.
   Sidebar/header/footer never reload. URL updates via pushState. SEO untouched. */
(function () {
  'use strict';

  var mainElement = document.querySelector('main');
  if (!mainElement) return;

  var isNavigating = false;
  var currentAbortController = null;
  var isPushState = true; // false during popstate (back/forward)

  var sidebarNav = document.getElementById('sidebar-navigation');
  if (!sidebarNav) return;

  // Prefetch on hover — start download before click
  var prefetchCache = {};
  sidebarNav.addEventListener('mouseenter', function (event) {
    var link = event.target.closest('a.sidebar-navigation-item');
    if (!link) return;
    var url = link.getAttribute('href');
    if (!url || url === window.location.pathname || prefetchCache[url]) return;
    prefetchCache[url] = fetch(url).then(function (response) {
      return response.ok ? response.text() : null;
    }).catch(function () { return null; });
  }, true);

  // Intercept sidebar nav link clicks
  sidebarNav.addEventListener('click', function (event) {
    var link = event.target.closest('a.sidebar-navigation-item');
    if (!link) return;

    var url = link.getAttribute('href');
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

  function navigateTo(url) {
    if (isNavigating && currentAbortController) currentAbortController.abort();

    isNavigating = true;
    currentAbortController = new AbortController();
    showLoadingBar();

    // Use prefetch cache if available, otherwise fetch fresh
    var fetchPromise = prefetchCache[url]
      ? prefetchCache[url].then(function (cached) {
          delete prefetchCache[url];
          if (cached) return cached;
          return fetch(url, { signal: currentAbortController.signal }).then(function (r) { return r.ok ? r.text() : null; });
        })
      : fetch(url, { signal: currentAbortController.signal }).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        });

    fetchPromise.then(function (html) {
        if (!html) { window.location.href = url; return; }
        var parsed = new DOMParser().parseFromString(html, 'text/html');
        var newMain = parsed.querySelector('main');
        var newTitle = parsed.querySelector('title');

        if (!newMain) {
          window.location.href = url;
          return;
        }

        // Step 1: Hide content instantly (prevents flash of old content)
        mainElement.style.opacity = '0';

        // Step 2: Start loading CSS (non-blocking)
        loadPageCss(parsed);

        // Step 3: Swap content immediately (CSS may still be loading but inline styles are ready)
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

        // Step 8: Scroll to top
        mainElement.scrollTop = 0;
        window.scrollTo(0, 0);

        // Step 9: Show content (fade in after one frame — CSS applied)
        requestAnimationFrame(function () {
          mainElement.style.opacity = '1';
        });

        hideLoadingBar();
        isNavigating = false;
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
      var href = item.getAttribute('href') || '';
      var isActive = (href === '/' && url === '/') || (href !== '/' && url.startsWith(href));
      item.classList.toggle('sidebar-navigation-item-active', isActive);
    });
  }

  // =========================================================
  // PAGE-SPECIFIC CSS — load before content swap
  // =========================================================

  // Track which CSS hrefs are part of the base template (never change)
  var baseCssHrefs = new Set();
  document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
    baseCssHrefs.add(link.getAttribute('href'));
  });
  var baseStyleCount = document.querySelectorAll('style').length;

  function loadPageCss(parsedDocument) {
    // Find what the new page needs
    var newPageCssHrefs = new Set();
    parsedDocument.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && !baseCssHrefs.has(href)) newPageCssHrefs.add(href);
    });

    // Find what's currently loaded (page-specific only)
    var currentSpaCssHrefs = new Set();
    document.querySelectorAll('link[data-spa-css]').forEach(function (link) {
      currentSpaCssHrefs.add(link.getAttribute('href'));
    });

    // Remove CSS that the new page doesn't need
    document.querySelectorAll('link[data-spa-css]').forEach(function (link) {
      if (!newPageCssHrefs.has(link.getAttribute('href'))) link.remove();
    });

    // Remove old inline styles (always replaced)
    document.querySelectorAll('style[data-spa-css]').forEach(function (style) {
      style.remove();
    });

    // Add CSS that's new (not already loaded)
    newPageCssHrefs.forEach(function (href) {
      if (!currentSpaCssHrefs.has(href)) {
        var newLink = document.createElement('link');
        newLink.rel = 'stylesheet';
        newLink.href = href;
        newLink.setAttribute('data-spa-css', 'true');
        document.head.appendChild(newLink);
      }
    });

    // Add inline <style> blocks beyond base count
    var parsedStyles = parsedDocument.querySelectorAll('style');
    for (var i = baseStyleCount; i < parsedStyles.length; i++) {
      var newStyle = document.createElement('style');
      newStyle.textContent = parsedStyles[i].textContent;
      newStyle.setAttribute('data-spa-css', 'true');
      document.head.appendChild(newStyle);
    }
  }

  // =========================================================
  // PAGE-SPECIFIC JS — load after content swap
  // =========================================================

  // Track which script srcs are part of the base template
  var baseScriptSrcs = new Set();
  document.querySelectorAll('script[src]').forEach(function (script) {
    baseScriptSrcs.add(script.getAttribute('src'));
  });

  function loadPageJs(parsedDocument) {
    // Remove old page-specific scripts
    document.querySelectorAll('[data-spa-js]').forEach(function (script) {
      script.remove();
    });

    // Only process scripts from the parsed <body> (where extra_js lives)
    var parsedBody = parsedDocument.querySelector('body');
    if (!parsedBody) return;

    parsedBody.querySelectorAll('script').forEach(function (script) {
      var src = script.getAttribute('src');

      if (src) {
        if (!baseScriptSrcs.has(src)) {
          var newScript = document.createElement('script');
          newScript.src = src;
          newScript.setAttribute('data-spa-js', 'true');
          document.body.appendChild(newScript);
        }
      } else if (script.textContent.trim()) {
        var newScript = document.createElement('script');
        newScript.textContent = script.textContent;
        newScript.setAttribute('data-spa-js', 'true');
        document.body.appendChild(newScript);
      }
    });
  }

  // =========================================================
  // BROWSER BACK/FORWARD
  // =========================================================

  history.replaceState({ url: window.location.pathname }, '', window.location.pathname);

  window.addEventListener('popstate', function (event) {
    if (event.state && event.state.url) {
      isPushState = false;
      navigateTo(event.state.url);
    }
  });

  // =========================================================
  // LOADING BAR
  // =========================================================

  var loadingBar = document.createElement('div');
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
