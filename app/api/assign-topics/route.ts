import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

export async function POST(req: Request) {
    try {
        const { channelId, codes, score = 0.9 } = await req.json();

        if (!channelId || !Array.isArray(codes) || codes.length === 0) {
            return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
        }

        const { data: topics, error: topicsErr } = await supabase
            .from("topics")
            .select("id, code")
            .in("code", codes);
        if (topicsErr) throw topicsErr;

        const rows = topics.map(t => ({
            channel_id: channelId,
            topic_id: t.id,
            score,
        }));

        const { error: upsertErr } = await supabase
            .from("channel_topics")
            .upsert(rows, { onConflict: "channel_id,topic_id" });
        if (upsertErr) throw upsertErr;

        const { error: rpcErr } = await supabase
            .rpc("refresh_channel_topics_cache", { p_channel_id: channelId });
        if (rpcErr) throw rpcErr;

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("assign-topics failed:", e);
        return NextResponse.json(
            { ok: false, error: e?.message ?? "unknown" },
            { status: 500 }
        );
    }
}
