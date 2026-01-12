import { NextResponse } from 'next/server';
import { getGeminiApiKey } from '@/lib/api-keys-server';

export async function POST(request: Request) {
    const apiKey = await getGeminiApiKey(request);

    if (!apiKey) {
        return NextResponse.json({ ok: false, message: 'Missing GEMINI_API_KEY' }, { status: 500 });
    }

    try {
        const { script, style, stylePrompt, userInstructions, sceneMode, sceneCount } = await request.json();

        if (!script) {
            return NextResponse.json({ ok: false, message: 'Script is required' }, { status: 400 });
        }

        // Default instruction instructions
        const artStyleInstruction = stylePrompt ? `Art Style: ${stylePrompt}` : `Art Style: Cinematic, High Quality`;
        const userNote = userInstructions ? `User Note: ${userInstructions}` : '';

        // Scene count instruction based on mode
        let sceneCountInstruction = '';
        if (sceneMode === 'sentence') {
            sceneCountInstruction = `
    **CRITICAL - 문장당 하나의 장면:**
    - 대본의 각 문장마다 하나의 장면을 생성하세요.
    - 마침표(.)를 기준으로 장면을 나눕니다.
    - 문장 수만큼 장면이 생성되어야 합니다.`;
        } else if (sceneMode === 'fixed' && sceneCount) {
            sceneCountInstruction = `
    **CRITICAL - 정확히 ${sceneCount}개의 장면 생성:**
    - 전체 대본을 분석하여 정확히 ${sceneCount}개의 장면으로 나누세요.
    - 장면이 더 많거나 적으면 안 됩니다. 반드시 ${sceneCount}개여야 합니다.
    - 대본 전체를 균등하게 ${sceneCount}개 파트로 나눠서 시각화하세요.`;
        } else {
            sceneCountInstruction = `
    **장면 분할:**
    - 대본을 5-10초 단위의 자연스러운 장면으로 나누세요.
    - 일반적으로 5-10개 장면이 적절합니다.`;
        }

        const systemPromptMessage = `
    You are an expert Prompt Engineer specializing in "Z-Image" (Stable Diffusion).
    Your goal is to convert a Video Script into a visual storyboard.

    **Goal:** Create a sequence of scenes that visualize the script.

    **Crucial Rules:**
    - **NO DUPLICATES:** Each scene MUST be visually distinct. Do NOT reuse the same prompt.
    - **Variety:** Change camera angles (wide, close-up, top-down) and compositions for each scene.
    - **Storytelling:** The images should follow the narrative flow of the script.
    - **English Only:** Image prompts MUST be in English.

    ${sceneCountInstruction}

    **Instructions:**
    1. Analyze the script and break it into scenes.
    2. Write a "Z-Image Optimized Prompt" for each scene.
       - Focus on: Subject, Action, Lighting, Camera, Style.
       - Format: [Style], [Subject], [Action], [Lighting], [Details]
    3. **Translate** the Image Prompt into **Korean** as 'imagePromptKo'.
    4. Provide a "videoPrompt" for camera movement.

    ${artStyleInstruction}
    ${userNote}
    `;

        // Request using Gemini 3.0 Pro Preview with Strict Schema (Wrapped in Object)
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { text: systemPromptMessage },
                                { text: `SCRIPT:\n${script}` }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 1.0,
                        maxOutputTokens: 8192,
                        response_mime_type: "application/json",
                        response_schema: {
                            type: "OBJECT",
                            properties: {
                                scenes: {
                                    type: "ARRAY",
                                    items: {
                                        type: "OBJECT",
                                        properties: {
                                            script: { type: "STRING" },
                                            imagePrompt: { type: "STRING" },
                                            imagePromptKo: { type: "STRING" },
                                            videoPrompt: { type: "STRING" }
                                        },
                                        required: ["script", "imagePrompt", "imagePromptKo", "videoPrompt"]
                                    }
                                }
                            },
                            required: ["scenes"]
                        }
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
            console.error('[Gemini Create API Error]', errorText);

            if (res.status === 403) {
                return NextResponse.json({ ok: false, message: `Generative Language API not enabled or Key invalid.` }, { status: 403 });
            }

            return NextResponse.json({ ok: false, message: `Gemini API failed: ${res.statusText}` }, { status: 500 });
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!text) {
            return NextResponse.json({ ok: false, message: 'No content generated' }, { status: 500 });
        }

        let parsedData;
        try {
            parsedData = JSON.parse(text);
        } catch (e) {
            console.error('JSON Parse Error:', e, 'Raw Text:', text);
            // Attempt cleanup fallback
            try {
                const firstBrace = text.indexOf('{');
                const lastBrace = text.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    parsedData = JSON.parse(text.substring(firstBrace, lastBrace + 1));
                } else {
                    throw e;
                }
            } catch (retryErr) {
                // Return the raw text in the error message for debugging
                return NextResponse.json({
                    ok: false,
                    message: `Failed to parse JSON. Raw output: ${text.substring(0, 100)}...`
                }, { status: 500 });
            }
        }

        // Extract scenes array from wrapper or direct array
        let scenes = parsedData.scenes || parsedData;

        if (!Array.isArray(scenes)) {
            return NextResponse.json({
                ok: false,
                message: `Invalid response format: Expected array, got ${typeof scenes}`
            }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            scenes: scenes
        });

    } catch (error: any) {
        console.error('Create Storyboard Error:', error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}
