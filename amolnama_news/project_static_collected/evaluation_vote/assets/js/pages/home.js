/* ========== UNIFIED VOTING SYSTEM - Main JS File ========== */
/* This file initializes state variables and loads all modular JS modules */

console.log('home.js loaded successfully');

/* ========== GLOBAL STATE VARIABLES ========== */
let selectedDivision = null;
let selectedDistrict = null;
let selectedConstituency = null;
let selectedParty = null;
let currentVoteId = null;

/* ========== MODULE IMPORTS ========== */
/* All modular functionality is imported from:
   - voting-navigation.js: Navigation & breadcrumb management
   - voting-selection.js: API calls & data fetching (selectDivision, selectDistrict, etc.)
   - voting-submission.js: Vote submission & validation (submitVote, updateVote, etc.)
   - voting-tracker.js: Progress tracking & device/geo info (getDeviceInfo, getGeoInfo, etc.)
 */

/* ========== MODULE DOCUMENTATION ========== */

/* VOTING-NAVIGATION.JS provides:
   - updateBreadcrumb(division, divisionBn, district, districtBn, constituency, constituencyBn)
   - showView(viewId)
   - goBackToDivisions()
   - goBackToDistricts()
   - goBackToConstituencies()
   - startNewVote()
*/

/* VOTING-SELECTION.JS provides:
   - selectDivision(id, nameEn, nameBn) - fetches districts
   - selectDistrict(id, nameEn, nameBn) - fetches constituencies
   - selectConstituency(id, nameEn, nameBn) - shows party view
   - loadUpazilas() - fetches upazilas after vote
   - loadUnions() - fetches unions when upazila changes
   - updatePartyListWithPercentages() - updates results
*/

/* VOTING-SUBMISSION.JS provides:
   - getCsrfToken() - gets CSRF token
   - selectParty(id, nameEn, nameBn, event) - handles party selection
   - submitVote() - submits vote with device & geo info
   - updateSummaryLine(division, district, constituency, party)
   - showSuccessView() - displays success state
   - updateVote() - updates vote with additional info
*/

/* VOTING-TRACKER.JS provides:
   - detectBrowserName() - detects user's browser
   - getDeviceInfo() - gets device information
   - getGeoInfo(callback) - gets geolocation
   - initCharacterCounter() - initializes textarea counter
   - DOMContentLoaded event listener setup
*/
