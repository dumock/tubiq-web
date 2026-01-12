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

        // Get the internal channel_id from user_channels
        const { data: userChannel, error: ucError } = await supabase
            .from('user_channels')
            .select('channel_id')
            .eq('id', userChannelId)
            .eq('user_id', user.id)
            .single();

        if (ucError || !userChannel) {
            return NextResponse.json({ ok: false, message: 'Channel not found' }, { status: 404 });
        }

        // Fetch daily stats for this channel (last 90 days)
        const { data: stats, error: statsError } = await supabase
            .from('channel_daily_stats')
            .select('date, view_count, subscriber_count, video_count')
            .eq('channel_id', userChannel.channel_id)
            .order('date', { ascending: false })
            .limit(90);

        if (statsError) {
            console.error('Supabase stats error:', statsError);
            return NextResponse.json({ ok: false, message: statsError.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, data: stats || [] });
    } catch (error: any) {
        console.error('Internal Server Error:', error);
        return NextResponse.json({ ok: false, message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
