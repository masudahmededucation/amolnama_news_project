/* messenger-home.js — WhatsApp-style chat with polling */
(function () {
  'use strict';

  var messengerElement = document.getElementById('messenger');
  if (!messengerElement) return;

  var sidebar = document.getElementById('messenger-sidebar');
  var conversationListContainer = document.getElementById('messenger-conversation-list');
  var chatEmpty = document.getElementById('messenger-chat-empty');
  var chatHeader = document.getElementById('messenger-chat-header');
  var messagesContainer = document.getElementById('messenger-messages');
  var inputArea = document.getElementById('messenger-input-area');
  var textarea = document.getElementById('messenger-input-textarea');
  var sendButton = document.getElementById('messenger-send-button');
  var backButton = document.getElementById('messenger-chat-back-button');
  var scrollBottomButton = document.getElementById('messenger-scroll-bottom-button');
  var scrollBottomBadge = document.getElementById('messenger-scroll-bottom-badge');
  var headerName = document.getElementById('messenger-chat-header-name');
  var headerStatus = document.getElementById('messenger-chat-header-status');
  var headerAvatar = document.getElementById('messenger-chat-header-avatar');

  var activeConversationId = null;
  var lastMessageId = 0;
  var messagePollTimer = null;
  var conversationPollTimer = null;
  var replyToMessageId = null;
  var replyPreview = document.getElementById('messenger-reply-preview');
  var replyPreviewContent = document.getElementById('messenger-reply-preview-content');
  var replyPreviewClose = document.getElementById('messenger-reply-preview-close');
  var typingTimer = null;
  var newMessageCount = 0;
  var messageTextMap = {};
  var otherUserName = '';
  var otherUserAvatar = '';


  var dayNames = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

  function formatTime(isoString) {
    if (!isoString) return '';
    var date = new Date(isoString);
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    var time = hours + ':' + (minutes < 10 ? '0' : '') + minutes + ' ' + ampm;
    var dd = ('0' + date.getDate()).slice(-2);
    var mm = ('0' + (date.getMonth() + 1)).slice(-2);
    var yyyy = date.getFullYear();
    var dayName = dayNames[date.getDay()];
    return dd + '/' + mm + '/' + yyyy + ' ' + dayName + ' ' + time;
  }

  function formatDateSeparator(isoString) {
    if (!isoString) return '';
    var date = new Date(isoString);

    var dd = ('0' + date.getDate()).slice(-2);
    var mm = ('0' + (date.getMonth() + 1)).slice(-2);
    var yyyy = date.getFullYear();
    var dayName = dayNames[date.getDay()];
    return dd + '/' + mm + '/' + yyyy + ' ' + dayName;
  }

  function checkmarkHtml(status) {
    if (status === 'read') {
      return '<span class="messenger-bubble-check messenger-bubble-check-read"><svg viewBox="0 0 16 11"><path d="M11.07.66L4.88 6.85 2.72 4.69 1.3 6.1l3.58 3.58 7.6-7.6z" fill="currentColor"/><path d="M7.07.66L.88 6.85l1.42 1.42L8.48 2.08z" fill="currentColor"/></svg></span>';
    }
    if (status === 'delivered') {
      return '<span class="messenger-bubble-check messenger-bubble-check-delivered"><svg viewBox="0 0 16 11"><path d="M11.07.66L4.88 6.85 2.72 4.69 1.3 6.1l3.58 3.58 7.6-7.6z" fill="currentColor"/><path d="M7.07.66L.88 6.85l1.42 1.42L8.48 2.08z" fill="currentColor"/></svg></span>';
    }
    return '<span class="messenger-bubble-check messenger-bubble-check-sent"><svg viewBox="0 0 12 11"><path d="M11.07.66L4.88 6.85 2.72 4.69 1.3 6.1l3.58 3.58 7.6-7.6z" fill="currentColor"/></svg></span>';
  }

  // =========================================================
  // CONVERSATION LIST
  // =========================================================

  function loadConversationList() {
    fetch('/messenger/api/conversations/')
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.success || !data.conversations.length) {
          conversationListContainer.innerHTML = '<div class="messenger-conversation-list-loading">কোনো কথোপকথন নেই</div>';
          return;
        }
        renderConversationList(data.conversations);
      })
      .catch(function () {
        conversationListContainer.innerHTML = '<div class="messenger-conversation-list-loading">লোড ব্যর্থ হয়েছে</div>';
      });
  }

  function renderConversationList(conversations) {
    var html = '';
    conversations.forEach(function (conversation) {
      var isActive = conversation.conversation_id === activeConversationId;
      var initial = (conversation.title || '?').charAt(0);

      html += '<div class="messenger-conversation-item' + (isActive ? ' messenger-conversation-item-active' : '') + '" data-conversation-id="' + conversation.conversation_id + '" data-title="' + escapeHtml(conversation.title) + '" data-avatar="' + escapeHtml(conversation.avatar_url) + '" data-other-user-profile-id="' + (conversation.other_user_profile_id || '') + '">';

      if (conversation.avatar_url) {
        html += '<img class="messenger-conversation-item-avatar" src="' + escapeHtml(conversation.avatar_url) + '" alt="">';
      } else {
        html += '<div class="messenger-conversation-item-avatar-default">' + escapeHtml(initial) + '</div>';
      }

      html += '<div class="messenger-conversation-item-info">';
      html += '<div class="messenger-conversation-item-top-row">';
      html += '<span class="messenger-conversation-item-name">' + escapeHtml(conversation.title) + '</span>';
      html += '<span class="messenger-conversation-item-time">' + formatTime(conversation.last_message_at) + '</span>';
      html += '</div>';
      html += '<div class="messenger-conversation-item-bottom-row">';
      html += '<span class="messenger-conversation-item-last-message">' + escapeHtml(conversation.last_message_text) + '</span>';
      if (conversation.unread_count > 0) {
        html += '<span class="messenger-conversation-item-unread-badge">' + conversation.unread_count + '</span>';
      }
      html += '</div>';
      html += '</div>';
      html += '</div>';
    });
    conversationListContainer.innerHTML = html;
  }

  // Conversation item click
  conversationListContainer.addEventListener('click', function (event) {
    var item = event.target.closest('.messenger-conversation-item');
    if (!item) return;
    var conversationId = parseInt(item.getAttribute('data-conversation-id'), 10);
    var title = item.getAttribute('data-title');
    var avatarUrl = item.getAttribute('data-avatar');
    openConversation(conversationId, title, avatarUrl);
  });

  // Conversation search filter (client-side)
  var sidebarSearchInput = document.getElementById('messenger-sidebar-search-input');
  if (sidebarSearchInput) {
    sidebarSearchInput.addEventListener('input', function () {
      var query = sidebarSearchInput.value.trim().toLowerCase();
      var items = conversationListContainer.querySelectorAll('.messenger-conversation-item');
      items.forEach(function (item) {
        var name = (item.getAttribute('data-title') || '').toLowerCase();
        item.style.display = name.indexOf(query) !== -1 ? '' : 'none';
      });
    });
  }

  // =========================================================
  // OPEN CONVERSATION
  // =========================================================

  function openConversation(conversationId, title, avatarUrl) {
    activeConversationId = conversationId;
    lastMessageId = 0;
    newMessageCount = 0;
    hasOlderMessages = true;
    isLoadingOlder = false;
    otherUserName = title || '';
    otherUserAvatar = avatarUrl || '';

    // Update header
    headerName.textContent = title || '';
    headerStatus.textContent = '';
    if (avatarUrl) {
      headerAvatar.innerHTML = '<img src="' + escapeHtml(avatarUrl) + '" alt="">';
    } else {
      headerAvatar.innerHTML = '';
    }

    // Show chat UI, hide empty state
    chatEmpty.style.display = 'none';
    chatHeader.classList.remove('messenger-hidden');
    messagesContainer.classList.remove('messenger-hidden');
    inputArea.classList.remove('messenger-hidden');
    scrollBottomButton.classList.add('messenger-hidden');

    // Mobile: switch to chat panel
    messengerElement.classList.add('messenger-chat-open');

    // Highlight active conversation in list
    var items = conversationListContainer.querySelectorAll('.messenger-conversation-item');
    items.forEach(function (item) {
      item.classList.toggle('messenger-conversation-item-active', parseInt(item.getAttribute('data-conversation-id'), 10) === conversationId);
    });

    // Load messages
    messagesContainer.innerHTML = '<div class="messenger-messages-loading">লোড হচ্ছে...</div>';
    loadMessages(conversationId);

    // Mark as read
    markAsRead(conversationId);

    // Start polling
    stopPolling();
    messagePollTimer = setInterval(function () { pollNewMessages(); pollTypingStatus(); }, 3000);

    // Focus textarea
    textarea.value = '';
    textarea.focus();
    updateSendButtonVisibility();
  }

  // =========================================================
  // LOAD MESSAGES
  // =========================================================

  function loadMessages(conversationId, beforeMessageId) {
    var url = '/messenger/api/messages/' + conversationId + '/';
    if (beforeMessageId) url += '?before=' + beforeMessageId;

    fetch(url)
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.success) return;
        if (!beforeMessageId) {
          renderMessages(data.messages);
          loadFailedMessagesFromStorage(conversationId);
          scrollToBottom(false);
        } else {
          prependMessages(data.messages);
        }
        if (data.messages.length > 0) {
          var lastMessage = data.messages[data.messages.length - 1];
          if (lastMessage.message_id > lastMessageId) {
            lastMessageId = lastMessage.message_id;
          }
        }
      })
      .catch(function () {
        messagesContainer.innerHTML = '<div class="messenger-messages-loading">মেসেজ লোড ব্যর্থ হয়েছে</div>';
      });
  }

  function renderMessages(messages) {
    if (!messages.length) {
      messagesContainer.innerHTML = '<div class="messenger-messages-loading">কোনো মেসেজ নেই — প্রথম মেসেজ পাঠান!</div>';
      return;
    }
    var html = buildMessagesHtml(messages);
    messagesContainer.innerHTML = html;
  }

  function prependMessages(messages) {
    if (!messages.length) return;
    var scrollHeightBefore = messagesContainer.scrollHeight;
    var html = buildMessagesHtml(messages);
    messagesContainer.insertAdjacentHTML('afterbegin', html);
    // Preserve scroll position
    messagesContainer.scrollTop = messagesContainer.scrollHeight - scrollHeightBefore;
  }

  function buildMessagesHtml(messages) {
    var html = '';
    var lastDate = '';
    var lastSenderId = null;

    messages.forEach(function (message) {
      // Date separator
      var messageDate = message.created_at ? message.created_at.split('T')[0] : '';
      if (messageDate && messageDate !== lastDate) {
        html += '<div class="messenger-date-separator"><span class="messenger-date-separator-pill">' + formatDateSeparator(message.created_at) + '</span></div>';
        lastDate = messageDate;
        lastSenderId = null;
      }

      if (message.is_system_message) {
        html += '<div class="messenger-system-message">' + escapeHtml(message.message_text) + '</div>';
        lastSenderId = null;
        return;
      }

      var isMine = message.sender_user_profile_id === window.messengerCurrentUserProfileId;
      var bubbleClass = isMine ? 'messenger-bubble-sent' : 'messenger-bubble-received';

      messageTextMap[message.message_id] = message.message_text || '';
      html += '<div class="messenger-bubble ' + bubbleClass + '" data-message-id="' + message.message_id + '">';

      // Sender name + avatar on received bubbles
      if (!isMine && lastSenderId !== message.sender_user_profile_id) {
        html += '<div class="messenger-bubble-sender">';
        if (otherUserAvatar) {
          html += '<img class="messenger-bubble-sender-avatar" src="' + escapeHtml(otherUserAvatar) + '" alt="">';
        }
        html += '<span class="messenger-bubble-sender-name">' + escapeHtml(otherUserName) + '</span>';
        html += '</div>';
      }

      // Quoted reply
      if (message.reply_to_message_id) {
        var quoteText = message.reply_to_text ? escapeHtml(message.reply_to_text) : 'মেসেজ';
        html += '<div class="messenger-bubble-quote" data-quote-id="' + message.reply_to_message_id + '">↩ ' + quoteText + '</div>';
      }

      if (message.is_deleted_for_everyone) {
        html += '<span class="messenger-bubble-deleted">এই মেসেজটি মুছে ফেলা হয়েছে</span>';
      } else {
        html += '<span class="messenger-bubble-text">' + escapeHtml(message.message_text) + '</span>';
      }

      // Reply button (hover visible)
      if (!message.is_deleted_for_everyone) {
        html += '<button type="button" class="messenger-bubble-reply-button" data-reply-id="' + message.message_id + '" title="রিপ্লাই">↩</button>';
      }

      html += '<div class="messenger-bubble-meta">';
      if (message.is_edited) html += '<span class="messenger-bubble-time">edited · </span>';
      html += '<span class="messenger-bubble-time">' + formatTime(message.created_at) + '</span>';
      if (isMine && !message.is_deleted_for_everyone) {
        html += checkmarkHtml(message.message_status_code);
      }
      html += '</div>';
      html += '</div>';

      lastSenderId = message.sender_user_profile_id;
    });

    return html;
  }

  // =========================================================
  // REPLY-TO
  // =========================================================

  function setReplyTo(messageId, messageText) {
    replyToMessageId = messageId;
    replyPreviewContent.textContent = (messageText || '').substring(0, 100);
    replyPreview.classList.remove('messenger-hidden');
    textarea.focus();
  }

  function clearReplyTo() {
    replyToMessageId = null;
    replyPreview.classList.add('messenger-hidden');
    replyPreviewContent.textContent = '';
  }

  // Reply button click + quote click (delegated on messages container)
  messagesContainer.addEventListener('click', function (event) {
    // Reply button
    var replyButton = event.target.closest('.messenger-bubble-reply-button');
    if (replyButton) {
      var messageId = replyButton.getAttribute('data-reply-id');
      var bubble = replyButton.closest('.messenger-bubble');
      var messageText = bubble ? messageTextMap[bubble.getAttribute('data-message-id')] || '' : '';
      setReplyTo(parseInt(messageId, 10), messageText);
      return;
    }

    // Quote click — scroll to original message
    var quote = event.target.closest('.messenger-bubble-quote');
    if (quote) {
      var quoteId = quote.getAttribute('data-quote-id');
      var originalBubble = messagesContainer.querySelector('[data-message-id="' + quoteId + '"]');
      if (originalBubble) {
        originalBubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
        originalBubble.style.outline = '2px solid var(--primary)';
        setTimeout(function () { originalBubble.style.outline = ''; }, 2000);
      }
    }
  });

  // Close reply preview
  if (replyPreviewClose) {
    replyPreviewClose.addEventListener('click', function () { clearReplyTo(); });
  }

  // =========================================================
  // CONTEXT MENU (right-click / long-press on bubble)
  // =========================================================

  var contextMenu = document.getElementById('messenger-context-menu');
  var contextMenuTargetMessageId = null;
  var contextMenuTargetBubble = null;
  var longPressTimer = null;

  function showContextMenu(bubble, clientX, clientY) {
    contextMenuTargetBubble = bubble;
    contextMenuTargetMessageId = parseInt(bubble.getAttribute('data-message-id'), 10);
    var isMine = bubble.classList.contains('messenger-bubble-sent');

    // Show/hide own-message-only options
    contextMenu.querySelectorAll('.messenger-context-menu-item-own').forEach(function (item) {
      item.style.display = isMine ? '' : 'none';
    });

    contextMenu.style.left = clientX + 'px';
    contextMenu.style.top = clientY + 'px';
    contextMenu.classList.remove('messenger-hidden');

    // Adjust if overflowing viewport
    var rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) contextMenu.style.left = (clientX - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) contextMenu.style.top = (clientY - rect.height) + 'px';
  }

  function hideContextMenu() {
    contextMenu.classList.add('messenger-hidden');
    contextMenuTargetMessageId = null;
    contextMenuTargetBubble = null;
  }

  // Right-click on bubble
  messagesContainer.addEventListener('contextmenu', function (event) {
    var bubble = event.target.closest('.messenger-bubble');
    if (!bubble) return;
    event.preventDefault();
    showContextMenu(bubble, event.clientX, event.clientY);
  });

  // Long-press on bubble (mobile)
  messagesContainer.addEventListener('touchstart', function (event) {
    var bubble = event.target.closest('.messenger-bubble');
    if (!bubble) return;
    longPressTimer = setTimeout(function () {
      var touch = event.touches[0];
      showContextMenu(bubble, touch.clientX, touch.clientY);
    }, 500);
  });
  messagesContainer.addEventListener('touchend', function () { clearTimeout(longPressTimer); });
  messagesContainer.addEventListener('touchmove', function () { clearTimeout(longPressTimer); });

  // Close context menu on click outside
  document.addEventListener('click', function (event) {
    if (!contextMenu.contains(event.target)) hideContextMenu();
  });

  // Context menu actions
  contextMenu.addEventListener('click', function (event) {
    var button = event.target.closest('.messenger-context-menu-item');
    if (!button || !contextMenuTargetMessageId) return;
    var action = button.getAttribute('data-action');

    if (action === 'reply') {
      var messageText = contextMenuTargetBubble ? messageTextMap[contextMenuTargetBubble.getAttribute('data-message-id')] || '' : '';
      setReplyTo(contextMenuTargetMessageId, messageText);
    }

    if (action === 'copy') {
      var text = contextMenuTargetBubble ? (contextMenuTargetBubble.querySelector('.messenger-bubble-text') || {}).textContent : '';
      if (text) navigator.clipboard.writeText(text).catch(function () {});
    }

    if (action === 'edit') {
      var editBubble = contextMenuTargetBubble;
      var editMessageId = contextMenuTargetMessageId;
      var textElement = editBubble ? editBubble.querySelector('.messenger-bubble-text') : null;
      if (textElement) {
        var originalText = textElement.textContent;
        textElement.contentEditable = 'true';
        textElement.focus();
        textElement.addEventListener('keydown', function handleEditKey(keyEvent) {
          if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
            keyEvent.preventDefault();
            textElement.contentEditable = 'false';
            textElement.removeEventListener('keydown', handleEditKey);
            var newText = textElement.textContent.trim();
            if (newText && newText !== originalText) {
              fetch('/messenger/api/messages/' + activeConversationId + '/edit/' + editMessageId + '/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
                body: JSON.stringify({ message_text: newText }),
              })
              .then(function (response) { return response.json(); })
              .then(function (data) {
                if (!data.success) {
                  textElement.textContent = originalText;
                  showInputError(data.error || 'সম্পাদনা ব্যর্থ হয়েছে');
                }
              })
              .catch(function () { textElement.textContent = originalText; });
            } else {
              textElement.textContent = originalText;
            }
          }
          if (keyEvent.key === 'Escape') {
            textElement.contentEditable = 'false';
            textElement.textContent = originalText;
            textElement.removeEventListener('keydown', handleEditKey);
          }
        });
      }
    }

    if (action === 'delete_for_me') {
      var deleteMessageId = contextMenuTargetMessageId;
      var deleteBubble = contextMenuTargetBubble;
      fetch('/messenger/api/messages/' + activeConversationId + '/delete-for-me/' + deleteMessageId + '/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success && deleteBubble) deleteBubble.remove();
        else if (data.error) showInputError(data.error);
      })
      .catch(function () { showInputError('মুছে ফেলা যায়নি'); });
    }

    if (action === 'delete_for_everyone') {
      var deleteEveryoneMessageId = contextMenuTargetMessageId;
      var deleteEveryoneBubble = contextMenuTargetBubble;
      fetch('/messenger/api/messages/' + activeConversationId + '/delete-for-everyone/' + deleteEveryoneMessageId + '/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfTokenValue() },
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success && deleteEveryoneBubble) {
          var textEl = deleteEveryoneBubble.querySelector('.messenger-bubble-text');
          if (textEl) textEl.outerHTML = '<span class="messenger-bubble-deleted">এই মেসেজটি মুছে ফেলা হয়েছে</span>';
          var replyBtn = deleteEveryoneBubble.querySelector('.messenger-bubble-reply-button');
          if (replyBtn) replyBtn.remove();
        } else if (data.error) {
          showInputError(data.error);
        }
      })
      .catch(function () { showInputError('মুছে ফেলা যায়নি'); });
    }

    hideContextMenu();
  });

  // =========================================================
  // SEND MESSAGE (optimistic UI)
  // =========================================================

  function sendMessage() {
    var text = textarea.value.trim();
    if (!text || !activeConversationId) return;

    // Optimistic: show message immediately (with quote if replying)
    var tempId = 'temp-' + Date.now();
    var now = new Date().toISOString();
    var optimisticHtml = '<div class="messenger-bubble messenger-bubble-sent" data-message-id="' + tempId + '">';
    if (replyToMessageId) {
      var replyText = replyPreviewContent.textContent || 'মেসেজ';
      optimisticHtml += '<div class="messenger-bubble-quote" data-quote-id="' + replyToMessageId + '">↩ ' + escapeHtml(replyText) + '</div>';
    }
    optimisticHtml += '<span class="messenger-bubble-text">' + escapeHtml(text) + '</span>';
    optimisticHtml += '<div class="messenger-bubble-meta">';
    optimisticHtml += '<span class="messenger-bubble-time">' + formatTime(now) + '</span>';
    optimisticHtml += '<span class="messenger-bubble-check messenger-bubble-check-sent"><svg viewBox="0 0 12 11"><path d="M11.07.66L4.88 6.85 2.72 4.69 1.3 6.1l3.58 3.58 7.6-7.6z" fill="currentColor"/></svg></span>';
    optimisticHtml += '</div></div>';
    messagesContainer.insertAdjacentHTML('beforeend', optimisticHtml);
    scrollToBottom(true);

    // Capture reply ID before clearing (needed for fetch below)
    var sendReplyToMessageId = replyToMessageId;

    // Clear input + reply
    textarea.value = '';
    textarea.style.height = 'auto';
    updateSendButtonVisibility();
    clearReplyTo();
    textarea.focus();

    // Send to server
    fetch('/messenger/api/messages/' + activeConversationId + '/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
      body: JSON.stringify({ message_text: text, reply_to_message_id: sendReplyToMessageId }),
    })
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (data.success) {
        // Replace temp ID with real ID
        var tempBubble = messagesContainer.querySelector('[data-message-id="' + tempId + '"]');
        if (tempBubble) {
          tempBubble.setAttribute('data-message-id', data.message_id);
        }
        if (data.message_id > lastMessageId) lastMessageId = data.message_id;
      } else {
        markBubbleFailed(tempId, text, sendReplyToMessageId, data.error || 'মেসেজ পাঠানো যায়নি');
      }
    })
    .catch(function () {
      markBubbleFailed(tempId, text, sendReplyToMessageId, 'নেটওয়ার্ক ত্রুটি');
    });
  }

  function markBubbleFailed(tempId, messageText, replyId, errorMessage) {
    var failedBubble = messagesContainer.querySelector('[data-message-id="' + tempId + '"]');
    if (!failedBubble) return;
    failedBubble.classList.add('messenger-bubble-failed');
    // Replace checkmark with error + retry
    var metaElement = failedBubble.querySelector('.messenger-bubble-meta');
    if (metaElement) {
      metaElement.innerHTML = '<span class="messenger-bubble-failed-text">⚠ ' + escapeHtml(errorMessage) + '</span>' +
        '<button type="button" class="messenger-bubble-retry-button" data-retry-text="' + tempId + '">আবার চেষ্টা করুন</button>';
    }
    // Store message data for retry (DOM + localStorage)
    failedBubble.setAttribute('data-retry-message-text', messageText);
    failedBubble.setAttribute('data-retry-reply-id', replyId || '');
    saveFailedMessageToStorage(activeConversationId, messageText, replyId);
  }

  function saveFailedMessageToStorage(conversationId, messageText, replyId) {
    var key = 'messenger_failed_' + conversationId;
    var failed = JSON.parse(localStorage.getItem(key) || '[]');
    failed.push({ text: messageText, reply_id: replyId || null, timestamp: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(failed));
  }

  function removeFailedMessageFromStorage(conversationId, messageText) {
    var key = 'messenger_failed_' + conversationId;
    var failed = JSON.parse(localStorage.getItem(key) || '[]');
    failed = failed.filter(function (item) { return item.text !== messageText; });
    if (failed.length) localStorage.setItem(key, JSON.stringify(failed));
    else localStorage.removeItem(key);
  }

  function loadFailedMessagesFromStorage(conversationId) {
    var key = 'messenger_failed_' + conversationId;
    var failed = JSON.parse(localStorage.getItem(key) || '[]');
    failed.forEach(function (item) {
      var tempId = 'failed-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      var html = '<div class="messenger-bubble messenger-bubble-sent messenger-bubble-failed" data-message-id="' + tempId + '" data-retry-message-text="' + escapeHtml(item.text) + '" data-retry-reply-id="' + (item.reply_id || '') + '">';
      html += '<span class="messenger-bubble-text">' + escapeHtml(item.text) + '</span>';
      html += '<div class="messenger-bubble-meta">';
      html += '<span class="messenger-bubble-failed-text">⚠ পাঠানো যায়নি</span>';
      html += '<button type="button" class="messenger-bubble-retry-button">আবার চেষ্টা করুন</button>';
      html += '</div></div>';
      messagesContainer.insertAdjacentHTML('beforeend', html);
    });
  }

  // Retry click handler
  messagesContainer.addEventListener('click', function (event) {
    var retryButton = event.target.closest('.messenger-bubble-retry-button');
    if (!retryButton) return;
    var bubble = retryButton.closest('.messenger-bubble');
    if (!bubble || !activeConversationId) return;

    var retryText = bubble.getAttribute('data-retry-message-text');
    var retryReplyId = bubble.getAttribute('data-retry-reply-id') || null;
    if (retryReplyId) retryReplyId = parseInt(retryReplyId, 10);

    // Update UI to show sending
    bubble.classList.remove('messenger-bubble-failed');
    var metaElement = bubble.querySelector('.messenger-bubble-meta');
    if (metaElement) {
      metaElement.innerHTML = '<span class="messenger-bubble-time">পাঠানো হচ্ছে...</span>';
    }

    fetch('/messenger/api/messages/' + activeConversationId + '/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
      body: JSON.stringify({ message_text: retryText, reply_to_message_id: retryReplyId }),
    })
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (data.success) {
        removeFailedMessageFromStorage(activeConversationId, retryText);
        bubble.setAttribute('data-message-id', data.message_id);
        bubble.removeAttribute('data-retry-message-text');
        bubble.removeAttribute('data-retry-reply-id');
        if (metaElement) {
          metaElement.innerHTML = '<span class="messenger-bubble-time">' + formatTime(data.created_at) + '</span>' +
            checkmarkHtml('sent');
        }
        if (data.message_id > lastMessageId) lastMessageId = data.message_id;
      } else {
        markBubbleFailed(bubble.getAttribute('data-message-id'), retryText, retryReplyId, data.error || 'পাঠানো যায়নি');
      }
    })
    .catch(function () {
      markBubbleFailed(bubble.getAttribute('data-message-id'), retryText, retryReplyId, 'নেটওয়ার্ক ত্রুটি');
    });
  });

  function showInputError(message) {
    var existing = document.getElementById('messenger-input-error');
    if (existing) existing.remove();
    var errorElement = document.createElement('div');
    errorElement.id = 'messenger-input-error';
    errorElement.style.cssText = 'color:var(--danger);font-size:.72rem;padding:.2rem .75rem;';
    errorElement.textContent = message;
    inputArea.insertBefore(errorElement, inputArea.firstChild);
    setTimeout(function () { errorElement.remove(); }, 4000);
  }

  // =========================================================
  // POLLING
  // =========================================================

  function pollNewMessages() {
    if (!activeConversationId || document.visibilityState === 'hidden') return;

    fetch('/messenger/api/messages/' + activeConversationId + '/poll/?after=' + lastMessageId)
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.success || !data.messages.length) return;

        // Filter out messages we already have (optimistic)
        var newMessages = data.messages.filter(function (message) {
          return !messagesContainer.querySelector('[data-message-id="' + message.message_id + '"]');
        });

        if (!newMessages.length) {
          // Update statuses for existing messages
          data.messages.forEach(function (message) {
            var existingBubble = messagesContainer.querySelector('[data-message-id="' + message.message_id + '"]');
            if (existingBubble) {
              var checkElement = existingBubble.querySelector('.messenger-bubble-check');
              if (checkElement) {
                checkElement.outerHTML = checkmarkHtml(message.message_status_code);
              }
            }
          });
          return;
        }

        var html = buildMessagesHtml(newMessages);
        var isAtBottom = isScrolledToBottom();
        messagesContainer.insertAdjacentHTML('beforeend', html);

        var lastNew = newMessages[newMessages.length - 1];
        if (lastNew.message_id > lastMessageId) lastMessageId = lastNew.message_id;

        if (isAtBottom) {
          scrollToBottom(true);
          markAsRead(activeConversationId);
        } else {
          newMessageCount += newMessages.length;
          scrollBottomBadge.textContent = newMessageCount;
          scrollBottomBadge.classList.remove('messenger-hidden');
          scrollBottomButton.classList.remove('messenger-hidden');
        }
      })
      .catch(function () {});
  }

  function pollTypingStatus() {
    if (!activeConversationId || document.visibilityState === 'hidden') return;
    fetch('/messenger/api/typing/' + activeConversationId + '/status/')
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success && data.is_typing) {
          headerStatus.textContent = 'টাইপ করছেন...';
          headerStatus.classList.add('messenger-chat-header-status-typing');
        } else {
          if (headerStatus.classList.contains('messenger-chat-header-status-typing')) {
            headerStatus.textContent = '';
            headerStatus.classList.remove('messenger-chat-header-status-typing');
          }
        }
      })
      .catch(function () {});
  }

  function stopPolling() {
    if (messagePollTimer) { clearInterval(messagePollTimer); messagePollTimer = null; }
  }

  // Poll conversation list every 30 seconds
  conversationPollTimer = setInterval(function () {
    if (document.visibilityState === 'hidden') return;
    loadConversationList();
  }, 30000);

  // =========================================================
  // SCROLL BEHAVIOR
  // =========================================================

  function scrollToBottom(smooth) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function isScrolledToBottom() {
    return messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;
  }

  var isLoadingOlder = false;
  var hasOlderMessages = true;

  messagesContainer.addEventListener('scroll', function () {
    if (isScrolledToBottom()) {
      scrollBottomButton.classList.add('messenger-hidden');
      newMessageCount = 0;
    } else {
      scrollBottomButton.classList.remove('messenger-hidden');
    }

    // Load older messages when scrolled to top
    if (messagesContainer.scrollTop < 50 && activeConversationId && !isLoadingOlder && hasOlderMessages) {
      var firstBubble = messagesContainer.querySelector('.messenger-bubble');
      if (!firstBubble) return;
      var oldestMessageId = firstBubble.getAttribute('data-message-id');
      if (!oldestMessageId || oldestMessageId.toString().startsWith('temp-')) return;

      isLoadingOlder = true;
      var loadingElement = document.createElement('div');
      loadingElement.className = 'messenger-messages-loading';
      loadingElement.textContent = 'পুরানো মেসেজ লোড হচ্ছে...';
      messagesContainer.insertBefore(loadingElement, messagesContainer.firstChild);

      var url = '/messenger/api/messages/' + activeConversationId + '/?before=' + oldestMessageId;
      fetch(url)
        .then(function (response) { return response.json(); })
        .then(function (data) {
          loadingElement.remove();
          if (data.success && data.messages.length > 0) {
            prependMessages(data.messages);
          }
          if (!data.has_more) hasOlderMessages = false;
          isLoadingOlder = false;
        })
        .catch(function () {
          loadingElement.remove();
          isLoadingOlder = false;
        });
    }
  });

  scrollBottomButton.addEventListener('click', function () {
    scrollToBottom(true);
    scrollBottomButton.classList.add('messenger-hidden');
    newMessageCount = 0;
    if (activeConversationId) markAsRead(activeConversationId);
  });

  // =========================================================
  // MARK AS READ
  // =========================================================

  function markAsRead(conversationId) {
    fetch('/messenger/api/messages/' + conversationId + '/read/', {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrfTokenValue() },
    }).catch(function () {});
  }

  // =========================================================
  // TEXTAREA + SEND BUTTON
  // =========================================================

  function updateSendButtonVisibility() {
    sendButton.classList.remove('messenger-hidden');
    if (textarea.value.trim()) {
      sendButton.style.opacity = '1';
      sendButton.disabled = false;
    } else {
      sendButton.style.opacity = '.4';
      sendButton.disabled = true;
    }
  }

  textarea.addEventListener('input', function () {
    // Auto-resize
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    updateSendButtonVisibility();

    // Typing indicator
    if (activeConversationId && textarea.value.trim()) {
      clearTimeout(typingTimer);
      typingTimer = setTimeout(function () {
        fetch('/messenger/api/typing/' + activeConversationId + '/', {
          method: 'POST',
          headers: { 'X-CSRFToken': getCsrfTokenValue() },
        }).catch(function () {});
      }, 500);
    }
  });

  // Enter = send, Shift+Enter = newline
  textarea.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  sendButton.addEventListener('click', function () { sendMessage(); });

  // =========================================================
  // BACK BUTTON (mobile)
  // =========================================================

  backButton.addEventListener('click', function () {
    activeConversationId = null;
    stopPolling();
    messengerElement.classList.remove('messenger-chat-open');

    chatHeader.classList.add('messenger-hidden');
    messagesContainer.classList.add('messenger-hidden');
    inputArea.classList.add('messenger-hidden');
    chatEmpty.style.display = '';

    loadConversationList();
  });

  // =========================================================
  // CHAT SETTINGS (auto-delete + clear all)
  // =========================================================

  var settingsButton = document.getElementById('messenger-chat-settings-button');
  var settingsDropdown = document.getElementById('messenger-chat-settings-dropdown');
  var clearAllButton = document.getElementById('messenger-chat-clear-all-button');
  var clearAllConfirmPending = false;

  if (settingsButton && settingsDropdown) {
    settingsButton.addEventListener('click', function () {
      settingsDropdown.classList.toggle('messenger-hidden');
    });

    // Close dropdown on click outside
    document.addEventListener('click', function (event) {
      if (!settingsButton.contains(event.target) && !settingsDropdown.contains(event.target)) {
        settingsDropdown.classList.add('messenger-hidden');
      }
    });

    // Auto-delete timer buttons
    settingsDropdown.addEventListener('click', function (event) {
      var item = event.target.closest('[data-auto-delete]');
      if (!item || !activeConversationId) return;
      var seconds = parseInt(item.getAttribute('data-auto-delete'), 10);

      fetch('/messenger/api/conversations/' + activeConversationId + '/set-auto-delete/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
        body: JSON.stringify({ auto_delete_after_seconds: seconds }),
      })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          settingsDropdown.classList.add('messenger-hidden');
          // Highlight active option
          settingsDropdown.querySelectorAll('[data-auto-delete]').forEach(function (button) {
            button.classList.toggle('messenger-chat-settings-item-active', parseInt(button.getAttribute('data-auto-delete'), 10) === seconds);
          });
        } else {
          showInputError(data.error || 'সেট করা যায়নি');
        }
      })
      .catch(function () { showInputError('নেটওয়ার্ক ত্রুটি'); });
    });

    // Clear all messages
    if (clearAllButton) {
      clearAllButton.addEventListener('click', function () {
        if (!activeConversationId) return;
        if (!clearAllConfirmPending) {
          clearAllConfirmPending = true;
          clearAllButton.textContent = '⚠ নিশ্চিত? আবার ক্লিক করুন';
          setTimeout(function () {
            clearAllConfirmPending = false;
            clearAllButton.textContent = '🗑 সব মেসেজ মুছুন';
          }, 3000);
          return;
        }
        clearAllConfirmPending = false;
        clearAllButton.textContent = '🗑 সব মেসেজ মুছুন';

        fetch('/messenger/api/conversations/' + activeConversationId + '/clear-all/', {
          method: 'POST',
          headers: { 'X-CSRFToken': getCsrfTokenValue() },
        })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.success) {
            settingsDropdown.classList.add('messenger-hidden');
            loadMessages(activeConversationId);
          } else {
            showInputError(data.error || 'মুছে ফেলা যায়নি');
          }
        })
        .catch(function () { showInputError('নেটওয়ার্ক ত্রুটি'); });
      });
    }
  }

  // =========================================================
  // EMOJI PICKER
  // =========================================================

  var emojiToggle = document.getElementById('messenger-emoji-toggle');
  var emojiPicker = document.getElementById('messenger-emoji-picker');
  var commonEmojis = ['😊','😂','❤️','👍','🙏','😢','😡','🔥','💯','✅','👏','🎉','😍','🤔','😎','💪','🥰','😭','🤣','👀','💀','🫡','😤','🥺','😅','🙄','😳','🤝','💜','🌹','🇧🇩','⭐','💬','📌','🗑','✏️','↩','📋','🔗','👁','📩','🔔','❌','⚡','🎯','💡','📸','🎵','🏆','🌟'];

  if (emojiToggle && emojiPicker) {
    var emojiHtml = '';
    commonEmojis.forEach(function (emoji) {
      emojiHtml += '<button type="button" class="messenger-emoji-item">' + emoji + '</button>';
    });
    emojiPicker.innerHTML = emojiHtml;

    emojiToggle.addEventListener('click', function () {
      emojiPicker.classList.toggle('messenger-hidden');
    });

    emojiPicker.addEventListener('click', function (event) {
      var item = event.target.closest('.messenger-emoji-item');
      if (!item) return;
      var emoji = item.textContent;
      var cursorPosition = textarea.selectionStart;
      var before = textarea.value.substring(0, cursorPosition);
      var after = textarea.value.substring(cursorPosition);
      textarea.value = before + emoji + after;
      textarea.selectionStart = textarea.selectionEnd = cursorPosition + emoji.length;
      textarea.focus();
      updateSendButtonVisibility();
      emojiPicker.classList.add('messenger-hidden');
    });
  }

  // =========================================================
  // INIT
  // =========================================================

  // Set current user profile ID (used to determine sent vs received)
  var parsedProfileId = parseInt(messengerElement.getAttribute('data-current-user-profile-id'), 10);
  window.messengerCurrentUserProfileId = isNaN(parsedProfileId) ? null : parsedProfileId;

  // Load conversation list
  loadConversationList();

  // Auto-open conversation if ?conversation= in URL
  var initialConversationId = messengerElement.getAttribute('data-initial-conversation');
  if (initialConversationId) {
    openConversation(parseInt(initialConversationId, 10), '', '');
  }

  // Auto-start conversation if ?start= in URL (from profile page Message button)
  var startWithUserId = messengerElement.getAttribute('data-start-with-user');
  if (startWithUserId && !initialConversationId) {
    fetch('/messenger/api/conversations/start/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
      body: JSON.stringify({ other_user_profile_id: parseInt(startWithUserId, 10) }),
    })
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (data.success) {
        openConversation(data.conversation_id, '', '');
        loadConversationList();
      }
    })
    .catch(function () {});
  }

})();
