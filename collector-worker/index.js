/**
 * collector-worker
 * - Supabase channels 테이블에서 youtube_channel_id 목록 조회
 * - YouTube Data API (channels.list)로 통계 가져오기
 * - channel_daily_stats에 (channel_id, date) 기준 upsert
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// 실행 주기(밀리초): 6시간마다 한 번 (upsert라 하루에 여러 번 돌아도 같은 날짜는 갱신됨)
const RUN_EVERY_MS = 6 * 60 * 60 * 1000;

// 유튜브 channels.list는 한 번에 최대 50개 id
const YT_MAX_IDS_PER_CALL = 50;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !YOUTUBE_API_KEY) {
  console.error("❌ Missing env vars. Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function kstDateString(d = new Date()) {
  // KST = UTC+9
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchChannelsFromSupabase() {
  // 필요한 컬럼만 가져오기
  // status 컬럼이 있으면 active만 가져오고 싶다면 아래 주석 해제
  // .eq("status", "active")
  const { data, error } = await supabase
    .from("channels")
    .select("id, youtube_channel_id")
    .not("youtube_channel_id", "is", null);

  if (error) throw error;

  // youtube_channel_id 비어있는거 제거
  const rows = (data || []).filter((r) => r.youtube_channel_id && String(r.youtube_channel_id).trim() !== "");
  return rows;
}

async function fetchYouTubeStatsByIds(youtubeChannelIds) {
  const idsParam = youtubeChannelIds.join(",");
  const url =
    "https://www.googleapis.com/youtube/v3/channels" +
    `?part=snippet,statistics&id=${encodeURIComponent(idsParam)}` +
    `&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`YouTube API error: ${res.status} ${res.statusText} :: ${txt}`);
  }

  const json = await res.json();
  const items = json.items || [];

  // map: youtube_channel_id -> stats
  const map = new Map();
  for (const item of items) {
    const ytId = item.id;
    const stats = item.statistics || {};
    map.set(ytId, {
      view_count: Number(stats.viewCount || 0),
      subscriber_count: Number(stats.subscriberCount || 0),
      video_count: Number(stats.videoCount || 0),
      // 필요하면 title/thumbnail 등도 여기서 뽑아서 channels 업데이트 가능
    });
  }
  return map;
}

async function upsertDailyStats(channelRows, ytStatsMap, dateStr) {
  const payload = [];

  for (const row of channelRows) {
    const stats = ytStatsMap.get(row.youtube_channel_id);
    if (!stats) continue; // YouTube에서 못 찾는 ID는 스킵

    payload.push({
      channel_id: row.id,
      date: dateStr,
      view_count: stats.view_count,
      subscriber_count: stats.subscriber_count,
      video_count: stats.video_count,
    });
  }

  if (payload.length === 0) {
    console.log("⚠️ No stats payload to upsert.");
    return;
  }

  const { error } = await supabase
    .from("channel_daily_stats")
    .upsert(payload, { onConflict: "channel_id,date" });

  if (error) throw error;

  console.log(`✅ Upserted ${payload.length} rows into channel_daily_stats for ${dateStr}`);
}

async function runOnce() {
  const today = kstDateString();
  console.log(`\n🚀 collector-worker runOnce() start - KST date=${today}`);

  const channelRows = await fetchChannelsFromSupabase();
  console.log(`📦 channels loaded: ${channelRows.length}`);

  const idChunks = chunk(channelRows.map((r) => r.youtube_channel_id), YT_MAX_IDS_PER_CALL);

  // youtube stats를 모아서 한 번에 upsert하기 위해, 전체 map 구성
  const mergedMap = new Map();

  for (let i = 0; i < idChunks.length; i++) {
    const ids = idChunks[i];
    console.log(`🔎 YouTube API batch ${i + 1}/${idChunks.length} (size=${ids.length})`);
    const map = await fetchYouTubeStatsByIds(ids);
    for (const [k, v] of map.entries()) mergedMap.set(k, v);

    // 쿼터/레이트 완화용 약간의 딜레이(필요시 조정)
    await new Promise((r) => setTimeout(r, 250));
  }

  await upsertDailyStats(channelRows, mergedMap, today);

  console.log(`🏁 collector-worker done - ${new Date().toISOString()}`);
}

async function main() {
  // 시작하자마자 1번 실행
  try {
    await runOnce();
  } catch (e) {
    console.error("❌ runOnce failed:", e);
  }

  // 주기 실행
  setInterval(async () => {
    try {
      await runOnce();
    } catch (e) {
      console.error("❌ runOnce failed:", e);
    }
  }, RUN_EVERY_MS);

  // 프로세스 살아있음 표시
  setInterval(() => console.log("alive..."), 60_000);
}

main();
