import { NextRequest, NextResponse } from 'next/server';

// Standard Proxy with Range Support
export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    if (!url) return new NextResponse('Missing URL', { status: 400 });

    try {
        const headers = new Headers();
        // Forward Range header if present (crucial for seeking)
        const range = req.headers.get('range');
        if (range) {
            headers.set('Range', range);
        }

        const response = await fetch(url, {
            headers: headers
        });

        if (!response.ok && response.status !== 206) {
            console.error(`[Proxy] Upstream error: ${response.status} ${response.statusText}`);
            return new NextResponse(`Upstream Error: ${response.statusText}`, { status: response.status });
        }

        const resHeaders = new Headers(response.headers);

        // Ensure CORS and Streaming headers
        resHeaders.set('Access-Control-Allow-Origin', '*');
        resHeaders.set('Cache-Control', 'public, max-age=3600');

        // Forward content-related headers needed for video
        ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges'].forEach(h => {
            const val = response.headers.get(h);
            if (val) resHeaders.set(h, val);
        });

        return new NextResponse(response.body, {
            status: response.status, // 200 or 206
            headers: resHeaders
        });
    } catch (e) {
        console.error('[Proxy Video] Error:', e);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
