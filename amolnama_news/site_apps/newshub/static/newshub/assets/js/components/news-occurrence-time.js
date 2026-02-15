/**
 * news-occurrence-time.js
 * Combines custom date + hour + minute + period selects into
 * the hidden occurrence_at field (YYYY-MM-DDTHH:MM format).
 * Also restores custom selects from the hidden value on load.
 */
(function () {
  var hidden = document.getElementById('news-occurrence-at');
  var dateInput = document.getElementById('occ-date');
  var hourSelect = document.getElementById('occ-hour');
  var minuteSelect = document.getElementById('occ-minute');
  var periodSelect = document.getElementById('occ-period');

  if (!hidden || !dateInput || !hourSelect || !minuteSelect || !periodSelect) return;

  /* Block future dates */
  var today = new Date().toISOString().split('T')[0];
  dateInput.setAttribute('max', today);

  /* --- Combine parts into hidden value --- */
  function combine() {
    var d = dateInput.value;
    var h = hourSelect.value;
    var m = minuteSelect.value;

    if (!d || !h || m === '') {
      hidden.value = '';
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    /* Convert 12-hour to 24-hour */
    var hour24 = parseInt(h, 10);
    var period = periodSelect.value;
    if (period === 'AM' && hour24 === 12) hour24 = 0;
    else if (period === 'PM' && hour24 !== 12) hour24 += 12;

    var hh = hour24 < 10 ? '0' + hour24 : '' + hour24;
    var mm = parseInt(m, 10) < 10 ? '0' + parseInt(m, 10) : '' + parseInt(m, 10);

    var combined = d + 'T' + hh + ':' + mm;

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
  var occField = document.getElementById('field-occurrence');
  var timeWarnEl = document.createElement('div');
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
    var val = hidden.value;
    if (!val || val.indexOf('T') === -1) return;

    var parts = val.split('T');
    var datePart = parts[0];
    var timePart = parts[1];
    var timeBits = timePart.split(':');
    var hour24 = parseInt(timeBits[0], 10);
    var minute = parseInt(timeBits[1], 10);

    dateInput.value = datePart;

    /* Convert 24-hour to 12-hour */
    var period = 'AM';
    var hour12 = hour24;
    if (hour24 === 0) { hour12 = 12; period = 'AM'; }
    else if (hour24 < 12) { period = 'AM'; }
    else if (hour24 === 12) { hour12 = 12; period = 'PM'; }
    else { hour12 = hour24 - 12; period = 'PM'; }

    hourSelect.value = '' + hour12;

    /* Snap to nearest 5-minute option */
    var snapped = Math.round(minute / 5) * 5;
    if (snapped === 60) snapped = 55;
    minuteSelect.value = '' + snapped;

    periodSelect.value = period;
  }

  restore();

  /* Listen for external changes to hidden (e.g., form-persist restore) */
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].attributeName === 'value') {
        restore();
        break;
      }
    }
  });
  observer.observe(hidden, { attributes: true, attributeFilter: ['value'] });
})();
