/* Mastermind multi-player lobby — shared helpers used by both player + host.
 *
 * Single source of truth for the utility code that lobby-player.js and
 * lobby-host.js were duplicating verbatim before this module existed:
 *   - escapeHtml / setError / showState   (DOM helpers)
 *   - connectWebSocket / sendWebSocketMessage   (WS transport)
 *   - playSfx                              (null-safe sound wrapper)
 *   - renderLeaderboard / renderFinalLeaderboard / renderRoster   (DOM renderers)
 *
 * Loaded BEFORE lobby-player.js / lobby-host.js. Both consumer files use
 * window.mastermindLobbyShared.* — they don't redefine any of these helpers.
 *
 * Each renderer accepts an explicit DOM target so the same function works
 * against the host page's roster element and the player page's roster element
 * with no hidden globals.
 */
(function () {
  'use strict';

  if (window.mastermindLobbyShared) return; // idempotent

  // ----- DOM helpers ----------------------------------------------------
  function escapeHtml(text) {
    var helperDiv = document.createElement('div');
    helperDiv.textContent = text == null ? '' : String(text);
    return helperDiv.innerHTML;
  }

  function setError(targetElement, message) {
    if (!targetElement) return;
    targetElement.textContent = message || '';
    targetElement.hidden = !message;
  }

  function showState(rootElement, stateName) {
    if (!rootElement) return;
    rootElement.querySelectorAll('.mastermind-lobby-state').forEach(function (section) {
      section.hidden = section.dataset.state !== stateName;
    });
  }

  // ----- WebSocket transport -------------------------------------------
  /**
   * Open a WebSocket to /ws/mastermind/lobby/<lobbyId>/ and wire its handlers.
   * Returns the socket instance. Auto-reconnects after 2s on close (no
   * cooldown limit — the user wants to stay in the room until they explicitly leave).
   */
  function connectWebSocket(options) {
    var lobbyId = options.lobbyId;
    var onMessage = options.onMessage;
    var onOpen = options.onOpen;
    var onClose = options.onClose;
    var onError = options.onError;

    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var url = protocol + '//' + window.location.host + '/ws/mastermind/lobby/' + lobbyId + '/';
    var socket = new WebSocket(url);

    socket.onopen = function () { if (onOpen) onOpen(socket); };
    socket.onclose = function () {
      if (onClose) onClose(socket);
      setTimeout(function () { connectWebSocket(options); }, 2000);
    };
    socket.onerror = function () { if (onError) onError(socket); };
    socket.onmessage = function (websocketEvent) {
      var serverMessage;
      try { serverMessage = JSON.parse(websocketEvent.data); } catch (parseError) { return; }
      if (onMessage) onMessage(serverMessage);
    };
    return socket;
  }

  function sendWebSocketMessage(socket, payload, onNotConnected) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      if (onNotConnected) onNotConnected();
      return false;
    }
    socket.send(JSON.stringify(payload));
    return true;
  }

  // ----- Null-safe SFX wrapper -----------------------------------------
  function playSfx(eventCode) {
    if (window.mastermindLobbySfx && typeof window.mastermindLobbySfx.play === 'function') {
      window.mastermindLobbySfx.play(eventCode);
    }
  }

  // ----- Renderers ------------------------------------------------------
  /**
   * Render the live leaderboard sidebar (top-N entries).
   * Same impl on host + player.
   */
  function renderLeaderboard(listElement, leaderboard, limit) {
    if (!listElement) return;
    var topEntries = (leaderboard || []).slice(0, limit || 10);
    listElement.innerHTML = topEntries.map(function (entry, entryIndex) {
      return '<li class="mastermind-lobby-leaderboard-item">' +
        '<span class="mastermind-lobby-leaderboard-rank">' + (entryIndex + 1) + '.</span>' +
        '<span class="mastermind-lobby-leaderboard-name">' + escapeHtml(entry.display_name || ('#' + entry.link_user_profile_id)) + '</span>' +
        '<span class="mastermind-lobby-leaderboard-score">' + (entry.player_current_score || 0).toFixed(1) + '</span>' +
        '</li>';
    }).join('');
  }

  /**
   * Render the final podium (game over screen).
   * Same impl on host + player.
   */
  function renderFinalLeaderboard(listElement, leaderboard) {
    if (!listElement) return;
    listElement.innerHTML = (leaderboard || []).map(function (entry, entryIndex) {
      var medal = ['🥇', '🥈', '🥉'][entryIndex] || '';
      return '<li class="mastermind-lobby-final-row">' +
        '<span class="mastermind-lobby-final-medal">' + medal + (entryIndex + 1) + '.</span>' +
        '<span class="mastermind-lobby-final-name">' + escapeHtml(entry.display_name || ('#' + entry.link_user_profile_id)) + '</span>' +
        '<span class="mastermind-lobby-final-score">' + (entry.player_current_score || 0).toFixed(1) + ' pts</span>' +
        '<span class="mastermind-lobby-final-correct">' + (entry.player_correct_count || 0) + ' correct</span>' +
        '</li>';
    }).join('');
  }

  /**
   * Render the player roster (waiting-room list).
   *
   * showNotReadyBadge=true (host view) shows "not ready" for unready players
   * so the host can see who's holding up the start.
   * showNotReadyBadge=false (player view) shows only "✅ ready" for ready
   * players — cleaner / less noisy.
   */
  function renderRoster(listElement, players, options) {
    if (!listElement) return;
    var safeOptions = options || {};
    var showNotReadyBadge = !!safeOptions.showNotReadyBadge;
    listElement.innerHTML = (players || []).map(function (player) {
      var readyBadge = player.player_is_ready
        ? '<span class="mastermind-lobby-player-ready">✅ ready</span>'
        : (showNotReadyBadge ? '<span class="mastermind-lobby-player-left">not ready</span>' : '');
      var leftBadge = player.player_has_left ? '<span class="mastermind-lobby-player-left">left</span>' : '';
      return '<li class="mastermind-lobby-player-item">' +
        '<span class="mastermind-lobby-player-name">' +
          escapeHtml(player.display_name || ('Player #' + player.link_user_profile_id)) +
        '</span>' +
        readyBadge + leftBadge +
        '</li>';
    }).join('');
  }

  /**
   * Update the quiz-level progress bar fill.
   * Returns the percent computed (0-100) for caller convenience.
   */
  function updateProgressBar(trackElement, fillElement, currentIndex, totalQuestions) {
    if (!trackElement || !fillElement || !totalQuestions) return 0;
    var completedPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);
    fillElement.style.width = completedPercent + '%';
    trackElement.setAttribute('aria-valuenow', String(completedPercent));
    return completedPercent;
  }

  window.mastermindLobbyShared = {
    escapeHtml: escapeHtml,
    setError: setError,
    showState: showState,
    connectWebSocket: connectWebSocket,
    sendWebSocketMessage: sendWebSocketMessage,
    playSfx: playSfx,
    renderLeaderboard: renderLeaderboard,
    renderFinalLeaderboard: renderFinalLeaderboard,
    renderRoster: renderRoster,
    updateProgressBar: updateProgressBar,
  };
})();
