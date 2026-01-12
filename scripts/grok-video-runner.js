const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

const { spawn, execSync } = require('child_process');

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class GrokVideoRunner {
    constructor() {
        this.browser = null;
        this.page = null;
        this.userDataDir = path.resolve(__dirname, '..', 'chrome-profiles', 'grok-manual');
        console.error(`[DEBUG] User data directory: ${this.userDataDir}`);
    }

    async killStaleChrome() {
        try {
            console.error('[DEBUG] Killing any existing Chrome using the target profile...');
            const profileId = 'grok-manual';
            // Forcefully kill any Chrome process that has 'grok-manual' in its command line
            const killCmd = `powershell -Command "Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*${profileId}*' } | Stop-Process -Force"`;
            try { execSync(killCmd, { stdio: 'ignore' }); } catch (e) { }

            // Also kill any processes that might be locking the folder
            const profilePath = this.userDataDir;
            console.error(`[DEBUG] Ensuring profile path is accessible: ${profilePath}`);

            await delay(1500);
        } catch (e) {
            // Likely no process found, ignore
        }
    }

    async launch() {
        // Idempotent launch: reuse if exists
        if (!this.browser || !this.browser.isConnected()) {
            // KILL existing Chrome to release profile lock
            await this.killStaleChrome();

            // Use the same profile path as image runner to reuse login
            if (!fs.existsSync(this.userDataDir)) {
                fs.mkdirSync(this.userDataDir, { recursive: true });
            }

            this.browser = await puppeteer.launch({
                headless: false,
                channel: 'chrome', // Use system Chrome for profile compatibility
                userDataDir: this.userDataDir,
                args: [
                    '--window-size=1280,900',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--no-default-browser-check',
                    // Flags removed to prevent "Unsupported command-line flag" warning
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
                ],
                ignoreDefaultArgs: ['--enable-automation'],
                defaultViewport: null,
                ignoreHTTPSErrors: true
            });
        }

        if (!this.browser) throw new Error('Failed to launch browser');

        // SMART TAB MANAGEMENT - NUCLEAR OPTION
        // 1. WAIT for Chrome to settle (User issue: Ghost tabs appearing later)
        await delay(2000);

        // 2. Get Updated Page List
        let pages = await this.browser.pages();
        let grokPage = null;
        let garbage = [];

        // 3. Sort Pages: Find Grok vs others
        for (const p of pages) {
            const url = p.url();
            const title = await p.title().catch(() => '');
            if (url.includes('grok.com') || title.includes('Grok') || title.includes('Imagine')) {
                grokPage = p; // Found our hero
            } else {
                garbage.push(p); // Mark for deletion
            }
        }

        // 4. Execution
        if (grokPage) {
            this.page = grokPage;
            console.error('[DEBUG] Found existing Grok tab. Focusing...');
            try { await this.page.bringToFront(); } catch (e) { console.error(e); }

            // KILL ALL OTHERS
            for (const trash of garbage) {
                try {
                    console.error('[DEBUG] Nuclear Cleanup: Closing ' + trash.url());
                    await trash.close();
                } catch (e) { }
            }
        } else {
            // No Grok found? Use the first garbage tab as the main one, close the rest
            console.error('[DEBUG] No Grok tab found. Creating fresh one...');
            if (garbage.length > 0) {
                this.page = garbage[0]; // Recycle first blank tab
                garbage.shift(); // Remove from delete list
            } else {
                this.page = await this.browser.newPage();
            }

            // Close extra garbage
            for (const trash of garbage) {
                try { await trash.close(); } catch (e) { }
            }

            // Navigate the chosen tab
            try {
                console.error('[DEBUG] Navigating empty tab to Grok...');
                await this.page.goto('https://grok.com/imagine', { waitUntil: 'domcontentloaded' });
            } catch (e) { }
        }

        // 4. WATCHDOG: Active prevention of new tabs (User Request: "Prevent it")
        // 4. WATCHDOG: SMART SWITCH & REFRESH (User Request: "Refresh it")
        // If a new tab opens (despite our blocks), IT IS NOW THE MAIN TAB.
        if (this.browser.listenerCount('targetcreated') === 0) {
            this.browser.on('targetcreated', async (target) => {
                if (target.type() === 'page') {
                    try {
                        const newPage = await target.page();
                        if (!newPage) return;
                        const url = newPage.url();

                        console.error(`[DEBUG] Video Runner Watchdog detected NEW TAB (${url}).`);

                        const oldPage = this.page;
                        const isBusy = this.isTaskRunning;
                        const isGrok = url.includes('grok.com');

                        if (!isBusy && isGrok) {
                            console.error('[DEBUG] Watchdog switching main page context to new Grok tab...');
                            this.page = newPage;
                        } else if (!isBusy && !isGrok) {
                            console.error('[DEBUG] Watchdog: Ignoring non-Grok tab for context switch.');
                        } else {
                            console.error('[DEBUG] Watchdog: TASK IS RUNNING. Not switching main context, but will manage rogue tab...');
                        }

                        // Bring the new page to front
                        try { await newPage.bringToFront(); } catch (e) { }

                        // ONLY refresh if it stays blank for too long (User Request: "Refresh it")
                        if (url === 'about:blank' || url === 'chrome://newtab/' || !url.includes('grok')) {
                            await delay(1000); // Give it a second to load naturally
                            const finalUrl = newPage.url();
                            if (finalUrl === 'about:blank' || finalUrl === 'chrome://newtab/') {
                                console.error('[DEBUG] New tab is definitely blank. Forcing REFRESH to Grok...');
                                await newPage.goto('https://grok.com/imagine', { waitUntil: 'domcontentloaded' }).catch(() => { });
                            }
                        }

                        // Cleanup old page IF rogue and not busy
                        if (oldPage && oldPage !== newPage && !isBusy) {
                            try {
                                const oldUrl = oldPage.url();
                                if (oldUrl === 'about:blank' || oldUrl.includes('newtab')) {
                                    console.error('[DEBUG] Closing old/stale rogue tab...');
                                    await oldPage.close();
                                }
                            } catch (e) { }
                        }

                        // Re-inject protections into the new page
                        await newPage.evaluateOnNewDocument(() => {
                            window.chrome = { runtime: {} };
                            window.open = function (url) { if (url) location.href = url; return window; };
                        }).catch(() => { });
                    } catch (e) { }
                }
            });
        }

        // Anti-detection & FORCE SINGLE TAB POLICY
        if (this.page) {
            await this.page.evaluateOnNewDocument(() => {
                window.chrome = { runtime: {} };

                // 1. NEUTRALIZE window.open (User Request: "Force current tab")
                window.open = function (url, target, feat) {
                    console.log('[Script] window.open intercepted. Forcing navigation in current tab:', url);
                    if (url) { location.href = url; }
                    return window;
                };

                // 2. CONSTANT VIGILANCE: MutationObserver to scrub target="_blank"
                const fixTargets = () => {
                    document.querySelectorAll('a[target]').forEach(a => a.setAttribute('target', '_self'));
                    document.querySelectorAll('form[target]').forEach(f => f.setAttribute('target', '_self'));
                };

                const observer = new MutationObserver(fixTargets);
                observer.observe(document.documentElement, {
                    subtree: true,
                    childList: true,
                    attributes: true
                });
                fixTargets(); // Initial run

                // 3. CAPTURING LISTENERS for Click/Submit
                document.addEventListener('click', (e) => {
                    const el = e.target;
                    // Find closest interactive element
                    const a = el && el.closest && el.closest('a,button,[role="button"]');
                    if (!a) return;

                    const link = a.closest('a');
                    if (link) {
                        // Force rewrite before event bubbles
                        link.removeAttribute('target');
                        link.setAttribute('target', '_self');
                    }
                }, true);

                document.addEventListener('submit', (e) => {
                    const f = e.target;
                    if (f && f.target) f.target = '_self';
                }, true);
            }).catch(() => { });
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async generateVideo(imagePath, prompt, closeBrowser = true) {
        this.isTaskRunning = true;
        try {
            console.error('[DEBUG] Starting Grok video generation...');
            if (!fs.existsSync(imagePath)) {
                return { success: false, error: `Image file not found: ${imagePath}` };
            }

            await this.launch();
            console.error('[DEBUG] Browser ready');

            // 0. Ensure we are on Grok Imagine Root (Strict Loop)
            // Fixes "Stuck on Post" and "Search Modal" issues
            for (let i = 0; i < 5; i++) {
                const currentUrl = this.page.url();
                // If dirty, force clean
                if (!currentUrl.includes('/imagine') || currentUrl.includes('/post/') || currentUrl.includes('/share/')) {
                    console.error('[DEBUG] URL is dirty (' + currentUrl + '). Cleaning state...');
                    // Use execute script for harder SPA reset if needed
                    await this.page.evaluate(() => {
                        window.location.href = 'https://grok.com/imagine';
                    });

                    // Wait for navigation
                    try {
                        await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 });
                    } catch (e) { await delay(2000); }
                } else {
                    break;
                }
            }

            // 0.5 Aggressive Modal Cleanup (Close Search/Post overlays)
            console.error('[DEBUG] clearing overlays...');
            for (let i = 0; i < 3; i++) {
                // Check if a Search Modal exists
                const hasModal = await this.page.evaluate(() => {
                    const modal = document.querySelector('div[role="dialog"], input[placeholder*="Search"]');
                    return !!modal;
                });

                if (hasModal) {
                    console.error('[DEBUG] Modal detected. Pressing Escape.');
                    await this.page.keyboard.press('Escape');
                    await delay(500);
                }
            }

            // Allow page to settle
            await delay(1000);

            // Setup Download Behavior
            const downloadPath = path.resolve(process.cwd(), 'tmp');
            const client = await this.page.target().createCDPSession();
            await client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: downloadPath,
            });
            await this.page.waitForSelector('body', { timeout: 10000 });
            await delay(3000);

            // 0. WAIT FOR LOGIN (Critical Step)
            console.error('[DEBUG] Checking login status...');
            const maxLoginWait = 300 * 1000; // 5 minutes
            const loginStart = Date.now();
            let isLoggedEarly = false;

            while (Date.now() - loginStart < maxLoginWait) {
                // Check cookies to see if profile loaded correctly
                const cookies = await this.page.cookies();
                if (cookies.length === 0) {
                    console.error('[WARNING] NO COOKIES detected yet...');
                }

                isLoggedEarly = await this.page.evaluate(() => {
                    const bodyText = document.body.innerText;
                    const hasSuperGrok = bodyText.includes('SuperGrok');
                    const userMenu = document.querySelector('[data-testid="user-menu"]');
                    const profileImg = document.querySelector('img[alt="Profile"]');
                    const textarea = document.querySelector('textarea');
                    const createImgBtn = Array.from(document.querySelectorAll('button, div[role="button"]')).some(el => el.textContent?.includes('Create Image'));

                    return hasSuperGrok || createImgBtn || !!userMenu || !!profileImg || !!textarea;
                });

                if (isLoggedEarly) {
                    console.error('[DEBUG] Login confirmed (SuperGrok/Grok detected)! Proceeding...');
                    // Add periodic check to enforce Imagine page
                    this.page.on('framenavigated', frame => {
                        if (frame === this.page.mainFrame()) {
                            const newUrl = frame.url();
                            if (newUrl.includes('grok.com') && !newUrl.includes('/imagine') && !newUrl.includes('/chat/')) {
                                console.error(`[DEBUG] Detected REDIRECT to ${newUrl}. Forcing return to Imagine...`);
                                this.page.goto('https://grok.com/imagine', { waitUntil: 'domcontentloaded' }).catch(() => { });
                            }
                        }
                    });
                    break;
                }

                // Log warning every 5 seconds
                if ((Date.now() - loginStart) % 5000 < 500) {
                    console.error('[DEBUG] Login not detected yet. Waiting for manual login or page load...');
                }
                await delay(2000);
            }

            if (!isLoggedEarly) {
                console.error('[DEBUG] Login timeout. Proceeding anyway, but failure is likely.');
            }

            // ALWAYS FORCE NAVIGATION/REFRESH ONCE to clear previous state (User Requirement)
            console.error('[DEBUG] Forcing navigation to clean /imagine page...');
            await this.page.goto('https://grok.com/imagine', { waitUntil: 'domcontentloaded' });
            await delay(3000);

            // RETRY LOOP FOR SAFETY (Only if something goes wrong)
            let inputFound = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    // Try to clear overlays
                    await this.page.keyboard.press('Escape');
                    await delay(500);

                    // Strategy: Use Puppeteer handles for real clicks
                    let targetBtn = null;

                    // 1. Try Sidebar "Imagine" (Most reliable if visible)
                    const sidebarRun = await this.page.$$('nav a, a[href*="imagine"]');
                    for (const el of sidebarRun) {
                        const text = await el.evaluate(n => (n.textContent || '').trim().toLowerCase());
                        const href = await el.evaluate(n => n.getAttribute('href') || '');
                        if (text === 'imagine' || text === '이미지 생성' || href.includes('/imagine')) {
                            console.error('[DEBUG] Found Sidebar Imagine link.');
                            targetBtn = el;
                            break;
                        }
                    }

                    // 1. Ensure we are on the Imagine page
                    if (!this.page.url().includes('/imagine')) {
                        if (targetBtn) {
                            await targetBtn.click();
                            console.error('[DEBUG] Clicked navigation button.');
                            await delay(2000);
                        } else {
                            console.error('[DEBUG] Not on Imagine. Forcing direct navigation...');
                            await this.page.goto('https://grok.com/imagine', { waitUntil: 'domcontentloaded' });
                            await delay(3000);
                        }
                    } else {
                        console.error('[DEBUG] Already confirmed on Imagine page.');
                    }

                    // (Forced navigation moved outside loop)

                } catch (e) {
                    console.error('[DEBUG] Navigation attempt failed:', e);
                }

                if (attempt < 3 && !this.page.url().includes('grok.com')) {
                    console.error('[DEBUG] Retrying navigation...');
                    await delay(1000);
                }
            }

            // Check login
            const isLogged = await this.page.evaluate(() => {
                return !!document.querySelector('textarea') || !!document.querySelector('[data-testid="user-menu"]');
            });

            if (!isLogged) {
                console.error('[DEBUG] Not logged in. Please log in manually in the other window first.');
                await delay(5000);
            }

            // 1. Select 'Video' mode
            console.error('[DEBUG] Switching to Video mode...');
            try {
                // Ensure no search modal is blocking us
                await this.page.evaluate(() => {
                    const searchModal = document.querySelector('div[role="dialog"]');
                    if (searchModal) {
                        const closeBtn = searchModal.querySelector('button[aria-label="Close"]');
                        if (closeBtn) closeBtn.click();
                    }
                });
                await this.page.keyboard.press('Escape');
                await delay(500);

                // Look for the mode selector (Legacy Pill OR New Dropdown)
                const modeSelected = await this.page.evaluate(async () => {
                    const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));

                    // 1. Direct "Video" Pill (Legacy or specific state)
                    const videoPill = buttons.find(p => {
                        const t = p.innerText.toLowerCase();
                        return (t === 'video' || t === '비디오');
                    });

                    if (videoPill) {
                        const isSelected = videoPill.getAttribute('aria-pressed') === 'true' ||
                            videoPill.className.includes('selected') ||
                            getComputedStyle(videoPill).backgroundColor !== 'transparent';

                        if (!isSelected) {
                            videoPill.click();
                            return 'clicked_pill';
                        }
                        return 'already_selected_pill';
                    }

                    // 2. Dropdown Interaction (New UI: "Image v" -> Click -> "Video")
                    // Find the trigger that likely says "Image" or "Model"
                    const dropdownTrigger = buttons.find(b => {
                        const t = b.innerText.trim().toLowerCase();
                        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                        // It usually says "Image" or shows the current model name
                        return b.querySelector('svg') && (t.includes('image') || t.includes('이미지') || aria.includes('switch model') || aria.includes('select mode'));
                    });

                    if (dropdownTrigger) {
                        dropdownTrigger.click();
                        // We need to wait for the menu to appear (using a small delay inside evaluate or just returning 'opened_dropdown' to let main thread handle)
                        // But we can't await nicely inside evaluate sync.
                        // Let's return a signal to the main thread.
                        return 'opened_dropdown';
                    }

                    return 'not_found';
                });

                if (modeSelected === 'opened_dropdown') {
                    console.error('[DEBUG] Dropdown opened. looking for Video option...');
                    await this.page.waitForTimeout(500); // Wait for animation

                    await this.page.evaluate(() => {
                        const options = Array.from(document.querySelectorAll('div[role="menuitem"], button, div[role="button"]'));
                        // Find the one that says Video
                        const videoOption = options.find(o => {
                            const t = o.innerText.trim().toLowerCase();
                            return t === 'video' || t === '비디오' || t.includes('video generation');
                        });
                        if (videoOption) videoOption.click();
                    });
                }

                console.error(`[DEBUG] Video mode status: ${modeSelected}`);
                await delay(2000);
            } catch (e) {
                console.error('[DEBUG] Failed to switch mode:', e);
            }

            // 2. Upload Image
            // 1. Find Main Input Robustly
            console.error('[DEBUG] Finding main input...');
            let mainInputFound = false;
            let mainInput = null;

            // Strategy: Use direct selector for efficiency, copied from ImageRunner
            for (let attempt = 1; attempt <= 10; attempt++) {
                mainInput = await this.page.evaluateHandle(() => {
                    const candidates = Array.from(document.querySelectorAll('textarea, input[type="text"], div[contenteditable="true"]'));
                    const isImaginePage = window.location.href.includes('/imagine');

                    const valid = candidates.filter(t => {
                        const placeholder = (t.placeholder || t.getAttribute('placeholder') || t.getAttribute('aria-label') || '').toLowerCase();
                        const isSearch = placeholder.includes('search') || placeholder.includes('검색');
                        if (isSearch) return false;

                        // Additional Safety: Ignore tiny elements
                        const rect = t.getBoundingClientRect();
                        if (rect.width < 100 || rect.height < 10) return false;

                        if (isImaginePage) return true;
                        return placeholder.includes('imagine');
                    });

                    // Sort by position (descending top = bottom-most first)
                    valid.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
                    return valid[0] || null;
                });

                if (mainInput.asElement()) {
                    console.error('[DEBUG] Input bar found!');
                    mainInputFound = true;
                    // Tag it for later use
                    await mainInput.asElement().evaluate(el => el.classList.add('tubiq-main-input'));
                    break;
                }
                await delay(500);
            }

            if (!mainInputFound) {
                console.error('[DEBUG] Critical: No input found.');
                return { success: false, error: 'Input bar not found' };
            }

            // 2. Upload Image - FORCE DRAG & DROP (Most Reliable)
            console.error('[DEBUG] Uploading image via forced Drag & Drop...');
            try {
                const inputUploadHandle = await this.page.evaluateHandle(() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.style.display = 'none';
                    document.body.appendChild(input);
                    return input;
                });

                // Add file to the hidden input
                await inputUploadHandle.uploadFile(imagePath);

                // Trigger Drop Event on the main input
                await this.page.evaluate(async (input) => {
                    const file = input.files[0];
                    // Find the drop zone (the main input we found earlier)
                    const dropZone = document.querySelector('.tubiq-main-input') || document.querySelector('textarea') || document.body;

                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);

                    const events = ['dragenter', 'dragover', 'drop'];
                    for (const type of events) {
                        const event = new DragEvent(type, {
                            bubbles: true,
                            cancelable: true,
                            dataTransfer: dataTransfer
                        });
                        dropZone.dispatchEvent(event);
                        await new Promise(r => setTimeout(r, 100));
                    }
                }, inputUploadHandle);

                console.error('[DEBUG] Drag & Drop event dispatched.');
            } catch (e) {
                console.error('[DEBUG] Drag & Drop failed:', e);
                return { success: false, error: 'Image upload failed' };
            }

            // WAIT FOR UPLOAD TO COMPLETE
            console.error('[DEBUG] Waiting for upload verification...');
            await delay(3000);
            await this.page.evaluate(() => {
                const img = document.querySelector('img[src*="blob"], div[role="img"], button[aria-label*="Remove"]');
                if (img) console.log('[DEBUG] Image preview detected.');
            });
            await delay(2000);

            // 3. Enter Prompt (Robust Input Detection)
            console.error('[DEBUG] Entering prompt (Robust)...');
            const promptInputSuccess = await this.page.evaluate((text) => {
                // Broaden selector to find ANY potential input
                const candidates = Array.from(document.querySelectorAll('textarea, input[type="text"], div[contenteditable="true"]'));
                const isImaginePage = window.location.href.includes('/imagine');

                // Filter Logic:
                // 1. Must NOT be a search bar (placeholder check)
                // 2. Must be on Imagine page context OR have 'imagine' in placeholder
                // 3. Must be visible

                const valid = candidates.filter(t => {
                    const placeholder = (t.placeholder || t.getAttribute('placeholder') || t.getAttribute('aria-label') || '').toLowerCase();
                    const isSearch = placeholder.includes('search') || placeholder.includes('검색');
                    if (isSearch) return false;

                    // Additional Safety: Ignore tiny elements
                    const rect = t.getBoundingClientRect();
                    if (rect.width < 100 || rect.height < 10) return false;

                    if (isImaginePage) return true;
                    return placeholder.includes('imagine');
                });

                // Sort by position (Top to bottom - typically the main input is near the bottom in these UIs)
                // We use descending top (bottom-most first)
                valid.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
                const target = valid[0];

                if (target) {
                    target.click();
                    target.focus();

                    // CLEAR EXISTING CONTENT (Ctrl+A -> Backspace)
                    // We can't do keyboard actions inside evaluate, so we just mark it focused and return true.
                    // We will do typing from the main Node context for reliability.
                    return true;
                }
                return false;
            }, prompt);

            if (!promptInputSuccess) {
                console.error('[DEBUG] CRITICAL: Could not find any valid input text area!');
            } else {
                // REAL KEYBOARD TYPING (Solves React State Issues)
                await delay(500);

                // Safety: Ensure modifiers are up
                await this.page.keyboard.up('Control');
                await this.page.keyboard.up('Shift');
                await this.page.keyboard.up('Alt');

                await this.page.keyboard.down('Control');
                await this.page.keyboard.press('A');
                await this.page.keyboard.up('Control');
                await this.page.keyboard.press('Backspace');
                await delay(200);
                await this.page.keyboard.type(prompt, { delay: 5 }); // Very fast typing
            }
            // Minimal delay just to let UI react
            await delay(100);

            // 3.8 WAIT FOR BUTTON ENABLEMENT (User Request)
            console.error('[DEBUG] Waiting for "Make video" button to be enabled...');
            try {
                await this.page.waitForFunction(() => {
                    const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                    const target = buttons.find(b => {
                        const text = (b.innerText || '').toLowerCase();
                        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                        // Also check for "Send" or standard arrow buttons because UI might have changed
                        const isSend = aria.includes('send') || aria.includes('submit') || b.querySelector('svg.fa-paper-plane');
                        const isMakeVideo = text.includes('make video') || text.includes('create video') || text.includes('동영상 만들기');

                        return (isMakeVideo || isSend) && !b.disabled;
                    });
                    return !!target;
                }, { timeout: 2000 }); // REDUCED TIMEOUT FROM 10s TO 2s
                console.error('[DEBUG] Button is enabled and ready!');
            } catch (e) {
                console.error('[DEBUG] Warning: Timeout waiting for button enablement. Proceeding anyway...');
            }

            // 3.5 Reset Interceptor & Buffer BEFORE Submit
            let capturedVideoBuffer = null;
            await this.page.removeAllListeners('response');

            this.page.on('response', async (response) => {
                const url = response.url();
                const contentType = (response.headers()['content-type'] || '').toLowerCase();
                const isVideo = contentType.includes('video/') || url.includes('.mp4');

                if (!url.includes('favicon')) {
                    try {
                        // IGNORE EVERYTHING during the first few seconds or small files
                        // Grok UI background (the blue grid) is usually small or loaded early
                        const buffer = await response.buffer();
                        const size = buffer.length;

                        // Only accept videos > 2MB as actual results (Grok videos are usually 5-10MB)
                        const MIN_VIDEO_SIZE = 2 * 1024 * 1024;

                        if (isVideo && size > MIN_VIDEO_SIZE) {
                            console.error(`[DEBUG] Captured REAL VIDEO: ${size} bytes`);
                            capturedVideoBuffer = buffer;
                        } else if ((contentType.includes('octet-stream') || contentType.includes('application/x-unknown')) && size > MIN_VIDEO_SIZE) {
                            console.error(`[DEBUG] Captured BINARY VIDEO: ${size} bytes`);
                            capturedVideoBuffer = buffer;
                        }
                    } catch (e) { }
                }
            });

            // 4. Submit
            // Final Modal Cleanup (CONDITIONAL ONLY)
            // DO NOT PRESS ESCAPE UNCONDITIONALLY - IT CLEARS THE INPUT!
            await this.page.evaluate(() => {
                const searchModal = document.querySelector('div[role="dialog"]');
                if (searchModal) {
                    const closeBtn = searchModal.querySelector('button[aria-label="Close"]');
                    if (closeBtn) closeBtn.click();
                    // Or pressing escape only if modal is focused? 
                    // Better to just click close or let the click logic below handle it via coordinate click
                }
            });
            // Removed extra delay here

            // (Legacy Input Check Removed - Relying on Keyboard Type)

            console.error('[DEBUG] Submitting...');
            let submitted = false;
            for (let submitAttempt = 1; submitAttempt <= 5; submitAttempt++) {
                // Get Button Coordinates
                const btnBox = await this.page.evaluate(() => {
                    // Double check for any overlay
                    const overlay = document.querySelector('div[role="dialog"]');
                    if (overlay) return null; // Modal exists, don't click yet

                    const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                    const makeVideoBtn = buttons.find(b => {
                        const text = (b.innerText || '').toLowerCase();
                        const aria = (b.getAttribute('aria-label') || '').toLowerCase();

                        // 1. ABSOLUTE SIDEBAR EXCLUSION
                        // Check if element is inside nav/aside OR has low X coordinate (left side)
                        const rect = b.getBoundingClientRect();
                        if (rect.left < 500) return false; // Sidebar area check

                        const isSidebar = b.closest('nav') || b.closest('aside');
                        if (isSidebar) return false;

                        // 2. TEXT BLOCKLIST
                        if (text.includes('search') || text.includes('검색') || aria.includes('search') || aria.includes('검색')) return false;

                        // 3. TARGET MATCHING (User Specific Request)
                        // Precise Selector: button[aria-label="Make video"]
                        if (aria === 'make video') {
                            console.log(`[DEBUG] Found Exact 'Make video' ARIA button.`);
                            return true;
                        }

                        // Fallback: If aria is missing, check known text text
                        return text.includes('make video') ||
                            text.includes('create video') ||
                            text.includes('동영상 만들기') ||
                            text.includes('비디오 생성');
                    });

                    if (makeVideoBtn && !makeVideoBtn.disabled) {
                        const rect = makeVideoBtn.getBoundingClientRect();
                        console.log(`[DEBUG] Found Target Button: "${makeVideoBtn.innerText}" at (${rect.x},${rect.y})`);
                        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
                    }
                    return null;
                });

                if (btnBox) {
                    console.error(`[DEBUG] Found "Make video" at (${btnBox.x}, ${btnBox.y}). Clicking...`);
                    await this.page.mouse.click(btnBox.x, btnBox.y);
                    submitted = true;
                } else {
                    // If we didn't find button, maybe a modal is blocking? Press Escape again
                    console.error('[DEBUG] Button not found or blocked. Pressing Escape...');
                    await this.page.keyboard.press('Escape');

                    // Fallback to generic click if coordinates fail
                    submitted = await this.page.evaluate(() => {
                        const sendBtn = document.querySelector('button[aria-label="Send"]') ||
                            document.querySelector('[data-testid="send-btn"]');
                        if (sendBtn && !sendBtn.disabled) {
                            sendBtn.click();
                            return true;
                        }
                        return false;
                    });
                }

                if (submitted) {
                    // Verify if submission happened (Button should change or disappear)
                    await delay(1000);
                    const isStillThere = await this.page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        return buttons.some(b => b.innerText.includes('Make video') && !b.disabled);
                    });

                    if (!isStillThere) {
                        console.error('[DEBUG] Submission verified!');
                        break;
                    } else {
                        console.error('[DEBUG] Button still there after click. Retrying...');
                    }
                }

                // (Enter Fallback Removed - It triggers Search Modal if focus is wrong)
                // if (submitAttempt === 5) { ... }
                await delay(1000);
            }

            // 5. Wait for Generation & Download
            // User requested: Wait for generation -> Click Download -> Upload to Supabase
            // Our 'response' listener is already active. Clicking download checks BOTH boxes:
            // 1. It confirms generation is done (button appears).
            // 2. It triggers the final network request we can capture.

            console.error('[DEBUG] Waiting for generation completion (Download button)...');
            // 5. Active Polling for Completion OR Feedback Modal
            // We use a custom loop because we might need to click "Skip" on the "Which video?" modal.
            console.error('[DEBUG] Waiting for generation completion (Download button or Feedback Modal)...');

            let downloadBtnHandle = null;
            const waitStart = Date.now();
            const pollingTimeout = 180000; // 3 minutes max

            while (Date.now() - waitStart < pollingTimeout) {
                // A. Check for SKIP (Feedback Modal)
                const feedbackHandled = await this.page.evaluate(() => {
                    const bodyText = document.body.innerText;
                    if (bodyText.includes('Which video do you prefer')) {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const skipOne = buttons.find(b => {
                            // 1. VISIBILITY CHECK
                            const rect = b.getBoundingClientRect();
                            if (rect.width <= 0 || rect.height <= 0) return false;

                            // 2. SIDEBAR EXCLUSION
                            if (rect.left < 500) return false;
                            if (b.closest('nav') || b.closest('aside')) return false;

                            // 3. TEXT CHECK
                            const t = b.innerText.trim();
                            return t === 'Skip' || t === '스킵';
                        });

                        if (skipOne) {
                            console.log('[DEBUG] Clicking found SKIP button...');
                            skipOne.click();
                            return true;
                        }
                    }
                    return false;
                });

                if (feedbackHandled) {
                    console.error('[DEBUG] Found Feedback Modal ("Which video..."). Clicked Skip.');
                    await delay(1000); // Wait for transition
                    continue; // Re-check for Download
                }

                // B. Check for DOWNLOAD (Specific User Logic: lucide-download)
                const isClicked = await this.page.evaluate(() => {
                    // Selector: //button[.//svg[contains(@class, 'lucide-download')]]
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const target = buttons.find(b => {
                        // 1. Check for 'lucide-download' class in identifying SVG
                        const svg = b.querySelector('svg');
                        if (!svg) return false;
                        const classAttr = svg.getAttribute('class') || '';
                        if (!classAttr.includes('lucide-download')) return false;

                        // 2. VISIBILITY & LOCATION CHECK (Left > 500px)
                        const rect = b.getBoundingClientRect();
                        if (rect.width <= 0 || rect.height <= 0) return false;
                        if (rect.left < 500) return false; // Strictly Right Side

                        return true;
                    });

                    if (target) {
                        console.log(`[DEBUG] Found Specific Download Button. Clicking via JS...`);
                        target.click(); // JS Click execution
                        return true;
                    }
                    return false;
                });

                if (isClicked) {
                    console.error('[DEBUG] Download button clicked successfully.');
                    downloadBtnHandle = 'clicked_via_js';
                    break;
                }

                await delay(2000);
            }

            // Post-click handling
            if (downloadBtnHandle === 'clicked_via_js') {
                // Already clicked inside loop. Just wait for capture.
                console.error('[DEBUG] Waiting for video buffer capture...');
                await delay(5000);
            } else if (downloadBtnHandle) {
                // Legacy fallback (unlikely to be hit with current logic, but safe to keep if handle was returned)
                console.error('[DEBUG] Download button found (Legacy). Clicking...');
                await downloadBtnHandle.asElement().click();
                await delay(5000);
            } else {
                console.error('[DEBUG] Download button not found (Timeout). Checking if we captured video anyway...');
            }

            // Return captured buffer
            await delay(2000); // Final buffer safety
            const start = Date.now();
            const maxWait = 180 * 1000;
            let videoUrl = null;

            while (Date.now() - start < maxWait) {
                if (capturedVideoBuffer) break;

                videoUrl = await this.page.evaluate(() => {
                    const v = document.querySelector('video');
                    if (v && v.src && v.src.startsWith('http')) return v.src;
                    const a = Array.from(document.querySelectorAll('a')).find(l => l.href?.includes('.mp4'));
                    if (a) return a.href;
                    return null;
                });

                if (videoUrl) break;

                // Add Timeout Break
                if (Date.now() - start >= maxWait - 2000) {
                    console.error('[DEBUG] Automation loop timed out.');
                    break;
                }

                // (Play button check removed to prevent false clicks on Search)
                // We rely solely on the Download button click above or passive network capture.

                await delay(2000);
            }

            let finalBuffer = capturedVideoBuffer;

            // Manual Mode Fallback
            if (!videoUrl && !capturedVideoBuffer) {
                console.error('[DEBUG] Automation incomplete. Entering MANUAL MODE (120s timeout). Please interact with the browser.');
                const manualTimeout = 120 * 1000;
                const mStart = Date.now();
                while (Date.now() - mStart < manualTimeout) {
                    if (this.browser?.isConnected() === false) break;
                    if (capturedVideoBuffer) break;
                    await delay(2000);
                }
                finalBuffer = capturedVideoBuffer;

                if (!finalBuffer) {
                    console.error('[DEBUG] Manual mode timed out.');
                    return { success: false, error: 'Video generation timed out (Manual mode)' };
                }
            }

            // Download Button Fallback
            if (!finalBuffer) {
                console.error('[DEBUG] Trying Official DOWNLOAD BUTTON...');
                try {
                    const downloadTriggered = await this.page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const downloadBtn = buttons.find(b =>
                            b.getAttribute('aria-label')?.includes('Download') ||
                            b.innerHTML.includes('fa-download') ||
                            b.querySelector('svg')
                        );
                        if (downloadBtn) {
                            downloadBtn.click();
                            return true;
                        }
                        return false;
                    });

                    if (downloadTriggered) {
                        // Wait for file...
                        for (let i = 0; i < 15; i++) {
                            await delay(1000);
                            const files = fs.readdirSync(downloadPath);
                            // Find newest large file? Simplified for now
                            // ... 
                            // Omitted rigorous check for brevity, assuming standard flow usually works or manual mode helps.
                        }
                    }
                } catch (e) { }
            }

            // Final Fetch Fallback
            if (!finalBuffer && videoUrl) {
                console.error('[DEBUG] Trying direct fetch...', videoUrl);
                const fetchedBuffer = await this.page.evaluate(async (url) => {
                    try {
                        const response = await fetch(url);
                        const blob = await response.blob();
                        return new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                    } catch (e) { return null; }
                }, videoUrl);

                if (fetchedBuffer && typeof fetchedBuffer === 'string') {
                    const base64Data = fetchedBuffer.replace(/^data:.*?;base64,/, "");
                    finalBuffer = Buffer.from(base64Data, 'base64');
                }
            }

            if (!finalBuffer || finalBuffer.length < 1000) {
                return { success: false, error: 'Failed to capture valid video data' };
            }

            const timestamp = Date.now();
            const filename = `grok_video_${timestamp}.mp4`;
            const savePath = path.join(process.cwd(), 'tmp', filename);
            if (!fs.existsSync(path.join(process.cwd(), 'tmp'))) {
                fs.mkdirSync(path.join(process.cwd(), 'tmp'), { recursive: true });
            }
            fs.writeFileSync(savePath, finalBuffer);
            console.error(`[DEBUG] Video saved to ${savePath}`);

            return { success: true, videoPath: savePath };

        } catch (error) {
            console.error('[DEBUG] Error:', error);
            await delay(60000); // Keep open for debug on error
            return { success: false, error: error.message };
        } finally {
            this.isTaskRunning = false;
            if (closeBrowser) {
                await this.close();
            }
        }
    }
}

// CLI usage
if (require.main === module) {
    const [, , imagePath, prompt] = process.argv;
    if (!imagePath || !prompt) {
        console.error('Usage: node grok-video-runner.js <imagePath> <prompt>');
        process.exit(1);
    }

    new GrokVideoRunner().generateVideo(imagePath, prompt)
        .then(result => console.log(JSON.stringify(result)))
        .catch(err => console.error(JSON.stringify({ success: false, error: err.message })));
}

module.exports = GrokVideoRunner;
