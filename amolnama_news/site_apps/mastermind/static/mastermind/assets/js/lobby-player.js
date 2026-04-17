/* Mastermind multi-player lobby — player-side controller.
 *
 * Connects to /ws/mastermind/lobby/<id>/ and reflects the server's broadcast
 * state. All actions go through the WebSocket; no per-action HTTP calls.
 *
 * Boots from the bootstrap JSON island #mastermind-lobby-bootstrap so the
 * first paint is correct even if the WebSocket is slow to open.
 *
 * Supported question types: same 8 as the solo take page.
 */
(function () {
  'use strict';

  var rootElement = document.getElementById('mastermind-lobby');
  if (!rootElement) return;

  var lobbyId = parseInt(rootElement.dataset.lobbyId, 10);
  var role = rootElement.dataset.role || 'player';
  var bootstrapNode = document.getElementById('mastermind-lobby-bootstrap');
  var bootstrapState = null;
  try {
    bootstrapState = JSON.parse(bootstrapNode ? bootstrapNode.textContent : '{}');
  } catch (error) {
    bootstrapState = {};
  }

  // --- in-memory state -------------------------------------------
  var state = {
    socket: null,
    latest: bootstrapState || {},
    currentAnswer: null,
    answerLockedFor: null,        // question_index of the most recent submission
    timerHandle: null,
    questionDeadlineMs: null,
    statusElement: document.getElementById('mastermind-lobby-status'),
    errorElement: document.getElementById('mastermind-lobby-error'),
  };

  // --- DOM refs ---------------------------------------------------
  var waitingSection = document.getElementById('mastermind-lobby-waiting');
  var playingSection = document.getElementById('mastermind-lobby-playing');
  var completedSection = document.getElementById('mastermind-lobby-completed');
  var readyButton = document.getElementById('mastermind-lobby-ready-button');
  var playerCountEl = document.getElementById('mastermind-lobby-player-count');
  var playerListEl = document.getElementById('mastermind-lobby-player-list');
  var leaderboardListEl = document.getElementById('mastermind-lobby-leaderboard-list');
  var finalLeaderboardEl = document.getElementById('mastermind-lobby-final-leaderboard');
  var progressEl = document.getElementById('mastermind-lobby-progress');
  var timerEl = document.getElementById('mastermind-lobby-timer');
  var questionTextEl = document.getElementById('mastermind-lobby-question-text');
  var questionImageEl = document.getElementById('mastermind-lobby-question-image');
  var answerRegion = document.getElementById('mastermind-lobby-answer-region');
  var answerStatus = document.getElementById('mastermind-lobby-answer-status');
  var submitAnswerButton = document.getElementById('mastermind-lobby-submit-answer-button');

  // --- helpers ----------------------------------------------------
  function _escapeHtml(text) {
    var node = document.createElement('div');
    node.textContent = text == null ? '' : String(text);
    return node.innerHTML;
  }

  function _setError(message) {
    if (!state.errorElement) return;
    state.errorElement.textContent = message || '';
    state.errorElement.hidden = !message;
  }

  function _setStatus(text) {
    if (state.statusElement) state.statusElement.textContent = text;
  }

  function _showState(stateName) {
    [waitingSection, playingSection, completedSection].forEach(function (section) {
      if (!section) return;
      section.hidden = section.dataset.state !== stateName;
    });
  }

  // --- websocket --------------------------------------------------
  function _connect() {
    if (state.socket && state.socket.readyState === WebSocket.OPEN) return;
    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var url = protocol + '//' + window.location.host + '/ws/mastermind/lobby/' + lobbyId + '/';
    var socket = new WebSocket(url);
    state.socket = socket;

    socket.onopen = function () {
      _setStatus('Connected');
      _setError('');
    };
    socket.onclose = function () {
      _setStatus('Disconnected — retrying…');
      setTimeout(_connect, 2000);
    };
    socket.onerror = function () {
      _setStatus('Connection error');
    };
    socket.onmessage = function (event) {
      var msg;
      try { msg = JSON.parse(event.data); } catch (err) { return; }
      if (msg.type === 'lobby_state') {
        _applyState(msg.state);
      } else if (msg.type === 'answer_result') {
        _showAnswerResult(msg);
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

  // --- state application ------------------------------------------
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
      _setStatus('Waiting for host to start');
    } else if (serverState.status_code === 'playing') {
      _showState('playing');
      _renderQuestion(serverState);
    } else if (serverState.status_code === 'completed') {
      _showState('completed');
      _renderFinalLeaderboard(serverState.leaderboard || []);
      _setStatus('Game over');
      if (state.timerHandle) clearInterval(state.timerHandle);
    }
  }

  function _renderRoster(players) {
    if (playerCountEl) playerCountEl.textContent = String(players.length);
    if (!playerListEl) return;
    playerListEl.innerHTML = players.map(function (player) {
      var readyBadge = player.player_is_ready ? '<span class="mastermind-lobby-player-ready">✅ ready</span>' : '';
      var leftBadge = player.player_has_left ? '<span class="mastermind-lobby-player-left">left</span>' : '';
      return '<li class="mastermind-lobby-player-item">' +
        '<span class="mastermind-lobby-player-name">' + _escapeHtml(player.display_name || ('Player #' + player.link_user_profile_id)) + '</span>' +
        readyBadge + leftBadge +
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

  // --- question rendering ----------------------------------------
  function _renderQuestion(serverState) {
    var question = serverState.current_question;
    var questionIndex = serverState.current_question_index;
    if (!question) return;

    // Reset state when a new question arrives
    if (state.answerLockedFor !== questionIndex) {
      state.currentAnswer = null;
      state.answerLockedFor = null;
      if (answerStatus) { answerStatus.hidden = true; answerStatus.textContent = ''; }
      if (submitAnswerButton) {
        submitAnswerButton.disabled = false;
        submitAnswerButton.textContent = 'Lock in answer';
      }
    }

    if (progressEl) progressEl.textContent = 'Question ' + (questionIndex + 1) + ' / ' + serverState.total_questions;
    if (questionTextEl) questionTextEl.textContent = question.question_text_bn || question.question_text_en || '';
    if (questionImageEl) {
      if (question.question_image_url) {
        questionImageEl.src = question.question_image_url;
        questionImageEl.hidden = false;
      } else {
        questionImageEl.hidden = true;
      }
    }

    if (answerRegion && state.answerLockedFor !== questionIndex) {
      answerRegion.innerHTML = '';
      var renderer = QUESTION_TYPE_RENDERERS[question.question_type_code] || _renderUnsupportedType;
      renderer(question);
    }

    // Server-driven timer
    if (state.timerHandle) clearInterval(state.timerHandle);
    if (serverState.question_seconds && serverState.question_started_at) {
      var startedAtMs = Date.parse(serverState.question_started_at);
      state.questionDeadlineMs = startedAtMs + serverState.question_seconds * 1000;
      timerEl.hidden = false;
      _tickTimer();
      state.timerHandle = setInterval(_tickTimer, 1000);
    } else {
      timerEl.hidden = true;
    }
  }

  function _tickTimer() {
    if (!state.questionDeadlineMs) return;
    var remainingMs = Math.max(0, state.questionDeadlineMs - Date.now());
    var seconds = Math.ceil(remainingMs / 1000);
    timerEl.textContent = seconds + 's';
    if (remainingMs <= 0) {
      clearInterval(state.timerHandle);
      // Auto-submit whatever the user has so far (if anything)
      if (state.currentAnswer && state.answerLockedFor === null) _submitAnswer();
    }
  }

  // Same dispatch table as the solo take page (ported)
  var QUESTION_TYPE_RENDERERS = {
    'mcq_single':   _renderRadioGroup,
    'true_false':   _renderRadioGroup,
    'mcq_multi':    _renderCheckboxGroup,
    'fill_blank':   _renderFillBlank,
    'short_answer': _renderTextarea,
    'essay':        _renderTextarea,
    'ordering':     _renderOrdering,
    'matching':     _renderMatching,
  };

  function _renderRadioGroup(question) {
    (question.options || []).forEach(function (option) {
      var inputId = 'mastermind-lobby-option-' + option.option_id;
      var label = document.createElement('label');
      label.className = 'mastermind-lobby-option';
      label.htmlFor = inputId;
      label.innerHTML =
        '<input type="radio" id="' + inputId + '" name="lobby_answer" value="' + option.option_id + '">' +
        '<span class="mastermind-lobby-option-label">' + _escapeHtml(option.option_label) + '.</span>' +
        '<span>' + _escapeHtml(option.option_text_bn || option.option_text_en || '') + '</span>';
      label.addEventListener('change', function () {
        state.currentAnswer = { selected_option_id: parseInt(option.option_id, 10) };
      });
      answerRegion.appendChild(label);
    });
  }

  function _renderCheckboxGroup(question) {
    var selected = new Set();
    (question.options || []).forEach(function (option) {
      var inputId = 'mastermind-lobby-option-' + option.option_id;
      var label = document.createElement('label');
      label.className = 'mastermind-lobby-option';
      label.htmlFor = inputId;
      label.innerHTML =
        '<input type="checkbox" id="' + inputId + '" name="lobby_answer" value="' + option.option_id + '">' +
        '<span class="mastermind-lobby-option-label">' + _escapeHtml(option.option_label) + '.</span>' +
        '<span>' + _escapeHtml(option.option_text_bn || option.option_text_en || '') + '</span>';
      label.querySelector('input').addEventListener('change', function (event) {
        if (event.target.checked) selected.add(option.option_id);
        else selected.delete(option.option_id);
        state.currentAnswer = { selected_option_id: Array.from(selected).join(',') };
      });
      answerRegion.appendChild(label);
    });
  }

  function _renderFillBlank() {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'mastermind-lobby-text-input';
    input.id = 'mastermind-lobby-fill-blank-input';
    input.name = 'mastermind_lobby_fill_blank_input';
    input.placeholder = 'Type your answer';
    input.addEventListener('input', function () {
      state.currentAnswer = { fill_blank_answer_text: input.value };
    });
    answerRegion.appendChild(input);
    input.focus();
  }

  function _renderTextarea() {
    var textarea = document.createElement('textarea');
    textarea.className = 'mastermind-lobby-textarea';
    textarea.id = 'mastermind-lobby-text-answer';
    textarea.name = 'mastermind_lobby_text_answer';
    textarea.placeholder = 'Write your answer';
    textarea.addEventListener('input', function () {
      state.currentAnswer = { short_answer_text: textarea.value };
    });
    answerRegion.appendChild(textarea);
  }

  function _renderOrdering(question) {
    var shuffled = (question.options || []).slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }
    var orderedIds = shuffled.map(function (o) { return o.option_id; });
    var listElement = document.createElement('ol');
    listElement.className = 'mastermind-lobby-ordering-list';
    answerRegion.appendChild(listElement);
    function _refresh() {
      listElement.innerHTML = '';
      orderedIds.forEach(function (optionId, index) {
        var option = (question.options || []).find(function (o) { return o.option_id === optionId; });
        if (!option) return;
        var item = document.createElement('li');
        item.className = 'mastermind-lobby-ordering-item';
        item.innerHTML =
          '<span class="mastermind-lobby-ordering-position">' + (index + 1) + '.</span>' +
          '<span class="mastermind-lobby-ordering-text">' + _escapeHtml(option.option_text_bn || option.option_text_en || '') + '</span>' +
          '<button type="button" class="mastermind-lobby-ordering-button" data-direction="up"' + (index === 0 ? ' disabled' : '') + ' aria-label="Move up">↑</button>' +
          '<button type="button" class="mastermind-lobby-ordering-button" data-direction="down"' + (index === orderedIds.length - 1 ? ' disabled' : '') + ' aria-label="Move down">↓</button>';
        item.querySelectorAll('button').forEach(function (button) {
          button.addEventListener('click', function () {
            var dir = button.dataset.direction;
            var swapWith = dir === 'up' ? index - 1 : index + 1;
            if (swapWith < 0 || swapWith >= orderedIds.length) return;
            var tmp = orderedIds[index]; orderedIds[index] = orderedIds[swapWith]; orderedIds[swapWith] = tmp;
            state.currentAnswer = { ordering_option_ids: orderedIds.slice() };
            _refresh();
          });
        });
        listElement.appendChild(item);
      });
    }
    _refresh();
    state.currentAnswer = { ordering_option_ids: orderedIds.slice() };
  }

  function _renderMatching(question) {
    var stems = question.match_stems || [];
    var responses = question.match_responses || [];
    if (!stems.length || !responses.length) {
      _renderUnsupportedType(question);
      return;
    }
    var picks = {};
    function _sync() {
      state.currentAnswer = {
        matching_pairs: stems.map(function (stem) {
          return {
            stem_pair_id: stem.pair_id,
            response_pair_id: picks[stem.pair_id] || null,
          };
        }),
      };
    }
    var list = document.createElement('ul');
    list.className = 'mastermind-lobby-matching-list';
    answerRegion.appendChild(list);
    stems.forEach(function (stem) {
      var row = document.createElement('li');
      row.className = 'mastermind-lobby-matching-row';
      var stemSpan = document.createElement('span');
      stemSpan.className = 'mastermind-lobby-matching-stem';
      stemSpan.textContent = stem.stem_text_bn || stem.stem_text_en || '';
      var selectId = 'mastermind-lobby-matching-' + stem.pair_id;
      var select = document.createElement('select');
      select.className = 'mastermind-lobby-matching-select';
      select.id = selectId;
      select.name = selectId;
      var placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Pick a match…';
      select.appendChild(placeholder);
      responses.forEach(function (response) {
        var opt = document.createElement('option');
        opt.value = String(response.pair_id);
        opt.textContent = response.response_text_bn || response.response_text_en || '';
        select.appendChild(opt);
      });
      select.addEventListener('change', function () {
        if (select.value) picks[stem.pair_id] = parseInt(select.value, 10);
        else delete picks[stem.pair_id];
        _sync();
      });
      row.appendChild(stemSpan);
      row.appendChild(select);
      list.appendChild(row);
    });
    _sync();
  }

  function _renderUnsupportedType(question) {
    answerRegion.innerHTML = '<p class="mastermind-lobby-error">Question type "' + _escapeHtml(question.question_type_code) + '" not supported in lobby yet.</p>';
  }

  // --- actions ----------------------------------------------------
  if (readyButton) {
    readyButton.addEventListener('click', function () {
      var nextReady = readyButton.getAttribute('aria-pressed') !== 'true';
      readyButton.setAttribute('aria-pressed', nextReady ? 'true' : 'false');
      readyButton.textContent = nextReady ? '✅ Ready — waiting for others' : "I'm ready";
      _send({ type: 'ready', is_ready: nextReady });
    });
  }

  if (submitAnswerButton) {
    submitAnswerButton.addEventListener('click', _submitAnswer);
  }

  function _submitAnswer() {
    if (!state.latest || !state.latest.current_question) return;
    if (state.answerLockedFor === state.latest.current_question_index) return;
    if (!state.currentAnswer) {
      _setError('Pick an answer first.');
      return;
    }
    submitAnswerButton.disabled = true;
    submitAnswerButton.textContent = 'Locked in';
    state.answerLockedFor = state.latest.current_question_index;
    _send({
      type: 'submit_answer',
      question_index: state.latest.current_question_index,
      answer: state.currentAnswer,
    });
  }

  function _showAnswerResult(result) {
    if (!answerStatus) return;
    if (result.is_correct) {
      answerStatus.textContent = '✅ Correct — +' + (result.points_earned || 0).toFixed(1) + ' pts';
    } else {
      answerStatus.textContent = '❌ Not correct — wait for next question.';
    }
    answerStatus.hidden = false;
  }

  // --- bootstrap --------------------------------------------------
  _applyState(state.latest);
  _connect();
})();
