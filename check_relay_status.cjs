const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://urlbadjyzrwzzaaispce.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybGJhZGp5enJ3enphYWlzcGNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjMzNDU5OSwiZXhwIjoyMDgxOTEwNTk5fQ.nf6zvD7Pin18HFYk7uq2kViMgyIY6JUD0EVvAdUmVWQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("=== relay_videos 테이블 조회 ===");

    // Get latest 10 rows from relay_videos
    const { data: relayRows, error: relayErr } = await supabase
        .from("relay_videos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

    if (relayErr) {
        console.error("Error fetching relay_videos:", relayErr);
        return;
    }

    console.log(`Found ${relayRows?.length || 0} rows in relay_videos:`);
    for (const row of relayRows || []) {
        console.log("---");
        console.log("  id:", row.id);
        console.log("  account_id:", row.account_id);
        console.log("  user_id:", row.user_id);
        console.log("  external_id:", row.external_id);
        console.log("  platform:", row.platform);
        console.log("  processed:", row.processed);
        console.log("  error:", row.error);
        console.log("  memo:", row.memo);
        console.log("  created_at:", row.created_at);
    }

    console.log("\n=== videos 테이블 최신 5개 조회 ===");
    const { data: videoRows, error: videoErr } = await supabase
        .from("videos")
        .select("id, youtube_video_id, user_id, title, memo, collected_at")
        .order("collected_at", { ascending: false })
        .limit(5);

    if (videoErr) {
        console.error("Error fetching videos:", videoErr);
    } else {
        console.log(`Found ${videoRows?.length || 0} rows in videos:`);
        for (const v of videoRows || []) {
            console.log("---");
            console.log("  id:", v.id);
            console.log("  youtube_video_id:", v.youtube_video_id);
            console.log("  user_id:", v.user_id);
            console.log("  title:", v.title);
            console.log("  memo:", v.memo);
            console.log("  collected_at:", v.collected_at);
        }
    }
}

main().catch(console.error);
