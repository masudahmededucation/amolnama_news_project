/* ========== Election Vote – Receipt Display & National Results ========== */

/**
 * Step 5: Display the vote receipt with audit code and summary.
 * @param {string} receiptCode - The unique ballot receipt code (XXXXX-NNNNN).
 */
function displayVoteReceipt(receiptCode) {
  var breadcrumb = document.getElementById('breadcrumb');
  if (breadcrumb) breadcrumb.style.display = 'none';

  showVotingStep('receipt-view');

  var codeElement = document.getElementById('receipt-code');
  if (codeElement) codeElement.textContent = receiptCode;

  var summaryElement = document.getElementById('receipt-summary');
  if (summaryElement) {
    summaryElement.innerHTML =
      '<p><strong>Election:</strong> ' + (selectedElection ? selectedElection.nameBn : '') + '</p>' +
      '<p><strong>Constituency:</strong> ' + (selectedConstituency ? selectedConstituency.nameBn + ' (' + selectedConstituency.nameEn + ')' : '') + '</p>' +
      '<p><strong>Party:</strong> ' + (selectedParty ? selectedParty.nameBn : '') + '</p>';
  }

  // Fetch national results after a short delay so the DB transaction is fully committed
  if (selectedElection && selectedElection.electionEvaluationId) {
    setTimeout(function () {
      fetchNationalResults(selectedElection.electionEvaluationId, 0);
    }, 1500);
  }
}

/**
 * Fetch national-level party results and render YouTube-style progress bars.
 * Retries once if the first attempt returns empty (DB may not be visible yet).
 * @param {number} electionEvaluationId
 * @param {number} attempt - Current attempt (0 = first, 1 = retry)
 */
function fetchNationalResults(electionEvaluationId, attempt) {
  fetch('/election_vote/api/national-results/' + electionEvaluationId + '/')
    .then(function (response) { return response.json(); })
    .then(function (data) {
      var container = document.getElementById('national-results-container');
      var totalVotesEl = document.getElementById('national-total-votes');
      var listEl = document.getElementById('national-results-list');

      if (!container || !listEl) return;

      // If empty and haven't retried yet, wait and try again
      if (!data.results || data.results.length === 0) {
        if (attempt < 1) {
          setTimeout(function () {
            fetchNationalResults(electionEvaluationId, attempt + 1);
          }, 2000);
        }
        return;
      }

      // Total votes
      if (totalVotesEl) {
        totalVotesEl.innerHTML = '<span class="highlight-vote">\u09AE\u09CB\u099F \u09AD\u09CB\u099F: ' +
          Number(data.total_votes).toLocaleString() + '</span>';
      }

      // Build progress bar items
      var html = '';
      data.results.forEach(function (party) {
        html += '<li><div class="party-item">';

        // Party logo
        if (party.file_name) {
          html += '<img src="/media/' + party.file_path + party.file_name +
            '" alt="' + (party.party_short_name || '') + '" class="party-logo" />';
        }

        html += '<div class="party-text" style="flex: 1;">';
        html += '<div class="party-info">';
        if (party.party_short_name) {
          html += '<span class="party-short">' + party.party_short_name + '</span>';
          html += '<span class="party-separator">-</span>';
        }
        html += '<span class="party-name">' + party.party_name + '</span>';
        html += '</div>';

        // Progress bar
        html += '<div class="bar-container">';
        html += '<div class="bar-fill" style="width: ' + party.percentage.toFixed(1) + '%;"></div>';
        html += '<span class="pct-text">' + party.percentage.toFixed(1) + '%';
        html += ' <span class="vote-count">(' + Number(party.votes).toLocaleString() + ' \u09AD\u09CB\u099F)</span>';
        html += '</span></div>';

        html += '</div></div></li>';
      });

      listEl.innerHTML = html;
      container.style.display = 'block';
    })
    .catch(function (error) {
      console.error('Failed to load national results:', error);
    });
}
