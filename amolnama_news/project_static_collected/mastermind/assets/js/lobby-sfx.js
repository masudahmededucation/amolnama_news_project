/* Mastermind multi-player lobby — sound effects via Web Audio API.
 *
 * In-house, free, zero external files (CSP-safe — no audio downloads,
 * no fetch). Each sound is a tiny synth pattern composed at play time.
 *
 * Public surface:
 *   window.mastermindLobbySfx.play(eventCode)
 *     where eventCode is one of:
 *       'question_advance'  — short blip, signals new question
 *       'lock_in'           — confirm tone when player submits
 *       'correct'           — rising 3-note arpeggio
 *       'wrong'             — descending minor third
 *       'time_warning'      — single soft beep at <=5s
 *       'time_up'           — buzzer
 *       'lobby_start'       — fanfare-style 4 ascending notes
 *       'game_over'         — celebratory upward arpeggio
 *
 * Honours prefers-reduced-motion (treated as "prefers-reduced sound" too)
 * AND localStorage flag "mastermind_lobby_sfx" === "off" so the user can
 * mute. AudioContext is created lazily on first play to comply with browser
 * autoplay policy (user gesture required).
 */
(function () {
  'use strict';

  if (window.mastermindLobbySfx) return; // module is idempotent

  var audioContextSingleton = null;
  var lastEventTimestamp = {};

  function _isMuted() {
    try {
      if (window.localStorage && localStorage.getItem('mastermind_lobby_sfx') === 'off') return true;
    } catch (storageBlockedError) { /* private mode */ }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    return false;
  }

  function _ensureAudioContext() {
    if (audioContextSingleton) return audioContextSingleton;
    var WebAudioContext = window.AudioContext || window.webkitAudioContext;
    if (!WebAudioContext) return null;
    try {
      audioContextSingleton = new WebAudioContext();
    } catch (audioInitError) {
      return null;
    }
    return audioContextSingleton;
  }

  function _playToneSequence(notes) {
    var audioContext = _ensureAudioContext();
    if (!audioContext) return;
    if (audioContext.state === 'suspended') {
      // Some browsers leave context suspended until next user gesture
      try { audioContext.resume(); } catch (resumeError) { /* ignore */ }
    }
    var nowSeconds = audioContext.currentTime;
    var cumulativeOffsetSeconds = 0;
    notes.forEach(function (note) {
      var oscillator = audioContext.createOscillator();
      var gainNode = audioContext.createGain();
      oscillator.type = note.shape || 'sine';
      oscillator.frequency.value = note.frequencyHz;
      var startSeconds = nowSeconds + cumulativeOffsetSeconds;
      var stopSeconds = startSeconds + note.durationSeconds;
      // Smooth attack + release to avoid clicks
      gainNode.gain.setValueAtTime(0.0001, startSeconds);
      gainNode.gain.exponentialRampToValueAtTime(note.volume || 0.18, startSeconds + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, stopSeconds);
      oscillator.connect(gainNode).connect(audioContext.destination);
      oscillator.start(startSeconds);
      oscillator.stop(stopSeconds + 0.02);
      cumulativeOffsetSeconds += note.durationSeconds + (note.gapSeconds || 0);
    });
  }

  // Frequencies in Hz — equal-tempered semitones from A4 = 440
  var NOTE_FREQ = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00,
    A4: 440.00, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25,
    F5: 698.46, G5: 783.99, A5: 880.00, C6: 1046.50,
  };

  var EVENT_PATTERNS = {
    question_advance: [
      { frequencyHz: NOTE_FREQ.E5, durationSeconds: 0.08, shape: 'sine' },
    ],
    lock_in: [
      { frequencyHz: NOTE_FREQ.A4, durationSeconds: 0.06, shape: 'triangle' },
      { frequencyHz: NOTE_FREQ.E5, durationSeconds: 0.08, shape: 'triangle' },
    ],
    correct: [
      { frequencyHz: NOTE_FREQ.C5, durationSeconds: 0.10, shape: 'triangle' },
      { frequencyHz: NOTE_FREQ.E5, durationSeconds: 0.10, shape: 'triangle' },
      { frequencyHz: NOTE_FREQ.G5, durationSeconds: 0.18, shape: 'triangle' },
    ],
    wrong: [
      { frequencyHz: NOTE_FREQ.E4, durationSeconds: 0.12, shape: 'sawtooth', volume: 0.14 },
      { frequencyHz: NOTE_FREQ.C4, durationSeconds: 0.18, shape: 'sawtooth', volume: 0.14 },
    ],
    time_warning: [
      { frequencyHz: NOTE_FREQ.A5, durationSeconds: 0.06, shape: 'square', volume: 0.12 },
    ],
    time_up: [
      { frequencyHz: NOTE_FREQ.A4, durationSeconds: 0.10, shape: 'square', volume: 0.18 },
      { frequencyHz: NOTE_FREQ.E4, durationSeconds: 0.14, shape: 'square', volume: 0.18 },
      { frequencyHz: NOTE_FREQ.A4 / 2, durationSeconds: 0.20, shape: 'square', volume: 0.18 },
    ],
    lobby_start: [
      { frequencyHz: NOTE_FREQ.C5, durationSeconds: 0.10, shape: 'triangle' },
      { frequencyHz: NOTE_FREQ.E5, durationSeconds: 0.10, shape: 'triangle' },
      { frequencyHz: NOTE_FREQ.G5, durationSeconds: 0.10, shape: 'triangle' },
      { frequencyHz: NOTE_FREQ.C6, durationSeconds: 0.20, shape: 'triangle' },
    ],
    game_over: [
      { frequencyHz: NOTE_FREQ.C5, durationSeconds: 0.12, shape: 'triangle' },
      { frequencyHz: NOTE_FREQ.E5, durationSeconds: 0.12, shape: 'triangle' },
      { frequencyHz: NOTE_FREQ.G5, durationSeconds: 0.12, shape: 'triangle' },
      { frequencyHz: NOTE_FREQ.C6, durationSeconds: 0.10, shape: 'triangle' },
      { frequencyHz: NOTE_FREQ.E5, durationSeconds: 0.08, shape: 'triangle' },
      { frequencyHz: NOTE_FREQ.G5, durationSeconds: 0.08, shape: 'triangle' },
      { frequencyHz: NOTE_FREQ.C6, durationSeconds: 0.30, shape: 'triangle' },
    ],
  };

  function play(eventCode) {
    if (_isMuted()) return;
    var pattern = EVENT_PATTERNS[eventCode];
    if (!pattern) return;
    // Debounce: don't play the same event more than once per 150ms
    var nowMs = Date.now();
    if (lastEventTimestamp[eventCode] && nowMs - lastEventTimestamp[eventCode] < 150) return;
    lastEventTimestamp[eventCode] = nowMs;
    try { _playToneSequence(pattern); } catch (playError) { /* swallow — never break gameplay over audio */ }
  }

  function setMuted(isMuted) {
    try {
      if (window.localStorage) localStorage.setItem('mastermind_lobby_sfx', isMuted ? 'off' : 'on');
    } catch (storageBlockedError) { /* private mode */ }
  }

  function isMuted() { return _isMuted(); }

  /**
   * Wire a 🔊 / 🔇 toggle button to the SFX module.
   *
   * Single source of truth — both lobby-player.js and lobby-host.js call this
   * with their toggle button reference. Handles label/aria refresh, click
   * binding, and a confirmation chime when un-muting (so the user knows the
   * toggle worked even before any other event fires).
   *
   * Safe to call with null / undefined (does nothing).
   */
  function wireToggleButton(toggleButtonElement) {
    if (!toggleButtonElement) return;
    function _refreshLabel() {
      var muted = _isMuted();
      toggleButtonElement.textContent = muted ? '🔇' : '🔊';
      toggleButtonElement.setAttribute('aria-pressed', muted ? 'true' : 'false');
      toggleButtonElement.setAttribute(
        'aria-label',
        muted ? 'Sound off — click to enable' : 'Sound on — click to mute'
      );
    }
    toggleButtonElement.addEventListener('click', function () {
      var nextMutedState = !_isMuted();
      setMuted(nextMutedState);
      _refreshLabel();
      // Confirmation chime when un-muting (audible proof the toggle worked)
      if (!nextMutedState) play('lock_in');
    });
    _refreshLabel();
  }

  window.mastermindLobbySfx = {
    play: play,
    setMuted: setMuted,
    isMuted: isMuted,
    wireToggleButton: wireToggleButton,
  };
})();
