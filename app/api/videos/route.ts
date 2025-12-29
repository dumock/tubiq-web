import { NextResponse } from 'next/server';
import { getSupabaseServer, getAuthenticatedUser } from '@/lib/supabase-server';

// GET: Fetch videos for authenticated user
export async function GET(request: Request) {
    try {
        const supabase = getSupabaseServer(true); // Service role for JOIN logic
        const user = await getAuthenticatedUser(request, supabase);

        if (!user) {
            return NextResponse.json({ ok: true, data: [] });
        }

        const { data, error } = await supabase
            .from('videos')
            .select('*, channels(title)')
            .eq('user_id', user.id)
            .order('collected_at', { ascending: false });

        if (error) {
            console.error('Supabase GET Error:', error);
            return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, data });
    } catch (error) {
        console.error('Internal Server Error:', error);
        return NextResponse.json({ ok: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

// POST: Save videos (bulk upsert)
export async function POST(request: Request) {
    try {
        const supabase = getSupabaseServer(true);
        const user = await getAuthenticatedUser(request, supabase);

        if (!user) {
            return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { videos, source } = body;

        if (!videos || !Array.isArray(videos)) {
            return NextResponse.json({ ok: false, message: 'videos array required' }, { status: 400 });
        }

        // Auto-assign QSharer folder for app-sourced videos
        let qsharerFolderId = null;
        if (source === 'qsharer-app') {
            // Find existing QSharer folder
            const { data: existingFolder } = await supabase
                .from('folders')
                .select('id')
                .eq('user_id', user.id)
                .eq('name', '📱 큐쉐어러')
                .eq('scope', 'videos')
                .single();

            if (existingFolder) {
                qsharerFolderId = existingFolder.id;
            } else {
                // Create QSharer folder
                const { data: newFolder } = await supabase
                    .from('folders')
                    .insert({
                        name: '📱 큐쉐어러',
                        user_id: user.id,
                        scope: 'videos',
                        sort_order: 0,
                        parent_id: null
                    })
                    .select('id')
                    .single();

                if (newFolder) {
                    qsharerFolderId = newFolder.id;
                }
            }
        }

        const payloads = [];
        for (const v of videos) {
            let channelUuid = null;

            if (v.channel_id) {
                const { data: existingChannel } = await supabase
                    .from('channels')
                    .select('id')
                    .eq('youtube_channel_id', v.channel_id)
                    .eq('user_id', user.id)
                    .eq('scope', 'videos')
                    .single();

                if (existingChannel) {
                    channelUuid = existingChannel.id;
                } else {
                    const channelPayload: any = {
                        youtube_channel_id: v.channel_id,
                        title: v.channel_name || 'Unknown Channel',
                        user_id: user.id,
                        scope: 'videos',
                        status: 'active'
                    };

                    try {
                        const apiKey = process.env.YOUTUBE_API_KEY;
                        if (apiKey) {
                            const ytRes = await fetch(
                                `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${v.channel_id}&key=${apiKey}`
                            );
                            const ytData = await ytRes.json();
                            if (ytData.items && ytData.items.length > 0) {
                                const ch = ytData.items[0];
                                channelPayload.title = ch.snippet?.title || channelPayload.title;
                                channelPayload.thumbnail_url = ch.snippet?.thumbnails?.default?.url || null;
                                channelPayload.subscriber_count = Number(ch.statistics?.subscriberCount) || 0;
                                channelPayload.channel_created_at = ch.snippet?.publishedAt || null;
                            }
                        }
                    } catch (e) {
                        console.log('YouTube API call failed, using minimal channel info');
                    }

                    const { data: newChannel, error: insertError } = await supabase
                        .from('channels')
                        .insert(channelPayload)
                        .select('id')
                        .single();

                    if (insertError || !newChannel) {
                        console.error('Failed to create channel:', insertError);
                        return NextResponse.json({
                            ok: false,
                            message: `채널 생성 실패: ${insertError?.message || 'unknown error'}`
                        }, { status: 500 });
                    }

                    channelUuid = newChannel.id;
                }
            } else {
                return NextResponse.json({ ok: false, message: 'channel_id is required' }, { status: 400 });
            }

            payloads.push({
                youtube_video_id: v.youtube_video_id,
                channel_id: channelUuid,
                channel_name: v.channel_name || 'Unknown', // Fallback
                title: v.title,
                thumbnail_url: v.thumbnail_url,
                view_count: v.view_count || 0,
                published_at: v.published_at,
                user_id: user.id,
                collected_at: v.collected_at || new Date().toISOString(),
                folder_id: qsharerFolderId || v.folder_id || null, // Use QSharer folder if from app
                // New columns required by DB
                account_id: user.id, // Linked to user's main account ID
                platform: 'youtube',
                external_id: v.youtube_video_id,
                url: `https://www.youtube.com/watch?v=${v.youtube_video_id}`,
                source: source || 'web-app' // Preserve source from request
            });
        }

        const { data, error } = await supabase
            .from('videos')
            .upsert(payloads, {
                onConflict: 'user_id,youtube_video_id',
                ignoreDuplicates: true
            })
            .select();

        if (error) {
            console.error('Supabase POST Error:', error);
            return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, data, count: payloads.length }, { status: 201 });
    } catch (error) {
        console.error('Internal Server Error:', error);
        return NextResponse.json({ ok: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH: Update video folder
export async function PATCH(request: Request) {
    try {
        const supabase = getSupabaseServer(true);
        const user = await getAuthenticatedUser(request, supabase);

        if (!user) {
            return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { videoIds, folderId } = body;

        if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
            return NextResponse.json({ ok: false, message: 'videoIds array required' }, { status: 400 });
        }

        // Validate folder ownership if folderId is provided
        if (folderId) {
            const { data: folder, error: folderError } = await supabase
                .from('folders')
                .select('id')
                .eq('id', folderId)
                .eq('user_id', user.id)
                .single();

            if (folderError || !folder) {
                return NextResponse.json({ ok: false, message: 'Folder not found or unauthorized' }, { status: 404 });
            }
        }

        // Update videos
        const { error } = await supabase
            .from('videos')
            .update({ folder_id: folderId || null })
            .in('id', videoIds)
            .eq('user_id', user.id);

        if (error) {
            console.error('Supabase PATCH Error:', error);
            return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, message: `Updated ${videoIds.length} video(s)` });
    } catch (error) {
        console.error('Internal Server Error:', error);
        return NextResponse.json({ ok: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE: Delete videos
export async function DELETE(request: Request) {
    try {
        const supabase = getSupabaseServer(true);
        const user = await getAuthenticatedUser(request, supabase);

        if (!user) {
            return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const deleteAll = searchParams.get('all') === 'true';
        const id = searchParams.get('id');

        if (deleteAll) {
            const { error } = await supabase
                .from('videos')
                .delete()
                .eq('user_id', user.id);

            if (error) {
                return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
            }
            return NextResponse.json({ ok: true, message: 'All videos deleted' });
        }

        if (id) {
            const { error } = await supabase
                .from('videos')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) {
                return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
            }
            return NextResponse.json({ ok: true, message: 'Video deleted' });
        }

        return NextResponse.json({ ok: false, message: 'id or all=true required' }, { status: 400 });
    } catch (error) {
        console.error('Internal Server Error:', error);
        return NextResponse.json({ ok: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
