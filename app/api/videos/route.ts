import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { getSupabaseServer, getAuthenticatedUser } from '@/lib/supabase-server';
import { getYoutubeApiKey } from '@/lib/api-keys-server';

// CORS Helper
function corsHeaders(request: Request) {
    const origin = request.headers.get('origin');
    if (origin && (origin.startsWith('chrome-extension://') || origin.includes('localhost'))) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true',
        } as Record<string, string>;
    }
    return {};
}

// OPTIONS: Handle CORS preflight
export async function OPTIONS(request: Request) {
    return NextResponse.json({}, { headers: corsHeaders(request) });
}

// GET: Fetch videos for authenticated user
export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
        const supabase = getSupabaseServer(false, token);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
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
    console.log('[API] POST /api/videos called');
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
        const supabase = getSupabaseServer(false, token);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.log('[API] 401 Unauthorized - No User Found.');
            return NextResponse.json(
                { ok: false, message: 'Unauthorized' },
                { status: 401, headers: corsHeaders(request) }
            );
        }

        const body = await request.json();
        console.log(`[API] Request Body Source: ${body.source}, Video Count: ${body.videos?.length}`);

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

            // 0. Fallback: If channel_id is missing OR title is invalid ("Video"), fetch from YouTube API
            let channelId = v.channel_id;
            let channelName = v.channel_name;
            let videoTitle = v.title;
            let videoThumb = v.thumbnail_url;
            let videoPublishedAt = v.published_at;
            const platform = v.platform || 'youtube';

            // Check if we need to fetch fresh data (missing channel ID OR placeholder title)
            // AND ensure we only do this for YouTube videos
            const needsFetch = platform === 'youtube' && (!channelId || !videoTitle || videoTitle === 'Video');

            if (needsFetch) {
                console.log(`[API] Missing metadata for ${v.youtube_video_id} (Title: ${videoTitle}), fetching from YouTube API...`);
                try {
                    const apiKey = await getYoutubeApiKey(request);
                    if (apiKey) {
                        const vidRes = await fetch(
                            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${v.youtube_video_id}&key=${apiKey}`
                        );
                        const vidData = await vidRes.json();
                        if (vidData.items && vidData.items.length > 0) {
                            const vid = vidData.items[0];
                            // Overwrite with real data
                            channelId = vid.snippet.channelId;
                            channelName = vid.snippet.channelTitle;
                            videoTitle = vid.snippet.title; // Always use real title
                            videoThumb = vid.snippet.thumbnails?.maxres?.url || vid.snippet.thumbnails?.high?.url || vid.snippet.thumbnails?.default?.url;
                            videoPublishedAt = vid.snippet.publishedAt;

                            // Also update view count if it was 0
                            if (!v.view_count || v.view_count === 0) {
                                v.view_count = vid.statistics?.viewCount;
                            }

                            console.log(`[API] Fetched real metadata: ${videoTitle} (${channelId})`);
                        } else {
                            console.log(`[API] YouTube API returned no items for video ${v.youtube_video_id}`);
                        }
                    }
                } catch (e: any) {
                    console.log(`[API] YouTube Video API call failed: ${e.message}`);
                }
            }

            // 1. Channel Handling
            if (channelId) {
                const { data: existingChannel } = await supabase
                    .from('channels')
                    .select('id')
                    .eq('youtube_channel_id', channelId)
                    .eq('user_id', user.id)
                    .eq('scope', 'videos')
                    .single(); // Use single() carefully

                if (existingChannel) {
                    channelUuid = existingChannel.id;
                    // console.log(`[API] Found existing channel: ${channelUuid}`);
                } else {
                    console.log(`[API] Creating new channel for ${channelId}`);
                    const channelPayload: any = {
                        youtube_channel_id: channelId,
                        title: channelName || 'Unknown Channel',
                        user_id: user.id,
                        scope: 'videos',
                        status: 'active'
                    };

                    try {
                        // Only fetch YouTube Channel info if it's a YouTube channel
                        if (platform === 'youtube') {
                            const apiKey = await getYoutubeApiKey(request);
                            if (apiKey) {
                                const ytRes = await fetch(
                                    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
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
                        }
                    } catch (e) {
                        console.log('Channel metadata fetch failed, using minimal info');
                    }

                    const { data: newChannel, error: insertError } = await supabase
                        .from('channels')
                        .insert(channelPayload)
                        .select('id')
                        .single();

                    if (insertError) {
                        console.log(`[API] Channel creation failed: ${insertError.message}`);
                        return NextResponse.json({
                            ok: false,
                            message: `Channel Error: ${insertError.message}`
                        }, { status: 500, headers: corsHeaders(request) });
                    }
                    channelUuid = newChannel.id;
                    console.log(`[API] Created channel: ${channelUuid}`);
                }
            } else {
                return NextResponse.json({ ok: false, message: 'channel_id required (fetched failed)' }, { status: 400 });
            }

            // --- Parsing Helpers ---
            const parseViewCount = (str: any) => {
                if (!str) return 0;
                if (typeof str === 'number') return str;
                const s = String(str).replace(/,/g, '').toUpperCase();
                try {
                    if (s.includes('만')) return Math.floor(parseFloat(s.replace(/[^0-9.]/g, '')) * 10000);
                    if (s.includes('억')) return Math.floor(parseFloat(s.replace(/[^0-9.]/g, '')) * 100000000);
                    if (s.includes('K')) return Math.floor(parseFloat(s.replace(/[^0-9.]/g, '')) * 1000);
                    if (s.includes('M')) return Math.floor(parseFloat(s.replace(/[^0-9.]/g, '')) * 1000000);
                    if (s.includes('B')) return Math.floor(parseFloat(s.replace(/[^0-9.]/g, '')) * 1000000000);
                    const num = parseInt(s.replace(/[^0-9]/g, ''));
                    return isNaN(num) ? 0 : num;
                } catch (e) { return 0; }
            };

            const parseDate = (dateStr: any) => {
                if (!dateStr) return null;
                const d = String(dateStr).trim();

                // Relative time parsing (Simple approximation)
                // "2 days ago", "3 weeks ago", "1개월 전"
                const now = new Date();
                const relativeMatch = d.match(/(\d+)\s*(min|minute|hour|day|week|month|year|분|시간|일|주|개월|년)/i);

                if (relativeMatch) {
                    const val = parseInt(relativeMatch[1]);
                    const unit = relativeMatch[2].toLowerCase();
                    if (unit.startsWith('min') || unit.startsWith('분')) now.setMinutes(now.getMinutes() - val);
                    else if (unit.startsWith('hour') || unit.startsWith('시간')) now.setHours(now.getHours() - val);
                    else if (unit.startsWith('day') || unit.startsWith('일')) now.setDate(now.getDate() - val);
                    else if (unit.startsWith('week') || unit.startsWith('주')) now.setDate(now.getDate() - (val * 7));
                    else if (unit.startsWith('month') || unit.startsWith('개월')) now.setMonth(now.getMonth() - val);
                    else if (unit.startsWith('year') || unit.startsWith('년')) now.setFullYear(now.getFullYear() - val);
                    return now.toISOString();
                }

                // Absolute date parsing
                try {
                    const cleanStr = d.replace(/Premiered|Streamed|Started/gi, '').trim();
                    return new Date(cleanStr).toISOString();
                } catch (e) { return null; }
            };

            // ✅ NEW: Server-side Scaling using External Worker (Douyin/TikTok)
            // Uses full TubiQ clone for complete metadata extraction
            if (platform !== 'youtube' && v.url) {
                try {
                    const workerUrl = 'https://port-0-douyin-worker-mjk7tb329db087f3.sel3.cloudtype.app';
                    console.log(`[API] Scraping metadata for ${v.url} via douyin-worker`);

                    // Call the hybrid parsing endpoint (same as tubiq-douyin)
                    const workerRes = await fetch(`${workerUrl}/api/hybrid/video_data?url=${encodeURIComponent(v.url)}&minimal=true`, {
                        signal: AbortSignal.timeout(30000) // 30s timeout for full scrape
                    });

                    if (workerRes.ok) {
                        const workerData = await workerRes.json();
                        console.log(`[API] Worker response:`, JSON.stringify(workerData).slice(0, 200));

                        // Extract from response (TubiQ format)
                        if (workerData.data) {
                            const d = workerData.data;
                            videoTitle = d.desc || d.title || videoTitle;

                            // Correct extraction for TubiQ/Douyin thumbnail structure
                            if (d.cover_data && d.cover_data.cover && d.cover_data.cover.url_list) {
                                videoThumb = d.cover_data.cover.url_list[0];
                            } else if (d.cover_data && d.cover_data.origin_cover && d.cover_data.origin_cover.url_list) {
                                videoThumb = d.cover_data.origin_cover.url_list[0];
                            } else {
                                videoThumb = d.cover || d.origin_cover || videoThumb;
                            }

                            channelName = d.author?.nickname || d.author?.unique_id || channelName;

                            // Statistics
                            if (d.statistics) {
                                // Douyin API often returns play_count as 0, so we fall back to digg_count (likes)
                                // to show some engagement metric instead of just "0"
                                const playCount = d.statistics.play_count || 0;
                                const likeCount = d.statistics.digg_count || 0;
                                v.view_count = playCount > 0 ? playCount : likeCount;
                            }

                            // Create Time
                            if (d.create_time) {
                                // Douyin creates_time is unix timestamp (seconds)
                                v.published_at = new Date(d.create_time * 1000).toISOString();
                            }

                            console.log(`[API] Worker success: ${channelName} - ${videoTitle} - Views: ${d.statistics?.play_count}`);
                        }
                    } else {
                        console.warn(`[API] Worker HTTP error: ${workerRes.status}`);
                    }
                } catch (e) {
                    console.error(`[API] Worker execution failed for ${v.url}:`, e);
                }
            }

            payloads.push({
                youtube_video_id: v.youtube_video_id,
                channel_id: channelUuid,
                channel_name: channelName || 'Unknown',
                title: videoTitle,
                thumbnail_url: videoThumb,
                view_count: v.view_count ? parseViewCount(v.view_count) : 0, // Use updated v.view_count
                published_at: v.published_at ? (typeof v.published_at === 'string' ? v.published_at : new Date(v.published_at).toISOString()) : videoPublishedAt,
                user_id: user.id,
                account_id: user.id, // ✅ FIX: Add account_id (required by DB)
                platform: platform, // ✅ NEW: Save platform to DB
                collected_at: new Date().toISOString(),
                folder_id: qsharerFolderId || v.folder_id || null, // Use QSharer folder if from app
                // New columns required by DB
                external_id: v.youtube_video_id, // We use this column for external IDs for now
                url: platform === 'youtube'
                    ? `https://www.youtube.com/watch?v=${v.youtube_video_id}`
                    : (v.url || ''), // Use provided URL for other platforms
                source: source || 'web-app'
            });
        }

        // logToDebugFile(`[API] Upserting ${payloads.length} videos...`);

        const { data, error } = await supabase
            .from('videos')
            .upsert(payloads, {
                onConflict: 'user_id,youtube_video_id',
                ignoreDuplicates: true
            })
            .select();

        if (error) {
            console.error(`[API] Upsert Error: ${error.message}`);
            return NextResponse.json({ ok: false, message: error.message }, { status: 500, headers: corsHeaders(request) });
        }

        console.log(`[API] Success! Inserted/Updated: ${data?.length}`);
        return NextResponse.json(
            { ok: true, data, count: payloads.length },
            { status: 201, headers: corsHeaders(request) }
        );
    } catch (error: any) {
        console.error(`[API] Crash: ${error.message}`);
        return NextResponse.json({ ok: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH: Update video folder
export async function PATCH(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
        const supabase = getSupabaseServer(false, token);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
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
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
        const supabase = getSupabaseServer(false, token);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
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
