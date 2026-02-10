/**
 * English → Bengali phonetic transliteration (Avro-style).
 * Covers common Bangladeshi name patterns.
 * The user can always edit the Bengali field to correct the result.
 */
(function () {
  "use strict";

  /* ── Phonetic rules (longest match first) ───────────────────── */
  var RULES = [
    /* conjuncts / digraphs */
    ["shh", "ষ"],  ["ssh", "ষ"],
    ["bhl", "ভ্ল"], ["phl", "ফ্ল"],
    ["ndr", "ন্দ্র"], ["ntr", "ন্ত্র"],
    ["shr", "শ্র"], ["str", "স্ত্র"],
    ["ksh", "ক্ষ"], ["kkh", "ক্ষ"],
    ["cch", "চ্ছ"], ["chh", "ছ"],
    ["ndh", "ন্ধ"], ["ngh", "ঙ্ঘ"],
    ["nth", "ন্থ"],
    ["kk", "ক্ক"], ["gg", "গ্গ"],
    ["nn", "ন্ন"], ["mm", "ম্ম"],
    ["ll", "ল্ল"], ["ss", "স্স"],
    ["tt", "ট্ট"], ["dd", "ড্ড"],
    ["pp", "প্প"], ["bb", "ব্ব"],
    ["sh", "শ"],   ["Sh", "ষ"],
    ["kh", "খ"],   ["gh", "ঘ"],
    ["ch", "চ"],   ["jh", "ঝ"],
    ["Th", "ঠ"],   ["th", "থ"],
    ["Dh", "ঢ"],   ["dh", "ধ"],
    ["ph", "ফ"],   ["bh", "ভ"],
    ["ng", "ং"],   ["nk", "ঙ্ক"],
    ["nd", "ন্দ"], ["nt", "ন্ত"],
    ["mp", "ম্প"], ["mb", "ম্ব"],
    ["rr", "র্র"],
    ["Dr", "ড্র"], ["Tr", "ট্র"],
    ["kr", "ক্র"], ["pr", "প্র"],
    ["gr", "গ্র"], ["tr", "ত্র"],
    ["br", "ব্র"], ["fr", "ফ্র"],
    ["dr", "দ্র"], ["mr", "ম্র"],
    ["nr", "ন্র"],
    ["kl", "ক্ল"], ["pl", "প্ল"],
    ["gl", "গ্ল"], ["bl", "ব্ল"],
    ["fl", "ফ্ল"], ["sl", "স্ল"],
    ["ry", "র‍্য"], ["ly", "ল্য"],
    ["ny", "ন্য"], ["sy", "স্য"],
    ["sk", "স্ক"], ["sp", "স্প"],
    ["st", "স্ত"], ["sn", "স্ন"],
    ["sm", "স্ম"],
    /* vowel digraphs */
    ["ou", "\u09CC"], ["oi", "\u09C8"],
    ["ee", "\u09C0"], ["oo", "\u09C2"],
    ["ai", "\u09C8"], ["au", "\u09CC"],
    /* single consonants */
    ["k", "ক"], ["g", "গ"], ["T", "ট"], ["D", "ড"],
    ["N", "ণ"], ["t", "ত"], ["d", "দ"], ["n", "ন"],
    ["p", "প"], ["f", "ফ"], ["b", "ব"], ["v", "ভ"],
    ["m", "ম"], ["z", "জ"], ["r", "র"], ["l", "ল"],
    ["s", "স"], ["h", "হ"], ["j", "জ"], ["y", "য়"],
    ["w", "ও"],
    ["q", "ক"], ["x", "ক্স"],
    /* standalone vowels (used at word start, handled separately) */
    ["a", "া"],  ["i", "ি"],  ["u", "ু"],
    ["e", "ে"],  ["o", "ো"],
  ];

  /* Standalone vowel forms (beginning of word / after vowel) */
  var VOWEL_STANDALONE = {
    "a": "আ", "i": "ই", "u": "উ", "e": "এ", "o": "ও",
    "ou": "ঔ", "oi": "ঐ", "ee": "ঈ", "oo": "ঊ",
    "ai": "ঐ", "au": "ঔ",
  };

  /* Set of vowel matras for detecting "after vowel" context */
  var VOWEL_MATRAS = new Set([
    "া", "ি", "ী", "ু", "ূ", "ে", "ৈ", "ো", "ৌ",
    "আ", "ই", "ঈ", "উ", "ঊ", "এ", "ঐ", "ও", "ঔ", "অ",
  ]);

  var VOWEL_KEYS = new Set(["a", "e", "i", "o", "u"]);

  function isVowelKey(ch) {
    return VOWEL_KEYS.has(ch.toLowerCase());
  }

  /**
   * Transliterate an English string to Bengali script.
   */
  function transliterate(input) {
    if (!input) return "";
    var result = "";
    var i = 0;
    var afterConsonant = false;
    var wordStart = true;

    while (i < input.length) {
      /* skip spaces / non-alpha */
      if (input[i] === " " || input[i] === "-" || input[i] === "'") {
        result += input[i];
        wordStart = true;
        afterConsonant = false;
        i++;
        continue;
      }

      var matched = false;

      /* try longest match first (up to 3 chars) */
      for (var len = 3; len >= 1; len--) {
        var chunk = input.substr(i, len);
        var chunkLower = chunk.toLowerCase();

        /* check if this is a vowel pattern at word start */
        if (wordStart || !afterConsonant) {
          if (VOWEL_STANDALONE[chunkLower] && isVowelKey(chunk[0])) {
            result += VOWEL_STANDALONE[chunkLower];
            i += len;
            matched = true;
            wordStart = false;
            afterConsonant = false;
            break;
          }
        }

        /* search in rules */
        for (var r = 0; r < RULES.length; r++) {
          if (RULES[r][0] === chunk || RULES[r][0] === chunkLower) {
            var bengali = RULES[r][1];
            result += bengali;
            i += len;
            matched = true;
            afterConsonant = !isVowelKey(chunk[chunk.length - 1]);
            wordStart = false;
            break;
          }
        }
        if (matched) break;
      }

      if (!matched) {
        /* pass through unknown characters */
        result += input[i];
        wordStart = false;
        afterConsonant = false;
        i++;
      }
    }

    return result;
  }

  /* ── DOM wiring ─────────────────────────────────────────────── */

  function setup() {
    var enFirst = document.getElementById("id_first_name_en");
    var enLast  = document.getElementById("id_last_name_en");
    var bnFirst = document.getElementById("id_first_name_bn");
    var bnLast  = document.getElementById("id_last_name_bn");

    if (!enFirst || !bnFirst) return;

    var HINT_TEXT = "Auto-transliterated — not saved yet";

    /* Show a hint message below a Bengali field */
    function addHint(bnField) {
      if (bnField.nextElementSibling && bnField.nextElementSibling.classList.contains("transliterate-hint")) return;
      var hint = document.createElement("small");
      hint.className = "transliterate-hint";
      hint.textContent = HINT_TEXT;
      hint.style.color = "#888";
      hint.style.display = "block";
      hint.style.marginTop = "2px";
      bnField.parentNode.insertBefore(hint, bnField.nextSibling);
    }

    /* Remove the hint message */
    function removeHint(bnField) {
      var next = bnField.nextElementSibling;
      if (next && next.classList.contains("transliterate-hint")) {
        next.remove();
      }
    }

    /* Auto-fill a Bengali field and show hint */
    function autoFill(enField, bnField) {
      if (bnField.value.trim()) return;
      var cur = enField.value.trim();
      if (!cur) return;
      bnField.value = transliterate(cur);
      addHint(bnField);
    }

    /* Remove hint when user manually edits Bengali field */
    bnFirst.addEventListener("input", function () { removeHint(bnFirst); });
    if (bnLast) bnLast.addEventListener("input", function () { removeHint(bnLast); });

    /* On blur: only fill if Bengali is empty */
    enFirst.addEventListener("blur", function () { autoFill(enFirst, bnFirst); });
    if (enLast && bnLast) {
      enLast.addEventListener("blur", function () { autoFill(enLast, bnLast); });
    }

    /* On page load: transliterate if Bengali empty but English has value */
    autoFill(enFirst, bnFirst);
    if (enLast && bnLast) autoFill(enLast, bnLast);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
