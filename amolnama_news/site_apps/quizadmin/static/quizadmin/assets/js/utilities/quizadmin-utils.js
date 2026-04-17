/* Shared utilities for all quizadmin pages.
 * Loaded via base_quizadmin.html → quizadmin_top_nav.html partial.
 * Single source of truth — page scripts must use these, never local copies.
 */
(function () {
  'use strict';

  window.quizadminReadJson = function (elementId, fallback) {
    var defaultValue = fallback !== undefined ? fallback : null;
    var node = document.getElementById(elementId);
    if (!node) return defaultValue;
    try {
      var parsed = JSON.parse(node.textContent);
      if (parsed === null || parsed === undefined || parsed === '') return defaultValue;
      // If caller expects an array, ensure we return an array
      if (Array.isArray(fallback) && !Array.isArray(parsed)) return defaultValue;
      return parsed;
    } catch { return defaultValue; }
  };

  window.quizadminShowInline = function (messageElement, text, tone) {
    if (!messageElement) return;
    messageElement.textContent = text;
    messageElement.dataset.tone = tone;
    messageElement.hidden = false;
  };

  window.quizadminHideInline = function (messageElement) {
    if (!messageElement) return;
    messageElement.hidden = true;
  };

  window.quizadminSetLoading = function (buttonElement, isLoading, originalText) {
    if (!buttonElement) return;
    buttonElement.disabled = isLoading;
    if (isLoading) {
      buttonElement.dataset.originalText = buttonElement.textContent;
      buttonElement.textContent = 'Saving\u2026';
      buttonElement.classList.add('quizadmin-button-loading');
    } else {
      buttonElement.textContent = originalText || buttonElement.dataset.originalText || 'Save';
      buttonElement.classList.remove('quizadmin-button-loading');
    }
  };

  window.quizadminPost = async function (endpoint, payload) {
    var csrfToken = window.getCsrfTokenValue ? window.getCsrfTokenValue() : '';
    var response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      body: JSON.stringify(payload),
    });
    var body = await response.json().catch(function () { return {}; });
    if (!response.ok || body.error) {
      throw new Error(body.error || 'Request failed (HTTP ' + response.status + ')');
    }
    return body;
  };

  // GET helper for read-only endpoints (book chapter text fetch, etc.).
  // Same error semantics as quizadminPost so callers handle both consistently.
  window.quizadminGet = async function (endpoint) {
    var response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
    });
    var body = await response.json().catch(function () { return {}; });
    if (!response.ok || body.error) {
      throw new Error(body.error || 'Request failed (HTTP ' + response.status + ')');
    }
    return body;
  };

  window.quizadminGenerateToken = function () {
    return Math.random().toString(36).slice(2, 8);
  };

  window.quizadminTrackUnsavedChanges = function (formElement) {
    if (!formElement) return;
    var isDirty = false;
    formElement.addEventListener('input', function () { isDirty = true; });
    formElement.addEventListener('change', function () { isDirty = true; });
    formElement.addEventListener('submit', function () { isDirty = false; });
    window.addEventListener('beforeunload', function (event) {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  };

  window.QUIZADMIN_BENGALI_LABELS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ'];

  window.quizadminEscapeHtml = function (value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
})();
