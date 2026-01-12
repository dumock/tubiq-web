/**
 * GrokAPIProvider - Grok API를 통한 생성 (미구현)
 * 
 * TODO: Grok API가 공개되면 구현
 * 유료, 빠른 생성 가능
 */

const BaseProvider = require('./BaseProvider');

class GrokAPIProvider extends BaseProvider {
    constructor(apiKey) {
        super('grok-api');
        this.apiKey = apiKey;
    }

    async generateImage(prompt) {
        // TODO: Grok API 연결 시 구현
        return {
            success: false,
            error: 'Grok API not implemented yet. Use browser provider.'
        };
    }

    async generateVideo(imagePath, prompt) {
        // TODO: Grok API 연결 시 구현
        return {
            success: false,
            error: 'Grok API not implemented yet. Use browser provider.'
        };
    }
}

module.exports = GrokAPIProvider;
