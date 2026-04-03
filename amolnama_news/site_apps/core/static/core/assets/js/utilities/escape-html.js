/* escape-html.js — single source of truth for HTML escaping.
   Include in base.html before all other JS. Access via window.escapeHtml(). */
(function () {
  'use strict';
  window.escapeHtml = function (text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text || ''));
    return div.innerHTML;
  };
})();
