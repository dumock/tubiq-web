
import { NextResponse } from 'next/server';
import { getGeminiApiKey } from '@/lib/api-keys-server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const runtime = 'nodejs'; // Must be nodejs for child_process

// Helper to clean VTT content (remove timestamps, etc.)
function cleanVtt(text: string): string {
    return text
        .split('\n')
        .filter(line => !line.includes('-->') && line.trim() !== '' && !line.startsWith('WEBVTT'))
        .map(line => line.replace(/<[^>]*>/g, '').trim())
        .filter((line, index, self) => line !== self[index - 1]) // Remove duplicates
        .join(' ');
}

export async function POST(request: Request) {
    const apiKey = await getGeminiApiKey(request);
    if (!apiKey) {
        return NextResponse.json({ ok: false, message: 'Missing GEMINI_API_KEY' }, { status: 500 });
    }

    const { channelUrl, analysisPrompt } = await request.json();
    if (!channelUrl) {
        return NextResponse.json({ ok: false, message: 'Channel URL is required' }, { status: 400 });
    }

    const tempDir = path.join(os.tmpdir(), `yt_analyze_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
        console.log('[Analyze] Starting yt-dlp for:', channelUrl);

        // 1. Download Captions for latest 20 videos
        // --write-auto-sub: Get auto-generated captions
        // --write-sub: Get manual captions if available
        // --sub-lang ko,en: Prefer Korean, then English
        // 1. Step 1: Get Video IDs (Fast & Robust)
        console.log('[Analyze] Step 1: Fetching video list...');
        const videoList = await new Promise<string[]>((resolve, reject) => {
            const ytDlp = spawn('yt-dlp', [
                '--flat-playlist',
                '--print', 'id',
                '--playlist-end', '5',
                channelUrl
            ]);

            let stdout = '';
            let stderr = '';

            ytDlp.stdout.on('data', d => stdout += d.toString());
            ytDlp.stderr.on('data', d => stderr += d.toString());

            ytDlp.on('close', code => {
                if (code !== 0) {
                    // Check if it's the specific "tab page" error, and maybe try /shorts
                    if (stderr.includes('Unable to recognize tab page') && !channelUrl.includes('/shorts')) {
                        console.log('Retrying with /shorts endpoint...');
                        // Optionally fallback to appending /shorts here, but standard yt-dlp usually handles it.
                        // For now, fail with clear message.
                        reject(new Error(`채널 페이지 분석 실패: ${stderr}`));
                        return;
                    }
                    reject(new Error(`목록 가져오기 실패: ${stderr}`));
                } else {
                    const ids = stdout.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                    resolve(ids);
                }
            });
        });

        if (videoList.length === 0) {
            return NextResponse.json({ ok: false, message: '채널에서 동영상을 찾을 수 없습니다.' }, { status: 404 });
        }

        console.log(`[Analyze] Step 1 Success. Found ${videoList.length} videos. Downloading subtitles...`);

        // 2. Step 2: Download Subtitles for each video (Sequential to avoid 429)
        let scriptCount = 0;
        let aggregatedScripts = '';

        for (const videoId of videoList) {
            try {
                // Sleep 1s to be polite
                await new Promise(r => setTimeout(r, 1000));

                const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                const outputBase = path.join(tempDir, videoId);

                await new Promise<void>((resolve, reject) => {
                    const ytDlp = spawn('yt-dlp', [
                        '--extractor-args', 'youtube:player_client=android', // Android client is good for video pages
                        '--write-auto-sub',
                        '--write-sub',
                        '--sub-lang', 'ko,en',
                        '--skip-download',
                        '--output', outputBase, // Just use ID as filename
                        videoUrl
                    ]);

                    ytDlp.on('close', code => resolve()); // Ignore errors for individual videos, just continue
                });

                // Check if file exists (generic check for any subtitle ext)
                const files = fs.readdirSync(tempDir);
                const subFile = files.find(f => f.startsWith(videoId) && (f.endsWith('.vtt') || f.endsWith('.ttml') || f.endsWith('.srv3')));

                if (subFile) {
                    const content = fs.readFileSync(path.join(tempDir, subFile), 'utf8');
                    const cleaned = cleanVtt(content);
                    if (cleaned.length > 50) {
                        aggregatedScripts += `\n=== Video: ${videoId} ===\n${cleaned}\n`;
                        scriptCount++;
                    }
                    // Delete processed file
                    // fs.unlinkSync(path.join(tempDir, subFile)); 
                }

            } catch (e) {
                console.error(`Failed to process video ${videoId}:`, e);
            }
        }

        // This check was duplicated in the provided snippet. Keeping the one that returns NextResponse.
        if (scriptCount === 0) {
            return NextResponse.json({ ok: false, message: 'No transcripts found. Ensure the channel has videos with captions.' }, { status: 404 });
        }

        console.log(`[Analyze] Aggregated ${scriptCount} scripts. Calling Gemini...`);

        // 3. Analyze with Gemini
        // 3. Analyze with Gemini
        // Use user-provided prompt or fallback (though frontend should always provide it)
        const basePrompt = analysisPrompt || `You are an expert Content Stylist and Prompt Engineer.
Analyze the following transcripts (Scripts) from a YouTube channel.
Identify the core "Persona", "Tone & Manner", "Structure", and "Key Catchphrases".

Based on this analysis, write a "System Prompt" that I can give to an AI (like yourself) to make it generate NEW scripts in EXACTLY this style.

The System Prompt should include:
- Role Definition (e.g., "당신은 호기심을 자극하는 미스터리 스토리텔러입니다...")
- Tone Guidelines (e.g., "짧은 문장을 사용하고, 질문으로 끝맺으세요...")
- Structural Rules (e.g., "훅으로 시작해서, 3가지 포인트를 말하고, 반전으로 끝내세요")
- Formatting Rules (if any specific markdown is used)

IMPORTANT: The output System Prompt must be written in **KOREAN** (한국어).
Output ONLY the System Prompt content. Do not add introductory text.`;

        const synthesisPrompt = `
${basePrompt}

[Transcripts]
${aggregatedScripts.slice(0, 25000)} 
        `; // Limit text length to avoid token limits if necessary (Gemini 2.0/3.0 has large context but safe to limit)

        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: synthesisPrompt }] }]
                }),
            }
        );

        if (!geminiRes.ok) {
            throw new Error(`Gemini API Error: ${await geminiRes.text()}`);
        }

        const geminiData = await geminiRes.json();
        const systemPrompt = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });

        return NextResponse.json({
            ok: true,
            scriptCount,
            systemPrompt
        });

    } catch (error: any) {
        console.error('[Analyze Error]', error);
        // Cleanup on error
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { }
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}
