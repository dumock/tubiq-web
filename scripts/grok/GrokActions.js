/**
 * GrokActions - 공통 브라우저 액션들
 * 
 * 각 액션은 독립적이고 재사용 가능
 */

const SELECTORS = require('./GrokSelectors');
const fs = require('fs');
const path = require('path');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 모든 모달/오버레이 닫기
 */
async function clearModals(page) {
    console.error('[Actions] Clearing modals...');

    // Escape 키로 모달 닫기
    await page.keyboard.press('Escape');
    await delay(300);

    // 명시적 닫기 버튼 클릭
    await page.evaluate((sel) => {
        const closeButtons = document.querySelectorAll(sel);
        closeButtons.forEach(btn => {
            try { btn.click(); } catch (e) { }
        });
    }, SELECTORS.MODAL_CLOSE);

    await delay(500);
}

/**
 * 정밀 버튼 클릭
 * @param {Page} page - Puppeteer page
 * @param {Object} buttonConfig - SELECTORS에서 가져온 버튼 설정
 * @returns {boolean} 클릭 성공 여부
 */
async function clickButton(page, buttonConfig) {
    console.error('[Actions] Clicking button...');

    // 1. 정확한 셀렉터로 먼저 시도
    // 1. 정확한 셀렉터로 먼저 시도
    if (buttonConfig.selectors) {
        for (const selector of buttonConfig.selectors) {
            const clicked = await page.evaluate((sel, config) => {
                const buttons = document.querySelectorAll(sel);
                for (const btn of buttons) {
                    if (btn.disabled) continue;

                    // 1. 위치 검증
                    const rect = btn.getBoundingClientRect();
                    if (rect.left < (config.minLeft || 0)) continue;
                    if (rect.width <= 0) continue;

                    // 2. 텍스트 검증 (config에 조건이 있을 때만)
                    const text = (btn.innerText || btn.getAttribute('aria-label') || '').toLowerCase().trim();

                    if (config.excludeText) {
                        if (config.excludeText.some(ex => text.includes(ex.toLowerCase()))) continue;
                    }

                    if (config.textMatch) {
                        const matches = config.textMatch.some(match => text.includes(match.toLowerCase()));
                        if (!matches) continue;
                    }

                    console.log(`[Actions] Found by selector & text: ${sel} ("${text}")`);
                    btn.click();
                    return true;
                }
                return false;
            }, selector, buttonConfig);

            if (clicked) {
                console.error(`[Actions] Clicked via selector: ${selector}`);
                return true;
            }
        }
    }

    // 2. 텍스트 매칭으로 폴백
    if (buttonConfig.textMatch) {
        const clicked = await page.evaluate((config) => {
            const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));

            for (const btn of buttons) {
                if (btn.disabled) continue;

                const rect = btn.getBoundingClientRect();
                const text = (btn.innerText || '').toLowerCase().trim();

                // 위치 검증
                if (rect.left < (config.minLeft || 0)) continue;
                if (rect.width <= 0 || rect.height <= 0) continue;

                // 사이드바 제외
                if (btn.closest('nav') || btn.closest('aside')) continue;

                // 제외 텍스트 확인
                if (config.excludeText) {
                    const hasExclude = config.excludeText.some(ex => text.includes(ex.toLowerCase()));
                    if (hasExclude) continue;
                }

                // 매칭 텍스트 확인
                const matches = config.textMatch.some(match => text.includes(match.toLowerCase()));
                if (matches) {
                    console.log(`[Actions] Found by text: "${text}"`);
                    btn.click();
                    return true;
                }
            }
            return false;
        }, buttonConfig);

        if (clicked) {
            console.error('[Actions] Clicked via text match');
            return true;
        }
    }

    console.error('[Actions] Button not found');
    return false;
}

/**
 * 프롬프트 입력
 */
async function enterPrompt(page, text) {
    console.error('[Actions] Entering prompt...');

    // 입력 필드 찾기 - 여러 전략 사용
    const inputFound = await page.evaluate(() => {
        // 전략 1: textarea (가장 일반적)
        let candidates = Array.from(document.querySelectorAll('textarea'));

        // 전략 2: contenteditable div
        if (candidates.length === 0) {
            candidates = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
        }

        // 전략 3: text input
        if (candidates.length === 0) {
            candidates = Array.from(document.querySelectorAll('input[type="text"]'));
        }

        // 검색창 제외
        candidates = candidates.filter(el => {
            const placeholder = (el.placeholder || el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').toLowerCase();
            const isSearch = placeholder.includes('search') || placeholder.includes('검색');

            // 크기 체크 - 너무 작은 건 제외
            const rect = el.getBoundingClientRect();
            if (rect.width < 100 || rect.height < 20) return false;

            // 사이드바 제외
            if (rect.left < 300) return false;

            return !isSearch;
        });

        // 가장 아래쪽 입력 필드 사용 (보통 메인 입력)
        candidates.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
        const target = candidates[0];

        if (target) {
            console.log('[Actions] Found input:', target.tagName, 'at', target.getBoundingClientRect().left);
            target.focus();
            target.click();
            return true;
        }

        console.log('[Actions] No input found, candidates count:', candidates.length);
        return false;
    });

    if (!inputFound) {
        console.error('[Actions] Input not found! Trying direct click on textarea...');

        // 최후의 수단: 그냥 textarea 클릭
        try {
            await page.click('textarea');
            await delay(500);
        } catch (e) {
            console.error('[Actions] Direct click failed:', e.message);
            return false;
        }
    }

    await delay(300);

    // 기존 내용 지우기
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await delay(200);

    // 새 텍스트 입력 (초고속 타이핑)
    await page.keyboard.type(text, { delay: 0 });
    await delay(300);

    console.error('[Actions] Prompt entered');
    return true;
}

/**
 * 비디오 모드로 전환
 */
async function switchToVideoMode(page) {
    console.error('[Actions] Switching to Video mode (Surgical & Verified)...');

    // 0. 혹시 모를 팝업 닫기 (Escape)
    await page.keyboard.press('Escape');
    await delay(500);

    // 1. 드롭다운 버튼 찾기 (좌표 기반)
    const getDropdownCoords = async () => {
        return await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const target = buttons.find(b => {
                const rect = b.getBoundingClientRect();
                if (rect.left < 400) return false; // 사이드바 제외 (중요!)

                const text = b.innerText.trim().toLowerCase();
                const isModeBtn = text.includes('video') || text.includes('image') ||
                    text.includes('비디오') || text.includes('이미지') ||
                    text.includes('영상');
                const hasChevron = b.querySelector('svg[class*="chevron"]') || b.querySelector('svg[class*="Chevron"]');
                const isUpload = b.querySelector('svg[class*="paperclip"]') || b.querySelector('svg[class*="attachment"]') || text.includes('upload');

                return isModeBtn && (hasChevron || b.getAttribute('aria-haspopup') === 'menu') && !isUpload;
            });
            if (!target) return null;
            const r = target.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: target.innerText };
        });
    };

    let btnCoords = await getDropdownCoords();
    if (!btnCoords) {
        console.error('[Actions] Dropdown button not found (Surgical)');
        return false;
    }

    console.log(`[Actions] Clicking dropdown at (${btnCoords.x}, ${btnCoords.y})`);
    await page.mouse.click(btnCoords.x, btnCoords.y);

    // 2. 메뉴 대기 (2초)
    await delay(2000);

    // 3. 비디오 옵션 선택 (텍스트 + 설명 조합) - 좌표 기반
    const optionCoords = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], div, button, span'));
        const target = items.find(el => {
            const t = el.innerText.toLowerCase();
            return t.includes('video') && t.includes('generate a video');
        });
        if (!target) return null;
        const r = target.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    if (optionCoords) {
        console.log(`[Actions] Clicking Video option at (${optionCoords.x}, ${optionCoords.y})`);
        await page.mouse.click(optionCoords.x, optionCoords.y);
    } else {
        console.error('[Actions] Detailed video option not found, trying fallback click');
        const fallback = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, [role="menuitem"]'));
            const target = btns.find(b => b.innerText.toLowerCase().includes('video') && !b.innerText.toLowerCase().includes('image'));
            if (target) { target.click(); return true; }
            return false;
        });
        if (!fallback) return false;
    }

    await delay(1500);

    // 4. 모드 변경 검증
    const currentBtn = await getDropdownCoords();
    const confirmed = currentBtn && (currentBtn.text.toLowerCase().includes('video') || currentBtn.text.includes('비디오') || currentBtn.text.includes('영상'));

    if (!confirmed) {
        console.error('[Actions] FAILED to confirm Video mode change. Text is:', currentBtn ? currentBtn.text : 'null');
        return false;
    }

    // 바깥 클릭하여 닫기
    await page.mouse.click(10, 10);
    return true;
}

/**
 * 이미지 모드로 전환
 */
async function switchToImageMode(page) {
    console.error('[Actions] Switching to Image mode (Surgical & Verified)...');

    // 0. 팝업 정리
    await page.keyboard.press('Escape');
    await delay(500);

    // 1. 드롭다운 버튼 찾기 (좌표 기반)
    const getDropdownCoords = async () => {
        return await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const target = buttons.find(b => {
                const rect = b.getBoundingClientRect();
                if (rect.left < 400) return false; // 사이드바 제외 (중요!)

                const text = b.innerText.trim().toLowerCase();
                const isModeBtn = text.includes('video') || text.includes('image') ||
                    text.includes('비디오') || text.includes('이미지') ||
                    text.includes('영상');
                const hasChevron = b.querySelector('svg[class*="chevron"]') || b.querySelector('svg[class*="Chevron"]');
                const isUpload = b.querySelector('svg[class*="paperclip"]') || b.querySelector('svg[class*="attachment"]') || text.includes('upload');

                return isModeBtn && (hasChevron || b.getAttribute('aria-haspopup') === 'menu') && !isUpload;
            });

            if (!target) return null;
            const r = target.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: target.innerText };
        });
    };

    let btnCoords = await getDropdownCoords();
    if (!btnCoords) {
        console.error('[Actions] Mode dropdown button not found');
        return false;
    }

    // ★ 이미 이미지 모드인 경우 바로 성공 반환 (불필요한 재전환 방지)
    const isAlreadyImage = btnCoords.text.toLowerCase().includes('image') || btnCoords.text.includes('이미지');
    if (isAlreadyImage) {
        console.log('[Actions] Already in Image mode, skipping switch.');
        return true;
    }

    console.log(`[Actions] Clicking dropdown at (${btnCoords.x}, ${btnCoords.y})`);
    await page.mouse.click(btnCoords.x, btnCoords.y);

    // 2. 대기 (2초)
    await delay(2000);

    // 3. 이미지 모드 선택 (사용자가 준 HTML 구조 기반으로 정밀 타겟팅)
    const optionCoords = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
        const target = items.find(el => {
            const spans = Array.from(el.querySelectorAll('span'));
            const hasImage = spans.some(s => s.innerText.trim() === 'Image');
            const hasDesc = spans.some(s => s.innerText.trim() === 'Generate multiple images');
            return hasImage && hasDesc;
        });

        if (!target) {
            // Fallback: 텍스트 직접 검색
            const allElements = Array.from(document.querySelectorAll('div, button, span'));
            const fallback = allElements.find(el => el.innerText.includes('Image') && el.innerText.includes('Generate multiple images'));
            if (fallback) {
                const r = fallback.getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }
            return null;
        }

        const r = target.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    if (optionCoords) {
        console.log(`[Actions] Clicking Image option at (${optionCoords.x}, ${optionCoords.y})`);
        await page.mouse.click(optionCoords.x, optionCoords.y);
        // 강제 클릭 실드 (JS 레벨에서도 한 번 더 클릭)
        await page.evaluate((x, y) => {
            const el = document.elementFromPoint(x, y);
            if (el) el.click();
        }, optionCoords.x, optionCoords.y);
    } else {
        console.error('[Actions] Strict Image option coordinates not found, trying fallback click');
        const fallbackClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, [role="menuitem"]'));
            const target = btns.find(b => b.innerText.toLowerCase().includes('image') && !b.innerText.toLowerCase().includes('video'));
            if (target) { target.click(); return true; }
            return false;
        });
        if (!fallbackClicked) return false;
    }

    await delay(1500); // 모드 변경 전환 대기

    // 4. 모드 변경 검증 (매우 중요!)
    const currentBtn = await getDropdownCoords();
    const confirmed = currentBtn && (currentBtn.text.toLowerCase().includes('image') || currentBtn.text.includes('이미지'));

    if (!confirmed) {
        console.error('[Actions] FAILED to confirm Image mode change. Text is:', currentBtn ? currentBtn.text : 'null');
        return false;
    }

    console.log('[Actions] Image mode confirmed. Proceeding to Aspect Ratio...');

    // 5. Aspect Ratio (9:16) 설정
    // 메뉴가 닫혔으므로 다시 열어야 함
    const reBtnCoords = await getDropdownCoords();
    if (reBtnCoords) {
        await page.mouse.click(reBtnCoords.x, reBtnCoords.y);
        await delay(1000);

        const ratioSet = await page.evaluate(() => {
            const labels = Array.from(document.querySelectorAll('span, div, p, h3, h4'));
            const aspectLabel = labels.find(el => el.innerText.trim() === 'Aspect Ratio');
            if (aspectLabel) {
                const container = aspectLabel.closest('div').parentElement || document.body;
                const buttons = Array.from(container.querySelectorAll('button:not(:empty), button:has(svg)'));
                const ratioButtons = buttons.filter(btn => {
                    const text = btn.innerText.trim();
                    return (text === '') && btn.querySelector('svg');
                });
                if (ratioButtons.length >= 1) {
                    ratioButtons[0].click();
                    return true;
                }
            }
            return false;
        });
        console.log(`[Actions] Aspect Ratio set: ${ratioSet}`);
    }

    // 바깥 클릭하여 닫기
    await page.mouse.click(10, 10);
    await delay(500);

    return true;
}
/**
 * 이미지 업로드 (Hidden Input 직접 업로드)
 */
async function uploadImage(page, imagePath) {
    console.error('[Actions] Uploading image:', imagePath);

    if (!fs.existsSync(imagePath)) {
        throw new Error(`Image not found: ${imagePath}`);
    }

    // 방법 1: 기존 hidden file input 찾아서 직접 업로드
    const fileInput = await page.$('input[type="file"]');

    if (fileInput) {
        console.log('[Actions] Found existing file input, uploading directly...');
        await fileInput.uploadFile(imagePath);
        await delay(3000);

        // 업로드 확인 (이미지 미리보기가 나타났는지)
        const hasPreview = await page.evaluate(() => {
            // 입력창 근처에 이미지 썸네일이 나타났는지 확인
            const preview = document.querySelector('img[src*="blob:"]') ||
                document.querySelector('img[alt*="uploaded"]') ||
                document.querySelector('[data-testid*="preview"]');
            return !!preview;
        });

        if (hasPreview) {
            console.error('[Actions] Image uploaded successfully via hidden input');
            return true;
        }
        console.log('[Actions] Hidden input upload may have failed, trying fallback...');
    }

    // 방법 2: 새 input 생성 + Drag & Drop
    console.log('[Actions] Trying Drag & Drop method...');

    const inputHandle = await page.evaluateHandle(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        return input;
    });

    await inputHandle.uploadFile(imagePath);

    // textarea 또는 메인 입력 영역을 타겟으로 Drop
    const dropped = await page.evaluate((input) => {
        const file = input.files[0];
        if (!file) return false;

        // 여러 드롭존 후보 시도
        const dropTargets = [
            document.querySelector('textarea'),
            document.querySelector('[contenteditable="true"]'),
            document.querySelector('form'),
            document.querySelector('main'),
            document.body
        ].filter(Boolean);

        for (const dropZone of dropTargets) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            ['dragenter', 'dragover', 'drop'].forEach(type => {
                const event = new DragEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer: dataTransfer
                });
                dropZone.dispatchEvent(event);
            });
        }
        return true;
    }, inputHandle);

    await delay(3000);

    if (dropped) {
        console.error('[Actions] Image uploaded via Drag & Drop');
        return true;
    }

    throw new Error('All image upload methods failed');
}

/**
 * 이미지 생성 완료 대기 및 추출
 * 고해상도 이미지만 캡처하도록 엄격한 검증
 */
async function waitForImages(page, timeoutMs = 180000) {
    console.error('[Actions] Waiting for images (Click-to-Modal Mode)...');

    const startTime = Date.now();
    const MIN_WIDTH = 300;  // 목록에서는 작은 썸네일도 허용 (어차피 클릭해서 확인)
    const MIN_HEIGHT = 300;
    const config = SELECTORS.GENERATED_IMAGE;

    // 1. 초기 대기 (2초) - 첫 이미지 나올 시간
    await delay(2000);

    while (Date.now() - startTime < timeoutMs) {
        await delay(1500);

        // 2. 화면에서 클릭 가능한 첫 번째 이미지 찾기
        const firstImage = await page.evaluate((cfg, minW, minH) => {
            const images = Array.from(document.querySelectorAll('img'));

            for (const img of images) {
                if (!img.complete) continue;
                if (img.naturalWidth < minW || img.naturalHeight < minH) continue;

                const src = img.src || '';
                if (cfg.excludeSrc.some(ex => src.includes(ex))) continue;
                if (src.includes('avatar') || src.includes('profile') || src.includes('icon')) continue;

                const rect = img.getBoundingClientRect();
                if (rect.width < 100 || rect.height < 100) continue;

                // 첫 번째 유효한 이미지 반환 (클릭 대상)
                return {
                    found: true,
                    src: src,
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                };
            }
            return { found: false, imageCount: images.length };
        }, config, MIN_WIDTH, MIN_HEIGHT);

        if (firstImage.found) {
            console.error(`[Actions] Found clickable image, clicking at (${firstImage.x}, ${firstImage.y})...`);

            // 3. 이미지 클릭 (좌표 기반 - 확실한 클릭)
            await page.mouse.click(firstImage.x, firstImage.y);
            await delay(2000); // 모달 열릴 시간

            // 4. 모달에서 고해상도 이미지 추출
            const highResResult = await page.evaluate(() => {
                const modal = document.querySelector('[role="dialog"], .modal, [data-state="open"]');
                const container = modal || document;
                const images = Array.from(container.querySelectorAll('img'));
                let best = null;
                let bestArea = 0;

                for (const img of images) {
                    if (!img.complete) continue;
                    // 모달에서는 500px 이상이면 통과 (썸네일 탈출)
                    if (img.naturalWidth < 500 || img.naturalHeight < 500) continue;

                    const src = img.src || '';
                    if (src.includes('avatar') || src.includes('profile') || src.includes('icon') || src.includes('emoji')) continue;

                    const area = img.naturalWidth * img.naturalHeight;
                    if (area > bestArea) {
                        bestArea = area;
                        best = { src: src, width: img.naturalWidth, height: img.naturalHeight };
                    }
                }
                return best;
            });

            if (highResResult) {
                console.error(`[Actions] Got high-res from modal: ${highResResult.width}x${highResResult.height}`);

                // Escape로 모달 닫기
                await page.keyboard.press('Escape');
                await delay(500);

                return {
                    success: true,
                    imageUrls: [highResResult.src],
                    selectedImageUrl: highResResult.src
                };
            } else {
                // 모달에서 못 찾으면 원래 이미지 사용 (폴백)
                console.error('[Actions] Modal extraction failed, using original');
                await page.keyboard.press('Escape');
                await delay(500);

                return {
                    success: true,
                    imageUrls: [firstImage.src],
                    selectedImageUrl: firstImage.src
                };
            }
        } else {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            console.error(`[Actions] No valid image yet (${firstImage.imageCount} images, ${elapsed}s elapsed)`);
        }
    }

    return { success: false, error: 'Image generation timeout' };
}

/**
 * 비디오 생성 완료 대기 및 다운로드
 */
async function waitForVideo(page, timeoutMs = 180000) {
    console.error('[Actions] Waiting for video...');

    const startTime = Date.now();
    let capturedBuffer = null;

    // 응답 감시 설정
    const responseHandler = async (response) => {
        const url = response.url();
        const contentType = (response.headers()['content-type'] || '').toLowerCase();

        if (contentType.includes('video/') || url.includes('.mp4')) {
            try {
                const buffer = await response.buffer();
                if (buffer.length > 2 * 1024 * 1024) { // 2MB 이상
                    console.error(`[Actions] Captured video: ${buffer.length} bytes`);
                    capturedBuffer = buffer;
                }
            } catch (e) { }
        }
    };

    page.on('response', responseHandler);

    try {
        while (Date.now() - startTime < timeoutMs) {
            await delay(2000);

            // 0. 검색 모달이 열렸으면 닫기
            const hasSearchModal = await page.evaluate(() => {
                const modal = document.querySelector('div[role="dialog"]');
                if (modal) {
                    const text = modal.innerText || '';
                    if (text.includes('Search') || text.includes('검색') || text.includes('History is empty')) {
                        return true;
                    }
                }
                return false;
            });

            if (hasSearchModal) {
                console.error('[Actions] Search modal detected, closing...');
                await page.keyboard.press('Escape');
                await delay(500);
                continue;
            }

            // 1. Skip 버튼 처리
            const hasSkip = await page.evaluate((cfg) => {
                const bodyText = document.body.innerText;
                if (bodyText.includes('Which video do you prefer')) {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const skipBtn = buttons.find(b => {
                        const t = b.innerText.trim().toLowerCase();
                        const rect = b.getBoundingClientRect();
                        if (rect.left < 500) return false; // 사이드바 제외
                        return cfg.textMatch.some(m => t === m.toLowerCase());
                    });
                    if (skipBtn) {
                        skipBtn.click();
                        return true;
                    }
                }
                return false;
            }, SELECTORS.SKIP_BTN);

            if (hasSkip) {
                console.error('[Actions] Clicked Skip button');
                continue;
            }

            // 2. 영상 생성 중인지 확인 (Generating 텍스트가 있으면 대기)
            const isStillGenerating = await page.evaluate(() => {
                const bodyText = document.body.innerText.toLowerCase();
                return bodyText.includes('generating') ||
                    bodyText.includes('생성 중') ||
                    bodyText.includes('processing');
            });

            if (isStillGenerating) {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                console.log(`[Actions] Video still generating... (${elapsed}s elapsed)`);
                continue; // 아직 생성 중이면 다운로드 시도 안 함
            }

            // 3. 다운로드 버튼 찾기
            // 이미 다운로드 클릭했으면 대기만 함 (스팸 방지)
            const downloadResult = await page.evaluate(() => {
                // 방법 1: lucide-download SVG 직접 찾기
                const allButtons = Array.from(document.querySelectorAll('button'));

                for (const btn of allButtons) {
                    const rect = btn.getBoundingClientRect();

                    // 사이드바 제외 (x < 500)
                    if (rect.left < 500) continue;
                    if (rect.width <= 0 || rect.height <= 0) continue;

                    // 사이드바 요소 제외
                    if (btn.closest('nav') || btn.closest('aside')) continue;

                    // SVG 확인
                    const svg = btn.querySelector('svg');
                    let isDownload = false;

                    if (svg) {
                        const classAttr = svg.getAttribute('class') || '';
                        if (classAttr.includes('lucide-download') || classAttr.includes('download')) {
                            isDownload = true;
                        }
                    }

                    // aria-label 확인
                    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                    if (ariaLabel.includes('download') && !ariaLabel.includes('search')) {
                        isDownload = true;
                    }

                    if (isDownload) {
                        console.log(`[Actions] Found download button at (${rect.left}, ${rect.top})`);
                        btn.click();
                        return { clicked: true };
                    }
                }
                return { clicked: false };
            });

            if (downloadResult.clicked) {
                console.error(`[Actions] Download button clicked. Waiting for file capture...`);
                // 클릭 후 충분히 대기 (5초 -> 10초)
                // 만약 10초 내에 캡처 안되면 다시 루프 돌면서 재클릭 시도
                const captureStart = Date.now();
                while (Date.now() - captureStart < 10000) {
                    if (capturedBuffer) {
                        break;
                    }
                    await delay(500);
                }

                if (capturedBuffer) {
                    const tmpPath = path.join(process.cwd(), 'tmp', `grok_video_${Date.now()}.mp4`);
                    fs.writeFileSync(tmpPath, capturedBuffer);
                    console.error(`[Actions] Video saved: ${tmpPath}`);
                    return { success: true, videoPath: tmpPath };
                } else {
                    console.error(`[Actions] No file captured yet, might retry...`);
                }
            }
        }
    } finally {
        page.off('response', responseHandler);
    }

    return { success: false, error: 'Video generation timeout' };
}

/**
 * 이미지 데이터 Base64 추출
 */
async function extractImageData(page) {
    return await page.evaluate(() => {
        // 모달 내 고해상도 이미지 우선
        const modal = document.querySelector('[role="dialog"], .modal');
        const container = modal || document;

        const images = Array.from(container.querySelectorAll('img'));
        const target = images.find(img =>
            img.naturalWidth > 800 && img.complete &&
            !img.src.includes('avatar') && !img.src.includes('profile')
        );

        if (!target) return null;

        // Canvas로 추출
        try {
            const canvas = document.createElement('canvas');
            canvas.width = target.naturalWidth;
            canvas.height = target.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(target, 0, 0);
            return canvas.toDataURL('image/png');
        } catch (e) {
            return null;
        }
    });
}

module.exports = {
    clearModals,
    clickButton,
    enterPrompt,
    switchToVideoMode,
    switchToImageMode,
    uploadImage,
    waitForImages,
    waitForVideo,
    extractImageData,
    delay
};
