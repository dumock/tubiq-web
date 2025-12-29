import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    const maxResults = searchParams.get('maxResults') || '10';
    const publishedAfter = searchParams.get('publishedAfter'); // ISO date string
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { ok: false, message: 'missing api key' },
            { status: 400 }
        );
    }

    if (!channelId) {
        return NextResponse.json(
            { ok: false, message: 'missing channelId' },
            { status: 400 }
        );
    }

    try {
        // Build search API URL to get videos from channel
        let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}&key=${apiKey}`;

        if (publishedAfter) {
            searchUrl += `&publishedAfter=${publishedAfter}`;
        }

        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) {
            const errorData = await searchRes.json();
            return NextResponse.json(
                { ok: false, message: errorData.error?.message || 'YouTube API error' },
                { status: searchRes.status }
            );
        }

        const searchData = await searchRes.json();

        if (!searchData.items || searchData.items.length === 0) {
            return NextResponse.json({ ok: true, videos: [] });
        }

        // Get video IDs for statistics
        const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');

        // Fetch video statistics
        const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`;
        const statsRes = await fetch(statsUrl);
        const statsData = await statsRes.json();

        // Map videos with statistics
        const videos = statsData.items?.map((item: any) => ({
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
            publishedAt: item.snippet.publishedAt,
            channelTitle: item.snippet.channelTitle,
            viewCount: Number(item.statistics?.viewCount) || 0,
            likeCount: Number(item.statistics?.likeCount) || 0,
            commentCount: Number(item.statistics?.commentCount) || 0,
        })) || [];

        return NextResponse.json({ ok: true, videos });

    } catch (error) {
        console.error('YouTube API Error:', error);
        return NextResponse.json(
            { ok: false, message: 'internal server error' },
            { status: 500 }
        );
    }
}
