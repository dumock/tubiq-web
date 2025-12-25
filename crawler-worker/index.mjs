// crawler-worker/index.mjs
// 역할: channels 테이블에 이미 있는 youtube_channel_id 대상으로
// YouTube Data API(channels.list)로 "기초 메타" 채워넣기
//
// ✅ 현재 DB 스키마 기준으로 업데이트하는 컬럼:
// - title
// - subscriber_count
// - thumbnail_url
// - published_at
//
// ❌ DB에 없어서 절대 건드리지 않는 컬럼:
// - view_count
// - video_count
// - country

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
const pickKey = (i) => YT_KEYS[i % YT_KEYS.length];

async function ytChannelsList(channelIds, key) {
  const ids = channelIds.join(",");
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("id", ids);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`YouTube API error ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

async function fetchTargets(batchSize = 50) {
  // ✅ 현재 channels 테이블에 "있는 컬럼"만 select 해야 함
  // 비어있는 값들만 골라서 대상 잡기
  const { data, error } = await supabase
    .from("channels")
    .select("youtube_channel_id, title, subscriber_count, thumbnail_url, published_at")
    .like("youtube_channel_id", "UC_%")
    .or(
      [
        "title.is.null",
        "subscriber_count.is.null",
        "thumbnail_url.is.null",
        "published_at.is.null",
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

  return {
    youtube_channel_id: item.id,
    title: snippet.title ?? null,
    thumbnail_url: bestThumb,
    published_at: snippet.publishedAt
      ? new Date(snippet.publishedAt).toISOString()
      : null,
    subscriber_count: stats.subscriberCount
      ? Number(stats.subscriberCount)
      : null,
  };
}

async function updateChannelRow(payload) {
  // ✅ DB에 존재하는 컬럼만 update 해야 함
  const { error } = await supabase
    .from("channels")
    .update({
      title: payload.title,
      subscriber_count: payload.subscriber_count,
      thumbnail_url: payload.thumbnail_url,
      published_at: payload.published_at,
      updated_at: new Date().toISOString(),
    })
    .eq("youtube_channel_id", payload.youtube_channel_id);

  if (error) throw error;
}

export async function startCrawler() {
  console.log(`[crawler] start. env=${NODE_ENV}, yt_keys=${YT_KEYS.length}`);

  let keyIdx = 0;
  let loops = 0;
  let lastWorkAt = Date.now();

  // 하트비트: "진짜 살아있는지" 30초마다 찍기
  setInterval(() => {
    const ago = Math.round((Date.now() - lastWorkAt) / 1000);
    console.log(`[crawler][hb] alive. loops=${loops}, lastWork=${ago}s ago`);
  }, 30_000).unref?.();

  while (true) {
    loops += 1;

    let targets = [];
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
      console.log(`[crawler] updated ${updated}/${ids.length} channels`);
      await sleep(1000);
    } catch (e) {
      const msg = String(e?.message ?? e);
      console.error("[crawler] error:", msg);

      if (msg.includes("403") || msg.toLowerCase().includes("quota")) {
        console.error("[crawler] quota/403 suspected. switching key and sleep 10s");
        await sleep(10_000);
        continue;
      }

      await sleep(15_000);
    }
  }
}

// ✅ worker-runner.cjs가 import만 해도 자동 실행되도록
startCrawler().catch((e) => {
  console.error("[crawler] fatal:", e);
  process.exit(1);
});
