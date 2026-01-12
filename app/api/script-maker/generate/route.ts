
import { NextResponse } from 'next/server';
import { getGeminiApiKey } from '@/lib/api-keys-server';

export const runtime = 'edge'; // Use Edge Runtime for better streaming performance

export async function POST(request: Request) {
    const apiKey = await getGeminiApiKey(request);

    if (!apiKey) {
        return NextResponse.json({ ok: false, message: 'Missing GEMINI_API_KEY' }, { status: 500 });
    }

    const { sourceText, systemPrompt, styleName } = await request.json();

    if (!sourceText) {
        return NextResponse.json({ ok: false, message: 'Source text is required' }, { status: 400 });
    }

    // Construct the prompt
    const fullPrompt = `
${systemPrompt}

---
[Source Text]
${sourceText}
---

Create a YouTube Shorts script based on the Source Text above in the style of "${styleName}".
Output ONLY the script content.
`;

    const modelParams = {
        model: 'models/gemini-3-flash-preview', // Updated to Gemini 3 Flash
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
    };

    try {

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelParams.model}:generateContent?key=${apiKey}`;

        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                    temperature: modelParams.temperature,
                    topP: modelParams.topP,
                    topK: modelParams.topK,
                    maxOutputTokens: modelParams.maxOutputTokens,
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Gemini API Error]', errorText);
            return NextResponse.json({ ok: false, message: `Gemini API Error: ${response.statusText}` }, { status: response.status });
        }

        const data = await response.json();
        const scriptText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!scriptText) {
            console.error('Empty response from Gemini', data);
            return NextResponse.json({ ok: false, message: 'Gemini returned empty response' }, { status: 500 });
        }

        // Return text directly so client can read it as a "stream" of one chunk (compatible with existing client code)
        return new NextResponse(scriptText, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });

    } catch (error: any) {
        console.error('[Script Gen Error]', error);
        return NextResponse.json({ ok: false, message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
