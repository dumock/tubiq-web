import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');

    if (!url) {
        return new NextResponse('Missing URL parameter', { status: 400 });
    }

    try {
        const response = await fetch(url);

        if (!response.ok) {
            return new NextResponse(`Failed to fetch video: ${response.statusText}`, { status: response.status });
        }

        const headers = new Headers(response.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Content-Type', response.headers.get('Content-Type') || 'video/mp4');
        headers.set('Cache-Control', 'public, max-age=3600');

        return new NextResponse(response.body, {
            status: 200,
            headers: headers,
        });
    } catch (e) {
        console.error('[Proxy Video] Error:', e);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
