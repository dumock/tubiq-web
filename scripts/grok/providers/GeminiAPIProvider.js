/**
 * GeminiAPIProvider - Google Gemini (Nano Banana Pro)를 통한 이미지 생성 (미구현)
 * 
 * TODO: Gemini API 연결 시 구현
 * 유료, 고품질 이미지 생성 가능
 */

const BaseProvider = require('./BaseProvider');

class GeminiAPIProvider extends BaseProvider {
    constructor(apiKey) {
        super('gemini-api');
        this.apiKey = apiKey;
    }

    async generateImage(prompt) {
        // TODO: Gemini Nano Banana Pro API 연결 시 구현
        return {
            success: false,
            error: 'Gemini API not implemented yet. Use browser provider.'
        };
    }

    async generateVideo(imagePath, prompt) {
        // Gemini는 비디오 생성 미지원 (현재)
        return {
            success: false,
            error: 'Gemini does not support video generation. Use Grok provider.'
        };
    }
}

module.exports = GeminiAPIProvider;
