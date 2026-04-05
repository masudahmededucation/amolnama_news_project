/**
 * news-form-validate.js
 * Unified client-side validation for all mandatory fields and length limits.
 * - Real-time: step dots turn red immediately as errors appear/resolve.
 * - On submit: shows inline warnings, navigates to first error step.
 * - On input/change: clears warnings and re-evaluates step error dots.
 */
(function () {
  const form = document.querySelector('.news-collection-form, .news-multistep-form');
  if (!form) return;

  const isMultistep = form.classList.contains('news-multistep-form');

  /* ========== Prevent Enter-key form submission ========== */
  /* Text/number inputs submit on Enter by default — block this globally.
     The form should only submit via the explicit Submit button. */
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    const tag = e.target.tagName;
    const type = (e.target.type || '').toLowerCase();
    if (tag === 'INPUT' && (type === 'text' || type === 'number' || type === 'search' || type === 'tel' || type === 'url')) {
      e.preventDefault();
    }
  });

  /* ========== Validation Rules ========== */

  const MANDATORY = [
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
      customCheck: function () {
        const area = document.getElementById('selected-tags-area');
        return area && area.querySelector('input[name="tag_ids"]');
      }
    },
    /* WCV step 4 — victim first name in English (mandatory) */
    {
      id: 'wcv-victim-first-name-en',
      msg: 'ভুক্তভোগীর প্রথম নাম (ইংরেজি) দিন (Please enter victim first name in English)',
      getContainer: function (el) { return el.closest('.form-field'); }
    },
    /* WCV step 4 — victim last name in English (mandatory) */
    {
      id: 'wcv-victim-last-name-en',
      msg: 'ভুক্তভোগীর শেষ নাম (ইংরেজি) দিন (Please enter victim last name in English)',
      getContainer: function (el) { return el.closest('.form-field'); }
    },
    /* WCV step 4 — age (mandatory, must be > 0) */
    {
      id: 'wcv-victim-age',
      msg: 'ভুক্তভোগীর বয়স দিন (Please enter victim age)',
      getContainer: function (el) { return el.closest('.form-field'); },
      customCheck: function () {
        let el = document.getElementById('wcv-victim-age');
        return el && el.value && parseInt(el.value, 10) > 0;
      }
    },
    /* WCV step 4 — gender radio (mandatory) */
    {
      id: 'wcv-gender-radios',
      checkName: 'wcv_victim_gender',
      msg: 'লিঙ্গ নির্বাচন করুন (Please select gender)',
      getContainer: function (el) { return el.closest('.form-field'); },
      customCheck: function () { return document.querySelector('input[name="wcv_victim_gender"]:checked'); }
    },
    /* WCV step 4 — marital status (mandatory select) */
    {
      id: 'wcv-victim-marital',
      msg: 'বৈবাহিক অবস্থা নির্বাচন করুন (Please select marital status)',
      getContainer: function (el) { return el.closest('.form-field'); }
    },
    /* WCV step 4 — occupation (mandatory select) */
    {
      id: 'wcv-victim-occupation',
      msg: 'পেশা নির্বাচন করুন (Please select occupation)',
      getContainer: function (el) { return el.closest('.form-field'); }
    },
    /* WCV form — violence type checkboxes (at least one required) */
    {
      id: 'wcv-violence-types-checkboxes',
      checkName: 'wcv_violence_type',
      msg: 'সহিংসতার ধরন নির্বাচন করুন (Please select at least one violence type)',
      getContainer: function (el) { return el.closest('.form-field'); },
      customCheck: function () {
        return document.querySelector('input[name="wcv_violence_type"]:checked');
      }
    },
    /* WCV form — incident location type (mandatory select) */
    {
      id: 'wcv-location-type',
      msg: 'ঘটনাস্থলের ধরন নির্বাচন করুন (Please select incident location type)',
      getContainer: function (el) { return el.closest('.form-field'); }
    },
    /* WCV step 5 — injury types (at least one required) */
    {
      id: 'wcv-injury-types-checkboxes',
      checkName: 'wcv_injury_type',
      msg: 'আঘাতের ধরন নির্বাচন করুন (Please select at least one injury type)',
      getContainer: function (el) { return el.closest('.form-field'); },
      customCheck: function () { return document.querySelector('input[name="wcv_injury_type"]:checked'); }
    },
    /* WCV step 5 — injury severity (mandatory radio) */
    {
      id: 'wcv-injury-severity-radios',
      checkName: 'wcv_injury_severity',
      msg: 'আঘাতের তীব্রতা নির্বাচন করুন (Please select injury severity)',
      getContainer: function (el) { return el.closest('.form-field'); },
      customCheck: function () { return document.querySelector('input[name="wcv_injury_severity"]:checked'); }
    },
    /* WCV step 5 — current condition (mandatory radio) */
    {
      id: 'wcv-condition-radios',
      checkName: 'wcv_victim_condition',
      msg: 'ভুক্তভোগীর বর্তমান অবস্থা নির্বাচন করুন (Please select victim condition)',
      getContainer: function (el) { return el.closest('.form-field'); },
      customCheck: function () { return document.querySelector('input[name="wcv_victim_condition"]:checked'); }
    },
    /* WCV step 5 — safety status (mandatory radio) */
    {
      id: 'wcv-safety-radios',
      checkName: 'wcv_victim_safety',
      msg: 'নিরাপত্তা অবস্থা নির্বাচন করুন (Please select safety status)',
      getContainer: function (el) { return el.closest('.form-field'); },
      customCheck: function () { return document.querySelector('input[name="wcv_victim_safety"]:checked'); }
    },
    /* WCV step 5 — consent (mandatory radio) */
    {
      id: 'wcv-consent-radios',
      checkName: 'wcv_victim_consent',
      msg: 'তথ্য প্রকাশে সম্মতি নির্বাচন করুন (Please select consent status)',
      getContainer: function (el) { return el.closest('.form-field'); },
      customCheck: function () { return document.querySelector('input[name="wcv_victim_consent"]:checked'); }
    },
    /* WCV step 7 — FIR/GD status (mandatory radio) */
    {
      id: 'wcv-fir-status-radios',
      checkName: 'wcv_fir_status',
      msg: 'এফআইআর/জিডি অবস্থা নির্বাচন করুন (Please select FIR/GD status)',
      getContainer: function (el) { return el.closest('.form-field'); },
      customCheck: function () { return document.querySelector('input[name="wcv_fir_status"]:checked'); }
    }
  ];

  const LENGTH_LIMITS = [
    { id: 'news-headline-bn', max: 100, label: 'শিরোনাম (Headline)' },
    { id: 'news-summary-bn', max: 400, label: 'সংক্ষেপ (Summary)' }
  ];

  /* ========== Create Warning Elements ========== */

  /* Mandatory field warnings + stars (hidden until triggered) */
  MANDATORY.forEach(function (field) {
    let el = document.getElementById(field.id);
    if (!el) return;
    let container = field.getContainer(el);
    if (!container) return;

    const label = container.querySelector('label[for="' + field.id + '"]')
             || container.querySelector('label')
             || container.querySelector('.field-label')
             || container.querySelector('.contributor-type-label')
             || container.querySelector('h4');

    /* Inject mandatory star — skip if already marked manually */
    if (label
        && !label.querySelector('.field-mandatory-star')
        && !label.querySelector('.required-mark')
        && label.textContent.indexOf('*') === -1) {
      const star = document.createElement('span');
      star.className = 'field-mandatory-star';
      star.textContent = ' *';
      label.appendChild(star);
    }

    let warning = document.createElement('span');
    warning.className = 'field-warning';
    warning.textContent = field.msg;

    if (label) {
      label.parentNode.insertBefore(warning, label.nextSibling);
    } else {
      container.appendChild(warning);
    }
  });

  /* Length limit warnings (hidden until triggered) */
  LENGTH_LIMITS.forEach(function (rule) {
    let el = document.getElementById(rule.id);
    if (!el) return;
    let container = el.closest('.form-field');
    if (!container) return;

    let warning = document.createElement('span');
    warning.className = 'field-warning field-warning-length';
    warning.setAttribute('data-limit-for', rule.id);
    container.appendChild(warning);
  });

  /* ========== Real-Time Validation ========== */

  form.addEventListener('input', onFieldChange);
  form.addEventListener('change', onFieldChange);

  function onFieldChange(e) {
    const targetId = e.target.id;

    /* Clear server-rendered field errors when the user edits the field */
    const fieldContainer = e.target.closest('.form-field');
    if (fieldContainer) {
      const serverErrors = fieldContainer.querySelector('.field-errors');
      if (serverErrors) serverErrors.remove();
    }

    /* Clear mandatory field warning if filled */
    for (let i = 0; i < MANDATORY.length; i++) {
      if (MANDATORY[i].id === targetId ||
          (MANDATORY[i].checkName && e.target.name === MANDATORY[i].checkName)) {
        clearMandatoryWarning(MANDATORY[i]);
        break;
      }
    }

    /* Check length limits in real-time */
    checkLengthLimits();

    /* Always re-evaluate step error dots */
    if (isMultistep) reevaluateStepErrors();
  }

  function clearMandatoryWarning(field) {
    let el = document.getElementById(field.id);
    if (!el) return;

    const isFilled = field.customCheck
      ? field.customCheck()
      : (el.value && el.value.trim());
    if (!isFilled) return;

    let container = field.getContainer(el);
    if (!container) return;
    let warning = container.querySelector('.field-warning:not(.field-warning-length)');
    if (warning) warning.style.display = '';
    container.classList.remove('field-shake');
  }

  /** Show/hide inline length warnings as the user types. */
  function checkLengthLimits() {
    LENGTH_LIMITS.forEach(function (rule) {
      let el = document.getElementById(rule.id);
      if (!el) return;
      let warning = form.querySelector('.field-warning-length[data-limit-for="' + rule.id + '"]');
      if (!warning) return;

      const len = (el.value || '').trim().length;
      if (len > rule.max) {
        warning.textContent = rule.label + ' সর্বোচ্চ ' + rule.max + ' অক্ষর, বর্তমানে ' + len + ' অক্ষর। (Max ' + rule.max + ' chars, currently ' + len + ')';
        warning.style.display = 'inline';
      } else {
        warning.style.display = '';
      }
    });
  }

  /* Watch tags area for chip add/remove (DOM mutations) */
  const tagsArea = document.getElementById('selected-tags-area');
  if (tagsArea) {
    new MutationObserver(function () {
      const tagField = MANDATORY[MANDATORY.length - 1];
      if (tagField.id === 'selected-tags-area') {
        clearMandatoryWarning(tagField);
        if (isMultistep) reevaluateStepErrors();
      }
    }).observe(tagsArea, { childList: true });
  }

  /* ========== Step Error Dot Evaluation ========== */

  /**
   * Scan each step panel for ANY visible error indicator and update stepper dots.
   * Generic — works with any error source (server errors, length warnings,
   * calendar validation, format checks, etc.) without enumerating specific rules.
   * Any script just needs to show a .field-warning or .field-errors element.
   */
  function reevaluateStepErrors() {
    if (!window.newshubStepper) return;
    const remaining = {};

    document.querySelectorAll('.step-panel[data-step]').forEach(function (panel) {
      const step = parseInt(panel.getAttribute('data-step'), 10);

      /* Server-rendered errors */
      if (panel.querySelector('.field-errors li')) {
        remaining[step] = true;
        return;
      }

      /* Any visible .field-warning (from any validation source) */
      const warnings = panel.querySelectorAll('.field-warning');
      for (let i = 0; i < warnings.length; i++) {
        if (warnings[i].style.display === 'inline') {
          remaining[step] = true;
          return;
        }
      }
    });

    window.newshubStepper.updateErrors(remaining);
  }

  /** Expose for other scripts (calendar, social URL, etc.) to trigger after showing/hiding errors. */
  window.newshubValidation = { reevaluateStepErrors: reevaluateStepErrors };

  /* ========== Validate on Submit ========== */

  form.addEventListener('submit', function (e) {
    let firstEmptyContainer = null;
    const errorStepNumbers = {};

    MANDATORY.forEach(function (field) {
      let el = document.getElementById(field.id);
      if (!el) return;
      const container = field.getContainer(el);
      if (!container) return;
      const warning = container.querySelector('.field-warning:not(.field-warning-length)');

      const isEmpty = field.customCheck
        ? !field.customCheck()
        : (!el.value || !el.value.trim());

      if (isEmpty) {
        e.preventDefault();
        if (warning) warning.style.display = 'inline';
        if (!firstEmptyContainer) firstEmptyContainer = container;

        if (isMultistep) {
          let panel = el.closest('.step-panel[data-step]');
          if (panel) errorStepNumbers[panel.getAttribute('data-step')] = true;
        }
      } else {
        if (warning) warning.style.display = '';
        container.classList.remove('field-shake');
      }
    });

    /* Also block submit if length limits exceeded */
    LENGTH_LIMITS.forEach(function (rule) {
      const el = document.getElementById(rule.id);
      if (!el || !el.value) return;
      if (el.value.trim().length > rule.max) {
        e.preventDefault();
        if (!firstEmptyContainer) {
          firstEmptyContainer = el.closest('.form-field');
        }
        if (isMultistep) {
          const panel = el.closest('.step-panel[data-step]');
          if (panel) errorStepNumbers[panel.getAttribute('data-step')] = true;
        }
      }
    });

    if (!firstEmptyContainer) return;

    if (isMultistep && window.newshubStepper) {
      const numericSteps = {};
      Object.keys(errorStepNumbers).forEach(function (step) {
        numericSteps[parseInt(step, 10)] = true;
      });
      window.newshubStepper.showErrors(numericSteps);
    } else if (!isMultistep) {
      firstEmptyContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstEmptyContainer.classList.remove('field-shake');
      void firstEmptyContainer.offsetWidth;
      firstEmptyContainer.classList.add('field-shake');
    }
  });

  /* ========== Initial Evaluation ========== */

  /* Run once on page load so step dots reflect current state immediately
     (e.g. after POST re-render with errors, or after persist restores partial data). */
  if (isMultistep) {
    setTimeout(function () { reevaluateStepErrors(); }, 500);
  }
})();
