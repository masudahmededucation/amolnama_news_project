/**
 * Tools scroll pill — MutationObserver watchdog approach (Gemini).
 * Watches document.body for .tools-grid to appear/disappear.
 * No timing, no events, no polling — just watches the DOM.
 */
(function () {
  'use strict';

  var pill = null;
  var scrollHandler = null;

  function initPill() {
    if (pill) return;

    pill = document.createElement('div');
    pill.className = 'tools-scroll-pill';
    pill.id = 'tools-scroll-pill';
    pill.innerHTML = 'আরো টুল দেখুন <span style="font-size:28px">👇</span>';
    document.body.appendChild(pill);

    pill.onclick = function () {
      window.scrollBy({ top: 500, behavior: 'smooth' });
    };

    scrollHandler = function () {
      if (!document.contains(pill)) {
        window.removeEventListener('scroll', scrollHandler);
        window.removeEventListener('resize', scrollHandler);
        pill = null;
        scrollHandler = null;
        return;
      }
      var scrollHeight = document.documentElement.scrollHeight;
      var scrollPos = window.innerHeight + window.pageYOffset;
      if ((scrollHeight - scrollPos) < 50) {
        pill.style.opacity = '0';
        pill.style.pointerEvents = 'none';
      } else {
        pill.style.opacity = '1';
        pill.style.pointerEvents = 'auto';
      }
    };

    window.addEventListener('scroll', scrollHandler, { passive: true });
    window.addEventListener('resize', scrollHandler);
  }

  function destroyPill() {
    if (!pill) return;
    if (scrollHandler) {
      window.removeEventListener('scroll', scrollHandler);
      window.removeEventListener('resize', scrollHandler);
      scrollHandler = null;
    }
    pill.remove();
    pill = null;
  }

  // Watchdog: observe document.body for .tools-grid appearing/disappearing
  var observer = new MutationObserver(function () {
    var grid = document.querySelector('.tools-grid');
    if (grid && !pill) {
      initPill();
    } else if (!grid && pill) {
      destroyPill();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also check immediately on load
  if (document.querySelector('.tools-grid')) {
    initPill();
  }
})();
