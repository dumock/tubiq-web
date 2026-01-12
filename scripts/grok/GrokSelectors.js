/**
 * Grok Selectors - 모든 CSS 셀렉터 중앙 관리
 * Grok UI 변경 시 여기만 수정하면 됨
 */

module.exports = {
    // === 입력 필드 ===
    PROMPT_INPUT: 'textarea:not([placeholder*="Search"]):not([placeholder*="검색"])',

    // === 버튼들 ===
    CREATE_IMAGE_BTN: {
        // 우선순위 순서대로
        selectors: [
            'button[aria-label="Create image"]',
            'button[aria-label="Create Image"]',
            'button[aria-label="Send"]',
        ],
        textMatch: ['create image', 'generate', '이미지 생성', '생성'],
        excludeText: ['search', '검색'],
        minLeft: 400  // 사이드바 제외
    },

    MAKE_VIDEO_BTN: {
        selectors: [
            'button[aria-label="Make video"]',
            'button[aria-label="Create video"]',
        ],
        textMatch: ['make video', 'create video', '동영상 만들기', '비디오 생성'],
        excludeText: ['search', '검색'],
        minLeft: 400
    },

    DOWNLOAD_BTN: {
        selectors: [
            'button:has(svg.lucide-download)',
            'button[aria-label*="Download"]',
            'button[aria-label*="download"]',
        ],
        textMatch: ['download', '다운로드'],
        excludeText: ['search', '검색', 'chat', 'voice', 'imagine', 'projects', 'history'],
        minLeft: 500  // 더 엄격한 사이드바 제외
    },

    SKIP_BTN: {
        textMatch: ['skip', '스킵', '건너뛰기'],
        minLeft: 400
    },

    // === 모드 선택 (드롭다운) ===
    MODEL_DROPDOWN: {
        selectors: [
            // "Image" 또는 "Video" 텍스트와 화살표가 있는 버튼
            'button[aria-haspopup="menu"]',
            // textMatch가 있으므로 포괄적인 셀렉터 사용 후 필터링
        ],
        textMatch: ['image', 'video', '이미지', '비디오', '영상'],
        excludeText: ['create', 'make', 'generate', 'search', 'profile', 'upload', 'attach'], // 생성, 검색, 업로드 제외
        minLeft: 400 // 사이드바 제외 (입력창 근처)
    },

    VIDEO_OPTION: {
        textMatch: ['video', '비디오', '영상'],
        excludeText: ['make video', 'create video']
    },

    IMAGE_OPTION: {
        textMatch: ['image', '이미지'],
        excludeText: ['create image']
    },

    // === 상태 확인 ===
    LOGIN_INDICATORS: {
        loggedIn: ['SuperGrok', 'textarea', '[data-testid="user-menu"]', 'img[alt="Profile"]'],
        loggedOut: ['Sign in', 'Log in', 'login']
    },

    // === 모달/오버레이 ===
    MODAL: 'div[role="dialog"]',
    MODAL_CLOSE: 'button[aria-label="Close"], button[aria-label="닫기"]',

    // === 이미지 ===
    GENERATED_IMAGE: {
        selector: 'img',
        minWidth: 600,
        minHeight: 600,
        excludeSrc: ['avatar', 'profile', 'icon', 'logo']
    },

    // === 파일 업로드 ===
    FILE_INPUT: 'input[type="file"]',

    // === 상태 확인 ===
    GENERATING_INDICATOR: {
        textMatch: ['generating', 'creating', '생성 중', '만드는 중'],
        selector: 'div, span, p'
    },

    // === URL ===
    GROK_IMAGINE_URL: 'https://grok.com/imagine'
};
