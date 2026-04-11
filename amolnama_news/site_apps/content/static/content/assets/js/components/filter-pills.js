/* filter-pills.js — Shared client-side filter pills + crumbs component.
   Reusable across all blog landing pages. SPA-safe (cleanup on re-init).

   Usage:
     window.filterPillsInit({
       groups: [
         { pillsId: 'art-category-filter', dataAttribute: 'category', crumbLabel: 'বিভাগ' },
         { pillsId: 'art-medium-filter', dataAttribute: 'medium', crumbLabel: 'মাধ্যম' },
       ],
       cardSelector: '.art-gallery-card',
       crumbsContainerId: 'filter-crumbs-container',
       emptyContainerId: 'filter-empty-state',
       emptyMessage: 'কোনো ফলাফল পাওয়া যায়নি',
     });
*/
(function () {
  'use strict';

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /* Track registered listeners for SPA cleanup */
  var registeredCleanups = [];

  function cleanupPrevious() {
    registeredCleanups.forEach(function (cleanup) { cleanup(); });
    registeredCleanups = [];
  }

  window.filterPillsInit = function (config) {
    /* Clean up any previous instance (SPA re-navigation) */
    cleanupPrevious();

    var groups = config.groups || [];
    var cardSelector = config.cardSelector;
    var crumbsContainerId = config.crumbsContainerId;
    var emptyContainerId = config.emptyContainerId;
    var emptyMessage = config.emptyMessage || 'কোনো ফলাফল পাওয়া যায়নি';

    /* State: current filter value per group (empty = all) */
    var activeFilters = {};
    /* State: pill label per group (for crumb display) */
    var activePillLabels = {};
    groups.forEach(function (group) {
      activeFilters[group.dataAttribute] = '';
      activePillLabels[group.dataAttribute] = '';
    });

    /* Filter cards based on ALL active group filters (AND logic) */
    function filterCards() {
      var cards = document.querySelectorAll(cardSelector);
      var visibleCount = 0;

      cards.forEach(function (card) {
        var visible = true;
        groups.forEach(function (group) {
          var filterValue = activeFilters[group.dataAttribute];
          if (filterValue) {
            var cardValue = card.getAttribute('data-' + group.dataAttribute) || '';
            if (cardValue !== filterValue) visible = false;
          }
        });
        card.hidden = !visible;
        if (visible) visibleCount++;
      });

      /* Empty state */
      var emptyElement = document.getElementById(emptyContainerId);
      if (emptyElement) {
        if (visibleCount === 0) {
          emptyElement.innerHTML = '<p>' + escapeHtml(emptyMessage) + '</p>';
          emptyElement.hidden = false;
        } else {
          emptyElement.hidden = true;
        }
      }

      updateCrumbs();
    }

    /* Update filter crumbs display */
    function updateCrumbs() {
      var crumbsWrap = document.getElementById(crumbsContainerId);
      if (!crumbsWrap) return;

      var chipsContainer = crumbsWrap.querySelector('.filter-crumbs-chips');
      if (!chipsContainer) return;

      var hasActive = false;
      var chipsHtml = '';

      groups.forEach(function (group) {
        var filterValue = activeFilters[group.dataAttribute];
        if (!filterValue) return;
        hasActive = true;

        var pillText = activePillLabels[group.dataAttribute] || filterValue;

        var chipRemoveId = 'filter-crumbs-chip-remove-' + group.dataAttribute;
        chipsHtml += '<span class="filter-crumbs-chip">' +
          (group.crumbLabel ? '<span class="filter-crumbs-chip-label">' + escapeHtml(group.crumbLabel) + ':</span> ' : '') +
          escapeHtml(pillText) +
          ' <button type="button" class="filter-crumbs-chip-remove" id="' + chipRemoveId +
          '" name="' + chipRemoveId + '" data-clear-group="' + group.dataAttribute + '">✕</button>' +
          '</span>';
      });

      chipsContainer.innerHTML = chipsHtml;
      crumbsWrap.hidden = !hasActive;
    }

    /* Clear a specific filter group */
    function clearGroup(dataAttribute) {
      activeFilters[dataAttribute] = '';
      activePillLabels[dataAttribute] = '';

      /* Reset pills to "All" for that group */
      var group = groups.find(function (g) { return g.dataAttribute === dataAttribute; });
      if (group) {
        var pillsGroup = document.getElementById(group.pillsId);
        if (pillsGroup) {
          pillsGroup.querySelectorAll('.filter-pills-pill').forEach(function (p) {
            p.classList.remove('filter-pills-pill-active');
          });
          var allPill = pillsGroup.querySelector('[data-' + dataAttribute + '=""]');
          if (allPill) allPill.classList.add('filter-pills-pill-active');
        }
      }

      filterCards();
    }

    /* Clear all filters */
    function clearAll() {
      groups.forEach(function (group) {
        activeFilters[group.dataAttribute] = '';
        activePillLabels[group.dataAttribute] = '';
        var pillsGroup = document.getElementById(group.pillsId);
        if (pillsGroup) {
          pillsGroup.querySelectorAll('.filter-pills-pill').forEach(function (p) {
            p.classList.remove('filter-pills-pill-active');
          });
          var allPill = pillsGroup.querySelector('[data-' + group.dataAttribute + '=""]');
          if (allPill) allPill.classList.add('filter-pills-pill-active');
        }
      });

      filterCards();
    }

    /* Register pill click handlers for each group */
    groups.forEach(function (group) {
      var pillsGroup = document.getElementById(group.pillsId);
      if (!pillsGroup) return;

      var handler = function (event) {
        var pill = event.target.closest('.filter-pills-pill');
        if (!pill) return;

        pillsGroup.querySelectorAll('.filter-pills-pill').forEach(function (p) {
          p.classList.remove('filter-pills-pill-active');
        });
        pill.classList.add('filter-pills-pill-active');

        activeFilters[group.dataAttribute] = pill.getAttribute('data-' + group.dataAttribute) || '';
        activePillLabels[group.dataAttribute] = pill.textContent.trim();
        filterCards();
      };

      pillsGroup.addEventListener('click', handler);
      registeredCleanups.push(function () {
        pillsGroup.removeEventListener('click', handler);
      });
    });

    /* Register crumb click handlers (chip remove + clear all) */
    var crumbsWrap = document.getElementById(crumbsContainerId);
    if (crumbsWrap) {
      var crumbHandler = function (event) {
        var chipRemove = event.target.closest('.filter-crumbs-chip-remove');
        if (chipRemove) {
          var groupToClear = chipRemove.getAttribute('data-clear-group');
          if (groupToClear) clearGroup(groupToClear);
          return;
        }

        var clearAllButton = event.target.closest('.filter-crumbs-clear');
        if (clearAllButton) clearAll();
      };

      crumbsWrap.addEventListener('click', crumbHandler);
      registeredCleanups.push(function () {
        crumbsWrap.removeEventListener('click', crumbHandler);
      });
    }
  };
})();
