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
  try { bootstrapState = JSON.parse(bootstrapNode ? bootstrapNode.textContent : '{}'); } catch (err) { bootstrapState = {}; }

  var state = { socket: null, latest: bootstrapState };

  var waitingSection = document.getElementById('mastermind-lobby-waiting');
  var playingSection = document.getElementById('mastermind-lobby-playing');
  var completedSection = document.getElementById('mastermind-lobby-completed');
  var playerCountEl = document.getElementById('mastermind-lobby-player-count');
  var playerListEl = document.getElementById('mastermind-lobby-player-list');
  var leaderboardListEl = document.getElementById('mastermind-lobby-leaderboard-list');
  var finalLeaderboardEl = document.getElementById('mastermind-lobby-final-leaderboard');
  var progressEl = document.getElementById('mastermind-lobby-progress');
  var timerEl = document.getElementById('mastermind-lobby-timer');
  var questionTextEl = document.getElementById('mastermind-lobby-question-text');
  var answerInfoEl = document.getElementById('mastermind-lobby-host-answer-info');
  var startButton = document.getElementById('mastermind-lobby-start-button');
  var nextButton = document.getElementById('mastermind-lobby-next-button');
  var startHint = document.getElementById('mastermind-lobby-host-start-hint');
  var shareUrlEl = document.getElementById('mastermind-lobby-host-share-url');
  var copyButton = document.getElementById('mastermind-lobby-host-copy-button');
  var errorElement = document.getElementById('mastermind-lobby-error');

  function _escapeHtml(text) {
    var n = document.createElement('div');
    n.textContent = text == null ? '' : String(text);
    return n.innerHTML;
  }

  function _showState(stateName) {
    [waitingSection, playingSection, completedSection].forEach(function (section) {
      if (!section) return;
      section.hidden = section.dataset.state !== stateName;
    });
  }

  function _setError(message) {
    if (!errorElement) return;
    errorElement.textContent = message || '';
    errorElement.hidden = !message;
  }

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
    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var url = protocol + '//' + window.location.host + '/ws/mastermind/lobby/' + lobbyId + '/';
    var socket = new WebSocket(url);
    state.socket = socket;
    socket.onopen = function () { _setError(''); };
    socket.onclose = function () { setTimeout(_connect, 2000); };
    socket.onmessage = function (event) {
      var msg;
      try { msg = JSON.parse(event.data); } catch (err) { return; }
      if (msg.type === 'lobby_state') {
        _applyState(msg.state);
      } else if (msg.type === 'error') {
        _setError(msg.message || 'Unknown error.');
      }
    };
  }

  function _send(payload) {
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
      _setError('Not connected. Retrying…');
      return;
    }
    state.socket.send(JSON.stringify(payload));
  }

  function _applyState(serverState) {
    if (!serverState || serverState.error) {
      _setError(serverState && serverState.error || 'Lobby unavailable.');
      return;
    }
    state.latest = serverState;
    _renderRoster(serverState.players || []);
    _renderLeaderboard(serverState.leaderboard || []);

    if (serverState.status_code === 'waiting') {
      _showState('waiting');
      _updateStartButton(serverState.players || []);
    } else if (serverState.status_code === 'playing') {
      _showState('playing');
      _renderQuestion(serverState);
    } else if (serverState.status_code === 'completed') {
      _showState('completed');
      _renderFinalLeaderboard(serverState.leaderboard || []);
    }
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
    if (playerCountEl) playerCountEl.textContent = String(players.filter(function (p) { return !p.player_has_left; }).length);
    if (!playerListEl) return;
    playerListEl.innerHTML = players.map(function (player) {
      var ready = player.player_is_ready ? '<span class="mastermind-lobby-player-ready">✅ ready</span>' : '<span class="mastermind-lobby-player-left">not ready</span>';
      var left = player.player_has_left ? '<span class="mastermind-lobby-player-left">left</span>' : '';
      return '<li class="mastermind-lobby-player-item">' +
        '<span class="mastermind-lobby-player-name">' + _escapeHtml(player.display_name || ('Player #' + player.link_user_profile_id)) + '</span>' +
        ready + left +
        '</li>';
    }).join('');
  }

  function _renderLeaderboard(leaderboard) {
    if (!leaderboardListEl) return;
    leaderboardListEl.innerHTML = leaderboard.slice(0, 10).map(function (entry, index) {
      return '<li class="mastermind-lobby-leaderboard-item">' +
        '<span class="mastermind-lobby-leaderboard-rank">' + (index + 1) + '.</span>' +
        '<span class="mastermind-lobby-leaderboard-name">' + _escapeHtml(entry.display_name || ('#' + entry.link_user_profile_id)) + '</span>' +
        '<span class="mastermind-lobby-leaderboard-score">' + (entry.player_current_score || 0).toFixed(1) + '</span>' +
        '</li>';
    }).join('');
  }

  function _renderFinalLeaderboard(leaderboard) {
    if (!finalLeaderboardEl) return;
    finalLeaderboardEl.innerHTML = leaderboard.map(function (entry, index) {
      var medal = ['🥇', '🥈', '🥉'][index] || '';
      return '<li class="mastermind-lobby-final-row">' +
        '<span class="mastermind-lobby-final-medal">' + medal + (index + 1) + '.</span>' +
        '<span class="mastermind-lobby-final-name">' + _escapeHtml(entry.display_name || ('#' + entry.link_user_profile_id)) + '</span>' +
        '<span class="mastermind-lobby-final-score">' + (entry.player_current_score || 0).toFixed(1) + ' pts</span>' +
        '<span class="mastermind-lobby-final-correct">' + (entry.player_correct_count || 0) + ' correct</span>' +
        '</li>';
    }).join('');
  }

  function _renderQuestion(serverState) {
    var question = serverState.current_question;
    if (!question) return;
    progressEl.textContent = 'Question ' + (serverState.current_question_index + 1) + ' / ' + serverState.total_questions;
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

  // Bootstrap from server-side state then connect for live updates
  _applyState(state.latest);
  _connect();
})();
