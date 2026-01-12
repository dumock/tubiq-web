/**
 * GrokBrowserProvider - 브라우저 자동화를 통한 Grok 생성
 * 
 * 무료로 사용 가능, 브라우저 UI 자동화 방식
 */

const BaseProvider = require('./BaseProvider');
const GrokBrowser = require('../GrokBrowser');
const actions = require('../GrokActions');
const SELECTORS = require('../GrokSelectors');

class GrokBrowserProvider extends BaseProvider {
    constructor() {
        super('grok-browser');
        this.browser = new GrokBrowser();
    }

    /**
     * 이미지 생성
     */
    async generateImage(prompt) {
        console.error(`[GrokBrowserProvider] Generating image: ${prompt.substring(0, 50)}...`);

        try {
            // 1. 페이지 준비
            const page = await this.browser.navigateToImagine();

            // 2. 로그인 확인
            if (!await this.browser.isLoggedIn()) {
                console.error('[GrokBrowserProvider] Not logged in, waiting...');
                const loggedIn = await this.browser.waitForLogin(60000);
                if (!loggedIn) {
                    return { success: false, error: 'Login required' };
                }
            }

            // 3. UI 정리
            await actions.clearModals(page);

            // 3.5. 이미지 모드 전환 (상태 오염 방지)
            const switched = await actions.switchToImageMode(page);
            if (!switched) {
                console.error('[GrokBrowserProvider] CRITICAL: Failed to switch to Image mode. Aborting.');
                return { success: false, error: 'Failed to switch to Image mode. Please check if Grok is in a valid state.' };
            }

            // 4. 프롬프트 입력
            const entered = await actions.enterPrompt(page, prompt);
            if (!entered) {
                return { success: false, error: 'Failed to enter prompt' };
            }

            // 5. Enter로 제출
            console.log('[GrokBrowserProvider] Pressing Enter to generate...');
            await page.keyboard.press('Enter');
            await actions.delay(2000);

            // (버튼 클릭은 Enter가 실패했을 때를 대비한 것이었으나, 오동작 원인이 되므로 제거하거나 조건부로 변경)
            // 화면에 "Generating"이나 "생성 중" 표시가 있는지 확인 후 필요하면 클릭?
            // 일단은 삭제하여 파일 열기 창 이슈 원천 차단.

            // 6. 결과 대기 (단순화 - Gemini 검증 제거)
            const result = await actions.waitForImages(page);

            return result;

        } catch (error) {
            console.error('[GrokBrowserProvider] Error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 비디오 생성
     */
    async generateVideo(imagePath, prompt) {
        console.error(`[GrokBrowserProvider] Generating video from: ${imagePath}`);

        try {
            // 1. 페이지 준비
            const page = await this.browser.navigateToImagine();

            // 2. 로그인 확인
            if (!await this.browser.isLoggedIn()) {
                const loggedIn = await this.browser.waitForLogin(60000);
                if (!loggedIn) {
                    return { success: false, error: 'Login required' };
                }
            }

            // 3. UI 정리
            await actions.clearModals(page);

            // 4. 비디오 모드 전환
            const switched = await actions.switchToVideoMode(page);
            if (!switched) {
                throw new Error('Failed to switch to Video mode - Aborting generation');
            }

            // 5. 이미지 업로드
            await actions.uploadImage(page, imagePath);

            // 6. 프롬프트 입력
            if (prompt) {
                await actions.enterPrompt(page, prompt);
            }

            // 7. Make Video 버튼 클릭
            await actions.delay(2000); // 버튼 활성화 대기
            const clicked = await actions.clickButton(page, SELECTORS.MAKE_VIDEO_BTN);

            if (!clicked) {
                // Enter 키로 폴백
                await page.keyboard.press('Enter');
            }

            // 8. 결과 대기
            const result = await actions.waitForVideo(page);

            return result;

        } catch (error) {
            console.error('[GrokBrowserProvider] Error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 제미나이 AI를 이용한 이미지 품질 검증
     */
    async auditImageWithGemini(page, imageUrl, apiKey) {
        try {
            // 1. 이미지 Base64 추출 (브라우저 컨텍스트)
            const base64Data = await page.evaluate(async (url) => {
                const response = await fetch(url);
                const blob = await response.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                    reader.readAsDataURL(blob);
                });
            }, imageUrl);

            // 2. 제미나이 API 호출 (2.0 Flash는 Vision 기본 지원)
            const prompt = "Is this image a high-quality, fully rendered and detailed final generation? If it is a blurred placeholder, pixelated draft, or suggests it is still loading, answer 'NO'. If it is a clear, sharp, and finished image, answer 'YES'. Provide ONLY 'YES' or 'NO' followed by a short reason.";

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                { inline_data: { mime_type: "image/png", data: base64Data } }
                            ]
                        }]
                    }),
                }
            );

            if (!response.ok) {
                const errText = await response.text();
                console.error('[GrokBrowserProvider] Gemini API Error:', errText);
                return { passed: true }; // API 오류 시에는 일단 넘어감 (안정성)
            }

            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const passed = text.toUpperCase().includes('YES');

            return {
                passed,
                reason: text
            };

        } catch (e) {
            console.error('[GrokBrowserProvider] Gemini Audit Error:', e.message);
            return { passed: true }; // 에러 시 통과 (서비스 중단 방지)
        }
    }

    /**
     * 정리
     */
    async cleanup() {
        await this.browser.close();
    }
}

module.exports = GrokBrowserProvider;
