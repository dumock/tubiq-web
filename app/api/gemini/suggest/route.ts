import { NextResponse } from 'next/server';
import { getGeminiApiKey } from '@/lib/api-keys-server';

export async function POST(request: Request) {
    const apiKey = await getGeminiApiKey(request);

    if (!apiKey) {
        return NextResponse.json({ ok: false, message: 'Missing GEMINI_API_KEY' }, { status: 500 });
    }

    const { keyword, country } = await request.json();

    if (!keyword) {
        return NextResponse.json({ ok: false, message: 'keyword is required' }, { status: 400 });
    }

    const langMap: Record<string, string> = {
        KR: 'Korean',
        JP: 'Japanese',
        US: 'English',
        CN: 'Simplified Chinese',
        TW: 'Traditional Chinese',
        VN: 'Vietnamese',
        TH: 'Thai',
        ES: 'Spanish',
        FR: 'French',
        DE: 'German',
        RU: 'Russian',
    };

    const targetLang = langMap[country] ?? 'Korean';

    const prompt = `Act as a YouTube SEO expert. Based on the keyword "${keyword}", generate 100 highly relevant and trending YouTube search keywords in ${targetLang} language that users in ${country} would likely search for.
If the keyword is globally famous (e.g., a specific athlete or brand), include relevant local variations.
Return the result as a raw JSON array of strings ONLY. Do not include markdown formatting or any other text.
Example format: ["keyword1", "keyword2", ...]`;

    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.9,
                    },
                }),
            }
        );

        if (!res.ok) {
            const err = await res.text();
            console.error('[Gemini Suggest Error]', err);
            return NextResponse.json({ ok: false, message: 'Gemini API failed' }, { status: 500 });
        }

        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '[]';

        // Clean markdown if Gemini accidentally included it
        const jsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            const suggestions = JSON.parse(jsonText);
            console.log('[Gemini Suggest] Success:', suggestions.length, 'keywords');
            return NextResponse.json({
                ok: true,
                keyword,
                country,
                suggestions: Array.isArray(suggestions) ? suggestions : [],
            });
        } catch {
            console.error('[Gemini Suggest] JSON Parse Error:', jsonText);
            return NextResponse.json({ ok: false, message: 'Failed to parse suggestions' }, { status: 500 });
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Gemini Suggest] Error:', errorMessage);
        return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
    }
}
