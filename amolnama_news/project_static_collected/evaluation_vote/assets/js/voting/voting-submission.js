/* ========== VOTING SUBMISSION - Form Validation & Vote Submission ========== */

/**
 * Get CSRF token from cookies for secure API requests
 * @returns {string} CSRF token value or null
 */
function getCsrfToken() {
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

/**
 * Handle party selection and submit vote
 * @param {number} id - Party ID
 * @param {string} nameEn - Party name in English
 * @param {string} nameBn - Party name in Bengali
 * @param {Event} event - Click event
 */
function selectParty(id, nameEn, nameBn, event) {
  if (event) event.preventDefault();
  
  selectedParty = { id, nameEn, nameBn };
  submitVote();
}

/**
 * Submit the vote with device info and geo info
 * Sends vote data to backend API
 */
function submitVote() {
  getGeoInfo(function(geo) {
    const voteData = {
      division_id: selectedDivision?.id,
      district_id: selectedDistrict?.id,
      constituency_id: selectedConstituency?.id,
      party_id: selectedParty?.id,
      device_info: getDeviceInfo(),
      geo_info: geo,
      division_name_bn: selectedDivision?.nameBn,
      district_name_bn: selectedDistrict?.nameBn,
      constituency_name_bn: selectedConstituency?.nameBn,
      party_name_bn: selectedParty?.nameBn
    };
    
    console.log("Submitting vote:", voteData);

    fetch('/evaluation_vote/api/submit-vote/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify(voteData),
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          currentVoteId = data.vote_id;
          updateSummaryLine(
            data.division_name || selectedDivision?.nameBn || '',
            data.district_name || selectedDistrict?.nameBn || '',
            data.constituency_name || selectedConstituency?.nameBn || '',
            data.party_name || selectedParty?.nameBn || ''
          );
          showSuccessView();
          updatePartyListWithPercentages();
        } else {
          alert(data.error || 'Vote submission failed.');
        }
      })
      .catch(error => {
        alert('Vote submission failed.');
        console.error('Error:', error);
      });
  });
}

/**
 * Update vote summary display with selected choices
 * @param {string} division - Division name
 * @param {string} district - District name
 * @param {string} constituency - Constituency name
 * @param {string} party - Party name
 */
function updateSummaryLine(division, district, constituency, party) {
  const summaryInfo = document.querySelector('.vote-summary-info');
  if (summaryInfo) {
    summaryInfo.textContent = `বিভাগ: ${division}, জেলা: ${district}, নির্বাচনী এলাকা: ${constituency}, দল: ${party}`;
  }
}

/**
 * Display success view after vote submission
 * Initializes optional info collection form
 */
function showSuccessView() {
  if (!selectedDivision || !selectedDistrict || !selectedConstituency || !selectedParty) return;
  
  showView('success-view');
  
  const bc = document.getElementById('breadcrumb');
  if (bc) bc.style.display = 'none';
  
  const reasonLabel = document.getElementById('reason-label');
  if (reasonLabel) {
    reasonLabel.innerHTML = `এই দলটিকে (<strong>${selectedParty.nameBn}</strong>) বেছে নেওয়ার মূল কারণ কী?`;
  }
  
  const voteReason = document.getElementById('vote-reason');
  if (voteReason) voteReason.value = '';
  
  const charCount = document.getElementById('char-count');
  if (charCount) charCount.textContent = '0';
  
  loadUpazilas();
}

/**
 * Update vote with additional info (reason and location)
 * Called when user submits the optional info form
 */
function updateVote() {
  const reason = document.getElementById('vote-reason').value.trim();
  const unionId = document.getElementById('union').value;
  
  if (!reason && !unionId) {
    return;
  }
  
  const updateData = {
    vote_id: currentVoteId,
  };
  
  if (reason) {
    updateData.remarks_bn = reason;
  }
  
  if (unionId) {
    updateData.union_parishad_id = unionId;
  }
  
  fetch('/evaluation_vote/api/update-vote/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
    },
    body: JSON.stringify(updateData),
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        const successMsg = document.getElementById('update-success');
        if (successMsg) {
          successMsg.classList.add('show');
          setTimeout(() => {
            successMsg.classList.remove('show');
          }, 3000);
        }
      }
    })
    .catch(error => {
      console.error('Error:', error);
    });
}
