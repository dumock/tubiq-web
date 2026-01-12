/**
 * Grok Imagine Video Generation Automation
 * 
 * Puppeteer-based browser automation for Grok video generation.
 * Uses Chrome profiles to persist login sessions.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

// Helper function for delays (replaces deprecated waitForTimeout)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Profile directory for Chrome sessions
const PROFILES_DIR = path.join(process.cwd(), 'chrome-profiles');

export interface GrokAccount {
    id: string;
    name: string;
    email?: string;
    connected: boolean;
    lastActive?: Date;
}

export interface VideoGenerationResult {
    success: boolean;
    videoUrl?: string;
    error?: string;
}

export interface ImageGenerationResult {
    success: boolean;
    imageUrls: string[];  // All generated images
    selectedImageUrl?: string;  // First/selected image
    error?: string;
}

export class GrokAutomation {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private profileId: string;
    private profilePath: string;
    private cookiesPath: string;

    constructor(profileId: string = 'grok-1') {
        this.profileId = profileId;
        this.profilePath = path.join(PROFILES_DIR, profileId);
        this.cookiesPath = path.join(this.profilePath, 'cookies.json');

        // Ensure profile directory exists
        if (!fs.existsSync(this.profilePath)) {
            fs.mkdirSync(this.profilePath, { recursive: true });
        }
    }

    /**
     * Launch browser with saved profile (headless or visible)
     */
    async launch(headless: boolean = true): Promise<void> {
        // Use regular puppeteer for Next.js compatibility
        // puppeteer-extra has issues with Turbopack bundling
        this.browser = await puppeteer.launch({
            headless: headless,
            userDataDir: this.profilePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1280,900',
                '--lang=en-US,en',
                // Stealth-like arguments to avoid detection
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--disable-extensions'
            ],
            defaultViewport: {
                width: 1280,
                height: 900
            }
        });

        if (!this.browser) {
            throw new Error('Failed to launch browser');
        }

        this.page = await this.browser.newPage();

        // Set user agent to look like regular Chrome
        await this.page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // Additional stealth measures
        await this.page.evaluateOnNewDocument(() => {
            // Override navigator.webdriver to hide automation
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            // Override chrome.runtime to look like real Chrome
            (window as any).chrome = {
                runtime: {},
            };
        });

        // Load cookies if they exist
        await this.loadCookies();
    }

    /**
     * Close browser instance
     */
    async close(): Promise<void> {
        if (this.browser) {
            await this.saveCookies();
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    /**
     * Save cookies to file for session persistence
     */
    async saveCookies(): Promise<void> {
        if (!this.page) return;

        try {
            const cookies = await this.page.cookies();
            fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2));
        } catch (error) {
            console.error('Failed to save cookies:', error);
        }
    }

    /**
     * Load cookies from file
     */
    async loadCookies(): Promise<boolean> {
        if (!this.page) return false;

        try {
            if (fs.existsSync(this.cookiesPath)) {
                const cookies = JSON.parse(fs.readFileSync(this.cookiesPath, 'utf-8'));
                await this.page.setCookie(...cookies);
                return true;
            }
        } catch (error) {
            console.error('Failed to load cookies:', error);
        }
        return false;
    }

    /**
     * Check if the current session is valid (user is logged in)
     */
    async isSessionValid(): Promise<boolean> {
        if (!this.page) return false;

        try {
            await this.page.goto('https://grok.com', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Check for signs of being logged in
            // Look for the Imagine tab or user menu
            const isLoggedIn = await this.page.evaluate(() => {
                // Check for login indicators
                const imagineTab = document.querySelector('[data-testid="imagine-tab"]') ||
                    document.querySelector('a[href*="imagine"]') ||
                    Array.from(document.querySelectorAll('button, a')).find(
                        el => el.textContent?.toLowerCase().includes('imagine')
                    );
                // Also check for user avatar or menu
                const userMenu = document.querySelector('[data-testid="user-menu"]') ||
                    document.querySelector('[aria-label*="profile"]') ||
                    document.querySelector('img[alt*="profile"]');

                return !!(imagineTab || userMenu);
            });

            return isLoggedIn;
        } catch (error) {
            console.error('Session validation error:', error);
            return false;
        }
    }

    /**
     * Open browser for manual login
     * Returns when user completes login or closes browser
     */
    async openForManualLogin(): Promise<{ success: boolean; email?: string }> {
        await this.launch(false); // Visible browser

        if (!this.page || !this.browser) {
            return { success: false };
        }

        try {
            // Navigate to Grok login
            await this.page.goto('https://grok.com', {
                waitUntil: 'networkidle2',
                timeout: 60000
            });

            // Wait for user to complete login
            // Poll every 3 seconds to check login status
            const maxWaitTime = 5 * 60 * 1000; // 5 minutes
            const pollInterval = 3000;
            let elapsed = 0;
            let isLoggedIn = false;

            while (elapsed < maxWaitTime && this.browser.isConnected()) {
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                elapsed += pollInterval;

                isLoggedIn = await this.isSessionValid();
                if (isLoggedIn) break;
            }

            if (isLoggedIn) {
                await this.saveCookies();

                // Try to get email/username
                const email = await this.page.evaluate(() => {
                    const emailEl = document.querySelector('[data-testid="email"]');
                    return emailEl?.textContent || 'Unknown';
                });

                return { success: true, email };
            }

            return { success: false };
        } catch (error) {
            console.error('Manual login error:', error);
            return { success: false };
        } finally {
            await this.close();
        }
    }

    /**
     * Generate video from image using Grok Imagine
     */
    async generateVideo(
        imageUrl: string,
        prompt?: string,
        mode: 'normal' | 'fun' | 'custom' = 'normal'
    ): Promise<VideoGenerationResult> {
        try {
            await this.launch(true); // Headless mode

            if (!this.page) {
                return { success: false, error: 'Failed to launch browser' };
            }

            // Check session
            const isValid = await this.isSessionValid();
            if (!isValid) {
                await this.close();
                return { success: false, error: 'Session expired. Please reconnect your Grok account.' };
            }

            // Navigate to Imagine tab
            await this.navigateToImagine();

            // Download image to temp file for upload
            const tempImagePath = await this.downloadImageToTemp(imageUrl);

            // Upload image
            await this.uploadImage(tempImagePath);

            // Click "Make video" button
            await this.clickMakeVideo();

            // Select mode if needed
            if (mode !== 'normal') {
                await this.selectVideoMode(mode);
            }

            // Wait for video generation and get URL
            const videoUrl = await this.waitForVideoAndDownload();

            // Cleanup temp file
            if (fs.existsSync(tempImagePath)) {
                fs.unlinkSync(tempImagePath);
            }

            await this.close();

            return { success: true, videoUrl };
        } catch (error) {
            console.error('Video generation error:', error);
            await this.close();
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Video generation failed'
            };
        }
    }

    /**
     * Generate image from text prompt using Grok Imagine
     */
    async generateImage(prompt: string): Promise<ImageGenerationResult> {
        try {
            await this.launch(true); // Headless mode

            if (!this.page) {
                return { success: false, imageUrls: [], error: 'Failed to launch browser' };
            }

            // Check session
            const isValid = await this.isSessionValid();
            if (!isValid) {
                await this.close();
                return { success: false, imageUrls: [], error: 'Session expired. Please reconnect your Grok account.' };
            }

            // Navigate to Imagine tab
            await this.navigateToImagine();

            // Enter prompt in text input
            await this.enterImagePrompt(prompt);

            // Submit the prompt (click generate button)
            await this.submitImagePrompt();

            // Wait for images to generate and extract URLs
            const imageUrls = await this.waitForImagesAndExtract();

            await this.close();

            if (imageUrls.length === 0) {
                return { success: false, imageUrls: [], error: 'No images generated' };
            }

            return {
                success: true,
                imageUrls: imageUrls,
                selectedImageUrl: imageUrls[0] // Auto-select first image
            };
        } catch (error) {
            console.error('Image generation error:', error);
            await this.close();
            return {
                success: false,
                imageUrls: [],
                error: error instanceof Error ? error.message : 'Image generation failed'
            };
        }
    }

    /**
     * Enter image prompt in the Grok Imagine text field
     */
    private async enterImagePrompt(prompt: string): Promise<void> {
        if (!this.page) return;

        // Wait for and find the prompt input
        await delay(1000);

        // Try various selectors for the text input
        const inputSelector = await this.page.evaluate(() => {
            // Look for textarea or input that accepts the prompt
            const textarea = document.querySelector('textarea') ||
                document.querySelector('input[type="text"]') ||
                document.querySelector('[contenteditable="true"]');
            return !!textarea;
        });

        if (inputSelector) {
            // Type the prompt
            await this.page.evaluate((text) => {
                const input = document.querySelector('textarea') ||
                    document.querySelector('input[type="text"]') ||
                    document.querySelector('[contenteditable="true"]');
                if (input) {
                    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
                        (input as HTMLTextAreaElement | HTMLInputElement).value = text;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    } else {
                        (input as HTMLElement).textContent = text;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            }, prompt);
        }

        await delay(500);
    }

    /**
     * Submit the image prompt (click generate/send button)
     */
    private async submitImagePrompt(): Promise<void> {
        if (!this.page) return;

        // Try to find and click the generate/send button
        await this.page.evaluate(() => {
            // Look for generate/send button
            const generateBtn = document.querySelector('[data-testid="generate-btn"]') ||
                document.querySelector('[data-testid="send-btn"]') ||
                document.querySelector('button[type="submit"]') ||
                Array.from(document.querySelectorAll('button')).find(
                    el => el.textContent?.toLowerCase().includes('generate') ||
                        el.textContent?.toLowerCase().includes('create') ||
                        el.textContent?.includes('生成') ||
                        el.textContent?.includes('만들')
                ) ||
                // Look for send icon button (arrow, paper plane, etc.)
                document.querySelector('button svg[data-icon="send"]')?.closest('button') ||
                document.querySelector('button svg[data-icon="arrow-right"]')?.closest('button');

            if (generateBtn) {
                (generateBtn as HTMLElement).click();
            } else {
                // Fallback: press Enter in the input
                const input = document.querySelector('textarea') || document.querySelector('input[type="text"]');
                if (input) {
                    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                }
            }
        });

        await delay(2000);
    }

    /**
     * Wait for images to generate and extract all image URLs
     */
    private async waitForImagesAndExtract(): Promise<string[]> {
        if (!this.page) return [];

        // Wait for images (max 2 minutes)
        const maxWaitTime = 120000;
        const pollInterval = 2000;
        let elapsed = 0;
        let imageUrls: string[] = [];

        while (elapsed < maxWaitTime) {
            await delay(pollInterval);
            elapsed += pollInterval;

            // Extract image URLs from the page
            imageUrls = await this.page.evaluate(() => {
                const urls: string[] = [];

                // Look for generated images in various containers
                const images = document.querySelectorAll('img[src*="blob:"], img[src*="grok"], img[src*="imagine"], img[src*="generated"]');
                images.forEach(img => {
                    const src = (img as HTMLImageElement).src;
                    if (src && !src.includes('avatar') && !src.includes('icon') && !src.includes('logo')) {
                        urls.push(src);
                    }
                });

                // Also check for images in gallery/grid containers
                const galleryImages = document.querySelectorAll('[class*="gallery"] img, [class*="grid"] img, [class*="result"] img');
                galleryImages.forEach(img => {
                    const src = (img as HTMLImageElement).src;
                    if (src && !urls.includes(src) && !src.includes('avatar') && !src.includes('icon')) {
                        urls.push(src);
                    }
                });

                return urls;
            });

            // If we found images (Grok usually generates 2-4), we're done
            if (imageUrls.length >= 1) {
                // Wait a bit more for all images to load
                await delay(2000);

                // Re-extract to get all loaded images
                imageUrls = await this.page.evaluate(() => {
                    const urls: string[] = [];
                    const images = document.querySelectorAll('img');
                    images.forEach(img => {
                        const src = (img as HTMLImageElement).src;
                        // Filter to likely generated images (large size, not UI elements)
                        if (src &&
                            !src.includes('avatar') &&
                            !src.includes('icon') &&
                            !src.includes('logo') &&
                            img.naturalWidth > 200 &&
                            img.naturalHeight > 200) {
                            urls.push(src);
                        }
                    });
                    return urls;
                });

                break;
            }

            // Check for errors
            const hasError = await this.page.evaluate(() => {
                const errorEl = document.querySelector('[class*="error"]') ||
                    Array.from(document.querySelectorAll('div, span')).find(
                        el => el.textContent?.toLowerCase().includes('error') ||
                            el.textContent?.toLowerCase().includes('failed') ||
                            el.textContent?.includes('오류')
                    );
                return !!errorEl;
            });

            if (hasError) {
                throw new Error('Grok reported an error during image generation');
            }
        }

        return imageUrls;
    }

    /**
     * Navigate to the Imagine tab
     */
    private async navigateToImagine(): Promise<void> {
        if (!this.page) return;

        // Look for Imagine tab/link and click it
        await this.page.evaluate(() => {
            const imagineTab = document.querySelector('[data-testid="imagine-tab"]') ||
                document.querySelector('a[href*="imagine"]') ||
                Array.from(document.querySelectorAll('button, a, div[role="tab"]')).find(
                    el => el.textContent?.toLowerCase().includes('imagine')
                );
            if (imagineTab) {
                (imagineTab as HTMLElement).click();
            }
        });

        // Wait for imagine interface to load
        await delay(2000);
    }

    /**
     * Download image from URL to temp file
     */
    private async downloadImageToTemp(imageUrl: string): Promise<string> {
        const tempPath = path.join(this.profilePath, `temp_image_${Date.now()}.png`);

        const response = await fetch(imageUrl);
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(tempPath, Buffer.from(buffer));

        return tempPath;
    }

    /**
     * Upload image to Grok Imagine
     */
    private async uploadImage(imagePath: string): Promise<void> {
        if (!this.page) return;

        // Find file input element
        const fileInput = await this.page.$('input[type="file"]');

        if (fileInput) {
            await fileInput.uploadFile(imagePath);
        } else {
            // Try clicking upload button first
            await this.page.evaluate(() => {
                const uploadBtn = document.querySelector('[data-testid="upload-image"]') ||
                    Array.from(document.querySelectorAll('button')).find(
                        el => el.textContent?.toLowerCase().includes('upload')
                    );
                if (uploadBtn) {
                    (uploadBtn as HTMLElement).click();
                }
            });

            await delay(1000);

            const input = await this.page.$('input[type="file"]');
            if (input) {
                await input.uploadFile(imagePath);
            }
        }

        // Wait for upload to complete
        await delay(3000);
    }

    /**
     * Click the "Make video" button
     */
    private async clickMakeVideo(): Promise<void> {
        if (!this.page) return;

        await this.page.evaluate(() => {
            const makeVideoBtn = document.querySelector('[data-testid="make-video"]') ||
                Array.from(document.querySelectorAll('button')).find(
                    el => el.textContent?.toLowerCase().includes('make video') ||
                        el.textContent?.toLowerCase().includes('영상')
                );
            if (makeVideoBtn) {
                (makeVideoBtn as HTMLElement).click();
            }
        });

        await delay(2000);
    }

    /**
     * Select video generation mode
     */
    private async selectVideoMode(mode: 'fun' | 'custom'): Promise<void> {
        if (!this.page) return;

        await this.page.evaluate((targetMode) => {
            const modeBtn = Array.from(document.querySelectorAll('button, div[role="option"]')).find(
                el => el.textContent?.toLowerCase().includes(targetMode)
            );
            if (modeBtn) {
                (modeBtn as HTMLElement).click();
            }
        }, mode);

        await delay(1000);
    }

    /**
     * Wait for video generation to complete and download
     */
    private async waitForVideoAndDownload(): Promise<string> {
        if (!this.page) throw new Error('No page available');

        // Wait for video to appear (max 3 minutes)
        const maxWaitTime = 180000;
        const pollInterval = 2000;
        let elapsed = 0;
        let videoUrl: string | null = null;

        while (elapsed < maxWaitTime) {
            await delay(pollInterval);
            elapsed += pollInterval;

            // Check for video element or download button
            videoUrl = await this.page.evaluate(() => {
                // Look for video element
                const video = document.querySelector('video[src]');
                if (video) {
                    return (video as HTMLVideoElement).src;
                }

                // Look for download link
                const downloadLink = document.querySelector('a[download]') ||
                    Array.from(document.querySelectorAll('a')).find(
                        el => el.href?.includes('.mp4') || el.href?.includes('.webm')
                    );
                if (downloadLink) {
                    return (downloadLink as HTMLAnchorElement).href;
                }

                return null;
            });

            if (videoUrl) break;

            // Check for error
            const hasError = await this.page.evaluate(() => {
                const errorEl = document.querySelector('[data-testid="error"]') ||
                    Array.from(document.querySelectorAll('div')).find(
                        el => el.textContent?.toLowerCase().includes('error') ||
                            el.textContent?.toLowerCase().includes('failed')
                    );
                return !!errorEl;
            });

            if (hasError) {
                throw new Error('Grok reported an error during video generation');
            }
        }

        if (!videoUrl) {
            throw new Error('Video generation timed out');
        }

        return videoUrl;
    }

    /**
     * Get account info if logged in
     */
    async getAccountInfo(): Promise<GrokAccount | null> {
        // Check if cookies exist
        if (!fs.existsSync(this.cookiesPath)) {
            return null;
        }

        try {
            await this.launch(true);

            if (!this.page) return null;

            const isValid = await this.isSessionValid();

            if (!isValid) {
                await this.close();
                return null;
            }

            // Try to get account info
            const email = await this.page.evaluate(() => {
                // Look for email in various places
                const emailEl = document.querySelector('[data-testid="email"]');
                const userNameEl = document.querySelector('[data-testid="username"]');
                return emailEl?.textContent || userNameEl?.textContent || 'Connected';
            });

            await this.close();

            return {
                id: this.profileId,
                name: email || 'Grok Account',
                email: email || undefined,
                connected: true,
                lastActive: new Date()
            };
        } catch (error) {
            console.error('Failed to get account info:', error);
            await this.close();
            return null;
        }
    }
}

/**
 * Get list of available Grok accounts (lightweight, no browser launch)
 */
export async function getGrokAccounts(): Promise<GrokAccount[]> {
    const accounts: GrokAccount[] = [];

    if (!fs.existsSync(PROFILES_DIR)) {
        return accounts;
    }

    const profiles = fs.readdirSync(PROFILES_DIR).filter(
        name => name.startsWith('grok-')
    );

    for (const profileId of profiles) {
        const profilePath = path.join(PROFILES_DIR, profileId);
        const cookiesPath = path.join(profilePath, 'cookies.json');

        // Check for connectivity indicators
        const isManual = profileId === 'grok-manual';
        const hasConnectedIndicator = isManual ? fs.existsSync(profilePath) : fs.existsSync(cookiesPath);

        let email = profileId;
        if (hasConnectedIndicator && !isManual) {
            try {
                // Try to read some identifying info from legacy cookies
                const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
                const userCookie = cookies.find((c: any) =>
                    c.name.includes('user') || c.name.includes('session')
                );
                if (userCookie) {
                    email = 'Connected';
                }
            } catch (e) {
                // Ignore cookie read errors
            }
        } else if (isManual) {
            email = 'Grok Manual (Chrome)';
        }

        accounts.push({
            id: profileId,
            name: email,
            connected: hasConnectedIndicator,
            lastActive: hasConnectedIndicator
                ? new Date(fs.statSync(isManual ? profilePath : cookiesPath).mtime)
                : undefined
        });
    }

    return accounts;
}

/**
 * Create a new Grok account profile
 */
export function createGrokProfile(): string {
    if (!fs.existsSync(PROFILES_DIR)) {
        fs.mkdirSync(PROFILES_DIR, { recursive: true });
    }

    // Find next available profile ID
    let profileNum = 1;
    while (fs.existsSync(path.join(PROFILES_DIR, `grok-${profileNum}`))) {
        profileNum++;
    }

    const profileId = `grok-${profileNum}`;
    fs.mkdirSync(path.join(PROFILES_DIR, profileId), { recursive: true });

    return profileId;
}

/**
 * Delete a Grok account profile
 */
export function deleteGrokProfile(profileId: string): boolean {
    const profilePath = path.join(PROFILES_DIR, profileId);

    if (fs.existsSync(profilePath)) {
        fs.rmSync(profilePath, { recursive: true, force: true });
        return true;
    }

    return false;
}
