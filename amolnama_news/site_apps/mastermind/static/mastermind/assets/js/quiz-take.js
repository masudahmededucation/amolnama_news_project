/* Mastermind quiz-take controller — wraps the engine API into a UX.
 *
 * Reads the quiz id from #mastermind-quiz-take[data-quiz-id], then drives:
 *   1. Welcome screen (fetches quiz metadata + start button)
 *   2. Per-question loop (renders 7 of 8 question types — matching is TODO)
 *   3. Results screen (score, breakdown, certificate link if any)
 *
 * Boots browser-lockdown proctoring automatically if exam_proctoring_level >= 1.
 *
 * NOT supported in this version (deferred):
 *   - matching question type (engine API needs match_pairs payload extension)
 */
(function () {
  'use strict';

  var rootElement = document.getElementById('mastermind-quiz-take');
  if (!rootElement) return;

  var quizId = parseInt(rootElement.dataset.quizId, 10);

  // ----- in-memory state -------------------------------------------
  var state = {
    quizMetadata: null,
    sessionId: null,
    sessionPayload: null,    // full /start/ response with all questions
    currentQuestionIndex: 0,
    currentAnswer: null,     // payload stored before submit
    timerHandle: null,
    deadlineMs: null,
    answersSubmittedThisQuestion: false,
  };

  // ----- DOM refs --------------------------------------------------
  var welcomeTitle = document.getElementById('mastermind-quiz-take-welcome-title');
  var welcomeSubtitle = document.getElementById('mastermind-quiz-take-welcome-subtitle');
  var welcomeMeta = document.getElementById('mastermind-quiz-take-welcome-meta');
  var welcomeError = document.getElementById('mastermind-quiz-take-welcome-error');
  var startButton = document.getElementById('mastermind-quiz-take-start-button');

  var progressLabel = document.getElementById('mastermind-quiz-take-progress');
  var progressFill = document.getElementById('mastermind-quiz-take-progress-fill');
  var timerDisplay = document.getElementById('mastermind-quiz-take-timer');
  var questionTextEl = document.getElementById('mastermind-quiz-take-question-text');
  var questionImageEl = document.getElementById('mastermind-quiz-take-question-image');
  var answerRegion = document.getElementById('mastermind-quiz-take-answer-region');
  var hintEl = document.getElementById('mastermind-quiz-take-hint');
  var explanationEl = document.getElementById('mastermind-quiz-take-explanation');
  var playingError = document.getElementById('mastermind-quiz-take-playing-error');

  var skipButton = document.getElementById('mastermind-quiz-take-skip-button');
  var submitAnswerButton = document.getElementById('mastermind-quiz-take-submit-answer-button');
  var nextButton = document.getElementById('mastermind-quiz-take-next-button');
  var finishButton = document.getElementById('mastermind-quiz-take-finish-button');

  var resultsTitle = document.getElementById('mastermind-quiz-take-results-title');
  var resultsSubtitle = document.getElementById('mastermind-quiz-take-results-subtitle');
  var resultsScore = document.getElementById('mastermind-quiz-take-results-score');
  var resultsGrid = document.getElementById('mastermind-quiz-take-results-grid');
  var resultsBackLink = document.getElementById('mastermind-quiz-take-results-back');
  var resultsCertificateLink = document.getElementById('mastermind-quiz-take-results-certificate-link');

  // ----- helpers ---------------------------------------------------
  function _csrfToken() {
    var csrfNode = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (csrfNode) return csrfNode.value;
    var match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : '';
  }

  async function _fetchJson(url, init) {
    var response = await fetch(url, Object.assign({
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    }, init || {}));
    if (!response.ok) {
      var errorBody = await response.json().catch(function () { return {}; });
      throw new Error(errorBody.error || ('HTTP ' + response.status));
    }
    return response.json();
  }

  async function _postJson(url, payload) {
    return _fetchJson(url, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': _csrfToken(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload || {}),
    });
  }

  function _showState(stateName) {
    rootElement.querySelectorAll('.mastermind-quiz-take-state').forEach(function (section) {
      section.hidden = section.dataset.state !== stateName;
    });
  }

  function _setError(targetElement, message) {
    if (!targetElement) return;
    targetElement.textContent = message || '';
    targetElement.hidden = !message;
  }

  function _escapeHtml(text) {
    var node = document.createElement('div');
    node.textContent = text || '';
    return node.innerHTML;
  }

  // ----- welcome screen --------------------------------------------
  function _loadWelcome() {
    var metadataNode = document.getElementById('mastermind-quiz-take-metadata');
    if (!metadataNode) {
      welcomeTitle.textContent = 'Quiz #' + quizId;
      startButton.disabled = false;
      return;
    }
    try {
      var metadata = JSON.parse(metadataNode.textContent);
      state.quizMetadata = metadata;
      welcomeTitle.textContent = metadata.exam_title_bn || metadata.exam_title_en || ('Quiz #' + quizId);
      welcomeSubtitle.textContent = (metadata.exam_title_bn && metadata.exam_title_en) ? metadata.exam_title_en : '';
      var metaParts = [
        ['Total questions', metadata.exam_total_questions || '—'],
        ['Time limit', metadata.exam_time_limit_minutes ? (metadata.exam_time_limit_minutes + ' min') : 'Untimed'],
        ['Pass mark', (metadata.exam_pass_percentage || '50') + '%'],
        ['Proctoring', _proctoringLabel(metadata.exam_proctoring_level)],
      ];
      welcomeMeta.innerHTML = metaParts.map(function (pair) {
        return '<div><dt>' + _escapeHtml(pair[0]) + '</dt><dd>' + _escapeHtml(String(pair[1])) + '</dd></div>';
      }).join('');
      startButton.disabled = false;
    } catch (error) {
      _setError(welcomeError, 'Could not parse quiz metadata: ' + error.message);
    }
  }

  function _proctoringLabel(level) {
    if (level === 2) return 'Webcam AI (consent required)';
    if (level === 1) return 'Browser lockdown';
    return 'None';
  }

  startButton.addEventListener('click', _startSession);

  async function _startSession() {
    startButton.disabled = true;
    startButton.textContent = 'Starting…';
    try {
      var response = await _postJson('/mastermind/api/exam/' + quizId + '/start/');
      state.sessionId = response.session_id;
      state.sessionPayload = response;
      state.currentQuestionIndex = 0;

      _bootProctoringIfNeeded(response);
      _showState('playing');
      _renderCurrentQuestion();
      if (response.exam_time_limit_minutes) {
        _startTimer(response.exam_time_limit_minutes);
      }
    } catch (error) {
      startButton.disabled = false;
      startButton.textContent = 'Start quiz';
      _setError(welcomeError, error.message);
    }
  }

  // ----- proctoring boot -------------------------------------------
  function _bootProctoringIfNeeded(sessionResponse) {
    var level = (state.quizMetadata && state.quizMetadata.exam_proctoring_level) || 0;
    if (level < 1) return;
    if (!window.mastermindProctoring || typeof window.mastermindProctoring.start !== 'function') return;
    window.mastermindProctoring.start({
      sessionId: state.sessionId,
      quizId: quizId,
      proctoringLevel: level,
      csrfToken: _csrfToken(),
    });
  }

  // ----- per-question rendering ------------------------------------
  function _currentQuestion() {
    return state.sessionPayload.questions[state.currentQuestionIndex];
  }

  function _renderCurrentQuestion() {
    state.currentAnswer = null;
    state.answersSubmittedThisQuestion = false;
    _setError(playingError, '');
    explanationEl.hidden = true;
    nextButton.hidden = true;
    finishButton.hidden = true;
    submitAnswerButton.hidden = false;
    skipButton.hidden = false;

    var question = _currentQuestion();
    var totalQuestions = state.sessionPayload.questions.length;
    progressLabel.textContent = 'Question ' + (state.currentQuestionIndex + 1) + ' / ' + totalQuestions;
    progressFill.style.width = (((state.currentQuestionIndex + 1) / totalQuestions) * 100) + '%';

    questionTextEl.textContent = question.question_text_bn || question.question_text_en || '';
    if (question.question_image_url) {
      questionImageEl.src = question.question_image_url;
      questionImageEl.hidden = false;
    } else {
      questionImageEl.hidden = true;
    }

    if (question.question_hint_bn || question.question_hint_en) {
      hintEl.textContent = 'Hint: ' + (question.question_hint_bn || question.question_hint_en);
      hintEl.hidden = false;
    } else {
      hintEl.hidden = true;
    }

    answerRegion.innerHTML = '';
    var renderer = QUESTION_TYPE_RENDERERS[question.question_type_code] || _renderUnsupportedType;
    renderer(question);
  }

  // Each renderer mutates state.currentAnswer based on user input
  var QUESTION_TYPE_RENDERERS = {
    'mcq_single':   _renderRadioGroup,
    'true_false':   _renderRadioGroup,
    'mcq_multi':    _renderCheckboxGroup,
    'fill_blank':   _renderFillBlank,
    'short_answer': _renderTextarea,
    'essay':        _renderTextarea,
    'ordering':     _renderOrdering,
  };

  function _renderRadioGroup(question) {
    (question.options || []).forEach(function (option) {
      var label = document.createElement('label');
      label.className = 'mastermind-quiz-take-option';
      label.innerHTML =
        '<input type="radio" name="quiz_answer" value="' + option.option_id + '">' +
        '<span class="mastermind-quiz-take-option-label">' + _escapeHtml(option.option_label) + '.</span>' +
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
      var label = document.createElement('label');
      label.className = 'mastermind-quiz-take-option';
      label.innerHTML =
        '<input type="checkbox" name="quiz_answer" value="' + option.option_id + '">' +
        '<span class="mastermind-quiz-take-option-label">' + _escapeHtml(option.option_label) + '.</span>' +
        '<span>' + _escapeHtml(option.option_text_bn || option.option_text_en || '') + '</span>';
      label.querySelector('input').addEventListener('change', function (event) {
        if (event.target.checked) selected.add(option.option_id);
        else selected.delete(option.option_id);
        state.currentAnswer = { selected_option_id: Array.from(selected).join(',') };
      });
      answerRegion.appendChild(label);
    });
  }

  function _renderFillBlank(question) {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'mastermind-quiz-take-text-input';
    input.id = 'mastermind-quiz-take-fill-blank-input';
    input.name = 'mastermind_quiz_take_fill_blank_input';
    input.placeholder = 'Type your answer';
    input.addEventListener('input', function () {
      state.currentAnswer = { fill_blank_answer_text: input.value };
    });
    answerRegion.appendChild(input);
    input.focus();
  }

  function _renderTextarea(question) {
    var textarea = document.createElement('textarea');
    textarea.className = 'mastermind-quiz-take-textarea';
    textarea.id = 'mastermind-quiz-take-text-answer';
    textarea.name = 'mastermind_quiz_take_text_answer';
    textarea.placeholder = 'Write your answer here…';
    textarea.addEventListener('input', function () {
      state.currentAnswer = { short_answer_text: textarea.value };
    });
    answerRegion.appendChild(textarea);
  }

  function _renderOrdering(question) {
    // Shuffle a copy of the options client-side; user reorders to the right answer
    var shuffled = (question.options || []).slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = temp;
    }
    var orderedIds = shuffled.map(function (option) { return option.option_id; });

    var listElement = document.createElement('ol');
    listElement.className = 'mastermind-quiz-take-ordering-list';
    answerRegion.appendChild(listElement);

    function _refresh() {
      listElement.innerHTML = '';
      orderedIds.forEach(function (optionId, index) {
        var option = (question.options || []).find(function (o) { return o.option_id === optionId; });
        if (!option) return;
        var item = document.createElement('li');
        item.className = 'mastermind-quiz-take-ordering-item';
        item.innerHTML =
          '<span class="mastermind-quiz-take-ordering-position">' + (index + 1) + '.</span>' +
          '<span class="mastermind-quiz-take-ordering-text">' + _escapeHtml(option.option_text_bn || option.option_text_en || '') + '</span>' +
          '<button type="button" class="mastermind-quiz-take-ordering-button" data-direction="up"' + (index === 0 ? ' disabled' : '') + ' aria-label="Move up">↑</button>' +
          '<button type="button" class="mastermind-quiz-take-ordering-button" data-direction="down"' + (index === orderedIds.length - 1 ? ' disabled' : '') + ' aria-label="Move down">↓</button>';
        item.querySelectorAll('button').forEach(function (button) {
          button.addEventListener('click', function () {
            var dir = button.dataset.direction;
            var swapWith = dir === 'up' ? index - 1 : index + 1;
            if (swapWith < 0 || swapWith >= orderedIds.length) return;
            var temp = orderedIds[index]; orderedIds[index] = orderedIds[swapWith]; orderedIds[swapWith] = temp;
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

  function _renderUnsupportedType(question) {
    answerRegion.innerHTML = '<p class="mastermind-quiz-take-error-message">Question type "' + _escapeHtml(question.question_type_code) + '" is not supported in this take page yet. Skip to continue.</p>';
  }

  // ----- answer submission + advance -------------------------------
  submitAnswerButton.addEventListener('click', _submitAnswer);
  skipButton.addEventListener('click', _skipQuestion);
  nextButton.addEventListener('click', _advanceQuestion);
  finishButton.addEventListener('click', _finishQuiz);

  async function _submitAnswer() {
    var question = _currentQuestion();
    if (!state.currentAnswer && question.question_type_code !== 'short_answer' && question.question_type_code !== 'essay') {
      _setError(playingError, 'Please pick an answer first (or click Skip).');
      return;
    }
    submitAnswerButton.disabled = true;
    var originalText = submitAnswerButton.textContent;
    submitAnswerButton.textContent = 'Submitting…';
    try {
      var payload = Object.assign({
        session_question_id: question.session_question_id,
      }, state.currentAnswer || {});
      var result = await _postJson('/mastermind/api/exam/' + quizId + '/answer/', payload);
      state.answersSubmittedThisQuestion = true;
      _renderExplanation(result);
      _showAdvanceControls();
    } catch (error) {
      _setError(playingError, error.message);
    } finally {
      submitAnswerButton.disabled = false;
      submitAnswerButton.textContent = originalText;
    }
  }

  async function _skipQuestion() {
    state.currentAnswer = null;
    var question = _currentQuestion();
    try {
      await _postJson('/mastermind/api/exam/' + quizId + '/answer/', {
        session_question_id: question.session_question_id,
      });
    } catch (error) { /* skip is best-effort */ }
    _advanceQuestion();
  }

  function _renderExplanation(result) {
    if (result.is_correct === null) {
      explanationEl.hidden = true;
      return;
    }
    var classNames = 'mastermind-quiz-take-explanation' + (result.is_correct ? '' : ' mastermind-quiz-take-explanation-incorrect');
    explanationEl.className = classNames;

    var verdict = result.is_correct
      ? '<strong>Correct</strong> — +' + result.points_earned + ' point(s).'
      : '<strong>Incorrect</strong>' + (result.points_earned < 0 ? ' (' + result.points_earned + ' points).' : '.');

    var explanationParts = [verdict];
    if (result.explanation_bn || result.explanation_en) {
      explanationParts.push('<p>' + _escapeHtml(result.explanation_bn || result.explanation_en) + '</p>');
    }
    if (result.correct_options && result.correct_options.length) {
      var correctLabels = result.correct_options.map(function (opt) {
        return _escapeHtml(opt.option_label + '. ' + (opt.option_text_bn || ''));
      }).join(' / ');
      explanationParts.push('<p>Correct answer: ' + correctLabels + '</p>');
    }
    if (result.source_citation) {
      var src = result.source_citation;
      explanationParts.push('<p class="mastermind-quiz-take-explanation-source">Source: book #' + src.book_id +
        (src.chapter_id ? ', chapter #' + src.chapter_id : '') +
        (src.page_number ? ', page ' + src.page_number : '') + '</p>');
    }
    explanationEl.innerHTML = explanationParts.join('');
    explanationEl.hidden = false;
  }

  function _showAdvanceControls() {
    submitAnswerButton.hidden = true;
    skipButton.hidden = true;
    var isLast = state.currentQuestionIndex >= state.sessionPayload.questions.length - 1;
    if (isLast) {
      finishButton.hidden = false;
    } else {
      nextButton.hidden = false;
    }
  }

  function _advanceQuestion() {
    state.currentQuestionIndex += 1;
    if (state.currentQuestionIndex >= state.sessionPayload.questions.length) {
      _finishQuiz();
      return;
    }
    _renderCurrentQuestion();
  }

  // ----- timer ------------------------------------------------------
  function _startTimer(minutes) {
    state.deadlineMs = Date.now() + minutes * 60 * 1000;
    timerDisplay.hidden = false;
    state.timerHandle = setInterval(_updateTimer, 1000);
    _updateTimer();
  }

  function _updateTimer() {
    var remainingMs = Math.max(0, state.deadlineMs - Date.now());
    var totalSec = Math.floor(remainingMs / 1000);
    var minutesPart = Math.floor(totalSec / 60);
    var secondsPart = totalSec % 60;
    timerDisplay.textContent = minutesPart + ':' + (secondsPart < 10 ? '0' : '') + secondsPart;
    timerDisplay.classList.remove('mastermind-quiz-take-timer-warning', 'mastermind-quiz-take-timer-critical');
    if (totalSec <= 60) timerDisplay.classList.add('mastermind-quiz-take-timer-critical');
    else if (totalSec <= 300) timerDisplay.classList.add('mastermind-quiz-take-timer-warning');

    if (remainingMs <= 0) {
      clearInterval(state.timerHandle);
      _finishQuiz();
    }
  }

  // ----- finish + results ------------------------------------------
  async function _finishQuiz() {
    if (state.timerHandle) clearInterval(state.timerHandle);
    if (window.mastermindProctoring && typeof window.mastermindProctoring.stop === 'function') {
      window.mastermindProctoring.stop();
    }
    try {
      var result = await _postJson('/mastermind/api/exam/' + quizId + '/submit/');
      _renderResults(result);
    } catch (error) {
      _setError(playingError, error.message);
    }
  }

  function _renderResults(result) {
    _showState('results');
    var passed = result.is_passed === true;
    resultsTitle.textContent = passed ? 'Passed!' : 'Did not pass';
    resultsSubtitle.textContent = result.attempt_number > 1
      ? 'Attempt ' + result.attempt_number + ' — minimum to pass: ' + result.pass_percentage + '%'
      : 'Minimum to pass: ' + result.pass_percentage + '%';
    resultsScore.textContent = (result.score_percentage || 0).toFixed(1) + '%';
    resultsScore.classList.remove('mastermind-quiz-take-results-score-passed', 'mastermind-quiz-take-results-score-failed');
    resultsScore.classList.add(passed ? 'mastermind-quiz-take-results-score-passed' : 'mastermind-quiz-take-results-score-failed');

    resultsGrid.innerHTML =
      '<dt>Total questions</dt><dd>' + result.total_questions + '</dd>' +
      '<dt>Correct</dt><dd>' + result.total_correct + '</dd>' +
      '<dt>Wrong</dt><dd>' + result.total_wrong + '</dd>' +
      '<dt>Skipped</dt><dd>' + result.total_skipped + '</dd>' +
      '<dt>Time taken</dt><dd>' + (result.time_taken_seconds ? Math.round(result.time_taken_seconds / 60) + ' min' : '—') + '</dd>' +
      (result.new_badges && result.new_badges.length ? '<dt>New badges</dt><dd>' + result.new_badges.join(', ') + '</dd>' : '');

    // Certificate link if the engine issued one (poll, since cert issue is async)
    setTimeout(_pollForCertificate, 1500);
  }

  async function _pollForCertificate() {
    // Public verify URL is /mastermind/certificate/<serial>/. We don't have the
    // serial, so we hit a hypothetical /api/session/<id>/certificate/ — for now
    // just leave the link hidden. (Future enhancement: add that lookup endpoint.)
    // Pulse notification will surface the cert separately.
  }

  resultsBackLink.addEventListener('click', function (event) {
    event.preventDefault();
    if (window.history.length > 1) window.history.back();
    else window.location.href = '/';
  });

  // ----- bootstrap --------------------------------------------------
  _showState('welcome');
  _loadWelcome();
})();
