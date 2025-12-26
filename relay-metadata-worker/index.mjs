// relay-metadata-worker/index.mjs
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RELAY_TABLE = process.env.SUPABASE_TABLE_RELAY_VIDEOS || "relay_videos";
const VIDEOS_TABLE = process.env.SUPABASE_TABLE_VIDEOS || "videos";

const pollIntervalSec = Number(process.env.POLL_INTERVAL_SEC || 10);
const batchSize = Number(process.env.BATCH_SIZE || 50);

function transformRelayToVideoDb(relayRow) {
  // relayRow에 user_id, channel_id가 있어야 videos에 정상 insert 가능
  return {
    user_id: relayRow.user_id,
    channel_id: relayRow.channel_id,
    youtube_video_id: relayRow.external_id, // relay_videos.external_id -> videos.youtube_video_id
    title: relayRow.title ?? relayRow.external_id ?? "", // 임시
    thumbnail_url: relayRow.thumbnail_url ?? null,        // 임시
  };
}

async function processOnce() {
  // 1) 미처리 relay_videos 읽기
  const { data: relayRows, error: readErr } = await supabase
    .from(RELAY_TABLE)
    .select("*")
    .eq("processed", false)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (readErr) throw readErr;
  if (!relayRows?.length) {
    console.log("[relay-metadata-worker] no jobs");
    return;
  }

  // 2) 변환 + 필수값 체크
  const payload = [];
  const processedIds = [];

  for (const row of relayRows) {
    if (!row.user_id || !row.channel_id || !row.external_id) {
      console.error("[relay-metadata-worker] missing required fields:", {
        id: row.id,
        user_id: row.user_id,
        channel_id: row.channel_id,
        external_id: row.external_id,
      });
      continue;
    }
    payload.push(transformRelayToVideoDb(row));
    processedIds.push(row.id);
  }

  if (!payload.length) return;

  // 3) videos upsert (youtube_video_id로 중복 방지)
  const { error: upsertErr } = await supabase
    .from(VIDEOS_TABLE)
    .upsert(payload, { onConflict: "youtube_video_id" });

  if (upsertErr) throw upsertErr;

  // 4) relay_videos 처리완료 표시
  const { error: updateErr } = await supabase
    .from(RELAY_TABLE)
    .update({ processed: true, processed_at: new Date().toISOString() })
    .in("id", processedIds);

  if (updateErr) throw updateErr;

  console.log(`[relay-metadata-worker] processed: ${processedIds.length}`);
}

export async function main() {
  console.log("🧩 relay-metadata-worker started");
  while (true) {
    try {
      await processOnce();
    } catch (e) {
      console.error("[relay-metadata-worker] error:", e);
    }
    await new Promise((r) => setTimeout(r, pollIntervalSec * 1000));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("[relay-metadata-worker] fatal:", e);
    process.exit(1);
  });
}
