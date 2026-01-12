/**
 * BaseProvider - 이미지/비디오 생성 Provider 인터페이스
 * 
 * 모든 Provider는 이 인터페이스를 구현해야 함
 */

class BaseProvider {
    constructor(name) {
        this.name = name;
    }

    /**
     * 이미지 생성
     * @param {string} prompt - 생성 프롬프트
     * @returns {Promise<{success: boolean, imageUrls?: string[], selectedImageUrl?: string, error?: string}>}
     */
    async generateImage(prompt) {
        throw new Error('Not implemented');
    }

    /**
     * 비디오 생성
     * @param {string} imagePath - 소스 이미지 경로
     * @param {string} prompt - 모션 프롬프트
     * @returns {Promise<{success: boolean, videoPath?: string, videoUrl?: string, error?: string}>}
     */
    async generateVideo(imagePath, prompt) {
        throw new Error('Not implemented');
    }

    /**
     * 정리 (브라우저 닫기 등)
     */
    async cleanup() {
        // Override if needed
    }
}

module.exports = BaseProvider;
