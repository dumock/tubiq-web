import { NextResponse } from 'next/server';
import { getYoutubeApiKey, getTikHubApiKey } from '@/lib/api-keys-server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get('input');
    const apiKey = await getYoutubeApiKey(request);

    // If it's a non-YouTube platform URL, we don't need a YouTube API key
    const isNonYouTubePlatform = input && (
        input.includes('douyin.com') ||
        input.includes('tiktok.com') ||
        input.includes('instagram.com') ||
        input.includes('xiaohongshu.com') ||
        input.includes('xhslink.com')
    );

    if (isNonYouTubePlatform) {
        // Pass through, will be handled by platform-specific logic below
    } else if (!apiKey) {
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
    console.log(`[API] Resolve Channel Input: "${trimmedInput}" (Includes douyin.com: ${trimmedInput.includes('douyin.com')})`);

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


    // TikHub API for TikTok, Instagram, Xiaohongshu
    const isTikTok = trimmedInput.includes('tiktok.com');
    const isInstagram = trimmedInput.includes('instagram.com');
    const isXiaohongshu = trimmedInput.includes('xiaohongshu.com') || trimmedInput.includes('xhslink.com');

    if (isTikTok || isInstagram || isXiaohongshu) {
        try {
            const tikHubApiKey = await getTikHubApiKey(request);
            if (!tikHubApiKey) {
                return NextResponse.json(
                    { ok: false, message: 'TikHub API key not configured' },
                    { status: 500 }
                );
            }

            let platform = 'tiktok';
            let username = '';
            let apiEndpoint = '';

            // Extract username from URL
            if (isTikTok) {
                platform = 'tiktok';
                const match = trimmedInput.match(/tiktok\.com\/@([\w._]+)/);
                username = match ? match[1] : '';
                apiEndpoint = `https://api.tikhub.io/api/v1/tiktok/web/get_user_profile?uniqueId=${username}`;
            } else if (isInstagram) {
                platform = 'instagram';
                const match = trimmedInput.match(/instagram\.com\/([\w._]+)/);
                username = match ? match[1] : '';
                apiEndpoint = `https://api.tikhub.io/api/v1/instagram/web/get_user_info?username=${username}`;
            } else if (isXiaohongshu) {
                platform = 'xiaohongshu';
                // Xiaohongshu URL format: https://www.xiaohongshu.com/user/profile/xxx
                const match = trimmedInput.match(/user\/profile\/([\w]+)/) || trimmedInput.match(/xhslink\.com\/([a-zA-Z0-9]+)/);
                username = match ? match[1] : '';
                apiEndpoint = `https://api.tikhub.io/api/v1/xiaohongshu/web/get_user_info?user_id=${username}`;
            }

            if (!username) {
                return NextResponse.json(
                    { ok: false, message: 'Could not extract username from URL' },
                    { status: 400 }
                );
            }

            console.log(`[API] Resolving ${platform} channel via TikHub API for username: ${username}`);

            const tikHubRes = await fetch(apiEndpoint, {
                headers: {
                    'Authorization': `Bearer ${tikHubApiKey}`,
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(15000)
            });

            if (!tikHubRes.ok) {
                const errorText = await tikHubRes.text();
                console.error(`TikHub API Error (${tikHubRes.status}):`, errorText);
                return NextResponse.json(
                    { ok: false, message: `TikHub API error: ${tikHubRes.status}` },
                    { status: tikHubRes.status }
                );
            }

            const tikHubData = await tikHubRes.json();
            console.log(`[API] TikHub response for ${username}:`, JSON.stringify(tikHubData).slice(0, 500));

            // Parse response based on platform
            let channelInfo;
            if (isTikTok) {
                const userInfo = tikHubData?.data?.userInfo || tikHubData?.userInfo || {};
                const user = userInfo?.user || tikHubData?.data?.user || {};
                const stats = userInfo?.stats || tikHubData?.data?.stats || {};
                channelInfo = {
                    id: user.uniqueId || user.id || username,
                    title: user.nickname || user.uniqueId || username,
                    handle: `@${user.uniqueId || username}`,
                    thumbnailUrl: user.avatarLarger || user.avatarMedium || user.avatarThumb || '',
                    subscriberCount: stats.followerCount || stats.followers || 0,
                    videoCount: stats.videoCount || 0,
                    publishedAt: null,
                    platform: 'tiktok'
                };
            } else if (isInstagram) {
                const user = tikHubData?.data?.user || tikHubData?.user || tikHubData?.data || {};
                channelInfo = {
                    id: user.id || user.pk || username,
                    title: user.full_name || user.username || username,
                    handle: `@${user.username || username}`,
                    thumbnailUrl: user.profile_pic_url_hd || user.profile_pic_url || '',
                    subscriberCount: user.follower_count || user.edge_followed_by?.count || 0,
                    videoCount: user.media_count || user.edge_owner_to_timeline_media?.count || 0,
                    publishedAt: null,
                    platform: 'instagram'
                };
            } else if (isXiaohongshu) {
                const user = tikHubData?.data?.basic_info || tikHubData?.data || {};
                channelInfo = {
                    id: user.red_id || user.user_id || username,
                    title: user.nickname || user.name || username,
                    handle: `@${user.red_id || username}`,
                    thumbnailUrl: user.images || user.avatar || '',
                    subscriberCount: user.fans || tikHubData?.data?.interactions?.find((i: any) => i.type === 'fans')?.count || 0,
                    videoCount: tikHubData?.data?.interactions?.find((i: any) => i.type === 'notes')?.count || 0,
                    publishedAt: null,
                    platform: 'xiaohongshu'
                };
            }

            if (!channelInfo || !channelInfo.id) {
                return NextResponse.json(
                    { ok: false, message: 'Could not parse user info from TikHub response' },
                    { status: 404 }
                );
            }

            return NextResponse.json({ ok: true, channel: channelInfo });

        } catch (error) {
            console.error('TikHub API Error:', error);
            return NextResponse.json(
                { ok: false, message: 'TikHub API request failed' },
                { status: 500 }
            );
        }
    }

    // Douyin Channel Resolution (keep using local worker)
    if (trimmedInput.includes('douyin.com')) {
        try {
            const workerUrl = process.env.DOUYIN_WORKER_URL || 'http://127.0.0.1:8000';
            console.log(`[API] Resolving Douyin channel via ${workerUrl} for ${trimmedInput}`);

            const workerRes = await fetch(`${workerUrl}/api/info?url=${encodeURIComponent(trimmedInput)}`, {
                signal: AbortSignal.timeout(15000)
            });

            if (!workerRes.ok) {
                return NextResponse.json(
                    { ok: false, message: 'Failed to fetch info from Douyin Worker' },
                    { status: workerRes.status }
                );
            }

            const data = await workerRes.json();
            if (!data.success) {
                return NextResponse.json(
                    { ok: false, message: 'Invalid Douyin link or content not found' },
                    { status: 404 }
                );
            }

            const channelInfo = {
                id: data.author_id,
                title: data.author || 'Douyin User',
                handle: `@${data.author_id}`,
                thumbnailUrl: data.author_avatar || data.thumbnail_url,
                subscriberCount: data.follower_count || 0,
                videoCount: 0,
                publishedAt: null,
                platform: 'douyin'
            };

            return NextResponse.json({ ok: true, channel: channelInfo });

        } catch (error) {
            console.error('Douyin Resolution Error:', error);
            return NextResponse.json(
                { ok: false, message: 'Douyin resolution failed' },
                { status: 500 }
            );
        }
    }

    // YouTube Logic (Existing)
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
            publishedAt: snippet.publishedAt || null, // Channel creation date (ISO format)
            platform: 'youtube'
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
