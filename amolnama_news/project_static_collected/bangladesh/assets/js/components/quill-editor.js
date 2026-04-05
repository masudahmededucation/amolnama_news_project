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

    /* Add id+name to Quill's internal elements (browser audit compliance) */
    const toolbarSelects = container.parentNode.querySelectorAll('.ql-toolbar select');
    for (let i = 0; i < toolbarSelects.length; i++) {
      const cls = toolbarSelects[i].className.replace('ql-', '').trim();
      toolbarSelects[i].id = containerId + '-toolbar-' + cls;
      toolbarSelects[i].name = containerId + '_toolbar_' + cls;
    }
    /* Quill tooltip input (link/formula/video) */
    const tooltipInputs = container.parentNode.querySelectorAll('.ql-tooltip input[type="text"]');
    for (let j = 0; j < tooltipInputs.length; j++) {
      tooltipInputs[j].id = containerId + '-tooltip-input-' + j;
      tooltipInputs[j].name = containerId + '_tooltip_input_' + j;
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
})();
