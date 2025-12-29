import { createClient } from "@supabase/supabase-js";
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const filter = searchParams.get('filter') || 'all'; // all, domestic, overseas
    const topic = searchParams.get('topic') || 'all';
    const query = searchParams.get('query') || '';
    const sortBy = searchParams.get('sortBy') || 'added_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    // Build the query - Explicitly select only public columns
    let supabaseQuery = supabase
        .from('channels')
        .select('id, youtube_channel_id, title, thumbnail_url, subscriber_count, published_at, added_at, status, scope, is_domestic, topics_cached', { count: 'exact' });

    // 1. Mandatory Scope Filter (Include collector pool, manual assets, and demo channels)
    supabaseQuery = supabaseQuery.or(`scope.eq.channels,scope.eq.assets,youtube_channel_id.ilike.UC_demo_%`);

    // 2. Additional Filters
    if (filter === 'domestic') {
        supabaseQuery = supabaseQuery.eq('is_domestic', true);
    } else if (filter === 'overseas') {
        supabaseQuery = supabaseQuery.eq('is_domestic', false);
    }

    if (topic !== 'all') {
        // topics_cached is an array, we use contains or overlap if topics are stored names
        // If it's the UI display names, we can use overlaps
        supabaseQuery = supabaseQuery.contains('topics_cached', [topic]);
    }

    if (query) {
        supabaseQuery = supabaseQuery.ilike('title', `%${query}%`);
    }

    // 3. Sorting
    // Map UI keys to DB keys if needed
    const sortFieldMap: Record<string, string> = {
        name: 'title',
        subscribers: 'subscriber_count',
        totalViews: 'subscriber_count', // Fallback as view_count is missing
        videoCount: 'id', // Fallback as video_count is missing
        createdDate: 'published_at',
        collectedAt: 'added_at',
        dailyViews: 'subscriber_count' // Fallback
    };

    const dbSortField = sortFieldMap[sortBy] || 'added_at';
    supabaseQuery = supabaseQuery.order(dbSortField, { ascending: sortOrder === 'asc' });

    // 4. Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    supabaseQuery = supabaseQuery.range(from, to);

    const { data, count, error } = await supabaseQuery;

    if (error) {
        console.error('Error fetching collector channels:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // 5. Background Topic Assignment Trigger
    // Find channels that need topic connection (topics_cached is NULL or empty)
    const channelsNeedingTopics = (data || []).filter(row => !row.topics_cached || row.topics_cached.length === 0);

    if (channelsNeedingTopics.length > 0) {
        // We trigger this silently in the background (no await)
        // In a real production environment, this would be a queue or a focused cron job
        const protocol = req.headers.get('x-forwarded-proto') || 'http';
        const host = req.headers.get('host');
        const baseUrl = `${protocol}://${host}`;

        // Trigger for each channel (simplistic background fire-and-forget)
        channelsNeedingTopics.forEach(channel => {
            fetch(`${baseUrl}/api/collector/auto-assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId: channel.id })
            }).catch(e => console.error('Silent topic assignment trigger failed:', e));
        });
    }

    // Map DB data to UI interface
    const mappedChannels = (data || []).map(row => ({
        id: row.id,
        thumbnail: row.thumbnail_url || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100&h=100&fit=crop',
        name: row.title || 'Unknown',
        subscribers: row.subscriber_count || 0,
        totalViews: 0,
        videoCount: 0,
        createdDate: row.published_at ? row.published_at.split('T')[0].replace(/-/g, '.') : '-',
        country: '-',
        collectedAt: row.added_at ? row.added_at.split('T')[0].replace(/-/g, '.') : '-',
        isDomestic: row.is_domestic || false,
        topic: row.topics_cached && row.topics_cached.length > 0 ? row.topics_cached[0] : null,
        topics_cached: row.topics_cached || [],
        dailyViews: 0,
        channelUrl: row.youtube_channel_id ? `https://youtube.com/channel/${row.youtube_channel_id}` : '#'
    }));

    return NextResponse.json({
        ok: true,
        data: mappedChannels,
        pagination: {
            totalCount: count || 0,
            totalPages: Math.ceil((count || 0) / pageSize),
            currentPage: page
        }
    });
}
