/* bangla-input-auto-attach.js — Auto-attach BanglaInput to all text fields globally.
   Lives in englishtobangla app. Loaded after bangla-input.js in base.html.
   Uses MutationObserver to pick up dynamically created fields (post replies, etc.). */
(function () {
  'use strict';

  const attachedElements = new WeakSet();
  const SKIP_INPUT_TYPES = { date: 1, number: 1, email: 1, url: 1, password: 1, hidden: 1, file: 1 };

  function attachBanglaInputToAllFields() {
    if (typeof BanglaInput === 'undefined') return;

    const fields = document.querySelectorAll('input[type="text"]:not([data-bangla-attached]):not([data-no-bangla]), textarea:not([data-bangla-attached]):not([data-no-bangla])');
    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
      const field = fields[fieldIndex];

      if (attachedElements.has(field)) continue;

      /* Skip English-only fields (name contains _en but not _bn) */
      const fieldId = (field.id || '');
      const fieldName = (field.name || '');
      if ((fieldId.indexOf('-en') > -1 || fieldName.indexOf('_en') > -1) &&
          fieldId.indexOf('-bn') === -1 && fieldName.indexOf('_bn') === -1) continue;

      /* Skip certain input types */
      if (field.type && SKIP_INPUT_TYPES[field.type]) continue;

      attachedElements.add(field);
      BanglaInput.attach(field);
    }
  }

  /* Attach immediately — this script loads after bangla-input.js */
  attachBanglaInputToAllFields();

  /* Re-attach when DOM changes (for dynamically created fields) */
  let mutationDebounceTimer = null;
  const domObserver = new MutationObserver(function (mutations) {
    /* Only react if nodes were actually added */
    let hasNewNodes = false;
    for (let mutationIndex = 0; mutationIndex < mutations.length; mutationIndex++) {
      if (mutations[mutationIndex].addedNodes.length > 0) {
        hasNewNodes = true;
        break;
      }
    }
    if (!hasNewNodes) return;

    if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
    mutationDebounceTimer = setTimeout(attachBanglaInputToAllFields, 50);
  });

  domObserver.observe(document.body, { childList: true, subtree: true });
})();
