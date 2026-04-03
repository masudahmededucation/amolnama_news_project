/* theme-toggle.js — Dark/light mode toggle with localStorage persistence.
   Loaded in base.html. Respects system preference as fallback. */
(function () {
  'use strict';

  var STORAGE_KEY = 'theme_preference';
  var savedTheme = null;
  try { savedTheme = localStorage.getItem(STORAGE_KEY); } catch (storageError) {}

  /* Apply saved theme immediately (before paint) */
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
  /* If no saved preference, system preference handles it via CSS @media */

  /* Toggle button — updates icon + theme */
  var themeToggleButton = document.getElementById('theme-toggle-button');
  if (themeToggleButton) {
    /* Set initial icon */
    var isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    themeToggleButton.textContent = isDark ? '☀️' : '🌙';
    themeToggleButton.title = isDark ? 'লাইট মোড (Light mode)' : 'ডার্ক মোড (Dark mode)';

    themeToggleButton.addEventListener('click', function () {
      var currentTheme = document.documentElement.getAttribute('data-theme');
      var currentlyDark = currentTheme === 'dark' || (!currentTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
      var newTheme = currentlyDark ? 'light' : 'dark';

      document.documentElement.setAttribute('data-theme', newTheme);
      try { localStorage.setItem(STORAGE_KEY, newTheme); } catch (storageError) {}

      themeToggleButton.textContent = newTheme === 'dark' ? '☀️' : '🌙';
      themeToggleButton.title = newTheme === 'dark' ? 'লাইট মোড (Light mode)' : 'ডার্ক মোড (Dark mode)';
    });
  }
})();
