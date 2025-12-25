// crawler-worker/index.mjs
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
    throw new Error(`YouTube API error ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

/**
 * DB 스키마가 아직 확정이 아니라서,
 * - "비어있는 필드만 대상으로 잡기"를 먼저 시도하고
 * - 컬럼이 없어서 에러나면 youtube_channel_id만 가져오는 안전모드로 폴백한다.
 */
async function fetchTargets(batchSize = 50) {
  // 1) 원래 의도(빈 필드 채우기) 방식 시도
  try {
    const { data, error } = await supabase
      .from("channels")
      .select(
        "youtube_channel_id, title, subscriber_count, view_count, video_count, thumbnail_url, country, published_at"
      )
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
  } catch (e) {
    const msg = String(e?.message ?? e);
    // 스키마 불일치(컬럼 없음)일 때 폴백
    if (msg.includes("does not exist") || msg.includes("column")) {
      console.warn(
        `[crawler] fetchTargets fallback (schema mismatch): ${msg}`
      );
      const { data, error } = await supabase
        .from("channels")
        .select("youtube_channel_id")
        .like("youtube_channel_id", "UC_%")
        .limit(batchSize);

      if (error) throw error;
      return data ?? [];
    }
    throw e;
  }
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
    published_at: snippet.publishedAt
      ? new Date(snippet.publishedAt).toISOString()
      : null,
    subscriber_count: stats.subscriberCount ? Number(stats.subscriberCount) : null,
    view_count: stats.viewCount ? Number(stats.viewCount) : null,
    video_count: stats.videoCount ? Number(stats.videoCount) : null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * update 시 "없는 컬럼" 때문에 죽는 상황을 피하기 위해
 * - 없는 컬럼 에러가 나면 그 필드를 제거하고 재시도한다.
 */
async function updateChannelRow(payload) {
  const baseWhere = supabase
    .from("channels")
    .update({}) // placeholder, 아래에서 다시 세팅
    .eq("youtube_channel_id", payload.youtube_channel_id);

  // 업데이트 후보 키들(우선순위: 중요한 것부터)
  const keys = [
    "title",
    "thumbnail_url",
    "country",
    "published_at",
    "subscriber_count",
    "view_count",
    "video_count",
    "updated_at",
  ];

  // payload에서 실제로 값이 있는 것만
  const working = { youtube_channel_id: payload.youtube_channel_id };
  for (const k of keys) {
    if (k in payload) working[k] = payload[k];
  }

  // 최소한 youtube_channel_id는 where에만 쓰고, update에는 빼기
  delete working.youtube_channel_id;

  // 없다고 뜨는 필드를 하나씩 제거하면서 최대 8번까지 재시도
  let attemptKeys = [...Object.keys(working)];
  for (let i = 0; i < 8; i++) {
    const updateObj = {};
    for (const k of attemptKeys) updateObj[k] = working[k];

    const { error } = await supabase
      .from("channels")
      .update(updateObj)
      .eq("youtube_channel_id", payload.youtube_channel_id);

    if (!error) return;

    const msg = String(error?.message ?? error);
    if (msg.includes("does not exist") || msg.includes("column")) {
      // 에러 메시지에서 "channels.xxx" 또는 '"xxx"' 를 최대한 뽑아봄
      const m1 = msg.match(/channels\.([a-zA-Z0-9_]+)/);
      const m2 = msg.match(/column\s+"([^"]+)"/);
      const bad = (m1?.[1] ?? m2?.[1] ?? "").trim();

      if (!bad) {
        // 못 뽑으면 마지막 필드 하나 제거
        attemptKeys.pop();
      } else {
        attemptKeys = attemptKeys.filter((k) => k !== bad);
      }

      if (attemptKeys.length === 0) {
        console.warn("[crawler] update skipped: no compatible columns");
        return;
      }
      continue;
    }

    // 스키마 문제가 아닌 다른 에러면 그대로 throw
    throw error;
  }
  console.warn("[crawler] update skipped: too many schema-mismatch retries");
}

export async function startCrawler() {
  console.log(`[crawler] start env=${NODE_ENV}, yt_keys=${YT_KEYS.length}`);

  let keyIdx = 0;

  while (true) {
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

    const ids = targets.map((t) => t.youtube_channel_id).filter(Boolean);

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
        updated++;
      }

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

// worker-runner가 startCrawler를 import해서 호출하는 구조면 export만으로 충분.
// 혹시 직접 실행도 가능하게 하려면 아래 주석을 풀어도 됨.
// if (import.meta.url === `file://${process.argv[1]}`) startCrawler();
