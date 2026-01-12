import { NextResponse } from 'next/server';
import { getGeminiApiKey } from '@/lib/api-keys-server';

export async function POST(request: Request) {
    const apiKey = await getGeminiApiKey(request);

    if (!apiKey) {
        return NextResponse.json({ ok: false, message: "missing api key" }, { status: 400 });
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "Hello from TubiQ" }]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            return NextResponse.json({ ok: false, message: errorData.error?.message || "Gemini API Error" }, { status: 500 });
        }

        const data = await response.json();

        return NextResponse.json({ ok: true, text: 'Gemini API 연동 성공!' });

    } catch (error: any) {
        return NextResponse.json({ ok: false, message: error.message || "Internal Server Error" }, { status: 500 });
    }
}
