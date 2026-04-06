/* ========== Election Vote – Home Page State & Initialization ========== */
/*
 * Global state shared across voting modules:
 *   voting-navigation.js  — showVotingStep, updateBreadcrumbTrail, navigateBack*
 *   voting-selection.js   — handleElectionSelection, handleDivision/District/Constituency
 *   voting-submission.js  — handlePartySelectionAndCastVote, displayVoteReceipt
 */

/* --- Voting State --- */
let selectedElection = null;
let selectedDivision = null;
let selectedDistrict = null;
let selectedConstituency = null;
let selectedParty = null;

/* --- Bot-Detection Metrics --- */
let voteStartTime = null;
let interactionCount = 0;
let stepTimestamps = [];

/* --- Track user interactions for bot detection --- */
document.addEventListener('click', function () { interactionCount++; });

/* --- Inline Page Message --- */
function showPageMessage(message, type) {
  let container = document.getElementById('page-message');
  if (!container) return;
  container.className = 'page-message page-message--' + (type || 'error');
  container.innerHTML = message;
  container.hidden = false;
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearPageMessage() {
  const container = document.getElementById('page-message');
  if (container) {
    container.hidden = true;
    container.innerHTML = '';
  }
}

/* --- CSRF Helper --- */
function getCSRFToken() {
  const name = 'csrftoken';
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

/* --- Election selection via event delegation (no inline onclick) --- */
document.addEventListener('click', function (event) {
  const electionOption = event.target.closest('.election-selection-option');
  if (!electionOption) return;

  const electionEvaluationId = parseInt(electionOption.getAttribute('data-election-evaluation-id'), 10);
  const electionId = parseInt(electionOption.getAttribute('data-election-id'), 10);
  const nameEn = electionOption.getAttribute('data-name-en');
  const nameBn = electionOption.getAttribute('data-name-bn');

  if (typeof handleElectionSelection === 'function') {
    handleElectionSelection(electionEvaluationId, electionId, nameEn, nameBn);
  }
});
