/**
 * news-form-validate.js
 * Unified client-side validation for all mandatory fields.
 * On submit: checks each field, shows inline warning, scrolls + shakes the first empty one.
 * On input/change: clears the warning for that field.
 */
(function () {
  var form = document.querySelector('.news-collection-form');
  if (!form) return;

  var MANDATORY = [
    {
      id: 'contributor-full-name',
      msg: 'নাম লিখুন (Please enter your name)',
      getContainer: function (el) { return el.closest('.form-field'); }
    },
    {
      id: 'contributor-type',
      msg: 'ধরন নির্বাচন করুন (Please select contributor type)',
      getContainer: function (el) { return el.closest('.form-field'); }
    },
    {
      id: 'news-headline-bn',
      msg: 'শিরোনাম লিখুন (Please enter a headline)',
      getContainer: function (el) { return el.closest('.form-field'); }
    },
    {
      id: 'news-content-body-bn',
      msg: 'বিস্তারিত লিখুন (Please enter content)',
      getContainer: function (el) { return el.closest('.form-field'); }
    },
    {
      id: 'news-occurrence-at',
      msg: 'ঘটনার সময় দিন (Please enter occurrence time)',
      getContainer: function (el) { return el.closest('.form-field'); }
    },
    {
      id: 'news-district-id',
      msg: 'জেলা নির্বাচন করুন (Please select a district)',
      getContainer: function () { return document.getElementById('widget-location'); }
    },
    {
      id: 'selected-tags-area',
      msg: 'অন্তত একটি ট্যাগ যুক্ত করুন (Please add at least one tag)',
      getContainer: function () { return document.getElementById('widget-tags'); },
      /* Tags are chips, not an input — check for hidden inputs instead */
      customCheck: function () {
        var area = document.getElementById('selected-tags-area');
        return area && area.querySelector('input[name="tag_ids"]');
      }
    }
  ];

  /* --- Create warning divs inside each container --- */
  MANDATORY.forEach(function (field) {
    var el = document.getElementById(field.id);
    if (!el) return;
    var container = field.getContainer(el);
    if (!container) return;

    var warning = document.createElement('div');
    warning.className = 'field-warning';
    warning.style.display = 'none';
    warning.textContent = field.msg;
    container.appendChild(warning);
  });

  /* --- Clear warning on input / change --- */
  form.addEventListener('input', onFieldChange);
  form.addEventListener('change', onFieldChange);

  function onFieldChange(e) {
    var targetId = e.target.id;
    for (var i = 0; i < MANDATORY.length; i++) {
      if (MANDATORY[i].id === targetId) {
        clearFieldWarning(MANDATORY[i]);
        break;
      }
    }
  }

  function clearFieldWarning(field) {
    var el = document.getElementById(field.id);
    if (!el || !el.value || !el.value.trim()) return;
    var container = field.getContainer(el);
    if (!container) return;
    var warning = container.querySelector('.field-warning');
    if (warning) warning.style.display = 'none';
    container.classList.remove('field-shake');
  }

  /* --- Validate on submit --- */
  form.addEventListener('submit', function (e) {
    var firstEmpty = null;

    MANDATORY.forEach(function (field) {
      var el = document.getElementById(field.id);
      if (!el) return;
      var container = field.getContainer(el);
      if (!container) return;
      var warning = container.querySelector('.field-warning');

      var isEmpty = field.customCheck
        ? !field.customCheck()
        : (!el.value || !el.value.trim());

      if (isEmpty) {
        e.preventDefault();
        if (warning) warning.style.display = 'block';
        if (!firstEmpty) firstEmpty = container;
      } else {
        if (warning) warning.style.display = 'none';
        container.classList.remove('field-shake');
      }
    });

    if (firstEmpty) {
      firstEmpty.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstEmpty.classList.remove('field-shake');
      void firstEmpty.offsetWidth; /* force reflow to restart animation */
      firstEmpty.classList.add('field-shake');
    }
  });
})();
