import { NextResponse } from 'next/server';
import { getGeminiApiKey, getOpenaiApiKey } from '@/lib/api-keys-server';

export const maxDuration = 300; // Allow longer operation (5min)

export async function POST(request: Request) {
    try {
        // 1. Get API Keys
        const geminiApiKey = await getGeminiApiKey(request);
        const openaiApiKey = await getOpenaiApiKey(request);

        if (!geminiApiKey) {
            return NextResponse.json({ ok: false, message: 'Missing GEMINI_API_KEY' }, { status: 500 });
        }
        if (!openaiApiKey) {
            return NextResponse.json({ ok: false, message: 'Missing OPENAI_API_KEY for Whisper Sync' }, { status: 500 });
        }

        // 2. Parse Input
        const { audioData, transcript, mimeType } = await request.json();

        if (!audioData || !transcript || !Array.isArray(transcript)) {
            return NextResponse.json({ ok: false, message: 'Invalid Input' }, { status: 400 });
        }

        // 3. STEP 1: Call Whisper for Precise Timestamps
        console.log('[SmartSync] Step 1: Calling Whisper for timestamps...');
        const audioBuffer = Buffer.from(audioData, 'base64');
        const audioBlob = new Blob([audioBuffer], { type: mimeType || 'audio/mp3' });

        const whisperFormData = new FormData();
        whisperFormData.append('file', audioBlob, 'audio.mp3');
        whisperFormData.append('model', 'whisper-1');
        whisperFormData.append('response_format', 'verbose_json');
        whisperFormData.append('timestamp_granularities[]', 'word');
        whisperFormData.append('language', 'ko'); // Assuming Korean based on context

        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: whisperFormData
        });

        if (!whisperResponse.ok) {
            const errText = await whisperResponse.text();
            console.error('[SmartSync] Whisper Error:', errText);
            return NextResponse.json({ ok: false, error: 'Whisper API Error: ' + errText }, { status: 500 });
        }

        const whisperResult = await whisperResponse.json();
        const wordTimestamps = whisperResult.words || [];
        console.log(`[SmartSync] Whisper returned ${wordTimestamps.length} words.`);

        // 4. STEP 2: Call Gemini 3.0 Pro to Align & Correct
        console.log('[SmartSync] Step 2: Calling Gemini 3.0 Pro for alignment...');

        const transcriptText = transcript.map((t, i) => `${i + 1}. ${t}`).join('\n');

        const systemInstruction = `
You are a Professional Subtitle Aligner & Corrector.
I will provide:
1. An AUDIO file (for context)
2. A USER TRANSCRIPT (that needs alignment)
3. WHISPER TIMESTAMPS (precise word-level timings)

YOUR TASK:
Align the USER TRANSCRIPT using the WHISPER TIMESTAMPS.
Corret typos in the USER TRANSCRIPT if they disagree with the audio/Whisper.

CRITICAL RULES:
1. **TRUST WHISPER TIMING:** Use the start/end times from Whisper. Do not guess.
2. **CORRECT TYPOS:** If the user transcript says "난극" but Audio/Whisper says "남극", FIX IT.
3. **RESPECT STRUCTURE:** Keep the original sentence structure of the User Transcript as much as possible, just fix typos and apply times.
4. Output JSON array: { index, text, startTime, endTime }
`;

        const userPrompt = `
USER TRANSCRIPT:
${transcriptText}

WHISPER TIMESTAMPS:
${JSON.stringify(wordTimestamps.slice(0, 1000).map((w: any) => ({ w: w.word, s: w.start, e: w.end })), null, 2)}
(Truncated if too long, but use these for timing reference)

Align the transcript.
`;

        const payload = {
            contents: [
                {
                    parts: [
                        {
                            inline_data: {
                                mime_type: mimeType || "audio/mp3",
                                data: audioData
                            }
                        },
                        {
                            text: userPrompt
                        }
                    ]
                }
            ],
            system_instruction: {
                parts: [{ text: systemInstruction }]
            },
            generation_config: {
                response_mime_type: "application/json"
            }
        };

        // Use Gemini 3 Pro Preview (v1alpha)
        const model = 'models/gemini-3-flash-preview';
        const url = `https://generativelanguage.googleapis.com/v1alpha/models/${model}:generateContent?key=${geminiApiKey}`;

        const geminiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error('[Gemini Sync Error]', errorText);
            return NextResponse.json({ ok: false, error: 'Gemini API Error: ' + errorText }, { status: geminiResponse.status });
        }

        const data = await geminiResponse.json();
        const jsonString = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!jsonString) {
            throw new Error('No data returned from Gemini');
        }

        const cleanedJson = jsonString.replace(/```json|```/g, '').trim();
        const alignedData = JSON.parse(cleanedJson);

        return NextResponse.json({
            ok: true,
            alignedData
        });

    } catch (error: any) {
        console.error('[Smart Sync Error]', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
