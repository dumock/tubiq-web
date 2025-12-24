// collector-worker/index.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// KST 날짜(YYYY-MM-DD) 만들기
function kstDateString(d = new Date()) {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function youtubeChannelsByIds(ids) {
  // YouTube Data API: channels.list (최대 50개/요청)
  const url =
    "https://www.googleapis.com/youtube/v3/channels" +
    `?part=snippet,statistics` +
    `&id=${encodeURIComponent(ids.join(","))}` +
    `&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`YouTube API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function upsertDailySnapshot(supabase, channels) {
  const today = kstDateString();

  // channels: supabase의 channels 테이블 row들
  // -> youtube_channel_id 모아서 YouTube에서 통계 가져오기
  const idMap = new Map(); // youtube_channel_id => channelRow
  for (const c of channels) idMap.set(c.youtube_channel_id, c);

  const ytIds = channels.map((c) => c.youtube_channel_id).filter(Boolean);
  const batches = chunk(ytIds, 50);

  for (const batch of batches) {
    const data = await youtubeChannelsByIds(batch);

    const updates = [];
    const dailyRows = [];

    for (const item of data.items ?? []) {
      const row = idMap.get(item.id);
      if (!row) continue;

      const snippet = item.snippet ?? {};
      const stats = item.statistics ?? {};

      const viewCount = Number(stats.viewCount ?? 0);
      const subCount = Number(stats.subscriberCount ?? 0);
      const videoCount = Number(stats.videoCount ?? 0);

      // channels 테이블 최신값 반영 (원하면)
      updates.push({
        id: row.id,
        title: snippet.title ?? row.title ?? null,
        thumbnail_url:
          snippet.thumbnails?.high?.url ??
          snippet.thumbnails?.default?.url ??
          row.thumbnail_url ??
          null,
        subscriber_count: subCount,
        // (원하면 channels에 view_count, video_count 컬럼도 만들어서 저장해도 됨)
        updated_at: new Date().toISOString(),
      });

      // 일 스냅샷 저장
      dailyRows.push({
        channel_id: row.id,
        date: today,
        view_count: viewCount,
        subscriber_count: subCount,
        video_count: videoCount,
      });
    }

    // channels upsert(업데이트)
    if (updates.length > 0) {
      const { error } = await supabase
        .from("channels")
        .upsert(updates, { onConflict: "id" });

      if (error) throw error;
    }

    // channel_daily_stats upsert (channel_id + date 유니크)
    if (dailyRows.length > 0) {
      const { error } = await supabase
        .from("channel_daily_stats")
        .upsert(dailyRows, { onConflict: "channel_id,date" });

      if (error) throw error;
    }

    // YouTube API 쿼터/레이트리밋 완화용 약간 텀
    await sleep(200);
  }
}

async function computeDailyViewsIfColumnExists(supabase) {
  // channels.daily_view_count 컬럼을 만든 경우에만 의미 있음.
  // (없어도 channel_daily_stats로 계산해서 화면에서 보여줄 수 있어.)
  const today = kstDateString();
  const yesterday = kstDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));

  // 오늘/어제 스냅샷을 읽어서 diff 계산
  const { data: todayRows, error: e1 } = await supabase
    .from("channel_daily_stats")
    .select("channel_id, view_count")
    .eq("date", today);

  if (e1) throw e1;
  if (!todayRows?.length) return;

  const { data: yRows, error: e2 } = await supabase
    .from("channel_daily_stats")
    .select("channel_id, view_count")
    .eq("date", yesterday);

  if (e2) throw e2;

  const yMap = new Map((yRows ?? []).map((r) => [r.channel_id, r.view_count]));

  const updates = todayRows.map((r) => {
    const y = Number(yMap.get(r.channel_id) ?? r.view_count); // 어제 없으면 0차이로 처리
    const t = Number(r.view_count ?? 0);
    return {
      id: r.channel_id,
      daily_view_count: Math.max(0, t - y),
    };
  });

  // channels에 daily_view_count 컬럼이 없으면 여기서 에러날 수 있음.
  // 그 경우 이 함수 호출을 빼면 됨.
  const { error } = await supabase
    .from("channels")
    .upsert(updates, { onConflict: "id" });

  if (error) {
    console.log("daily_view_count update skipped:", error.message);
  }
}

async function runOnce() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!YOUTUBE_API_KEY) {
    throw new Error("Missing YOUTUBE_API_KEY");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 수집 대상 채널 가져오기
  // - 너 테이블 구조상 youtube_channel_id가 있어야 함
  // - status가 active인 것만
  const { data: channels, error } = await supabase
    .from("channels")
    .select("id, youtube_channel_id, title, thumbnail_url, subscriber_count")
    .eq("status", "active");

  if (error) throw error;

  if (!channels || channels.length === 0) {
    console.log(`[${new Date().toISOString()}] No active channels.`);
    return;
  }

  console.log(
    `[${new Date().toISOString()}] Collecting ${channels.length} channels...`
  );

  await upsertDailySnapshot(supabase, channels);

  // (선택) channels 테이블에 daily_view_count 컬럼 만든 경우에만 의미 있음
  await computeDailyViewsIfColumnExists(supabase);

  console.log(`[${new Date().toISOString()}] Done.`);
}

function msUntilNextKst(hour = 0, minute = 10) {
  // KST 기준 다음 (hour:minute)까지 남은 ms
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const next = new Date(kstNow);
  next.setHours(hour, minute, 0, 0);
  if (next <= kstNow) next.setDate(next.getDate() + 1);

  const diff = next.getTime() - kstNow.getTime();
  return Math.max(1000, diff);
}

async function main() {
  console.log("collector-worker started");

  // 시작하자마자 1회 실행
  try {
    await runOnce();
  } catch (e) {
    console.error("runOnce error:", e);
  }

  // 이후 매일 KST 00:10에 실행 (원하면 시간 바꿔도 됨)
  while (true) {
    const wait = msUntilNextKst(0, 10);
    console.log(`Next run in ${(wait / 1000 / 60).toFixed(1)} minutes`);
    await sleep(wait);

    try {
      await runOnce();
    } catch (e) {
      console.error("scheduled run error:", e);
      // 에러 나도 루프 계속
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
