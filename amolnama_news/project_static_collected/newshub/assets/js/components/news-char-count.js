/**
 * news-char-count.js
 * Live character counter for headline, summary, and content body fields.
 * Shows "current/max" (e.g. "47/1000") below each field.
 * Content body has no max — shows count only (e.g. "247").
 *
 * DOM dependencies:
 *   #news-headline-bn      — headline input (max 100, DB: nvarchar(100))
 *   #news-summary-bn       — summary textarea (max 400, DB: nvarchar(400))
 *   #news-content-body-bn  — content body textarea (no max, DB: nvarchar(max))
 */
(function () {
  var fields = [
    { id: 'news-headline-bn',     max: 100 },
    { id: 'news-summary-bn',      max: 400 },
    { id: 'news-content-body-bn', max: 0 }    /* 0 = no limit, count only */
  ];

  fields.forEach(function (cfg) {
    var el = document.getElementById(cfg.id);
    if (!el) return;

    /* Create counter element */
    var counter = document.createElement('div');
    counter.className = 'char-count';
    el.parentNode.appendChild(counter);

    function update() {
      var len = el.value.normalize('NFKC').length;
      if (cfg.max > 0) {
        counter.textContent = len + '/' + cfg.max;
        if (len > cfg.max) {
          counter.classList.add('char-count-over');
          counter.classList.add('char-count-warn');
        } else if (len > cfg.max * 0.9) {
          counter.classList.remove('char-count-over');
          counter.classList.add('char-count-warn');
        } else {
          counter.classList.remove('char-count-over');
          counter.classList.remove('char-count-warn');
        }
      } else {
        counter.textContent = len;
      }
    }

    /* Trim leading/trailing spaces when user leaves the field */
    el.addEventListener('blur', function () {
      var trimmed = el.value.replace(/^\s+|\s+$/g, '');
      if (trimmed !== el.value) {
        el.value = trimmed;
        update();
      }
    });

    el.addEventListener('input', update);
    update(); /* initial count (handles form-persist restore) */
  });
})();
