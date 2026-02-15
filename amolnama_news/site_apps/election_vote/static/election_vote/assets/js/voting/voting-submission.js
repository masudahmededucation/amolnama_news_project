/* ========== Election Vote – Vote Submission ========== */

/**
 * Step 4: Handle party selection and cast the vote.
 * Collects bot-detection metrics and POSTs to the cast-vote API.
 * On success, calls displayVoteReceipt() (voting-receipt.js).
 */
function handlePartySelectionAndCastVote(id, nameEn, nameBn, event) {
  if (event) event.preventDefault();

  // Block vote submission for non-authenticated users
  if (!isAuthenticated) {
    showPageMessage(
      '\u09AD\u09CB\u099F \u09A6\u09BF\u09A4\u09C7 \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 <a href="/account/login/">\u09B2\u0997\u0987\u09A8</a> \u0995\u09B0\u09C1\u09A8\u0964 (Please <a href="/account/login/">log in</a> to cast your vote.)',
      'warning'
    );
    return;
  }

  selectedParty = { id: id, nameEn: nameEn, nameBn: nameBn };

  stepTimestamps.push(Date.now());
  var voteDurationMs = Date.now() - (voteStartTime || Date.now());
  var questionAvgSeconds = stepTimestamps.length > 1
    ? (voteDurationMs / (stepTimestamps.length - 1)) / 1000
    : 0;

  var votePayload = {
    election_evaluation_id: selectedElection ? selectedElection.electionEvaluationId : null,
    election_id: selectedElection ? selectedElection.electionId : null,
    constituency_id: selectedConstituency ? selectedConstituency.id : null,
    party_id: selectedParty.id,
    candidate_id: null,
    union_parishad_id: null,
    bot_detection: {
      vote_duration_ms: Math.round(voteDurationMs),
      interaction_count: interactionCount,
      question_avg: Math.round(questionAvgSeconds * 100) / 100,
    },
  };

  // Disable party list to prevent double-click
  var partyListElement = document.getElementById('party-list-selection');
  if (partyListElement) partyListElement.style.pointerEvents = 'none';

  fetch('/election_vote/api/cast-vote/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCSRFToken(),
    },
    body: JSON.stringify(votePayload),
  })
    .then(function (response) {
      if (response.redirected || !response.ok) {
        showPageMessage(
          '\u09AD\u09CB\u099F \u09A6\u09BF\u09A4\u09C7 \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 <a href="/account/login/">\u09B2\u0997\u0987\u09A8</a> \u0995\u09B0\u09C1\u09A8\u0964 (Please <a href="/account/login/">log in</a> to cast your vote.)',
          'warning'
        );
        if (partyListElement) partyListElement.style.pointerEvents = 'auto';
        return Promise.reject('not_authenticated');
      }
      return response.json();
    })
    .then(function (data) {
      if (!data) return;
      if (data.success) {
        clearPageMessage();
        displayVoteReceipt(data.receipt_code);
      } else {
        showPageMessage(data.error || 'Vote submission failed.', 'error');
        if (partyListElement) partyListElement.style.pointerEvents = 'auto';
      }
    })
    .catch(function (error) {
      if (error === 'not_authenticated') return;
      console.error('Vote submission error:', error);
      showPageMessage('ভোট জমা ব্যর্থ হয়েছে। আবার চেষ্টা করুন। (Vote submission failed. Please try again.)', 'error');
      if (partyListElement) partyListElement.style.pointerEvents = 'auto';
    });
}
