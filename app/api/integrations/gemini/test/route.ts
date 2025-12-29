import { NextResponse } from 'next/server';

export async function POST() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ ok: false, message: "missing api key" }, { status: 400 });
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response text";

        return NextResponse.json({ ok: true, message: "gemini api connected", text });

    } catch (error: any) {
        return NextResponse.json({ ok: false, message: error.message || "Internal Server Error" }, { status: 500 });
    }
}
