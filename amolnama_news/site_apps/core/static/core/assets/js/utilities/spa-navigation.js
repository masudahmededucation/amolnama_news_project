/* spa-navigation.js — SPA hybrid navigation (PJAX pattern)
   Intercepts sidebar nav clicks, fetches content via AJAX, swaps <main> only.
   Sidebar/header/footer never reload. URL updates via pushState. SEO untouched. */
(function () {
  'use strict';

  var mainElement = document.querySelector('main');
  if (!mainElement) return;

  var isNavigating = false;
  var currentAbortController = null;

  // Only intercept sidebar navigation links
  var sidebarNav = document.getElementById('sidebar-navigation');
  if (!sidebarNav) return;

  sidebarNav.addEventListener('click', function (event) {
    var link = event.target.closest('a.sidebar-navigation-item');
    if (!link) return;

    var url = link.getAttribute('href');
    if (!url) return;

    // Skip: external links, hash links, modifier keys, new tab
    if (link.target === '_blank') return;
    if (url.startsWith('http') && !url.startsWith(window.location.origin)) return;
    if (url.startsWith('#')) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    // Skip: same URL
    if (url === window.location.pathname) return;

    event.preventDefault();
    navigateTo(url);
  });

  function navigateTo(url) {
    if (isNavigating) {
      if (currentAbortController) currentAbortController.abort();
    }

    isNavigating = true;
    currentAbortController = new AbortController();

    // Show loading indicator
    showLoadingBar();

    fetch(url, { signal: currentAbortController.signal })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
      })
      .then(function (html) {
        var parsed = new DOMParser().parseFromString(html, 'text/html');
        var newMain = parsed.querySelector('main');
        var newTitle = parsed.querySelector('title');

        if (!newMain) {
          // Fallback: full page load if <main> not found
          window.location.href = url;
          return;
        }

        // Swap content
        mainElement.innerHTML = newMain.innerHTML;

        // Update title
        if (newTitle) document.title = newTitle.textContent;

        // Update URL
        history.pushState({ url: url }, '', url);

        // Update sidebar active state
        updateSidebarActiveState(url);

        // Handle page-specific CSS
        swapPageCss(parsed);

        // Handle page-specific JS
        swapPageJs(parsed);

        // Scroll content to top
        mainElement.scrollTop = 0;
        window.scrollTo(0, 0);

        // Done
        hideLoadingBar();
        isNavigating = false;
      })
      .catch(function (error) {
        if (error.name === 'AbortError') return;
        // Fallback: full page load on any error
        hideLoadingBar();
        isNavigating = false;
        window.location.href = url;
      });
  }

  // =========================================================
  // SIDEBAR ACTIVE STATE
  // =========================================================

  function updateSidebarActiveState(url) {
    var items = sidebarNav.querySelectorAll('.sidebar-navigation-item');
    items.forEach(function (item) {
      var href = item.getAttribute('href') || '';
      var isActive = false;

      if (href === '/' && url === '/') {
        isActive = true;
      } else if (href !== '/' && url.startsWith(href)) {
        isActive = true;
      }

      item.classList.toggle('sidebar-navigation-item-active', isActive);
    });
  }

  // =========================================================
  // PAGE-SPECIFIC CSS
  // =========================================================

  function swapPageCss(parsedDocument) {
    // Remove old page-specific CSS (marked with data-spa-css)
    document.querySelectorAll('link[data-spa-css]').forEach(function (link) {
      link.remove();
    });

    // Find new page-specific CSS from parsed document
    // These are CSS links NOT in the base template (not in our known base set)
    var baseCssHrefs = new Set();
    document.querySelectorAll('link[rel="stylesheet"]:not([data-spa-css])').forEach(function (link) {
      baseCssHrefs.add(link.getAttribute('href'));
    });

    parsedDocument.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && !baseCssHrefs.has(href)) {
        var newLink = document.createElement('link');
        newLink.rel = 'stylesheet';
        newLink.href = href;
        newLink.setAttribute('data-spa-css', 'true');
        document.head.appendChild(newLink);
      }
    });
  }

  // =========================================================
  // PAGE-SPECIFIC JS
  // =========================================================

  function swapPageJs(parsedDocument) {
    // Remove old page-specific scripts (marked with data-spa-js)
    document.querySelectorAll('script[data-spa-js]').forEach(function (script) {
      script.remove();
    });

    // Find scripts that are after the extra_js marker in parsed document
    // We look for scripts that are NOT in our base set
    var baseScriptSrcs = new Set();
    document.querySelectorAll('script[src]:not([data-spa-js])').forEach(function (script) {
      baseScriptSrcs.add(script.getAttribute('src'));
    });

    parsedDocument.querySelectorAll('script').forEach(function (script) {
      var src = script.getAttribute('src');

      if (src) {
        // External script — only load if not already in base
        if (!baseScriptSrcs.has(src)) {
          var newScript = document.createElement('script');
          newScript.src = src;
          newScript.setAttribute('data-spa-js', 'true');
          document.body.appendChild(newScript);
        }
      } else if (script.textContent.trim()) {
        // Inline script — execute it
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

  // Save initial state
  history.replaceState({ url: window.location.pathname }, '', window.location.pathname);

  window.addEventListener('popstate', function (event) {
    if (event.state && event.state.url) {
      navigateTo(event.state.url);
    }
  });

  // =========================================================
  // LOADING BAR
  // =========================================================

  var loadingBar = null;

  function showLoadingBar() {
    if (!loadingBar) {
      loadingBar = document.createElement('div');
      loadingBar.style.cssText = 'position:fixed;top:0;left:0;height:3px;background:var(--primary);z-index:9999;transition:width .3s;width:0;';
      document.body.appendChild(loadingBar);
    }
    loadingBar.style.width = '0';
    loadingBar.style.display = 'block';
    requestAnimationFrame(function () {
      loadingBar.style.width = '70%';
    });
  }

  function hideLoadingBar() {
    if (loadingBar) {
      loadingBar.style.width = '100%';
      setTimeout(function () {
        loadingBar.style.display = 'none';
      }, 300);
    }
  }

})();
