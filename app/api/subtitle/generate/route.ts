import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiApiKey, getOpenaiApiKey } from '@/lib/api-keys-server';

export async function POST(request: Request) {
    // 0. Get API Keys
    const geminiKey = await getGeminiApiKey(request);
    const openaiKey = await getOpenaiApiKey(request);

    if (!openaiKey) {
        return NextResponse.json({ ok: false, message: 'OpenAI API 키가 필요합니다. 설정에서 등록해주세요.' }, { status: 401 });
    }
    if (!geminiKey) {
        return NextResponse.json({ ok: false, message: 'Gemini API 키가 필요합니다. 설정에서 등록해주세요.' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const script = formData.get('script') as string;
        const videoFile = formData.get('video') as File | null;
        const audioFile = formData.get('audio') as File | null;

        if (!videoFile && !audioFile) {
            return NextResponse.json({ ok: false, message: '영상 또는 음성 파일을 입력해주세요.' }, { status: 400 });
        }

        // Prepare audio data for Whisper
        let audioData: ArrayBuffer;
        let audioMimeType: string;

        if (audioFile) {
            audioData = await audioFile.arrayBuffer();
            audioMimeType = audioFile.type || 'audio/mpeg';
        } else if (videoFile) {
            audioData = await videoFile.arrayBuffer();
            audioMimeType = videoFile.type || 'video/mp4';
        } else {
            return NextResponse.json({ ok: false, message: '오디오 데이터가 필요합니다.' }, { status: 400 });
        }

        // ============================================
        // STEP 1: OpenAI Whisper - 정밀 타임스탬프 추출
        // ============================================
        console.log('[Subtitle] Step 1: Calling OpenAI Whisper for word-level timestamps...');

        const whisperFormData = new FormData();
        const audioBlob = new Blob([audioData], { type: audioMimeType });
        whisperFormData.append('file', audioBlob, 'audio.mp3');
        whisperFormData.append('model', 'whisper-1');
        whisperFormData.append('response_format', 'verbose_json');
        whisperFormData.append('timestamp_granularities[]', 'word');
        whisperFormData.append('language', 'ko');

        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`
            },
            body: whisperFormData
        });

        if (!whisperResponse.ok) {
            const errText = await whisperResponse.text();
            console.error('[Subtitle] Whisper API error:', errText);
            return NextResponse.json({ ok: false, message: `Whisper API 오류: ${errText}` }, { status: 500 });
        }

        const whisperResult = await whisperResponse.json();
        console.log('[Subtitle] Whisper transcription completed. Words:', whisperResult.words?.length || 0);

        // Extract word-level timestamps from Whisper
        const wordTimestamps = whisperResult.words || [];
        const transcribedText = whisperResult.text || "";

        // ============================================
        // STEP 2: Gemini - 대본 정렬 및 쇼츠용 청킹
        // ============================================
        console.log('[Subtitle] Step 2: Calling Gemini for script alignment/formatting...');

        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'models/gemini-3-flash-preview' });

        let alignmentPrompt = "";

        if (script && script.trim().length > 0) {
            // Case A: Script Provided (Alignment Mode)
            alignmentPrompt = `
You are a professional Subtitle Aligner for SHORT-FORM VERTICAL VIDEOS (YouTube Shorts, TikTok, Reels).

I have:
1. Original script from the user
2. Word-level timestamps from audio transcription (OpenAI Whisper)

YOUR TASK:
- Align the ORIGINAL SCRIPT with the timestamps
- Split into SHORT, BITE-SIZED CHUNKS (max 15 Korean characters or 6-8 words each)
- Use the Whisper timestamps for precise timing

ORIGINAL SCRIPT:
"${script}"

WHISPER WORD TIMESTAMPS:
${JSON.stringify(wordTimestamps.map((w: any) => ({ word: w.word, start: w.start, end: w.end })), null, 2)}

CRITICAL RULES:
1. **CORRECT TYPOS:** Verify the script against the Whisper timestamps/words. If the script implies a typo (e.g., "난극" vs audio "남극"), **CORRECT IT** to match the audio.
2. Match the script to Whisper timestamps based on speech patterns.
3. Each subtitle should be 1-3 seconds long.
4. Split at natural speech pauses.
5. If timestamps don't cover the entire script, estimate remaining timestamps based on speech pace

Return ONLY a JSON array. No markdown.
`;
        } else {
            // Case B: No Script (Auto Connect Mode)
            alignmentPrompt = `
You are a professional Subtitle Formatter for SHORT-FORM VERTICAL VIDEOS.

I have:
1. Raw Transcription from OpenAI Whisper (may contain lack of punctuation or minor errors)
2. Word-level timestamps

YOUR TASK:
- Create perfect subtitles from the transcription
- Split into SHORT, BITE-SIZED CHUNKS (max 15 Korean characters or 6-8 words each)
- Use the Whisper timestamps for precise timing
- **Add Punctuation** and fixes where natural

WHISPER TRANSCRIPTION:
"${transcribedText}"

WHISPER WORD TIMESTAMPS:
${JSON.stringify(wordTimestamps.map((w: any) => ({ word: w.word, start: w.start, end: w.end })), null, 2)}

CRITICAL RULES:
1. Rely on the timestamps to split valid sentences.
2. Each subtitle should be 1-3 seconds long.
3. Split at natural speech pauses.

Return ONLY a JSON array. No markdown.
`;
        }

        // Append common formatting instruction
        alignmentPrompt += `
Format:
[
    { "text": "짧은 자막", "start": 0.0, "end": 1.5 },
    { "text": "다음 자막", "start": 1.5, "end": 3.0 }
]`;

        const geminiResult = await model.generateContent(alignmentPrompt);
        const responseText = geminiResult.response.text();

        // Parse Response
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const subtitles = JSON.parse(jsonStr);

        console.log('[Subtitle] Generation complete. Subtitle count:', subtitles.length);

        return NextResponse.json({ ok: true, data: subtitles });

    } catch (e: any) {
        console.error('[Subtitle] Generation failed:', e);
        return NextResponse.json({ ok: false, message: e.message || 'Generation failed' }, { status: 500 });
    }
}
