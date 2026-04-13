/**
 * Tools scroll pill — pushState intercept approach.
 * Re-runs check every time the URL changes via SPA navigation.
 */
(function () {
  'use strict';

  var pill = null;
  var scrollHandler = null;

  function syncPillState() {
    var grid = document.querySelector('.tools-grid');

    if (grid && !pill) {
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

    } else if (!grid && pill) {
      window.removeEventListener('scroll', scrollHandler);
      window.removeEventListener('resize', scrollHandler);
      pill.remove();
      pill = null;
      scrollHandler = null;
    }
  }

  // Intercept pushState and replaceState so we know when SPA navigates
  var origPushState = history.pushState;
  history.pushState = function () {
    var result = origPushState.apply(this, arguments);
    setTimeout(syncPillState, 500);
    return result;
  };

  var origReplaceState = history.replaceState;
  history.replaceState = function () {
    var result = origReplaceState.apply(this, arguments);
    setTimeout(syncPillState, 500);
    return result;
  };

  // Back/forward buttons
  window.addEventListener('popstate', function () {
    setTimeout(syncPillState, 500);
  });

  // Initial page load
  window.addEventListener('DOMContentLoaded', syncPillState);
  window.addEventListener('load', syncPillState);
})();
