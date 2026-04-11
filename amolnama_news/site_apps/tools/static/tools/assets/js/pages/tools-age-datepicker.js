/* ============================================================
   Custom Date Picker for Age Calculator
   DD/MM/YYYY format, smooth month navigation
   ============================================================ */
(function() {
  "use strict";

  const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const MONTHS_BN = ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];
  const WEEKDAYS = ["রবি","সোম","মঙ্গল","বুধ","বৃহঃ","শুক্র","শনি"];
  const today = new Date();

  document.querySelectorAll(".age-date-toggle").forEach(function(button) {
    const targetId = button.getAttribute("data-target");
    const input = document.getElementById(targetId);
    const calEl = document.getElementById(targetId + "-calendar");
    if (!input || !calEl) return;

    const state = { year: today.getFullYear(), month: today.getMonth(), view: "days", selected: null };

    button.addEventListener("click", function(e) {
      e.stopPropagation();
      // Close other calendars
      document.querySelectorAll(".age-calendar.is-open").forEach(function(c) {
        if (c !== calEl) c.classList.remove("is-open");
      });
      calEl.classList.toggle("is-open");
      if (calEl.classList.contains("is-open")) render();
    });

    // Auto-format DD/MM/YYYY as user types
    input.addEventListener("input", function() {
      let v = input.value.replace(/[^\d]/g, "");
      if (v.length > 8) v = v.slice(0, 8);
      let parts = [];
      if (v.length > 0) parts.push(v.slice(0, Math.min(2, v.length)));
      if (v.length > 2) parts.push(v.slice(2, Math.min(4, v.length)));
      if (v.length > 4) parts.push(v.slice(4, 8));
      input.value = parts.join("/");

      // Parse and update calendar if complete
      if (v.length === 8) {
        let d = parseInt(v.slice(0, 2)), m = parseInt(v.slice(2, 4)) - 1, y = parseInt(v.slice(4, 8));
        if (m >= 0 && m <= 11 && d >= 1 && d <= 31 && y >= 1900) {
          state.year = y;
          state.month = m;
          state.selected = new Date(y, m, d);
          if (calEl.classList.contains("is-open")) render();
        }
      }
    });

    // Close calendar on outside click
    document.addEventListener("click", function(e) {
      if (!calEl.contains(e.target) && e.target !== button && e.target !== input) {
        calEl.classList.remove("is-open");
      }
    });

    function selectDate(date) {
      state.selected = date;
      const dd = String(date.getDate()).padStart(2, "0");
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const yyyy = date.getFullYear();
      input.value = dd + "/" + mm + "/" + yyyy;
      input.dispatchEvent(new Event("change"));
      calEl.classList.remove("is-open");
    }

    function render() {
      if (state.view === "days") renderDays();
      else if (state.view === "months") renderMonths();
      else if (state.view === "years") renderYears();
    }

    function renderDays() {
      const y = state.year, m = state.month;
      const firstDay = new Date(y, m, 1).getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const daysInPrev = new Date(y, m, 0).getDate();

      let html = '<div class="age-cal-header">';
      html += '<button type="button" data-action="previous-month">◂</button>';
      html += '<span class="age-cal-title" data-action="show-months">' + MONTHS_BN[m] + ' ' + y + '</span>';
      html += '<button type="button" data-action="next-month">▸</button>';
      html += '</div>';

      html += '<div class="age-cal-weekdays">';
      WEEKDAYS.forEach(function(d) { html += '<span>' + d + '</span>'; });
      html += '</div>';

      html += '<div class="age-cal-days">';

      // Previous month days
      for (let p = firstDay - 1; p >= 0; p--) {
        const pDay = daysInPrev - p;
        html += '<button type="button" class="age-cal-day is-other-month" data-date="' + (y) + '-' + (m) + '-' + pDay + '">' + pDay + '</button>';
      }

      // Current month days
      for (let d = 1; d <= daysInMonth; d++) {
        const thisDate = new Date(y, m, d);
        let cls = "age-cal-day";
        if (thisDate.toDateString() === today.toDateString()) cls += " is-today";
        if (state.selected && thisDate.toDateString() === state.selected.toDateString()) cls += " is-selected";
        if (thisDate > today) cls += " is-future";
        html += '<button type="button" class="' + cls + '" data-date="' + y + '-' + (m + 1) + '-' + d + '">' + d + '</button>';
      }

      // Next month days to fill grid
      const totalCells = firstDay + daysInMonth;
      const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
      for (let n = 1; n <= remaining; n++) {
        html += '<button type="button" class="age-cal-day is-other-month" data-date="' + y + '-' + (m + 2) + '-' + n + '">' + n + '</button>';
      }

      html += '</div>';
      calEl.innerHTML = html;
      bindActions();
    }

    function renderMonths() {
      let html = '<div class="age-cal-header">';
      html += '<button type="button" data-action="previous-year">◂</button>';
      html += '<span class="age-cal-title" data-action="show-years">' + state.year + '</span>';
      html += '<button type="button" data-action="next-year">▸</button>';
      html += '</div>';

      html += '<div class="age-cal-grid">';
      for (let i = 0; i < 12; i++) {
        let cls = i === state.month ? ' class="is-selected"' : '';
        html += '<button type="button"' + cls + ' data-action="pick-month" data-month="' + i + '">' + MONTHS_BN[i].slice(0, 4) + '</button>';
      }
      html += '</div>';
      calEl.innerHTML = html;
      bindActions();
    }

    function renderYears() {
      const startYear = Math.floor(state.year / 20) * 20;
      let html = '<div class="age-cal-header">';
      html += '<button type="button" data-action="previous-decade">◂</button>';
      html += '<span class="age-cal-title">' + startYear + ' – ' + (startYear + 19) + '</span>';
      html += '<button type="button" data-action="next-decade">▸</button>';
      html += '</div>';

      html += '<div class="age-cal-grid">';
      for (let i = 0; i < 20; i++) {
        const yr = startYear + i;
        const cls = yr === state.year ? ' class="is-selected"' : '';
        if (yr > today.getFullYear()) {
          html += '<button type="button" disabled>' + yr + '</button>';
        } else {
          html += '<button type="button"' + cls + ' data-action="pick-year" data-year="' + yr + '">' + yr + '</button>';
        }
      }
      html += '</div>';
      calEl.innerHTML = html;
      bindActions();
    }

    function bindActions() {
      calEl.querySelectorAll("[data-action]").forEach(function(element) {
        element.addEventListener("click", function(e) {
          e.stopPropagation();
          const action = element.getAttribute("data-action");
          if (action === "previous-month") { state.month--; if (state.month < 0) { state.month = 11; state.year--; } render(); }
          else if (action === "next-month") { state.month++; if (state.month > 11) { state.month = 0; state.year++; } render(); }
          else if (action === "previous-year") { state.year--; render(); }
          else if (action === "next-year") { state.year++; render(); }
          else if (action === "previous-decade") { state.year -= 20; render(); }
          else if (action === "next-decade") { state.year += 20; render(); }
          else if (action === "show-months") { state.view = "months"; render(); }
          else if (action === "show-years") { state.view = "years"; render(); }
          else if (action === "pick-month") { state.month = parseInt(element.getAttribute("data-month")); state.view = "days"; render(); }
          else if (action === "pick-year") { state.year = parseInt(element.getAttribute("data-year")); state.view = "months"; render(); }
        });
      });

      calEl.querySelectorAll(".age-cal-day:not(.is-future):not(.is-other-month)").forEach(function(element) {
        element.addEventListener("click", function(e) {
          e.stopPropagation();
          const parts = element.getAttribute("data-date").split("-");
          selectDate(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
        });
      });
    }
  });
})();
