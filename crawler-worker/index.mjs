// crawler-worker/index.mjs
// 역할: channels 테이블의 youtube_channel_id 대상으로 YouTube Data API channels.list로 메타/통계 채우기
// 특징:
// - DB 컬럼명이 다를 수 있으니 "컬럼 매핑"을 ENV로 받음 (없으면 그 필드는 업데이트/조건에 포함 안 함)
// - 60초마다 heart-beat 로그 찍어서 "살아있는지" 확인 가능
// - Node 22+ 글로벌 fetch 사용

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
  throw new Error("Missing YOUTUBE_API_KEY_(1~4)");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pickKey = (i) => YT_KEYS[i % YT_KEYS.length];

// ====== 컬럼 매핑 (중요) ======
// DB에 실제 존재하는 컬럼명으로 설정해주면 그 컬럼을 업데이트함.
// 없거나 비워두면 그 필드는 건드리지 않아서 "column does not exist"로 안 죽음.
const COL = {
  id: process.env.COL_YOUTUBE_CHANNEL_ID || "youtube_channel_id",

  // 아래는 "있으면" 켜고 없으면 그냥 비워둬도 됨
  title: process.env.COL_TITLE || "title",
  thumbnail: process.env.COL_THUMBNAIL_URL || "thumbnail_url",
  country: process.env.COL_COUNTRY || "country",
  publishedAt: process.env.COL_PUBLISHED_AT || "published_at",

  subscriber: process.env.COL_SUBSCRIBER_COUNT || "", // 예: subscriber_count
  view: process.env.COL_VIEW_COUNT || "", // 예: view_count (너희 DB엔 없어서 에러났던 컬럼)
  video: process.env.COL_VIDEO_COUNT || "", // 예: video_count

  updatedAt: process.env.COL_UPDATED_AT || "updated_at",
};

// 어떤 컬럼을 실제로 업데이트할지 결정 (빈 문자열은 스킵)
function buildUpdateObject(payload) {
  const u = {};

  // title/thumbnail/country/publishedAt는 기본으로 시도 (없으면 여기서도 에러 날 수 있으니: 정말 없으면 ENV로 "" 주면 됨)
  if (COL.title) u[COL.title] = payload.title;
  if (COL.thumbnail) u[COL.thumbnail] = payload.thumbnail_url;
  if (COL.country) u[COL.country] = payload.country;
  if (COL.publishedAt) u[COL.publishedAt] = payload.published_at;

  if (COL.subscriber) u[COL.subscriber] = payload.subscriber_count;
  if (COL.view) u[COL.view] = payload.view_count;
  if (COL.video) u[COL.video] = payload.video_count;

  if (COL.updatedAt) u[COL.updatedAt] = new Date().toISOString();

  return u;
}

// ====== YouTube API ======
async function ytChannelsList(channelIds, key) {
  const ids = channelIds.join(",");
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("id", ids);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) throw new Error(`YouTube API error ${res.status}: ${text}`);
  return JSON.parse(text);
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
  };
}

// ====== DB 대상 가져오기 ======
async function fetchTargets(batchSize = 50) {
  // "컬럼이 없어서 죽는 것"을 막기 위해:
  // - 기본은 id 컬럼만 select
  // - '업데이트할 컬럼'이 있을 때만 null 체크 조건을 붙임
  const selectCols = new Set([COL.id]);

  // null 체크를 하고 싶은 컬럼만 포함 (존재한다고 확신 없으면 ENV로 비워두면 됨)
  for (const c of [COL.title, COL.thumbnail, COL.country, COL.publishedAt, COL.subscriber, COL.view, COL.video]) {
    if (c) selectCols.add(c);
  }

  let q = supabase
    .from("channels")
    .select([...selectCols].join(","))
    .like(COL.id, "UC_%")
    .limit(batchSize);

  // 업데이트 대상 필드들 중 하나라도 null이면 가져오게
  const nullChecks = [];
  for (const c of [COL.title, COL.thumbnail, COL.country, COL.publishedAt, COL.subscriber, COL.view, COL.video]) {
    if (c) nullChecks.push(`${c}.is.null`);
  }
  if (nullChecks.length > 0) {
    q = q.or(nullChecks.join(","));
  }

  const { data, error } = await q;
  if (error) throw error;

  // data row는 { youtube_channel_id: "..."} 형태일 수도, COL.id가 다르면 {<colName>: "..."}일 수도 있음
  return data ?? [];
}

async function updateChannelRow(youtubeChannelId, payload) {
  const updateObj = buildUpdateObject(payload);

  // updateObj가 비어 있으면 쓸데없이 update하지 않음
  if (Object.keys(updateObj).length === 0) return;

  const { error } = await supabase
    .from("channels")
    .update(updateObj)
    .eq(COL.id, youtubeChannelId);

  if (error) throw error;
}

// ====== 메인 루프 ======
export async function startCrawler() {
  console.log(`[crawler] start. env=${NODE_ENV}, yt_keys=${YT_KEYS.length}`);
  console.log(`[crawler] column mapping:`, JSON.stringify(COL));

  let keyIdx = 0;
  let loops = 0;
  let lastWorkAt = Date.now();

  // heartbeat: 60초마다 무조건 찍어서 "멈춘 게 아니라 대기 중"인지 확인 가능
  const hb = setInterval(() => {
    const sec = Math.floor((Date.now() - lastWorkAt) / 1000);
    console.log(`[crawler][hb] alive. loops=${loops}, lastWork=${sec}s ago`);
  }, 60_000);

  try {
    while (true) {
      loops++;

      let targets;
      try {
        targets = await fetchTargets(50);
      } catch (e) {
        console.error("[crawler] fetchTargets error:", e?.message ?? e);
        await sleep(15_000);
        continue;
      }

      if (targets.length === 0) {
        console.log("[crawler] no targets. sleep 60s");
        await sleep(60_000);
        continue;
      }

      // 실제 youtube_channel_id 값 뽑기
      const ids = targets
        .map((t) => t[COL.id])
        .filter((v) => typeof v === "string" && v.startsWith("UC"));

      if (ids.length === 0) {
        console.log("[crawler] targets found but no valid UC ids. sleep 60s");
        await sleep(60_000);
        continue;
      }

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

          try {
            await updateChannelRow(id, payload);
            updated++;
          } catch (e) {
            // 여기서 컬럼명 틀리면 에러가 뜨므로 바로 로그로 보임
            console.error(`[crawler] update failed for ${id}:`, e?.message ?? e);
          }
        }

        lastWorkAt = Date.now();
        console.log(`[crawler] updated ${updated}/${ids.length} channels (api_items=${items.length})`);

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
  } finally {
    clearInterval(hb);
  }
}

// (선택) 이 파일을 직접 node로 실행할 때도 돌아가게
if (import.meta.url === `file://${process.argv[1]}`) {
  startCrawler().catch((e) => {
    console.error("[crawler] fatal:", e?.message ?? e);
    process.exit(1);
  });
}
