/* ============================================================
   bookwriter — inline formatting toolbar (standalone module)
   --------------------------------------------------------
   Wires the B / I / U / ¶ heading / " quote buttons in the
   Inkwell editor toolbar to the active .bookwriter-prose
   contenteditable. Self-contained — no shared state with the
   main IIFE; rebinds via DOM lookup on every click.

   B / I / U use document.execCommand — the one-line, all-browser
   way to toggle inline formatting on a contenteditable selection.

   ¶ heading wraps only the SELECTED text in a span carrying the
   bookwriter-prose-headline class so a single phrase can be
   bigger/bolder without promoting the whole paragraph
   (formatBlock h2 would do the latter — wrong for in-line
   emphasis).

   " quote uses formatBlock blockquote because a block-quote is
   conceptually a block; CSS (.bookwriter-prose blockquote) gives
   it the visible left border + indent.

   mousedown + preventDefault keeps the manuscript selection alive
   — a click would shift focus to the button first and the command
   would run on an empty range.

   Loaded as a defer script after bookwriter-namespace.js. Idempotent
   on double-load (the listener key check on document is harmless).
   ============================================================ */
(function () {
  'use strict';

  function wrapSelectionInElement(tagName, className) {
    var selectionObject = window.getSelection();
    if (!selectionObject || selectionObject.rangeCount === 0) return;
    var rangeObject = selectionObject.getRangeAt(0);
    if (rangeObject.collapsed) return;
    var extractedContents = rangeObject.extractContents();
    var wrapperElement = document.createElement(tagName);
    if (className) wrapperElement.className = className;
    wrapperElement.appendChild(extractedContents);
    rangeObject.insertNode(wrapperElement);
    selectionObject.removeAllRanges();
    var newRange = document.createRange();
    newRange.selectNodeContents(wrapperElement);
    selectionObject.addRange(newRange);
  }

  var formattingHandlerById = {
    'bookwriter-tool-bold-button':      function () { document.execCommand('bold'); },
    'bookwriter-tool-italic-button':    function () { document.execCommand('italic'); },
    'bookwriter-tool-underline-button': function () { document.execCommand('underline'); },
    'bookwriter-tool-heading-button':   function () { wrapSelectionInElement('span', 'bookwriter-prose-headline'); },
    'bookwriter-tool-quote-button':     function () { document.execCommand('formatBlock', false, 'blockquote'); }
  };

  document.addEventListener('mousedown', function (formattingMouseEvent) {
    var clickedButton = formattingMouseEvent.target.closest('button');
    if (!clickedButton) return;
    var formattingHandler = formattingHandlerById[clickedButton.id];
    if (!formattingHandler) return;
    formattingMouseEvent.preventDefault();
    var activeManuscriptElement = document.querySelector('.bookwriter-prose[contenteditable="true"]');
    if (activeManuscriptElement && document.activeElement !== activeManuscriptElement) {
      activeManuscriptElement.focus();
    }
    formattingHandler();
  });
})();
