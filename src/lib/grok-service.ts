import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Chrome 프로필 저장 경로
const CHROME_PROFILES_DIR = path.join(os.homedir(), '.tubiq', 'grok-profiles');

// Grok 설정
const GROK_URL = 'https://grok.com';

interface GrokSession {
    browser: Browser;
    page: Page;
    profileId: string;
    isLoggedIn: boolean;
}

interface VideoGenerationResult {
    success: boolean;
    videoUrl?: string;
    error?: string;
}

// 프로필 디렉토리 생성
function ensureProfileDir(profileId: string): string {
    const profilePath = path.join(CHROME_PROFILES_DIR, profileId);
    if (!fs.existsSync(profilePath)) {
        fs.mkdirSync(profilePath, { recursive: true });
    }
    return profilePath;
}

/**
 * Grok 세션 시작 (Chrome 브라우저 열기)
 */
export async function startGrokSession(profileId: string = 'default'): Promise<GrokSession> {
    const profilePath = ensureProfileDir(profileId);

    const browser = await puppeteer.launch({
        headless: false, // 디버깅을 위해 보이게
        userDataDir: profilePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1280,720',
        ],
        defaultViewport: null,
    });

    const page = await browser.newPage();

    // 봇 감지 우회
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Grok 페이지 접속
    await page.goto(GROK_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // 로그인 상태 확인 (로그인 버튼이 있으면 미로그인)
    const isLoggedIn = await checkLoginStatus(page);

    return {
        browser,
        page,
        profileId,
        isLoggedIn,
    };
}

/**
 * 로그인 상태 확인
 */
async function checkLoginStatus(page: Page): Promise<boolean> {
    try {
        // 로그인 버튼 또는 "Sign in" 텍스트가 있으면 미로그인
        const loginButton = await page.$('button[data-testid="loginButton"], a[href*="login"]');
        return !loginButton;
    } catch {
        return false;
    }
}

/**
 * 수동 로그인 대기 (브라우저 창에서 사용자가 직접 로그인)
 */
export async function waitForManualLogin(session: GrokSession, timeoutMs: number = 300000): Promise<boolean> {
    console.log('🔐 Grok 로그인이 필요합니다. 브라우저 창에서 로그인해주세요...');

    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const isLoggedIn = await checkLoginStatus(session.page);
        if (isLoggedIn) {
            console.log('✅ 로그인 성공!');
            session.isLoggedIn = true;
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('❌ 로그인 시간 초과');
    return false;
}

/**
 * 이미지를 Grok에 업로드하고 영상 생성
 */
export async function generateVideo(
    session: GrokSession,
    imageUrl: string,
    prompt: string
): Promise<VideoGenerationResult> {
    if (!session.isLoggedIn) {
        return { success: false, error: '로그인되지 않음' };
    }

    try {
        const { page } = session;

        // Grok 영상 생성 페이지로 이동 (URL은 실제 Grok 페이지에 맞게 수정 필요)
        await page.goto(`${GROK_URL}/create`, { waitUntil: 'networkidle2', timeout: 60000 });

        // 이미지 다운로드 후 업로드
        const imageBuffer = await downloadImage(imageUrl);

        // 파일 업로드 input 찾기
        const fileInput = await page.$('input[type="file"]');
        if (!fileInput) {
            return { success: false, error: '파일 업로드 버튼을 찾을 수 없음' };
        }

        // 임시 파일로 저장 후 업로드
        const tempPath = path.join(os.tmpdir(), `grok_upload_${Date.now()}.png`);
        fs.writeFileSync(tempPath, imageBuffer);
        await fileInput.uploadFile(tempPath);
        fs.unlinkSync(tempPath);

        // 프롬프트 입력
        const promptInput = await page.$('textarea, input[type="text"]');
        if (promptInput) {
            await promptInput.type(prompt, { delay: 50 });
        }

        // 생성 버튼 클릭
        const generateButton = await page.$('button[type="submit"], button:has-text("Generate")');
        if (generateButton) {
            await generateButton.click();
        }

        // 영상 생성 완료 대기 (최대 5분)
        const videoUrl = await waitForVideoGeneration(page, 300000);

        if (videoUrl) {
            return { success: true, videoUrl };
        } else {
            return { success: false, error: '영상 생성 시간 초과' };
        }

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * 영상 생성 완료 대기
 */
async function waitForVideoGeneration(page: Page, timeoutMs: number): Promise<string | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        // 영상 요소 찾기 (Grok 페이지 구조에 맞게 수정 필요)
        const videoElement = await page.$('video source, video[src], a[href*=".mp4"]');

        if (videoElement) {
            const videoUrl = await page.evaluate(el => {
                if (el.tagName === 'VIDEO') return el.getAttribute('src');
                if (el.tagName === 'SOURCE') return el.getAttribute('src');
                if (el.tagName === 'A') return el.getAttribute('href');
                return null;
            }, videoElement);

            if (videoUrl) return videoUrl;
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    return null;
}

/**
 * URL에서 이미지 다운로드
 */
async function downloadImage(url: string): Promise<Buffer> {
    // Base64 데이터 URL인 경우
    if (url.startsWith('data:image')) {
        const base64Data = url.split(',')[1];
        return Buffer.from(base64Data, 'base64');
    }

    // HTTP URL인 경우
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * 세션 종료
 */
export async function closeGrokSession(session: GrokSession): Promise<void> {
    try {
        await session.browser.close();
    } catch (error) {
        console.error('브라우저 종료 오류:', error);
    }
}

/**
 * 간단 테스트 함수
 */
export async function testGrokConnection(): Promise<{ success: boolean; message: string }> {
    try {
        const session = await startGrokSession('test');

        if (!session.isLoggedIn) {
            // 로그인 대기
            const loggedIn = await waitForManualLogin(session, 60000);
            if (!loggedIn) {
                await closeGrokSession(session);
                return { success: false, message: '로그인 필요' };
            }
        }

        await closeGrokSession(session);
        return { success: true, message: 'Grok 연결 성공' };

    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
