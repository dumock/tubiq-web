import { NextResponse } from 'next/server';
import { getFalApiKey } from '@/lib/api-keys-server';

export async function POST(request: Request) {
    try {
        const apiKey = await getFalApiKey(request);

        if (!apiKey) {
            return NextResponse.json({
                ok: false,
                message: 'FAL API Key가 설정되지 않았습니다. 설정에서 키를 등록해주세요.'
            });
        }

        // Simple validation - FAL keys start with a specific pattern
        // We'll just check if the key format looks valid
        if (!apiKey.includes('-')) {
            return NextResponse.json({
                ok: false,
                message: 'API Key 형식이 올바르지 않습니다.'
            });
        }

        // FAL doesn't have a simple test endpoint, so we just validate the key format
        // A real test would involve making an actual API call which costs credits
        return NextResponse.json({
            ok: true,
            message: 'FAL API Key가 등록되었습니다!'
        });
    } catch (error: any) {
        console.error('FAL Test Error:', error);
        return NextResponse.json({
            ok: false,
            message: error.message || '테스트 중 오류 발생'
        });
    }
}
