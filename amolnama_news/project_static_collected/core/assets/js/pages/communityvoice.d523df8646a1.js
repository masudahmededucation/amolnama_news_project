function extractYouTubeId(url) {
    if (!url) return null;

    try {
        // Normalize URL (handles m.youtube.com, www, etc.)
        url = url.trim();

        // Common formats we want to support:
        // - https://www.youtube.com/watch?v=VIDEOID
        // - https://youtu.be/VIDEOID
        // - https://www.youtube.com/embed/VIDEOID
        // - https://www.youtube.com/shorts/VIDEOID
        const regex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/;

        const match = url.match(regex);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

function updateYouTubePreview(url) {
    const youtubePreview = document.getElementById("youtubePreview");
    const youtubeFrame = document.getElementById("youtubeFrame");

    const id = extractYouTubeId(url);
    if (id) {
        // Basic embed URL. You can add params if you want.
        youtubeFrame.src = "https://www.youtube.com/embed/" + encodeURIComponent(id) + "?rel=0";
        youtubePreview.style.display = "block";
    } else {
        youtubeFrame.src = "";
        youtubePreview.style.display = "none";
    }
}

function updateSimplePreview(inputId, previewBlockId, previewTextId) {
    const input = document.getElementById(inputId);
    const previewBlock = document.getElementById(previewBlockId);
    const previewText = document.getElementById(previewTextId);

    if (!input) return;

    function refresh() {
        if (input.value.trim()) {
            previewText.textContent = input.value.trim();
            previewBlock.style.display = "block";
        } else {
            previewText.textContent = "";
            previewBlock.style.display = "none";
        }
    }

    input.addEventListener("input", refresh);
    input.addEventListener("paste", function () {
        setTimeout(refresh, 0);
    });
}

document.addEventListener("DOMContentLoaded", function () {
    const youtubeInput = document.getElementById("id_youtube_url");

    if (youtubeInput) {
        youtubeInput.addEventListener("input", function () {
            updateYouTubePreview(this.value);
        });

        youtubeInput.addEventListener("paste", function () {
            setTimeout(() => updateYouTubePreview(youtubeInput.value), 0);
        });
    }

    updateSimplePreview("id_facebook_url", "facebookPreview", "facebookPreviewText");
    updateSimplePreview("id_external_url", "externalPreview", "externalPreviewText");
});
