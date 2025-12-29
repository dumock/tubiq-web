import { NextResponse } from 'next/server';
import { getSupabaseServer, getAuthenticatedUser } from '@/lib/supabase-server';

export async function GET(request: Request) {
    try {
        const supabase = getSupabaseServer(true); // Need service role for JOIN logic if RLS is strict on user_channels
        const user = await getAuthenticatedUser(request, supabase);

        if (!user) {
            return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
        }

        // Get user_channels JOINed with channels info, strictly filtered by user_id
        const { data, error } = await supabase
            .from('user_channels')
            .select(`
                id,
                channel_id,
                folder_id,
                created_at,
                channels!channel_id (
                    id,
                    youtube_channel_id,
                    title,
                    thumbnail_url,
                    subscriber_count,
                    published_at,
                    added_at,
                    status,
                    scope
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase GET Error:', error);
            return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, data });
    } catch (error: any) {
        console.error('Internal Server Error:', error);
        return NextResponse.json({ ok: false, message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = getSupabaseServer(true);
        const user = await getAuthenticatedUser(request, supabase);

        if (!user) {
            return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { youtube_channel_id, title, thumbnail_url, subscriber_count, published_at, folder_id, scope } = body;

        // 1. Ensure channel exists in the global 'channels' table
        const channelPayload = {
            youtube_channel_id,
            title,
            thumbnail_url,
            subscriber_count,
            published_at,
            user_id: user.id, // satisfying NOT NULL constraint but marked as source
            scope: scope || 'channels',
            status: 'active',
            added_at: new Date().toISOString()
        };

        const { data: channelData, error: channelError } = await supabase
            .from('channels')
            .upsert(channelPayload, { onConflict: 'youtube_channel_id' })
            .select('id')
            .single();

        if (channelError) throw channelError;

        // 2. Link to user_channels with strict user_id assignment
        const userChannelPayload = {
            user_id: user.id,
            channel_id: channelData.id,
            folder_id: folder_id || null
        };

        const { data: userChannel, error: linkError } = await supabase
            .from('user_channels')
            .upsert(userChannelPayload, { onConflict: 'user_id,channel_id' })
            .select()
            .single();

        if (linkError) throw linkError;

        return NextResponse.json({ ok: true, data: userChannel }, { status: 201 });
    } catch (error: any) {
        console.error('Supabase POST Error:', error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const supabase = getSupabaseServer(true);
        const user = await getAuthenticatedUser(request, supabase);

        if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { channel_ids, folder_id } = body;

        if (!channel_ids || !Array.isArray(channel_ids)) {
            return NextResponse.json({ ok: false, message: 'channel_ids required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('user_channels')
            .update({ folder_id: folder_id || null })
            .in('id', channel_ids)
            .eq('user_id', user.id) // Security check
            .select();

        if (error) throw error;

        return NextResponse.json({ ok: true, data });
    } catch (error: any) {
        console.error('Supabase PATCH Error:', error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const supabase = getSupabaseServer(true);
        const user = await getAuthenticatedUser(request, supabase);

        if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ ok: false, message: 'id required' }, { status: 400 });

        const { error } = await supabase
            .from('user_channels')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id); // Security check

        if (error) throw error;

        return NextResponse.json({ ok: true, message: 'Removed from assets' });
    } catch (error: any) {
        console.error('Supabase DELETE Error:', error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}
