/**
 * Grok Worker Daemon - 새로운 모듈화 버전
 * 
 * Supabase 큐에서 작업을 가져와서 처리
 * Provider 패턴으로 브라우저/API 모드 전환 가능
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { createDefaultProvider, ProviderType, createProvider } = require('./providers');

// === 환경 설정 ===
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET_NAME = 'videos';
const POLL_INTERVAL = 3000;
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5분

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[Worker] Error: Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// === Provider 관리 ===
let currentProvider = null;
let lastActiveTime = Date.now();

function getProvider() {
    if (!currentProvider) {
        currentProvider = createDefaultProvider();
        console.log(`[Worker] Created provider: ${currentProvider.name}`);
    }
    return currentProvider;
}

async function cleanupProvider() {
    if (currentProvider) {
        console.log('[Worker] Cleaning up provider...');
        await currentProvider.cleanup();
        currentProvider = null;
    }
}

// === Supabase 업로드 ===
async function uploadToSupabase(localPath, contentType = 'video/mp4') {
    try {
        const fileBuffer = fs.readFileSync(localPath);
        const fileName = `grok-generated/${Date.now()}_${path.basename(localPath)}`;

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, fileBuffer, { contentType, upsert: true });

        if (error) throw error;

        const { data: signedData, error: signedError } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(fileName, 60 * 60 * 24 * 30); // 30일

        if (signedError) throw signedError;
        return signedData.signedUrl;
    } catch (e) {
        console.error('[Worker] Upload failed:', e);
        return null;
    }
}

// === 이미지 다운로드 및 업로드 ===
async function downloadAndUploadImage(imageData) {
    try {
        let imageBuffer;
        let ext = 'png'; // 기본값 PNG

        // Base64 데이터인 경우
        if (imageData.startsWith('data:image/')) {
            console.log('[Worker] Processing Base64 image data...');

            // 포맷 추출 (data:image/png;base64, 또는 data:image/jpeg;base64,)
            const match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!match) {
                throw new Error('Invalid Base64 format');
            }

            const base64Data = match[2];
            imageBuffer = Buffer.from(base64Data, 'base64');

            console.log(`[Worker] Decoded Base64 image: ${imageBuffer.length} bytes, saving as PNG`);
        }
        // URL인 경우
        else if (imageData.startsWith('http')) {
            console.log('[Worker] Downloading image from URL:', imageData.substring(0, 100) + '...');

            const https = require('https');
            const http = require('http');
            const protocol = imageData.startsWith('https') ? https : http;

            imageBuffer = await new Promise((resolve, reject) => {
                const req = protocol.get(imageData, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://grok.com/'
                    }
                }, (res) => {
                    console.log(`[Worker] HTTP Status: ${res.statusCode}`);

                    // 리다이렉트 처리
                    if (res.statusCode === 301 || res.statusCode === 302) {
                        console.log('[Worker] Redirecting to:', res.headers.location);
                        protocol.get(res.headers.location, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Referer': 'https://grok.com/'
                            }
                        }, (res2) => {
                            const chunks = [];
                            res2.on('data', chunk => chunks.push(chunk));
                            res2.on('end', () => resolve(Buffer.concat(chunks)));
                            res2.on('error', reject);
                        }).on('error', reject);
                    }
                    // 성공
                    else if (res.statusCode === 200) {
                        const chunks = [];
                        res.on('data', chunk => chunks.push(chunk));
                        res.on('end', () => resolve(Buffer.concat(chunks)));
                        res.on('error', reject);
                    }
                    // 실패
                    else {
                        reject(new Error(`HTTP ${res.statusCode}: Failed to download image`));
                    }
                });

                req.on('error', reject);
                req.setTimeout(30000, () => {
                    req.destroy();
                    reject(new Error('Download timeout'));
                });
            });

            // PNG로 강제
            ext = 'png';
            console.log(`[Worker] Downloaded image: ${imageBuffer.length} bytes`);

            // 최소 크기 검증 (10KB 이상)
            if (imageBuffer.length < 10000) {
                throw new Error(`Image too small: ${imageBuffer.length} bytes`);
            }
        } else {
            throw new Error('Unknown image data format');
        }

        // Supabase에 업로드
        const fileName = `grok-images/${Date.now()}_main.${ext}`;

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, imageBuffer, {
                contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
                upsert: true
            });

        if (error) {
            console.error('[Worker] Upload error:', error);
            throw error;
        }

        // Signed URL 생성 (30일 유효 - 버킷이 public이 아니므로)
        const { data: signedData, error: signedError } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(fileName, 60 * 60 * 24 * 30); // 30일

        if (signedError) {
            console.error('[Worker] Signed URL error:', signedError);
            throw signedError;
        }

        console.log('[Worker] Uploaded image:', signedData.signedUrl);
        return signedData.signedUrl;

    } catch (e) {
        console.error('[Worker] Download/Upload failed:', e.message);
        return null;
    }
}

// === 작업 처리 ===
async function processImageJob(job) {
    console.log(`[Worker] Processing image job: ${job.id}`);

    await supabase.from('image_queue')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', job.id);

    const provider = getProvider();
    const result = await provider.generateImage(job.prompt);

    if (result.success) {
        // 이미지 다운로드 및 Supabase 업로드 (필수!)
        let uploadedUrl = null;
        if (result.selectedImageUrl) {
            uploadedUrl = await downloadAndUploadImage(result.selectedImageUrl);
        }

        // 엄격한 플로우: Supabase 업로드 실패 시 전체 실패
        if (!uploadedUrl) {
            console.error(`[Worker] Image job failed: Supabase upload failed`);
            await supabase.from('image_queue').update({
                status: 'failed',
                error_message: 'Failed to upload image to storage',
                completed_at: new Date().toISOString()
            }).eq('id', job.id);
            return false;
        }

        // 성공: Supabase URL만 저장
        await supabase.from('image_queue').update({
            status: 'completed',
            image_urls: [uploadedUrl],
            selected_image_url: uploadedUrl,
            completed_at: new Date().toISOString()
        }).eq('id', job.id);
        console.log(`[Worker] Image job completed: ${job.id} -> ${uploadedUrl}`);
    } else {
        await supabase.from('image_queue').update({
            status: 'failed',
            error_message: result.error,
            completed_at: new Date().toISOString()
        }).eq('id', job.id);
        console.log(`[Worker] Image job failed: ${job.id} - ${result.error}`);
    }

    return result.success;
}

async function processVideoJob(job) {
    console.log(`[Worker] Processing video job: ${job.id}`);

    await supabase.from('video_queue')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', job.id);

    // 이미지 경로 확인 (URL이면 다운로드, 로컬 파일이면 그대로 사용)
    let imagePath = job.image_path;
    const isUrl = imagePath && (imagePath.startsWith('http://') || imagePath.startsWith('https://'));

    if (isUrl) {
        // URL인 경우 다운로드
        console.log('[Worker] Image path is URL, downloading...');
        try {
            const tempDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const localPath = path.join(tempDir, `video_input_${job.id}.png`);

            const https = require('https');
            const http = require('http');
            const protocol = imagePath.startsWith('https') ? https : http;

            await new Promise((resolve, reject) => {
                const file = fs.createWriteStream(localPath);
                protocol.get(imagePath, (res) => {
                    if (res.statusCode === 301 || res.statusCode === 302) {
                        const redirectProtocol = res.headers.location.startsWith('https') ? https : http;
                        redirectProtocol.get(res.headers.location, (res2) => {
                            res2.pipe(file);
                            file.on('finish', () => { file.close(); resolve(); });
                        }).on('error', reject);
                    } else {
                        res.pipe(file);
                        file.on('finish', () => { file.close(); resolve(); });
                    }
                }).on('error', reject);
            });

            console.log(`[Worker] Downloaded image to: ${localPath}`);
            imagePath = localPath;
        } catch (e) {
            console.error('[Worker] Failed to download image:', e.message);
            await supabase.from('video_queue').update({
                status: 'failed',
                error_message: 'Failed to download image: ' + e.message,
                completed_at: new Date().toISOString()
            }).eq('id', job.id);
            return false;
        }
    } else if (!imagePath || !fs.existsSync(imagePath)) {
        console.error('[Worker] Image not found:', imagePath);
        await supabase.from('video_queue').update({
            status: 'failed',
            error_message: 'Image file not found: ' + imagePath,
            completed_at: new Date().toISOString()
        }).eq('id', job.id);
        return false;
    }

    const provider = getProvider();
    const result = await provider.generateVideo(imagePath, job.prompt);

    if (result.success) {
        // 영상 업로드
        const publicUrl = await uploadToSupabase(result.videoPath);

        await supabase.from('video_queue').update({
            status: 'completed',
            video_path: result.videoPath,
            video_url: publicUrl,
            completed_at: new Date().toISOString()
        }).eq('id', job.id);
        console.log(`[Worker] Video job completed: ${job.id}`);
    } else {
        await supabase.from('video_queue').update({
            status: 'failed',
            error_message: result.error,
            completed_at: new Date().toISOString()
        }).eq('id', job.id);
        console.log(`[Worker] Video job failed: ${job.id} - ${result.error}`);
    }

    return result.success;
}

// === 메인 루프 ===
async function mainLoop() {
    console.log('[Worker] Starting Grok Worker Daemon (Modular Version)...');

    while (true) {
        try {
            // 1. 이미지 큐 확인 (우선순위)
            const { data: imageJob } = await supabase
                .from('image_queue')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

            if (imageJob) {
                lastActiveTime = Date.now();
                await processImageJob(imageJob);
                continue; // 즉시 다음 확인
            }

            // 2. 비디오 큐 확인
            const { data: videoJob } = await supabase
                .from('video_queue')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

            if (videoJob) {
                lastActiveTime = Date.now();
                await processVideoJob(videoJob);
                continue;
            }

            // 3. 유휴 시간 체크 - 브라우저 정리
            if (currentProvider && (Date.now() - lastActiveTime > IDLE_TIMEOUT)) {
                console.log('[Worker] Idle timeout, cleaning up provider...');
                await cleanupProvider();
            }

        } catch (error) {
            console.error('[Worker] Loop error:', error.message);
        }

        await delay(POLL_INTERVAL);
    }
}

// === 종료 처리 ===
process.on('SIGINT', async () => {
    console.log('[Worker] Shutting down...');
    await cleanupProvider();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('[Worker] Shutting down...');
    await cleanupProvider();
    process.exit(0);
});

// === 시작 ===
mainLoop().catch(e => {
    console.error('[Worker] Fatal error:', e);
    process.exit(1);
});
