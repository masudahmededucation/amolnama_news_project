/* ========== VOTING SELECTION - API Calls & Data Fetching ========== */

/**
 * Handle division selection
 * Fetches districts for the selected division
 * @param {number} id - Division ID
 * @param {string} nameEn - Division name in English
 * @param {string} nameBn - Division name in Bengali
 */
function selectDivision(id, nameEn, nameBn) {
  selectedDivision = { id, nameEn, nameBn };
  
  updateBreadcrumb(nameEn, nameBn);
  showView('district-view');
  
  // Fetch districts from API
  fetch(`/evaluation_vote/api/districts/${id}/`)
    .then(response => response.json())
    .then(data => {
      const list = document.getElementById('district-list');
      if (!list) return;
      
      list.innerHTML = '';
      
      if (data.districts.length === 0) {
        list.innerHTML = '<li>No districts found / কোনো জেলা পাওয়া যায়নি</li>';
        return;
      }
      
      data.districts.forEach(district => {
        const li = document.createElement('li');
        li.onclick = () => selectDistrict(district.id, district.name_en, district.name_bn);
        li.innerHTML = `
          <span class="name-en">${district.name_en}</span>
          <span class="name-bn">(${district.name_bn})</span>
        `;
        list.appendChild(li);
      });
    })
    .catch(error => {
      console.error('Error loading districts:', error);
    });
}

/**
 * Handle district selection
 * Fetches constituencies for the selected district
 * @param {number} id - District ID
 * @param {string} nameEn - District name in English
 * @param {string} nameBn - District name in Bengali
 */
function selectDistrict(id, nameEn, nameBn) {
  selectedDistrict = { id, nameEn, nameBn };
  
  updateBreadcrumb(
    selectedDivision.nameEn,
    selectedDivision.nameBn,
    nameEn,
    nameBn
  );
  showView('constituency-view');
  
  // Fetch constituencies from API
  fetch(`/evaluation_vote/api/constituencies/${id}/`)
    .then(response => response.json())
    .then(data => {
      const list = document.getElementById('constituency-list');
      if (!list) return;
      
      list.innerHTML = '';
      
      if (data.constituencies.length === 0) {
        list.innerHTML = '<li>No constituencies found / কোনো নির্বাচনী এলাকা পাওয়া যায়নি</li>';
        return;
      }
      
      data.constituencies.forEach(constituency => {
        const li = document.createElement('li');
        li.onclick = () => selectConstituency(constituency.id, constituency.name_en, constituency.name_bn);
        li.innerHTML = `
          <span class="name-en">${constituency.name_en}</span>
          <span class="name-bn">(${constituency.name_bn})</span>
          ${constituency.area_bn ? `<div class="area-info">${constituency.area_bn}</div>` : ''}
        `;
        list.appendChild(li);
      });
    })
    .catch(error => {
      console.error('Error loading constituencies:', error);
    });
}

/**
 * Handle constituency selection
 * Updates breadcrumb and shows party selection view
 * @param {number} id - Constituency ID
 * @param {string} nameEn - Constituency name in English
 * @param {string} nameBn - Constituency name in Bengali
 */
function selectConstituency(id, nameEn, nameBn) {
  selectedConstituency = { id, nameEn, nameBn };
  
  updateBreadcrumb(
    selectedDivision.nameEn,
    selectedDivision.nameBn,
    selectedDistrict.nameEn,
    selectedDistrict.nameBn,
    nameEn,
    nameBn
  );
  
  showView('party-view');
}

/**
 * Load upazilas for the selected district
 * Called after successful vote submission
 */
function loadUpazilas() {
  const upazilaSelect = document.getElementById('upazila');
  const unionSelect = document.getElementById('union');
  
  if (!upazilaSelect || !unionSelect) return;
  
  upazilaSelect.innerHTML = '<option value="">-- নির্বাচন করুন / Select --</option>';
  unionSelect.innerHTML = '<option value="">-- নির্বাচন করুন / Select --</option>';
  unionSelect.disabled = true;
  
  fetch(`/evaluation_vote/api/upazilas/${selectedDistrict.id}/`)
    .then(response => response.json())
    .then(data => {
      data.upazilas.forEach(upazila => {
        const option = document.createElement('option');
        option.value = upazila.id;
        option.textContent = `${upazila.name_en} (${upazila.name_bn})`;
        upazilaSelect.appendChild(option);
      });
    })
    .catch(error => {
      console.error('Error loading upazilas:', error);
    });
}

/**
 * Load unions for the selected upazila
 * Called when upazila selection changes
 */
function loadUnions() {
  const upazilaId = document.getElementById('upazila').value;
  const unionSelect = document.getElementById('union');
  
  if (!unionSelect) return;
  
  unionSelect.innerHTML = '<option value="">-- নির্বাচন করুন / Select --</option>';
  unionSelect.disabled = true;
  
  if (!upazilaId) return;
  
  fetch(`/evaluation_vote/api/unions/${upazilaId}/`)
    .then(response => response.json())
    .then(data => {
      data.unions.forEach(union => {
        const option = document.createElement('option');
        option.value = union.id;
        option.textContent = `${union.name_en} (${union.name_bn})`;
        unionSelect.appendChild(option);
      });
      unionSelect.disabled = false;
    })
    .catch(error => {
      console.error('Error loading unions:', error);
    });
}

/**
 * Fetch current vote casting results with vote counts and percentages
 * Called to update party list with latest voting data
 */
function updatePartyListWithPercentages() {
  fetch('/evaluation_vote/api/vote-cast-current-results/')
    .then(response => response.json())
    .then(data => {
      // Update total vote count
      const totalVoteInfo = document.getElementById('total-vote-info');
      if (totalVoteInfo && data.results.length > 0) {
        const totalVotes = data.results[0].total_vote_count;
        totalVoteInfo.innerHTML = `<span class="highlight-vote">মোট ভোট: ${totalVotes}</span>`;
      }

      // Update party list with results
      const partyList = document.getElementById('party-list-success');
      if (!partyList) return;
      
      partyList.innerHTML = '';
      
      data.results.forEach(party => {
        const logoUrl = `/media/${party.file_path}${party.file_name}`;

        partyList.innerHTML += `
          <li>
            <div class="party-item">
              <img 
                src="${logoUrl}" 
                alt="${party.party_short_name_bn}" 
                class="party-logo"
              >
              <div class="party-text">
                <div class="party-info">
                  <span class="party-short">${party.party_short_name_bn}</span>
                  <span class="party-separator">-</span>
                  <span class="party-name">${party.party_name_bn}</span>
                </div>
                <div class="bar-container">
                  <div class="bar-fill" style="width: ${party.vote_percentage}%;"></div>
                  <span class="pct-text">
                    ${parseFloat(party.vote_percentage).toFixed(1)}%
                    <span class="vote-count">(${party.party_vote_count} ভোট)</span>
                  </span>
                </div>
              </div>
            </div>
          </li>
        `;
      });
    });
}
