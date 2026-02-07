/* ========== YOUTUBE-STYLE TOTAL VOTE INFO - Dynamic Update Component ========== */

/**
 * Update the total vote count display
 * @param {number} totalVotes - The total vote count to display
 * @param {string} elementId - Optional custom element ID (defaults to 'total-vote-info')
 */
function updateTotalVoteInfo(totalVotes, elementId = 'total-vote-info') {
  const totalVoteElement = document.getElementById(elementId);

  if (!totalVoteElement) {
    console.warn(`Element with ID '${elementId}' not found`);
    return;
  }

  // Format number with commas if needed (for large numbers)
  const formattedVotes = totalVotes.toLocaleString('bn-BD');

  // Update the display
  totalVoteElement.innerHTML = `<span class="highlight-vote">মোট ভোট: ${formattedVotes}</span>`;
}

/**
 * Fetch and display total vote count from API
 * @param {string} apiUrl - The API endpoint to fetch vote results
 * @param {string} elementId - Optional custom element ID (defaults to 'total-vote-info')
 */
function fetchAndDisplayTotalVotes(apiUrl, elementId = 'total-vote-info') {
  fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      if (data.results && data.results.length > 0) {
        const totalVotes = data.results[0].total_vote_count;
        updateTotalVoteInfo(totalVotes, elementId);
      }
    })
    .catch(error => {
      console.error('Error fetching total votes:', error);
    });
}

// Export functions for use in other modules (if using ES6 modules)
// export { updateTotalVoteInfo, fetchAndDisplayTotalVotes };
