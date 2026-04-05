/**
 * marriage-form-stepper.js
 * Multi-step stepper for the Nikah Nama (marriage form).
 * Handles Bengali/English language toggle, signature uploads,
 * and conditional field show/hide (Q21→Q22, Q6 bride status).
 */
(function () {
  'use strict';

  const BENGALI_DIGITS = ['\u09E6', '\u09E7', '\u09E8', '\u09E9', '\u09EA', '\u09EB', '\u09EC', '\u09ED', '\u09EE', '\u09EF'];

  const stepPanels = document.querySelectorAll('.step-panel[data-step]');
  const btnPrev = document.getElementById('btn-step-prev');
  const btnNext = document.getElementById('btn-step-next');
  const stepCounter = document.getElementById('step-counter');
  const stepperContainer = document.getElementById('stepper');

  if (!stepPanels.length || !btnNext) return;

  const totalSteps = stepPanels.length;
  let currentStep = 1;
  let stepDots = [];
  let isInitialLoad = true;

  /* ========== Language Toggle ========== */

  /* Use header toggle (form_lang) instead of marriage-specific toggle */
  const langRadios = document.querySelectorAll('input[name="form_lang"]');
  let currentLang = 'bn';
  for (let lr = 0; lr < langRadios.length; lr++) {
    if (langRadios[lr].checked) { currentLang = langRadios[lr].value; break; }
  }

  function setLang(lang) {
    currentLang = lang;
    const bnEls = document.querySelectorAll('.lbl-bn');
    const enEls = document.querySelectorAll('.lbl-en');
    if (lang === 'en') {
      bnEls.forEach(function (el) { el.classList.add('display-hidden'); });
      enEls.forEach(function (el) { el.classList.remove('display-hidden'); });
    } else {
      bnEls.forEach(function (el) { el.classList.remove('display-hidden'); });
      enEls.forEach(function (el) { el.classList.add('display-hidden'); });
    }

    /* Swap placeholders */
    const key = 'placeholder' + (lang === 'en' ? 'En' : 'Bn');
    document.querySelectorAll('[data-placeholder-bn]').forEach(function (el) {
      const newPh = el.dataset[key];
      if (newPh) el.placeholder = newPh;
    });

    /* Swap select default option text */
    document.querySelectorAll('select[data-placeholder-bn]').forEach(function (sel) {
      const opt = sel.options[0];
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
  const langObserver = new MutationObserver(function () {
    const bodyLang = document.body.getAttribute('data-lang');
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
      const step = parseInt(panel.getAttribute('data-step'), 10);
      const labelBn = panel.getAttribute('data-step-label-bn') || '';

      if (index > 0) {
        const line = document.createElement('div');
        line.className = 'step-line';
        stepperContainer.appendChild(line);
      }

      const dot = document.createElement('div');
      dot.className = 'step-dot';
      dot.setAttribute('data-step', step);

      const numSpan = document.createElement('span');
      numSpan.className = 'step-num';
      numSpan.textContent = toBengaliNumber(step);
      dot.appendChild(numSpan);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'step-label';
      labelSpan.textContent = labelBn;
      dot.appendChild(labelSpan);

      dot.addEventListener('click', function () {
        const targetStep = parseInt(dot.getAttribute('data-step'), 10);
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
      const panelStep = parseInt(panel.getAttribute('data-step'), 10);
      if (panelStep === currentStep) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    /* Dots */
    stepDots.forEach(function (dot) {
      const dotStep = parseInt(dot.getAttribute('data-step'), 10);
      dot.classList.remove('active', 'completed');
      if (dotStep === currentStep) {
        dot.classList.add('active');
      } else if (dotStep < currentStep) {
        dot.classList.add('completed');
      }
    });

    /* Lines */
    const stepLines = document.querySelectorAll('.step-line');
    stepLines.forEach(function (line, index) {
      if (index < currentStep - 1) {
        line.classList.add('completed');
      } else {
        line.classList.remove('completed');
      }
    });

    /* Prev button */
    if (btnPrev) {
      btnPrev.classList.toggle('display-hidden', currentStep === 1);
    }

    /* Next button — hide on last step */
    if (btnNext) {
      btnNext.classList.toggle('display-hidden', currentStep === totalSteps);
    }

    /* Counter */
    if (stepCounter) {
      stepCounter.textContent = '\u09A7\u09BE\u09AA ' + toBengaliNumber(currentStep) + ' / ' + toBengaliNumber(totalSteps);
    }

    /* Scroll stepper into view (skip initial load) */
    if (!isInitialLoad) {
      requestAnimationFrame(function () {
        if (!stepperContainer) return;
        const headerEl = document.querySelector('.header');
        stepperContainer.style.scrollMarginTop = (headerEl ? headerEl.offsetHeight : 0) + 'px';
        stepperContainer.scrollIntoView({ block: 'start' });
      });
    }

    /* Dispatch event so other scripts (preview) can react */
    document.dispatchEvent(new CustomEvent('marriage:stepChanged', { detail: { step: currentStep } }));
  }

  /* ========== Signature Upload Previews ========== */

  function setupSigUpload(inputId, dropId) {
    const input = document.getElementById(inputId);
    const drop = document.getElementById(dropId);
    if (!input || !drop) return;

    input.addEventListener('change', function () {
      if (!input.files || !input.files[0]) return;
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = function () {
        drop.dataset.sigUrl = reader.result;
        const existing = drop.querySelector('.marriage-sig-preview');
        if (existing) existing.remove();
        const img = document.createElement('img');
        img.className = 'marriage-sig-preview';
        img.src = reader.result;
        drop.appendChild(img);
        const icon = drop.querySelector('.sig-icon');
        const texts = drop.querySelectorAll('.sig-text');
        if (icon) icon.classList.add('display-hidden');
        texts.forEach(function (t) { t.classList.add('display-hidden'); });
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
  const groomMaritalStatus = document.getElementById('groom-marital-status');
  const groomWivesWrap = document.getElementById('groom-wives-wrap');
  const groomArbitrationWrap = document.getElementById('groom-arbitration-wrap');

  if (groomMaritalStatus) {
    groomMaritalStatus.addEventListener('change', function () {
      let val = groomMaritalStatus.value;
      const showExtra = (val === 'married');
      if (groomWivesWrap) groomWivesWrap.classList.toggle('display-hidden', !showExtra);
      if (groomArbitrationWrap) groomArbitrationWrap.classList.toggle('display-hidden', !showExtra);
    });
  }

  /* Q6 → show previous husband if bride is widow/divorced */
  const brideMaritalStatus = document.getElementById('bride-marital-status');
  const bridePrevHusbandWrap = document.getElementById('bride-prev-husband-wrap');

  if (brideMaritalStatus) {
    brideMaritalStatus.addEventListener('change', function () {
      const val = brideMaritalStatus.value;
      const showPrev = (val === 'widow' || val === 'divorced');
      if (bridePrevHusbandWrap) bridePrevHusbandWrap.classList.toggle('display-hidden', !showPrev);
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
