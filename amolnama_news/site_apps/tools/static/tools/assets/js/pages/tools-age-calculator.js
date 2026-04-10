/* ============================================================
   Age Calculator — 100% client-side, instant calculation
   ============================================================ */
(function() {
  "use strict";

  const dobInput   = document.getElementById("age-dob");
  const targetInput = document.getElementById("age-target");
  const calcBtn    = document.getElementById("age-calc-button");
  const resultsDiv = document.getElementById("ageResults");

  if (!calcBtn) return;

  // Set target default to today in DD/MM/YYYY
  const t = new Date();
  targetInput.value = String(t.getDate()).padStart(2,"0") + "/" + String(t.getMonth()+1).padStart(2,"0") + "/" + t.getFullYear();

  calcBtn.addEventListener("click", calculate);
  dobInput.addEventListener("keydown", function(e) { if (e.key === "Enter") calculate(); });

  // Bengali day names
  const BN_DAYS = ["রবিবার","সোমবার","মঙ্গলবার","বুধবার","বৃহস্পতিবার","শুক্রবার","শনিবার"];
  const BN_MONTHS = ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];

  // Bengali digits
  function toBn(n) {
    const bn = "০১২৩৪৫৬৭৮৯";
    return String(n).replace(/\d/g, function(d) { return bn[d]; });
  }

  function toISODate(d) {
    let y = d.getFullYear();
    let m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  // Format large numbers with commas (Bangladeshi style: 1,23,456)
  function formatBd(n) {
    const s = String(n);
    if (s.length <= 3) return s;
    const last3 = s.slice(-3);
    let rest = s.slice(0, -3);
    const parts = [];
    while (rest.length > 2) {
      parts.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest) parts.unshift(rest);
    return parts.join(",") + "," + last3;
  }

  // Parse DD/MM/YYYY string to Date
  function parseDMY(str) {
    if (!str) return null;
    const p = str.split("/");
    if (p.length !== 3) return null;
    const d = parseInt(p[0],10), m = parseInt(p[1],10) - 1, y = parseInt(p[2],10);
    if (isNaN(d) || isNaN(m) || isNaN(y) || y < 1900) return null;
    return new Date(y, m, d);
  }

  function calculate() {
    const dob = parseDMY(dobInput.value);
    if (!dob) { dobInput.focus(); return; }

    const target = parseDMY(targetInput.value) || new Date();

    if (dob >= target) { dobInput.focus(); return; }

    // Exact age calculation (years, months, days)
    let years = target.getFullYear() - dob.getFullYear();
    let months = target.getMonth() - dob.getMonth();
    let days = target.getDate() - dob.getDate();

    if (days < 0) {
      months--;
      const prevMonth = new Date(target.getFullYear(), target.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    // Total calculations
    const diffMs = target.getTime() - dob.getTime();
    const totalDays = Math.floor(diffMs / 86400000);
    const totalWeeks = Math.floor(totalDays / 7);
    const totalMonths = years * 12 + months;
    const totalHours = totalDays * 24;
    const totalMinutes = totalHours * 60;
    const totalSeconds = totalMinutes * 60;

    // Display primary age
    document.getElementById("ageYears").textContent = toBn(years);
    document.getElementById("ageMonths").textContent = toBn(months);
    document.getElementById("ageDays").textContent = toBn(days);

    // Next birthday
    let nextBirthday = new Date(target.getFullYear(), dob.getMonth(), dob.getDate());
    if (nextBirthday <= target) {
      nextBirthday = new Date(target.getFullYear() + 1, dob.getMonth(), dob.getDate());
    }
    const daysUntilBday = Math.ceil((nextBirthday.getTime() - target.getTime()) / 86400000);
    const turningAge = nextBirthday.getFullYear() - dob.getFullYear();

    document.getElementById("ageBirthdayCountdown").textContent =
      daysUntilBday === 0 ? "আজ আপনার জন্মদিন! 🎉" : toBn(daysUntilBday) + " দিন বাকি";
    document.getElementById("ageBirthdayDate").textContent =
      toBn(nextBirthday.getDate()) + " " + BN_MONTHS[nextBirthday.getMonth()] + " " + toBn(nextBirthday.getFullYear());
    document.getElementById("ageBirthdayDay").textContent =
      BN_DAYS[nextBirthday.getDay()] + " — " + toBn(turningAge) + " বছর পূর্ণ হবে";

    // Detail grid
    document.getElementById("ageTotalMonths").textContent = formatBd(totalMonths);
    document.getElementById("ageTotalWeeks").textContent = formatBd(totalWeeks);
    document.getElementById("ageTotalDays").textContent = formatBd(totalDays);
    document.getElementById("ageTotalHours").textContent = formatBd(totalHours);
    document.getElementById("ageTotalMinutes").textContent = formatBd(totalMinutes);
    document.getElementById("ageTotalSeconds").textContent = formatBd(totalSeconds);

    // Fun facts
    const zodiac = getZodiac(dob.getMonth(), dob.getDate());
    const chineseZodiac = getChineseZodiac(dob.getFullYear());
    const birthDay = BN_DAYS[dob.getDay()];
    const heartbeats = formatBd(totalDays * 100000);
    const breaths = formatBd(totalDays * 23000);
    const sleepYears = (totalDays * 8 / (365.25 * 24)).toFixed(1);
    const moonOrbits = (totalDays / 27.3).toFixed(0);

    const factsHtml = [
      "আপনি জন্মেছিলেন " + birthDay + "বার",
      "রাশি: " + zodiac.bn + " (" + zodiac.en + ") " + zodiac.symbol,
      "চীনা রাশি: " + chineseZodiac,
      "আপনার হৃদপিণ্ড প্রায় " + heartbeats + " বার স্পন্দিত হয়েছে",
      "আপনি প্রায় " + breaths + " বার শ্বাস নিয়েছেন",
      "আপনি প্রায় " + toBn(sleepYears) + " বছর ঘুমিয়ে কাটিয়েছেন",
      "চাঁদ আপনার জন্মের পর প্রায় " + formatBd(moonOrbits) + " বার পৃথিবী প্রদক্ষিণ করেছে",
      "পৃথিবী সূর্যের চারপাশে " + toBn(years) + " বার ঘুরেছে আপনার জন্মের পর"
    ].map(function(fact) { return "<li>" + fact + "</li>"; }).join("");

    document.getElementById("ageFunFacts").innerHTML = factsHtml;

    // Life milestones
    const milestones = [
      { age: 1, label: "প্রথম জন্মদিন", icon: "🎂" },
      { age: 5, label: "স্কুল শুরু", icon: "🏫" },
      { age: 10, label: "১০ বছর পূর্ণ", icon: "🎈" },
      { age: 13, label: "কিশোর বয়স", icon: "🧑" },
      { age: 18, label: "প্রাপ্তবয়স্ক (ভোটাধিকার)", icon: "🗳️" },
      { age: 21, label: "২১ বছর পূর্ণ", icon: "🎓" },
      { age: 25, label: "পঁচিশ বছর", icon: "💼" },
      { age: 30, label: "তিরিশ বছর", icon: "🏠" },
      { age: 40, label: "চল্লিশ বছর", icon: "⭐" },
      { age: 50, label: "পঞ্চাশ বছর (অর্ধ-শতাব্দী)", icon: "🌟" },
      { age: 59, label: "অবসরের বছর", icon: "🌅" },
      { age: 60, label: "ষাট বছর", icon: "🎊" },
      { age: 70, label: "সত্তর বছর", icon: "🌳" },
      { age: 80, label: "আশি বছর", icon: "👑" },
      { age: 100, label: "শত বছর (শতায়ু)", icon: "💯" }
    ];

    const milestonesHtml = milestones.map(function(m) {
      const milestoneDate = new Date(dob.getFullYear() + m.age, dob.getMonth(), dob.getDate());
      const isPast = milestoneDate <= target;
      const cls = isPast ? "age-milestone--past" : "age-milestone--future";
      const dateStr = toBn(milestoneDate.getDate()) + " " + BN_MONTHS[milestoneDate.getMonth()] + " " + toBn(milestoneDate.getFullYear());
      return '<div class="age-milestone ' + cls + '">' +
        '<span class="age-milestone-icon">' + m.icon + '</span>' +
        '<span class="age-milestone-text">' + m.label + ' (' + toBn(m.age) + ' বছর)</span>' +
        '<span class="age-milestone-date">' + dateStr + '</span>' +
        '</div>';
    }).join("");

    document.getElementById("ageMilestones").innerHTML = milestonesHtml;

    // Show results with animation (no scroll jump)
    resultsDiv.hidden = false;

    // Live seconds counter
    startLiveCounter(dob);
  }

  // Live updating seconds counter
  let liveTimer = null;
  function startLiveCounter(dob) {
    if (liveTimer) clearInterval(liveTimer);
    liveTimer = setInterval(function() {
      const now = new Date();
      const diff = Math.floor((now.getTime() - dob.getTime()) / 1000);
      document.getElementById("ageTotalSeconds").textContent = formatBd(diff);
    }, 1000);
  }

  // Western zodiac
  function getZodiac(month, day) {
    const signs = [
      { en:"Capricorn",  bn:"মকর",    symbol:"♑", end:[1,19] },
      { en:"Aquarius",   bn:"কুম্ভ",   symbol:"♒", end:[2,18] },
      { en:"Pisces",     bn:"মীন",    symbol:"♓", end:[3,20] },
      { en:"Aries",      bn:"মেষ",    symbol:"♈", end:[4,19] },
      { en:"Taurus",     bn:"বৃষ",    symbol:"♉", end:[5,20] },
      { en:"Gemini",     bn:"মিথুন",  symbol:"♊", end:[6,20] },
      { en:"Cancer",     bn:"কর্কট",  symbol:"♋", end:[7,22] },
      { en:"Leo",        bn:"সিংহ",   symbol:"♌", end:[8,22] },
      { en:"Virgo",      bn:"কন্যা",  symbol:"♍", end:[9,22] },
      { en:"Libra",      bn:"তুলা",   symbol:"♎", end:[10,22] },
      { en:"Scorpio",    bn:"বৃশ্চিক", symbol:"♏", end:[11,21] },
      { en:"Sagittarius",bn:"ধনু",    symbol:"♐", end:[12,21] },
      { en:"Capricorn",  bn:"মকর",    symbol:"♑", end:[12,31] }
    ];
    const m = month + 1; // 0-indexed to 1-indexed
    for (let i = 0; i < signs.length; i++) {
      if (m < signs[i].end[0] || (m === signs[i].end[0] && day <= signs[i].end[1])) {
        return signs[i];
      }
    }
    return signs[0];
  }

  // Chinese zodiac
  function getChineseZodiac(year) {
    const animals = [
      "বানর (Monkey) 🐒","মোরগ (Rooster) 🐓","কুকুর (Dog) 🐕","শূকর (Pig) 🐷",
      "ইঁদুর (Rat) 🐀","গরু (Ox) 🐂","বাঘ (Tiger) 🐅","খরগোশ (Rabbit) 🐇",
      "ড্রাগন (Dragon) 🐉","সাপ (Snake) 🐍","ঘোড়া (Horse) 🐎","ভেড়া (Goat) 🐐"
    ];
    return animals[year % 12];
  }
})();
