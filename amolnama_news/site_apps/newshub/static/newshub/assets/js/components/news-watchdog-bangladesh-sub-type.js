/**
 * news-watchdog-bangladesh-sub-type.js
 * Binds the watchdog_bangladesh sub-type radio cards to the hidden input.
 * All 23 radio cards share the same name so only one can be selected at a time.
 * On selection: collapses all groups, shows only the selected item + a "change" button.
 * CSP-safe — no inline script needed.
 *
 * DOM dependencies:
 *   #section-watchdog-bangladesh-sub-type — outer container
 *   #watchdog-bangladesh-sub-type         — hidden input (status_id value)
 *   .radio-card-group                     — each category group
 *   input[name="watchdog_bangladesh_sub_type_radio"] — radio cards
 *
 * Custom events dispatched on `document`:
 *   watchdogBangladesh:subTypeChanged  { detail: { subTypeId: string, groupCode: string } }
 */
(function () {
  'use strict';

  const container = document.getElementById('section-watchdog-bangladesh-sub-type');
  const hidden    = document.getElementById('watchdog-bangladesh-sub-type');

  /* Guard — only active on watchdog_bangladesh form */
  if (!container || !hidden) return;

  const groups = container.querySelectorAll('.radio-card-group');
  let selectionSummary = null; /* created lazily on first selection */

  /* ---- Collapse: hide all groups, show summary bar ---- */
  function collapse(selectedRadio) {
    const label = selectedRadio.closest('label');
    let group = selectedRadio.closest('.radio-card-group');
    const groupTitle = group ? group.querySelector('.radio-card-group-title') : null;

    /* Extract display text */
    const icon  = label.querySelector('.radio-card-icon');
    const text  = label.querySelector('.radio-card-label');
    const groupLabel = groupTitle ? groupTitle.textContent : '';

    /* Hide all groups */
    groups.forEach(function (g) { g.style.display = 'none'; });

    /* Build or update the summary bar */
    if (!selectionSummary) {
      selectionSummary = document.createElement('div');
      selectionSummary.className = 'watchdog-selection-summary';

      const infoSpan = document.createElement('span');
      infoSpan.className = 'watchdog-selection-info';

      const changeBtn = document.createElement('button');
      changeBtn.type = 'button';
      changeBtn.className = 'watchdog-selection-change';
      changeBtn.textContent = '\u21BB \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u0995\u09B0\u09C1\u09A8 (Change)';
      changeBtn.addEventListener('click', expand);

      selectionSummary.appendChild(infoSpan);
      selectionSummary.appendChild(changeBtn);

      /* Insert after the h3 title */
      const sectionTitle = container.querySelector('.form-section-title');
      if (sectionTitle && sectionTitle.nextSibling) {
        container.insertBefore(selectionSummary, sectionTitle.nextSibling.nextSibling);
      } else {
        container.appendChild(selectionSummary);
      }
    }

    const infoEl = selectionSummary.querySelector('.watchdog-selection-info');
    infoEl.innerHTML = '';

    /* Group badge */
    const badge = document.createElement('span');
    badge.className = 'watchdog-selection-group';
    badge.textContent = groupLabel;
    infoEl.appendChild(badge);

    /* Selected item */
    const itemSpan = document.createElement('span');
    itemSpan.className = 'watchdog-selection-item';
    itemSpan.textContent = (icon ? icon.textContent + ' ' : '') + (text ? text.textContent : '');
    infoEl.appendChild(itemSpan);

    selectionSummary.style.display = 'flex';

    /* Copy the group's border-left color to the summary bar */
    const groupColor = window.getComputedStyle(group).borderLeftColor;
    selectionSummary.style.borderLeftColor = groupColor;

    /* Smooth scroll to page top after collapse (wait for DOM reflow) */
    requestAnimationFrame(function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---- Expand: show all groups again, hide summary ---- */
  function expand() {
    groups.forEach(function (g) { g.style.display = ''; });
    if (selectionSummary) selectionSummary.style.display = 'none';
  }

  /* ---- Handle radio change ---- */
  container.addEventListener('change', function (e) {
    if (e.target.name !== 'watchdog_bangladesh_sub_type_radio') return;

    hidden.value = e.target.value;

    const group = e.target.closest('.radio-card-group');
    const groupCode = group ? group.getAttribute('data-group') : '';

    /* Collapse after selection */
    collapse(e.target);

    document.dispatchEvent(
      new CustomEvent('watchdogBangladesh:subTypeChanged', {
        detail: { subTypeId: e.target.value, groupCode: groupCode }
      })
    );
  });

  /* Public API for form-clear.js */
  window.newshubWatchdogBangladeshSubType = {
    reset: function () {
      container.querySelectorAll('input[name="watchdog_bangladesh_sub_type_radio"]')
        .forEach(function (r) { r.checked = false; });
      hidden.value = '';
      expand();
      document.dispatchEvent(
        new CustomEvent('watchdogBangladesh:subTypeChanged', {
          detail: { subTypeId: '', groupCode: '' }
        })
      );
    }
  };
})();
