import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get('input');
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { ok: false, message: 'missing api key' },
            { status: 400 }
        );
    }

    if (!input) {
        return NextResponse.json(
            { ok: false, message: 'missing input' },
            { status: 400 }
        );
    }

    let handle = '';
    let channelId = '';

    // Input normalization
    const trimmedInput = input.trim();

    // Check if it's a direct channel ID
    if (trimmedInput.startsWith('UC') && !trimmedInput.includes('/')) {
        channelId = trimmedInput;
    }
    // Check if it's a channel URL with /channel/UC... format
    else if (trimmedInput.includes('/channel/')) {
        const match = trimmedInput.match(/\/channel\/(UC[a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            channelId = match[1];
        }
    }
    // Check if it's a /c/ custom URL format 
    else if (trimmedInput.includes('/c/')) {
        const match = trimmedInput.match(/\/c\/([^/?]+)/);
        if (match && match[1]) {
            // For /c/ URLs, we need to treat it as a handle-like search
            handle = `@${match[1]}`;
        }
    }
    // Handle @ format (direct handle or URL with @)
    else {
        let text = trimmedInput;

        // Extract the last meaningful part from URL
        if (text.includes('youtube.com/') || text.includes('youtu.be/')) {
            const parts = text.split('/').filter(Boolean);
            text = parts[parts.length - 1];

            // Handle query params (remove them)
            if (text.includes('?')) {
                text = text.split('?')[0];
            }
        }

        // If empty after split, take previous part
        if (!text && trimmedInput.includes('/')) {
            const parts = trimmedInput.split('/').filter(Boolean);
            text = parts[parts.length - 1];
        }

        // Check if extracted text is a channel ID
        if (text.startsWith('UC') && text.length > 10) {
            channelId = text;
        } else {
            // Treat as handle
            if (!text.startsWith('@')) {
                text = `@${text}`;
            }
            handle = text;
        }
    }

    const baseUrl = 'https://www.googleapis.com/youtube/v3/channels';
    let apiUrl = `${baseUrl}?part=snippet,statistics&key=${apiKey}`;

    if (channelId) {
        apiUrl += `&id=${channelId}`;
    } else {
        apiUrl += `&forHandle=${encodeURIComponent(handle)}`;
    }

    try {
        const res = await fetch(apiUrl);
        if (!res.ok) {
            return NextResponse.json(
                { ok: false, message: `YouTube API error: ${res.status}` },
                { status: res.status }
            );
        }

        const data = await res.json();

        if (!data.items || data.items.length === 0) {
            return NextResponse.json(
                { ok: false, message: 'not found' },
                { status: 404 }
            );
        }

        const item = data.items[0];
        const snippet = item.snippet;
        const statistics = item.statistics;

        const channelInfo = {
            id: item.id,
            title: snippet.title,
            handle: snippet.customUrl || handle, // customUrl usually contains the handle
            thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
            subscriberCount: Number(statistics?.subscriberCount) || 0,
            viewCount: Number(statistics?.viewCount) || 0,
            videoCount: Number(statistics?.videoCount) || 0,
            publishedAt: snippet.publishedAt || null // Channel creation date (ISO format)
        };

        return NextResponse.json({ ok: true, channel: channelInfo });

    } catch (error) {
        console.error('YouTube API Error:', error);
        return NextResponse.json(
            { ok: false, message: 'internal server error' },
            { status: 500 }
        );
    }
}
