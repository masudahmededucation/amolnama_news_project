/**
 * emoji-picker.js — Shared emoji picker component.
 *
 * One source of truth for emoji categories, rendering, and insertion.
 * Used by: post composer, messenger, any future textarea with emojis.
 *
 * Usage:
 *   window.emojiPicker.attach({
 *     toggleButton: <HTMLButtonElement>,      — button that opens/closes picker
 *     pickerContainer: <HTMLElement>,          — container to render picker into
 *     targetTextarea: <HTMLTextAreaElement>,   — textarea to insert emojis into
 *     onInsert: function (emoji) {},           — optional callback after insert
 *     mode: 'full' | 'compact',               — 'full' = tabs + categories, 'compact' = flat common list
 *   });
 */
window.emojiPicker = (function () {
  'use strict';

  var TWEMOJI_CDN = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg';

  var CATEGORIES = {
    smileys: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮','😯','😲','😳','🥺','😢','😭','😤','😠','😡','🤬','😈','💀','💩','🤡','👻','👽','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
    gestures: ['👍','👎','👊','✊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💪','🦾','🖕','☝️','👆','👇','👈','👉','👋','🤚','🖐️','✋','🖖','🤟','🤘','🤙','👌','🤌','🤏','✌️','🤞','🫰','🫵','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤙'],
    hearts: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🫶','💑','💏','💋','🌹','🥀','💐','🌸','🌺','🌻','🌷'],
    objects: ['📰','🗞️','📸','📷','🎥','🎬','📺','📻','🎙️','🎤','🔔','📢','📣','🏆','🥇','🥈','🥉','⚽','🏏','🏀','🎾','🏐','🎯','🪁','🎮','🎰','🎲','♟️','🎭','🎨','🎪','🎟️','🎫','💰','💵','💸','🏦','📊','📈','📉','⚖️','🔒','🔓','🔑','🗝️','🛡️','⚔️','💣','🔫','💊','💉','🩺','🏥','🏫','🏢','🏗️'],
    nature: ['🌿','🍃','🌱','🌲','🌳','🌴','🌵','🌾','🌊','🌈','⭐','🌙','☀️','⛅','🌤️','🌧️','⛈️','🌩️','❄️','🔥','💧','🌍','🌏','🐦','🦅','🐟','🐬','🦋','🐝','🐞','🌸','🌺','🌻','🌹','🌷','🍀','🍁','🍂','🍃'],
    flags: ['🇧🇩','🇮🇳','🇵🇰','🇸🇦','🇦🇪','🇲🇾','🇬🇧','🇺🇸','🇨🇦','🇦🇺','🇯🇵','🇰🇷','🇨🇳','🇫🇷','🇩🇪','🇮🇹','🇪🇸','🇧🇷','🇹🇷','🇶🇦','🇰🇼','🇴🇲','🇧🇭','🇯🇴','🇱🇧','🇮🇶','🇪🇬']
  };

  var COMPACT_EMOJIS = ['😊','😂','❤️','👍','🙏','😢','😡','🔥','💯','✅','👏','🎉','😍','🤔','😎','💪','🥰','😭','🤣','👀','💀','🫡','😤','🥺','😅','🙄','😳','🤝','💜','🌹','🇧🇩','⭐','💬','📌','🗑','✏️','↩','📋','🔗','👁','📩','🔔','❌','⚡','🎯','💡','📸','🎵','🏆','🌟'];

  var TAB_ICONS = {
    smileys: '😊',
    gestures: '👍',
    hearts: '❤️',
    objects: '📰',
    nature: '🌿',
    flags: '🇧🇩'
  };

  /* Flag emoji → country code label (Windows doesn't render flag emojis) */
  var FLAG_LABELS = {
    '🇧🇩': 'BD', '🇮🇳': 'IN', '🇵🇰': 'PK', '🇸🇦': 'SA', '🇦🇪': 'AE',
    '🇲🇾': 'MY', '🇬🇧': 'GB', '🇺🇸': 'US', '🇨🇦': 'CA', '🇦🇺': 'AU',
    '🇯🇵': 'JP', '🇰🇷': 'KR', '🇨🇳': 'CN', '🇫🇷': 'FR', '🇩🇪': 'DE',
    '🇮🇹': 'IT', '🇪🇸': 'ES', '🇧🇷': 'BR', '🇹🇷': 'TR', '🇶🇦': 'QA',
    '🇰🇼': 'KW', '🇴🇲': 'OM', '🇧🇭': 'BH', '🇯🇴': 'JO', '🇱🇧': 'LB',
    '🇮🇶': 'IQ', '🇪🇬': 'EG'
  };

  /* Convert flag emoji codepoints to Twemoji CDN image URL */
  function getFlagImageUrl(flagEmoji) {
    var codepoints = [];
    for (var charIndex = 0; charIndex < flagEmoji.length; charIndex++) {
      var codePoint = flagEmoji.codePointAt(charIndex);
      if (codePoint > 0xFFFF) charIndex++;
      if (codePoint === 0xFE0F || codePoint === 0x200D) continue;
      codepoints.push(codePoint.toString(16));
    }
    return TWEMOJI_CDN + '/' + codepoints.join('-') + '.svg';
  }

  /* ── Render emoji grid ── */
  function renderCategory(gridElement, categoryName, idPrefix) {
    var emojis = CATEGORIES[categoryName] || [];
    gridElement.innerHTML = '';
    var isFlags = categoryName === 'flags';

    for (var emojiIndex = 0; emojiIndex < emojis.length; emojiIndex++) {
      var emojiItem = document.createElement('button');
      emojiItem.type = 'button';
      emojiItem.className = 'emoji-picker-item';
      emojiItem.id = idPrefix + '-emoji-item-' + categoryName + '-' + emojiIndex;
      emojiItem.name = idPrefix + '_emoji_item_' + categoryName + '_' + emojiIndex;
      emojiItem.setAttribute('data-emoji', emojis[emojiIndex]);

      if (isFlags && FLAG_LABELS[emojis[emojiIndex]]) {
        var flagImage = document.createElement('img');
        flagImage.src = getFlagImageUrl(emojis[emojiIndex]);
        flagImage.alt = emojis[emojiIndex];
        flagImage.width = 20;
        flagImage.height = 20;
        flagImage.loading = 'lazy';
        flagImage.decoding = 'async';
        flagImage.className = 'emoji-picker-flag-image';
        var flagCode = document.createElement('span');
        flagCode.className = 'emoji-picker-flag-code';
        flagCode.textContent = FLAG_LABELS[emojis[emojiIndex]];
        emojiItem.appendChild(flagImage);
        emojiItem.appendChild(flagCode);
        emojiItem.classList.add('emoji-picker-item--flag');
      } else {
        emojiItem.textContent = emojis[emojiIndex];
      }

      gridElement.appendChild(emojiItem);
    }
  }

  /* ── Render compact (flat list) ── */
  function renderCompact(gridElement, idPrefix) {
    gridElement.innerHTML = '';
    for (var emojiIndex = 0; emojiIndex < COMPACT_EMOJIS.length; emojiIndex++) {
      var emojiItem = document.createElement('button');
      emojiItem.type = 'button';
      emojiItem.className = 'emoji-picker-item';
      emojiItem.id = idPrefix + '-emoji-item-compact-' + emojiIndex;
      emojiItem.name = idPrefix + '_emoji_item_compact_' + emojiIndex;
      emojiItem.setAttribute('data-emoji', COMPACT_EMOJIS[emojiIndex]);
      emojiItem.textContent = COMPACT_EMOJIS[emojiIndex];
      gridElement.appendChild(emojiItem);
    }
  }

  /* ── Insert emoji into textarea at cursor position ── */
  function insertEmojiIntoTextarea(textarea, emoji) {
    var cursorPosition = textarea.selectionStart;
    var textBefore = textarea.value.substring(0, cursorPosition);
    var textAfter = textarea.value.substring(textarea.selectionEnd);
    textarea.value = textBefore + emoji + textAfter;
    textarea.selectionStart = textarea.selectionEnd = cursorPosition + emoji.length;
    textarea.focus();
    textarea.dispatchEvent(new Event('input'));
  }

  /* ── Build full picker HTML (tabs + grid) ── */
  function buildFullPicker(container, idPrefix) {
    var tabsHtml = '<div class="emoji-picker-tabs" id="' + idPrefix + '-emoji-tabs" name="' + idPrefix + '_emoji_tabs">';
    var categoryNames = Object.keys(CATEGORIES);
    for (var tabIndex = 0; tabIndex < categoryNames.length; tabIndex++) {
      var categoryName = categoryNames[tabIndex];
      var activeClass = tabIndex === 0 ? ' emoji-picker-tab--active' : '';
      tabsHtml += '<button type="button" class="emoji-picker-tab' + activeClass + '" ' +
        'id="' + idPrefix + '-emoji-tab-' + categoryName + '" ' +
        'name="' + idPrefix + '_emoji_tab_' + categoryName + '" ' +
        'data-category="' + categoryName + '">' +
        TAB_ICONS[categoryName] + '</button>';
    }
    tabsHtml += '</div>';
    tabsHtml += '<div class="emoji-picker-grid" id="' + idPrefix + '-emoji-grid" name="' + idPrefix + '_emoji_grid"></div>';
    container.innerHTML = tabsHtml;
  }

  /* ── Main attach function ── */
  function attach(config) {
    var toggleButton = config.toggleButton;
    var pickerContainer = config.pickerContainer;
    var targetTextarea = config.targetTextarea;
    var onInsert = config.onInsert || null;
    var mode = config.mode || 'full';
    var idPrefix = config.idPrefix || 'emoji-picker';

    if (!toggleButton || !pickerContainer || !targetTextarea) return;

    var gridElement;

    if (mode === 'full') {
      buildFullPicker(pickerContainer, idPrefix);
      gridElement = pickerContainer.querySelector('.emoji-picker-grid');

      /* Render default category */
      renderCategory(gridElement, 'smileys', idPrefix);

      /* Tab switching */
      var tabsContainer = pickerContainer.querySelector('.emoji-picker-tabs');
      if (tabsContainer) {
        tabsContainer.addEventListener('click', function (event) {
          var tab = event.target.closest('.emoji-picker-tab');
          if (!tab) return;
          var tabs = tabsContainer.querySelectorAll('.emoji-picker-tab');
          for (var removeIndex = 0; removeIndex < tabs.length; removeIndex++) {
            tabs[removeIndex].classList.remove('emoji-picker-tab--active');
          }
          tab.classList.add('emoji-picker-tab--active');
          renderCategory(gridElement, tab.getAttribute('data-category'), idPrefix);
        });
      }
    } else {
      /* Compact mode — flat grid, no tabs */
      pickerContainer.innerHTML = '<div class="emoji-picker-grid" id="' + idPrefix + '-emoji-grid" name="' + idPrefix + '_emoji_grid"></div>';
      gridElement = pickerContainer.querySelector('.emoji-picker-grid');
      renderCompact(gridElement, idPrefix);
    }

    /* Toggle picker visibility */
    toggleButton.addEventListener('click', function () {
      pickerContainer.hidden = !pickerContainer.hidden;
      if (!pickerContainer.hidden && mode === 'full') {
        renderCategory(gridElement, 'smileys', idPrefix);
      }
    });

    /* Insert emoji on click */
    var emojiInsertInProgress = false;
    gridElement.addEventListener('click', function (event) {
      var emojiItem = event.target.closest('.emoji-picker-item');
      if (!emojiItem) return;
      var emoji = emojiItem.getAttribute('data-emoji');
      emojiInsertInProgress = true;
      insertEmojiIntoTextarea(targetTextarea, emoji);
      emojiInsertInProgress = false;
      if (onInsert) onInsert(emoji);
    });

    /* Close picker when textarea gets manual click (not programmatic focus) */
    targetTextarea.addEventListener('mousedown', function () {
      if (!emojiInsertInProgress) {
        pickerContainer.hidden = true;
      }
    });

    /* Return API for external control */
    return {
      hide: function () { pickerContainer.hidden = true; },
      show: function () { pickerContainer.hidden = false; },
      isOpen: function () { return !pickerContainer.hidden; }
    };
  }

  return { attach: attach };
})();
