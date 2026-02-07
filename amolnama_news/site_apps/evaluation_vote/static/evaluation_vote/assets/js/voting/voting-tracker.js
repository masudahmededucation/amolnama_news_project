/* ========== VOTING TRACKER - Progress Tracking & Device/Geo Info ========== */

/**
 * Detect browser name from user agent
 * @returns {string} Browser name
 */
function detectBrowserName() {
  const ua = navigator.userAgent;
  
  if (/chrome|crios|crmo/i.test(ua) && !/edge|edg|opr|opera/i.test(ua)) return "Chrome";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua) && !/chrome|crios|crmo|android/i.test(ua)) return "Safari";
  if (/edg|edge/i.test(ua)) return "Edge";
  if (/opr|opera/i.test(ua)) return "Opera";
  
  return "Other";
}

/**
 * Get device information for analytics
 * @returns {Object} Device info object with platform, browser, and instance ID
 */
function getDeviceInfo() {
  return {
    app_platform_name: navigator.platform,
    browser_name: detectBrowserName(),
    app_instance_id: localStorage.getItem('app_instance_id') || null
  };
}

/**
 * Get geographic location information
 * Uses browser geolocation and fallback values
 * @param {Function} callback - Callback function to receive geo data
 */
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

/**
 * Initialize character counter for reason textarea
 * Updates character count as user types
 */
function initCharacterCounter() {
  const textarea = document.getElementById('vote-reason');
  const charCount = document.getElementById('char-count');
  
  if (textarea && charCount) {
    textarea.addEventListener('input', function() {
      charCount.textContent = this.value.length;
    });
  }
}

/**
 * Initialize all trackers and event listeners
 * Call this when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function() {
  initCharacterCounter();
  console.log('Voting tracker initialized');
});
