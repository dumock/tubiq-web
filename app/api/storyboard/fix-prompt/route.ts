import { NextResponse } from 'next/server';
import { getGeminiApiKey } from '@/lib/api-keys-server';

// Issue types for prompt fixing
const ISSUE_PROMPTS: Record<string, string> = {
    'duplicate': '중복된 객체가 있음 (예: 머리가 두 개, 팔이 여러 개)',
    'anatomy': '신체/형태가 이상함 (예: 기형, 비정상적 비율)',
    'composition': '구도/배치 문제 (예: 잘린 피사체, 어색한 앵글)',
    'style': '스타일이 맞지 않음',
    'other': '기타 문제'
};

export async function POST(request: Request) {
    const apiKey = await getGeminiApiKey(request);

    if (!apiKey) {
        return NextResponse.json({ ok: false, message: 'Missing GEMINI_API_KEY' }, { status: 500 });
    }

    try {
        const { imageUrl, originalPrompt, issueType, userDescription } = await request.json();

        if (!originalPrompt) {
            return NextResponse.json({ ok: false, message: 'Original prompt is required' }, { status: 400 });
        }

        // Build the analysis prompt
        const issueDescription = ISSUE_PROMPTS[issueType] || ISSUE_PROMPTS['other'];

        // Try to fetch image, but don't fail if it doesn't work
        let imageData: { mime_type: string; data: string } | null = null;

        if (imageUrl) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

                const imageRes = await fetch(imageUrl, {
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (imageRes.ok) {
                    const imageBuffer = await imageRes.arrayBuffer();
                    const base64Image = Buffer.from(imageBuffer).toString('base64');
                    const mimeType = imageRes.headers.get('content-type') || 'image/png';
                    imageData = { mime_type: mimeType, data: base64Image };
                }
            } catch (imgErr: any) {
                console.warn('[Fix Prompt] Could not fetch image, proceeding with text-only:', imgErr.message);
            }
        }

        const systemPrompt = `
You are an expert AI Image Generation Prompt Engineer.

Your task is to FIX a prompt that generated a problematic image.

**Original Prompt:**
${originalPrompt}

**Reported Issue:**
${issueDescription}

**User's Additional Description:**
${userDescription || '(없음)'}

**Instructions:**
1. ${imageData ? 'Look at the attached image carefully.' : 'Based on the issue description, imagine what went wrong.'}
2. Identify what type of error likely occurred (e.g., duplicate objects, anatomical errors, composition issues).
3. Rewrite the prompt to PREVENT the same issue from happening again.
4. Add specific keywords like "single", "one only", "anatomically correct", "no duplicates", "centered composition", etc.
5. Keep the same overall scene and style intention.

**Output Format:**
Return ONLY the improved prompt text in English. No explanations, no markdown, just the raw improved prompt.
`;

        // Build message parts
        const messageParts: any[] = [{ text: systemPrompt }];

        // Add image if available
        if (imageData) {
            messageParts.push({
                inline_data: {
                    mime_type: imageData.mime_type,
                    data: imageData.data
                }
            });
        }

        // Call Gemini 3.0 Pro Preview (Multimodal)
        // Using v1beta as generic endpoint often routes correctly with new model names
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: messageParts
                        }
                    ],
                    generationConfig: {
                        temperature: 1.0, // Recommended default for Gemini 3
                        maxOutputTokens: 1024,
                    },
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                    ]
                }),
            }
        );

        if (!res.ok) {
            const errorText = await res.text();
            console.error('[Gemini Fix Prompt Error]', errorText);

            // Helpful error message if 403 (likely API disabled)
            if (res.status === 403) {
                return NextResponse.json({ ok: false, message: `Generative Language API not enabled or Key invalid. Error: ${errorText.substring(0, 100)}` }, { status: 403 });
            }

            return NextResponse.json({ ok: false, message: `Gemini API failed: ${errorText.substring(0, 200)}` }, { status: 500 });
        }

        const data = await res.json();

        // Extract the fixed prompt
        const fixedPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!fixedPrompt) {
            console.error('[Fix Prompt] No content in response:', JSON.stringify(data).substring(0, 500));
            return NextResponse.json({ ok: false, message: 'Failed to generate fixed prompt - no response from AI' }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            fixedPrompt: fixedPrompt,
            usedImage: !!imageData
        });

    } catch (error: any) {
        console.error('Fix Prompt Error:', error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}
