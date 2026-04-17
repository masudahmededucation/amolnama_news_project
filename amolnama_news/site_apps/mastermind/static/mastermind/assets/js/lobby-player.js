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
  } catch (parseError) {
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
    var helperDiv = document.createElement('div');
    helperDiv.textContent = text == null ? '' : String(text);
    return helperDiv.innerHTML;
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
    socket.onmessage = function (websocketEvent) {
      var serverMessage;
      try { serverMessage = JSON.parse(websocketEvent.data); } catch (parseError) { return; }
      if (serverMessage.type === 'lobby_state') {
        _applyState(serverMessage.state);
      } else if (serverMessage.type === 'answer_result') {
        _showAnswerResult(serverMessage);
        _applyState(serverMessage.state);
      } else if (serverMessage.type === 'error') {
        _setError(serverMessage.message || 'Unknown error.');
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

  // --- sound-effects helper (no-op when window.mastermindLobbySfx absent) ---
  function _playSfx(eventCode) {
    if (window.mastermindLobbySfx && typeof window.mastermindLobbySfx.play === 'function') {
      window.mastermindLobbySfx.play(eventCode);
    }
  }

  // --- state application ------------------------------------------
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
      _setStatus('Waiting for host to start');
    } else if (serverState.status_code === 'playing') {
      _showState('playing');
      if (statusChanged) _playSfx('lobby_start');
      _renderQuestion(serverState);
      if (questionChanged && !statusChanged) _playSfx('question_advance');
    } else if (serverState.status_code === 'completed') {
      _showState('completed');
      _renderFinalLeaderboard(serverState.leaderboard || []);
      _setStatus('Game over');
      if (state.timerHandle) clearInterval(state.timerHandle);
      if (statusChanged) _playSfx('game_over');
    }

    previousStatusCode = serverState.status_code;
    previousQuestionIndex = serverState.current_question_index;
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

    // Reset per-question timer warnings so each question replays beeps independently
    lastTimerSecondsAnnounced = null;

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

  var lastTimerSecondsAnnounced = null;
  function _tickTimer() {
    if (!state.questionDeadlineMs) return;
    var remainingMs = Math.max(0, state.questionDeadlineMs - Date.now());
    var seconds = Math.ceil(remainingMs / 1000);
    timerEl.textContent = seconds + 's';

    // Urgency: warning at <=10s, critical (red + faster pulse + soft beep) at <=5s
    timerEl.classList.remove('mastermind-lobby-timer-warning', 'mastermind-lobby-timer-critical');
    if (seconds <= 5 && seconds > 0) {
      timerEl.classList.add('mastermind-lobby-timer-critical');
      if (seconds !== lastTimerSecondsAnnounced) _playSfx('time_warning');
    } else if (seconds <= 10) {
      timerEl.classList.add('mastermind-lobby-timer-warning');
    }
    lastTimerSecondsAnnounced = seconds;

    if (remainingMs <= 0) {
      clearInterval(state.timerHandle);
      _playSfx('time_up');
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
    var shuffledOptions = (question.options || []).slice();
    // Fisher-Yates shuffle so each player sees a different starting order
    for (var sourceIndex = shuffledOptions.length - 1; sourceIndex > 0; sourceIndex--) {
      var swapIndex = Math.floor(Math.random() * (sourceIndex + 1));
      var swapBuffer = shuffledOptions[sourceIndex];
      shuffledOptions[sourceIndex] = shuffledOptions[swapIndex];
      shuffledOptions[swapIndex] = swapBuffer;
    }
    var orderedOptionIds = shuffledOptions.map(function (option) { return option.option_id; });
    var listElement = document.createElement('ol');
    listElement.className = 'mastermind-lobby-ordering-list';
    answerRegion.appendChild(listElement);
    function _refreshOrderingList() {
      listElement.innerHTML = '';
      orderedOptionIds.forEach(function (optionId, positionIndex) {
        var option = (question.options || []).find(function (candidate) { return candidate.option_id === optionId; });
        if (!option) return;
        var listItem = document.createElement('li');
        listItem.className = 'mastermind-lobby-ordering-item';
        listItem.innerHTML =
          '<span class="mastermind-lobby-ordering-position">' + (positionIndex + 1) + '.</span>' +
          '<span class="mastermind-lobby-ordering-text">' + _escapeHtml(option.option_text_bn || option.option_text_en || '') + '</span>' +
          '<button type="button" class="mastermind-lobby-ordering-button" data-direction="up"' + (positionIndex === 0 ? ' disabled' : '') + ' aria-label="Move up">↑</button>' +
          '<button type="button" class="mastermind-lobby-ordering-button" data-direction="down"' + (positionIndex === orderedOptionIds.length - 1 ? ' disabled' : '') + ' aria-label="Move down">↓</button>';
        listItem.querySelectorAll('button').forEach(function (moveButton) {
          moveButton.addEventListener('click', function () {
            var direction = moveButton.dataset.direction;
            var swapWithIndex = direction === 'up' ? positionIndex - 1 : positionIndex + 1;
            if (swapWithIndex < 0 || swapWithIndex >= orderedOptionIds.length) return;
            var swapBuffer = orderedOptionIds[positionIndex];
            orderedOptionIds[positionIndex] = orderedOptionIds[swapWithIndex];
            orderedOptionIds[swapWithIndex] = swapBuffer;
            state.currentAnswer = { ordering_option_ids: orderedOptionIds.slice() };
            _refreshOrderingList();
          });
        });
        listElement.appendChild(listItem);
      });
    }
    _refreshOrderingList();
    state.currentAnswer = { ordering_option_ids: orderedOptionIds.slice() };
  }

  function _renderMatching(question) {
    var stems = question.match_stems || [];
    var responses = question.match_responses || [];
    if (!stems.length || !responses.length) {
      _renderUnsupportedType(question);
      return;
    }
    var selectedResponseByStem = {};
    function _syncMatchingAnswer() {
      state.currentAnswer = {
        matching_pairs: stems.map(function (stem) {
          return {
            stem_pair_id: stem.pair_id,
            response_pair_id: selectedResponseByStem[stem.pair_id] || null,
          };
        }),
      };
    }
    var matchingList = document.createElement('ul');
    matchingList.className = 'mastermind-lobby-matching-list';
    answerRegion.appendChild(matchingList);
    stems.forEach(function (stem) {
      var rowItem = document.createElement('li');
      rowItem.className = 'mastermind-lobby-matching-row';
      var stemSpan = document.createElement('span');
      stemSpan.className = 'mastermind-lobby-matching-stem';
      stemSpan.textContent = stem.stem_text_bn || stem.stem_text_en || '';
      var selectId = 'mastermind-lobby-matching-' + stem.pair_id;
      var responseSelect = document.createElement('select');
      responseSelect.className = 'mastermind-lobby-matching-select';
      responseSelect.id = selectId;
      responseSelect.name = selectId;
      var placeholderOption = document.createElement('option');
      placeholderOption.value = '';
      placeholderOption.textContent = 'Pick a match…';
      responseSelect.appendChild(placeholderOption);
      responses.forEach(function (response) {
        var responseOption = document.createElement('option');
        responseOption.value = String(response.pair_id);
        responseOption.textContent = response.response_text_bn || response.response_text_en || '';
        responseSelect.appendChild(responseOption);
      });
      responseSelect.addEventListener('change', function () {
        if (responseSelect.value) selectedResponseByStem[stem.pair_id] = parseInt(responseSelect.value, 10);
        else delete selectedResponseByStem[stem.pair_id];
        _syncMatchingAnswer();
      });
      rowItem.appendChild(stemSpan);
      rowItem.appendChild(responseSelect);
      matchingList.appendChild(rowItem);
    });
    _syncMatchingAnswer();
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
    _playSfx('lock_in');
    _send({
      type: 'submit_answer',
      question_index: state.latest.current_question_index,
      answer: state.currentAnswer,
    });
  }

  function _showAnswerResult(result) {
    if (!answerStatus) return;
    answerStatus.classList.remove('mastermind-lobby-answer-status-correct', 'mastermind-lobby-answer-status-wrong');
    if (result.is_correct) {
      answerStatus.textContent = '✅ Correct — +' + (result.points_earned || 0).toFixed(1) + ' pts';
      answerStatus.classList.add('mastermind-lobby-answer-status-correct');
      _playSfx('correct');
    } else {
      answerStatus.textContent = '❌ Not correct — wait for next question.';
      answerStatus.classList.add('mastermind-lobby-answer-status-wrong');
      _playSfx('wrong');
    }
    answerStatus.hidden = false;
  }

  // --- keyboard shortcuts: 1-9 picks the Nth option (mcq_single / true_false) ---
  document.addEventListener('keydown', function (keyboardEvent) {
    // Ignore when typing in a text field
    var activeTagName = (document.activeElement && document.activeElement.tagName) || '';
    if (activeTagName === 'INPUT' || activeTagName === 'TEXTAREA' || activeTagName === 'SELECT') return;
    // Only react during a live question
    if (!state.latest || state.latest.status_code !== 'playing') return;
    if (state.answerLockedFor === state.latest.current_question_index) return;

    var pressedKey = keyboardEvent.key;
    if (pressedKey >= '1' && pressedKey <= '9') {
      var optionIndex = parseInt(pressedKey, 10) - 1;
      var radioInputs = answerRegion.querySelectorAll('input[type="radio"]');
      if (radioInputs[optionIndex]) {
        radioInputs[optionIndex].checked = true;
        radioInputs[optionIndex].dispatchEvent(new Event('change', { bubbles: true }));
        keyboardEvent.preventDefault();
      }
    } else if (pressedKey === 'Enter' && state.currentAnswer && !submitAnswerButton.disabled) {
      _submitAnswer();
      keyboardEvent.preventDefault();
    }
  });

  // --- sound-effects mute toggle ------------------------------------
  var sfxToggleButton = document.getElementById('mastermind-lobby-sfx-toggle');
  if (sfxToggleButton && window.mastermindLobbySfx) {
    function _refreshSfxToggleLabel() {
      var muted = window.mastermindLobbySfx.isMuted();
      sfxToggleButton.textContent = muted ? '🔇' : '🔊';
      sfxToggleButton.setAttribute('aria-pressed', muted ? 'true' : 'false');
      sfxToggleButton.setAttribute(
        'aria-label',
        muted ? 'Sound off — click to enable' : 'Sound on — click to mute'
      );
    }
    sfxToggleButton.addEventListener('click', function () {
      var nextMutedState = !window.mastermindLobbySfx.isMuted();
      window.mastermindLobbySfx.setMuted(nextMutedState);
      _refreshSfxToggleLabel();
      if (!nextMutedState) _playSfx('lock_in');
    });
    _refreshSfxToggleLabel();
  }

  // --- bootstrap --------------------------------------------------
  _applyState(state.latest);
  _connect();
})();
