// crawler-worker/index.mjs
// 역할: DB에 이미 들어있는 채널(youtube_channel_id)을 대상으로 YouTube Data API로 상세 메타/통계 채워넣기
// - quota 효율: channels.list (part=snippet,statistics) 는 보통 1 unit
// - daily view 같은 건 YouTube Analytics 권한 없으면 못 가져오니, 여기서는 "기초 필드 채우기"에 집중
//
// ✅ Cloudtype 같은 곳에서 Health Check(/healthz) 요구하면 아래의 "health server"가 살아있게 해줌
// ✅ 크래시/무음 상태 방지: unhandledRejection/uncaughtException 로깅 + 주기 tick 로그 추가

import http from "node:http";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NODE_ENV = process.env.NODE_ENV ?? "production";
const WORKER_ROLE = process.env.WORKER_ROLE ?? "crawler";

const PORT = Number(process.env.PORT ?? 3000); // 플랫폼이 PORT를 주는 경우가 많음
const HEALTH_PATH = process.env.HEALTH_PATH ?? "/healthz";

// Node 18+ 에서는 global fetch가 기본. 혹시라도 없는 런타임이면 즉시 에러를 띄움.
if (typeof globalThis.fetch !== "function") {
  throw new Error("Global fetch is not available. Node 18+ is required.");
}

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

/** 간단 health server (워커인데도 /healthz 필요할 때) */
function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === HEALTH_PATH) {
      res.statusCode = 200;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("ok");
      return;
    }
    // 워커라서 다른 라우트는 굳이 제공 안 함
    res.statusCode = 404;
    res.end("not found");
  });

  server.listen(PORT, () => {
    console.log(`[health] listening on ${PORT} (${HEALTH_PATH})`);
  });

  return server;
}

async function ytChannelsList(channelIds, key) {
  const ids = channelIds.join(",");
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("id", ids);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), {
    headers: { "accept": "application/json" },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`YouTube API error ${res.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`YouTube API returned non-JSON: ${text.slice(0, 200)}`);
  }
}

async function fetchTargets(batchSize = 50) {
  // "비어있는 필드" 기준으로 크롤 대상 선택
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

async function updateChannelRow(payload) {
  // ⚠️ updated_at 컬럼이 없으면 여기서 실패할 수 있음.
  // 컬럼이 없으면 아래 updated_at 라인을 지우거나, DB에 추가하세요.
  const { error } = await supabase
    .from("channels")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("youtube_channel_id", payload.youtube_channel_id);

  if (error) throw error;
}

/** 동시 업데이트(DB 부담 줄이면서도 너무 느리지 않게) */
async function updateManySequential(ids, byId) {
  let updated = 0;

  for (const id of ids) {
    const item = byId.get(id);
    if (!item) continue;

    const payload = normalizeChannel(item);
    await updateChannelRow(payload);
    updated += 1;

    // 아주 약간 텀(초당 쿼리 폭주 방지)
    await sleep(50);
  }

  return updated;
}

export async function startCrawler() {
  console.log(
    `[crawler] start. env=${NODE_ENV}, role=${WORKER_ROLE}, keys=${YT_KEYS.length}`
  );

  let keyIdx = 0;

  // 주기적인 “살아있음” 로그(무한 대기/무음 상태 방지)
  setInterval(() => {
    console.log(`[crawler] tick ${new Date().toISOString()}`);
  }, 60_000).unref?.();

  while (true) {
    const targets = await fetchTargets(50);

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
      const updated = await updateManySequential(ids, byId);

      console.log(`[crawler] updated ${updated}/${ids.length} channels`);
      await sleep(1000);
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

// ---- 안전장치(무음 크래시 방지) ----
process.on("unhandledRejection", (e) => {
  console.error("[crawler] unhandledRejection", e);
});
process.on("uncaughtException", (e) => {
  console.error("[crawler] uncaughtException", e);
});

// ---- 실행 엔트리 ----
// worker-runner가 import 해서 startCrawler()를 호출하는 구조면 아래 즉시 실행은 불필요하지만,
// “단독 실행(node index.mjs)”도 가능하게 해둠.
const healthServer = startHealthServer();

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[crawler] shutdown requested (${signal})`);

  try {
    healthServer?.close?.();
  } catch {}

  // 바로 종료해도 되지만, 로그 flush용 짧은 텀
  await sleep(250);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// 이 파일을 직접 실행하면 시작.
// worker-runner가 import해서 실행하는 경우엔, 중복 실행을 피하려면 아래 조건을 활용하세요.
// (ESM에서 "메인 모듈" 판별)
const isDirectRun =
  process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url;

if (isDirectRun) {
  startCrawler().catch((e) => {
    console.error("[crawler] fatal:", e);
    process.exit(1);
  });
}
