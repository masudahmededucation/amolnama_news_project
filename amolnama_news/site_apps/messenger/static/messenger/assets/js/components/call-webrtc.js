/**
 * call-webrtc.js — WebRTC peer connection + signaling via WebSocket.
 *
 * Usage:
 *   window.messengerCall.start(conversationId, callTypeCode)  — initiate outgoing call
 *   window.messengerCall.acceptIncoming(callId, callTypeCode)  — accept incoming ring
 *   window.messengerCall.end()                                 — hang up
 *   window.messengerCall.toggleMute()                          — mic on/off
 *   window.messengerCall.toggleVideo()                         — camera on/off
 *   window.messengerCall.toggleScreenShare()                   — screen share on/off
 *   window.messengerCall.switchCamera()                        — front/back camera
 *
 * Events dispatched on document:
 *   'call:state'     — { detail: { state, callId, callType, remoteName } }
 *   'call:timer'     — { detail: { seconds } }
 *   'call:media'     — { detail: { localStream, remoteStream } }
 *   'call:track'     — { detail: { isMuted, isVideoOff, isScreenSharing } }
 */
window.messengerCall = (function () {
  'use strict';

  /* ── STUN / TURN servers ── */
  var ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  /* ── State ── */
  var peerConnection = null;
  var signalingSocket = null;
  var localStream = null;
  var remoteStream = null;
  var screenStream = null;
  var callId = null;
  var callTypeCode = null;
  var isCaller = false;
  var isMuted = false;
  var isVideoOff = false;
  var isScreenSharing = false;
  var timerInterval = null;
  var timerSeconds = 0;
  var ringTimeout = null;
  var iceCandidateQueue = [];

  /* ── Helpers ── */
  function dispatch(eventName, detail) {
    document.dispatchEvent(new CustomEvent(eventName, { detail: detail }));
  }

  function setState(state, remoteName) {
    dispatch('call:state', {
      state: state,
      callId: callId,
      callType: callTypeCode,
      remoteName: remoteName || null
    });
  }

  function getCsrfToken() {
    return typeof getCsrfTokenValue === 'function' ? getCsrfTokenValue() : '';
  }

  function getWsProtocol() {
    return window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  }

  /* ── Timer ── */
  function startTimer() {
    timerSeconds = 0;
    dispatch('call:timer', { seconds: 0 });
    timerInterval = setInterval(function () {
      timerSeconds++;
      dispatch('call:timer', { seconds: timerSeconds });
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  /* ── Media ── */
  function getMediaConstraints() {
    var constraints = { audio: true };
    if (callTypeCode === 'video') {
      constraints.video = { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } };
    }
    return constraints;
  }

  function acquireMedia() {
    return navigator.mediaDevices.getUserMedia(getMediaConstraints()).then(function (stream) {
      localStream = stream;
      dispatch('call:media', { localStream: localStream, remoteStream: remoteStream });
      return stream;
    });
  }

  function releaseMedia() {
    if (localStream) {
      localStream.getTracks().forEach(function (track) { track.stop(); });
      localStream = null;
    }
    if (screenStream) {
      screenStream.getTracks().forEach(function (track) { track.stop(); });
      screenStream = null;
    }
    remoteStream = null;
  }

  /* ── Signaling WebSocket ── */
  function connectSignaling(targetCallId) {
    return new Promise(function (resolve, reject) {
      var url = getWsProtocol() + window.location.host + '/ws/call/' + targetCallId + '/';
      signalingSocket = new WebSocket(url);

      signalingSocket.onopen = function () {
        resolve();
      };

      signalingSocket.onmessage = function (event) {
        var data;
        try { data = JSON.parse(event.data); } catch (parseError) { return; }
        handleSignalingMessage(data);
      };

      signalingSocket.onerror = function () {
        reject(new Error('WebSocket connection failed'));
      };

      signalingSocket.onclose = function () {
        /* If call is still active, treat as network drop */
        if (callId) {
          cleanup('network_error');
        }
      };
    });
  }

  function sendSignaling(data) {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
      signalingSocket.send(JSON.stringify(data));
    }
  }

  /* ── PeerConnection ── */
  function createPeerConnection() {
    peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    /* Send ICE candidates to remote */
    peerConnection.onicecandidate = function (event) {
      if (event.candidate) {
        sendSignaling({
          type: 'ice_candidate',
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          }
        });
      }
    };

    /* Receive remote tracks */
    peerConnection.ontrack = function (event) {
      if (!remoteStream) {
        remoteStream = new MediaStream();
      }
      remoteStream.addTrack(event.track);
      dispatch('call:media', { localStream: localStream, remoteStream: remoteStream });
    };

    peerConnection.oniceconnectionstatechange = function () {
      if (!peerConnection) return;
      var iceState = peerConnection.iceConnectionState;
      if (iceState === 'disconnected' || iceState === 'failed') {
        endCall('network_error');
      }
    };

    /* Add local tracks */
    if (localStream) {
      localStream.getTracks().forEach(function (track) {
        peerConnection.addTrack(track, localStream);
      });
    }
  }

  /* ── Signaling message handler ── */
  function handleSignalingMessage(data) {
    switch (data.type) {
      case 'offer':
        handleOffer(data.sdp);
        break;
      case 'answer':
        handleAnswer(data.sdp);
        break;
      case 'ice_candidate':
        handleIceCandidate(data.candidate);
        break;
      case 'call_accepted':
        handleCallAccepted();
        break;
      case 'call_rejected':
        cleanup('rejected');
        setState('rejected');
        break;
      case 'call_ended':
        cleanup('remote_ended');
        setState('ended');
        break;
      case 'incoming_call':
        handleIncomingCall(data);
        break;
    }
  }

  function handleOffer(sdp) {
    if (!peerConnection) createPeerConnection();
    peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdp }))
      .then(function () {
        /* Flush queued ICE candidates */
        iceCandidateQueue.forEach(function (candidate) {
          peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(function (error) { console.error('ICE candidate error:', error); });
        });
        iceCandidateQueue = [];
        return peerConnection.createAnswer();
      })
      .then(function (answer) {
        return peerConnection.setLocalDescription(answer);
      })
      .then(function () {
        sendSignaling({ type: 'answer', sdp: peerConnection.localDescription.sdp });
      })
      .catch(function (error) {
        console.error('Failed to handle offer:', error);
        endCall('failed');
      });
  }

  function handleAnswer(sdp) {
    if (!peerConnection) return;
    peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: sdp }))
      .then(function () {
        iceCandidateQueue.forEach(function (candidate) {
          peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(function (error) { console.error('ICE candidate error:', error); });
        });
        iceCandidateQueue = [];
      })
      .catch(function (error) {
        console.error('Failed to handle answer:', error);
      });
  }

  function handleIceCandidate(candidate) {
    if (!candidate) return;
    if (peerConnection && peerConnection.remoteDescription) {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(function (error) { console.error('ICE candidate error:', error); });
    } else {
      iceCandidateQueue.push(candidate);
    }
  }

  function handleCallAccepted() {
    if (ringTimeout) {
      clearTimeout(ringTimeout);
      ringTimeout = null;
    }
    setState('connected');
    startTimer();

    /* Caller creates offer after callee accepts */
    if (isCaller && peerConnection) {
      peerConnection.createOffer()
        .then(function (offer) {
          return peerConnection.setLocalDescription(offer);
        })
        .then(function () {
          sendSignaling({ type: 'offer', sdp: peerConnection.localDescription.sdp });
        })
        .catch(function (error) {
          console.error('Failed to create offer:', error);
          endCall('failed');
        });
    }
  }

  function handleIncomingCall(data) {
    /* This is received by the callee — show ring UI */
    callId = data.call_id;
    callTypeCode = data.call_type_code;
    isCaller = false;
    setState('incoming', data.caller_name);
  }

  /* ── Public API ── */

  function start(conversationId, type) {
    if (callId) return; /* Already in a call */
    callTypeCode = type || 'audio';
    isCaller = true;
    isMuted = false;
    isVideoOff = false;
    isScreenSharing = false;
    iceCandidateQueue = [];

    setState('connecting');

    acquireMedia()
      .then(function () {
        /* Create call log via REST API */
        return fetch('/messenger/api/call/initiate/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            call_type_code: callTypeCode
          })
        });
      })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Server error: ' + response.status);
        }
        return response.json();
      })
      .then(function (result) {
        if (!result.success) {
          throw new Error(result.error || 'Call initiation failed');
        }
        callId = result.call_id;

        /* Connect signaling */
        return connectSignaling(callId);
      })
      .then(function () {
        createPeerConnection();
        setState('ringing');

        /* 60-second ring timeout */
        ringTimeout = setTimeout(function () {
          endCall('timeout');
        }, 60000);
      })
      .catch(function (error) {
        console.error('Call start failed:', error);
        cleanup('failed');
        setState('failed');
      });
  }

  function acceptIncoming(incomingCallId, type) {
    callId = incomingCallId;
    callTypeCode = type || 'audio';
    isCaller = false;
    isMuted = false;
    isVideoOff = false;
    isScreenSharing = false;
    iceCandidateQueue = [];

    setState('connecting');

    acquireMedia()
      .then(function () {
        return connectSignaling(callId);
      })
      .then(function () {
        createPeerConnection();
        sendSignaling({ type: 'call_accepted' });
        setState('connected');
        startTimer();
      })
      .catch(function (error) {
        console.error('Accept call failed:', error);
        cleanup('failed');
        setState('failed');
      });
  }

  function rejectIncoming() {
    if (!callId) return;
    /* Connect briefly just to send rejection */
    connectSignaling(callId).then(function () {
      sendSignaling({ type: 'call_rejected' });
      cleanup('rejected');
      setState('idle');
    }).catch(function () {
      cleanup('rejected');
      setState('idle');
    });
  }

  function endCall(reason) {
    if (!callId) return;
    sendSignaling({ type: 'call_ended', reason: reason || 'caller_ended' });
    cleanup(reason || 'caller_ended');
    setState('ended');
  }

  function cleanup(reason) {
    if (ringTimeout) {
      clearTimeout(ringTimeout);
      ringTimeout = null;
    }
    stopTimer();
    releaseMedia();

    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    if (signalingSocket) {
      signalingSocket.close();
      signalingSocket = null;
    }

    callId = null;
    isMuted = false;
    isVideoOff = false;
    isScreenSharing = false;
    iceCandidateQueue = [];
    dispatch('call:track', { isMuted: false, isVideoOff: false, isScreenSharing: false });
  }

  function toggleMute() {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(function (track) {
      track.enabled = !isMuted;
    });
    dispatch('call:track', { isMuted: isMuted, isVideoOff: isVideoOff, isScreenSharing: isScreenSharing });
  }

  function toggleVideo() {
    if (!localStream) return;
    isVideoOff = !isVideoOff;
    localStream.getVideoTracks().forEach(function (track) {
      track.enabled = !isVideoOff;
    });
    dispatch('call:track', { isMuted: isMuted, isVideoOff: isVideoOff, isScreenSharing: isScreenSharing });
  }

  function switchCamera() {
    if (!localStream || callTypeCode !== 'video') return;
    var currentTrack = localStream.getVideoTracks()[0];
    if (!currentTrack) return;

    var currentFacing = currentTrack.getSettings().facingMode || 'user';
    var newFacing = currentFacing === 'user' ? 'environment' : 'user';

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: newFacing, width: { ideal: 640 }, height: { ideal: 480 } }
    }).then(function (newStream) {
      var newTrack = newStream.getVideoTracks()[0];
      currentTrack.stop();
      localStream.removeTrack(currentTrack);
      localStream.addTrack(newTrack);

      /* Replace track on peer connection */
      if (peerConnection) {
        var sender = peerConnection.getSenders().find(function (sender) {
          return sender.track && sender.track.kind === 'video';
        });
        if (sender) sender.replaceTrack(newTrack);
      }
      dispatch('call:media', { localStream: localStream, remoteStream: remoteStream });
    }).catch(function (error) { console.error('Switch camera failed:', error); });
  }

  function toggleScreenShare() {
    if (!peerConnection) return;

    if (isScreenSharing) {
      /* Stop screen share, restore camera */
      if (screenStream) {
        screenStream.getTracks().forEach(function (track) { track.stop(); });
        screenStream = null;
      }
      var cameraTrack = localStream ? localStream.getVideoTracks()[0] : null;
      if (cameraTrack) {
        var sender = peerConnection.getSenders().find(function (sender) {
          return sender.track && sender.track.kind === 'video';
        });
        if (sender) sender.replaceTrack(cameraTrack);
      }
      isScreenSharing = false;
      dispatch('call:track', { isMuted: isMuted, isVideoOff: isVideoOff, isScreenSharing: false });
      return;
    }

    navigator.mediaDevices.getDisplayMedia({ video: true }).then(function (stream) {
      screenStream = stream;
      var screenTrack = stream.getVideoTracks()[0];

      var sender = peerConnection.getSenders().find(function (sender) {
        return sender.track && sender.track.kind === 'video';
      });
      if (sender) sender.replaceTrack(screenTrack);

      screenTrack.onended = function () {
        /* User clicked browser's "Stop sharing" */
        isScreenSharing = false;
        var cameraTrack = localStream ? localStream.getVideoTracks()[0] : null;
        if (cameraTrack && sender) sender.replaceTrack(cameraTrack);
        screenStream = null;
        dispatch('call:track', { isMuted: isMuted, isVideoOff: isVideoOff, isScreenSharing: false });
      };

      isScreenSharing = true;
      dispatch('call:track', { isMuted: isMuted, isVideoOff: isVideoOff, isScreenSharing: true });
    }).catch(function (error) {
      /* User cancelled screen share picker — NotAllowedError is expected */
      if (error.name !== 'NotAllowedError') {
        console.error('Screen share failed:', error);
      }
    });
  }

  return {
    start: start,
    acceptIncoming: acceptIncoming,
    rejectIncoming: rejectIncoming,
    end: endCall,
    toggleMute: toggleMute,
    toggleVideo: toggleVideo,
    switchCamera: switchCamera,
    toggleScreenShare: toggleScreenShare
  };
})();
