/* Mastermind quiz proctoring — Phase 2 (webcam AI, level 2 only).
 *
 * ZERO IMAGES policy:
 *   - Raw video frames, face landmarks, and iris positions never leave the
 *     browser. The MediaStream attaches to an in-page <video> element only.
 *   - The only thing POSTed to the server is text event metadata
 *     ({ type, confidence, client_timestamp }).
 *   - The DB schema literally has no BLOB/VARBINARY columns.
 *   - stop() tears down all tracks immediately so the camera LED turns off ASAP.
 *
 * Public API:
 *   window.mastermindProctoringWebcam.systemCheck()  -> { wasm, webgl, getUserMedia, secureContext, supported }
 *   window.mastermindProctoringWebcam.testCamera()   -> Promise<{ success, error }>
 *   window.mastermindProctoringWebcam.start(config)  -> Promise<void>
 *   window.mastermindProctoringWebcam.stop()
 *
 * Lifecycle: this module is booted by proctoring-lockdown.js when
 *   config.proctoringLevel === 2 AND consent has been granted.
 */
(function () {
  'use strict';

  var MEDIAPIPE_VERSION = '0.10.21';
  var MEDIAPIPE_WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MEDIAPIPE_VERSION + '/wasm';
  var MEDIAPIPE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MEDIAPIPE_VERSION + '/vision_bundle.mjs';
  var FACE_LANDMARKER_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

  var DETECTION_INTERVAL_MS = 200;            // ~5fps detection — easy on CPU, plenty for proctoring
  var GAZE_LOOK_AWAY_THRESHOLD_RAD = 0.44;    // ~25 degrees yaw or pitch
  var GAZE_LOOK_AWAY_BUFFER_MS = 2000;        // sustained 2 seconds before flagging
  var HEARTBEAT_DEAD_MS = 5000;               // 5 sec of zero detections while camera open = blocked
  var NO_FACE_DEBOUNCE_MS = 3000;             // 3 sec of zero faces before "no_face" flag (avoid blink flicker)
  var MIN_VIOLATION_INTERVAL_MS = 2000;       // throttle same-type violations
  var TEST_CAMERA_TIMEOUT_MS = 5000;          // give the camera 5 sec to deliver a frame during a test

  var DEFAULT_LOG_ENDPOINT = '/mastermind/api/proctoring/log-violation/';

  var state = {
    started: false,
    sessionId: null,
    quizId: null,
    csrfToken: '',
    logEndpoint: DEFAULT_LOG_ENDPOINT,
    onWarning: null,
    onError: null,

    stream: null,
    videoElement: null,
    landmarker: null,
    detectionTimer: null,
    lastFrameAt: 0,
    lastFaceSeenAt: 0,
    gazeAwaySince: 0,
    lastViolationByType: {},
    teardownListenersBound: false,
    boundTeardown: null,
  };

  // ---------------------------------------------------------------------------
  // Public: capability checks
  // ---------------------------------------------------------------------------

  function systemCheck() {
    var secureContext = window.isSecureContext === true;
    var hasWasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
    var hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    var hasWebGL = false;
    try {
      var canvas = document.createElement('canvas');
      hasWebGL = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch (error) {
      hasWebGL = false;
    }
    return {
      secureContext: secureContext,
      wasm: hasWasm,
      webgl: hasWebGL,
      getUserMedia: hasGetUserMedia,
      supported: secureContext && hasWasm && hasWebGL && hasGetUserMedia,
    };
  }

  async function testCamera() {
    var diagnostic = systemCheck();
    if (!diagnostic.supported) {
      return { success: false, error: 'Browser missing required features (WASM, WebGL, camera API, or HTTPS).' };
    }

    var stream = null;
    var video = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
        audio: false,
      });

      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      var gotFrame = await _waitForFirstFrame(video, TEST_CAMERA_TIMEOUT_MS);
      if (!gotFrame) {
        return { success: false, error: 'Camera opened but no video frames arrived within ' + (TEST_CAMERA_TIMEOUT_MS / 1000) + 's. Check that the lens is uncovered.' };
      }
      return { success: true, error: null };
    } catch (error) {
      var reason = error && error.name ? error.name : 'unknown';
      var message;
      if (reason === 'NotAllowedError' || reason === 'PermissionDeniedError') {
        message = 'Camera permission denied. Allow camera access in your browser settings and try again.';
      } else if (reason === 'NotFoundError' || reason === 'DevicesNotFoundError') {
        message = 'No camera found on this device.';
      } else if (reason === 'NotReadableError' || reason === 'TrackStartError') {
        message = 'Camera is in use by another application. Close other video apps and retry.';
      } else {
        message = 'Camera test failed (' + reason + ').';
      }
      return { success: false, error: message };
    } finally {
      _hardStopStream(stream);
      if (video) {
        video.srcObject = null;
        if (video.parentNode) video.parentNode.removeChild(video);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public: start / stop the live monitoring loop
  // ---------------------------------------------------------------------------

  async function start(config) {
    if (state.started) return;
    if (!config || !config.sessionId || !config.quizId) {
      throw new Error('mastermindProctoringWebcam.start requires sessionId and quizId.');
    }

    state.sessionId = config.sessionId;
    state.quizId = config.quizId;
    state.csrfToken = config.csrfToken || '';
    state.logEndpoint = config.logEndpoint || DEFAULT_LOG_ENDPOINT;
    state.onWarning = typeof config.onWarning === 'function' ? config.onWarning : null;
    state.onError = typeof config.onError === 'function' ? config.onError : null;

    try {
      var stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user', frameRate: { ideal: 15, max: 30 } },
        audio: false,
      });
      state.stream = stream;
    } catch (error) {
      _logViolation('camera_unavailable', 'getUserMedia failed: ' + (error && error.name ? error.name : 'unknown'));
      if (state.onError) state.onError(error);
      return;
    }

    var video = document.createElement('video');
    video.id = 'mastermind-proctoring-webcam-video';
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('aria-hidden', 'true');
    video.style.position = 'fixed';
    video.style.left = '-9999px';
    video.style.top = '-9999px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.srcObject = state.stream;
    document.body.appendChild(video);
    await video.play();
    state.videoElement = video;

    try {
      state.landmarker = await _createLandmarker();
    } catch (error) {
      _logViolation('camera_unavailable', 'MediaPipe load failed: ' + (error && error.message ? error.message : 'unknown'));
      if (state.onError) state.onError(error);
      stop();
      return;
    }

    state.lastFrameAt = performance.now();
    state.lastFaceSeenAt = performance.now();
    state.detectionTimer = setInterval(_detectionTick, DETECTION_INTERVAL_MS);

    if (!state.teardownListenersBound) {
      state.boundTeardown = stop;
      window.addEventListener('beforeunload', state.boundTeardown);
      window.addEventListener('pagehide', state.boundTeardown);
      state.teardownListenersBound = true;
    }

    state.started = true;
  }

  function stop() {
    if (state.detectionTimer) {
      clearInterval(state.detectionTimer);
      state.detectionTimer = null;
    }
    if (state.landmarker && typeof state.landmarker.close === 'function') {
      try { state.landmarker.close(); } catch (error) { /* ignore */ }
    }
    state.landmarker = null;

    if (state.videoElement) {
      state.videoElement.pause();
      state.videoElement.srcObject = null;
      if (state.videoElement.parentNode) state.videoElement.parentNode.removeChild(state.videoElement);
      state.videoElement = null;
    }

    _hardStopStream(state.stream);
    state.stream = null;

    if (state.teardownListenersBound && state.boundTeardown) {
      window.removeEventListener('beforeunload', state.boundTeardown);
      window.removeEventListener('pagehide', state.boundTeardown);
      state.teardownListenersBound = false;
      state.boundTeardown = null;
    }

    state.started = false;
    state.gazeAwaySince = 0;
    state.lastViolationByType = {};
  }

  // ---------------------------------------------------------------------------
  // Internal: MediaPipe loader + per-frame detection
  // ---------------------------------------------------------------------------

  async function _createLandmarker() {
    var visionModule = await import(/* @vite-ignore */ MEDIAPIPE_MODULE_URL);
    var FilesetResolver = visionModule.FilesetResolver;
    var FaceLandmarker = visionModule.FaceLandmarker;
    var fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);
    return await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: FACE_LANDMARKER_MODEL_URL,
        delegate: 'GPU',
      },
      numFaces: 4,
      runningMode: 'VIDEO',
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
    });
  }

  function _detectionTick() {
    if (!state.started || !state.landmarker || !state.videoElement) return;
    if (state.videoElement.readyState < 2) return;

    var now = performance.now();
    var detection;
    try {
      detection = state.landmarker.detectForVideo(state.videoElement, now);
    } catch (error) {
      // a single failed detection isn't fatal; log + skip
      if (state.onError) state.onError(error);
      return;
    }

    state.lastFrameAt = now;
    var faceCount = (detection && detection.faceLandmarks) ? detection.faceLandmarks.length : 0;

    if (faceCount > 0) state.lastFaceSeenAt = now;

    // multi-face — strongest cheating signal, fire immediately on detection
    if (faceCount >= 2) {
      _logViolation('multiple_faces', faceCount + ' faces in frame');
    }

    // no face — debounce so blinks/quick glances don't spam
    if (faceCount === 0 && (now - state.lastFaceSeenAt) >= NO_FACE_DEBOUNCE_MS) {
      _logViolation('no_face', 'No face visible for ' + Math.round((now - state.lastFaceSeenAt) / 1000) + 's');
    }

    // gaze — derived from facialTransformationMatrixes (head pose)
    if (faceCount === 1 && detection.facialTransformationMatrixes && detection.facialTransformationMatrixes.length > 0) {
      var headPose = _extractHeadPose(detection.facialTransformationMatrixes[0]);
      var lookingAway = Math.abs(headPose.yawRad) > GAZE_LOOK_AWAY_THRESHOLD_RAD ||
                        Math.abs(headPose.pitchRad) > GAZE_LOOK_AWAY_THRESHOLD_RAD;

      if (lookingAway) {
        if (state.gazeAwaySince === 0) {
          state.gazeAwaySince = now;
        } else if ((now - state.gazeAwaySince) >= GAZE_LOOK_AWAY_BUFFER_MS) {
          _logViolation('look_away', 'Gaze deviated for ' + Math.round((now - state.gazeAwaySince) / 1000) + 's');
          state.gazeAwaySince = now;  // reset window so we don't spam every tick
        }
      } else {
        state.gazeAwaySince = 0;
      }
    } else {
      state.gazeAwaySince = 0;
    }

    // heartbeat — camera stream is alive but no face detected for 5+ sec = lens covered
    if (state.stream && state.stream.active && (now - state.lastFaceSeenAt) >= HEARTBEAT_DEAD_MS) {
      _logViolation('camera_blocked', 'Camera active but no face/landmarks detected for ' + Math.round((now - state.lastFaceSeenAt) / 1000) + 's (lens covered?)');
      // reset so we don't spam — heartbeat will fire again after another HEARTBEAT_DEAD_MS
      state.lastFaceSeenAt = now;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal: math + helpers
  // ---------------------------------------------------------------------------

  function _extractHeadPose(matrixObject) {
    // MediaPipe returns a column-major 4x4 transformation matrix as a flat
    // 16-float array. Yaw = rotation about Y, pitch = rotation about X.
    //
    // For a column-major matrix laid out as
    //   [r00, r10, r20, 0, r01, r11, r21, 0, r02, r12, r22, 0, tx, ty, tz, 1]
    // matrix[8]=r02, matrix[9]=r12, matrix[10]=r22.
    var matrix = matrixObject.data || matrixObject;
    var r02 = matrix[8];
    var r12 = matrix[9];
    var r22 = matrix[10];
    var yawRad = Math.atan2(r02, r22);
    var pitchRad = Math.atan2(-r12, Math.sqrt(r02 * r02 + r22 * r22));
    return { yawRad: yawRad, pitchRad: pitchRad };
  }

  function _waitForFirstFrame(video, timeoutMs) {
    return new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        resolve(false);
      }, timeoutMs);

      function _check() {
        if (settled) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          settled = true;
          clearTimeout(timer);
          resolve(true);
          return;
        }
        requestAnimationFrame(_check);
      }
      _check();
    });
  }

  function _hardStopStream(stream) {
    if (!stream) return;
    try {
      stream.getTracks().forEach(function (track) { track.stop(); });
    } catch (error) {
      /* ignore — best effort */
    }
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
          if (state.onError) state.onError(body && body.error);
          return;
        }
        if (body.status === 'warned' && state.onWarning) state.onWarning(body);
      })
      .catch(function (networkError) {
        if (state.onError) state.onError(networkError);
      });
  }

  window.mastermindProctoringWebcam = {
    systemCheck: systemCheck,
    testCamera: testCamera,
    start: start,
    stop: stop,
  };
})();
