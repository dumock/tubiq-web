import { NextResponse } from 'next/server';
import { getSupabaseServer, getAuthenticatedUser } from '@/lib/supabase-server';

export async function GET(request: Request) {
    try {
        const supabase = getSupabaseServer(true);
        const user = await getAuthenticatedUser(request, supabase);

        if (!user) {
            return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const userChannelId = searchParams.get('channelId');

        if (!userChannelId) {
            return NextResponse.json({ ok: false, message: 'channelId required' }, { status: 400 });
        }

        // Get the channel info to find similar channels
        const { data: userChannel, error: ucError } = await supabase
            .from('user_channels')
            .select('channel_id, channels(title, youtube_channel_id, subscriber_count)')
            .eq('id', userChannelId)
            .eq('user_id', user.id)
            .single();

        if (ucError || !userChannel?.channels) {
            return NextResponse.json({ ok: false, message: 'Channel not found' }, { status: 404 });
        }

        const channel = userChannel.channels as any;
        const channelTitle = channel.title || '';

        // Get user's API keys from settings
        const { data: settings } = await supabase
            .from('user_settings')
            .select('api_config')
            .eq('user_id', user.id)
            .single();

        const apiConfig = settings?.api_config as any;
        const youtubeKeys = apiConfig?.youtube?.keys || [];
        const apiKey = youtubeKeys[0]?.value || process.env.YOUTUBE_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ ok: false, message: 'YouTube API key not configured' }, { status: 500 });
        }

        // Search for similar channels using keywords from channel title
        const keywords = channelTitle.split(/\s+/).slice(0, 2).join(' ');
        const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
        searchUrl.searchParams.set('part', 'snippet');
        searchUrl.searchParams.set('type', 'channel');
        searchUrl.searchParams.set('q', keywords || 'entertainment');
        searchUrl.searchParams.set('maxResults', '10');
        searchUrl.searchParams.set('key', apiKey);

        const searchRes = await fetch(searchUrl.toString(), {
            headers: { 'User-Agent': 'TubiQ/1.0' }
        });

        if (!searchRes.ok) {
            const errorText = await searchRes.text();
            console.error('YouTube Search API Error:', errorText);
            return NextResponse.json({ ok: false, message: 'YouTube API error' }, { status: 500 });
        }

        const searchData = await searchRes.json();
        console.log('[similar-channels] Search results:', JSON.stringify(searchData.items?.slice(0, 2)));

        const channelIds = (searchData.items || [])
            .map((item: any) => item.id?.channelId || item.snippet?.channelId)
            .filter((id: string) => id && id !== channel.youtube_channel_id);

        if (channelIds.length === 0) {
            return NextResponse.json({ ok: true, data: [] });
        }

        // Get channel details (subscribers, etc.)
        const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
        detailsUrl.searchParams.set('part', 'snippet,statistics');
        detailsUrl.searchParams.set('id', channelIds.slice(0, 5).join(','));
        detailsUrl.searchParams.set('key', apiKey);

        const detailsRes = await fetch(detailsUrl.toString(), {
            headers: { 'User-Agent': 'TubiQ/1.0' }
        });

        if (!detailsRes.ok) {
            return NextResponse.json({ ok: false, message: 'Failed to get channel details' }, { status: 500 });
        }

        const detailsData = await detailsRes.json();
        const similarChannels = (detailsData.items || []).map((item: any) => ({
            id: item.id,
            name: item.snippet?.title || 'Unknown',
            thumbnail: item.snippet?.thumbnails?.default?.url || '',
            subscribers: Number(item.statistics?.subscriberCount || 0),
            avgViews: Math.floor(Number(item.statistics?.viewCount || 0) / Math.max(Number(item.statistics?.videoCount || 1), 1))
        }));

        return NextResponse.json({ ok: true, data: similarChannels });
    } catch (error: any) {
        console.error('Similar channels error:', error);
        return NextResponse.json({ ok: false, message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
