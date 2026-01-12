(function () {
    console.log('[TubiQ] YouTube Overlay Script Loaded');

    function injectButton() {
        // Broaden target to include various YouTube player structures
        const player = document.querySelector('.html5-video-player') ||
            document.querySelector('#movie_player') ||
            document.querySelector('ytd-reel-video-renderer[is-active]') ||
            document.querySelector('ytd-player');

        if (!player) {
            // Fallback: Check for video elements in Shorts containers
            const shortsVideo = document.querySelector('ytd-reel-video-renderer[is-active] video');
            if (shortsVideo && shortsVideo.parentElement) {
                // If we found a video, try to find a suitable parent or just the video's parent
                addBtn(shortsVideo.parentElement);
            }
            return;
        }

        addBtn(player);
    }

    function addBtn(container) {
        if (container.querySelector('.tubiq-download-overlay')) return;

        console.log('[TubiQ] Injecting download button into:', container);

        const btn = document.createElement('div');
        btn.className = 'tubiq-download-overlay';
        btn.title = 'TubiQ로 다운로드';
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
        `;

        // Style overrides for Shorts or specific containers if needed
        if (container.tagName.toLowerCase().includes('reel')) {
            btn.style.top = '60px'; // Move down for Shorts UI
            btn.style.right = '10px';
        }

        btn.onclick = (e) => {
            e.stopPropagation();

            // Get current video info
            let videoId = new URLSearchParams(window.location.search).get('v');

            // Handle Shorts URL (/shorts/ID)
            if (!videoId && window.location.pathname.includes('/shorts/')) {
                const parts = window.location.pathname.split('/shorts/');
                if (parts.length > 1) {
                    videoId = parts[1].split(/[/?#]/)[0];
                }
            }

            const title = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent ||
                document.querySelector('yt-formatted-string.ytd-video-primary-info-renderer')?.textContent ||
                document.querySelector('h2.title.ytd-shorts')?.textContent ||
                document.title.replace(' - YouTube', '');

            if (!videoId) {
                console.error('[TubiQ] Could not find Video ID');
                return;
            }

            console.log('[TubiQ] Download requested for:', videoId, title);

            // Visual feedback
            btn.classList.add('loading');
            setTimeout(() => btn.classList.remove('loading'), 3000);

            // Dispatch event for Electron
            const event = new CustomEvent('tubiq-download', {
                detail: { videoId, title: (title || videoId).trim() }
            });
            document.dispatchEvent(event);

            // Backup: Set attribute for polling
            document.body.setAttribute('data-download-request', JSON.stringify({
                videoId,
                title: (title || videoId).trim(),
                timestamp: Date.now()
            }));
        };

        container.appendChild(btn);
    }

    // Initial injection
    injectButton();

    // Check periodically for player changes
    setInterval(injectButton, 2000);

    // Also observe DOM changes
    const observer = new MutationObserver((mutations) => {
        injectButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
