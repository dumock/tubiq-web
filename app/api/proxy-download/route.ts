import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
        return new NextResponse('Missing url parameter', { status: 400 });
    }

    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const headers = new Headers();
        headers.set('Content-Type', response.headers.get('Content-Type') || 'image/png');
        headers.set('Content-Length', buffer.length.toString());
        // Optional: add Content-Disposition if you want to force download immediately, 
        // but for our frontend blob logic, just returning the image is fine.

        return new NextResponse(buffer, {
            status: 200,
            headers,
        });
    } catch (error: any) {
        console.error('Proxy Download Error:', error);
        return new NextResponse(`Failed to fetch image: ${error.message}`, { status: 500 });
    }
}
