import { NextResponse } from 'next/server';
import { getYoutubeApiKey } from '@/lib/api-keys-server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    const apiKey = await getYoutubeApiKey(request);

    if (!videoId) {
        return NextResponse.json({ ok: false, message: "videoId required" }, { status: 400 });
    }

    if (!apiKey) {
        return NextResponse.json({ ok: false, message: "missing api key" }, { status: 400 });
    }

    try {
        // Fetch video details
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${apiKey}`;

        const res = await fetch(apiUrl);
        if (!res.ok) {
            const errorData = await res.json();
            return NextResponse.json(
                { ok: false, message: errorData.error?.message || 'YouTube API error' },
                { status: res.status }
            );
        }

        const data = await res.json();

        if (!data.items || data.items.length === 0) {
            return NextResponse.json(
                { ok: false, message: 'Video not found' },
                { status: 404 }
            );
        }

        const video = data.items[0];
        const videoInfo = {
            id: video.id,
            title: video.snippet.title,
            description: video.snippet.description,
            channelTitle: video.snippet.channelTitle,
            channelId: video.snippet.channelId,
            publishedAt: video.snippet.publishedAt,
            thumbnailUrl: video.snippet.thumbnails?.maxres?.url ||
                video.snippet.thumbnails?.high?.url ||
                video.snippet.thumbnails?.medium?.url ||
                `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            viewCount: Number(video.statistics?.viewCount) || 0,
            likeCount: Number(video.statistics?.likeCount) || 0,
            commentCount: Number(video.statistics?.commentCount) || 0,
        };

        return NextResponse.json({ ok: true, video: videoInfo });

    } catch (error) {
        console.error('YouTube API Error:', error);
        return NextResponse.json(
            { ok: false, message: 'internal server error' },
            { status: 500 }
        );
    }
}
