function toBanglaNumber(num) {
    const banglaDigits = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
    return num.toString().replace(/[0-9]/g, d => banglaDigits[d]);
}

function updateLiveClock() {
    const el = document.getElementById("liveDateTime");
    if (!el) return;

    const now = new Date();

    const dayNames = [
        "রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার",
        "বৃহস্পতিবার", "শুক্রবার", "শনিবার"
    ];

    const monthNames = [
        "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল",
        "মে", "জুন", "জুলাই", "আগস্ট",
        "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
    ];

    const dayName = dayNames[now.getDay()];

    // Pad date to 2 digits so length is always the same
    const ddRaw = String(now.getDate()).padStart(2, "0");
    const dd = toBanglaNumber(ddRaw);
    const mm = monthNames[now.getMonth()];
    const yyyy = toBanglaNumber(now.getFullYear());

    let hh = now.getHours();
    const min = now.getMinutes();
    const ss = now.getSeconds();

    let period;
    if (hh >= 4 && hh < 12)       period = "সকাল";
    else if (hh >= 12 && hh < 17) period = "দুপুর";
    else if (hh >= 17 && hh < 20) period = "বিকাল";
    else if (hh >= 20 && hh <= 23) period = "রাত";
    else                          period = "ভোর";

    hh = hh % 12 || 12;

    const hhBangla = toBanglaNumber(String(hh).padStart(2, "0"));
    const minBangla = toBanglaNumber(String(min).padStart(2, "0"));
    const ssBangla = toBanglaNumber(String(ss).padStart(2, "0"));

    // Format: মঙ্গলবার, ০২ ডিসেম্বর ২০২৫, রাত: ১০:০৭:৪১
    const formatted = `${dayName}, ${dd} ${mm} ${yyyy}, ${period}: ${hhBangla}:${minBangla}:${ssBangla}`;

    el.textContent = formatted;
}

document.addEventListener("DOMContentLoaded", function () {
    updateLiveClock();
    setInterval(updateLiveClock, 1000);
});
