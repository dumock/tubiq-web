import { createClient } from "@supabase/supabase-js";
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    // Run multiple count queries in parallel
    const [totalRes, domesticRes, overseasRes] = await Promise.all([
        supabase.from('channels').select('*', { count: 'exact', head: true }).or('scope.eq.channels,scope.eq.assets,youtube_channel_id.ilike.UC_demo_%'),
        supabase.from('channels').select('*', { count: 'exact', head: true }).or('scope.eq.channels,scope.eq.assets,youtube_channel_id.ilike.UC_demo_%').eq('is_domestic', true),
        supabase.from('channels').select('*', { count: 'exact', head: true }).or('scope.eq.channels,scope.eq.assets,youtube_channel_id.ilike.UC_demo_%').eq('is_domestic', false)
    ]);

    const summary = {
        totalChannels: totalRes.count || 0,
        domesticChannels: domesticRes.count || 0,
        overseasChannels: overseasRes.count || 0,
        dailyGrowthRate: 5.2 // Mocked rate or could be calculated from added_at
    };

    return NextResponse.json({ ok: true, data: summary });
}
