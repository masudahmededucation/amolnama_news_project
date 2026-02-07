console.log('home.js loaded successfully');

let selectedDivision = null;
let selectedDistrict = null;
let selectedConstituency = null;
let selectedParty = null;
let currentVoteId = null;

// Character counter for reason textarea
document.addEventListener('DOMContentLoaded', function() {
  const textarea = document.getElementById('vote-reason');
  const charCount = document.getElementById('char-count');
  if (textarea && charCount) {
    textarea.addEventListener('input', function() {
      charCount.textContent = this.value.length;
    });
  }
});

function selectDivision(id, nameEn, nameBn) {
  selectedDivision = { id, nameEn, nameBn };
  const bc = document.getElementById('breadcrumb');
  if (bc) {
    bc.innerHTML = `
      <a href="#" onclick="goBackToDivisions(); return false;">Division / বিভাগ</a>
      <span>›</span>
      <span class="current">${nameEn} (${nameBn})</span>
    `;
  }
  showView('district-view');
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

function selectDistrict(id, nameEn, nameBn) {
  selectedDistrict = { id, nameEn, nameBn };
  const bc = document.getElementById('breadcrumb');
  if (bc) {
    bc.innerHTML = `
      <a href="#" onclick="goBackToDivisions(); return false;">Division / বিভাগ</a>
      <span>›</span>
      <a href="#" onclick="goBackToDistricts(); return false;">${selectedDivision.nameEn} (${selectedDivision.nameBn})</a>
      <span>›</span>
      <span class="current">${nameEn} (${nameBn})</span>
    `;
  }
  showView('constituency-view');
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

function selectConstituency(id, nameEn, nameBn) {
  selectedConstituency = { id, nameEn, nameBn };
  const bc = document.getElementById('breadcrumb');
  if (bc) {
    bc.innerHTML = `
      <a href="#" onclick="goBackToDivisions(); return false;">Division / বিভাগ</a>
      <span>›</span>
      <a href="#" onclick="goBackToDistricts(); return false;">${selectedDivision.nameEn} (${selectedDivision.nameBn})</a>
      <span>›</span>
      <a href="#" onclick="goBackToConstituencies(); return false;">${selectedDistrict.nameEn} (${selectedDistrict.nameBn})</a>
      <span>›</span>
      <span class="current">${nameEn} (${nameBn})</span>
    `;
  }
  showView('party-view');
}

function selectParty(id, nameEn, nameBn, event) {
  if (event) event.preventDefault();
  selectedParty = { id, nameEn, nameBn };
  submitVote();
}

function detectBrowserName() {
  const ua = navigator.userAgent;
  if (/chrome|crios|crmo/i.test(ua) && !/edge|edg|opr|opera/i.test(ua)) return "Chrome";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua) && !/chrome|crios|crmo|android/i.test(ua)) return "Safari";
  if (/edg|edge/i.test(ua)) return "Edge";
  if (/opr|opera/i.test(ua)) return "Opera";
  return "Other";
}

function getDeviceInfo() {
  return {
    app_platform_name: navigator.platform,
    browser_name: detectBrowserName(),
    app_instance_id: localStorage.getItem('app_instance_id') || null
  };
}

function getGeoInfo(callback) {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(position) {
        callback({
          country_name_en: "Unknown",
          region_name_en: "Unknown",
          city_name_en: "Unknown",
          network_isp_name: "Unknown",
          network_type: "Unknown",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      function(error) {
        callback({
          country_name_en: "Unknown",
          region_name_en: "Unknown",
          city_name_en: "Unknown",
          network_isp_name: "Unknown",
          network_type: "Unknown",
          latitude: 0,
          longitude: 0
        });
      }
    );
  } else {
    callback({
      country_name_en: "Unknown",
      region_name_en: "Unknown",
      city_name_en: "Unknown",
      network_isp_name: "Unknown",
      network_type: "Unknown",
      latitude: 0,
      longitude: 0
    });
  }
}

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

function updateSummaryLine(division, district, constituency, party) {
  const summaryInfo = document.querySelector('.vote-summary-info');
  if (summaryInfo) {
    summaryInfo.textContent =
      `বিভাগ: ${division}, জেলা: ${district}, নির্বাচনী এলাকা: ${constituency}, দল: ${party}`;
  }
}

function showSuccessView() {
  if (!selectedDivision || !selectedDistrict || !selectedConstituency || !selectedParty) return;
  showView('success-view');
  const bc = document.getElementById('breadcrumb');
  if (bc) bc.style.display = 'none';
  const reasonLabel = document.getElementById('reason-label');
  if (reasonLabel) {
    reasonLabel.innerHTML =
      `এই দলটিকে (<strong>${selectedParty.nameBn}</strong>) বেছে নেওয়ার মূল কারণ কী?`;
  }
  const voteReason = document.getElementById('vote-reason');
  if (voteReason) voteReason.value = '';
  const charCount = document.getElementById('char-count');
  if (charCount) charCount.textContent = '0';
  loadUpazilas();
}

function updatePartyListWithPercentages() {
  fetch('/evaluation_vote/api/party-results/')
    .then(response => response.json())
    .then(data => {
      // Update total vote count
      const totalVoteInfo = document.getElementById('total-vote-info');
      if (totalVoteInfo && data.results.length > 0) {
        const totalVotes = data.results[0].total_vote_count;
        totalVoteInfo.innerHTML = `<span class="highlight-vote">মোট ভোট: ${totalVotes}</span>`;      }

      const partyList = document.getElementById('party-list-success');
      if (!partyList) return;
      partyList.innerHTML = '';
      
      data.results.forEach(party => {
        // Use the dynamic file_path and file_name from your API
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

function startNewVote() {
  selectedDivision = null;
  selectedDistrict = null;
  selectedConstituency = null;
  selectedParty = null;
  currentVoteId = null;
  const bc = document.getElementById('breadcrumb');
  if (bc) {
    bc.style.display = 'flex';
    bc.innerHTML = '<span class="current">Division / বিভাগ</span>';
  }
  showView('division-view');
}

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

function showView(viewId) {
  // Hide all main views
  const views = ['division-view', 'district-view', 'constituency-view', 'party-view', 'success-view'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Show the requested view
  const showEl = document.getElementById(viewId);
  if (showEl) showEl.style.display = 'block';
}

function goBackToDivisions() {
  selectedDivision = null;
  selectedDistrict = null;
  selectedConstituency = null;
  selectedParty = null;
  const bc = document.getElementById('breadcrumb');
  if (bc) bc.innerHTML = '<span class="current">Division / বিভাগ</span>';
  showView('division-view');
}

function goBackToDistricts() {
  selectedDistrict = null;
  selectedConstituency = null;
  selectedParty = null;
  const bc = document.getElementById('breadcrumb');
  if (bc) {
    bc.innerHTML = `
      <a href="#" onclick="goBackToDivisions(); return false;">Division / বিভাগ</a>
      <span>›</span>
      <span class="current">${selectedDivision.nameEn} (${selectedDivision.nameBn})</span>
    `;
  }
  showView('district-view');
}

function goBackToConstituencies() {
  selectedConstituency = null;
  selectedParty = null;
  const bc = document.getElementById('breadcrumb');
  if (bc) {
    bc.innerHTML = `
      <a href="#" onclick="goBackToDivisions(); return false;">Division / বিভাগ</a>
      <span>›</span>
      <a href="#" onclick="goBackToDistricts(); return false;">${selectedDivision.nameEn} (${selectedDivision.nameBn})</a>
      <span>›</span>
      <span class="current">${selectedDistrict.nameEn} (${selectedDistrict.nameBn})</span>
    `;
  }
  showView('constituency-view');
}