/**
 * marriage-certificate-stepper.js
 * Multi-step stepper for the marriage certificate notary.
 * Also handles Bengali/English language toggle for labels.
 */
(function () {
  'use strict';

  const BENGALI_DIGITS = ['\u09E6', '\u09E7', '\u09E8', '\u09E9', '\u09EA', '\u09EB', '\u09EC', '\u09ED', '\u09EE', '\u09EF'];

  const stepPanels = document.querySelectorAll('.step-panel[data-step]');
  const buttonPrev = document.getElementById('button-step-previous');
  const buttonNext = document.getElementById('button-step-next');
  const stepCounter = document.getElementById('step-counter');
  const stepperContainer = document.getElementById('stepper');

  if (!stepPanels.length || !buttonNext) return;

  const totalSteps = stepPanels.length;
  let currentStep = 1;
  let stepDots = [];
  let isInitialLoad = true;

  /* ========== Language Toggle ========== */

  /* Use header toggle (form_lang) instead of cert-specific toggle */
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
      bnEls.forEach(function (element) { element.hidden = true; });
      enEls.forEach(function (element) { element.hidden = false; });
    } else {
      bnEls.forEach(function (element) { element.hidden = false; });
      enEls.forEach(function (element) { element.hidden = true; });
    }

    /* Swap placeholders */
    const key = 'placeholder' + (lang === 'en' ? 'En' : 'Bn');
    document.querySelectorAll('[data-placeholder-bn]').forEach(function (element) {
      const newPh = element.dataset[key];
      if (newPh) element.placeholder = newPh;
    });
  }

  langRadios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      setLang(this.value);
    });
  });

  /* Apply initial language */
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

    stepPanels.forEach(function (panel) {
      const panelStep = parseInt(panel.getAttribute('data-step'), 10);
      if (panelStep === currentStep) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    stepDots.forEach(function (dot) {
      const dotStep = parseInt(dot.getAttribute('data-step'), 10);
      dot.classList.remove('active', 'completed');
      if (dotStep === currentStep) {
        dot.classList.add('active');
      } else if (dotStep < currentStep) {
        dot.classList.add('completed');
      }
    });

    const stepLines = document.querySelectorAll('.step-line');
    stepLines.forEach(function (line, index) {
      if (index < currentStep - 1) {
        line.classList.add('completed');
      } else {
        line.classList.remove('completed');
      }
    });

    if (buttonPrev) {
      buttonPrev.hidden = (currentStep === 1);
    }

    if (buttonNext) {
      buttonNext.hidden = (currentStep === totalSteps);
    }

    if (stepCounter) {
      stepCounter.textContent = '\u09A7\u09BE\u09AA ' + toBengaliNumber(currentStep) + ' / ' + toBengaliNumber(totalSteps);
    }

    if (!isInitialLoad) {
      requestAnimationFrame(function () {
        if (!stepperContainer) return;
        const headerEl = document.querySelector('.header');
        stepperContainer.style.scrollMarginTop = (headerEl ? headerEl.offsetHeight : 0) + 'px';
        stepperContainer.scrollIntoView({ block: 'start' });
      });
    }

    document.dispatchEvent(new CustomEvent('certificate:stepChanged', { detail: { step: currentStep } }));
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
        /* Store data URL on the drop element for preview JS to read */
        drop.dataset.sigUrl = reader.result;
        /* Show inline preview */
        const existing = drop.querySelector('.cert-sig-preview');
        if (existing) existing.remove();
        const img = document.createElement('img');
        img.className = 'cert-sig-preview';
        img.src = reader.result;
        drop.appendChild(img);
        /* Hide placeholder text */
        const icon = drop.querySelector('.sig-icon');
        const texts = drop.querySelectorAll('.sig-text');
        if (icon) icon.hidden = true;
        texts.forEach(function (t) { t.hidden = true; });
      };
      reader.readAsDataURL(file);
    });
  }

  setupSigUpload('cert-attested-sig', 'sig-attested-drop');
  setupSigUpload('cert-registrar-sig', 'sig-registrar-drop');

  /* ========== Event Listeners ========== */

  buttonNext.addEventListener('click', function () {
    if (buttonNext) buttonNext.blur();
    if (currentStep < totalSteps) {
      showStep(currentStep + 1);
    }
  });

  if (buttonPrev) {
    buttonPrev.addEventListener('click', function () {
      if (buttonPrev) buttonPrev.blur();
      if (currentStep > 1) {
        showStep(currentStep - 1);
      }
    });
  }

  /* ========== Public API ========== */

  window.certStepper = {
    goToStep: function (step) { showStep(step); },
    getLang: function () { return currentLang; }
  };

  /* ========== Init ========== */

  buildStepper();
  setLang('bn');
  showStep(1);
  isInitialLoad = false;
})();
