/* notification-bell.js — global notification bell: poll, dropdown, mark read. All pages. */
(function () {
  'use strict';

  var bellButton = document.getElementById('global-notification-bell');
  var dropdown = document.getElementById('global-notification-dropdown');
  var countBadge = document.getElementById('global-notification-count');
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
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data.success || data.notifications.length === 0) {
          dropdown.innerHTML = '<div class="global-notification-empty">কোনো বিজ্ঞপ্তি নেই</div>';
          return;
        }

        var html = '';
        data.notifications.forEach(function (notification) {
          var readClass = notification.is_read ? '' : ' global-notification-item-unread';
          var urlAttr = notification.url ? ' href="' + escapeHtml(notification.url) + '"' : '';
          var tag = notification.url ? 'a' : 'div';
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

        var markReadButton = document.getElementById('global-notification-mark-read');
        if (markReadButton) {
          markReadButton.addEventListener('click', function () {
            fetch('/newsengine/api/notifications/mark-read/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfTokenValue() },
              body: JSON.stringify({}),
            }).then(function () {
              updateCountBadge(0);
              dropdown.classList.add('global-notification-dropdown-hidden');
            });
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
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) updateCountBadge(data.unread_count);
      })
      .catch(function () {});
  }

  /* Initial check + interval */
  pollUnreadCount();
  setInterval(pollUnreadCount, 60000);
})();
