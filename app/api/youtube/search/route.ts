import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ ok: false, message: 'Missing YouTube API Key' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const regionCode = searchParams.get('regionCode') || 'KR';
    const type = searchParams.get('type') || 'video';

    if (!query) {
        return NextResponse.json({ ok: false, message: 'Query is required' }, { status: 400 });
    }

    try {
        if (type === 'video') {
            // 1. Search Videos
            const searchRes = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=25&regionCode=${regionCode}&key=${apiKey}`
            );
            const searchData = await searchRes.json();

            if (searchData.error) {
                console.error('YouTube Search API Error:', searchData.error);
                return NextResponse.json({ ok: false, message: searchData.error.message }, { status: 500 });
            }

            const videoItems = searchData.items || [];
            const videoIds = videoItems.map((item: any) => item.id.videoId).join(',');

            if (!videoIds) {
                return NextResponse.json({ ok: true, data: [] });
            }

            // 2. Fetch Video Stats
            const statsRes = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`
            );
            const statsData = await statsRes.json();

            const formattedVideos = statsData.items.map((item: any) => ({
                id: item.id,
                title: item.snippet.title,
                thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
                views: Number(item.statistics.viewCount) || 0,
                contribution: Math.floor(Math.random() * 20) - 5, // Mock contribution
                status: 'Published',
                publishedAt: new Date(item.snippet.publishedAt).toLocaleDateString('ko-KR').replace(/ /g, ''),
                channelTitle: item.snippet.channelTitle
            }));

            return NextResponse.json({ ok: true, data: formattedVideos });
        } else {
            // channel search
            const searchRes = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=channel&maxResults=25&regionCode=${regionCode}&key=${apiKey}`
            );
            const searchData = await searchRes.json();

            if (searchData.error) {
                console.error('YouTube Search API Error:', searchData.error);
                return NextResponse.json({ ok: false, message: searchData.error.message }, { status: 500 });
            }

            const channelItems = searchData.items || [];
            const channelIds = channelItems.map((item: any) => item.id.channelId).join(',');

            if (!channelIds) {
                return NextResponse.json({ ok: true, data: [] });
            }

            // Fetch Channel Stats
            const statsRes = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIds}&key=${apiKey}`
            );
            const statsData = await statsRes.json();

            const formatCompact = (num: number) => {
                if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
                if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
                return num.toString();
            };

            const formattedChannels = statsData.items.map((item: any, idx: number) => ({
                id: item.id,
                rank: idx + 1,
                name: item.snippet.title,
                handle: item.snippet.customUrl || `@${item.snippet.title.replace(/\s+/g, '').toLowerCase()}`,
                category: 'Youtube',
                subscribers: formatCompact(Number(item.statistics.subscriberCount) || 0),
                subscriberGrowth: Number((Math.random() * 5).toFixed(1)),
                views: formatCompact(Number(item.statistics.viewCount) || 0),
                videos: Number(item.statistics.videoCount) || 0,
                status: Math.random() > 0.5 ? 'Growing' : 'Stable',
                avatar: item.snippet.thumbnails?.default?.url,
                viewCount: Number(item.statistics.viewCount) || 0,
                videoCount: Number(item.statistics.videoCount) || 0,
                publishedAt: item.snippet.publishedAt
            }));

            return NextResponse.json({ ok: true, data: formattedChannels });
        }
    } catch (error: any) {
        console.error('YouTube API Error:', error);
        return NextResponse.json({ ok: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
