import { NextResponse } from 'next/server';
import { getTikHubApiKey } from '@/lib/api-keys-server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ ok: false, message: 'URL is required' }, { status: 400 });
    }

    // const apiKey = await getTikHubApiKey(request);
    // Hardcoded for debugging
    const apiKey = 'q7YhBZgQ/XWgs3LORNKW7BjAHRK/ZqM9ySL4tGekWPGhtl05KyS9QAIfCQ==';
    if (!apiKey) {
        return NextResponse.json({ ok: false, message: 'TikHub API key not configured' }, { status: 500 });
    }

    try {
        let platform = 'unknown';
        let apiEndpoint = '';

        if (url.includes('tiktok.com')) {
            platform = 'tiktok';
            // First get aweme_id from URL
            const videoIdMatch = url.match(/video\/(\d+)/);
            if (videoIdMatch) {
                apiEndpoint = `https://api.tikhub.io/api/v1/tiktok/app/v3/fetch_one_video?aweme_id=${videoIdMatch[1]}`;
            } else {
                // Get aweme_id from share URL first
                const getIdEndpoint = `https://api.tikhub.io/api/v1/tiktok/web/get_aweme_id?url=${encodeURIComponent(url)}`;
                const idRes = await fetch(getIdEndpoint, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                if (idRes.ok) {
                    const idData = await idRes.json();
                    const awemeId = idData?.data?.aweme_id || idData?.aweme_id;
                    if (awemeId) {
                        apiEndpoint = `https://api.tikhub.io/api/v1/tiktok/app/v3/fetch_one_video?aweme_id=${awemeId}`;
                    }
                }
            }
        } else if (url.includes('instagram.com')) {
            platform = 'instagram';
            // Use Instagram V1 API - fetch_post_by_url (parameter is post_url)
            apiEndpoint = `https://api.tikhub.io/api/v1/instagram/v1/fetch_post_by_url?post_url=${encodeURIComponent(url)}`;
        } else if (url.includes('xiaohongshu.com') || url.includes('xhslink.com')) {
            platform = 'xiaohongshu';
            const noteIdMatch = url.match(/explore\/([a-f0-9]+)/) || url.match(/discovery\/item\/([a-f0-9]+)/);
            if (noteIdMatch) {
                apiEndpoint = `https://api.tikhub.io/api/v1/xiaohongshu/web/get_note_info_v5?note_id=${noteIdMatch[1]}`;
            }
        } else {
            return NextResponse.json({ ok: false, message: 'Unsupported platform' }, { status: 400 });
        }

        if (!apiEndpoint) {
            return NextResponse.json({
                ok: true,
                video: { id: `${platform}-${Date.now()}`, title: `${platform} Video`, thumbnailUrl: '', authorName: 'Unknown', platform, videoUrl: url }
            });
        }

        console.log(`[API] TikHub endpoint: ${apiEndpoint}`);

        const tikHubRes = await fetch(apiEndpoint, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000)
        });

        const tikHubData = await tikHubRes.json();
        console.log(`[TikHub Debug] Status: ${tikHubRes.status}`);
        console.log(`[TikHub Debug] Raw Response: ${JSON.stringify(tikHubData).slice(0, 1000)}`);

        if (!tikHubRes.ok) {
            console.error('[TikHub Debug] API responded with error status');
            return NextResponse.json({
                ok: true, // Revert to true to allow fallback
                video: { id: `${platform}-${Date.now()}`, title: `${platform} Video`, thumbnailUrl: '', authorName: 'Unknown', platform, videoUrl: url }
            });
        }

        const data = tikHubData?.data || tikHubData || {};
        console.log(`[TikHub Debug] Parsed Data Root: ${JSON.stringify(data).slice(0, 200)}`);

        let videoInfo: any = { id: `${platform}-${Date.now()}`, title: `${platform} Video`, thumbnailUrl: '', authorName: 'Unknown', platform, videoUrl: url };

        if (platform === 'tiktok') {
            const v = data.aweme_detail || data;
            videoInfo = {
                id: v.aweme_id || videoInfo.id,
                title: v.desc || 'TikTok Video',
                thumbnailUrl: v.video?.cover?.url_list?.[0] || '',
                authorName: v.author?.nickname || 'Unknown',
                viewCount: v.statistics?.play_count || 0,
                platform: 'tiktok',
                videoUrl: url
            };
        } else if (platform === 'instagram') {
            const v = data.items?.[0] || data;
            videoInfo = {
                id: v.pk || v.id || videoInfo.id,
                title: v.caption?.text?.slice(0, 100) || 'Instagram Feed',
                // V1 API returns thumbnail_src, V2 returns image_versions2
                thumbnailUrl: v.thumbnail_src || v.image_versions2?.candidates?.[0]?.url || v.thumbnail_url || '',
                authorName: v.user?.username || v.owner?.username || 'Unknown',
                viewCount: v.view_count || v.video_view_count || 0,
                platform: 'instagram',
                videoUrl: url
            };
        } else if (platform === 'xiaohongshu') {
            const v = data.note_info || data;
            videoInfo = {
                id: v.note_id || videoInfo.id,
                title: v.title || v.desc || '小红书',
                thumbnailUrl: v.image_list?.[0]?.url_default || v.image_list?.[0]?.url || '',
                authorName: v.user?.nickname || 'Unknown',
                viewCount: v.interact_info?.view_count || 0,
                platform: 'xiaohongshu',
                videoUrl: url
            };
        }

        return NextResponse.json({ ok: true, video: videoInfo });

    } catch (error: any) {
        console.error('TikHub API Error:', error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}
