/* Quizadmin Analytics Dashboard — fetch from mastermind analytics API,
   render with Chart.js. All charts share a brand-token colour palette. */
(function () {
  'use strict';

  function _waitForChartJsThenInit() {
    if (typeof window.Chart === 'undefined') {
      requestAnimationFrame(_waitForChartJsThenInit);
      return;
    }
    _initDashboard();
  }

  var BASE_API = '/mastermind/api/analytics';
  var CHART_REGISTRY = {};
  var BRAND_COLOR_ACCENT = 'rgba(59, 130, 246, 0.85)';
  var BRAND_COLOR_SUCCESS = 'rgba(34, 197, 94, 0.85)';
  var BRAND_COLOR_AMBER = 'rgba(234, 179, 8, 0.85)';
  var BRAND_COLOR_DANGER = 'rgba(239, 68, 68, 0.85)';
  var BRAND_COLOR_MUTED = 'rgba(107, 114, 128, 0.6)';
  var BRAND_BORDER_ACCENT = 'rgba(59, 130, 246, 1)';

  function _toggleEmptyState(emptyElementId, isEmpty) {
    var element = document.getElementById(emptyElementId);
    if (element) element.hidden = !isEmpty;
  }

  function _destroyExistingChart(canvasId) {
    var existing = CHART_REGISTRY[canvasId];
    if (existing && typeof existing.destroy === 'function') existing.destroy();
    delete CHART_REGISTRY[canvasId];
  }

  async function _fetchJson(url) {
    try {
      var response = await fetch(url, {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (networkError) {
      return null;
    }
  }

  // ----- score distribution -----------------------------------------
  async function _renderScoreDistribution(quizId) {
    var canvasId = 'quizadmin-analytics-chart-score-distribution';
    var emptyId = 'quizadmin-analytics-score-distribution-empty';
    _destroyExistingChart(canvasId);
    if (!quizId) {
      _toggleEmptyState(emptyId, true);
      return;
    }
    var data = await _fetchJson(BASE_API + '/quiz/' + quizId + '/score-distribution/');
    if (!data || !data.buckets || data.session_count === 0) {
      _toggleEmptyState(emptyId, true);
      return;
    }
    _toggleEmptyState(emptyId, false);
    var canvas = document.getElementById(canvasId);
    CHART_REGISTRY[canvasId] = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.buckets.map(function (bucket) { return bucket.bucket_label; }),
        datasets: [{
          label: 'Sessions',
          data: data.buckets.map(function (bucket) { return bucket.session_count; }),
          backgroundColor: BRAND_COLOR_ACCENT,
          borderColor: BRAND_BORDER_ACCENT,
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: _commonChartOptions(),
    });
  }

  // ----- pass rate over time ----------------------------------------
  async function _renderPassRate(quizId, days) {
    var canvasId = 'quizadmin-analytics-chart-pass-rate';
    var emptyId = 'quizadmin-analytics-pass-rate-empty';
    _destroyExistingChart(canvasId);
    if (!quizId) {
      _toggleEmptyState(emptyId, true);
      return;
    }
    var data = await _fetchJson(BASE_API + '/quiz/' + quizId + '/pass-rate/?days=' + days);
    if (!data || !data.days || data.days.length === 0) {
      _toggleEmptyState(emptyId, true);
      return;
    }
    _toggleEmptyState(emptyId, false);
    var canvas = document.getElementById(canvasId);
    CHART_REGISTRY[canvasId] = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.days.map(function (day) { return day.date; }),
        datasets: [
          {
            label: 'Passed',
            data: data.days.map(function (day) { return day.passed; }),
            backgroundColor: BRAND_COLOR_SUCCESS,
            stack: 'sessions',
          },
          {
            label: 'Failed',
            data: data.days.map(function (day) { return day.failed; }),
            backgroundColor: BRAND_COLOR_DANGER,
            stack: 'sessions',
          },
          {
            label: 'In progress',
            data: data.days.map(function (day) { return day.in_progress; }),
            backgroundColor: BRAND_COLOR_MUTED,
            stack: 'sessions',
          },
        ],
      },
      options: _stackedChartOptions(),
    });
  }

  // ----- per-question difficulty (top 20 hardest) -------------------
  async function _renderQuestionDifficulty(quizId) {
    var canvasId = 'quizadmin-analytics-chart-question-difficulty';
    var emptyId = 'quizadmin-analytics-question-difficulty-empty';
    _destroyExistingChart(canvasId);
    if (!quizId) {
      _toggleEmptyState(emptyId, true);
      return;
    }
    var data = await _fetchJson(BASE_API + '/quiz/' + quizId + '/question-difficulty/');
    if (!data || !data.questions || data.questions.length === 0) {
      _toggleEmptyState(emptyId, true);
      return;
    }
    var withResponses = data.questions.filter(function (question) { return question.response_count > 0; });
    if (withResponses.length === 0) {
      _toggleEmptyState(emptyId, true);
      return;
    }
    var hardestFirst = withResponses
      .slice()
      .sort(function (a, b) { return (a.correct_rate || 0) - (b.correct_rate || 0); })
      .slice(0, 20);
    _toggleEmptyState(emptyId, false);
    var canvas = document.getElementById(canvasId);
    CHART_REGISTRY[canvasId] = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels: hardestFirst.map(function (question) {
          var preview = (question.question_text_bn || '').substring(0, 60);
          return '#' + question.question_id + '  ' + preview + (preview.length === 60 ? '…' : '');
        }),
        datasets: [{
          label: 'Correct rate',
          data: hardestFirst.map(function (question) { return Math.round((question.correct_rate || 0) * 100); }),
          backgroundColor: hardestFirst.map(function (question) {
            var pct = (question.correct_rate || 0) * 100;
            if (pct < 30) return BRAND_COLOR_DANGER;
            if (pct < 50) return BRAND_COLOR_AMBER;
            return BRAND_COLOR_SUCCESS;
          }),
          borderRadius: 3,
        }],
      },
      options: Object.assign({}, _commonChartOptions(), {
        indexAxis: 'y',
        scales: {
          x: { beginAtZero: true, max: 100, ticks: { callback: function (value) { return value + '%'; } } },
          y: { ticks: { autoSkip: false, font: { size: 10 } } },
        },
      }),
    });
  }

  // ----- topic engagement (platform-wide) ---------------------------
  async function _renderTopicEngagement(days) {
    var canvasId = 'quizadmin-analytics-chart-topic-engagement';
    var emptyId = 'quizadmin-analytics-topic-engagement-empty';
    _destroyExistingChart(canvasId);
    var data = await _fetchJson(BASE_API + '/topic/engagement/?days=' + days);
    if (!data || !data.topics || data.topics.length === 0) {
      _toggleEmptyState(emptyId, true);
      return;
    }
    _toggleEmptyState(emptyId, false);
    var canvas = document.getElementById(canvasId);
    CHART_REGISTRY[canvasId] = new window.Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: data.topics.map(function (topic) { return topic.topic_name_bn || ('Topic ' + topic.topic_id); }),
        datasets: [{
          data: data.topics.map(function (topic) { return topic.session_count; }),
          backgroundColor: [
            BRAND_COLOR_ACCENT, BRAND_COLOR_SUCCESS, BRAND_COLOR_AMBER,
            BRAND_COLOR_DANGER, BRAND_COLOR_MUTED,
            'rgba(168, 85, 247, 0.85)', 'rgba(20, 184, 166, 0.85)',
            'rgba(251, 113, 133, 0.85)', 'rgba(96, 165, 250, 0.85)',
          ],
        }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } },
    });
  }

  // ----- per-user performance ---------------------------------------
  async function _renderUserPerformance() {
    var canvasId = 'quizadmin-analytics-chart-user-performance';
    var emptyId = 'quizadmin-analytics-user-performance-empty';
    _destroyExistingChart(canvasId);
    var data = await _fetchJson(BASE_API + '/user/performance/');
    if (!data || !data.topics || data.topics.length === 0) {
      _toggleEmptyState(emptyId, true);
      return;
    }
    _toggleEmptyState(emptyId, false);
    var canvas = document.getElementById(canvasId);
    CHART_REGISTRY[canvasId] = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.topics.map(function (topic) { return topic.topic_name_bn || ('Topic ' + topic.topic_id); }),
        datasets: [{
          label: 'Average score %',
          data: data.topics.map(function (topic) {
            return topic.average_score_percentage !== null ? Math.round(topic.average_score_percentage) : 0;
          }),
          backgroundColor: BRAND_COLOR_ACCENT,
          borderRadius: 4,
        }],
      },
      options: Object.assign({}, _commonChartOptions(), {
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: function (value) { return value + '%'; } } },
        },
      }),
    });
  }

  function _commonChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12 } } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    };
  }

  function _stackedChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12 } } },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
      },
    };
  }

  // ----- bootstrap --------------------------------------------------
  function _initDashboard() {
    var quizSelect = document.getElementById('quizadmin-analytics-quiz-select');
    var daysSelect = document.getElementById('quizadmin-analytics-days-select');

    function _refreshPerQuizCharts() {
      var quizId = quizSelect.value;
      var days = daysSelect.value;
      _renderScoreDistribution(quizId);
      _renderPassRate(quizId, days);
      _renderQuestionDifficulty(quizId);
    }

    function _refreshPlatformCharts() {
      _renderTopicEngagement(daysSelect.value);
    }

    quizSelect.addEventListener('change', _refreshPerQuizCharts);
    daysSelect.addEventListener('change', function () {
      _refreshPerQuizCharts();
      _refreshPlatformCharts();
    });

    // First paint
    _refreshPerQuizCharts();
    _refreshPlatformCharts();
    _renderUserPerformance();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _waitForChartJsThenInit);
  } else {
    _waitForChartJsThenInit();
  }
})();
