/* notification-bell.js — global notification bell: poll, dropdown, mark read. All pages. */
(function () {
  'use strict';

  const bellButton = document.getElementById('global-notification-bell');
  const dropdown = document.getElementById('global-notification-dropdown');
  const countBadge = document.getElementById('global-notification-count');
  if (!bellButton || !dropdown || !countBadge) return;



  function updateCountBadge(count) {
    if (count > 0) {
      countBadge.textContent = count > 99 ? '99+' : count;
      countBadge.classList.remove('global-notification-count-hidden');
    } else {
      countBadge.classList.add('global-notification-count-hidden');
    }
  }

  function fetchAndShowNotifications() {
    dropdown.innerHTML = '<div class="global-notification-empty">লোড হচ্ছে...</div>';
    dropdown.classList.remove('global-notification-dropdown-hidden');

    fetch('/newsengine/api/notifications/')
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (!data.success || data.notifications.length === 0) {
          dropdown.innerHTML = '<div class="global-notification-empty">কোনো বিজ্ঞপ্তি নেই</div>';
          return;
        }

        let html = '';
        data.notifications.forEach(function (notification) {
          const readClass = notification.is_read ? '' : ' global-notification-item-unread';
          const urlAttr = notification.url ? ' href="' + escapeHtml(notification.url) + '"' : '';
          const tag = notification.url ? 'a' : 'div';
          html += '<' + tag + urlAttr + ' class="global-notification-item' + readClass + '">';
          html += '<div class="global-notification-item-message">';
          html += '<span class="global-notification-item-source">' + escapeHtml(notification.source_app) + '</span>';
          html += escapeHtml(notification.message);
          html += '</div>';
          html += '<div class="global-notification-item-time">' + escapeHtml(notification.created_at) + '</div>';
          html += '</' + tag + '>';
        });

        if (data.unread_count > 0) {
          html += '<div class="global-notification-mark-read" id="global-notification-mark-read">সব পড়া হয়েছে</div>';
        }

        dropdown.innerHTML = html;
        updateCountBadge(data.unread_count);

        const markReadButton = document.getElementById('global-notification-mark-read');
        if (markReadButton) {
          markReadButton.addEventListener('click', function () {
            fetch('/newsengine/api/notifications/mark-read/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
              body: JSON.stringify({}),
            })
            .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
            .then(function () {
              updateCountBadge(0);
              dropdown.classList.add('global-notification-dropdown-hidden');
            })
            .catch(function () {});
          });
        }
      })
      .catch(function () {
        dropdown.innerHTML = '<div class="global-notification-empty">লোড ব্যর্থ</div>';
      });
  }

  /* Toggle dropdown */
  bellButton.addEventListener('click', function (event) {
    event.stopPropagation();
    if (dropdown.classList.contains('global-notification-dropdown-hidden')) {
      fetchAndShowNotifications();
    } else {
      dropdown.classList.add('global-notification-dropdown-hidden');
    }
  });

  /* Close on outside click */
  document.addEventListener('click', function () {
    dropdown.classList.add('global-notification-dropdown-hidden');
  });
  dropdown.addEventListener('click', function (event) { event.stopPropagation(); });

  /* Poll for unread count every 60s */
  function pollUnreadCount() {
    if (document.visibilityState === 'hidden') return;
    fetch('/newsengine/api/notifications/')
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) {
        if (data.success) updateCountBadge(data.unread_count);
      })
      .catch(function () {});
  }

  /* WebSocket for real-time notifications (falls back to polling) */
  let notificationWebSocket = null;
  let notificationPollingInterval = null;

  function connectNotificationWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const webSocketUrl = protocol + '//' + window.location.host + '/ws/notifications/';

    try {
      notificationWebSocket = new WebSocket(webSocketUrl);

      notificationWebSocket.onopen = function () {
        /* WebSocket connected — stop polling */
        if (notificationPollingInterval) {
          clearInterval(notificationPollingInterval);
          notificationPollingInterval = null;
        }
      };

      notificationWebSocket.onmessage = function (event) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_notification') {
            updateCountBadge(data.unread_count);
          }
        } catch (parseError) { /* ignore malformed messages */ }
      };

      notificationWebSocket.onclose = function () {
        notificationWebSocket = null;
        /* Fall back to polling on disconnect */
        if (!notificationPollingInterval) {
          notificationPollingInterval = setInterval(pollUnreadCount, 60000);
        }
        /* Reconnect after 5 seconds */
        setTimeout(connectNotificationWebSocket, 5000);
      };

      notificationWebSocket.onerror = function () {
        if (notificationWebSocket) notificationWebSocket.close();
      };
    } catch (webSocketError) {
      /* WebSocket not available — use polling */
      if (!notificationPollingInterval) {
        notificationPollingInterval = setInterval(pollUnreadCount, 60000);
      }
    }
  }

  /* Initial check + start WebSocket (with polling fallback) */
  pollUnreadCount();
  connectNotificationWebSocket();
})();
