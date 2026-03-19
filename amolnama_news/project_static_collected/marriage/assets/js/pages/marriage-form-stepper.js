/**
 * marriage-form-stepper.js
 * Multi-step stepper for the Nikah Nama (marriage form).
 * Handles Bengali/English language toggle, signature uploads,
 * and conditional field show/hide (Q21→Q22, Q6 bride status).
 */
(function () {
  'use strict';

  var BENGALI_DIGITS = ['\u09E6', '\u09E7', '\u09E8', '\u09E9', '\u09EA', '\u09EB', '\u09EC', '\u09ED', '\u09EE', '\u09EF'];

  var stepPanels = document.querySelectorAll('.step-panel[data-step]');
  var btnPrev = document.getElementById('btn-step-prev');
  var btnNext = document.getElementById('btn-step-next');
  var stepCounter = document.getElementById('step-counter');
  var stepperContainer = document.getElementById('stepper');

  if (!stepPanels.length || !btnNext) return;

  var totalSteps = stepPanels.length;
  var currentStep = 1;
  var stepDots = [];
  var isInitialLoad = true;

  /* ========== Language Toggle ========== */

  /* Use header toggle (form_lang) instead of marriage-specific toggle */
  var langRadios = document.querySelectorAll('input[name="form_lang"]');
  var currentLang = 'bn';
  for (var lr = 0; lr < langRadios.length; lr++) {
    if (langRadios[lr].checked) { currentLang = langRadios[lr].value; break; }
  }

  function setLang(lang) {
    currentLang = lang;
    var bnEls = document.querySelectorAll('.lbl-bn');
    var enEls = document.querySelectorAll('.lbl-en');
    if (lang === 'en') {
      bnEls.forEach(function (el) { el.style.display = 'none'; });
      enEls.forEach(function (el) { el.style.display = ''; });
    } else {
      bnEls.forEach(function (el) { el.style.display = ''; });
      enEls.forEach(function (el) { el.style.display = 'none'; });
    }

    /* Swap placeholders */
    var key = 'placeholder' + (lang === 'en' ? 'En' : 'Bn');
    document.querySelectorAll('[data-placeholder-bn]').forEach(function (el) {
      var newPh = el.dataset[key];
      if (newPh) el.placeholder = newPh;
    });

    /* Swap select default option text */
    document.querySelectorAll('select[data-placeholder-bn]').forEach(function (sel) {
      var opt = sel.options[0];
      if (opt && opt.value === '') {
        opt.textContent = '-- ' + (sel.dataset[key] || '') + ' --';
      }
    });
  }

  langRadios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      setLang(this.value);
    });
  });

  /* Apply initial language — also listen for news-form-lang.js applyLanguage */
  setLang(currentLang);

  /* Re-apply when body data-lang changes (set by news-form-lang.js) */
  var langObserver = new MutationObserver(function () {
    var bodyLang = document.body.getAttribute('data-lang');
    if (bodyLang && bodyLang !== currentLang) setLang(bodyLang);
  });
  langObserver.observe(document.body, { attributes: true, attributeFilter: ['data-lang'] });

  /* ========== Helpers ========== */

  function toBengaliNumber(num) {
    return String(num).split('').map(function (d) {
      return BENGALI_DIGITS[parseInt(d, 10)] || d;
    }).join('');
  }

  /* ========== Build Stepper Dots ========== */

  function buildStepper() {
    if (!stepperContainer) return;
    stepperContainer.innerHTML = '';

    stepPanels.forEach(function (panel, index) {
      var step = parseInt(panel.getAttribute('data-step'), 10);
      var labelBn = panel.getAttribute('data-step-label-bn') || '';

      if (index > 0) {
        var line = document.createElement('div');
        line.className = 'step-line';
        stepperContainer.appendChild(line);
      }

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

      dot.addEventListener('click', function () {
        var targetStep = parseInt(dot.getAttribute('data-step'), 10);
        showStep(targetStep);
      });

      stepperContainer.appendChild(dot);
    });

    stepDots = stepperContainer.querySelectorAll('.step-dot[data-step]');
  }

  /* ========== Step Navigation ========== */

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

    /* Next button — hide on last step */
    if (btnNext) {
      btnNext.style.display = currentStep === totalSteps ? 'none' : '';
    }

    /* Counter */
    if (stepCounter) {
      stepCounter.textContent = '\u09A7\u09BE\u09AA ' + toBengaliNumber(currentStep) + ' / ' + toBengaliNumber(totalSteps);
    }

    /* Scroll stepper into view (skip initial load) */
    if (!isInitialLoad) {
      requestAnimationFrame(function () {
        if (!stepperContainer) return;
        var headerEl = document.querySelector('.header');
        stepperContainer.style.scrollMarginTop = (headerEl ? headerEl.offsetHeight : 0) + 'px';
        stepperContainer.scrollIntoView({ block: 'start' });
      });
    }

    /* Dispatch event so other scripts (preview) can react */
    document.dispatchEvent(new CustomEvent('marriage:stepChanged', { detail: { step: currentStep } }));
  }

  /* ========== Signature Upload Previews ========== */

  function setupSigUpload(inputId, dropId) {
    var input = document.getElementById(inputId);
    var drop = document.getElementById(dropId);
    if (!input || !drop) return;

    input.addEventListener('change', function () {
      if (!input.files || !input.files[0]) return;
      var file = input.files[0];
      var reader = new FileReader();
      reader.onload = function () {
        drop.dataset.sigUrl = reader.result;
        var existing = drop.querySelector('.marriage-sig-preview');
        if (existing) existing.remove();
        var img = document.createElement('img');
        img.className = 'marriage-sig-preview';
        img.src = reader.result;
        drop.appendChild(img);
        var icon = drop.querySelector('.sig-icon');
        var texts = drop.querySelectorAll('.sig-text');
        if (icon) icon.style.display = 'none';
        texts.forEach(function (t) { t.style.display = 'none'; });
      };
      reader.readAsDataURL(file);
    });
  }

  setupSigUpload('sig-groom-file', 'sig-groom-drop');
  setupSigUpload('sig-bride-file', 'sig-bride-drop');
  setupSigUpload('sig-bride-advocate-file', 'sig-bride-advocate-drop');
  setupSigUpload('sig-groom-advocate-file', 'sig-groom-advocate-drop');
  setupSigUpload('sig-kazi-file', 'sig-kazi-drop');

  /* ========== Conditional Show/Hide ========== */

  /* Q21 → show wives count + Q22 if groom is married */
  var groomMaritalStatus = document.getElementById('groom-marital-status');
  var groomWivesWrap = document.getElementById('groom-wives-wrap');
  var groomArbitrationWrap = document.getElementById('groom-arbitration-wrap');

  if (groomMaritalStatus) {
    groomMaritalStatus.addEventListener('change', function () {
      var val = groomMaritalStatus.value;
      var showExtra = (val === 'married');
      if (groomWivesWrap) groomWivesWrap.style.display = showExtra ? '' : 'none';
      if (groomArbitrationWrap) groomArbitrationWrap.style.display = showExtra ? '' : 'none';
    });
  }

  /* Q6 → show previous husband if bride is widow/divorced */
  var brideMaritalStatus = document.getElementById('bride-marital-status');
  var bridePrevHusbandWrap = document.getElementById('bride-prev-husband-wrap');

  if (brideMaritalStatus) {
    brideMaritalStatus.addEventListener('change', function () {
      var val = brideMaritalStatus.value;
      var showPrev = (val === 'widow' || val === 'divorced');
      if (bridePrevHusbandWrap) bridePrevHusbandWrap.style.display = showPrev ? '' : 'none';
    });
  }

  /* ========== Event Listeners ========== */

  btnNext.addEventListener('click', function () {
    if (btnNext) btnNext.blur();
    if (currentStep < totalSteps) {
      showStep(currentStep + 1);
    }
  });

  if (btnPrev) {
    btnPrev.addEventListener('click', function () {
      if (btnPrev) btnPrev.blur();
      if (currentStep > 1) {
        showStep(currentStep - 1);
      }
    });
  }

  /* ========== Public API ========== */

  window.marriageStepper = {
    goToStep: function (step) { showStep(step); },
    getLang: function () { return currentLang; }
  };

  /* ========== Init ========== */

  buildStepper();
  setLang('bn');
  showStep(1);
  isInitialLoad = false;
})();
