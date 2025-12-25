/**
 * crawler-worker/index.mjs
 *
 * 역할:
 * - Supabase에 이미 존재하는 YouTube 채널(youtube_channel_id)을 대상으로
 * - YouTube Data API (channels.list)로
 *   snippet + statistics 기본 메타데이터 채우기
 *
 * 특징:
 * - long-running worker (무한 루프)
 * - quota 대비 API key 로테이션
 * - Cloudtype health check 서버 포함 (/healthz)
 */

import { createClient } from "@supabase/supabase-js";
import http from "http";

/* =========================
 * ENV
 * ========================= */
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  NODE_ENV = "production",
  PORT = 3000,
} = process.env;

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
  throw new Error("Missing at least one YOUTUBE_API_KEY");
}

/* =========================
 * Supabase
 * ========================= */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* =========================
 * Utils
 * ========================= */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pickKey = (i) => YT_KEYS[i % YT_KEYS.length];

/* =========================
 * Health Check (Cloudtype)
 * ========================= */
http
  .createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200);
      res.end("ok");
      return;
    }
    res.writeHead(404);
    res.end();
  })
  .listen(PORT, () => {
    console.log(`[health] listening on ${PORT} (/healthz)`);
  });

/* =========================
 * YouTube API
 * ========================= */
async function ytChannelsList(channelIds, key) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("id", channelIds.join(","));
  url.searchParams.set("key", key);

  const res = await fetch(url);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`YouTube API ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

/* =========================
 * DB Target Fetch
 * ========================= */
async function fetchTargets(limit = 50) {
  const { data, error } = await supabase
    .from("channels")
    .select(
      `
      youtube_channel_id,
      title,
      subscriber_count,
      view_count,
      video_count,
      thumbnail_url,
      country,
      published_at
    `
    )
    .like("youtube_channel_id", "UC%")
    .or(
      [
        "subscriber_count.is.null",
        "view_count.is.null",
        "video_count.is.null",
        "thumbnail_url.is.null",
        "country.is.null",
        "published_at.is.null",
      ].join(",")
    )
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/* =========================
 * Normalize
 * ========================= */
function normalizeChannel(item) {
  const snippet = item.snippet ?? {};
  const stats = item.statistics ?? {};
  const thumbs = snippet.thumbnails ?? {};

  return {
    youtube_channel_id: item.id,
    title: snippet.title ?? null,
    thumbnail_url:
      thumbs.high?.url ??
      thumbs.medium?.url ??
      thumbs.default?.url ??
      null,
    country: snippet.country ?? null,
    published_at: snippet.publishedAt
      ? new Date(snippet.publishedAt).toISOString()
      : null,
    subscriber_count: stats.subscriberCount
      ? Number(stats.subscriberCount)
      : null,
    view_count: stats.viewCount ? Number(stats.viewCount) : null,
    video_count: stats.videoCount ? Number(stats.videoCount) : null,
  };
}

/* =========================
 * Update DB
 * ========================= */
async function updateChannel(payload) {
  const { error } = await supabase
    .from("channels")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("youtube_channel_id", payload.youtube_channel_id);

  if (error) throw error;
}

/* =========================
 * Main Worker Loop
 * ========================= */
export async function startCrawler() {
  console.log(
    `[crawler] start env=${NODE_ENV}, yt_keys=${YT_KEYS.length}`
  );

  let keyIndex = 0;

  while (true) {
    try {
      const targets = await fetchTargets(50);

      if (targets.length === 0) {
        console.log("[crawler] no targets, sleep 60s");
        await sleep(60_000);
        continue;
      }

      const ids = targets.map((t) => t.youtube_channel_id);
      const key = pickKey(keyIndex++);
      const json = await ytChannelsList(ids, key);
      const items = json.items ?? [];

      const byId = new Map(items.map((it) => [it.id, it]));

      let updated = 0;
      for (const id of ids) {
        const item = byId.get(id);
        if (!item) continue;
        await updateChannel(normalizeChannel(item));
        updated++;
      }

      console.log(`[crawler] updated ${updated}/${ids.length}`);
      await sleep(1_000);
    } catch (err) {
      const msg = String(err?.message ?? err);
      console.error("[crawler] error:", msg);

      if (msg.includes("403") || msg.toLowerCase().includes("quota")) {
        console.error("[crawler] quota issue, switch key, sleep 10s");
        await sleep(10_000);
        continue;
      }

      await sleep(15_000);
    }
  }
}

/* =========================
 * Auto start
 * ========================= */
startCrawler().catch((e) => {
  console.error("[crawler] fatal:", e);
  process.exit(1);
});
