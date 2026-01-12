// TubiQ Auth Bridge
// Extract Supabase Session and send to Extension
// Matches: http://localhost:3000/*

(function () {
    console.log('[TubiQ Auth Bridge] Loaded');

    function checkAndSendToken() {
        console.log('[TubiQ Auth Bridge] Checking storage...');

        let session = null;

        // Strategy 1: Check LocalStorage (Scanning all keys)
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                try {
                    const rawValue = localStorage.getItem(key);
                    const value = JSON.parse(rawValue);

                    // Check if it looks like a Supabase session
                    if (value && value.access_token && value.refresh_token && value.user) {
                        console.log('[TubiQ Auth Bridge] Found session in key:', key);
                        session = value;
                        break;
                    }
                } catch (e) {
                    // Not JSON, ignore
                }
            }
        } catch (e) {
            console.error('LocalStorage scan failed', e);
        }

        // Strategy 2: Check SessionStorage if not found
        if (!session) {
            try {
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    try {
                        const rawValue = sessionStorage.getItem(key);
                        const value = JSON.parse(rawValue);
                        if (value && value.access_token && value.user) {
                            console.log('[TubiQ Auth Bridge] Found session in SessionStorage key:', key);
                            session = value;
                            break;
                        }
                    } catch (e) { }
                }
            } catch (e) { }
        }

        if (session && session.access_token) {
            console.log('%c[TubiQ Auth Bridge] Sending token to extension...', 'background: #22c55e; color: white; padding: 2px 4px; border-radius: 4px;');
            chrome.runtime.sendMessage({
                action: 'UPDATE_TOKEN',
                token: session.access_token
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('%c[TubiQ Auth Bridge] Extension not listening (might be closed):', 'color: orange', chrome.runtime.lastError.message);
                } else {
                    console.log('%c[TubiQ Auth Bridge] Token sent successfully!', 'background: #22c55e; color: white; padding: 2px 4px; border-radius: 4px;');
                }
            });
        } else {
            console.log('%c[TubiQ Auth Bridge] No session found.', 'color: #ef4444');
        }
    }

    // Check immediately
    checkAndSendToken();

    // Check on storage changes (login/logout)
    window.addEventListener('storage', checkAndSendToken);

    // Check periodically for 5 seconds
    let attempts = 0;
    const interval = setInterval(() => {
        checkAndSendToken();
        attempts++;
        if (attempts > 5) clearInterval(interval);
    }, 1000);

})();
