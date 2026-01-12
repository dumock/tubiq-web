/**
 * GrokBrowser - 단일 브라우저/페이지 관리
 * 
 * 핵심 원칙:
 * 1. 항상 단일 탭만 유지
 * 2. 새 탭 열리면 즉시 닫기
 * 3. 모든 작업 전 깨끗한 상태 보장
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const fs = require('fs');
const path = require('path');
const SELECTORS = require('./GrokSelectors');

const PROFILES_DIR = path.resolve(__dirname, '..', '..', 'chrome-profiles');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class GrokBrowser {
    constructor(profileId = 'grok-manual') {
        this.browser = null;
        this.page = null;
        this.profileId = profileId;
        this.profilePath = path.join(PROFILES_DIR, profileId);
    }

    /**
     * 브라우저 시작 (재사용 가능)
     */
    async launch() {
        if (this.browser && this.browser.isConnected()) {
            console.error('[GrokBrowser] Already connected, reusing...');
            return;
        }

        // 프로필 디렉토리 생성
        if (!fs.existsSync(this.profilePath)) {
            fs.mkdirSync(this.profilePath, { recursive: true });
        }

        console.error('[GrokBrowser] Launching browser...');
        this.browser = await puppeteer.launch({
            headless: false,
            channel: 'chrome',
            userDataDir: this.profilePath,
            args: [
                '--window-size=1280,900',
                '--disable-blink-features=AutomationControlled',
                '--disable-translate',
                '--disable-features=Translate', // 번역 기능 비활성화
                '--disable-infobars',
                '--no-first-run',
                '--no-default-browser-check',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            ],
            ignoreDefaultArgs: ['--enable-automation'],
            defaultViewport: null,
            ignoreHTTPSErrors: true
        });

        // FIX: Allow multiple file downloads automatically for Grok
        try {
            const context = this.browser.defaultBrowserContext();
            await context.overridePermissions('https://grok.com', ['automatic-downloads']);
            console.error('[GrokBrowser] Granted "automatic-downloads" permission to grok.com');
        } catch (e) {
            console.error('[GrokBrowser] Failed to grant permissions:', e);
        }

        // 새 탭 감지 시 즉시 닫기 (핵심 수정!)
        this.browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
                const newPage = await target.page();
                if (!newPage) return;

                // 메인 페이지가 아니면 닫기
                if (this.page && newPage !== this.page) {
                    console.error('[GrokBrowser] New tab detected, closing immediately...');
                    try {
                        await newPage.close();
                    } catch (e) {
                        // 이미 닫혔을 수 있음
                    }
                }
            }
        });

        await this._ensureSinglePage();
    }

    /**
     * 항상 단일 페이지만 유지하고 반환
     */
    async ensurePage() {
        if (!this.browser || !this.browser.isConnected()) {
            await this.launch();
        }

        await this._ensureSinglePage();
        return this.page;
    }

    /**
     * 내부: 단일 페이지 보장
     */
    async _ensureSinglePage() {
        const pages = await this.browser.pages();

        // Grok 페이지 찾기
        let grokPage = null;
        for (const p of pages) {
            const url = p.url();
            if (url.includes('grok.com')) {
                grokPage = p;
                break;
            }
        }

        // Grok 페이지가 있으면 사용, 없으면 첫 번째 페이지 사용
        if (grokPage) {
            this.page = grokPage;
        } else if (pages.length > 0) {
            this.page = pages[0];
        } else {
            this.page = await this.browser.newPage();
        }

        // 5. 파일 선택 창 방지 (오클릭 시 팝업 뜨는 것 차단)
        this.page.on('filechooser', async (fileChooser) => {
            console.error('[GrokBrowser] Blocked an unexpected file dialog popup.');
            await fileChooser.cancel();
        });

        // 나머지 페이지 모두 닫기
        for (const p of pages) {
            if (p !== this.page) {
                try {
                    await p.close();
                } catch (e) { }
            }
        }

        // Anti-detection
        await this.page.evaluateOnNewDocument(() => {
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        await this.page.bringToFront();
    }

    /**
     * Grok Imagine 페이지로 이동 (깨끗한 상태 보장)
     */
    async navigateToImagine() {
        const page = await this.ensurePage();

        // FIX: Set Download Path strictly
        const downloadPath = path.resolve(process.cwd(), 'tmp', 'downloads');
        if (!fs.existsSync(downloadPath)) {
            fs.mkdirSync(downloadPath, { recursive: true });
        }

        try {
            const client = await page.target().createCDPSession();
            await client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: downloadPath,
            });
            console.error(`[GrokBrowser] Download path set to: ${downloadPath}`);
        } catch (e) {
            console.error('[GrokBrowser] Failed to set download behavior (CDP):', e);
        }

        // 상태 완전 초기화를 위해 about:blank 갔다가 다시 이동
        // 이는 SPA 상태나 이전 모드(Video Mode)가 남는 것을 방지함
        console.error('[GrokBrowser] Forcing navigation to clean state...');
        await page.goto('about:blank');
        await delay(500);

        console.error('[GrokBrowser] Navigating to Imagine...');
        await page.goto(SELECTORS.GROK_IMAGINE_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        await delay(3000); // 초기 로딩 대기
        return page;
    }

    /**
     * 로그인 상태 확인
     */
    async isLoggedIn() {
        const page = await this.ensurePage();

        return await page.evaluate((indicators) => {
            const bodyText = document.body.innerText;

            // 로그인 됨 표시 확인
            for (const selector of indicators.loggedIn) {
                if (bodyText.includes(selector) || document.querySelector(selector)) {
                    return true;
                }
            }

            // 로그아웃 표시 확인
            for (const text of indicators.loggedOut) {
                if (bodyText.includes(text)) {
                    return false;
                }
            }

            // 불확실하면 true 반환 (진행 시도)
            return true;
        }, SELECTORS.LOGIN_INDICATORS);
    }

    /**
     * 로그인 대기 (최대 5분)
     */
    async waitForLogin(timeoutMs = 300000) {
        console.error('[GrokBrowser] Waiting for login...');
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            if (await this.isLoggedIn()) {
                console.error('[GrokBrowser] Login confirmed!');
                return true;
            }
            await delay(2000);
        }

        console.error('[GrokBrowser] Login timeout');
        return false;
    }

    /**
     * 브라우저 닫기
     */
    async close() {
        if (this.browser) {
            try {
                await this.browser.close();
            } catch (e) { }
            this.browser = null;
            this.page = null;
        }
    }
}

module.exports = GrokBrowser;
