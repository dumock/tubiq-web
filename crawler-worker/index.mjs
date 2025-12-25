// crawler-worker/index.mjs
// 역할: DB에 이미 들어있는 채널(youtube_channel_id)을 대상으로
// YouTube Data API로 "기본 메타/구독자"만 채워넣기 (현재 DB 스키마 기준)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NODE_ENV = process.env.NODE_ENV ?? "production";

const YT_KEYS = [
  process.env.YOUTUBE_API_KEY_1,
  process.env.YOUTUBE_API_KEY_2,
  process.env.YOUTUBE_API_KEY_3,
  process.env.YOUTUBE_API_KEY_4,
].filter(Boolean);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}
if (YT_KEYS.length === 0) {
  throw new Error("Missing YOUTUBE_API_KEY_1 (and optional _2/_3/_4)");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

function pickKey(i) {
  return YT_KEYS[i % YT_KEYS.length];
}

async function ytChannelsList(channelIds, key) {
  const ids = channelIds.join(",");
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("id", ids);
  url.searchParams.set("key", key);

  // Node 22+ 에서는 fetch 내장
  const res = await fetch(url.toString());
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`YouTube API error ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

/**
 * ✅ 현재 네 DB에 없는 컬럼은 절대 select/update에 넣지 않는다.
 * - view_count, video_count, country, updated_at => 현재 없음(로그로 확인됨)
 * - 그래서 title/subscriber_count/thumbnail_url/published_at만 다룬다.
 */
async function fetchTargets(batchSize = 50) {
  // "비어있는 필드" 기준으로 대상 잡기
  // published_at / thumbnail_url / subscriber_count 중 하나라도 null이면 대상
  const { data, error } = await supabase
    .from("channels")
    .select("youtube_channel_id, title, subscriber_count, thumbnail_url, published_at")
    .like("youtube_channel_id", "UC%")
    .or(
      [
        "subscriber_count.is.null",
        "thumbnail_url.is.null",
        "published_at.is.null",
        "title.is.null",
      ].join(",")
    )
    .limit(batchSize);

  if (error) throw error;
  return data ?? [];
}

function normalizeChannel(item) {
  const snippet = item.snippet ?? {};
  const stats = item.statistics ?? {};
  const thumbs = snippet.thumbnails ?? {};
  const bestThumb =
    thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? null;

  // ✅ 현재 DB에 존재하는 컬럼만 반환
  return {
    youtube_channel_id: item.id,
    title: snippet.title ?? null,
    thumbnail_url: bestThumb,
    published_at: snippet.publishedAt ? new Date(snippet.publishedAt).toISOString() : null,
    subscriber_count: stats.subscriberCount ? Number(stats.subscriberCount) : null,
  };
}

async function updateChannelRow(payload) {
  // ✅ updated_at 같은 없는 컬럼은 절대 넣지 않음
  const { youtube_channel_id, ...updates } = payload;

  const { error } = await supabase
    .from("channels")
    .update({
      ...updates,
      // (주의) DB에 updated_at 컬럼이 없으니 여기서 넣으면 또 터짐
    })
    .eq("youtube_channel_id", youtube_channel_id);

  if (error) throw error;
}

export async function startCrawler() {
  console.log(`[crawler] start. env=${NODE_ENV}, yt_keys=${YT_KEYS.length}`);

  let keyIdx = 0;
  let loops = 0;
  let lastWorkAt = Date.now();

  // ✅ “살아있음” 로그(너가 ‘아무 로그가 안 찍혀서 불안’했던 문제 해결)
  setInterval(() => {
    const secs = Math.floor((Date.now() - lastWorkAt) / 1000);
    console.log(`[crawler][hb] alive. loops=${loops}, lastWork=${secs}s ago`);
  }, 60_000);

  while (true) {
    loops += 1;

    let targets;
    try {
      targets = await fetchTargets(50);
    } catch (e) {
      console.error("[crawler] fetchTargets error:", String(e?.message ?? e));
      await sleep(15_000);
      continue;
    }

    if (targets.length === 0) {
      console.log("[crawler] no targets. sleep 60s");
      await sleep(60_000);
      continue;
    }

    const ids = targets.map((t) => t.youtube_channel_id);

    try {
      const key = pickKey(keyIdx++);
      const json = await ytChannelsList(ids, key);
      const items = json.items ?? [];

      const byId = new Map(items.map((it) => [it.id, it]));

      let updated = 0;
      for (const id of ids) {
        const item = byId.get(id);
        if (!item) continue;

        const payload = normalizeChannel(item);
        await updateChannelRow(payload);
        updated += 1;
      }

      lastWorkAt = Date.now();
      console.log(`[crawler] updated ${updated}/${ids.length} channels (api_items=${items.length})`);

      // 너무 빠르게 돌면 API/DB 부담
      await sleep(1000);
    } catch (e) {
      const msg = String(e?.message ?? e);
      console.error("[crawler] error:", msg);

      // quota/403이면 키 바꿔가며 버팀
      if (msg.includes("403") || msg.toLowerCase().includes("quota")) {
        console.error("[crawler] quota/403 suspected. switching key and sleep 10s");
        await sleep(10_000);
        continue;
      }

      await sleep(15_000);
    }
  }
}

// ✅ 중요: import만 하면 안 돌고, 실행을 해줘야 함.
// worker-runner가 이 파일을 import만 하는 구조면 아래 줄이 있어야 실제 실행됨.
startCrawler().catch((e) => {
  console.error("[crawler] fatal:", e);
  process.exit(1);
});
