import { createClient } from "@supabase/supabase-js";
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { channelId } = await req.json();

        if (!channelId) {
            return NextResponse.json({ ok: false, error: "missing_channel_id" }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        // 1. Fetch channel info to determine some default topic if possible
        const { data: channel, error: fetchErr } = await supabase
            .from('channels')
            .select('title, description')
            .eq('id', channelId)
            .single();

        if (fetchErr || !channel) throw fetchErr || new Error('Channel not found');

        // 2. Simple Rule-based classification (Placeholder for AI/Deep logic)
        // For now, let's assign '/m/02jjt' (Entertainment/Humor) as a default if nothing found
        // This simulates "automatic classification"
        const defaultTopicCode = '/m/02jjt';

        // 3. Connect the topic (using existing logic pattern)
        const { data: topic, error: topicErr } = await supabase
            .from("topics")
            .select("id")
            .eq("code", defaultTopicCode)
            .single();

        if (topicErr) throw topicErr;

        // 4. Update channel_topics
        const { error: upsertErr } = await supabase
            .from("channel_topics")
            .upsert([
                { channel_id: channelId, topic_id: topic.id, score: 0.8 }
            ], { onConflict: "channel_id,topic_id" });

        if (upsertErr) throw upsertErr;

        // 5. Refresh cache
        const { error: rpcErr } = await supabase
            .rpc("refresh_channel_topics_cache", { p_channel_id: channelId });

        if (rpcErr) throw rpcErr;

        console.log(`[AutoAssign] Successfully connected topic ${defaultTopicCode} to channel ${channelId}`);

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('[AutoAssign] Failed:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
