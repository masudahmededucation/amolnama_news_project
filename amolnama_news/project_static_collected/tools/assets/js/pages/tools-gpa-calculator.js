/**
 * tools-gpa-calculator.js — SSC/HSC GPA, University CGPA, Target CGPA Planner.
 * Reactive: recalculates on every input change with 100ms debounce.
 * Persists state to localStorage.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "gpa_calculator_state";
  var debounceTimer = null;

  /* ═══════════════════════════════════════════
     TAB SWITCHING
     ═══════════════════════════════════════════ */
  var tabs = document.querySelectorAll(".gpa-tab");
  var panels = {
    ssc: document.getElementById("panel-ssc"),
    uni: document.getElementById("panel-uni"),
    target: document.getElementById("panel-target"),
  };

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("gpa-tab--active"); });
      tab.classList.add("gpa-tab--active");

      var id = tab.dataset.tab;
      Object.keys(panels).forEach(function (key) {
        panels[key].style.display = key === id ? "" : "none";
      });
    });
  });

  /* ═══════════════════════════════════════════
     SSC/HSC GPA ENGINE (5.00 Scale)
     ═══════════════════════════════════════════ */
  var sscSubjectsContainer = document.getElementById("gpaSscSubjects");
  var sscAddBtn = document.getElementById("gpaSscAddSubject");
  var sscOptional = document.getElementById("gpaSscOptional");
  var sscResultCard = document.getElementById("gpaSscResult");
  var sscResultValue = document.getElementById("gpaSscValue");
  var sscResultBadge = document.getElementById("gpaSscBadge");
  var sscResultDetail = document.getElementById("gpaSscDetail");
  var sscSubjectCount = 6;

  var GP_OPTIONS =
    '<option value="">গ্রেড</option>' +
    '<option value="5.00">A+ (5.00)</option>' +
    '<option value="4.00">A (4.00)</option>' +
    '<option value="3.50">A- (3.50)</option>' +
    '<option value="3.00">B (3.00)</option>' +
    '<option value="2.00">C (2.00)</option>' +
    '<option value="1.00">D (1.00)</option>' +
    '<option value="0">F (0.00)</option>';

  /* Add subject row */
  if (sscAddBtn) {
    sscAddBtn.addEventListener("click", function () {
      sscSubjectCount++;
      var row = document.createElement("div");
      row.className = "gpa-ssc-row";
      row.innerHTML =
        '<label class="gpa-ssc-label">বিষয় ' + sscSubjectCount + " (Subject " + sscSubjectCount + ")</label>" +
        '<select class="gpa-ssc-select" name="ssc-gp-' + sscSubjectCount + '" data-mandatory="true">' + GP_OPTIONS + "</select>";
      sscSubjectsContainer.appendChild(row);
      row.querySelector("select").addEventListener("change", debounceSscCalc);
      row.querySelector("select").focus();
    });
  }

  /* Listen to all SSC selects */
  function bindSscListeners() {
    sscSubjectsContainer.querySelectorAll("select").forEach(function (sel) {
      sel.addEventListener("change", debounceSscCalc);
    });
    if (sscOptional) sscOptional.addEventListener("change", debounceSscCalc);
  }

  function debounceSscCalc() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(calculateSSC, 100);
  }

  function calculateSSC() {
    var selects = sscSubjectsContainer.querySelectorAll("select[data-mandatory]");
    var mandatoryGPs = [];
    var allFilled = true;
    var hasFail = false;

    selects.forEach(function (sel) {
      var row = sel.closest(".gpa-ssc-row");
      if (sel.value === "") {
        allFilled = false;
        if (row) row.classList.remove("gpa-ssc-row--fail");
        return;
      }
      var gp = parseFloat(sel.value);
      mandatoryGPs.push(gp);
      if (gp < 1.0) {
        hasFail = true;
        if (row) row.classList.add("gpa-ssc-row--fail");
      } else {
        if (row) row.classList.remove("gpa-ssc-row--fail");
      }
    });

    if (mandatoryGPs.length === 0) {
      sscResultCard.style.display = "none";
      saveState();
      return;
    }

    /* Fail check */
    if (hasFail) {
      showSscResult(0.00, "Fail (F Grade)", "fail", false,
        "বাধ্যতামূলক বিষয়ে ফেল থাকায় জিপিএ ০.০০ (Failed in mandatory subject)");
      saveState();
      return;
    }

    /* Optional subject bonus */
    var optGP = sscOptional && sscOptional.value !== "" ? parseFloat(sscOptional.value) : 0;
    var bonus = Math.max(0, optGP - 2);

    /* Sum mandatory */
    var totalPoints = 0;
    mandatoryGPs.forEach(function (gp) { totalPoints += gp; });

    /* GPA */
    var gpa = (totalPoints + bonus) / mandatoryGPs.length;
    if (gpa > 5.00) gpa = 5.00;

    /* Golden A+ check */
    var isGolden = mandatoryGPs.every(function (gp) { return gp === 5.00; }) && optGP === 5.00;

    var status, badgeClass;
    if (isGolden) {
      status = "Golden A+";
      badgeClass = "golden";
    } else if (gpa >= 5.00) {
      status = "A+";
      badgeClass = "success";
    } else if (gpa >= 4.00) {
      status = "A";
      badgeClass = "success";
    } else if (gpa >= 3.50) {
      status = "A-";
      badgeClass = "success";
    } else if (gpa >= 3.00) {
      status = "B";
      badgeClass = "warning";
    } else {
      status = "C/D";
      badgeClass = "warning";
    }

    var detail = "বাধ্যতামূলক বিষয়: " + mandatoryGPs.length + " | মোট পয়েন্ট: " + totalPoints.toFixed(2);
    if (bonus > 0) detail += " | ৪র্থ বিষয় বোনাস: +" + bonus.toFixed(2);

    showSscResult(gpa, status, badgeClass, isGolden, detail);
    saveState();
  }

  function showSscResult(gpa, status, badgeClass, isGolden, detail) {
    sscResultCard.style.display = "";
    sscResultValue.textContent = gpa.toFixed(2);
    sscResultValue.className = "gpa-result-value" + (gpa === 0 ? " gpa-result-value--fail" : "") + (isGolden ? " gpa-result-value--golden" : "");
    sscResultBadge.textContent = status;
    sscResultBadge.className = "gpa-result-badge gpa-result-badge--" + badgeClass;
    sscResultDetail.textContent = detail;
  }

  /* ═══════════════════════════════════════════
     UNIVERSITY CGPA ENGINE (4.00 Scale)
     ═══════════════════════════════════════════ */
  var uniCoursesContainer = document.getElementById("gpaUniCourses");
  var uniAddBtn = document.getElementById("gpaUniAddCourse");
  var uniResultCard = document.getElementById("gpaUniResult");
  var uniResultValue = document.getElementById("gpaUniValue");
  var uniResultBadge = document.getElementById("gpaUniBadge");
  var uniResultDetail = document.getElementById("gpaUniDetail");

  var UNI_GP_OPTIONS =
    '<option value="">গ্রেড</option>' +
    '<option value="4.00">A+ (4.00)</option>' +
    '<option value="3.75">A (3.75)</option>' +
    '<option value="3.50">A- (3.50)</option>' +
    '<option value="3.25">B+ (3.25)</option>' +
    '<option value="3.00">B (3.00)</option>' +
    '<option value="2.75">B- (2.75)</option>' +
    '<option value="2.50">C+ (2.50)</option>' +
    '<option value="2.25">C (2.25)</option>' +
    '<option value="2.00">D (2.00)</option>' +
    '<option value="0">F (0.00)</option>';

  function addUniCourseRow(courseNum, credit, gp) {
    var row = document.createElement("div");
    row.className = "gpa-uni-row";
    row.innerHTML =
      '<input type="text" name="uni-course-name" placeholder="কোর্স ' + courseNum + '" autocomplete="off" value="">' +
      '<input type="number" name="uni-credit" min="0.5" max="12" step="0.5" value="' + (credit || 4) + '" autocomplete="off">' +
      '<select name="uni-gp">' + UNI_GP_OPTIONS + "</select>" +
      '<button type="button" class="gpa-uni-remove" title="মুছুন">&times;</button>';

    if (gp !== undefined && gp !== "") {
      row.querySelector("select").value = gp;
    }

    uniCoursesContainer.appendChild(row);

    row.querySelector("select").addEventListener("change", debounceUniCalc);
    row.querySelector('input[name="uni-credit"]').addEventListener("input", debounceUniCalc);
    row.querySelector(".gpa-uni-remove").addEventListener("click", function () {
      row.remove();
      debounceUniCalc();
    });
  }

  /* Seed 6 course rows */
  function seedUniRows() {
    for (var i = 1; i <= 6; i++) addUniCourseRow(i);
  }

  if (uniAddBtn) {
    uniAddBtn.addEventListener("click", function () {
      var count = uniCoursesContainer.querySelectorAll(".gpa-uni-row").length + 1;
      addUniCourseRow(count);
      var rows = uniCoursesContainer.querySelectorAll(".gpa-uni-row");
      var lastSelect = rows[rows.length - 1].querySelector("select");
      if (lastSelect) lastSelect.focus();
    });
  }

  function debounceUniCalc() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(calculateUni, 100);
  }

  function calculateUni() {
    var rows = uniCoursesContainer.querySelectorAll(".gpa-uni-row");
    var totalQP = 0;
    var totalCredits = 0;
    var hasFail = false;
    var filledCount = 0;

    rows.forEach(function (row) {
      var gpSel = row.querySelector('select[name="uni-gp"]');
      var crInput = row.querySelector('input[name="uni-credit"]');
      if (!gpSel || gpSel.value === "") return;

      var gp = parseFloat(gpSel.value);
      var cr = parseFloat(crInput.value) || 0;
      if (cr <= 0) return;

      filledCount++;
      if (gp === 0) hasFail = true;
      totalQP += gp * cr;
      totalCredits += cr;
    });

    if (filledCount === 0 || totalCredits === 0) {
      uniResultCard.style.display = "none";
      saveState();
      return;
    }

    var cgpa = totalQP / totalCredits;

    var academicClass, badgeClass;
    if (hasFail) {
      academicClass = "ফেল গ্রেড আছে (F Grade Included)";
      badgeClass = "fail";
    } else if (cgpa >= 3.00) {
      academicClass = "প্রথম শ্রেণী (First Class)";
      badgeClass = "success";
    } else if (cgpa >= 2.25) {
      academicClass = "দ্বিতীয় শ্রেণী (Second Class)";
      badgeClass = "warning";
    } else {
      academicClass = "তৃতীয় শ্রেণী (Third Class)";
      badgeClass = "warning";
    }

    uniResultCard.style.display = "";
    uniResultValue.textContent = cgpa.toFixed(2);
    uniResultValue.className = "gpa-result-value" + (hasFail ? " gpa-result-value--fail" : "");
    uniResultBadge.textContent = academicClass;
    uniResultBadge.className = "gpa-result-badge gpa-result-badge--" + badgeClass;
    uniResultDetail.textContent =
      "মোট ক্রেডিট: " + totalCredits.toFixed(1) +
      " | মোট পয়েন্ট: " + totalQP.toFixed(2) +
      " | কোর্স: " + filledCount;
    saveState();
  }

  /* ═══════════════════════════════════════════
     TARGET CGPA PLANNER
     ═══════════════════════════════════════════ */
  var targetFields = ["gpa-target-current", "gpa-target-credits-done", "gpa-target-credits-next", "gpa-target-goal"];
  var targetResultCard = document.getElementById("gpaTargetResult");
  var targetValue = document.getElementById("gpaTargetValue");
  var targetBadge = document.getElementById("gpaTargetBadge");
  var targetMessage = document.getElementById("gpaTargetMessage");

  targetFields.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", debounceTargetCalc);
  });

  function debounceTargetCalc() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(calculateTarget, 100);
  }

  function calculateTarget() {
    var currentCGPA = parseFloat(document.getElementById("gpa-target-current").value);
    var creditsDone = parseFloat(document.getElementById("gpa-target-credits-done").value);
    var creditsNext = parseFloat(document.getElementById("gpa-target-credits-next").value);
    var targetCGPA = parseFloat(document.getElementById("gpa-target-goal").value);

    if (isNaN(currentCGPA) || isNaN(creditsDone) || isNaN(creditsNext) || isNaN(targetCGPA) || creditsNext <= 0) {
      targetResultCard.style.display = "none";
      saveState();
      return;
    }

    var currentPoints = currentCGPA * creditsDone;
    var finalCredits = creditsDone + creditsNext;
    var neededTotal = targetCGPA * finalCredits;
    var neededNext = neededTotal - currentPoints;
    var requiredGPA = neededNext / creditsNext;

    targetResultCard.style.display = "";
    targetValue.textContent = requiredGPA.toFixed(2);

    var badgeText, badgeClass, message, progressClass;
    var progressPct = Math.min(100, (requiredGPA / 4.00) * 100);

    if (requiredGPA > 4.00) {
      badgeText = "অসম্ভব (Impossible)";
      badgeClass = "impossible";
      progressClass = "impossible";
      var suggestedTarget = ((currentPoints + 4.00 * creditsNext) / finalCredits).toFixed(2);
      message = "এক সেমিস্টারে " + targetCGPA.toFixed(2) + " অর্জন সম্ভব নয় (GPA > 4.00 প্রয়োজন)। " +
        "বাস্তবসম্মত টার্গেট: " + suggestedTarget;
      targetValue.className = "gpa-result-value gpa-result-value--fail";
    } else if (requiredGPA < 0) {
      badgeText = "ইতিমধ্যে অর্জিত!";
      badgeClass = "easy";
      progressClass = "easy";
      message = "আপনি ইতিমধ্যে এই টার্গেটের উপরে আছেন! (You've already surpassed this target!)";
      targetValue.className = "gpa-result-value";
    } else if (requiredGPA <= 2.50) {
      badgeText = "সহজ (Achievable)";
      badgeClass = "easy";
      progressClass = "easy";
      message = "আপনি সঠিক পথে আছেন! " + targetCGPA.toFixed(2) + " অর্জনে মাত্র " + requiredGPA.toFixed(2) + " প্রয়োজন। (You're on track!)";
      targetValue.className = "gpa-result-value";
    } else if (requiredGPA <= 3.50) {
      badgeText = "সম্ভব (Moderate)";
      badgeClass = "challenging";
      progressClass = "moderate";
      message = targetCGPA.toFixed(2) + " অর্জনে পরবর্তী সেমিস্টারে " + requiredGPA.toFixed(2) + " জিপিএ প্রয়োজন। ফোকাস রাখুন! (Focus needed)";
      targetValue.className = "gpa-result-value";
    } else {
      badgeText = "চ্যালেঞ্জিং (Challenging)";
      badgeClass = "challenging";
      progressClass = "hard";
      message = requiredGPA.toFixed(2) + " জিপিএ দরকার — কঠিন কিন্তু গাণিতিকভাবে সম্ভব। সর্বোচ্চ চেষ্টা করুন! (Difficult but possible)";
      targetValue.className = "gpa-result-value";
    }

    targetBadge.textContent = badgeText;
    targetBadge.className = "gpa-result-badge gpa-result-badge--" + badgeClass;

    /* Progress bar */
    var existingBar = targetResultCard.querySelector(".gpa-progress-bar");
    if (!existingBar) {
      var barHtml = '<div class="gpa-progress-bar"><div class="gpa-progress-fill"></div></div>';
      targetMessage.insertAdjacentHTML("beforebegin", barHtml);
      existingBar = targetResultCard.querySelector(".gpa-progress-bar");
    }
    var fill = existingBar.querySelector(".gpa-progress-fill");
    fill.style.width = Math.max(0, Math.min(100, progressPct)) + "%";
    fill.className = "gpa-progress-fill gpa-progress-fill--" + progressClass;

    targetMessage.textContent = message;
    saveState();
  }

  /* ═══════════════════════════════════════════
     LOCALSTORAGE PERSISTENCE
     ═══════════════════════════════════════════ */
  function saveState() {
    try {
      var state = { ssc: {}, uni: [], target: {} };

      /* SSC */
      sscSubjectsContainer.querySelectorAll("select").forEach(function (sel, i) {
        state.ssc["gp" + i] = sel.value;
      });
      state.ssc.optional = sscOptional ? sscOptional.value : "";

      /* University */
      uniCoursesContainer.querySelectorAll(".gpa-uni-row").forEach(function (row) {
        state.uni.push({
          name: row.querySelector('input[name="uni-course-name"]').value,
          cr: row.querySelector('input[name="uni-credit"]').value,
          gp: row.querySelector('select[name="uni-gp"]').value,
        });
      });

      /* Target */
      targetFields.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) state.target[id] = el.value;
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function restoreState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var state = JSON.parse(raw);

      /* SSC */
      if (state.ssc) {
        var sscSelects = sscSubjectsContainer.querySelectorAll("select");
        sscSelects.forEach(function (sel, i) {
          if (state.ssc["gp" + i] !== undefined) sel.value = state.ssc["gp" + i];
        });
        if (sscOptional && state.ssc.optional) sscOptional.value = state.ssc.optional;
      }

      /* University — clear seeded rows and restore */
      if (state.uni && state.uni.length > 0) {
        uniCoursesContainer.querySelectorAll(".gpa-uni-row").forEach(function (r) { r.remove(); });
        state.uni.forEach(function (c, i) {
          addUniCourseRow(i + 1, c.cr, c.gp);
          var rows = uniCoursesContainer.querySelectorAll(".gpa-uni-row");
          var last = rows[rows.length - 1];
          if (last && c.name) last.querySelector('input[name="uni-course-name"]').value = c.name;
        });
        return true;
      }

      /* Target */
      if (state.target) {
        targetFields.forEach(function (id) {
          var el = document.getElementById(id);
          if (el && state.target[id]) el.value = state.target[id];
        });
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  /* ═══════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════ */
  var restored = restoreState();
  if (!restored) seedUniRows();

  bindSscListeners();

  /* Run initial calculations if data exists */
  calculateSSC();
  calculateUni();
  calculateTarget();
})();
