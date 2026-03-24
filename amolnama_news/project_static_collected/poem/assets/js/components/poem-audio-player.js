/* ============================================================
   Poem Audio Player — YouTube IFrame API as audio-only bar
   Shows: play/pause, progress, time, volume, "Watch Video" expand
   ============================================================ */
(function() {
  "use strict";

  var container = document.getElementById("poemAudioPlayer");
  if (!container) return;

  var url = container.getAttribute("data-url") || "";
  var videoId = extractYouTubeId(url);
  if (!videoId) return;

  // Elements
  var playBtn = document.getElementById("poemAudioPlayBtn");
  var iconPlay = document.getElementById("poemAudioIconPlay");
  var iconPause = document.getElementById("poemAudioIconPause");
  var progressFill = document.getElementById("poemAudioProgressFill");
  var progressBar = document.querySelector(".poem-audio-progress-bar");
  var timeEl = document.getElementById("poemAudioTime");
  var volBtn = document.getElementById("poemAudioVolBtn");
  var iconVol = document.getElementById("poemAudioIconVol");
  var iconMute = document.getElementById("poemAudioIconMute");
  var videoBtn = document.getElementById("poemAudioVideoBtn");
  var videoWrap = document.getElementById("poemAudioVideoWrap");
  var collapseBtn = document.getElementById("poemAudioCollapseBtn");

  var player = null;
  var progressTimer = null;
  var isMuted = false;
  var isVideoExpanded = false;

  // Extract YouTube video ID from various URL formats
  function extractYouTubeId(url) {
    if (!url) return null;
    var match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  // Load YouTube IFrame API
  function loadYTApi() {
    if (window.YT && window.YT.Player) {
      initPlayer();
      return;
    }
    // Set callback before loading script
    window.onYouTubeIframeAPIReady = initPlayer;
    var tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }

  function initPlayer() {
    player = new YT.Player("poemYTPlayer", {
      height: "0",
      width: "0",
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onStateChange
      }
    });
  }

  function onPlayerReady() {
    // Player is ready — enable controls
    playBtn.disabled = false;
  }

  function onStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
      iconPlay.style.display = "none";
      iconPause.style.display = "block";
      startProgressUpdate();
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
      iconPlay.style.display = "block";
      iconPause.style.display = "none";
      stopProgressUpdate();
    }
    if (event.data === YT.PlayerState.ENDED) {
      progressFill.style.width = "100%";
      // Trigger radio autoplay — fetch next poem
      fetchNextPoem();
    }
  }

  function startProgressUpdate() {
    stopProgressUpdate();
    progressTimer = setInterval(updateProgress, 250);
  }

  function stopProgressUpdate() {
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
  }

  function updateProgress() {
    if (!player || !player.getDuration) return;
    var duration = player.getDuration();
    var current = player.getCurrentTime();
    if (duration > 0) {
      var pct = (current / duration) * 100;
      progressFill.style.width = pct + "%";
      timeEl.textContent = formatTime(current) + " / " + formatTime(duration);
    }
  }

  // ---- Controls ----

  // Play / Pause
  playBtn.addEventListener("click", function() {
    if (!player || !player.getPlayerState) return;
    var state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  });

  // Click + drag on progress bar to seek
  var isDragging = false;

  function seekToPosition(e) {
    if (!player || !player.getDuration) return;
    var rect = progressBar.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    var seekTo = pct * player.getDuration();
    player.seekTo(seekTo, true);
    progressFill.style.width = (pct * 100) + "%";
    updateProgress();
  }

  progressBar.addEventListener("mousedown", function(e) {
    e.preventDefault();
    isDragging = true;
    document.body.style.userSelect = "none";
    seekToPosition(e);
  });

  document.addEventListener("mousemove", function(e) {
    if (isDragging) {
      e.preventDefault();
      seekToPosition(e);
    }
  });

  document.addEventListener("mouseup", function() {
    if (isDragging) {
      isDragging = false;
      document.body.style.userSelect = "";
    }
  });

  // Touch support for mobile
  progressBar.addEventListener("touchstart", function(e) {
    isDragging = true;
    seekToPosition(e.touches[0]);
  }, { passive: true });

  document.addEventListener("touchmove", function(e) {
    if (isDragging) seekToPosition(e.touches[0]);
  }, { passive: true });

  document.addEventListener("touchend", function() {
    isDragging = false;
  });

  // Mute / Unmute
  volBtn.addEventListener("click", function() {
    if (!player) return;
    if (isMuted) {
      player.unMute();
      iconVol.style.display = "block";
      iconMute.style.display = "none";
    } else {
      player.mute();
      iconVol.style.display = "none";
      iconMute.style.display = "block";
    }
    isMuted = !isMuted;
  });

  // Watch Video — expand
  videoBtn.addEventListener("click", function() {
    if (!player) return;
    videoWrap.style.display = "block";
    // Resize player to visible video
    var iframe = document.querySelector("#poemYTPlayer");
    if (iframe) {
      iframe.style.width = "100%";
      iframe.style.height = "";
      iframe.style.aspectRatio = "16/9";
    }
    isVideoExpanded = true;
    videoBtn.style.display = "none";
  });

  // Collapse video
  collapseBtn.addEventListener("click", function() {
    videoWrap.style.display = "none";
    var iframe = document.querySelector("#poemYTPlayer");
    if (iframe) {
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.aspectRatio = "";
    }
    isVideoExpanded = false;
    videoBtn.style.display = "";
  });

  // ---- Radio Autoplay ----
  var radioNextEl = document.getElementById("poemRadioNext");
  var radioCountdownEl = document.getElementById("poemRadioCountdown");
  var radioCancelBtn = document.getElementById("poemRadioCancelBtn");
  var radioNextTitle = document.getElementById("poemRadioNextTitle");
  var radioNextAuthor = document.getElementById("poemRadioNextAuthor");
  var radioNextPreview = document.getElementById("poemRadioNextPreview");
  var radioTimer = null;
  var radioCancelled = false;
  var playedIds = [];          // track poems already played in this session
  var exhaustedCategories = []; // categories fully played

  // Add current poem to played list
  var initialPoemId = document.querySelector(".poem-detail") ?
    parseInt(document.querySelector(".poem-detail").getAttribute("data-poem-id")) : null;
  if (initialPoemId) playedIds.push(initialPoemId);

  function fetchNextPoem() {
    if (!radioNextEl) return;
    var article = document.querySelector(".poem-detail");
    var poemId = article ? article.getAttribute("data-poem-id") : null;
    if (!poemId) return;

    var params = "?played=" + playedIds.join(",") +
                 "&exhausted=" + exhaustedCategories.join(",");

    fetch("/bangla-kobita-gaan/api/poems/" + poemId + "/next/" + params)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.success || !data.next) return;

        // Track this poem as played
        playedIds.push(data.next.id);

        // Update exhausted categories from server
        if (data.exhausted_categories) {
          exhaustedCategories = data.exhausted_categories;
        }

        // If all reset (server sent empty exhausted), clear our lists
        if (data.exhausted_categories && data.exhausted_categories.length === 0 && playedIds.length > 10) {
          playedIds = [data.next.id];
          exhaustedCategories = [];
        }

        showUpNext(data.next, data.category_changed);
      })
      .catch(function() {});
  }

  function showUpNext(next, categoryChanged) {
    radioCancelled = false;
    radioNextTitle.textContent = (categoryChanged ? "🔀 " : "") + next.title;
    radioNextAuthor.textContent = "— " + next.author + (categoryChanged ? " (" + next.category + ")" : "");
    radioNextPreview.textContent = next.body.substring(0, 150) + (next.body.length > 150 ? "..." : "");
    radioNextEl.style.display = "block";

    var countdown = 5;
    radioCountdownEl.textContent = countdown;

    radioTimer = setInterval(function() {
      countdown--;
      radioCountdownEl.textContent = countdown;
      if (countdown <= 0) {
        clearInterval(radioTimer);
        if (!radioCancelled) {
          // Transition to next poem
          transitionToPoem(next);
        }
      }
    }, 1000);
  }

  if (radioCancelBtn) {
    radioCancelBtn.addEventListener("click", function() {
      radioCancelled = true;
      if (radioTimer) clearInterval(radioTimer);
      radioNextEl.style.display = "none";
    });
  }

  function transitionToPoem(next) {
    // Update page content without reload
    var article = document.querySelector(".poem-detail");

    // Update poem body
    var titleEl = document.querySelector(".poem-detail-title");
    var authorEl = document.querySelector(".poem-detail-author");
    var bodyEl = document.querySelector(".poem-detail-text");
    var categoryEl = document.querySelector(".poem-detail-category");

    if (titleEl) titleEl.textContent = next.title;
    if (authorEl) authorEl.textContent = "— " + next.author;
    if (bodyEl) bodyEl.textContent = next.body;
    if (categoryEl) categoryEl.textContent = next.category;

    // Update data attributes
    if (article) {
      article.setAttribute("data-poem-id", next.id);
      article.setAttribute("data-category-id", next.category_id || "");
      article.setAttribute("data-poem-type", next.type || "poem");
    }

    // Update edit button link
    var editBtn = document.querySelector(".poem-detail-edit-btn");
    if (editBtn) editBtn.href = (next.url || "/bangla-kobita-gaan/id/" + next.id + "/").replace(/\/$/, "/edit/");

    // Update like button
    var likeBtn = document.getElementById("poemLikeBtn");
    if (likeBtn) {
      likeBtn.setAttribute("data-poem-id", next.id);
      likeBtn.setAttribute("data-liked", "false");
      likeBtn.classList.remove("poem-detail-action-btn--liked");
    }
    var likeCount = document.getElementById("poemLikeCount");
    if (likeCount) likeCount.textContent = next.like_count || 0;

    // Update meta bar
    var langEl = document.querySelector(".poem-detail-lang");
    if (langEl) { langEl.textContent = next.language || "bn"; langEl.style.textTransform = 'uppercase'; }

    var timeEl2 = document.querySelector(".poem-detail-time");
    if (timeEl2) timeEl2.textContent = "এইমাত্র";

    // Update view count
    var viewsEl = document.querySelector(".poem-detail-views");
    if (viewsEl) {
      var svgHtml = viewsEl.querySelector("svg") ? viewsEl.querySelector("svg").outerHTML : "";
      viewsEl.innerHTML = svgHtml + " " + (next.view_count || 0);
    }

    // Update audio info
    var audioTitle = container.querySelector(".poem-audio-title");
    if (audioTitle) audioTitle.textContent = next.audio_reciter ? "আবৃত্তি: " + next.audio_reciter : "অডিও শুনুন";
    var audioDesc = container.querySelector(".poem-audio-desc");
    if (audioDesc) audioDesc.textContent = next.audio_description || "";

    // Update browser URL without reload
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", next.url);
    }
    document.title = next.title + " — কবিতা ও গান · আমলনামা নিউজ";

    // Update backstory/interpretation sections
    var backstoryContent = document.getElementById("backstory");
    var backstoryToggle = document.querySelector("[data-toggle='backstory']");
    if (backstoryContent && backstoryToggle) {
      if (next.backstory) {
        backstoryContent.textContent = next.backstory;
        backstoryToggle.closest(".poem-detail-section").style.display = "";
      } else {
        backstoryToggle.closest(".poem-detail-section").style.display = "none";
      }
    }
    var interpContent = document.getElementById("interpretation");
    var interpToggle = document.querySelector("[data-toggle='interpretation']");
    if (interpContent && interpToggle) {
      if (next.interpretation) {
        interpContent.textContent = next.interpretation;
        interpToggle.closest(".poem-detail-section").style.display = "";
      } else {
        interpToggle.closest(".poem-detail-section").style.display = "none";
      }
    }

    // Hide the "Up Next" banner
    radioNextEl.style.display = "none";

    // Load new YouTube video
    var newVideoId = extractYouTubeId(next.audio_url);
    if (newVideoId && player && player.loadVideoById) {
      player.loadVideoById(newVideoId);
      // Force play after a short delay (Chrome autoplay policy workaround)
      setTimeout(function() {
        if (player && player.playVideo) player.playVideo();
      }, 500);
      // Reset progress
      progressFill.style.width = "0%";
      timeEl.textContent = "0:00 / 0:00";

      // Collapse video if expanded
      if (isVideoExpanded) {
        collapseBtn.click();
      }
    }

    // Scroll to audio player bar so user sees the new poem's player
    if (container) container.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Update related poems section — uses same smart helper as autoplay
    var relatedSection = document.querySelector(".poem-detail-related");
    if (relatedSection) {
      fetch("/bangla-kobita-gaan/api/poems/" + next.id + "/related/")
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var grid = relatedSection.querySelector(".poem-detail-related-grid");
          if (!grid || !data.poems) return;
          if (!data.poems.length) { relatedSection.style.display = "none"; return; }
          relatedSection.style.display = "";
          var html = "";
          data.poems.forEach(function(p, index) {
            var title = p.display_title || p.title_bn || p.title || "";
            var snippet = p.body_preview || (p.body || "").substring(0, 120);
            var category = p.category_name || p.category || "";
            var lang = p.language || "bn";
            var author = p.author_display_name || p.author || "";
            var likes = p.like_count || 0;
            var timeAgo = p.time_ago || "";
            var url = p.url || "/bangla-kobita-gaan/id/" + p.id + "/";
            html += '<a href="' + url + '" class="poem-card">'
              + '<span class="poem-card-queue-number">' + (index + 1) + '</span>'
              + '<div class="poem-card-body">'
              + '<div class="poem-card-header">'
              + '<span class="poem-card-category-badge">' + category + '</span>'
              + '<span class="poem-card-lang">' + lang + '</span>'
              + '</div>'
              + '<h3 class="poem-card-title">' + title + '</h3>'
              + '<p class="poem-card-preview">' + snippet + '</p>'
              + '</div>'
              + '<div class="poem-card-footer">'
              + '<span class="poem-card-author">' + author + '</span>'
              + '<div class="poem-card-stats">'
              + '<span class="poem-card-stat">'
              + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
              + ' ' + likes
              + '</span>'
              + '<span class="poem-card-time">' + timeAgo + '</span>'
              + '</div>'
              + '</div>'
              + '</a>';
          });
          grid.innerHTML = html;
        })
        .catch(function() {});
    }
  }

  // Start loading
  loadYTApi();
})();
