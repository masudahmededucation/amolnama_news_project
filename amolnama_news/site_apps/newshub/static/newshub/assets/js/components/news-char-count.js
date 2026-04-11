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
  const fields = [
    { id: 'news-headline-bn',     max: 100 },
    { id: 'news-summary-bn',      max: 400 },
    { id: 'news-content-body-bn', max: 0 }    /* 0 = no limit, count only */
  ];

  fields.forEach(function (config) {
    const element = document.getElementById(config.id);
    if (!element) return;

    /* Create counter element */
    const counter = document.createElement('div');
    counter.className = 'char-count';
    element.parentNode.appendChild(counter);

    function update() {
      const len = element.value.normalize('NFKC').length;
      if (config.max > 0) {
        counter.textContent = len + '/' + config.max;
        if (len > config.max) {
          counter.classList.add('char-count-over');
          counter.classList.add('char-count-warn');
        } else if (len > config.max * 0.9) {
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
    element.addEventListener('blur', function () {
      const trimmed = element.value.replace(/^\s+|\s+$/g, '');
      if (trimmed !== element.value) {
        element.value = trimmed;
        update();
      }
    });

    element.addEventListener('input', update);
    update(); /* initial count (handles form-persist restore) */
  });
})();
