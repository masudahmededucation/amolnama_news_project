/* sidebar-navigation.js — Toggle expand/collapse for X-style left sidebar */
(function () {
  'use strict';

  /* Preserve sidebar scroll position across page navigation */
  const sidebarElement = document.querySelector('.sidebar-navigation');
  if (sidebarElement) {
    // Save on page leave
    window.addEventListener('beforeunload', function () {
      sessionStorage.setItem('sidebar_scroll_position', sidebarElement.scrollTop);
    });

    // Restore after page fully loaded (not before — layout must be complete)
    window.addEventListener('load', function () {
      const savedScrollPosition = sessionStorage.getItem('sidebar_scroll_position');
      if (savedScrollPosition) sidebarElement.scrollTop = parseInt(savedScrollPosition, 10);
    });
  }

  const appLayoutElement = document.getElementById('app-layout');
  const toggleButton = document.getElementById('sidebar-navigation-toggle');
  const toggleIconElement = document.getElementById('sidebar-navigation-toggle-icon');

  if (!appLayoutElement || !toggleButton) return;

  /* Restore saved state from localStorage (expanded = default) */
  const savedState = localStorage.getItem('sidebar_navigation_collapsed');
  if (savedState === 'true') {
    appLayoutElement.classList.add('app-layout-collapsed');
    toggleIconElement.textContent = '»';
  } else {
    toggleIconElement.textContent = '«';
  }

  toggleButton.addEventListener('click', function () {
    const isCollapsed = appLayoutElement.classList.toggle('app-layout-collapsed');
    toggleIconElement.textContent = isCollapsed ? '»' : '«';
    localStorage.setItem('sidebar_navigation_collapsed', isCollapsed ? 'true' : 'false');
  });

  /* ---- Messenger unread badge polling ---- */
  const messengerBadge = document.getElementById('sidebar-messenger-unread-badge');
  if (messengerBadge) {
    function pollMessengerUnreadCount() {
      if (document.visibilityState === 'hidden') return;
      fetch('/messenger/api/unread-count/')
        .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
        .then(function (data) {
          if (!data.success) return;
          if (data.unread_count > 0) {
            messengerBadge.textContent = data.unread_count > 99 ? '99+' : data.unread_count;
            messengerBadge.classList.remove('sidebar-navigation-unread-badge-hidden');
          } else {
            messengerBadge.classList.add('sidebar-navigation-unread-badge-hidden');
          }
        })
        .catch(function (messengerUnreadPollError) { console.error('Messenger unread poll failed:', messengerUnreadPollError); });
    }
    pollMessengerUnreadCount();
    setInterval(pollMessengerUnreadCount, 30000);
  }
})();
