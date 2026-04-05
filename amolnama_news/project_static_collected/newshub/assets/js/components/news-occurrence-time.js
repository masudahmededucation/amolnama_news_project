/**
 * news-occurrence-time.js
 * Combines custom date + hour + minute + period selects into
 * the hidden occurrence_at field (YYYY-MM-DDTHH:MM format).
 * Also restores custom selects from the hidden value on load.
 */
(function () {
  const hidden = document.getElementById('news-occurrence-at');
  const dateInput = document.getElementById('occ-date');
  const hourSelect = document.getElementById('occ-hour');
  const minuteSelect = document.getElementById('occ-minute');
  const periodSelect = document.getElementById('occ-period');

  if (!hidden || !dateInput || !hourSelect || !minuteSelect || !periodSelect) return;

  /* Block future dates */
  const today = new Date().toISOString().split('T')[0];
  dateInput.setAttribute('max', today);

  /* --- Combine parts into hidden value --- */
  function combine() {
    const d = dateInput.value;
    const h = hourSelect.value;
    const m = minuteSelect.value;

    if (!d || !h || m === '') {
      hidden.value = '';
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    /* Convert 12-hour to 24-hour */
    let hour24 = parseInt(h, 10);
    let period = periodSelect.value;
    if (period === 'AM' && hour24 === 12) hour24 = 0;
    else if (period === 'PM' && hour24 !== 12) hour24 += 12;

    const hh = hour24 < 10 ? '0' + hour24 : '' + hour24;
    const mm = parseInt(m, 10) < 10 ? '0' + parseInt(m, 10) : '' + parseInt(m, 10);

    const combined = d + 'T' + hh + ':' + mm;

    /* Block future time when date is today */
    if (d === today && new Date(combined) > new Date()) {
      hidden.value = '';
      showTimeWarning('ভবিষ্যতের সময় নির্বাচন করা যাবে না (Cannot select a future time)');
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    hideTimeWarning();
    hidden.value = combined;
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* --- Future-time warning --- */
  const occField = document.getElementById('field-occurrence');
  const timeWarnEl = document.createElement('div');
  timeWarnEl.className = 'field-warning';
  timeWarnEl.style.display = 'none';
  if (occField) occField.appendChild(timeWarnEl);

  function showTimeWarning(msg) {
    timeWarnEl.textContent = msg;
    timeWarnEl.style.display = 'block';
  }

  function hideTimeWarning() {
    timeWarnEl.style.display = 'none';
  }

  dateInput.addEventListener('change', combine);
  hourSelect.addEventListener('change', combine);
  minuteSelect.addEventListener('change', combine);
  periodSelect.addEventListener('change', combine);

  /* --- Restore from hidden value (POST re-render or localStorage restore) --- */
  function restore() {
    const val = hidden.value;
    if (!val || val.indexOf('T') === -1) return;

    const parts = val.split('T');
    const datePart = parts[0];
    const timePart = parts[1];
    const timeBits = timePart.split(':');
    const hour24 = parseInt(timeBits[0], 10);
    const minute = parseInt(timeBits[1], 10);

    dateInput.value = datePart;

    /* Convert 24-hour to 12-hour */
    let period = 'AM';
    let hour12 = hour24;
    if (hour24 === 0) { hour12 = 12; period = 'AM'; }
    else if (hour24 < 12) { period = 'AM'; }
    else if (hour24 === 12) { hour12 = 12; period = 'PM'; }
    else { hour12 = hour24 - 12; period = 'PM'; }

    hourSelect.value = '' + hour12;

    /* Snap to nearest 5-minute option */
    let snapped = Math.round(minute / 5) * 5;
    if (snapped === 60) snapped = 55;
    minuteSelect.value = '' + snapped;

    periodSelect.value = period;
  }

  restore();

  /* Listen for external changes to hidden (e.g., form-persist restore) */
  const observer = new MutationObserver(function (mutations) {
    for (let i = 0; i < mutations.length; i++) {
      if (mutations[i].attributeName === 'value') {
        restore();
        break;
      }
    }
  });
  observer.observe(hidden, { attributes: true, attributeFilter: ['value'] });
})();
