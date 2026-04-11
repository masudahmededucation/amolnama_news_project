/**
 * tools-gpa-calculator.js — SSC/HSC GPA, University CGPA, Target CGPA Planner.
 * Reactive: recalculates on every input change with 100ms debounce.
 * Persists state to localStorage.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "gpa_calculator_state";
  let debounceTimer = null;

  /* ═══════════════════════════════════════════
     TAB SWITCHING
     ═══════════════════════════════════════════ */
  const tabs = document.querySelectorAll(".gpa-tab");
  const panels = {
    ssc: document.getElementById("panel-ssc"),
    uni: document.getElementById("panel-uni"),
    target: document.getElementById("panel-target"),
  };

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("gpa-tab--active"); });
      tab.classList.add("gpa-tab--active");

      const id = tab.dataset.tab;
      Object.keys(panels).forEach(function (key) {
        panels[key].hidden = key !== id;
      });
    });
  });

  /* ═══════════════════════════════════════════
     SSC/HSC GPA ENGINE (5.00 Scale)
     ═══════════════════════════════════════════ */
  const sscSubjectsContainer = document.getElementById("gpaSscSubjects");
  const sscAddBtn = document.getElementById("gpaSscAddSubject");
  const sscOptional = document.getElementById("gpaSscOptional");
  const sscResultCard = document.getElementById("gpaSscResult");
  const sscResultValue = document.getElementById("gpaSscValue");
  const sscResultBadge = document.getElementById("gpaSscBadge");
  const sscResultDetail = document.getElementById("gpaSscDetail");
  let sscSubjectCount = 6;

  const GP_OPTIONS =
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
      let row = document.createElement("div");
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
    const selects = sscSubjectsContainer.querySelectorAll("select[data-mandatory]");
    const mandatoryGPs = [];
    let allFilled = true;
    let hasFail = false;

    selects.forEach(function (sel) {
      let row = sel.closest(".gpa-ssc-row");
      if (sel.value === "") {
        allFilled = false;
        if (row) row.classList.remove("gpa-ssc-row--fail");
        return;
      }
      let gp = parseFloat(sel.value);
      mandatoryGPs.push(gp);
      if (gp < 1.0) {
        hasFail = true;
        if (row) row.classList.add("gpa-ssc-row--fail");
      } else {
        if (row) row.classList.remove("gpa-ssc-row--fail");
      }
    });

    if (mandatoryGPs.length === 0) {
      sscResultCard.hidden = true;
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
    const optGP = sscOptional && sscOptional.value !== "" ? parseFloat(sscOptional.value) : 0;
    const bonus = Math.max(0, optGP - 2);

    /* Sum mandatory */
    let totalPoints = 0;
    mandatoryGPs.forEach(function (gp) { totalPoints += gp; });

    /* GPA */
    let gpa = (totalPoints + bonus) / mandatoryGPs.length;
    if (gpa > 5.00) gpa = 5.00;

    /* Golden A+ check */
    const isGolden = mandatoryGPs.every(function (gp) { return gp === 5.00; }) && optGP === 5.00;

    let status, badgeClass;
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

    let detail = "বাধ্যতামূলক বিষয়: " + mandatoryGPs.length + " | মোট পয়েন্ট: " + totalPoints.toFixed(2);
    if (bonus > 0) detail += " | ৪র্থ বিষয় বোনাস: +" + bonus.toFixed(2);

    showSscResult(gpa, status, badgeClass, isGolden, detail);
    saveState();
  }

  function showSscResult(gpa, status, badgeClass, isGolden, detail) {
    sscResultCard.hidden = false;
    sscResultValue.textContent = gpa.toFixed(2);
    sscResultValue.className = "gpa-result-value" + (gpa === 0 ? " gpa-result-value--fail" : "") + (isGolden ? " gpa-result-value--golden" : "");
    sscResultBadge.textContent = status;
    sscResultBadge.className = "gpa-result-badge gpa-result-badge--" + badgeClass;
    sscResultDetail.textContent = detail;
  }

  /* ═══════════════════════════════════════════
     UNIVERSITY CGPA ENGINE (4.00 Scale)
     ═══════════════════════════════════════════ */
  const uniCoursesContainer = document.getElementById("gpaUniCourses");
  const uniAddBtn = document.getElementById("gpaUniAddCourse");
  const uniResultCard = document.getElementById("gpaUniResult");
  const uniResultValue = document.getElementById("gpaUniValue");
  const uniResultBadge = document.getElementById("gpaUniBadge");
  const uniResultDetail = document.getElementById("gpaUniDetail");

  const UNI_GP_OPTIONS =
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
    const row = document.createElement("div");
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
    for (let i = 1; i <= 6; i++) addUniCourseRow(i);
  }

  if (uniAddBtn) {
    uniAddBtn.addEventListener("click", function () {
      const count = uniCoursesContainer.querySelectorAll(".gpa-uni-row").length + 1;
      addUniCourseRow(count);
      let rows = uniCoursesContainer.querySelectorAll(".gpa-uni-row");
      const lastSelect = rows[rows.length - 1].querySelector("select");
      if (lastSelect) lastSelect.focus();
    });
  }

  function debounceUniCalc() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(calculateUni, 100);
  }

  function calculateUni() {
    let rows = uniCoursesContainer.querySelectorAll(".gpa-uni-row");
    let totalQP = 0;
    let totalCredits = 0;
    let hasFail = false;
    let filledCount = 0;

    rows.forEach(function (row) {
      const gpSel = row.querySelector('select[name="uni-gp"]');
      const crInput = row.querySelector('input[name="uni-credit"]');
      if (!gpSel || gpSel.value === "") return;

      const gp = parseFloat(gpSel.value);
      const cr = parseFloat(crInput.value) || 0;
      if (cr <= 0) return;

      filledCount++;
      if (gp === 0) hasFail = true;
      totalQP += gp * cr;
      totalCredits += cr;
    });

    if (filledCount === 0 || totalCredits === 0) {
      uniResultCard.hidden = true;
      saveState();
      return;
    }

    const cgpa = totalQP / totalCredits;

    let academicClass, badgeClass;
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

    uniResultCard.hidden = false;
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
  const targetFields = ["gpa-target-current", "gpa-target-credits-done", "gpa-target-credits-next", "gpa-target-goal"];
  const targetResultCard = document.getElementById("gpaTargetResult");
  const targetValue = document.getElementById("gpaTargetValue");
  const targetBadge = document.getElementById("gpaTargetBadge");
  const targetMessage = document.getElementById("gpaTargetMessage");

  targetFields.forEach(function (id) {
    let element = document.getElementById(id);
    if (element) element.addEventListener("input", debounceTargetCalc);
  });

  function debounceTargetCalc() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(calculateTarget, 100);
  }

  function calculateTarget() {
    const currentCGPA = parseFloat(document.getElementById("gpa-target-current").value);
    const creditsDone = parseFloat(document.getElementById("gpa-target-credits-done").value);
    const creditsNext = parseFloat(document.getElementById("gpa-target-credits-next").value);
    const targetCGPA = parseFloat(document.getElementById("gpa-target-goal").value);

    if (isNaN(currentCGPA) || isNaN(creditsDone) || isNaN(creditsNext) || isNaN(targetCGPA) || creditsNext <= 0) {
      targetResultCard.hidden = true;
      saveState();
      return;
    }

    const currentPoints = currentCGPA * creditsDone;
    const finalCredits = creditsDone + creditsNext;
    const neededTotal = targetCGPA * finalCredits;
    const neededNext = neededTotal - currentPoints;
    const requiredGPA = neededNext / creditsNext;

    targetResultCard.hidden = false;
    targetValue.textContent = requiredGPA.toFixed(2);

    let badgeText, badgeClass, message, progressClass;
    const progressPct = Math.min(100, (requiredGPA / 4.00) * 100);

    if (requiredGPA > 4.00) {
      badgeText = "অসম্ভব (Impossible)";
      badgeClass = "impossible";
      progressClass = "impossible";
      const suggestedTarget = ((currentPoints + 4.00 * creditsNext) / finalCredits).toFixed(2);
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
    let existingBar = targetResultCard.querySelector(".gpa-progress-bar");
    if (!existingBar) {
      const barHtml = '<div class="gpa-progress-bar"><div class="gpa-progress-fill"></div></div>';
      targetMessage.insertAdjacentHTML("beforebegin", barHtml);
      existingBar = targetResultCard.querySelector(".gpa-progress-bar");
    }
    let fill = existingBar.querySelector(".gpa-progress-fill");
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
      let state = { ssc: {}, uni: [], target: {} };

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
        let element = document.getElementById(id);
        if (element) state.target[id] = element.value;
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function restoreState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const state = JSON.parse(raw);

      /* SSC */
      if (state.ssc) {
        const sscSelects = sscSubjectsContainer.querySelectorAll("select");
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
          const rows = uniCoursesContainer.querySelectorAll(".gpa-uni-row");
          const last = rows[rows.length - 1];
          if (last && c.name) last.querySelector('input[name="uni-course-name"]').value = c.name;
        });
        return true;
      }

      /* Target */
      if (state.target) {
        targetFields.forEach(function (id) {
          const element = document.getElementById(id);
          if (element && state.target[id]) element.value = state.target[id];
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
  const restored = restoreState();
  if (!restored) seedUniRows();

  bindSscListeners();

  /* Run initial calculations if data exists */
  calculateSSC();
  calculateUni();
  calculateTarget();
})();
