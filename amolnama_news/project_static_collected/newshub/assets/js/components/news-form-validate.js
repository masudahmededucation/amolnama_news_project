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

  /* --- Create warning spans beside each label --- */
  MANDATORY.forEach(function (field) {
    var el = document.getElementById(field.id);
    if (!el) return;
    var container = field.getContainer(el);
    if (!container) return;

    /* Find the label or field-label for this field */
    var label = container.querySelector('label[for="' + field.id + '"]')
             || container.querySelector('label')
             || container.querySelector('.field-label')
             || container.querySelector('.contributor-type-label')
             || container.querySelector('h4');

    var warning = document.createElement('span');
    warning.className = 'field-warning';
    warning.textContent = field.msg;

    if (label) {
      /* Insert warning right after the label (inline beside it) */
      label.parentNode.insertBefore(warning, label.nextSibling);
    } else {
      container.appendChild(warning);
    }
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
    if (!el) return;

    /* Use customCheck if available, otherwise check el.value */
    var isFilled = field.customCheck
      ? field.customCheck()
      : (el.value && el.value.trim());
    if (!isFilled) return;

    var container = field.getContainer(el);
    if (!container) return;
    var warning = container.querySelector('.field-warning');
    if (warning) warning.style.display = '';
    container.classList.remove('field-shake');
  }

  /* --- Watch tags area for chip add/remove (DOM mutations) --- */
  var tagsArea = document.getElementById('selected-tags-area');
  if (tagsArea) {
    new MutationObserver(function () {
      var tagField = MANDATORY[MANDATORY.length - 1]; /* last entry = tags */
      if (tagField.id === 'selected-tags-area') {
        clearFieldWarning(tagField);
      }
    }).observe(tagsArea, { childList: true });
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
        if (warning) warning.style.display = 'inline';
        if (!firstEmpty) firstEmpty = container;
      } else {
        if (warning) warning.style.display = '';
        container.classList.remove('field-shake');
      }
    });

    if (firstEmpty) {
      /* If the failing field is inside a hidden container, show a form-level banner
         so the user gets visible feedback instead of silent blocking */
      if (firstEmpty.offsetWidth === 0 && firstEmpty.offsetHeight === 0) {
        var banner = form.parentNode.querySelector('.form-message-error');
        if (!banner) {
          banner = document.createElement('div');
          banner.className = 'form-message form-message-error';
          form.parentNode.insertBefore(banner, form);
        }
        banner.textContent = 'কিছু বাধ্যতামূলক ক্ষেত্র পূরণ হয়নি। (Some mandatory fields are empty.)';
        banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        firstEmpty.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstEmpty.classList.remove('field-shake');
        void firstEmpty.offsetWidth; /* force reflow to restart animation */
        firstEmpty.classList.add('field-shake');
      }
    }
  });
})();
