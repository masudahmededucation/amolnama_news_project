/* Mastermind multi-player lobby — host-side controller.
 *
 * Same WebSocket as the player consumer — different role. The host:
 *   - sees the join code + share link
 *   - sees the live roster (with ready flags)
 *   - clicks "Start game" once enough players are ready
 *   - clicks "Next question →" to advance everyone
 *   - sees the final leaderboard when the last question wraps
 *
 * Does NOT submit answers — the host is the controller, not a contestant.
 */
(function () {
  'use strict';

  var rootElement = document.getElementById('mastermind-lobby');
  if (!rootElement) return;
  if (rootElement.dataset.role !== 'host') return;

  var lobbyId = parseInt(rootElement.dataset.lobbyId, 10);
  var joinCode = rootElement.dataset.joinCode || '';
  var bootstrapNode = document.getElementById('mastermind-lobby-bootstrap');
  var bootstrapState = {};
  try { bootstrapState = JSON.parse(bootstrapNode ? bootstrapNode.textContent : '{}'); } catch (parseError) { bootstrapState = {}; }

  var state = { socket: null, latest: bootstrapState };

  var waitingSection = document.getElementById('mastermind-lobby-waiting');
  var playingSection = document.getElementById('mastermind-lobby-playing');
  var completedSection = document.getElementById('mastermind-lobby-completed');
  var playerCountEl = document.getElementById('mastermind-lobby-player-count');
  var playerListEl = document.getElementById('mastermind-lobby-player-list');
  var leaderboardListEl = document.getElementById('mastermind-lobby-leaderboard-list');
  var finalLeaderboardEl = document.getElementById('mastermind-lobby-final-leaderboard');
  var progressEl = document.getElementById('mastermind-lobby-progress');
  var progressTrackEl = document.getElementById('mastermind-lobby-progress-track');
  var progressFillEl = document.getElementById('mastermind-lobby-progress-fill');
  var timerEl = document.getElementById('mastermind-lobby-timer');
  var questionTextEl = document.getElementById('mastermind-lobby-question-text');
  var answerInfoEl = document.getElementById('mastermind-lobby-host-answer-info');
  var startButton = document.getElementById('mastermind-lobby-start-button');
  var nextButton = document.getElementById('mastermind-lobby-next-button');
  var startHint = document.getElementById('mastermind-lobby-host-start-hint');
  var shareUrlEl = document.getElementById('mastermind-lobby-host-share-url');
  var copyButton = document.getElementById('mastermind-lobby-host-copy-button');
  var errorElement = document.getElementById('mastermind-lobby-error');

  // Shared module — single source of truth for utility helpers + WS transport.
  // See mastermind/static/mastermind/assets/js/lobby-shared.js
  var sharedLobby = window.mastermindLobbyShared || {};
  function _setError(message) { sharedLobby.setError && sharedLobby.setError(errorElement, message); }
  function _showState(stateName) { sharedLobby.showState && sharedLobby.showState(rootElement, stateName); }
  // _escapeHtml not used directly here — sharedLobby renderers handle escaping.

  // Build absolute share URL based on current host
  if (shareUrlEl) {
    var shareUrl = window.location.protocol + '//' + window.location.host + '/play/' + joinCode + '/';
    shareUrlEl.textContent = shareUrl;
    if (copyButton) {
      copyButton.addEventListener('click', function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(function () {
            copyButton.textContent = '✅ Copied';
            setTimeout(function () { copyButton.textContent = 'Copy share link'; }, 1500);
          }, function () { copyButton.textContent = 'Copy failed'; });
        }
      });
    }
  }

  function _connect() {
    state.socket = sharedLobby.connectWebSocket({
      lobbyId: lobbyId,
      onOpen: function () { _setError(''); },
      onMessage: function (serverMessage) {
        if (serverMessage.type === 'lobby_state') _applyState(serverMessage.state);
        else if (serverMessage.type === 'error') _setError(serverMessage.message || 'Unknown error.');
      },
    });
  }

  function _send(payload) {
    sharedLobby.sendWebSocketMessage(state.socket, payload, function () {
      _setError('Not connected. Retrying…');
    });
  }

  function _playSfx(eventCode) { sharedLobby.playSfx && sharedLobby.playSfx(eventCode); }

  var previousStatusCode = null;
  var previousQuestionIndex = null;

  function _applyState(serverState) {
    if (!serverState || serverState.error) {
      _setError(serverState && serverState.error || 'Lobby unavailable.');
      return;
    }
    state.latest = serverState;
    _renderRoster(serverState.players || []);
    _renderLeaderboard(serverState.leaderboard || []);

    var statusChanged = (previousStatusCode !== serverState.status_code);
    var questionChanged = (previousQuestionIndex !== serverState.current_question_index);

    if (serverState.status_code === 'waiting') {
      _showState('waiting');
      _updateStartButton(serverState.players || []);
    } else if (serverState.status_code === 'playing') {
      _showState('playing');
      if (statusChanged) _playSfx('lobby_start');
      _renderQuestion(serverState);
      if (questionChanged && !statusChanged) _playSfx('question_advance');
    } else if (serverState.status_code === 'completed') {
      _showState('completed');
      _renderFinalLeaderboard(serverState.leaderboard || []);
      if (statusChanged) _playSfx('game_over');
    }

    previousStatusCode = serverState.status_code;
    previousQuestionIndex = serverState.current_question_index;
  }

  function _updateStartButton(players) {
    var activePlayers = players.filter(function (p) { return !p.player_has_left; });
    var readyCount = activePlayers.filter(function (p) { return p.player_is_ready; }).length;
    var canStart = activePlayers.length >= 1 && readyCount >= 1;
    if (startButton) startButton.disabled = !canStart;
    if (startHint) {
      startHint.textContent = canStart
        ? readyCount + ' / ' + activePlayers.length + ' ready — start when you wish.'
        : 'Waiting for at least 1 player to mark themselves ready…';
    }
  }

  function _renderRoster(players) {
    if (playerCountEl) {
      playerCountEl.textContent = String(
        players.filter(function (player) { return !player.player_has_left; }).length
      );
    }
    sharedLobby.renderRoster(playerListEl, players, { showNotReadyBadge: true });
  }

  function _renderLeaderboard(leaderboard) {
    sharedLobby.renderLeaderboard(leaderboardListEl, leaderboard, 10);
  }

  function _renderFinalLeaderboard(leaderboard) {
    sharedLobby.renderFinalLeaderboard(finalLeaderboardEl, leaderboard);
  }

  function _renderQuestion(serverState) {
    var question = serverState.current_question;
    if (!question) return;
    progressEl.textContent = 'Question ' + (serverState.current_question_index + 1) + ' / ' + serverState.total_questions;
    sharedLobby.updateProgressBar(
      progressTrackEl, progressFillEl,
      serverState.current_question_index, serverState.total_questions,
    );
    questionTextEl.textContent = question.question_text_bn || question.question_text_en || '';

    if (serverState.question_seconds) {
      timerEl.hidden = false;
      timerEl.textContent = serverState.question_seconds + 's';
    } else {
      timerEl.hidden = true;
    }

    var totalActive = (serverState.players || []).filter(function (p) { return !p.player_has_left; }).length;
    answerInfoEl.textContent = totalActive + ' players in lobby. Click "Next question" when ready.';

    nextButton.textContent = (serverState.current_question_index + 1 >= serverState.total_questions)
      ? 'Finish quiz'
      : 'Next question →';
  }

  if (startButton) {
    startButton.addEventListener('click', function () {
      startButton.disabled = true;
      startButton.textContent = 'Starting…';
      _send({ type: 'start_lobby' });
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', function () {
      _send({
        type: 'advance_question',
        expected_index: state.latest && state.latest.current_question_index,
      });
    });
  }

  // Sound-effects mute toggle (single source of truth in lobby-sfx.js)
  if (window.mastermindLobbySfx && typeof window.mastermindLobbySfx.wireToggleButton === 'function') {
    window.mastermindLobbySfx.wireToggleButton(document.getElementById('mastermind-lobby-sfx-toggle'));
  }

  // Bootstrap from server-side state then connect for live updates
  _applyState(state.latest);
  _connect();
})();
