// TubiQ Extension Background Script
// Handles API communication with TubiQ Web

let cachedToken = null;

// Initialize token from storage
chrome.storage.local.get(['tubiq_access_token'], (result) => {
    if (result.tubiq_access_token) {
        cachedToken = result.tubiq_access_token;
        console.log('[TubiQ BG] Token loaded from storage');
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SAVE_TO_TUBIQ') {
        saveToTubiQ(request.data)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open
    }

    if (request.action === 'SAVE_CHANNEL_TO_TUBIQ') {
        saveChannelToTubiQ(request.data)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open
    }

    if (request.action === 'UPDATE_TOKEN') {
        cachedToken = request.token;
        chrome.storage.local.set({ tubiq_access_token: request.token });
        console.log('[TubiQ BG] Token updated');
        sendResponse({ received: true });
    }
});

async function saveToTubiQ(videoData) {
    const API_URL = 'http://localhost:3000/api/videos';

    console.log('[TubiQ BG] saveToTubiQ called. Token status:', cachedToken ? 'EXISTS' : 'MISSING');

    try {
        const payload = {
            source: 'extension',
            videos: [videoData]
        };

        const headers = {
            'Content-Type': 'application/json'
        };

        if (cachedToken) {
            headers['Authorization'] = `Bearer ${cachedToken}`;
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server returned ${response.status}: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('[TubiQ BG] Save failed:', error);
        throw error;
    }
}

async function saveChannelToTubiQ(channelData) {
    const API_URL = 'http://localhost:3000/api/channel-assets';

    try {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (cachedToken) {
            headers['Authorization'] = `Bearer ${cachedToken}`;
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(channelData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server returned ${response.status}: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('[TubiQ BG] Channel save failed:', error);
        throw error;
    }
}
