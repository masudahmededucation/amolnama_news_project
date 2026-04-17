/* Mastermind proctoring — consent screen controller.
 *
 * Owns the consent overlay UI lifecycle. Does NOT itself touch the camera
 * or load MediaPipe — it delegates the actual capability test to
 * window.mastermindProctoringWebcam.testCamera().
 *
 * On successful consent + camera test, dispatches:
 *   document.dispatchEvent(new CustomEvent('mastermind:proctoring-consent-granted', {
 *     detail: { sessionId, quizId },
 *   }));
 *
 * Consumer page listens and starts proctoring:
 *   document.addEventListener('mastermind:proctoring-consent-granted', function (e) {
 *     window.mastermindProctoring.start({ sessionId: e.detail.sessionId, ... });
 *   });
 */
(function () {
  'use strict';

  var overlay = document.getElementById('mastermind-proctoring-consent');
  if (!overlay) return;

  var checklist = document.getElementById('mastermind-proctoring-consent-system-checklist');
  var testButton = document.getElementById('mastermind-proctoring-consent-test-button');
  var consentCheckbox = document.getElementById('mastermind-proctoring-consent-checkbox');
  var grantButton = document.getElementById('mastermind-proctoring-consent-grant');
  var inlineMessage = document.getElementById('mastermind-proctoring-consent-inline-message');

  var sessionId = parseInt(overlay.dataset.sessionId, 10);
  var quizId = parseInt(overlay.dataset.quizId, 10);
  var cameraTestPassed = false;

  function _setCheck(check, state) {
    var item = checklist.querySelector('li[data-check="' + check + '"]');
    if (!item) return;
    item.dataset.state = state;
    var icon = item.querySelector('.mastermind-proctoring-consent-check-icon');
    if (icon) icon.textContent = state === 'pass' ? '\u2713' : (state === 'fail' ? '\u2717' : '\u2026');
  }

  function _showMessage(text, tone) {
    if (!inlineMessage) return;
    inlineMessage.textContent = text;
    inlineMessage.dataset.tone = tone || 'success';
    inlineMessage.hidden = false;
  }

  function _clearMessage() {
    if (!inlineMessage) return;
    inlineMessage.hidden = true;
    inlineMessage.textContent = '';
  }

  function _refreshGrantButtonState() {
    grantButton.disabled = !(cameraTestPassed && consentCheckbox.checked);
  }

  function _runStaticSystemCheck() {
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

    _setCheck('secure_context', secureContext ? 'pass' : 'fail');
    _setCheck('wasm', hasWasm ? 'pass' : 'fail');
    _setCheck('webgl', hasWebGL ? 'pass' : 'fail');
    _setCheck('getusermedia', hasGetUserMedia ? 'pass' : 'fail');
    _setCheck('camera_test', 'pending');

    var allBaselinePassed = secureContext && hasWasm && hasWebGL && hasGetUserMedia;
    if (!allBaselinePassed) {
      testButton.disabled = true;
      _showMessage('Your browser does not support the required features. Please use a recent version of Chrome, Edge, Firefox, or Safari over HTTPS.', 'error');
    }
    return allBaselinePassed;
  }

  async function _runCameraTest() {
    if (!window.mastermindProctoringWebcam || typeof window.mastermindProctoringWebcam.testCamera !== 'function') {
      _setCheck('camera_test', 'fail');
      _showMessage('Webcam module failed to load.', 'error');
      return;
    }

    testButton.disabled = true;
    testButton.textContent = 'Testing\u2026';
    _setCheck('camera_test', 'pending');
    _clearMessage();

    var result = await window.mastermindProctoringWebcam.testCamera();
    if (result && result.success) {
      cameraTestPassed = true;
      _setCheck('camera_test', 'pass');
      testButton.textContent = 'Camera works \u2713';
      _showMessage('Camera test passed. You can now consent and start the quiz.', 'success');
    } else {
      cameraTestPassed = false;
      _setCheck('camera_test', 'fail');
      testButton.disabled = false;
      testButton.textContent = 'Test my camera';
      _showMessage((result && result.error) || 'Camera test failed. Check browser permissions and that no other app is using the camera.', 'error');
    }
    _refreshGrantButtonState();
  }

  function _grantConsent() {
    overlay.parentNode.removeChild(overlay);
    document.dispatchEvent(new CustomEvent('mastermind:proctoring-consent-granted', {
      detail: { sessionId: sessionId, quizId: quizId },
    }));
  }

  testButton.addEventListener('click', _runCameraTest);
  consentCheckbox.addEventListener('change', _refreshGrantButtonState);
  grantButton.addEventListener('click', _grantConsent);

  _runStaticSystemCheck();
})();
