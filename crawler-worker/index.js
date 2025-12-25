// crawler-worker/index.js
// 역할: DB에 이미 들어있는 채널(youtube_channel_id)을 대상으로 YouTube Data API로 상세 메타/통계 채워넣기
// - quota 효율: channels.list (part=snippet,statistics) 는 보통 1 unit
// - daily view 같은 건 YouTube Analytics 권한 없으면 못 가져오니, 여기서는 "기초 필드 채우기"에 집중

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

function pickKey(i) {
  return YT_KEYS[i % YT_KEYS.length];
}

async function ytChannelsList(channelIds, key) {
  const ids = channelIds.join(",");
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("id", ids);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) {
    // quota 초과/키 제한/403 등을 그대로 노출
    throw new Error(`YouTube API error ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

async function fetchTargets(batchSize = 50) {
  // "비어있는 필드" 기준으로 크롤 대상 선택
  // 아래 컬럼들이 실제 DB에 없다면, 조건을 너희 스키마에 맞게 바꿔야 함.
  // 가장 안전한 기본은: topics_cached가 null인 채널만 대상 등으로 잡는 것.
  const { data, error } = await supabase
    .from("channels")
    .select("youtube_channel_id, title, subscriber_count, view_count, video_count, thumbnail_url, country, published_at")
    .like("youtube_channel_id", "UC_%")
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
    country: snippet.country ?? null,
    published_at: snippet.publishedAt ? new Date(snippet.publishedAt).toISOString() : null,
    subscriber_count: stats.subscriberCount ? Number(stats.subscriberCount) : null,
    view_count: stats.viewCount ? Number(stats.viewCount) : null,
    video_count: stats.videoCount ? Number(stats.videoCount) : null,
    // 필요하면 status/scope 등도 여기서 세팅 가능
  };
}

async function updateChannelRow(payload) {
  // youtube_channel_id 기준으로 update
  const { error } = await supabase
    .from("channels")
    .update({
      ...payload,
      // 운영에서 "마지막 수집 시각" 같은 컬럼이 있으면 같이 갱신
      updated_at: new Date().toISOString(),
    })
    .eq("youtube_channel_id", payload.youtube_channel_id);

  if (error) throw error;
}

export async function startCrawler() {
  console.log(`[crawler] start. env=${NODE_ENV}, keys=${YT_KEYS.length}`);

  let keyIdx = 0;

  while (true) {
    const targets = await fetchTargets(50);

    if (targets.length === 0) {
      console.log("[crawler] no targets. sleep 60s");
      await sleep(60_000);
      continue;
    }

    // YouTube channels.list는 id를 여러개 한번에 받을 수 있음 (최대 50개)
    const ids = targets.map((t) => t.youtube_channel_id);

    try {
      const key = pickKey(keyIdx++);
      const json = await ytChannelsList(ids, key);
      const items = json.items ?? [];

      // 응답을 map으로 만들어 update 빠르게
      const byId = new Map(items.map((it) => [it.id, it]));

      for (const id of ids) {
        const item = byId.get(id);
        if (!item) continue;

        const payload = normalizeChannel(item);
        await updateChannelRow(payload);
      }

      console.log(`[crawler] updated ${items.length}/${ids.length} channels`);
      await sleep(1000); // 너무 빠르게 돌면 API/DB에 부담
    } catch (e) {
      const msg = String(e?.message ?? e);
      console.error("[crawler] error:", msg);

      // quota/403이면 키를 바꿔보고 계속
      if (msg.includes("403") || msg.toLowerCase().includes("quota")) {
        console.error("[crawler] quota/403 suspected. switching key and sleep 10s");
        await sleep(10_000);
        continue;
      }

      // 그 외는 잠깐 쉬고 재시도
      await sleep(15_000);
    }
  }
}
