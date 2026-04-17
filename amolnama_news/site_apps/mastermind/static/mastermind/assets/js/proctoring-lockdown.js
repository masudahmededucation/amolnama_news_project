/* Mastermind quiz proctoring — Phase 1 (browser lockdown only).
 *
 * ZERO IMAGES policy: this file does NOT access the camera, microphone, or
 * any media device. It only watches browser-level events (tab switch, copy,
 * paste, fullscreen exit) and POSTs text events to the server.
 *
 * Usage: include this script on a quiz-taking page and call:
 *
 *   window.mastermindProctoring.start({
 *     sessionId: 123,
 *     quizId: 45,
 *     proctoringLevel: 1,            // 0 = off, 1 = lockdown, 2 = full AI (Phase 2)
 *     csrfToken: '...',              // from {% csrf_token %}
 *     logEndpoint: '/mastermind/api/proctoring/log-violation/',
 *     onWarning: function (state) { ... },     // optional
 *     onTerminate: function (state) { ... },   // optional
 *     onError: function (error) { ... }        // optional
 *   });
 */
(function () {
  'use strict';

  var DEFAULT_LOG_ENDPOINT = '/mastermind/api/proctoring/log-violation/';
  var FULLSCREEN_RECHECK_INTERVAL_MS = 2000;
  var MIN_VIOLATION_INTERVAL_MS = 1500;  // throttle: ignore same type within this window

  var state = {
    started: false,
    sessionId: null,
    quizId: null,
    level: 0,
    csrfToken: '',
    logEndpoint: DEFAULT_LOG_ENDPOINT,
    onWarning: null,
    onTerminate: null,
    onError: null,
    lastViolationByType: {},
    fullscreenRecheckTimer: null,
    eventListeners: [],
  };

  function _addListener(target, eventName, handler, options) {
    target.addEventListener(eventName, handler, options || false);
    state.eventListeners.push({ target: target, eventName: eventName, handler: handler });
  }

  function _removeAllListeners() {
    state.eventListeners.forEach(function (entry) {
      entry.target.removeEventListener(entry.eventName, entry.handler);
    });
    state.eventListeners = [];
  }

  function _shouldThrottle(violationTypeCode) {
    var lastTime = state.lastViolationByType[violationTypeCode] || 0;
    var now = Date.now();
    if (now - lastTime < MIN_VIOLATION_INTERVAL_MS) return true;
    state.lastViolationByType[violationTypeCode] = now;
    return false;
  }

  function _logViolation(violationTypeCode, details) {
    if (_shouldThrottle(violationTypeCode)) return;

    var payload = {
      session_id: state.sessionId,
      quiz_id: state.quizId,
      violation_type_code: violationTypeCode,
      violation_details: details || null,
      violation_client_reported_at: new Date().toISOString(),
    };

    fetch(state.logEndpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': state.csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    })
      .then(function (response) { return response.json().catch(function () { return {}; }); })
      .then(function (body) {
        if (!body || !body.success) {
          if (typeof state.onError === 'function') state.onError(body && body.error);
          return;
        }
        if (body.should_terminate && typeof state.onTerminate === 'function') {
          state.onTerminate(body);
          return;
        }
        if (body.status === 'warned' && typeof state.onWarning === 'function') {
          state.onWarning(body);
        }
      })
      .catch(function (networkError) {
        if (typeof state.onError === 'function') state.onError(networkError);
      });
  }

  function _onVisibilityChange() {
    if (document.hidden) _logViolation('tab_switch', 'Tab hidden / switched');
  }

  function _onWindowBlur() {
    _logViolation('window_blur', 'Window lost focus');
  }

  function _onCopyAttempt(event) {
    event.preventDefault();
    _logViolation('copy_blocked', 'Copy attempt blocked');
  }

  function _onPasteAttempt(event) {
    event.preventDefault();
    _logViolation('paste_blocked', 'Paste attempt blocked');
  }

  function _onContextMenu(event) {
    event.preventDefault();
    _logViolation('context_menu', 'Right-click blocked');
  }

  function _onKeyDown(event) {
    var blocked = false;
    if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C')) blocked = true;
    if ((event.ctrlKey || event.metaKey) && (event.key === 'v' || event.key === 'V')) blocked = true;
    if ((event.ctrlKey || event.metaKey) && (event.key === 'p' || event.key === 'P')) blocked = true;
    if ((event.ctrlKey || event.metaKey) && (event.key === 'u' || event.key === 'U')) blocked = true;
    if ((event.ctrlKey || event.shiftKey) && (event.key === 'i' || event.key === 'I')) blocked = true;
    if (event.key === 'PrintScreen') blocked = true;
    if (blocked) {
      event.preventDefault();
      _logViolation('key_blocked', 'Blocked shortcut: ' + event.key);
    }
  }

  function _onFullscreenChange() {
    var inFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!inFullscreen && state.started) {
      _logViolation('fullscreen_exit', 'Exited fullscreen');
    }
  }

  function _ensureFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    var element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(function () { /* user gesture required */ });
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    }
  }

  function start(config) {
    if (state.started) return;
    if (!config || !config.sessionId || !config.quizId) {
      throw new Error('mastermindProctoring.start requires sessionId and quizId.');
    }
    if (!config.proctoringLevel || config.proctoringLevel < 1) return;  // off

    state.started = true;
    state.sessionId = config.sessionId;
    state.quizId = config.quizId;
    state.level = config.proctoringLevel;
    state.csrfToken = config.csrfToken || '';
    state.logEndpoint = config.logEndpoint || DEFAULT_LOG_ENDPOINT;
    state.onWarning = typeof config.onWarning === 'function' ? config.onWarning : null;
    state.onTerminate = typeof config.onTerminate === 'function' ? config.onTerminate : null;
    state.onError = typeof config.onError === 'function' ? config.onError : null;

    _addListener(document, 'visibilitychange', _onVisibilityChange);
    _addListener(window, 'blur', _onWindowBlur);
    _addListener(document, 'copy', _onCopyAttempt);
    _addListener(document, 'paste', _onPasteAttempt);
    _addListener(document, 'contextmenu', _onContextMenu);
    _addListener(document, 'keydown', _onKeyDown);
    _addListener(document, 'fullscreenchange', _onFullscreenChange);
    _addListener(document, 'webkitfullscreenchange', _onFullscreenChange);

    state.fullscreenRecheckTimer = setInterval(_ensureFullscreen, FULLSCREEN_RECHECK_INTERVAL_MS);
    _ensureFullscreen();
  }

  function stop() {
    if (!state.started) return;
    state.started = false;
    if (state.fullscreenRecheckTimer) {
      clearInterval(state.fullscreenRecheckTimer);
      state.fullscreenRecheckTimer = null;
    }
    _removeAllListeners();
  }

  window.mastermindProctoring = {
    start: start,
    stop: stop,
  };
})();
