/**
 * Tools scroll pill — floating "আরো টুল দেখুন 👇" indicator.
 * Shows on tools landing page only. Hides when user reaches bottom.
 * Listens for spa:navigate event to handle SPA page transitions.
 */
(function () {
  'use strict';

  var pill = null;
  var scrollHandler = null;

  function createPill() {
    if (pill) return;
    if (!document.querySelector('.tools-grid')) return;

    pill = document.createElement('div');
    pill.className = 'tools-scroll-pill';
    pill.id = 'tools-scroll-pill';
    pill.innerHTML = 'আরো টুল দেখুন <span style="font-size:28px">👇</span>';
    document.body.appendChild(pill);

    pill.onclick = function () {
      window.scrollBy({ top: 500, behavior: 'smooth' });
    };

    scrollHandler = function () {
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

  function removePill() {
    if (!pill) return;
    pill.remove();
    pill = null;
    if (scrollHandler) {
      window.removeEventListener('scroll', scrollHandler);
      window.removeEventListener('resize', scrollHandler);
      scrollHandler = null;
    }
  }

  function checkPage() {
    if (document.querySelector('.tools-grid')) {
      createPill();
    } else {
      removePill();
    }
  }

  // Run on initial page load
  window.addEventListener('load', checkPage);

  // Run when SPA navigation completes (custom event from spa-navigation.js)
  // Small delay ensures the DOM has fully painted after content swap
  document.addEventListener('spa:navigate', function () {
    setTimeout(checkPage, 150);
  });
})();
