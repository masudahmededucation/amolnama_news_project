/* ========== Election Vote – Past Results Drillthrough ========== */
/* Applies bar-fill widths from data-percentage attributes
   (server-rendered party result items). */

(function applyBarFillWidths() {
  const apply = function () {
    const bars = document.querySelectorAll('.bar-fill[data-percentage]');
    bars.forEach(function (bar) {
      const percentage = parseFloat(bar.getAttribute('data-percentage')) || 0;
      bar.style.width = percentage + '%';
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
