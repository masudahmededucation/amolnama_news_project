/**
 * news-form-stepper.js
 * Multi-step form navigation controller.
 * Auto-generates the stepper indicator from step panel data attributes,
 * so adding/removing/reordering steps in the template automatically
 * updates the stepper UI.
 *
 * DOM dependencies:
 *   .step-panel[data-step]         — content panels (one per step)
 *     data-step-label-bn           — Bengali label shown under the dot
 *   #stepper                       — empty container; dots built by JS
 *   #btn-step-prev                 — previous button
 *   #btn-step-next                 — next button
 *   #step-counter                  — "ধাপ X / Y" label
 *   #form-type-picker (optional)   — card picker container
 *   #news-form-type   (optional)   — hidden input storing selected form type
 */
(function () {
  'use strict';

  var BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

  var stepPanels = document.querySelectorAll('.step-panel[data-step]');
  var btnPrev = document.getElementById('btn-step-prev');
  var btnNext = document.getElementById('btn-step-next');
  var stepCounter = document.getElementById('step-counter');
  var stepperContainer = document.getElementById('stepper');
  var formTypeInput = document.getElementById('news-form-type');
  var formTypePicker = document.getElementById('form-type-picker');

  if (!stepPanels.length || !btnNext) return;

  var totalSteps = stepPanels.length;
  var realTotalSteps = totalSteps;  /* actual panels on this page */
  var currentStep = 1;
  var selectedFormType = '';
  var stepDots = [];  /* populated by buildStepper() */
  var isPreviewMode = false;  /* true when showing a different form type's steps */
  var stepValidators = {};  /* step number → [validatorFn, ...] */

  /* Detect which step contains the Leaflet map (needs invalidateSize on show) */
  var mapStep = 0;
  stepPanels.forEach(function (panel) {
    if (panel.querySelector('#widget-location') || panel.querySelector('.news-map-pinpoint')) {
      mapStep = parseInt(panel.getAttribute('data-step'), 10);
    }
  });

  /* ========== Helpers ========== */

  function toBengaliNumber(num) {
    return String(num).split('').map(function (d) {
      return BENGALI_DIGITS[parseInt(d, 10)] || d;
    }).join('');
  }

  /* ========== Build Stepper Dots from Step Panels ========== */

  function buildStepper() {
    if (!stepperContainer) return;
    stepperContainer.innerHTML = '';

    stepPanels.forEach(function (panel, index) {
      var step = parseInt(panel.getAttribute('data-step'), 10);
      var labelBn = panel.getAttribute('data-step-label-bn') || '';

      /* Connecting line before each dot (except the first) */
      if (index > 0) {
        var line = document.createElement('div');
        line.className = 'step-line';
        stepperContainer.appendChild(line);
      }

      /* Dot */
      var dot = document.createElement('div');
      dot.className = 'step-dot';
      dot.setAttribute('data-step', step);

      var numSpan = document.createElement('span');
      numSpan.className = 'step-num';
      numSpan.textContent = toBengaliNumber(step);
      dot.appendChild(numSpan);

      var labelSpan = document.createElement('span');
      labelSpan.className = 'step-label';
      labelSpan.textContent = labelBn;
      dot.appendChild(labelSpan);

      /* Click handler */
      dot.addEventListener('click', function () {
        var targetStep = parseInt(dot.getAttribute('data-step'), 10);
        showStep(targetStep);
      });

      stepperContainer.appendChild(dot);
    });

    /* Cache dot references */
    stepDots = stepperContainer.querySelectorAll('.step-dot[data-step]');
  }

  /* ========== Build Stepper Preview from Card Labels ========== */

  /**
   * Rebuild the stepper dots from a JSON array of Bengali labels.
   * Used to preview the step layout of a different form type before redirect.
   * Step 1 is always marked active; other dots are non-navigable previews.
   * @param {string[]} labels — Bengali step labels, e.g. ["ফর্ম","তথ্যদাতা",...]
   */
  function buildStepperPreview(labels) {
    if (!stepperContainer || !labels || !labels.length) return;
    stepperContainer.innerHTML = '';
    isPreviewMode = true;
    totalSteps = labels.length;

    labels.forEach(function (label, index) {
      var step = index + 1;

      /* Connecting line before each dot (except the first) */
      if (index > 0) {
        var line = document.createElement('div');
        line.className = 'step-line';
        stepperContainer.appendChild(line);
      }

      /* Dot */
      var dot = document.createElement('div');
      dot.className = 'step-dot' + (step === 1 ? ' active' : ' preview');
      dot.setAttribute('data-step', step);

      var numSpan = document.createElement('span');
      numSpan.className = 'step-num';
      numSpan.textContent = toBengaliNumber(step);
      dot.appendChild(numSpan);

      var labelSpan = document.createElement('span');
      labelSpan.className = 'step-label';
      labelSpan.textContent = label;
      dot.appendChild(labelSpan);

      /* No click handler — preview dots are not navigable */

      stepperContainer.appendChild(dot);
    });

    stepDots = stepperContainer.querySelectorAll('.step-dot[data-step]');

    /* Update counter to reflect preview total */
    if (stepCounter) {
      stepCounter.textContent = 'ধাপ ' + toBengaliNumber(1) + ' / ' + toBengaliNumber(totalSteps);
    }
  }

  /**
   * Restore the stepper to the actual page panels (exit preview mode).
   */
  function restoreRealStepper() {
    isPreviewMode = false;
    totalSteps = realTotalSteps;
    buildStepper();
    showStep(1);
  }

  /* ========== Form Type Card Selection ========== */

  /* The form type that this page was built for (from view context) */
  var pageFormType = (formTypeInput && formTypeInput.value) ? formTypeInput.value : '';

  if (formTypePicker) {
    var cards = formTypePicker.querySelectorAll('.form-type-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        /* Deselect all */
        cards.forEach(function (c) { c.classList.remove('selected'); });
        /* Select this card */
        card.classList.add('selected');
        selectedFormType = card.getAttribute('data-type');
        if (formTypeInput) formTypeInput.value = selectedFormType;

        /* Preview the stepper for the selected form type.
           Always show preview so the user sees the step layout instantly. */
        var labelsJson = card.getAttribute('data-step-labels');
        if (labelsJson) {
          try {
            var labels = JSON.parse(labelsJson);
            buildStepperPreview(labels);
          } catch (e) {
            /* Invalid JSON — ignore */
          }
        }
      });
    });

    /* Restore selection after POST re-render (hidden input keeps the value) */
    if (pageFormType) {
      selectedFormType = pageFormType;
      cards.forEach(function (card) {
        if (card.getAttribute('data-type') === selectedFormType) {
          card.classList.add('selected');
        }
      });
    }
  }

  /* ========== Error Detection ========== */

  function detectErrorSteps() {
    var errors = {};
    stepPanels.forEach(function (panel) {
      var step = parseInt(panel.getAttribute('data-step'), 10);
      var fieldErrors = panel.querySelectorAll('.field-errors li');
      if (fieldErrors.length > 0) {
        errors[step] = true;
      }
    });
    return errors;
  }

  /* ========== Step Navigation ========== */

  var errorSteps = {};
  var isInitialLoad = true;

  function showStep(step) {
    currentStep = step;

    /* Panels */
    stepPanels.forEach(function (panel) {
      var panelStep = parseInt(panel.getAttribute('data-step'), 10);
      if (panelStep === currentStep) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    /* Dots */
    stepDots.forEach(function (dot) {
      var dotStep = parseInt(dot.getAttribute('data-step'), 10);
      dot.classList.remove('active', 'completed');
      if (dotStep === currentStep) {
        dot.classList.add('active');
      } else if (dotStep < currentStep) {
        dot.classList.add('completed');
      }
      if (errorSteps[dotStep]) {
        dot.classList.add('has-error');
      } else {
        dot.classList.remove('has-error');
      }
    });

    /* Lines */
    var stepLines = document.querySelectorAll('.step-line');
    stepLines.forEach(function (line, index) {
      if (index < currentStep - 1) {
        line.classList.add('completed');
      } else {
        line.classList.remove('completed');
      }
    });

    /* Prev button */
    if (btnPrev) {
      btnPrev.style.display = currentStep === 1 ? 'none' : '';
    }

    /* Next button — hide on last step (use real total when in preview, user is on step 1) */
    if (btnNext) {
      var effectiveTotal = isPreviewMode ? realTotalSteps : totalSteps;
      btnNext.style.display = currentStep === effectiveTotal ? 'none' : '';
    }

    /* Counter */
    if (stepCounter) {
      stepCounter.textContent = 'ধাপ ' + toBengaliNumber(currentStep) + ' / ' + toBengaliNumber(totalSteps);
    }

    /* Scroll stepper into view below the sticky header.
       Uses the browser's native scrollIntoView — works on all devices.
       Skip on initial page load so the page shows naturally from the top. */
    if (!isInitialLoad) {
      requestAnimationFrame(function () {
        if (!stepperContainer) return;
        var headerEl = document.querySelector('.header');
        stepperContainer.style.scrollMarginTop = (headerEl ? headerEl.offsetHeight : 0) + 'px';
        stepperContainer.scrollIntoView({ block: 'start' });
      });
    }

    /* Leaflet map fix */
    if (mapStep && currentStep === mapStep && window.newshubMapPinpoint) {
      setTimeout(function () {
        var map = window.newshubMapPinpoint.getMap();
        if (map) map.invalidateSize();
      }, 200);
    }
  }

  /* ========== Step Validation Helpers ========== */

  function getStepPanel(step) {
    for (var i = 0; i < stepPanels.length; i++) {
      if (parseInt(stepPanels[i].getAttribute('data-step'), 10) === step) return stepPanels[i];
    }
    return null;
  }

  function showStepWarnings(step, warnings) {
    var panel = getStepPanel(step);
    if (!panel) return;

    var container = panel.querySelector('.step-validation-messages');
    if (!container) {
      container = document.createElement('div');
      container.className = 'step-validation-messages';
      panel.insertBefore(container, panel.firstChild);
    }

    var html = '';
    for (var i = 0; i < warnings.length; i++) {
      html += '<div class="step-validation-msg">' + warnings[i] + '</div>';
    }
    container.innerHTML = html;
    container.style.display = '';

    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearStepWarnings(step) {
    var panel = getStepPanel(step);
    if (!panel) return;
    var container = panel.querySelector('.step-validation-messages');
    if (container) container.style.display = 'none';
  }

  function runStepValidators(step) {
    if (!stepValidators[step]) return [];
    var allWarnings = [];
    for (var i = 0; i < stepValidators[step].length; i++) {
      var result = stepValidators[step][i]();
      if (result && result.warnings && result.warnings.length) {
        allWarnings = allWarnings.concat(result.warnings);
      }
    }
    return allWarnings;
  }

  function registerStepValidator(step, fn) {
    if (!stepValidators[step]) stepValidators[step] = [];
    stepValidators[step].push(fn);
  }

  function goNext() {
    /* If a form-type picker exists on the current step, require selection */
    if (formTypePicker) {
      var pickerPanel = formTypePicker.closest('.step-panel[data-step]');
      if (pickerPanel && parseInt(pickerPanel.getAttribute('data-step'), 10) === currentStep) {
        if (!selectedFormType) {
          formTypePicker.classList.add('shake');
          setTimeout(function () { formTypePicker.classList.remove('shake'); }, 500);
          return;
        }
        /* Redirect to form-type-specific URL if different from current page */
        var selectedCard = formTypePicker.querySelector('.form-type-card.selected');
        if (selectedCard) {
          var targetUrl = selectedCard.getAttribute('data-url');
          if (targetUrl && targetUrl !== window.location.pathname) {
            /* Remember to auto-advance past step 1 after redirect */
            try { sessionStorage.setItem('newshub_advance', '1'); } catch (e) {}
            window.location.href = targetUrl;
            return;
          }
        }
      }
    }
    /* If leaving the picker step while in preview mode (same form type), restore */
    if (isPreviewMode) {
      restoreRealStepper();
    }

    /* Run registered step validators for the current step */
    var warnings = runStepValidators(currentStep);
    if (warnings.length) {
      showStepWarnings(currentStep, warnings);
      return;
    }
    clearStepWarnings(currentStep);

    /* Blur the button so browser doesn't anchor scroll to it */
    if (btnNext) btnNext.blur();
    if (currentStep < totalSteps) {
      showStep(currentStep + 1);
    }
  }

  function goPrev() {
    if (btnPrev) btnPrev.blur();
    if (currentStep > 1) {
      showStep(currentStep - 1);
    }
  }

  /* ========== Event Listeners ========== */

  btnNext.addEventListener('click', goNext);

  if (btnPrev) {
    btnPrev.addEventListener('click', goPrev);
  }

  /* ========== Public API (for validation and other scripts) ========== */

  /* Drain deferred validators queued by component scripts that loaded before us */
  var deferredQueue = window.__newshubStepValidators || [];
  for (var q = 0; q < deferredQueue.length; q++) {
    registerStepValidator(deferredQueue[q].step, deferredQueue[q].fn);
  }

  window.newshubStepper = {
    /** Mark specific steps as having errors and navigate to the first one.
     *  @param {Object} steps — e.g. { 2: true, 5: true, 7: true }  */
    showErrors: function (steps) {
      errorSteps = steps;
      var sorted = Object.keys(steps).map(Number).sort(function (a, b) { return a - b; });
      if (sorted.length) showStep(sorted[0]);
    },

    /** Update error markers on dots without navigating (used when fields are filled in). */
    updateErrors: function (steps) {
      errorSteps = steps;
      stepDots.forEach(function (dot) {
        var dotStep = parseInt(dot.getAttribute('data-step'), 10);
        if (errorSteps[dotStep]) {
          dot.classList.add('has-error');
        } else {
          dot.classList.remove('has-error');
        }
      });
    },

    /** Register a validator for a specific step (for scripts that load after stepper). */
    registerStepValidator: registerStepValidator
  };

  /* ========== AJAX Form Submit (no page reload on error) ========== */

  var mainForm = document.querySelector('form.multistep-form') || document.querySelector('form');
  if (mainForm) {
    mainForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var submitBtn = document.getElementById('news-submit-btn');
      var errorBanner = document.getElementById('ajax-submit-error');

      /* Create error banner if it doesn't exist */
      if (!errorBanner) {
        errorBanner = document.createElement('div');
        errorBanner.id = 'ajax-submit-error';
        errorBanner.style.cssText = 'display:none;background:#fde8e8;color:#c0392b;padding:12px 16px;border-radius:6px;margin:10px 0;font-size:.9rem;font-weight:600;border:1px solid #f5c6cb;';
        var submitWidget = document.getElementById('widget-submit');
        if (submitWidget) {
          submitWidget.insertBefore(errorBanner, submitWidget.firstChild);
        }
      }

      /* Hide previous error */
      errorBanner.style.display = 'none';

      /* Disable submit button */
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'জমা হচ্ছে... (Submitting...)';
      }

      var formData = new FormData(mainForm);

      fetch(mainForm.action || window.location.href, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      .then(function (response) {
        return response.json().then(function (data) {
          return { status: response.status, data: data };
        });
      })
      .then(function (result) {
        if (result.data.success) {
          /* Clear localStorage draft — must match key in news-form-persist.js */
          try {
            localStorage.removeItem('newshub_draft');
            localStorage.removeItem('newshub_draft_tags');
          } catch (ex) {}

          /* Redirect to success page */
          window.location.href = result.data.redirect || (window.location.pathname + '?submitted=1');
        } else {
          /* Save error message, reload page — persist restores all fields from localStorage */
          try { sessionStorage.setItem('newshub_submit_error', result.data.error || 'জমা দেওয়া সম্ভব হয়নি। (Submission failed.)'); } catch (ex) {}
          window.location.reload();
        }
      })
      .catch(function () {
        try { sessionStorage.setItem('newshub_submit_error', 'নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন। (Network error. Please try again.)'); } catch (ex) {}
        window.location.reload();
      });
    });
  }

  /* ========== Init ========== */

  buildStepper();

  errorSteps = detectErrorSteps();
  var hasErrors = Object.keys(errorSteps).length > 0;

  var startStep = 1;
  if (hasErrors) {
    var errorStepNumbers = Object.keys(errorSteps).map(Number).sort();
    startStep = errorStepNumbers[0];
  }

  /* Edit mode — skip to step 3 (news content: headline, summary, body) */
  if (window.__EDIT_MODE__ && startStep === 1) {
    startStep = 3;
  }

  showStep(startStep);

  /* Auto-advance past step 1 after a form-type redirect */
  try {
    if (sessionStorage.getItem('newshub_advance')) {
      sessionStorage.removeItem('newshub_advance');
      if (currentStep === 1 && selectedFormType) {
        showStep(2);
      }
    }
  } catch (e) {}

  isInitialLoad = false;

  /* Show submission error from previous attempt (stored in sessionStorage before reload) */
  try {
    var savedError = sessionStorage.getItem('newshub_submit_error');
    if (savedError) {
      sessionStorage.removeItem('newshub_submit_error');
      var errorBanner = document.createElement('div');
      errorBanner.id = 'ajax-submit-error';
      errorBanner.style.cssText = 'background:#fde8e8;color:#c0392b;padding:12px 16px;border-radius:6px;margin:10px 0;font-size:.9rem;font-weight:600;border:1px solid #f5c6cb;';
      errorBanner.textContent = savedError;
      var submitWidget = document.getElementById('widget-submit');
      if (submitWidget) {
        submitWidget.insertBefore(errorBanner, submitWidget.firstChild);
      }
      /* Navigate to the last step (submit step) so user sees the error */
      showStep(totalSteps);
    }
  } catch (ex) {}
})();
