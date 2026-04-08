/**
 * news-quill-init.js — Initialize Quill editors for summary and body fields.
 * Uses the shared quill-editor.js initQuillEditor() function.
 * Exposes editors on window so news-form-edit-load.js can set content.
 */
(function () {
  'use strict';

  if (!window.initQuillEditor) return;

  const summaryContainer = document.getElementById('quill-news-summary');
  const bodyContainer = document.getElementById('quill-news-body');

  if (summaryContainer) {
    window.__quillNewsSummary = window.initQuillEditor('quill-news-summary', 'news-summary-bn', {
      placeholder: 'সংক্ষেপে সংবাদটি বর্ণনা করুন (ঐচ্ছিক)',
      minHeight: '100px',
    });
  }

  if (bodyContainer) {
    window.__quillNewsBody = window.initQuillEditor('quill-news-body', 'news-content-body-bn', {
      placeholder: 'সংবাদের বিস্তারিত বিবরণ লিখুন',
      minHeight: '250px',
    });
  }

  /* Sync Quill to hidden textareas on form submit */
  const form = document.querySelector('.news-multistep-form');
  if (form) {
    form.addEventListener('submit', function () {
      if (window.__quillNewsSummary) window.__quillNewsSummary.syncToHidden();
      if (window.__quillNewsBody) window.__quillNewsBody.syncToHidden();
    });
  }

  /* SPA cleanup — destroy Quill instances to prevent duplicate IDs */
  if (window.spaCleanupRegister) {
    window.spaCleanupRegister(function () {
      window.__quillNewsSummary = null;
      window.__quillNewsBody = null;
    });
  }
})();
