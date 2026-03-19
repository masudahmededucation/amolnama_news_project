/* ============================================================
   Custom Date Picker for Age Calculator
   DD/MM/YYYY format, smooth month navigation
   ============================================================ */
(function() {
  "use strict";

  var MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var MONTHS_BN = ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];
  var WEEKDAYS = ["রবি","সোম","মঙ্গল","বুধ","বৃহঃ","শুক্র","শনি"];
  var today = new Date();

  document.querySelectorAll(".age-date-toggle").forEach(function(btn) {
    var targetId = btn.getAttribute("data-target");
    var input = document.getElementById(targetId);
    var calEl = document.getElementById(targetId + "-calendar");
    if (!input || !calEl) return;

    var state = { year: today.getFullYear(), month: today.getMonth(), view: "days", selected: null };

    btn.addEventListener("click", function(e) {
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
      var v = input.value.replace(/[^\d]/g, "");
      if (v.length > 8) v = v.slice(0, 8);
      var parts = [];
      if (v.length > 0) parts.push(v.slice(0, Math.min(2, v.length)));
      if (v.length > 2) parts.push(v.slice(2, Math.min(4, v.length)));
      if (v.length > 4) parts.push(v.slice(4, 8));
      input.value = parts.join("/");

      // Parse and update calendar if complete
      if (v.length === 8) {
        var d = parseInt(v.slice(0, 2)), m = parseInt(v.slice(2, 4)) - 1, y = parseInt(v.slice(4, 8));
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
      if (!calEl.contains(e.target) && e.target !== btn && e.target !== input) {
        calEl.classList.remove("is-open");
      }
    });

    function selectDate(date) {
      state.selected = date;
      var dd = String(date.getDate()).padStart(2, "0");
      var mm = String(date.getMonth() + 1).padStart(2, "0");
      var yyyy = date.getFullYear();
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
      var y = state.year, m = state.month;
      var firstDay = new Date(y, m, 1).getDay();
      var daysInMonth = new Date(y, m + 1, 0).getDate();
      var daysInPrev = new Date(y, m, 0).getDate();

      var html = '<div class="age-cal-header">';
      html += '<button type="button" data-action="prev-month">◂</button>';
      html += '<span class="age-cal-title" data-action="show-months">' + MONTHS_BN[m] + ' ' + y + '</span>';
      html += '<button type="button" data-action="next-month">▸</button>';
      html += '</div>';

      html += '<div class="age-cal-weekdays">';
      WEEKDAYS.forEach(function(d) { html += '<span>' + d + '</span>'; });
      html += '</div>';

      html += '<div class="age-cal-days">';

      // Previous month days
      for (var p = firstDay - 1; p >= 0; p--) {
        var pDay = daysInPrev - p;
        html += '<button type="button" class="age-cal-day is-other-month" data-date="' + (y) + '-' + (m) + '-' + pDay + '">' + pDay + '</button>';
      }

      // Current month days
      for (var d = 1; d <= daysInMonth; d++) {
        var thisDate = new Date(y, m, d);
        var cls = "age-cal-day";
        if (thisDate.toDateString() === today.toDateString()) cls += " is-today";
        if (state.selected && thisDate.toDateString() === state.selected.toDateString()) cls += " is-selected";
        if (thisDate > today) cls += " is-future";
        html += '<button type="button" class="' + cls + '" data-date="' + y + '-' + (m + 1) + '-' + d + '">' + d + '</button>';
      }

      // Next month days to fill grid
      var totalCells = firstDay + daysInMonth;
      var remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
      for (var n = 1; n <= remaining; n++) {
        html += '<button type="button" class="age-cal-day is-other-month" data-date="' + y + '-' + (m + 2) + '-' + n + '">' + n + '</button>';
      }

      html += '</div>';
      calEl.innerHTML = html;
      bindActions();
    }

    function renderMonths() {
      var html = '<div class="age-cal-header">';
      html += '<button type="button" data-action="prev-year">◂</button>';
      html += '<span class="age-cal-title" data-action="show-years">' + state.year + '</span>';
      html += '<button type="button" data-action="next-year">▸</button>';
      html += '</div>';

      html += '<div class="age-cal-grid">';
      for (var i = 0; i < 12; i++) {
        var cls = i === state.month ? ' class="is-selected"' : '';
        html += '<button type="button"' + cls + ' data-action="pick-month" data-month="' + i + '">' + MONTHS_BN[i].slice(0, 4) + '</button>';
      }
      html += '</div>';
      calEl.innerHTML = html;
      bindActions();
    }

    function renderYears() {
      var startYear = Math.floor(state.year / 20) * 20;
      var html = '<div class="age-cal-header">';
      html += '<button type="button" data-action="prev-decade">◂</button>';
      html += '<span class="age-cal-title">' + startYear + ' – ' + (startYear + 19) + '</span>';
      html += '<button type="button" data-action="next-decade">▸</button>';
      html += '</div>';

      html += '<div class="age-cal-grid">';
      for (var i = 0; i < 20; i++) {
        var yr = startYear + i;
        var cls = yr === state.year ? ' class="is-selected"' : '';
        if (yr > today.getFullYear()) {
          html += '<button type="button" disabled style="color:#ccc;">' + yr + '</button>';
        } else {
          html += '<button type="button"' + cls + ' data-action="pick-year" data-year="' + yr + '">' + yr + '</button>';
        }
      }
      html += '</div>';
      calEl.innerHTML = html;
      bindActions();
    }

    function bindActions() {
      calEl.querySelectorAll("[data-action]").forEach(function(el) {
        el.addEventListener("click", function(e) {
          e.stopPropagation();
          var action = el.getAttribute("data-action");
          if (action === "prev-month") { state.month--; if (state.month < 0) { state.month = 11; state.year--; } render(); }
          else if (action === "next-month") { state.month++; if (state.month > 11) { state.month = 0; state.year++; } render(); }
          else if (action === "prev-year") { state.year--; render(); }
          else if (action === "next-year") { state.year++; render(); }
          else if (action === "prev-decade") { state.year -= 20; render(); }
          else if (action === "next-decade") { state.year += 20; render(); }
          else if (action === "show-months") { state.view = "months"; render(); }
          else if (action === "show-years") { state.view = "years"; render(); }
          else if (action === "pick-month") { state.month = parseInt(el.getAttribute("data-month")); state.view = "days"; render(); }
          else if (action === "pick-year") { state.year = parseInt(el.getAttribute("data-year")); state.view = "months"; render(); }
        });
      });

      calEl.querySelectorAll(".age-cal-day:not(.is-future):not(.is-other-month)").forEach(function(el) {
        el.addEventListener("click", function(e) {
          e.stopPropagation();
          var parts = el.getAttribute("data-date").split("-");
          selectDate(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
        });
      });
    }
  });
})();
