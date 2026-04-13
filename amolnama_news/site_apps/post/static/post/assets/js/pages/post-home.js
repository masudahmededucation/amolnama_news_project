/* post-home.js — Post creation, like, bookmark, share interactions */
(function () {
  'use strict';


  /* ---- Composer expand/collapse ---- */

  let composerElement = document.getElementById('post-composer');
  if (composerElement) {
    let composerFullPlaceholder = '';

    /* Expand on click/focus anywhere inside the composer */
    composerElement.addEventListener('click', function () {
      composerElement.classList.remove('post-composer-collapsed');
      let textarea = composerElement.querySelector('.post-composer-textarea');
      if (textarea) {
        textarea.setAttribute('rows', '3');
        if (composerFullPlaceholder) textarea.placeholder = composerFullPlaceholder;
      }
    });

    /* Draft mode — don't collapse if user has content, files, or file picker is open */
    let filePickerIsOpen = false;

    function isComposerInDraftMode() {
      if (filePickerIsOpen) return true;
      let textarea = composerElement.querySelector('.post-composer-textarea');
      const hasText = textarea && textarea.value.trim().length > 0;
      const previewContainer = document.getElementById('post-composer-media-preview');
      const hasFiles = previewContainer && previewContainer.children.length > 0;
      return hasText || hasFiles;
    }

    /* Track file picker open/close */
    const mediaFileInput = document.getElementById('post-composer-media-input');
    if (mediaFileInput) {
      mediaFileInput.addEventListener('click', function () {
        filePickerIsOpen = true;
        /* Fallback — reset after 30s in case change/cancel events don't fire */
        setTimeout(function () { filePickerIsOpen = false; }, 30000);
      });
      mediaFileInput.addEventListener('change', function () { filePickerIsOpen = false; });
      mediaFileInput.addEventListener('cancel', function () { filePickerIsOpen = false; });
    }

    /* Collapse helper — only collapse if NOT in draft mode */
    function collapseComposer() {
      if (composerElement.classList.contains('post-composer-collapsed')) return;
      if (isComposerInDraftMode()) return;
      composerElement.classList.add('post-composer-collapsed');
      const textarea = composerElement.querySelector('.post-composer-textarea');
      if (textarea) {
        textarea.setAttribute('rows', '1');
        textarea.style.height = 'auto';
        textarea.blur();
        composerFullPlaceholder = textarea.placeholder;
      }
    }

    /* Collapse when clicking outside — only if not in draft mode */
    document.addEventListener('click', function (event) {
      if (!event.target.closest('#post-composer')) {
        collapseComposer();
      }
    });

    /* Collapse on scroll — only if not in draft mode */
    let scrollCollapseTimer = null;
    window.addEventListener('scroll', function () {
      if (scrollCollapseTimer) clearTimeout(scrollCollapseTimer);
      scrollCollapseTimer = setTimeout(collapseComposer, 500);
    });

    /* Collapse on textarea blur — only if not in draft mode */
    const composerTextareaForBlur = composerElement.querySelector('.post-composer-textarea');
    if (composerTextareaForBlur) {
      composerTextareaForBlur.addEventListener('blur', function () {
        setTimeout(collapseComposer, 200);
      });
    }

    /* beforeunload warning handled below — single listener for both composer modes */
  }

  /* ---- Rotating placeholder ---- */

  const composerPlaceholders = [
    /* সুনির্দিষ্ট সমস্যা (Specific issues) */
    'আপনার এলাকায় কী ঘটছে?',
    'কীভাবে দুর্নীতি বন্ধ করা যাবে?',
    'সড়কে চাঁদাবাজি দেখেছেন? রিপোর্ট করুন',
    'বিদ্যুৎ নেই কতক্ষণ? জানান আমাদের',
    'পানির লাইনে সমস্যা? কোন এলাকায়?',
    'গ্যাসের চাপ কম? কোথায়?',
    'ভেজাল খাদ্য কিনেছেন? কোন দোকান?',
    'জমি দখল হচ্ছে? কার দ্বারা?',
    'নদী ভরাট হচ্ছে? কোন নদী?',
    'রাস্তা ভাঙা? কোন সড়ক?',
    'হাসপাতালে ঘুষ দিতে হয়েছে?',
    'স্কুলে শিক্ষক আসেন না? কোন স্কুল?',
    'পুলিশ স্টেশনে হয়রানি হয়েছে?',
    'ওষুধের দাম বেশি নিচ্ছে? কোন ফার্মেসি?',
    'মোবাইল কোর্টের অভিযান দেখেছেন?',
    'নারী নির্যাতনের ঘটনা জানান — পরিচয় গোপন থাকবে',
    'শিশুশ্রম দেখেছেন? কোথায়?',
    'যানজটে আটকে আছেন? কোন রুট?',
    'মূল্যবৃদ্ধি — চালের দাম কত আপনার এলাকায়?',
    'বন্যায় ক্ষতি হয়েছে? সাহায্য দরকার?',
    /* উৎসাহমূলক — প্রতিভা ও ভালো খবর (Encouraging — talent & good news) */
    'আপনার এলাকায় কে ক্রিকেট ভালো খেলে?',
    'আপনার এলাকার কে ভালো গান গায়?',
    'আপনার স্কুলের সেরা শিক্ষক কে?',
    'আপনার এলাকার গর্বের মানুষ কে?',
    'কোনো ভালো কাজ দেখেছেন? জানান সবাইকে',
    'আপনার এলাকায় কে অসহায়দের সাহায্য করছে?',
    'কোনো তরুণ উদ্যোক্তার গল্প জানেন?',
    'আপনার গ্রামের সুন্দর কোনো জায়গা আছে?',
    'কোনো ছাত্রের সাফল্যের খবর আছে?',
    'আপনার মহল্লায় কে ভালো রান্না করে?',
    /* এলাকার অবস্থা (Local conditions) */
    'আপনার এলাকায় চিকিৎসা ব্যবস্থা কেমন?',
    'আপনার এলাকায় যোগাযোগ ব্যবস্থা কেমন?',
    'আপনার এলাকায় পানির ব্যবস্থা কেমন?',
    'আপনার এলাকায় শিক্ষার মান কেমন?',
    'আপনার এলাকায় আইনশৃঙ্খলা পরিস্থিতি কেমন?',
    'আপনার এলাকায় ইন্টারনেট সেবা কেমন?',
    /* সাধারণ (General) */
    'কী ভাবছেন?',
    'আপনার মতামত জানান...',
    'আজকের খবর কী?',
    'আপনার কমিউনিটির ভালো খবর শেয়ার করুন',
    'কিছু শেয়ার করুন...',
    'বেকারত্ব নিয়ে আপনার অভিজ্ঞতা কী?',
    'স্থানীয় নেতাদের কাছে আপনার প্রশ্ন?',
    'আপনার এলাকার উন্নয়ন কেমন হচ্ছে?',
  ];

  const composerTextareaElement = document.getElementById('post-composer-textarea');
  if (composerTextareaElement) {
    // Set random fallback immediately (instant UI)
    const randomPlaceholderIndex = Math.floor(Math.random() * composerPlaceholders.length);
    composerTextareaElement.placeholder = composerPlaceholders[randomPlaceholderIndex];

    // Then fetch from API (may override with featured or DB-managed placeholder)
    fetch('/post/api/composer-placeholder/')
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (data.success && data.placeholder) {
          composerTextareaElement.placeholder = data.placeholder;
        }
      })
      .catch(function (composerPlaceholderError) { console.error('Composer placeholder fetch failed:', composerPlaceholderError); });
  }

  /* ---- Character counter ---- */

  const composerTextarea = document.getElementById('post-composer-textarea');
  const characterCountElement = document.getElementById('post-composer-character-count');
  const submitButton = document.getElementById('post-composer-submit-button');

  if (composerTextarea && characterCountElement && submitButton) {
    /* BanglaInput auto-attached by news-form-lang.js MutationObserver — no manual attach needed */

    /* ---- Draft auto-save to localStorage ---- */
    const draftStorageKey = 'post_composer_draft';
    let draftSaveTimer = null;
    const savedDraft = localStorage.getItem(draftStorageKey);
    if (savedDraft) {
      composerTextarea.value = savedDraft;
      composerTextarea.dispatchEvent(new Event('input'));
    }

    /* Auto-expand textarea — grows with content, always room to type */
    composerTextarea.style.overflow = 'hidden';

    composerTextarea.addEventListener('input', function () {
      composerTextarea.style.height = 'auto';
      composerTextarea.style.height = (composerTextarea.scrollHeight + 60) + 'px';

      const currentLength = composerTextarea.value.length;
      characterCountElement.textContent = currentLength + '/1000';

      /* Save draft (debounced — writes to localStorage after 500ms of inactivity) */
      if (draftSaveTimer) clearTimeout(draftSaveTimer);
      draftSaveTimer = setTimeout(function () {
        if (composerTextarea.value.length > 0) {
          localStorage.setItem(draftStorageKey, composerTextarea.value);
        } else {
          localStorage.removeItem(draftStorageKey);
        }
      }, 500);
      const isTextOnly = selectedMediaFiles.length === 0;
      const tooShortForTextOnly = isTextOnly && currentLength > 0 && currentLength < 150;
      submitButton.disabled = (currentLength === 0 && selectedMediaFiles.length === 0) || currentLength > 1000 || tooShortForTextOnly;

      if (currentLength > 900) {
        characterCountElement.style.color = '#dc2626';
      } else if (tooShortForTextOnly) {
        characterCountElement.style.color = '#f59e0b';
        characterCountElement.textContent = 'সর্বনিম্ন ১৫০ — ' + currentLength + '/1000';
        return;
      } else {
        characterCountElement.style.color = '';
      }
    });

    /* ---- Link preview in composer (debounced URL detection) ---- */
    const linkPreviewContainer = document.getElementById('post-composer-link-preview');
    let linkPreviewTimer = null;
    let linkPreviewCurrentUrl = '';

    composerTextarea.addEventListener('input', function () {
      if (!linkPreviewContainer) return;
      clearTimeout(linkPreviewTimer);
      linkPreviewTimer = setTimeout(function () {
        const textValue = composerTextarea.value || '';
        const urlMatch = textValue.match(/https?:\/\/[^\s<>"']+/);
        const detectedUrl = urlMatch ? urlMatch[0] : '';

        if (!detectedUrl || detectedUrl === linkPreviewCurrentUrl) return;
        linkPreviewCurrentUrl = detectedUrl;

        fetch('/newsengine/api/link-preview/?url=' + encodeURIComponent(detectedUrl))
          .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
          .then(function (data) {
            if (!data.success || (!data.title && !data.description)) {
              linkPreviewContainer.style.display = 'none';
              return;
            }
            let previewHtml = '<div class="post-composer-link-preview-card">';
            if (data.image) previewHtml += '<img src="' + escapeHtml(data.image) + '" alt="" class="post-composer-link-preview-image" onerror="this.hidden=true">';
            previewHtml += '<div class="post-composer-link-preview-info">';
            if (data.title) previewHtml += '<div class="post-composer-link-preview-title">' + escapeHtml(data.title) + '</div>';
            if (data.description) previewHtml += '<div class="post-composer-link-preview-description">' + escapeHtml(data.description) + '</div>';
            previewHtml += '<div class="post-composer-link-preview-domain">' + escapeHtml(detectedUrl.replace(/^https?:\/\//, '').split('/')[0]) + '</div>';
            previewHtml += '</div>';
            previewHtml += '<button type="button" class="post-composer-link-preview-dismiss" id="post-composer-link-preview-dismiss" name="post_composer_link_preview_dismiss" title="বাতিল">✕</button>';
            previewHtml += '</div>';
            linkPreviewContainer.innerHTML = previewHtml;
            linkPreviewContainer.style.display = 'block';

            document.getElementById('post-composer-link-preview-dismiss').addEventListener('click', function () {
              linkPreviewContainer.style.display = 'none';
              linkPreviewContainer.innerHTML = '';
              linkPreviewCurrentUrl = '__dismissed__';
            });
          })
          .catch(function () { /* URL fetch failed — no preview */ });
      }, 800);
    });
  }

  /* ---- @Mention autocomplete in composer ---- */
  (function () {
    if (!composerTextarea) return;
    let mentionDropdown = null;
    let mentionTimer = null;

    composerTextarea.addEventListener('input', function () {
      clearTimeout(mentionTimer);
      let cursorPosition = composerTextarea.selectionStart;
      const textBeforeCursor = composerTextarea.value.substring(0, cursorPosition);
      const mentionMatch = textBeforeCursor.match(/@([\w.-]*)$/);

      if (!mentionMatch || mentionMatch[1].length < 1) {
        if (mentionDropdown) mentionDropdown.style.display = 'none';
        return;
      }

      const mentionQuery = mentionMatch[1];
      mentionTimer = setTimeout(function () {
        fetch('/post/api/mentions/autocomplete/?q=' + encodeURIComponent(mentionQuery))
          .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
          .then(function (data) {
            if (!data.success || !data.users || data.users.length === 0) {
              if (mentionDropdown) mentionDropdown.style.display = 'none';
              return;
            }
            if (!mentionDropdown) {
              mentionDropdown = document.createElement('div');
              mentionDropdown.className = 'post-composer-mention-dropdown';
              mentionDropdown.id = 'post-composer-mention-dropdown';
              composerTextarea.parentNode.style.position = 'relative';
              composerTextarea.parentNode.appendChild(mentionDropdown);
            }
            mentionDropdown.innerHTML = data.users.map(function (user) {
              const avatarHtml = user.avatar_url
                ? '<img src="' + escapeHtml(user.avatar_url) + '" alt="" class="post-composer-mention-avatar">'
                : '<span class="post-composer-mention-avatar-initials">' + escapeHtml((user.display_name || user.handle).charAt(0)) + '</span>';
              return '<div class="post-composer-mention-item" data-handle="' + escapeHtml(user.handle) + '">'
                + avatarHtml
                + '<div class="post-composer-mention-info">'
                + '<span class="post-composer-mention-name">' + escapeHtml(user.display_name || '') + '</span>'
                + '<span class="post-composer-mention-handle">@' + escapeHtml(user.handle) + '</span>'
                + '</div></div>';
            }).join('');
            mentionDropdown.style.display = 'block';

            mentionDropdown.querySelectorAll('.post-composer-mention-item').forEach(function (item) {
              item.addEventListener('mousedown', function (mouseDownEvent) {
                mouseDownEvent.preventDefault();
                const selectedHandle = item.getAttribute('data-handle');
                const beforeMention = textBeforeCursor.substring(0, textBeforeCursor.lastIndexOf('@'));
                const afterCursor = composerTextarea.value.substring(cursorPosition);
                composerTextarea.value = beforeMention + '@' + selectedHandle + ' ' + afterCursor;
                const newPosition = beforeMention.length + selectedHandle.length + 2;
                composerTextarea.setSelectionRange(newPosition, newPosition);
                composerTextarea.focus();
                mentionDropdown.style.display = 'none';
                composerTextarea.dispatchEvent(new Event('input'));
              });
            });
          })
          .catch(function () { if (mentionDropdown) mentionDropdown.style.display = 'none'; });
      }, 300);
    });

    composerTextarea.addEventListener('blur', function () {
      setTimeout(function () { if (mentionDropdown) mentionDropdown.style.display = 'none'; }, 200);
    });
  })();

  /* ---- Emoji picker ---- */

  const emojiCategories = {
    smileys: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮','😯','😲','😳','🥺','😢','😭','😤','😠','😡','🤬','😈','💀','💩','🤡','👻','👽','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
    gestures: ['👍','👎','👊','✊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💪','🦾','🖕','☝️','👆','👇','👈','👉','👋','🤚','🖐️','✋','🖖','🤟','🤘','🤙','👌','🤌','🤏','✌️','🤞','🫰','🫵','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤙'],
    hearts: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🫶','💑','💏','💋','🌹','🥀','💐','🌸','🌺','🌻','🌷'],
    objects: ['📰','🗞️','📸','📷','🎥','🎬','📺','📻','🎙️','🎤','🔔','📢','📣','🏆','🥇','🥈','🥉','⚽','🏏','🏀','🎾','🏐','🎯','🪁','🎮','🎰','🎲','♟️','🎭','🎨','🎪','🎟️','🎫','💰','💵','💸','🏦','📊','📈','📉','⚖️','🔒','🔓','🔑','🗝️','🛡️','⚔️','💣','🔫','💊','💉','🩺','🏥','🏫','🏢','🏗️'],
    nature: ['🌿','🍃','🌱','🌲','🌳','🌴','🌵','🌾','🌊','🌈','⭐','🌙','☀️','⛅','🌤️','🌧️','⛈️','🌩️','❄️','🔥','💧','🌍','🌏','🐦','🦅','🐟','🐬','🦋','🐝','🐞','🌸','🌺','🌻','🌹','🌷','🍀','🍁','🍂','🍃'],
    flags: ['🇧🇩','🇮🇳','🇵🇰','🇸🇦','🇦🇪','🇲🇾','🇬🇧','🇺🇸','🇨🇦','🇦🇺','🇯🇵','🇰🇷','🇨🇳','🇫🇷','🇩🇪','🇮🇹','🇪🇸','🇧🇷','🇹🇷','🇶🇦','🇰🇼','🇴🇲','🇧🇭','🇯🇴','🇱🇧','🇮🇶','🇪🇬','🏳️','🏴','🏁','🚩','🏳️‍🌈'],
  };

  const emojiPickerElement = document.getElementById('post-composer-emoji-picker');
  const emojiGridElement = document.getElementById('post-composer-emoji-grid');
  const emojiButton = document.getElementById('post-composer-emoji-button');

  function renderEmojiCategory(categoryName) {
    if (!emojiGridElement) return;
    const emojis = emojiCategories[categoryName] || [];
    emojiGridElement.innerHTML = '';
    for (let emojiIndex = 0; emojiIndex < emojis.length; emojiIndex++) {
      let emojiItem = document.createElement('button');
      emojiItem.type = 'button';
      emojiItem.className = 'post-composer-emoji-item';
      emojiItem.textContent = emojis[emojiIndex];
      emojiItem.setAttribute('data-emoji', emojis[emojiIndex]);
      emojiGridElement.appendChild(emojiItem);
    }
  }

  if (emojiButton && emojiPickerElement) {
    /* Toggle picker */
    emojiButton.addEventListener('click', function () {
      const isVisible = emojiPickerElement.style.display !== 'none';
      emojiPickerElement.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) renderEmojiCategory('smileys');
    });

    /* Tab switching */
    const emojiTabs = document.querySelectorAll('.post-composer-emoji-tab');
    for (let tabIndex = 0; tabIndex < emojiTabs.length; tabIndex++) {
      emojiTabs[tabIndex].addEventListener('click', function () {
        for (let removeIndex = 0; removeIndex < emojiTabs.length; removeIndex++) {
          emojiTabs[removeIndex].classList.remove('post-composer-emoji-tab-active');
        }
        this.classList.add('post-composer-emoji-tab-active');
        renderEmojiCategory(this.getAttribute('data-category'));
      });
    }

    /* Insert emoji into textarea */
    emojiGridElement.addEventListener('click', function (event) {
      const emojiItem = event.target.closest('.post-composer-emoji-item');
      if (!emojiItem || !composerTextarea) return;
      const emoji = emojiItem.getAttribute('data-emoji');
      const cursorPosition = composerTextarea.selectionStart;
      const textBefore = composerTextarea.value.substring(0, cursorPosition);
      const textAfter = composerTextarea.value.substring(composerTextarea.selectionEnd);
      composerTextarea.value = textBefore + emoji + textAfter;
      composerTextarea.selectionStart = composerTextarea.selectionEnd = cursorPosition + emoji.length;
      composerTextarea.focus();
      composerTextarea.dispatchEvent(new Event('input'));
    });
  }

  /* ---- Schedule toggle ---- */
  const scheduleButton = document.getElementById('post-composer-schedule-button');
  const scheduleInput = document.getElementById('post-composer-schedule-input');
  if (scheduleButton && scheduleInput) {
    scheduleButton.addEventListener('click', function () {
      scheduleInput.classList.toggle('post-composer-schedule-input-hidden');
      if (!scheduleInput.classList.contains('post-composer-schedule-input-hidden')) {
        scheduleInput.focus();
      }
    });
  }

  /* ---- Media preview ---- */

  const mediaInput = document.getElementById('post-composer-media-input');
  const mediaPreviewContainer = document.getElementById('post-composer-media-preview');
  let selectedMediaFiles = [];

  function handleMediaFileChange(fileInput) {
    const files = Array.from(fileInput.files);
    if (selectedMediaFiles.length + files.length > 4) {
      return;
    }
    selectedMediaFiles = selectedMediaFiles.concat(files).slice(0, 4);
    renderMediaPreviews();
    if (submitButton && selectedMediaFiles.length > 0) {
      submitButton.disabled = false;
    }
  }

  if (mediaInput && mediaPreviewContainer) {
    mediaInput.addEventListener('change', function () {
      handleMediaFileChange(mediaInput);
    });
  }

  /* Camera input — feeds into the same media pipeline */
  const cameraInput = document.getElementById('post-composer-camera-input');
  if (cameraInput && mediaPreviewContainer) {
    cameraInput.addEventListener('change', function () {
      handleMediaFileChange(cameraInput);
    });
  }

  /* ---- Paste image from clipboard (screenshot, copied image, browser right-click copy) ---- */

  if (composerTextarea) {
    composerTextarea.addEventListener('paste', function (pasteEvent) {
      const clipboardItems = (pasteEvent.clipboardData || {}).items;
      if (!clipboardItems) return;

      const pastedImageFiles = [];
      for (let itemIndex = 0; itemIndex < clipboardItems.length; itemIndex++) {
        const clipboardItem = clipboardItems[itemIndex];
        if (clipboardItem.type.indexOf('image') !== -1) {
          const pastedFile = clipboardItem.getAsFile();
          if (pastedFile) pastedImageFiles.push(pastedFile);
        }
      }

      if (pastedImageFiles.length === 0) return;

      /* Prevent the default paste (don't insert image data as text) */
      pasteEvent.preventDefault();

      if (selectedMediaFiles.length + pastedImageFiles.length > 4) {
        return;
      }
      selectedMediaFiles = selectedMediaFiles.concat(pastedImageFiles).slice(0, 4);
      renderMediaPreviews();

      if (submitButton && selectedMediaFiles.length > 0) {
        submitButton.disabled = false;
      }
    });
  }

  function renderMediaPreviews() {
    if (!mediaPreviewContainer) return;
    mediaPreviewContainer.innerHTML = '';
    for (let fileIndex = 0; fileIndex < selectedMediaFiles.length; fileIndex++) {
      const previewItem = document.createElement('div');
      previewItem.className = 'post-composer-media-preview-item';
      const currentFile = selectedMediaFiles[fileIndex];
      if (currentFile.type.startsWith('video/')) {
        const videoElement = document.createElement('video');
        videoElement.src = URL.createObjectURL(currentFile);
        videoElement.className = 'post-composer-media-preview-video';
        videoElement.muted = true;
        previewItem.appendChild(videoElement);
        const videoLabel = document.createElement('span');
        videoLabel.className = 'post-composer-media-preview-video-label';
        videoLabel.textContent = '▶ ভিডিও';
        previewItem.appendChild(videoLabel);
      } else {
        previewItem.style.backgroundImage = 'url(' + URL.createObjectURL(currentFile) + ')';
      }

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.id = 'post-composer-media-remove-' + fileIndex;
      removeButton.name = 'post_composer_media_remove_' + fileIndex;
      removeButton.className = 'post-composer-media-preview-remove';
      removeButton.textContent = '✕';
      removeButton.setAttribute('data-file-index', fileIndex);
      removeButton.addEventListener('click', function () {
        const removeIndex = parseInt(this.getAttribute('data-file-index'), 10);
        selectedMediaFiles.splice(removeIndex, 1);
        renderMediaPreviews();
      });

      previewItem.appendChild(removeButton);

      /* Alt text input for images */
      if (currentFile.type.startsWith('image/')) {
        const altTextInput = document.createElement('input');
        altTextInput.type = 'text';
        altTextInput.className = 'post-composer-media-alt-text-input';
        altTextInput.id = 'post-composer-media-alt-text-' + fileIndex;
        altTextInput.name = 'post_composer_media_alt_text_' + fileIndex;
        altTextInput.placeholder = 'ALT';
        altTextInput.setAttribute('data-file-index', fileIndex);
        previewItem.appendChild(altTextInput);
      }

      mediaPreviewContainer.appendChild(previewItem);
    }
  }

  /* ---- Submit post ---- */

  if (submitButton) {
    submitButton.addEventListener('click', function () {
      const postText = (composerTextarea.value || '').trim();
      if (!postText && selectedMediaFiles.length === 0) return;

      submitButton.disabled = true;
      submitButton.textContent = 'পোস্ট হচ্ছে...';

      /* Build FormData (supports both text and files) */
      const formData = new FormData();
      formData.append('post_text', postText);
      const visibilitySelect = document.getElementById('post-composer-visibility-select');
      formData.append('visibility_code', visibilitySelect ? visibilitySelect.value : 'public');
      const scheduleInputValue = document.getElementById('post-composer-schedule-input');
      if (scheduleInputValue && scheduleInputValue.value) {
        formData.append('scheduled_publish_at', scheduleInputValue.value);
      }
      const altTexts = [];
      for (let uploadIndex = 0; uploadIndex < selectedMediaFiles.length; uploadIndex++) {
        formData.append('post_media_files', selectedMediaFiles[uploadIndex]);
        const altInput = document.getElementById('post-composer-media-alt-text-' + uploadIndex);
        altTexts.push(altInput ? altInput.value.trim() : '');
      }
      formData.append('alt_texts_json', JSON.stringify(altTexts));

      fetch('/post/api/create/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfTokenValue() },
        body: formData,
      })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        submitButton.disabled = false;
        submitButton.textContent = 'পোস্ট';

        if (data.success) {
          /* Clear composer */
          selectedMediaFiles = [];
          if (mediaPreviewContainer) mediaPreviewContainer.innerHTML = '';
          composerTextarea.value = '';
          characterCountElement.textContent = '0/1000';
          submitButton.disabled = true;
          localStorage.removeItem(draftStorageKey);

          const feedElement = document.getElementById('post-feed') || document.getElementById('pulse-feed');
          const emptyElement = document.getElementById('post-feed-empty') || document.getElementById('pulse-feed-empty');
          if (emptyElement) emptyElement.remove();

          /* Server-rendered post card HTML — single source of truth (post-card.html template) */
          const newPostHtml = data.post_card_html || '';
          if (!newPostHtml) { showPostComposerError('পোস্ট তৈরি হয়েছে কিন্তু প্রদর্শন করা যায়নি। পেইজ রিফ্রেশ করুন।'); return; }

          /* Insert with smooth fade-in animation */
          const tempContainer = document.createElement('div');
          tempContainer.innerHTML = newPostHtml;
          const newPostElement = tempContainer.firstElementChild;
          newPostElement.style.opacity = '0';
          newPostElement.style.transform = 'translateY(-10px)';
          newPostElement.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
          feedElement.insertBefore(newPostElement, feedElement.firstChild);
          /* Trigger animation */
          requestAnimationFrame(function () {
            newPostElement.style.opacity = '1';
            newPostElement.style.transform = 'translateY(0)';
          });

          /* Force collapse composer after successful post */
          submitButton.blur();
          composerTextarea.blur();
          composerElement.classList.add('post-composer-collapsed');
          composerTextarea.setAttribute('rows', '1');
          composerTextarea.style.height = 'auto';
        } else {
          showPostComposerError(data.error || 'পোস্ট করা যায়নি');
        }
      })
      .catch(function (networkError) {
        submitButton.disabled = false;
        submitButton.textContent = 'পোস্ট';
        showPostComposerError('নেটওয়ার্ক ত্রুটি (Network error)');
      });
    });
  }

  /* ---- Warn before leaving with unsaved draft ---- */

  let postComposerUserConfirmedLeave = false;
  window.addEventListener('beforeunload', function (event) {
    if (composerTextarea && composerTextarea.value.trim().length > 0) {
      postComposerUserConfirmedLeave = true;
      event.preventDefault();
      event.returnValue = '';
    }
  });
  /* Clear draft when user confirms "Leave" — pagehide fires after beforeunload */
  window.addEventListener('pagehide', function () {
    if (postComposerUserConfirmedLeave) {
      try { localStorage.removeItem('post_composer_draft'); } catch (storageError) {}
    }
  });

  /* Feed interactions (like, bookmark, share, view, repost, reply, delete)
     are now in post-feed-interactions.js — shared between post and pulse pages. */

  /* escapeHtmlText is shared — defined in post-feed-interactions.js, exposed on window */
  const escapeHtmlText = window.escapeHtmlText || function (text) { return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

  function showPostComposerError(errorText) {
    const composerElement = document.getElementById('post-composer');
    if (!composerElement) return;
    const existingError = composerElement.querySelector('.post-composer-error-message');
    if (existingError) existingError.remove();
    const errorElement = document.createElement('div');
    errorElement.className = 'post-composer-error-message';
    errorElement.textContent = errorText;
    composerElement.appendChild(errorElement);
    setTimeout(function () { if (errorElement.parentNode) errorElement.remove(); }, 5000);
  }
})();
