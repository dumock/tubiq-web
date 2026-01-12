(function () {
    // Double safety: Do not run in iframes
    if (window !== window.top) return;

    console.log('[TubiQ Extension] On-Video Singleton v10 (Resized Q-Btn) Loaded');

    // --- 1. SINGLETON BUTTON (Absolute Positioned) ---
    const singletonBtn = document.createElement('div');
    singletonBtn.id = 'tubiq-singleton-btn';
    singletonBtn.title = 'Download with TubiQ Desktop';
    singletonBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
    `;
    document.body.appendChild(singletonBtn);

    const webSaveBtn = document.createElement('div');
    webSaveBtn.id = 'tubiq-web-save-btn';
    webSaveBtn.title = 'Save to TubiQ Web Assets';
    // Removed inline styles to let styles.css handle the glassmorphism
    webSaveBtn.innerHTML = `<img src="${chrome.runtime.getURL('images/tubiq-logo-icon.png')}">`;
    document.body.appendChild(webSaveBtn);

    // --- STATE ---
    let currentTarget = null;
    let hideTimer = null;
    let processing = false;

    // --- ACTION: Trigger Download ---
    function triggerDownload(videoId, title) {
        if (!videoId || processing) return;
        processing = true;

        const protocolUrl = `tubiq://download?videoId=${videoId}&title=${encodeURIComponent((title || videoId).trim())}`;
        console.log('[TubiQ] Triggering:', protocolUrl);

        singletonBtn.style.background = '#10b981'; // Green feedback

        setTimeout(() => {
            processing = false;
            singletonBtn.style.background = '';
        }, 2000);

        window.location.href = protocolUrl;
    }

    // --- ACTION: Save to Web ---
    // --- ACTION: Save to Web ---
    function triggerWebSave(videoId, title, channelId, channelName, thumbnailUrl, viewCount = 0, publishedAt = null) {
        if (!videoId || processing) return;

        webSaveBtn.style.transform = 'scale(0.9)';

        chrome.runtime.sendMessage({
            action: 'SAVE_TO_TUBIQ',
            data: {
                youtube_video_id: videoId,
                title: title,
                channel_id: channelId,
                channel_name: channelName,
                thumbnail_url: thumbnailUrl,
                view_count: viewCount,
                published_at: publishedAt,
                collected_at: new Date().toISOString()
            }
        }, (response) => {
            webSaveBtn.style.transform = 'scale(1)';

            if (response && response.success) {
                // Success animation
                const originalBg = webSaveBtn.style.background;
                webSaveBtn.style.background = '#10b981'; // Green
                webSaveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

                setTimeout(() => {
                    webSaveBtn.style.background = originalBg;
                    webSaveBtn.innerHTML = `<img src="${chrome.runtime.getURL('images/tubiq-logo-icon.png')}" style="width: 20px !important; height: 20px !important; opacity: 0.8; display: block;">`;
                }, 2000);
            } else {
                // Error animation
                console.error('Save failed:', response?.error);
                webSaveBtn.style.background = '#ef4444'; // Red
                setTimeout(() => {
                    webSaveBtn.style.background = ''; // Reset to CSS default (transparent)
                }, 2000);
            }
        });
    }

    // --- POSITIONING HELPER ---
    function positionButton(rect, type) {
        let top, left;

        if (type === 'shorts-player') {
            // Align with right-side action buttons (Like, Dislike, Comment...)
            // Standard Shorts layout puts actions on the right edge
            // Position slightly below the "More actions" (3 dots) button
            top = rect.top + window.scrollY + 80; // Increased spacing (was 60)
            left = rect.right + window.scrollX - 52; // Aligned with the column center
        } else if (type === 'watch-player') {
            top = rect.top + window.scrollY + 20;
            left = rect.right + window.scrollX - 60;
        } else {
            // Thumbnails (Home, Search, etc.)
            const isShortsThumbnail = rect.height > rect.width; // Use aspect ratio to detect vertical Shorts

            if (isShortsThumbnail) {
                // Return Shorts thumbnails to higher position (they don't have the heavy top-right overlay)
                top = rect.top + window.scrollY + 5; // Restored high position
                left = rect.right + window.scrollX - 42;
            } else {
                // Regular 16:9 Video Thumbnails
                // YouTube puts multiple buttons (Mute, Captions, Watch Later, Queue) in top-right
                // We need to move WAY down to clear them all.
                // Adjusted: Left -44 (moved right 4px to align center), Top +94
                top = rect.top + window.scrollY + 94;
                left = rect.right + window.scrollX - 44;
            }

            if (rect.width > 300 && !isShortsThumbnail) {
                // Larger standard thumbnails
                top = rect.top + window.scrollY + 99; // Consistent relative pos
                left = rect.right + window.scrollX - 44;
            }
        }

        // 1. Download Button
        singletonBtn.style.top = `${top}px`;
        singletonBtn.style.left = `${left}px`;
        singletonBtn.classList.add('visible');

        // 2. Web Save Button (Below download button)
        webSaveBtn.style.top = `${top + 36}px`; // Reduced gap (40 -> 36) to prevent overlap with time
        webSaveBtn.style.left = `${left}px`;
        webSaveBtn.style.opacity = '1';
        webSaveBtn.style.pointerEvents = 'auto';
        // Force dimensions again just in case
        webSaveBtn.style.width = '32px';
        webSaveBtn.style.height = '32px';
    }

    // --- HELPER: Get Channel Info ---
    function getChannelInfo() {
        // Try to find channel ID from meta tag
        const channelIdMeta = document.querySelector('meta[itemprop="channelId"]');
        const channelId = channelIdMeta ? channelIdMeta.content : null;

        let channelName = 'Unknown';
        const channelNameEl = document.querySelector('#owner #channel-name a') ||
            document.querySelector('ytd-channel-name a') ||
            document.querySelector('.ytd-channel-name a');
        if (channelNameEl) channelName = channelNameEl.textContent.trim();

        return { channelId, channelName };
    }

    function getThumbnailUrl(videoId) {
        return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }

    // --- HOVER LOGIC ---
    document.addEventListener('mouseover', (e) => {
        const target = e.target;

        // 1. MAIN WATCH PLAYER
        const watchPlayer = target.closest('.html5-video-player');
        if (watchPlayer && window.location.pathname === '/watch') {
            const videoId = new URLSearchParams(window.location.search).get('v');
            if (videoId) {
                clearTimeout(hideTimer);
                currentTarget = watchPlayer;

                const rect = watchPlayer.getBoundingClientRect();
                positionButton(rect, 'watch-player');

                const title = document.title.replace(' - YouTube', '');

                // Click handlers
                singletonBtn.onclick = (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                    triggerDownload(videoId, title);
                };

                webSaveBtn.onclick = (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                    const { channelId, channelName } = getChannelInfo();
                    triggerWebSave(videoId, title, channelId, channelName, getThumbnailUrl(videoId));
                };
                return;
            }
        }

        // 2. SHORTS PLAYER
        const shortsActive = target.closest('ytd-reel-video-renderer[is-active]');
        if (shortsActive && window.location.pathname.includes('/shorts/')) {
            const videoId = window.location.pathname.split('/shorts/')[1]?.split(/[/?#]/)[0];
            if (videoId) {
                clearTimeout(hideTimer);
                currentTarget = shortsActive;

                const internalPlayer = shortsActive.querySelector('.html5-video-player') ||
                    shortsActive.querySelector('#player-container') ||
                    shortsActive.querySelector('video') ||
                    shortsActive;

                const rect = internalPlayer.getBoundingClientRect();
                positionButton(rect, 'shorts-player');

                const title = shortsActive.querySelector('h2.title')?.textContent || 'Shorts';

                // Try to get channel info from shorts specific elements
                let channelId = null;
                let channelName = 'Shorts Channel';
                const channelLink = shortsActive.querySelector('ytd-channel-name a');
                if (channelLink) {
                    const href = channelLink.getAttribute('href');
                    if (href && href.startsWith('/channel/')) channelId = href.split('/channel/')[1];
                    else if (href && href.startsWith('/@')) channelId = href.substring(1); // Handle - API needs ID but we might only have handle. 
                    // NOTE: API requires channel_id. If we send handle, API might fail if it expects UC ID.
                    // Ideally we find UC ID.
                    channelName = channelLink.textContent.trim();
                }

                singletonBtn.onclick = (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                    triggerDownload(videoId, title);
                };

                webSaveBtn.onclick = (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                    triggerWebSave(videoId, title, channelId, channelName, getThumbnailUrl(videoId));
                };
                return;
            }
        }

        // 3. THUMBNAILS
        const link = target.closest('a');
        if (link) {
            const href = link.getAttribute('href');
            if (href) {
                const urlObj = new URL(href, window.location.origin);
                let videoId = null;

                if (urlObj.pathname.includes('/shorts/')) {
                    videoId = urlObj.pathname.split('/shorts/')[1].split(/[/?#]/)[0];
                } else if (urlObj.pathname === '/watch') {
                    videoId = urlObj.searchParams.get('v');
                } else if (urlObj.pathname === '/watch_popup') {
                    videoId = urlObj.searchParams.get('v');
                }

                if (videoId) {
                    clearTimeout(hideTimer);
                    currentTarget = link;

                    const img = link.querySelector('img') || link.querySelector('yt-img-shadow') || link;
                    const rect = img.getBoundingClientRect();

                    if (rect.width > 0 && rect.height > 0) {
                        positionButton(rect, 'thumbnail');

                        const title = link.getAttribute('title') ||
                            link.querySelector('#video-title')?.textContent ||
                            'Video';

                        // Limited info on thumbnails
                        // Metadata Extraction Logic
                        let channelId = null;
                        let channelName = 'Unknown';
                        let viewCount = 0;
                        let publishedAt = null;

                        // Traverse up to find the video card container
                        const card = link.closest('ytd-rich-item-renderer') ||
                            link.closest('ytd-grid-video-renderer') ||
                            link.closest('ytd-video-renderer') ||
                            link.closest('ytd-compact-video-renderer');

                        if (card) {
                            // 1. Channel Name
                            const channelEl = card.querySelector('.ytd-channel-name a') ||
                                card.querySelector('#channel-name a') ||
                                card.querySelector('#text-container a');
                            if (channelEl) {
                                channelName = channelEl.textContent.trim();
                                const href = channelEl.getAttribute('href');
                                if (href && href.startsWith('/channel/')) channelId = href.split('/channel/')[1];
                                else if (href && href.startsWith('/@')) channelId = href.substring(1);
                            }

                            // 2. Views and Date (#metadata-line often contains two spans: [views, date])
                            const metaLine = card.querySelectorAll('#metadata-line span');
                            if (metaLine.length >= 1) {
                                // Usually first is views, second is date. Or sometimes just views.
                                const text1 = metaLine[0].textContent.trim();
                                if (text1.includes('View') || text1.includes('회') || text1.includes('조회수')) {
                                    viewCount = text1; // Send raw string, backend will parse
                                } else {
                                    publishedAt = text1; // Might be date if views missing
                                }

                                if (metaLine.length >= 2) {
                                    publishedAt = metaLine[1].textContent.trim();
                                }
                            }
                        }

                        singletonBtn.onclick = (evt) => {
                            evt.preventDefault();
                            evt.stopPropagation();
                            triggerDownload(videoId, title);
                        };

                        webSaveBtn.onclick = (evt) => {
                            evt.preventDefault();
                            evt.stopPropagation();
                            // Pass extracted metadata
                            triggerWebSave(videoId, title, channelId, channelName, getThumbnailUrl(videoId), viewCount, publishedAt);
                        };
                    }
                    return;
                }
            }
        }
    }, { capture: true, passive: true });


    // --- MOUSE LEAVE LOGIC ---
    document.addEventListener('mouseover', (e) => {
        if (e.target === singletonBtn || singletonBtn.contains(e.target) ||
            e.target === webSaveBtn || webSaveBtn.contains(e.target)) {
            clearTimeout(hideTimer);
            return;
        }

        if (currentTarget && !currentTarget.contains(e.target)) {
            hideTimer = setTimeout(() => {
                singletonBtn.classList.remove('visible');
                webSaveBtn.style.opacity = '0';
                webSaveBtn.style.pointerEvents = 'none';
                currentTarget = null;
            }, 300);
        }
    }, { passive: true });

    // --- 5. CHANNEL PAGE: SAVE CHANNEL BUTTON ---
    const isChannelPage = () => {
        const path = window.location.pathname;
        return path.startsWith('/@') || path.startsWith('/channel/');
    };

    function getChannelPageInfo() {
        // Channel ID from meta or URL
        let channelId = null;

        // 1. Meta tag (Standard)
        const metaTag = document.querySelector('meta[itemprop="channelId"]');
        if (metaTag) {
            channelId = metaTag.getAttribute('content');
        }

        // 2. Canonical URL (often contains /channel/UC...)
        if (!channelId) {
            const canonical = document.querySelector('link[rel="canonical"]');
            if (canonical) {
                const href = canonical.getAttribute('href');
                if (href && href.includes('/channel/')) {
                    channelId = href.split('/channel/')[1]?.split(/[/?#]/)[0];
                }
            }
        }

        // 3. Subscribe Button (Very reliable if present)
        // Checks modern and legacy subscribe button structures for channel ID
        if (!channelId) {
            // Modern view models might keep ID in internal properties, hard to access from content script.
            // But sometimes it's exposed in attributes or child elements.
            // Let's try searching for ANY link with /channel/UC in the header area first
            const headerLinks = document.querySelectorAll('#channel-header a[href^="/channel/UC"], #tabs-container a[href^="/channel/UC"]');
            if (headerLinks.length > 0) {
                channelId = headerLinks[0].getAttribute('href').split('/channel/')[1]?.split(/[/?#]/)[0];
            }
        }

        // 4. Alternate URL (RSS often contains channelId)
        if (!channelId) {
            const alternate = document.querySelector('link[rel="alternate"][type="application/rss+xml"]');
            if (alternate) {
                const href = alternate.getAttribute('href');
                if (href && href.includes('channel_id=')) {
                    channelId = href.split('channel_id=')[1]?.split(/[/?#]/)[0];
                }
            }
        }

        // 5. Brute force: Find ANY link on the page that looks like a channel ID link
        // (Risk: might find related channels, so restrict to header/main container if possible)
        if (!channelId) {
            const anyChannelLink = document.querySelector('ytd-app a[href^="/channel/UC"]');
            if (anyChannelLink) {
                // Verify it's likely THIS channel (heuristic: usually the first one or in banner)
                const candidateId = anyChannelLink.getAttribute('href').split('/channel/')[1]?.split(/[/?#]/)[0];
                if (candidateId) channelId = candidateId;
            }
        }

        // 6. Fallback: extract from current URL (Only checks for /channel/)
        if (!channelId) {
            const path = window.location.pathname;
            if (path.startsWith('/channel/')) {
                channelId = path.split('/channel/')[1]?.split(/[/?#]/)[0];
            }
        }

        // Channel Title
        // Try multiple selectors. Modern YouTube uses yt-dynamic-text-view-model.
        const titleEl = document.querySelector('yt-page-header-renderer yt-dynamic-text-view-model h1') ||
            document.querySelector('#channel-name #text') ||
            document.querySelector('#channel-header-container #text') ||
            document.querySelector('yt-formatted-string.ytd-channel-name');

        let title = titleEl?.textContent?.trim();

        // Fallback to document title if DOM extraction fails
        if (!title) {
            title = document.title;
            // Remove notification count like "(1) " from the start
            title = title.replace(/^\(\d+\)\s+/, '');
            // Remove suffix
            title = title.replace(' - YouTube', '').trim();
        }
        title = title || 'Unknown Channel';

        // Thumbnail/Avatar - Try modern yt-avatar-shape first
        const avatarEl = document.querySelector('yt-avatar-shape img') ||
            document.querySelector('ytd-channel-avatar-editor img') ||
            document.querySelector('#channel-header-container yt-img-shadow img') ||
            document.querySelector('#avatar img');
        const thumbnailUrl = avatarEl?.src || '';

        // Subscribers - Try modern metadata text
        // Modern: #subscriber-count is often inside a flexible container
        let subscriberText = '';
        const subsEl = document.querySelector('#subscriber-count') ||
            document.querySelector('yt-page-header-renderer #subscriber-count');

        if (subsEl) {
            subscriberText = subsEl.textContent.trim();
        } else {
            // Fallback: look for generic metadata text containing 'subscribers' or '명'
            // This is risky but might catch cases where ID is missing
            const metaSpans = document.querySelectorAll('yt-page-header-renderer span.yt-core-attributed-string');
            for (const span of metaSpans) {
                const text = span.textContent;
                if (text.includes('subscribers') || text.includes('구독자') || text.includes('만명') || text.includes('천명') || text.includes('명')) {
                    subscriberText = text;
                    break;
                }
            }
        }

        // Joined Date (Creation Date) Extraction
        let joinedDate = '';
        try {
            // Strategy 1: Check ytInitialData (Global Variable) - Most reliable if available
            // Note: Accessing window.ytInitialData from content script requires some hacks or looking at script tags.
            // Direct window access is blocked. So checking script tags deeply is hard.

            // Strategy 2: DOM Scan - "About" info is often lazy loaded, so might not be there.
            // But sometimes it's in the initial metadata row if the user is on the About tab (unlikely).
            // However, modern YouTube puts "Joined ..." in the description modal metadata.

            // Strategy 3: Heuristic scan of all metadata text
            const metadataSpans = document.querySelectorAll('span.yt-core-attributed-string, yt-formatted-string.ytd-channel-about-metadata-renderer');
            for (const span of metadataSpans) {
                const text = span.textContent.trim();
                // Check for "Joined [Date]" or "가입일: [Date]" pattern
                if (text.match(/Joined|가입일|Se unió|Beitritt|Rejoit/i)) {
                    // Extract date part? It's usually the whole string "Joined Jan 1, 2020"
                    joinedDate = text;
                    break;
                }
            }

            // Strategy 4: If still empty, try to fetch from About page via API (Too complex for simple fix)
            // Strategy 5: Look for Microdata/LD-JSON again
            if (!joinedDate) {
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                for (const script of scripts) {
                    try {
                        const json = JSON.parse(script.textContent);
                        if (json['@type'] === 'Organization' || json['@type'] === 'Person') {
                            // Sometimes schema has publishingDate or similar, but often not for Channel itself in this tag.
                            // But usually it's just name/url.
                        }
                    } catch (e) { }
                }
            }
        } catch (e) {
            console.error('[TubiQ] Date extraction error:', e);
        }

        console.log('[TubiQ] Extracted Info:', { channelId, title, thumbnailUrl, subscriberText, joinedDate });

        return { channelId, title, thumbnailUrl, subscriberText, joinedDate };
    }


    let channelBtnRetries = 0;

    function injectChannelSaveButton() {
        if (!isChannelPage()) {
            // Remove button if navigated away from channel page
            const existingBtn = document.getElementById('tubiq-channel-save-btn');
            if (existingBtn) existingBtn.remove();
            channelBtnRetries = 0;
            return;
        }

        // Check if button already exists
        if (document.getElementById('tubiq-channel-save-btn')) {
            return;
        }

        console.log('[TubiQ] Looking for insertion point... (attempt', channelBtnRetries + 1, ')');

        // Strategy 1: Find channel name and wrap it
        const channelNameEl = document.querySelector('yt-page-header-renderer yt-dynamic-text-view-model');

        // Strategy 2: Find subscribe button
        const subscribeBtn = document.querySelector('yt-page-header-renderer #subscribe-button, #page-header #subscribe-button');

        let insertTarget = null;
        let insertMethod = 'after'; // 'after' or 'wrap'

        if (channelNameEl) {
            insertTarget = channelNameEl;
            insertMethod = 'wrap';
            console.log('[TubiQ] Found channel name element');
        } else if (subscribeBtn) {
            insertTarget = subscribeBtn;
            insertMethod = 'after';
            console.log('[TubiQ] Found subscribe button');
        }

        if (!insertTarget) {
            channelBtnRetries++;
            if (channelBtnRetries < 10) {
                setTimeout(injectChannelSaveButton, 1000);
                return;
            }
            console.log('[TubiQ] Max retries reached');
            return;
        }

        channelBtnRetries = 0;

        // Create button
        const btn = document.createElement('button');
        btn.id = 'tubiq-channel-save-btn';
        btn.title = 'Save Channel to TubiQ';
        btn.innerHTML = `<img src="${chrome.runtime.getURL('images/tubiq-logo-icon.png')}" style="width: 20px; height: 20px; border-radius: 4px;">`;
        btn.style.cssText = `
            display: inline-flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            align-items: center !important;
            justify-content: center !important;
            margin-left: 8px !important;
            padding: 0 !important;
            width: 32px !important;
            height: 32px !important;
            min-width: 32px !important;
            min-height: 32px !important;
            background: linear-gradient(135deg, #8b5cf6, #6366f1) !important;
            border: none !important;
            border-radius: 50% !important;
            cursor: pointer !important;
            box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4) !important;
            transition: transform 0.2s ease, box-shadow 0.2s ease !important;
            vertical-align: middle !important;
            flex-shrink: 0 !important;
            z-index: 999 !important;
        `;

        btn.onmouseenter = () => {
            btn.style.transform = 'scale(1.15)';
            btn.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.6)';
        };
        btn.onmouseleave = () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.4)';
        };

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveChannel(btn);
        };

        // Insert button
        try {
            if (insertMethod === 'wrap') {
                // Wrap channel name and button in horizontal flex container
                const wrapper = document.createElement('div');
                wrapper.id = 'tubiq-channel-wrapper';
                wrapper.style.cssText = `
                    display: inline-flex !important;
                    align-items: center !important;
                    flex-wrap: nowrap !important;
                `;

                const parent = insertTarget.parentElement;
                if (parent) {
                    parent.insertBefore(wrapper, insertTarget);
                    wrapper.appendChild(insertTarget);
                    wrapper.appendChild(btn);
                    console.log('[TubiQ] ✅ Button wrapped with channel name!');
                } else {
                    insertTarget.insertAdjacentElement('afterend', btn);
                    console.log('[TubiQ] ✅ Button inserted after channel name!');
                }
            } else {
                // Insert after subscribe button
                insertTarget.insertAdjacentElement('afterend', btn);
                console.log('[TubiQ] ✅ Button inserted after subscribe button!');
            }
        } catch (err) {
            console.error('[TubiQ] Insertion failed:', err);
        }
    }

    // Fallback FAB for when channel name insertion fails
    function injectChannelFAB() {
        if (!isChannelPage()) return;
        if (document.getElementById('tubiq-channel-fab')) return;

        console.log('[TubiQ] Creating fallback FAB...');

        const fab = document.createElement('button');
        fab.id = 'tubiq-channel-fab';
        fab.title = 'Save Channel to TubiQ';
        fab.innerHTML = `<img src="${chrome.runtime.getURL('images/tubiq-logo-icon.png')}" style="width: 28px; height: 28px; border-radius: 6px;">`;
        fab.style.cssText = `
            position: fixed !important;
            bottom: 24px !important;
            right: 24px !important;
            display: flex !important;
            align-items: center !important;
            justify-content !important;
            width: 56px !important;
            height: 56px !important;
            background: linear-gradient(135deg, #8b5cf6, #6366f1) !important;
            border: none !important;
            border-radius: 50% !important;
            cursor: pointer !important;
            box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4) !important;
            z-index: 99999 !important;
            transition: all 0.3s ease !important;
        `;

        fab.onmouseenter = () => {
            fab.style.transform = 'scale(1.1)';
            fab.style.boxShadow = '0 6px 24px rgba(139, 92, 246, 0.6)';
        };
        fab.onmouseleave = () => {
            fab.style.transform = 'scale(1)';
            fab.style.boxShadow = '0 4px 16px rgba(139, 92, 246, 0.4)';
        };

        fab.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveChannel(fab);
        };

        document.body.appendChild(fab);
        console.log('[TubiQ] ✅ Fallback FAB created');
    }

    // Shared function to save channel
    function saveChannel(buttonEl) {
        const info = getChannelPageInfo();
        console.log('[TubiQ] Channel info:', info);

        // Store original content to restore later
        const originalContent = buttonEl.innerHTML;

        if (!info.channelId) {
            console.error('[TubiQ] Could not extract channel ID');
            alert('TubiQ Error: Could not find Channel ID on this page. Please try refreshing or visiting a video first.');

            buttonEl.innerHTML = '❌';
            buttonEl.style.backgroundColor = '#ef4444'; // Red
            setTimeout(() => {
                buttonEl.innerHTML = originalContent;
                buttonEl.style.background = 'linear-gradient(135deg, #8b5cf6, #6366f1)';
            }, 2000);
            return;
        }

        // Show saving state (Spinner)
        buttonEl.style.pointerEvents = 'none';
        buttonEl.innerHTML = `<div style="width: 16px; height: 16px; border: 2px solid #ffffff; border-top: 2px solid transparent; border-radius: 50%; animation: tubiq-spin 1s linear infinite;"></div>`;

        // Add style for spinner if not exists
        if (!document.getElementById('tubiq-spin-style')) {
            const style = document.createElement('style');
            style.id = 'tubiq-spin-style';
            style.textContent = `@keyframes tubiq-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }

        chrome.runtime.sendMessage({
            action: 'SAVE_CHANNEL_TO_TUBIQ',
            data: {
                youtube_channel_id: info.channelId,
                title: info.title,
                thumbnail_url: info.thumbnailUrl,
                subscriber_count: info.subscriberText,
                published_at: info.joinedDate, // Send the extracted text string
                collected_at: new Date().toISOString(),
                scope: 'channels' // Explicitly set scope
            }
        }, (response) => {
            buttonEl.style.pointerEvents = 'auto';
            if (response && response.success) {
                // Success State (Checkmark)
                buttonEl.innerHTML = '✓';
                buttonEl.style.background = '#10b981'; // Green
                buttonEl.style.color = 'white';
                buttonEl.style.fontSize = '18px';
                buttonEl.style.fontWeight = 'bold';

                setTimeout(() => {
                    buttonEl.innerHTML = originalContent;
                    buttonEl.style.background = 'linear-gradient(135deg, #8b5cf6, #6366f1)';
                    buttonEl.style.fontSize = '';
                    buttonEl.style.fontWeight = '';
                }, 2500);
                console.log('[TubiQ] Channel saved successfully!');
            } else {
                // Error State
                console.error('[TubiQ] Channel save failed:', response?.error);
                const errorMsg = response?.error || 'Unknown error';
                alert(`TubiQ Save Failed:\n${errorMsg}`);

                buttonEl.innerHTML = '❌';
                buttonEl.style.background = '#ef4444'; // Red

                setTimeout(() => {
                    buttonEl.innerHTML = originalContent;
                    buttonEl.style.background = 'linear-gradient(135deg, #8b5cf6, #6366f1)';
                }, 2500);
            }
        });
    }

    // Try to inject on page load and on navigation
    setTimeout(injectChannelSaveButton, 1000); // Initial delay for page load

    // YouTube uses SPA navigation, so listen for URL changes
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            setTimeout(injectChannelSaveButton, 500); // Wait for DOM update
        }
    }).observe(document.body, { childList: true, subtree: true });

})();
