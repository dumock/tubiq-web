import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: Request) {
    try {
        const { image, prompt } = await req.json();

        if (!image || !prompt) {
            return NextResponse.json({ error: 'Image and prompt are required' }, { status: 400 });
        }

        // 1. Prepare temp directory
        const tempDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const imagePath = path.join(tempDir, 'input_' + timestamp + '.png');

        // 2. Handle both Base64 and URL
        if (image.startsWith('data:image/')) {
            // Base64 data
            console.log('[API] Processing Base64 image...');
            const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
            await fs.promises.writeFile(imagePath, base64Data, 'base64');
        } else if (image.startsWith('http')) {
            // URL - download the image
            console.log('[API] Downloading image from URL:', image.substring(0, 80) + '...');

            const imageBuffer = await new Promise<Buffer>((resolve, reject) => {
                const protocol = image.startsWith('https') ? https : http;
                protocol.get(image, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }, (res) => {
                    if (res.statusCode === 301 || res.statusCode === 302) {
                        // Follow redirect
                        const redirectUrl = res.headers.location!;
                        const redirectProtocol = redirectUrl.startsWith('https') ? https : http;
                        redirectProtocol.get(redirectUrl, (res2) => {
                            const chunks: Buffer[] = [];
                            res2.on('data', (chunk) => chunks.push(chunk));
                            res2.on('end', () => resolve(Buffer.concat(chunks)));
                            res2.on('error', reject);
                        }).on('error', reject);
                    } else if (res.statusCode === 200) {
                        const chunks: Buffer[] = [];
                        res.on('data', (chunk) => chunks.push(chunk));
                        res.on('end', () => resolve(Buffer.concat(chunks)));
                        res.on('error', reject);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: Failed to download image`));
                    }
                }).on('error', reject);
            });

            console.log(`[API] Downloaded image: ${imageBuffer.length} bytes`);
            await fs.promises.writeFile(imagePath, imageBuffer);
        } else {
            return NextResponse.json({ error: 'Invalid image format (must be Base64 or URL)' }, { status: 400 });
        }

        console.log('[API] Saved temporary image:', imagePath);

        // 3. Insert into Queue (DB)
        const supabase = getSupabaseServer(false);

        const { data, error } = await supabase
            .from('video_queue')
            .insert({
                image_path: image,  // URL 또는 로컬 경로 (Worker가 둘 다 처리)
                prompt: prompt,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            console.error('[API] Queue Insert Error:', error);
            return NextResponse.json({ error: 'Failed to queue job: ' + error.message }, { status: 500 });
        }

        console.log('[API] Job Queued:', data.id);

        // 4. Return Job ID for polling
        return NextResponse.json({
            success: true,
            jobId: data.id,
            status: 'pending'
        });

    } catch (error) {
        console.error('[API] Video Generation Error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal Server Error'
        }, { status: 500 });
    }
}
