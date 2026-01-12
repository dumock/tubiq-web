import { NextResponse } from 'next/server';
import { getOpenaiApiKey } from '@/lib/api-keys-server';

export async function POST(request: Request) {
    try {
        const apiKey = await getOpenaiApiKey(request);

        if (!apiKey) {
            return NextResponse.json({
                ok: false,
                message: 'OpenAI API Key가 설정되지 않았습니다.'
            });
        }

        // Test API call to OpenAI
        const res = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(10000)
        });

        if (!res.ok) {
            if (res.status === 401) {
                return NextResponse.json({
                    ok: false,
                    message: 'API Key가 유효하지 않습니다.'
                });
            }
            return NextResponse.json({
                ok: false,
                message: `API 호출 실패 (${res.status})`
            });
        }

        const data = await res.json();

        if (data?.data && data.data.length > 0) {
            return NextResponse.json({
                ok: true,
                text: 'OpenAI API 연동 성공!'
            });
        } else {
            return NextResponse.json({
                ok: true,
                text: 'OpenAI API Key가 등록되었습니다!'
            });
        }
    } catch (error: any) {
        console.error('OpenAI Test Error:', error);
        return NextResponse.json({
            ok: false,
            message: error.message || '테스트 중 오류 발생'
        });
    }
}
