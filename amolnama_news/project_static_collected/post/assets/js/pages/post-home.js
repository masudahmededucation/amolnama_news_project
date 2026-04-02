/* post-home.js — Post creation, like, bookmark, share interactions */
(function () {
  'use strict';

  function getCsrfTokenValue() {
    var cookieMatch = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
  }

  /* ---- Composer expand/collapse ---- */

  var composerElement = document.getElementById('post-composer');
  if (composerElement) {
    var composerFullPlaceholder = '';

    /* Expand on click/focus anywhere inside the composer */
    composerElement.addEventListener('click', function () {
      composerElement.classList.remove('post-composer-collapsed');
      var textarea = composerElement.querySelector('.post-composer-textarea');
      if (textarea) {
        textarea.setAttribute('rows', '3');
        if (composerFullPlaceholder) textarea.placeholder = composerFullPlaceholder;
      }
    });

    /* Collapse helper — always collapse when focus is away */
    function collapseComposer() {
      if (composerElement.classList.contains('post-composer-collapsed')) return;
      composerElement.classList.add('post-composer-collapsed');
      var textarea = composerElement.querySelector('.post-composer-textarea');
      if (textarea) {
        textarea.setAttribute('rows', '1');
        textarea.style.height = 'auto';
        textarea.blur();
        composerFullPlaceholder = textarea.placeholder;
      }
    }

    /* Collapse when clicking outside */
    document.addEventListener('click', function (event) {
      if (!event.target.closest('#post-composer')) {
        collapseComposer();
      }
    });

    /* Collapse on scroll (if user moves away without clicking) */
    var scrollCollapseTimer = null;
    window.addEventListener('scroll', function () {
      if (scrollCollapseTimer) clearTimeout(scrollCollapseTimer);
      scrollCollapseTimer = setTimeout(collapseComposer, 500);
    });

    /* Collapse on textarea blur */
    var composerTextareaForBlur = composerElement.querySelector('.post-composer-textarea');
    if (composerTextareaForBlur) {
      composerTextareaForBlur.addEventListener('blur', function () {
        setTimeout(collapseComposer, 200);
      });
    }
  }

  /* ---- Rotating placeholder ---- */

  var composerPlaceholders = [
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

  var composerTextareaElement = document.getElementById('post-composer-textarea');
  if (composerTextareaElement) {
    var randomPlaceholderIndex = Math.floor(Math.random() * composerPlaceholders.length);
    composerTextareaElement.placeholder = composerPlaceholders[randomPlaceholderIndex];
  }

  /* ---- Character counter ---- */

  var composerTextarea = document.getElementById('post-composer-textarea');
  var characterCountElement = document.getElementById('post-composer-character-count');
  var submitButton = document.getElementById('post-composer-submit-button');

  if (composerTextarea && characterCountElement && submitButton) {
    /* BanglaInput auto-attached by news-form-lang.js MutationObserver — no manual attach needed */

    /* ---- Draft auto-save to localStorage ---- */
    var draftStorageKey = 'post_composer_draft';
    var draftSaveTimer = null;
    var savedDraft = localStorage.getItem(draftStorageKey);
    if (savedDraft) {
      composerTextarea.value = savedDraft;
      composerTextarea.dispatchEvent(new Event('input'));
    }

    /* Auto-expand textarea up to 10 lines, then scroll */
    var composerLineHeight = parseFloat(getComputedStyle(composerTextarea).lineHeight) || 24;
    var composerMaxHeight = composerLineHeight * 10;
    composerTextarea.style.overflow = 'hidden';

    composerTextarea.addEventListener('input', function () {
      composerTextarea.style.height = 'auto';
      var scrollHeight = composerTextarea.scrollHeight;
      if (scrollHeight <= composerMaxHeight) {
        composerTextarea.style.height = scrollHeight + 'px';
        composerTextarea.style.overflow = 'hidden';
      } else {
        composerTextarea.style.height = composerMaxHeight + 'px';
        composerTextarea.style.overflow = 'auto';
      }

      var currentLength = composerTextarea.value.length;
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
      var isTextOnly = selectedMediaFiles.length === 0;
      var tooShortForTextOnly = isTextOnly && currentLength > 0 && currentLength < 150;
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
  }

  /* ---- Emoji picker ---- */

  var emojiCategories = {
    smileys: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮','😯','😲','😳','🥺','😢','😭','😤','😠','😡','🤬','😈','💀','💩','🤡','👻','👽','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
    gestures: ['👍','👎','👊','✊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💪','🦾','🖕','☝️','👆','👇','👈','👉','👋','🤚','🖐️','✋','🖖','🤟','🤘','🤙','👌','🤌','🤏','✌️','🤞','🫰','🫵','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤙'],
    hearts: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🫶','💑','💏','💋','🌹','🥀','💐','🌸','🌺','🌻','🌷'],
    objects: ['📰','🗞️','📸','📷','🎥','🎬','📺','📻','🎙️','🎤','🔔','📢','📣','🏆','🥇','🥈','🥉','⚽','🏏','🏀','🎾','🏐','🎯','🪁','🎮','🎰','🎲','♟️','🎭','🎨','🎪','🎟️','🎫','💰','💵','💸','🏦','📊','📈','📉','⚖️','🔒','🔓','🔑','🗝️','🛡️','⚔️','💣','🔫','💊','💉','🩺','🏥','🏫','🏢','🏗️'],
    nature: ['🌿','🍃','🌱','🌲','🌳','🌴','🌵','🌾','🌊','🌈','⭐','🌙','☀️','⛅','🌤️','🌧️','⛈️','🌩️','❄️','🔥','💧','🌍','🌏','🐦','🦅','🐟','🐬','🦋','🐝','🐞','🌸','🌺','🌻','🌹','🌷','🍀','🍁','🍂','🍃'],
    flags: ['🇧🇩','🇮🇳','🇵🇰','🇸🇦','🇦🇪','🇲🇾','🇬🇧','🇺🇸','🇨🇦','🇦🇺','🇯🇵','🇰🇷','🇨🇳','🇫🇷','🇩🇪','🇮🇹','🇪🇸','🇧🇷','🇹🇷','🇶🇦','🇰🇼','🇴🇲','🇧🇭','🇯🇴','🇱🇧','🇮🇶','🇪🇬','🏳️','🏴','🏁','🚩','🏳️‍🌈'],
  };

  var emojiPickerElement = document.getElementById('post-composer-emoji-picker');
  var emojiGridElement = document.getElementById('post-composer-emoji-grid');
  var emojiButton = document.getElementById('post-composer-emoji-button');

  function renderEmojiCategory(categoryName) {
    if (!emojiGridElement) return;
    var emojis = emojiCategories[categoryName] || [];
    emojiGridElement.innerHTML = '';
    for (var emojiIndex = 0; emojiIndex < emojis.length; emojiIndex++) {
      var emojiItem = document.createElement('button');
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
      var isVisible = emojiPickerElement.style.display !== 'none';
      emojiPickerElement.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) renderEmojiCategory('smileys');
    });

    /* Tab switching */
    var emojiTabs = document.querySelectorAll('.post-composer-emoji-tab');
    for (var tabIndex = 0; tabIndex < emojiTabs.length; tabIndex++) {
      emojiTabs[tabIndex].addEventListener('click', function () {
        for (var removeIndex = 0; removeIndex < emojiTabs.length; removeIndex++) {
          emojiTabs[removeIndex].classList.remove('post-composer-emoji-tab-active');
        }
        this.classList.add('post-composer-emoji-tab-active');
        renderEmojiCategory(this.getAttribute('data-category'));
      });
    }

    /* Insert emoji into textarea */
    emojiGridElement.addEventListener('click', function (event) {
      var emojiItem = event.target.closest('.post-composer-emoji-item');
      if (!emojiItem || !composerTextarea) return;
      var emoji = emojiItem.getAttribute('data-emoji');
      var cursorPosition = composerTextarea.selectionStart;
      var textBefore = composerTextarea.value.substring(0, cursorPosition);
      var textAfter = composerTextarea.value.substring(composerTextarea.selectionEnd);
      composerTextarea.value = textBefore + emoji + textAfter;
      composerTextarea.selectionStart = composerTextarea.selectionEnd = cursorPosition + emoji.length;
      composerTextarea.focus();
      composerTextarea.dispatchEvent(new Event('input'));
    });
  }

  /* ---- Media preview ---- */

  var mediaInput = document.getElementById('post-composer-media-input');
  var mediaPreviewContainer = document.getElementById('post-composer-media-preview');
  var selectedMediaFiles = [];

  if (mediaInput && mediaPreviewContainer) {
    mediaInput.addEventListener('change', function () {
      var files = Array.from(mediaInput.files);
      if (selectedMediaFiles.length + files.length > 4) {
        return;
      }
      selectedMediaFiles = selectedMediaFiles.concat(files).slice(0, 4);
      renderMediaPreviews();
      /* Enable submit when media is selected */
      if (submitButton && selectedMediaFiles.length > 0) {
        submitButton.disabled = false;
      }
    });
  }

  /* ---- Paste image from clipboard (screenshot, copied image, browser right-click copy) ---- */

  if (composerTextarea) {
    composerTextarea.addEventListener('paste', function (pasteEvent) {
      var clipboardItems = (pasteEvent.clipboardData || {}).items;
      if (!clipboardItems) return;

      var pastedImageFiles = [];
      for (var itemIndex = 0; itemIndex < clipboardItems.length; itemIndex++) {
        var clipboardItem = clipboardItems[itemIndex];
        if (clipboardItem.type.indexOf('image') !== -1) {
          var pastedFile = clipboardItem.getAsFile();
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
    for (var fileIndex = 0; fileIndex < selectedMediaFiles.length; fileIndex++) {
      var previewItem = document.createElement('div');
      previewItem.className = 'post-composer-media-preview-item';
      var currentFile = selectedMediaFiles[fileIndex];
      if (currentFile.type.startsWith('video/')) {
        var videoElement = document.createElement('video');
        videoElement.src = URL.createObjectURL(currentFile);
        videoElement.className = 'post-composer-media-preview-video';
        videoElement.muted = true;
        previewItem.appendChild(videoElement);
        var videoLabel = document.createElement('span');
        videoLabel.className = 'post-composer-media-preview-video-label';
        videoLabel.textContent = '▶ ভিডিও';
        previewItem.appendChild(videoLabel);
      } else {
        previewItem.style.backgroundImage = 'url(' + URL.createObjectURL(currentFile) + ')';
      }

      var removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.id = 'post-composer-media-remove-' + fileIndex;
      removeButton.name = 'post_composer_media_remove_' + fileIndex;
      removeButton.className = 'post-composer-media-preview-remove';
      removeButton.textContent = '✕';
      removeButton.setAttribute('data-file-index', fileIndex);
      removeButton.addEventListener('click', function () {
        var removeIndex = parseInt(this.getAttribute('data-file-index'), 10);
        selectedMediaFiles.splice(removeIndex, 1);
        renderMediaPreviews();
      });

      previewItem.appendChild(removeButton);
      mediaPreviewContainer.appendChild(previewItem);
    }
  }

  /* ---- Submit post ---- */

  if (submitButton) {
    submitButton.addEventListener('click', function () {
      var postText = (composerTextarea.value || '').trim();
      if (!postText && selectedMediaFiles.length === 0) return;

      submitButton.disabled = true;
      submitButton.textContent = 'পোস্ট হচ্ছে...';

      /* Build FormData (supports both text and files) */
      var formData = new FormData();
      formData.append('post_text_bn', postText);
      var visibilitySelect = document.getElementById('post-composer-visibility-select');
      formData.append('visibility_code', visibilitySelect ? visibilitySelect.value : 'public');
      for (var uploadIndex = 0; uploadIndex < selectedMediaFiles.length; uploadIndex++) {
        formData.append('post_media_files', selectedMediaFiles[uploadIndex]);
      }

      fetch('/post/api/create/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfTokenValue() },
        body: formData,
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        submitButton.disabled = false;
        submitButton.textContent = 'পোস্ট';

        if (data.success) {
          var feedElement = document.getElementById('post-feed');
          var emptyElement = document.getElementById('post-feed-empty');
          if (emptyElement) emptyElement.remove();

          /* Build avatar HTML */
          var avatarHtml = '';
          if (data.author_avatar_url) {
            avatarHtml = '<img src="' + data.author_avatar_url + '" alt="' + escapeHtmlText(data.author_display_name || '') + '" class="post-card-avatar-image">';
          } else if (data.author_display_name) {
            avatarHtml = '<span class="post-card-avatar-initials">' + escapeHtmlText(data.author_display_name).charAt(0) + '</span>';
          } else {
            avatarHtml = '<svg class="post-card-avatar-default" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>';
          }

          /* Build media grid HTML */
          var mediaHtml = '';
          if (data.media_urls && data.media_urls.length > 0) {
            mediaHtml = '<div class="post-card-media-grid post-card-media-grid-' + data.media_urls.length + '" id="post-card-media-' + data.post_post_id + '">';
            if (data.media_urls.length === 1) {
              mediaHtml += '<div class="post-card-media-item post-card-media-item-single" data-photo-url="' + data.media_urls[0] + '">'
                + '<img src="' + data.media_urls[0] + '" alt="" class="post-card-media-image-full">'
                + '</div>';
            } else {
              for (var mediaIndex = 0; mediaIndex < data.media_urls.length; mediaIndex++) {
                mediaHtml += '<div class="post-card-media-item" style="background-image:url(\'' + data.media_urls[mediaIndex] + '\');" data-photo-url="' + data.media_urls[mediaIndex] + '"></div>';
              }
            }
            mediaHtml += '</div>';
          }

          var shareIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.1rem;height:1.1rem;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

          var newPostHtml = '<article class="post-card" id="post-card-' + data.post_post_id + '" data-post-id="' + data.post_post_id + '">'
            + '<div class="post-card-avatar">' + avatarHtml + '</div>'
            + '<div class="post-card-content">'
            + '<div class="post-card-header">'
            + '<div class="post-card-header-left"><span class="post-card-author-name">' + escapeHtmlText(data.author_display_name || 'ব্যবহারকারী') + '</span><span class="post-card-timestamp">এইমাত্র</span></div>'
            + '<div class="post-card-header-right">'
            + '<span class="post-card-header-view-count" id="post-card-header-views-' + data.post_post_id + '">👁️ 0</span>'
            + '<div class="post-card-more-menu-wrapper">'
            + '<button type="button" class="post-card-more-menu-button" id="post-card-more-menu-' + data.post_post_id + '" name="post_card_more_menu_' + data.post_post_id + '" data-post-id="' + data.post_post_id + '" title="আরও (More)">⋯</button>'
            + '<div class="post-card-more-menu-dropdown" id="post-card-more-dropdown-' + data.post_post_id + '">'
            + '<button type="button" class="post-card-more-menu-item post-card-follow-post-button" id="post-card-follow-post-' + data.post_post_id + '" name="post_card_follow_post_' + data.post_post_id + '" data-post-id="' + data.post_post_id + '">🔔 Follow Post</button>'
            + '<button type="button" class="post-card-more-menu-item post-card-edit-button" id="post-card-edit-' + data.post_post_id + '" name="post_card_edit_' + data.post_post_id + '" data-post-id="' + data.post_post_id + '" data-post-text="' + escapeHtmlText(postText) + '">✎ Edit</button>'
            + '<button type="button" class="post-card-more-menu-item post-card-delete-button" id="post-card-delete-' + data.post_post_id + '" name="post_card_delete_' + data.post_post_id + '" data-post-id="' + data.post_post_id + '">🗑️ Delete</button>'
            + '</div></div></div></div>'
            + (postText ? '<div class="post-card-text">' + escapeHtmlText(postText) + '</div>' : '')
            + mediaHtml
            + '<div class="post-card-actions">'
            + '<button type="button" class="post-card-action-button post-card-vote-button" id="post-card-vote-' + data.post_post_id + '" name="post_card_vote_' + data.post_post_id + '" data-post-id="' + data.post_post_id + '" title="This is useful &amp; shows research effort"><span class="post-card-action-icon post-card-vote-icon"><svg viewBox="0 0 24 24" class="post-card-vote-svg post-card-vote-svg-empty"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg></span><span class="post-card-action-count post-card-vote-count">0</span><span class="post-card-action-label">Upvote</span></button>'
            + '<button type="button" class="post-card-action-button post-card-reply-button" id="post-card-reply-' + data.post_post_id + '" name="post_card_reply_' + data.post_post_id + '" data-post-id="' + data.post_post_id + '" title="Suggest an improvement or add info"><span class="post-card-action-icon">💬</span><span class="post-card-action-count post-card-reply-count">0</span><span class="post-card-action-label">Suggest</span></button>'
            + '<button type="button" class="post-card-action-button post-card-repost-button" id="post-card-repost-' + data.post_post_id + '" name="post_card_repost_' + data.post_post_id + '" data-post-id="' + data.post_post_id + '" title="Repost"><span class="post-card-action-icon">🔄</span><span class="post-card-action-count post-card-repost-count">0</span><span class="post-card-action-label">Repost</span></button>'
            + '<button type="button" class="post-card-action-button post-card-bookmark-button" id="post-card-bookmark-' + data.post_post_id + '" name="post_card_bookmark_' + data.post_post_id + '" data-post-id="' + data.post_post_id + '" title="সংরক্ষণ"><span class="post-card-action-icon post-card-bookmark-icon"><svg viewBox="0 0 24 24" class="post-card-heart-svg post-card-heart-svg-empty"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></span><span class="post-card-action-label">সংরক্ষণ</span></button>'
            + '<div class="post-card-share-menu-wrapper">'
            + '<button type="button" class="post-card-action-button post-card-share-menu-toggle" id="post-card-share-toggle-' + data.post_post_id + '" name="post_card_share_toggle_' + data.post_post_id + '" data-post-id="' + data.post_post_id + '" title="শেয়ার"><span class="post-card-action-icon">' + shareIconSvg + '</span><span class="post-card-action-label">শেয়ার</span></button>'
            + '<div class="post-card-share-menu-dropdown" id="post-card-share-dropdown-' + data.post_post_id + '">'
            + '<button type="button" class="post-card-share-menu-item post-card-share-button" id="post-card-share-' + data.post_post_id + '" name="post_card_share_' + data.post_post_id + '" data-post-id="' + data.post_post_id + '"><svg class="post-card-share-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Copy Link</button>'
            + '<button type="button" class="post-card-share-menu-item post-card-embed-button" id="post-card-embed-' + data.post_post_id + '" name="post_card_embed_' + data.post_post_id + '" data-post-id="' + data.post_post_id + '"><svg class="post-card-share-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> এম্বেড (Embed)</button>'
            + '<a href="https://wa.me/?text=' + encodeURIComponent((postText ? postText.substring(0, 150) + '\n\n' : '') + window.location.origin + '/post/' + data.post_post_id + '/') + '" target="_blank" rel="noopener" class="post-card-share-menu-item"><svg class="post-card-share-menu-icon" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> WhatsApp</a>'
            + '<a href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(window.location.origin + '/post/' + data.post_post_id + '/') + '" target="_blank" rel="noopener" class="post-card-share-menu-item"><svg class="post-card-share-menu-icon" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> Facebook</a>'
            + '<a href="https://twitter.com/intent/tweet?url=' + encodeURIComponent(window.location.origin + '/post/' + data.post_post_id + '/') + '" target="_blank" rel="noopener" class="post-card-share-menu-item"><svg class="post-card-share-menu-icon" viewBox="0 0 24 24" fill="#000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> X (Twitter)</a>'
            + '<button type="button" class="post-card-share-menu-item post-card-native-share-button" id="post-card-native-share-' + data.post_post_id + '" name="post_card_native_share_' + data.post_post_id + '" data-post-id="' + data.post_post_id + '"><svg class="post-card-share-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> More Share Options</button>'
            + '</div></div>'
            + '</div></div></article>';

          feedElement.insertAdjacentHTML('afterbegin', newPostHtml);
          composerTextarea.value = '';
          characterCountElement.textContent = '0/1000';
          submitButton.disabled = true;
          selectedMediaFiles = [];
          if (mediaPreviewContainer) mediaPreviewContainer.innerHTML = '';
          localStorage.removeItem(draftStorageKey);
        } else {
          showPostComposerError(data.error || 'পোস্ট করা যায়নি');
        }
      })
      .catch(function (networkError) {
        console.error('Post creation failed:', networkError);
        submitButton.disabled = false;
        submitButton.textContent = 'পোস্ট';
        showPostComposerError('নেটওয়ার্ক ত্রুটি (Network error)');
      });
    });
  }

  /* ---- Warn before leaving with unsaved draft ---- */

  window.addEventListener('beforeunload', function (event) {
    if (composerTextarea && composerTextarea.value.trim().length > 0) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  /* Feed interactions (like, bookmark, share, view, repost, reply, delete)
     are now in post-feed-interactions.js — shared between post and pulse pages. */

  /* escapeHtmlText is shared — defined in post-feed-interactions.js, exposed on window */
  var escapeHtmlText = window.escapeHtmlText || function (text) { return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

  function showPostComposerError(errorText) {
    var composerElement = document.getElementById('post-composer');
    if (!composerElement) return;
    var existingError = composerElement.querySelector('.post-composer-error-message');
    if (existingError) existingError.remove();
    var errorElement = document.createElement('div');
    errorElement.className = 'post-composer-error-message';
    errorElement.textContent = errorText;
    composerElement.appendChild(errorElement);
    setTimeout(function () { if (errorElement.parentNode) errorElement.remove(); }, 5000);
  }
})();
