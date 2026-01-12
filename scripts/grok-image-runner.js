/**
 * Grok Image Generation Runner
 * 
 * Separate Node.js script for Grok image generation.
 * Spawned as child process to avoid Turbopack bundling puppeteer.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const PROFILES_DIR = path.resolve(__dirname, '..', 'chrome-profiles');
console.error(`[DEBUG] Profiles directory: ${PROFILES_DIR}`);

class GrokImageRunner {
    constructor(profileId) {
        this.profileId = profileId;
        this.profilePath = path.join(PROFILES_DIR, profileId);
        this.cookiesPath = path.join(this.profilePath, 'cookies.json');
    }

    async launch() {
        // reuse if exists and connected
        if (!this.browser || !this.browser.isConnected()) {
            this.browser = await puppeteer.launch({
                headless: false, // Visible mode for debugging
                channel: 'chrome',
                userDataDir: this.profilePath,
                args: [
                    '--window-size=1280,900',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--ignore-certificate-errors',
                    '--ignore-certificate-errors-spki-list',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
                ],
                ignoreDefaultArgs: ['--enable-automation'],
                defaultViewport: null,
                ignoreHTTPSErrors: true
            });
        }

        if (!this.browser) throw new Error('Failed to launch browser');

        // SMART TAB MANAGEMENT - NUCLEAR OPTION (Same as Video Runner)
        await delay(1000); // Wait for Chrome to settle
        let pages = await this.browser.pages();
        let grokPage = null;
        let garbage = [];

        for (const p of pages) {
            const url = p.url();
            const title = await p.title().catch(() => '');
            if (url.includes('grok.com') || title.includes('Grok') || title.includes('Imagine')) {
                grokPage = p;
            } else {
                garbage.push(p);
            }
        }

        if (grokPage) {
            this.page = grokPage;
            console.error('[DEBUG] Image Runner: Found existing Grok tab. Focusing...');
            try { await this.page.bringToFront(); } catch (e) { }

            // KILL ALL OTHERS
            for (const trash of garbage) {
                try {
                    console.error('[DEBUG] Image Runner Nuclear Cleanup: Closing ' + trash.url());
                    await trash.close();
                } catch (e) { }
            }
        } else {
            console.error('[DEBUG] Image Runner: No Grok tab found. Creating fresh one...');
            if (garbage.length > 0) {
                this.page = garbage[0];
                garbage.shift();
            } else {
                this.page = await this.browser.newPage();
            }

            for (const trash of garbage) {
                try { await trash.close(); } catch (e) { }
            }

            try {
                console.error('[DEBUG] Image Runner: Navigating empty tab to Grok...');
                await this.page.goto('https://grok.com/imagine', { waitUntil: 'domcontentloaded' });
            } catch (e) { }
        }

        this.pageIdx = 0;

        await this.page.evaluateOnNewDocument(() => {
            window.chrome = { runtime: {} };
        });

        // WATCHDOG: Same as Video Runner - ONLY ADD ONCE
        if (this.browser.listenerCount('targetcreated') === 0) {
            this.browser.on('targetcreated', async (target) => {
                if (target.type() === 'page') {
                    try {
                        const newPage = await target.page();
                        if (!newPage) return;
                        const url = newPage.url();
                        console.error(`[DEBUG] Image Runner Watchdog detected NEW TAB (${url}).`);

                        const oldPage = this.page;
                        const isBusy = this.isTaskRunning;
                        const isGrok = url.includes('grok.com');

                        if (!isBusy && isGrok) {
                            this.page = newPage;
                            console.error('[DEBUG] Image Runner Watchdog switched main page to new Grok tab.');
                        } else if (!isBusy && !isGrok) {
                            console.error('[DEBUG] Image Runner Watchdog: Ignoring non-Grok tab for context switch.');
                        }

                        // Bring the new page to front so user sees why it opened
                        try { await newPage.bringToFront(); } catch (e) { }

                        // ONLY refresh if it stays blank for too long
                        if (url === 'about:blank' || url === 'chrome://newtab/' || !url.includes('grok')) {
                            await delay(1000); // Give it a second to load naturally
                            const finalUrl = newPage.url();
                            if (finalUrl === 'about:blank' || finalUrl === 'chrome://newtab/') {
                                console.error('[DEBUG] New tab is definitely blank. Forcing REFRESH to Grok...');
                                await newPage.goto('https://grok.com/imagine', { waitUntil: 'domcontentloaded' }).catch(() => { });
                            }
                        }

                        if (oldPage && oldPage !== newPage && !isBusy) {
                            const oldUrl = oldPage.url();
                            if (oldUrl === 'about:blank' || oldUrl.includes('newtab')) {
                                await oldPage.close().catch(() => { });
                            }
                        }
                    } catch (e) { }
                }
            });
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async isSessionValid() {
        if (!this.page) return false;
        try {
            // Wait for page to stabilize
            await delay(500); // Reduced from 2000

            // Check if we were redirected to login page or if there are explicit sign-in buttons
            const currentUrl = this.page.url();

            // If URL contains 'login' or 'signin', session is invalid
            if (currentUrl.includes('login') || currentUrl.includes('signin') || currentUrl.includes('auth')) {
                console.error('Redirected to login page:', currentUrl);
                return false;
            }

            // Check for sign-in buttons (indicates not logged in)
            const hasSignIn = await this.page.evaluate(() => {
                const signInElements = Array.from(document.querySelectorAll('button, a')).filter(el => {
                    const text = el.textContent?.trim().toLowerCase() || '';
                    return text === 'sign in' || text === 'log in' || text === 'login';
                });
                return signInElements.length > 0;
            });

            if (hasSignIn) {
                console.error('Sign in button detected - session invalid');
                return false;
            }

            // If no clear signs of logout, assume session is valid
            return true;
        } catch (error) {
            console.error('Session validation error:', error);
            return false;
        }
    }

    async generateImage(prompt, closeBrowser = true) {
        this.isTaskRunning = true;
        try {
            console.error('[DEBUG] Starting image generation for prompt:', prompt);
            await this.launch();
            console.error('[DEBUG] Browser ready');

            // Navigate to Grok Imagine Directly if needed
            if (!this.page.url().includes('/imagine')) {
                console.error('[DEBUG] Navigating to grok.com/imagine...');
                await this.page.goto('https://grok.com/imagine', {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
            }
            console.error('[DEBUG] Navigation complete');

            // 0. WAIT FOR LOGIN (Critical Step)
            console.error('[DEBUG] Checking login status...');
            const maxLoginWait = 300 * 1000; // 5 minutes
            const loginStart = Date.now();
            let isLoggedEarly = false;

            while (Date.now() - loginStart < maxLoginWait) {
                isLoggedEarly = await this.page.evaluate(() => {
                    // Normalize text check
                    const bodyText = document.body.innerText;
                    const hasSuperGrok = bodyText.includes('SuperGrok'); // Paid account indicator
                    const hasGrokLogo = !!document.querySelector('svg title')?.innerHTML?.includes('Grok') || bodyText.includes('Grok');

                    // Check common UI indicators
                    const userMenu = document.querySelector('[data-testid="user-menu"]');
                    const profileImg = document.querySelector('img[alt="Profile"]');
                    const textarea = document.querySelector('textarea');
                    const imagineTab = document.querySelector('[data-testid="imagine-tab"]');
                    const createImgBtn = Array.from(document.querySelectorAll('button, div[role="button"]')).some(el => el.textContent?.includes('Create Image'));

                    // If we see SuperGrok or Create Image button, we are definitely in!
                    return hasSuperGrok || createImgBtn || !!userMenu || !!profileImg || !!textarea || !!imagineTab;
                });

                if (isLoggedEarly) {
                    console.error('[DEBUG] Login confirmed! Proceeding...');
                    break;
                }

                await delay(1000); // Reduced polling delay
            }

            if (!isLoggedEarly) {
                console.error('[DEBUG] Login timeout. Proceeding anyway.');
            }

            // Ensure we are in "Image" mode (Grok Imagine defaults to Image, but let's be safe)
            // But usually switching mode takes time, let's just find the input.

            // 1. CLEANUP PREVIOUS UI STATE (Modals, etc.)
            await this.page.evaluate(() => {
                // Close any explicit modal close buttons
                const closeBtns = Array.from(document.querySelectorAll('button')).filter(b => {
                    const label = (b.getAttribute('aria-label') || '').toLowerCase();
                    return label.includes('close') || label.includes('dismiss');
                });
                closeBtns.forEach(b => b.click());

                // Also try clicking away or pressing Escape
                const dialog = document.querySelector('[role="dialog"], .modal');
                if (dialog) {
                    console.log('[DEBUG] Closing detected dialog/modal');
                    // We can't easily "press escape" here without puppeteer keyboard, 
                    // but we can try removing it or clicking a backdrop
                }
            });
            await this.page.keyboard.press('Escape'); // Real escape to close modals
            await delay(1000);

            // 2. RETRY LOOP FOR NAVIGATION & INPUT DETECTION
            let inputFound = false;
            let mainInput = null;
            for (let attempt = 1; attempt <= 10; attempt++) {
                // If we are on attempt 5 and still no input, try REFRESH
                if (attempt === 5) {
                    console.error('[DEBUG] Input not found. Forcing REFRESH...');
                    await this.page.reload({ waitUntil: 'domcontentloaded' });
                    await delay(3000);
                }

                mainInput = await this.page.evaluateHandle(() => {
                    const textareas = Array.from(document.querySelectorAll('textarea'));
                    const isImaginePage = window.location.href.includes('/imagine');
                    const valid = textareas.filter(t => {
                        const placeholder = (t.placeholder || t.getAttribute('placeholder') || t.getAttribute('aria-label') || '').toLowerCase();
                        const isSearch = placeholder.includes('search') || placeholder.includes('검색');
                        if (isSearch) return false;
                        if (isImaginePage) return true;
                        return placeholder.includes('imagine') || placeholder.includes('imagine');
                    });
                    valid.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
                    return valid[0] || null;
                });

                if (mainInput.asElement()) {
                    console.error('[DEBUG] Input bar found!');
                    inputFound = true;
                    try {
                        await mainInput.asElement().focus();
                        await mainInput.asElement().click();
                    } catch (e) { }
                    break;
                }
                await delay(1000);
            }

            if (!inputFound) {
                console.error('[DEBUG] Critical: No input found. Trying to fallback and type in whatever is there...');
            }

            await delay(1000);

            // BASELINE: Get initial count of large images
            const initialImageCount = await this.page.evaluate(() => {
                return Array.from(document.querySelectorAll('img'))
                    .filter(img => img.naturalWidth > 500 && img.naturalHeight > 500).length;
            });
            console.error(`[DEBUG] Initial big image count: ${initialImageCount}`);

            // BASELINE: Get existing images to avoid capturing old ones
            const existingImageSrcs = await this.page.evaluate(() => {
                return Array.from(document.querySelectorAll('img')).map(img => img.src);
            });
            console.error(`[DEBUG] Recorded ${existingImageSrcs.length} existing images.`);

            // Enter prompt
            await this.page.evaluate(async (text) => {
                const input = document.querySelector('textarea') ||
                    document.querySelector('input[type="text"]') ||
                    document.querySelector('[contenteditable="true"]');

                if (input) {
                    // Focus and clear explicitly
                    input.focus();
                    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
                        // For React-controlled inputs, simple .value = '' might not work
                        // But usually Grok handles it. Let's try to select all and delete just in case.
                        input.value = '';
                        input.dispatchEvent(new Event('input', { bubbles: true }));

                        input.value = text;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        input.textContent = '';
                        input.dispatchEvent(new Event('input', { bubbles: true }));

                        input.textContent = text;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            }, prompt);

            await delay(500);

            // Submit prompt
            await this.page.keyboard.press('Enter');
            await this.page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(b =>
                    b.innerText.toLowerCase().includes('generate') ||
                    b.getAttribute('aria-label')?.toLowerCase().includes('send')
                );
                if (btn && !btn.disabled) btn.click();
            });

            await delay(2000); // Wait for generation to start

            // Wait for images
            const maxWaitTime = 90000; // Increase to 90s for Grok
            const pollInterval = 1000;
            let elapsed = 0;
            let imageUrls = [];

            // NEW DETECTION STRATEGY: Wait for Count > Initial
            let newCandidateIdx = -1;
            while (elapsed < maxWaitTime) {
                await delay(pollInterval);
                elapsed += pollInterval;

                // Check for NEW images by Count Difference
                const currentImages = await this.page.evaluate(() => {
                    const imgs = Array.from(document.querySelectorAll('img'));
                    return imgs.map((img, idx) => ({
                        index: idx,
                        src: img.src,
                        isLarge: img.naturalWidth > 600 && img.naturalHeight > 600,
                        isLoaded: img.complete && img.naturalWidth > 0,
                        isNotProfile: !img.src.includes('avatar') && !img.src.includes('profile'),
                        style: {
                            opacity: window.getComputedStyle(img).opacity,
                            filter: window.getComputedStyle(img).filter,
                            visibility: window.getComputedStyle(img).visibility
                        }
                    }));
                });

                // Find the first image that is NEW (by index or simple position) and COMPLETED
                // Since Grok prepends or appends, we look for *any* large image that is ready and not in our old list
                // But relying on src list was flaky. Let's rely on COUNT + VALIDITY.

                const validCandidates = currentImages.filter(img => {
                    const isVisible = img.style.opacity !== '0' && img.style.visibility !== 'hidden';
                    const isBlurred = img.style.filter.includes('blur') || (parseFloat(img.style.opacity) < 1 && parseFloat(img.style.opacity) > 0);
                    return img.isLarge && img.isLoaded && img.isNotProfile && isVisible && !isBlurred;
                });

                // If we have MORE valid images than before, or at least one if we started with zero unique ones
                // Note: Grok usually shows 2 images per gen.
                if (validCandidates.length > initialImageCount) {
                    // Pick the NEWEST one (usually the first one in DOM for prepended feeds, or last for appended)
                    // Grok feed usually prepends. Let's pick the first valid visual candidate.
                    const targetCandidate = validCandidates[0]; // Top-most valid image

                    // Helper: ensure it's not an old one by src check just in case
                    if (existingImageSrcs.includes(targetCandidate.src)) {
                        // It's an old image. Skip.
                        continue;
                    }

                    console.error(`[DEBUG] NEW valid image detected (Count: ${validCandidates.length} > ${initialImageCount})`);
                    newCandidateIdx = targetCandidate.index; // Return the DOM index
                    break; // Exit loop, we found a new image
                }
            }

            // Return -1 if timeout
            // newCandidateIdx will be -1 if loop timed out without finding a new image

            if (newCandidateIdx !== -1) {
                console.error(`[DEBUG] NEW image candidate detected at index ${newCandidateIdx}!`);

                // 1. CLICK THE SPECIFIC NEW CANDIDATE
                const targetResult = await this.page.evaluate((idx) => {
                    const imgs = document.querySelectorAll('img');
                    const target = imgs[idx];
                    if (target) {
                        target.click();
                        return true;
                    }
                    return false;
                }, newCandidateIdx);

                if (targetResult) {
                    console.error('[DEBUG] Clicked NEW image. Waiting for modal/high-res render...');
                    await delay(3000);
                }

                // 2. EXTRACT - Targeted approach
                const finalImages = [];
                try {
                    // Priority: Image inside modal/dialog
                    const modalImgHandle = await this.page.evaluateHandle(() => {
                        const modal = document.querySelector('[role="dialog"], .modal, div[style*="fixed"]');
                        if (!modal) return null;
                        const imgs = Array.from(modal.querySelectorAll('img')).filter(img => {
                            const style = window.getComputedStyle(img);
                            const isBlurred = style.filter.includes('blur') || parseFloat(style.opacity) < 0.9;
                            return img.naturalWidth > 800 && !isBlurred;
                        });
                        return imgs[0] || null;
                    });

                    const handle = modalImgHandle.asElement();
                    if (handle) {
                        console.error('[DEBUG] High-res MODAL image found!');
                        const base64Data = await this.extractImageData(handle);
                        if (base64Data) finalImages.push(base64Data);
                    } else {
                        // Fallback: Just get the largest image on page
                        console.error('[DEBUG] Modal image not found by role. Scanning all large images...');
                        const imageHandles = await this.page.$$('img');
                        for (const h of imageHandles) {
                            try {
                                const isLarge = await h.evaluate(el => el.naturalWidth > 600 && el.complete && !el.src.includes('avatar'));
                                if (isLarge) {
                                    const data = await this.extractImageData(h);
                                    if (data) finalImages.push(data);
                                    if (finalImages.length >= 1) break; // Just take one good one
                                }
                            } catch (e) {
                                if (e.message.includes('detached') || e.message.includes('Reference error')) continue;
                                throw e;
                            }
                        }
                    }
                } catch (e) {
                    console.error('[DEBUG] Extraction error:', e.message);
                    if (e.message.includes('detached')) {
                        console.error('[DEBUG] Frame detached during extraction. Returning partials if any.');
                    }
                }

                if (finalImages.length > 0) {
                    imageUrls = finalImages;
                }
            }

            // Error Check
            const hasError = await this.page.$eval('body', body => {
                return body.innerText.includes('Something went wrong') ||
                    body.innerText.includes('Try again');
            }).catch(() => false);

            if (hasError) return { success: false, error: 'Grok reported a generation error.' };

            // SUCCESS!
            console.error('[DEBUG] Image generation loop finished.');
            if (closeBrowser) {
                await this.close();
            }

            if (imageUrls.length === 0) {
                return { success: false, error: 'No images generated (timeout or quality check failed)' };
            }

            return {
                success: true,
                imageUrls: imageUrls,
                selectedImageUrl: imageUrls[0]
            };
        } catch (error) {
            console.error('[DEBUG] Critical Error:', error);
            return { success: false, error: error.message };
        } finally {
            this.isTaskRunning = false;
            if (closeBrowser) {
                await this.close();
            }
        }
    }

    // Helper for data extraction
    async extractImageData(handle) {
        try {
            await handle.scrollIntoView().catch(() => { });

            // Method 1: Fetch
            let base64Data = await handle.evaluate(async (el) => {
                try {
                    const response = await fetch(el.src);
                    const blob = await response.blob();
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = () => resolve(null);
                        reader.readAsDataURL(blob);
                    });
                } catch (e) { return null; }
            });

            // Method 2: Screenshot
            if (!base64Data || !base64Data.startsWith('data:')) {
                base64Data = await handle.screenshot({ encoding: 'base64' }).catch(() => null);
                if (base64Data) base64Data = `data:image/png;base64,${base64Data}`;
            }

            return (base64Data && base64Data.length > 20000) ? base64Data : null;
        } catch (e) {
            return null;
        }
    }
}

// Main execution
if (require.main === module) {
    const profileId = process.argv[2] || 'grok-manual';
    const prompt = process.argv[3] || '';

    if (!prompt) {
        console.log(JSON.stringify({ success: false, error: 'No prompt provided' }));
        process.exit(1);
    }

    const runner = new GrokImageRunner(profileId);
    runner.generateImage(prompt)
        .then(result => {
            console.log(JSON.stringify(result));
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.log(JSON.stringify({ success: false, error: error.message }));
            process.exit(1);
        });
}

module.exports = GrokImageRunner;
