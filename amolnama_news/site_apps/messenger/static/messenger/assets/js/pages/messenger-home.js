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
  var typingTimer = null;
  var newMessageCount = 0;


  function formatTime(isoString) {
    if (!isoString) return '';
    var date = new Date(isoString);
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return hours + ':' + (minutes < 10 ? '0' : '') + minutes + ' ' + ampm;
  }

  function formatDateSeparator(isoString) {
    if (!isoString) return '';
    var date = new Date(isoString);
    var today = new Date();
    var yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'আজ';
    if (date.toDateString() === yesterday.toDateString()) return 'গতকাল';

    var day = date.getDate();
    var months = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগ', 'সেপ্ট', 'অক্টো', 'নভে', 'ডিসে'];
    return day + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
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

      html += '<div class="messenger-bubble ' + bubbleClass + '" data-message-id="' + message.message_id + '">';

      if (message.is_deleted_for_everyone) {
        html += '<span class="messenger-bubble-deleted">এই মেসেজটি মুছে ফেলা হয়েছে</span>';
      } else {
        html += '<span class="messenger-bubble-text">' + escapeHtml(message.message_text) + '</span>';
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
  // SEND MESSAGE (optimistic UI)
  // =========================================================

  function sendMessage() {
    var text = textarea.value.trim();
    if (!text || !activeConversationId) return;

    // Optimistic: show message immediately
    var tempId = 'temp-' + Date.now();
    var now = new Date().toISOString();
    var optimisticHtml = '<div class="messenger-bubble messenger-bubble-sent" data-message-id="' + tempId + '">';
    optimisticHtml += '<span class="messenger-bubble-text">' + escapeHtml(text) + '</span>';
    optimisticHtml += '<div class="messenger-bubble-meta">';
    optimisticHtml += '<span class="messenger-bubble-time">' + formatTime(now) + '</span>';
    optimisticHtml += '<span class="messenger-bubble-check messenger-bubble-check-sent"><svg viewBox="0 0 12 11"><path d="M11.07.66L4.88 6.85 2.72 4.69 1.3 6.1l3.58 3.58 7.6-7.6z" fill="currentColor"/></svg></span>';
    optimisticHtml += '</div></div>';
    messagesContainer.insertAdjacentHTML('beforeend', optimisticHtml);
    scrollToBottom(true);

    // Clear input
    textarea.value = '';
    textarea.style.height = 'auto';
    updateSendButtonVisibility();
    textarea.focus();

    // Send to server
    fetch('/messenger/api/messages/' + activeConversationId + '/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
      body: JSON.stringify({ message_text: text }),
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
        // Remove optimistic message, show error
        var failedBubble = messagesContainer.querySelector('[data-message-id="' + tempId + '"]');
        if (failedBubble) failedBubble.remove();
        showInputError(data.error || 'মেসেজ পাঠানো যায়নি');
      }
    })
    .catch(function () {
      var failedBubble = messagesContainer.querySelector('[data-message-id="' + tempId + '"]');
      if (failedBubble) failedBubble.remove();
      showInputError('নেটওয়ার্ক ত্রুটি — মেসেজ পাঠানো যায়নি');
    });
  }

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
    if (textarea.value.trim()) {
      sendButton.classList.remove('messenger-hidden');
    } else {
      sendButton.classList.add('messenger-hidden');
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
  // INIT
  // =========================================================

  // Set current user profile ID (used to determine sent vs received)
  window.messengerCurrentUserProfileId = parseInt(messengerElement.getAttribute('data-current-user-profile-id'), 10) || null;

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
