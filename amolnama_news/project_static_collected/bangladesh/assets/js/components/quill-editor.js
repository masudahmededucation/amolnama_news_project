/**
 * quill-editor.js — Reusable Quill rich text editor initializer.
 *
 * Usage:
 *   const editor = window.initQuillEditor('quill-container-id', 'hidden-textarea-id', {
 *     placeholder: 'Write here...',
 *     minHeight: '150px'
 *   });
 *
 * Returns the Quill instance. On form submit, call editor.syncToHidden() to copy HTML.
 *
 * Depends on: Quill.js loaded via CDN before this script.
 */
(function () {
  'use strict';

  const TOOLBAR = [
    ['bold', 'italic', 'underline'],
    [{ 'header': [2, 3, false] }],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['blockquote'],
    ['link'],
    ['clean']
  ];

  /**
   * Initialize a Quill editor.
   * @param {string} containerId — ID of the <div> container for the editor
   * @param {string} hiddenId — ID of the hidden <textarea> that stores HTML
   * @param {object} opts — { placeholder, minHeight }
   * @returns {{ quill, syncToHidden, setContent }}
   */
  function initQuillEditor(containerId, hiddenId, opts) {
    if (typeof Quill === 'undefined') return null;
    opts = opts || {};
    const container = document.getElementById(containerId);
    const hidden = document.getElementById(hiddenId);
    if (!container || !hidden) return null;

    /* Guard: skip if Quill already initialized on this container (SPA re-navigation) */
    if (container.classList.contains('ql-container')) return null;

    const quill = new Quill('#' + containerId, {
      theme: 'snow',
      modules: { toolbar: TOOLBAR },
      placeholder: opts.placeholder || '',
    });

    /* Set min-height on editor area */
    const editorEl = container.querySelector('.ql-editor');
    if (editorEl && opts.minHeight) {
      editorEl.style.minHeight = opts.minHeight;
    }

    /* Add id+name to Quill's internal elements (browser audit compliance).
       Quill inserts .ql-toolbar as the previous sibling of the container.
       After new Quill(), container becomes .ql-container.ql-snow */
    const ownToolbar = container.previousElementSibling;
    if (ownToolbar && ownToolbar.classList.contains('ql-toolbar')) {
      const toolbarSelects = ownToolbar.querySelectorAll('select');
      for (let i = 0; i < toolbarSelects.length; i++) {
        /* Extract the first ql-* class as the semantic name (e.g. ql-background → background) */
        let semanticName = 'select-' + i;
        for (let c = 0; c < toolbarSelects[i].classList.length; c++) {
          const cn = toolbarSelects[i].classList[c];
          if (cn.startsWith('ql-')) {
            semanticName = cn.substring(3);
            break;
          }
        }
        toolbarSelects[i].id = containerId + '-toolbar-' + semanticName;
        toolbarSelects[i].name = containerId + '_toolbar_' + semanticName;
      }
    }
    /* Quill tooltip input (link/formula/video) */
    const ownTooltip = container.querySelector('.ql-tooltip');
    if (ownTooltip) {
      const tooltipInputs = ownTooltip.querySelectorAll('input[type="text"]');
      for (let j = 0; j < tooltipInputs.length; j++) {
        tooltipInputs[j].id = containerId + '-tooltip-input-' + j;
        tooltipInputs[j].name = containerId + '_tooltip_input_' + j;
      }
    }

    /* Load existing content from hidden textarea (for edit mode) */
    if (hidden.value && hidden.value.trim()) {
      quill.root.innerHTML = hidden.value;
    }

    /* Sync Quill HTML to hidden textarea */
    function syncToHidden() {
      const html = quill.root.innerHTML;
      /* Quill uses <p><br></p> for empty — treat as empty */
      if (html === '<p><br></p>' || html === '<p></p>') {
        hidden.value = '';
      } else {
        hidden.value = html;
      }
    }

    /* Auto-sync on text change (for form persist / draft save) */
    quill.on('text-change', function () {
      syncToHidden();
    });

    /* Set content programmatically (for edit pre-population) */
    function setContent(html) {
      if (html) {
        quill.root.innerHTML = html;
      } else {
        quill.setText('');
      }
      syncToHidden();
    }

    return {
      quill: quill,
      syncToHidden: syncToHidden,
      setContent: setContent,
    };
  }

  window.initQuillEditor = initQuillEditor;

  /* Register SPA cleanup — Quill has no destroy(), so disable and clean up DOM */
  if (window.spaCleanupRegister) {
    window.spaCleanupRegister(function () {
      document.querySelectorAll('.ql-toolbar').forEach(function (toolbar) { toolbar.remove(); });
      document.querySelectorAll('.ql-tooltip').forEach(function (tooltip) { tooltip.remove(); });
    });
  }
})();
