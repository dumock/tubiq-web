import { NextResponse } from 'next/server';

export async function GET() {
    // Possible statuses: 'idle', 'running', 'finished', 'failed'
    const jobStatus = {
        status: 'running',
        lastRunAttempt: new Date().toISOString(),
        progress: 45
    };

    return NextResponse.json({ ok: true, data: jobStatus });
}
