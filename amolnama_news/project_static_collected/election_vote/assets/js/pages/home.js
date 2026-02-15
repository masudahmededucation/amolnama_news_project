/* ========== Election Vote – Home Page State & Initialization ========== */
/*
 * Global state shared across voting modules:
 *   voting-navigation.js  — showVotingStep, updateBreadcrumbTrail, navigateBack*
 *   voting-selection.js   — handleElectionSelection, handleDivision/District/Constituency
 *   voting-submission.js  — handlePartySelectionAndCastVote, displayVoteReceipt
 */

/* --- Voting State --- */
var selectedElection = null;
var selectedDivision = null;
var selectedDistrict = null;
var selectedConstituency = null;
var selectedParty = null;

/* --- Bot-Detection Metrics --- */
var voteStartTime = null;
var interactionCount = 0;
var stepTimestamps = [];

/* --- Track user interactions for bot detection --- */
document.addEventListener('click', function () { interactionCount++; });

/* --- Inline Page Message --- */
function showPageMessage(message, type) {
  var container = document.getElementById('page-message');
  if (!container) return;
  container.className = 'page-message page-message--' + (type || 'error');
  container.innerHTML = message;
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearPageMessage() {
  var container = document.getElementById('page-message');
  if (container) {
    container.style.display = 'none';
    container.innerHTML = '';
  }
}

/* --- CSRF Helper --- */
function getCSRFToken() {
  var name = 'csrftoken';
  var cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}
