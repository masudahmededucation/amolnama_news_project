/* clipboard-clean-copy.js — Strip dark backgrounds from copied content
   When users copy text from dark mode, clipboard HTML includes dark background
   colors. This intercepts the copy event and removes all background/background-color
   inline styles, preserving formatting (bold, links, text color). */
(function () {
  'use strict';

  document.addEventListener('copy', function (event) {
    var selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    /* Get selected HTML */
    var range = selection.getRangeAt(0);
    var clonedContent = range.cloneContents();
    var wrapper = document.createElement('div');
    wrapper.appendChild(clonedContent);
    var html = wrapper.innerHTML;

    if (!html) return;

    /* Strip background and background-color from inline styles */
    var cleanedHtml = html
      .replace(/background-color\s*:\s*[^;"}]+;?/gi, '')
      .replace(/background\s*:\s*[^;"}]+;?/gi, '')
      .replace(/style="\s*"/gi, '');

    /* Set clean HTML + plain text to clipboard */
    event.clipboardData.setData('text/html', cleanedHtml);
    event.clipboardData.setData('text/plain', selection.toString());
    event.preventDefault();
  });
})();
