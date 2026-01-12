import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiApiKey } from '@/lib/api-keys-server';

export async function POST(request: Request) {
    // 0. Get API Key
    const apiKey = await getGeminiApiKey(request);
    if (!apiKey) {
        return NextResponse.json({ ok: false, message: 'Missing GEMINI_API_KEY' }, { status: 401 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'models/gemini-3-flash-preview' });

    const { subtitles, targetLang } = await request.json();

    if (!subtitles || !Array.isArray(subtitles) || !targetLang) {
        return NextResponse.json({ ok: false, message: 'Invalid input' }, { status: 400 });
    }

    try {
        // Prepare batch prompt with context awareness
        const textArray = subtitles.map((s: any) => s.text);
        const prompt = `
        You are a professional subtitle translator specializing in video subtitles.
        Translate the following Korean subtitle lines into ${targetLang}.
        
        CRITICAL RULES:
        1. These subtitles are SPLIT from complete sentences. Understand the FULL CONTEXT before translating.
        2. Maintain coherence across ALL lines - they form a continuous narrative.
        3. Keep the natural flow of the target language while matching the original timing/length.
        4. DO NOT add or remove content. Translate only what's given.
        5. Preserve the speaking style, tone, and emotion.
        
        Input (Korean subtitles in order):
        ${JSON.stringify(textArray)}
        
        Output ONLY a JSON array of translated strings in the SAME order. No explanations.
        Example: ["translated line 1", "translated line 2", ...]
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const translatedTexts = JSON.parse(jsonStr);

        return NextResponse.json({ ok: true, data: translatedTexts });

    } catch (e: any) {
        console.error('Translation failed:', e);
        return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
    }
}
