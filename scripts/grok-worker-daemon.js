const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const GrokVideoRunner = require('./grok-video-runner');
const GrokImageRunner = require('./grok-image-runner');

console.log('[DEBUG] GrokVideoRunner Type:', typeof GrokVideoRunner);
console.log('[DEBUG] GrokImageRunner Type:', typeof GrokImageRunner);
if (typeof GrokImageRunner !== 'function') {
    console.error('[DEBUG] CRITICAL: GrokImageRunner failed to import correctly!');
}

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config({ path: envPath });
}

// Config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET_NAME = 'videos';

console.log('[Worker] Starting Unified Grok Worker Daemon...');

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[Worker] Error: Missing Supabase Credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const videoRunner = new GrokVideoRunner();
const imageRunner = new GrokImageRunner('grok-manual');

// Define delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function uploadToSupabase(localPath) {
    try {
        const fileBuffer = fs.readFileSync(localPath);
        const fileName = `grok-generated/${Date.now()}_${path.basename(localPath)}`;

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, fileBuffer, {
                contentType: 'video/mp4',
                upsert: true
            });

        if (error) throw error;
        const { data: signedData, error: signedError } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(fileName, 60 * 60 * 24 * 30);

        if (signedError) throw signedError;
        return signedData.signedUrl;
    } catch (e) {
        console.error('[Worker] Upload Failed:', e);
        return null;
    }
}

async function loop() {
    let lastActive = Date.now();
    const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    while (true) {
        try {
            // SYNC Browsers
            if (imageRunner.browser && !videoRunner.browser) videoRunner.browser = imageRunner.browser;
            if (videoRunner.browser && !imageRunner.browser) imageRunner.browser = videoRunner.browser;

            // 1. Check Image Queue First (Priority)
            const { data: imgJob, error: imgError } = await supabase
                .from('image_queue')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

            if (imgJob) {
                console.log(`[Worker] Found Image Job ${imgJob.id}. Prompt: ${imgJob.prompt.substring(0, 30)}...`);
                lastActive = Date.now();

                await supabase.from('image_queue').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', imgJob.id);

                // Ensure launch
                await imageRunner.launch();
                videoRunner.browser = imageRunner.browser; // Maintain sync

                const result = await imageRunner.generateImage(imgJob.prompt, false); // false = keep open

                if (result.success) {
                    await supabase.from('image_queue').update({
                        status: 'completed',
                        image_urls: result.imageUrls,
                        selected_image_url: result.selectedImageUrl,
                        completed_at: new Date().toISOString()
                    }).eq('id', imgJob.id);
                } else {
                    await supabase.from('image_queue').update({
                        status: 'failed',
                        error_message: result.error,
                        completed_at: new Date().toISOString()
                    }).eq('id', imgJob.id);
                }
                continue; // Immediate next check
            }

            // 2. Check Video Queue
            const { data: vidJob, error: vidError } = await supabase
                .from('video_queue')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

            if (vidJob) {
                console.log(`[Worker] Found Video Job ${vidJob.id}.`);
                lastActive = Date.now();

                await supabase.from('video_queue').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', vidJob.id);

                await videoRunner.launch();
                imageRunner.browser = videoRunner.browser;

                const result = await videoRunner.generateVideo(vidJob.image_path, vidJob.prompt, false); // false = keep open

                if (result.success) {
                    const publicUrl = await uploadToSupabase(result.videoPath);
                    await supabase.from('video_queue').update({
                        status: 'completed',
                        video_path: result.videoPath,
                        video_url: publicUrl,
                        completed_at: new Date().toISOString()
                    }).eq('id', vidJob.id);
                } else {
                    await supabase.from('video_queue').update({
                        status: 'failed',
                        error_message: result.error,
                        completed_at: new Date().toISOString()
                    }).eq('id', vidJob.id);
                }
                continue;
            }

            // 3. Handle Idle Timeout
            if ((imageRunner.browser || videoRunner.browser) && (Date.now() - lastActive > IDLE_TIMEOUT)) {
                console.log('[Worker] Idle timeout reached. Closing browser to save resources.');
                await imageRunner.close();
                videoRunner.browser = null;
            }

        } catch (loopError) {
            console.error('[Worker] Loop Error:', loopError);
        }

        await delay(3000);
    }
}

loop().catch(e => console.error('[Worker] Fatal Error:', e));
