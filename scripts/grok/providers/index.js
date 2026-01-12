/**
 * Provider Factory - 설정에 따라 적절한 Provider 반환
 */

const GrokBrowserProvider = require('./GrokBrowserProvider');
const GrokAPIProvider = require('./GrokAPIProvider');
const GeminiAPIProvider = require('./GeminiAPIProvider');

/**
 * Provider 타입
 */
const ProviderType = {
    GROK_BROWSER: 'grok-browser',   // 무료, 브라우저 자동화
    GROK_API: 'grok-api',           // 유료, Grok API
    GEMINI_API: 'gemini-api',       // 유료, Google Gemini
};

/**
 * Provider 인스턴스 생성
 * @param {string} type - ProviderType
 * @param {Object} options - API 키 등 옵션
 */
function createProvider(type, options = {}) {
    switch (type) {
        case ProviderType.GROK_BROWSER:
            return new GrokBrowserProvider();

        case ProviderType.GROK_API:
            if (!options.apiKey) {
                console.warn('[ProviderFactory] No Grok API key, falling back to browser');
                return new GrokBrowserProvider();
            }
            return new GrokAPIProvider(options.apiKey);

        case ProviderType.GEMINI_API:
            if (!options.apiKey) {
                console.warn('[ProviderFactory] No Gemini API key, falling back to browser');
                return new GrokBrowserProvider();
            }
            return new GeminiAPIProvider(options.apiKey);

        default:
            console.warn(`[ProviderFactory] Unknown type: ${type}, using browser`);
            return new GrokBrowserProvider();
    }
}

/**
 * 환경변수에서 기본 Provider 생성
 */
function createDefaultProvider() {
    const useAPI = process.env.GROK_USE_API === 'true';
    const grokApiKey = process.env.GROK_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (useAPI && grokApiKey) {
        return createProvider(ProviderType.GROK_API, { apiKey: grokApiKey });
    }

    if (useAPI && geminiApiKey) {
        return createProvider(ProviderType.GEMINI_API, { apiKey: geminiApiKey });
    }

    // 기본: 브라우저 자동화 (무료)
    return createProvider(ProviderType.GROK_BROWSER);
}

module.exports = {
    ProviderType,
    createProvider,
    createDefaultProvider,
    GrokBrowserProvider,
    GrokAPIProvider,
    GeminiAPIProvider
};
