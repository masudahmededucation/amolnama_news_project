/* csrf-token.js — single source of truth for CSRF token extraction.
   Include in base.html before all other JS. Access via window.getCsrfTokenValue(). */
(function () {
  'use strict';
  window.getCsrfTokenValue = function () {
    const cookieMatch = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
    return cookieMatch ? cookieMatch.pop() : '';
  };
})();
