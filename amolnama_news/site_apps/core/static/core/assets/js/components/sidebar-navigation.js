/* sidebar-navigation.js — Toggle expand/collapse for X-style left sidebar */
(function () {
  'use strict';

  /* Preserve sidebar scroll position across page navigation */
  var sidebarElement = document.querySelector('.sidebar-navigation');
  if (sidebarElement) {
    // Save on page leave
    window.addEventListener('beforeunload', function () {
      sessionStorage.setItem('sidebar_scroll_position', sidebarElement.scrollTop);
    });

    // Restore after page fully loaded (not before — layout must be complete)
    window.addEventListener('load', function () {
      var savedScrollPosition = sessionStorage.getItem('sidebar_scroll_position');
      if (savedScrollPosition) sidebarElement.scrollTop = parseInt(savedScrollPosition, 10);
    });
  }

  var appLayoutElement = document.getElementById('app-layout');
  var toggleButton = document.getElementById('sidebar-navigation-toggle');
  var toggleIconElement = document.getElementById('sidebar-navigation-toggle-icon');

  if (!appLayoutElement || !toggleButton) return;

  /* Restore saved state from localStorage (expanded = default) */
  var savedState = localStorage.getItem('sidebar_navigation_collapsed');
  if (savedState === 'true') {
    appLayoutElement.classList.add('app-layout-collapsed');
    toggleIconElement.textContent = '»';
  } else {
    toggleIconElement.textContent = '«';
  }

  toggleButton.addEventListener('click', function () {
    var isCollapsed = appLayoutElement.classList.toggle('app-layout-collapsed');
    toggleIconElement.textContent = isCollapsed ? '»' : '«';
    localStorage.setItem('sidebar_navigation_collapsed', isCollapsed ? 'true' : 'false');
  });

  /* ---- Messenger unread badge polling ---- */
  var messengerBadge = document.getElementById('sidebar-messenger-unread-badge');
  if (messengerBadge) {
    function pollMessengerUnreadCount() {
      if (document.visibilityState === 'hidden') return;
      fetch('/messenger/api/unread-count/')
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (!data.success) return;
          if (data.unread_count > 0) {
            messengerBadge.textContent = data.unread_count > 99 ? '99+' : data.unread_count;
            messengerBadge.classList.remove('sidebar-navigation-unread-badge-hidden');
          } else {
            messengerBadge.classList.add('sidebar-navigation-unread-badge-hidden');
          }
        })
        .catch(function () {});
    }
    pollMessengerUnreadCount();
    setInterval(pollMessengerUnreadCount, 30000);
  }
})();
