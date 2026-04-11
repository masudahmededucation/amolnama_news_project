/* analytics-dashboard.js — apply fill-percent from data-attr to CSS custom property */
(function () {
  'use strict';
  const contentBars = document.querySelectorAll('.analytics-content-bar[data-fill-percent]');
  contentBars.forEach(function (bar) {
    const fillPercent = bar.getAttribute('data-fill-percent');
    bar.style.setProperty('--analytics-content-bar-fill-percent', fillPercent + '%');
  });
})();
