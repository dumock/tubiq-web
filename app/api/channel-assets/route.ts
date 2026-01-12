import { NextResponse } from 'next/server';
import { getSupabaseServer, getAuthenticatedUser } from '@/lib/supabase-server';
import { getYoutubeApiKey } from '@/lib/api-keys-server';

export async function GET(request: Request) {
    try {
        // 1. Extract Token manually
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

        // 2. Create Authenticated Client (RLS enabled, using our new helper)
        const supabase = getSupabaseServer(false, token);

        // 3. User verification via Auth (RLS safety)
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
        }

        // Parse scope from query params (e.g., ?scope=analysis)
        const { searchParams } = new URL(request.url);
        const scopeParam = searchParams.get('scope') || 'channels'; // Default to 'channels' for channel-assets

        // Get user_channels JOINed with channels info, strictly filtered by user_id and scope
        let query = supabase
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
                    channel_created_at,
                    added_at,
                    status,
                    scope,
                    platform
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.error('Supabase GET Error:', error);
            return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
        }

        // Filter by scope on the joined channels data
        const filteredData = data?.filter((row: any) => {
            const channelScope = row.channels?.scope;
            return channelScope === scopeParam;
        }) || [];

        return NextResponse.json({ ok: true, data: filteredData });
    } catch (error: any) {
        console.error('Internal Server Error:', error);
        return NextResponse.json({ ok: false, message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        // 1. Extract Token manually
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

        // 2. Create Authenticated Client
        const supabase = getSupabaseServer(false, token);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { youtube_channel_id, title, thumbnail_url, subscriber_count, published_at, collected_at, folder_id, scope, platform } = body;
        console.log('[API] POST channel-assets payload:', {
            youtube_channel_id,
            title,
            hasThumbnail: !!thumbnail_url,
            thumbnail_url: thumbnail_url?.slice(0, 50) + '...',
            platform
        });
        const channelScope = scope || 'channels';
        const channelPlatform = platform || 'youtube'; // Default to YouTube

        // Helper to parse subscriber count string to integer
        const parseSubCount = (count: any) => {
            if (typeof count === 'number') return count;
            if (!count) return 0;
            const str = String(count).toUpperCase().replace(/,/g, '');

            try {
                if (str.includes('만')) {
                    return Math.floor(parseFloat(str.replace(/[^0-9.]/g, '')) * 10000);
                }
                if (str.includes('억')) {
                    return Math.floor(parseFloat(str.replace(/[^0-9.]/g, '')) * 100000000);
                }
                if (str.includes('K')) {
                    return Math.floor(parseFloat(str.replace(/[^0-9.]/g, '')) * 1000);
                }
                if (str.includes('M')) {
                    return Math.floor(parseFloat(str.replace(/[^0-9.]/g, '')) * 1000000);
                }
                // Try parsing as plain number
                const num = parseInt(str.replace(/[^0-9]/g, ''));
                return isNaN(num) ? 0 : num;
            } catch (e) {
                return 0;
            }
        };

        const parsedSubCount = parseSubCount(subscriber_count);

        // Helper to parse localized date string (e.g. "가입일: 2020. 1. 3." or "Joined Jan 1, 2020")
        const parseDate = (dateStr: any) => {
            if (!dateStr) return null;
            try {
                // Remove common prefixes
                const cleanStr = String(dateStr)
                    .replace(/Joined|가입일|:|Se unió|Beitritt|Rejoit/gi, '')
                    .trim();

                // Keep only numeric and separator chars for standard parsing
                // Note: "2020. 1. 3." with dot needs care.
                const dotDate = cleanStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
                if (dotDate) {
                    return new Date(`${dotDate[1]}-${dotDate[2]}-${dotDate[3]}`).toISOString();
                }

                const date = new Date(cleanStr);
                if (!isNaN(date.getTime())) {
                    return date.toISOString();
                }
            } catch (e) {
                console.error('Date parse error:', e);
            }
            return null;
        };

        let parsedPublishedAt = parseDate(published_at);

        // Failsafe: If published_at is missing, try to fetch it from YouTube directly (only for YouTube platform)
        const isYouTubePlatform = channelPlatform === 'youtube';
        if (!parsedPublishedAt && youtube_channel_id && scope !== 'videos' && isYouTubePlatform) { // Don't fetch for video artifacts or non-YouTube platforms
            try {
                const apiKey = await getYoutubeApiKey(request);
                if (apiKey) {
                    const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${youtube_channel_id}&key=${apiKey}`);
                    if (ytRes.ok) {
                        const ytData = await ytRes.json();
                        if (ytData.items && ytData.items.length > 0) {
                            const fetchedDate = ytData.items[0].snippet?.publishedAt;
                            if (fetchedDate) {
                                console.log(`[API] Refetched publishedAt for ${title}:`, fetchedDate);
                                parsedPublishedAt = new Date(fetchedDate).toISOString();
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn('Failed to refetch channel date:', err);
            }
        }

        // Use parsed date, or collected_at, or now as fallback
        const effectivePublishedAt = parsedPublishedAt || (collected_at ? new Date(collected_at).toISOString() : new Date().toISOString());

        // 1. Check if channel already exists (GLOBAL CHECK to avoid unique_id constraint violation)
        const { data: existingChannel } = await supabase
            .from('channels')

            .select('id')
            .eq('youtube_channel_id', youtube_channel_id)
            .single();

        let channelId: string;

        if (existingChannel) {
            // Channel already exists: Update metadata and use ID
            channelId = existingChannel.id;

            // Perform update to refresh metadata (e.g. subscriber count, thumbnail)
            const { error: updateError } = await supabase
                .from('channels')
                .update({
                    title,
                    thumbnail_url,
                    subscriber_count: parsedSubCount,
                    channel_created_at: effectivePublishedAt,
                    updated_at: new Date().toISOString(),
                    scope: channelScope, // Force update scope (e.g. promote 'videos' -> 'channels')
                    platform: channelPlatform // Update platform
                })
                .eq('id', channelId);

            if (updateError) console.error('Failed to update channel metadata:', updateError);

        } else {
            // Create new channel record for this scope
            const channelPayload = {
                youtube_channel_id,
                title,
                thumbnail_url,
                subscriber_count: parsedSubCount, // Use parsed integer
                channel_created_at: effectivePublishedAt, // Map to correct DB column
                user_id: user.id,
                scope: channelScope,
                platform: channelPlatform, // Store platform (youtube, tiktok, douyin)
                status: 'active',
                added_at: new Date().toISOString(),
            };

            const { data: channelData, error: channelError } = await supabase
                .from('channels')
                .insert(channelPayload)
                .select('id')
                .single();

            if (channelError) {
                console.error('Channel Insert Error payload:', channelPayload);
                throw channelError;
            }
            channelId = channelData.id;
        }

        // 2. Link to user_channels with strict user_id assignment
        const userChannelPayload = {
            user_id: user.id,
            channel_id: channelId,
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
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
        const supabase = getSupabaseServer(false, token);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

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
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
        const supabase = getSupabaseServer(false, token);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

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
