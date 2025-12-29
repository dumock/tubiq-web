import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ ok: false, message: 'Missing GEMINI_API_KEY' }, { status: 500 });
    }

    const { keyword, country } = await request.json();

    if (!keyword || !country) {
        return NextResponse.json({ ok: false, message: 'keyword and country required' }, { status: 400 });
    }

    if (country === 'KR') {
        return NextResponse.json({
            ok: true,
            original: keyword,
            translated: keyword,
            lang: 'ko',
        });
    }

    const langMap: Record<string, string> = {
        JP: 'Japanese',
        US: 'English',
        CN: 'Simplified Chinese',
        TW: 'Traditional Chinese',
        ES: 'Spanish',
        FR: 'French',
        DE: 'German',
        RU: 'Russian',
    };

    const targetLang = langMap[country] ?? 'English';

    const prompt = `
Translate the following YouTube search keyword into ${targetLang}.
Return ONLY the translated text.

Keyword: ${keyword}
  `.trim();

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
            }),
        }
    );

    if (!res.ok) {
        const err = await res.text();
        console.error('[Gemini Error]', err);
        return NextResponse.json({
            ok: false,
            original: keyword,
            translated: keyword,
            error: 'Gemini failed',
        });
    }

    const data = await res.json();
    const translated =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? keyword;

    console.log('[Gemini] Translation success:', translated);

    return NextResponse.json({
        ok: true,
        original: keyword,
        translated,
        lang: targetLang,
    });
}
