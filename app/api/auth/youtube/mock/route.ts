import { NextRequest, NextResponse } from 'next/server';
import { MOCK_MY_CHANNELS } from '@/mock/myChannels';

export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'connect') {
        // Simulate OAuth Delay
        await new Promise((resolve) => setTimeout(resolve, 800));

        return NextResponse.json({
            success: true,
            channels: MOCK_MY_CHANNELS,
            message: 'Successfully connected to YouTube'
        });
    }

    if (action === 'disconnect') {
        return NextResponse.json({
            success: true,
            message: 'Successfully disconnected'
        });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
