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

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY_1;
const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Pick best thumbnail url from YouTube thumbnails object.
 * Priority: maxres > standard > high > medium > default
 */
function pickBestThumbnail(thumbnails) {
  if (!thumbnails || typeof thumbnails !== "object") return null;
  return (
    thumbnails.maxres?.url ||
    thumbnails.standard?.url ||
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url ||
    null
  );
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Fetch video metadata for up to 50 ids per request
 * Returns:
 *  - videoById: Map(videoId -> { title, published_at, view_count, thumbnail_url, youtube_channel_id })
 */
async function fetchYoutubeVideos(videoIds) {
  const videoById = new Map();
  if (!videoIds.length) return videoById;

  if (!YOUTUBE_API_KEY) {
    throw new Error("Missing env YOUTUBE_API_KEY_1");
  }

  // YouTube Data API: videos.list
  // max 50 ids per call
  const groups = chunk(videoIds, 50);

  for (const ids of groups) {
    const url = new URL(`${YT_API_BASE}/videos`);
    url.searchParams.set("part", "snippet,statistics");
    url.searchParams.set("id", ids.join(","));
    url.searchParams.set("key", YOUTUBE_API_KEY);

    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `YouTube videos.list failed: ${res.status} ${res.statusText} ${text}`.slice(
          0,
          500
        )
      );
    }

    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];

    for (const it of items) {
      const id = it?.id;
      if (!id) continue;

      const snippet = it?.snippet || {};
      const statistics = it?.statistics || {};

      videoById.set(id, {
        title: snippet.title ?? null,
        published_at: snippet.publishedAt ?? null,
        thumbnail_url: pickBestThumbnail(snippet.thumbnails),
        view_count:
          statistics.viewCount != null ? Number(statistics.viewCount) : null,
        youtube_channel_id: snippet.channelId ?? null,
      });
    }
  }

  return videoById;
}

/**
 * Fetch channel titles for up to 50 channel ids per request
 * Returns:
 *  - channelNameById: Map(channelId -> channelTitle)
 */
async function fetchYoutubeChannels(channelIds) {
  const channelNameById = new Map();
  if (!channelIds.length) return channelNameById;

  if (!YOUTUBE_API_KEY) {
    throw new Error("Missing env YOUTUBE_API_KEY_1");
  }

  const groups = chunk(channelIds, 50);

  for (const ids of groups) {
    const url = new URL(`${YT_API_BASE}/channels`);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("id", ids.join(","));
    url.searchParams.set("key", YOUTUBE_API_KEY);

    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `YouTube channels.list failed: ${res.status} ${res.statusText} ${text}`.slice(
          0,
          500
        )
      );
    }

    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];

    for (const it of items) {
      const id = it?.id;
      const title = it?.snippet?.title ?? null;
      if (!id) continue;
      channelNameById.set(id, title);
    }
  }

  return channelNameById;
}

/**
 * Build videos table payload.
 * IMPORTANT: videos에 들어가야 하는 필드:
 * - thumbnail_url, title, view_count, published_at, channel_name
 * plus existing required fields:
 * - user_id, channel_id, youtube_video_id
 */
function transformRelayToVideoDb(relayRow, meta) {
  return {
    user_id: relayRow.user_id,
    channel_id: relayRow.channel_id,
    youtube_video_id: relayRow.external_id, // relay_videos.external_id -> videos.youtube_video_id

    // required enriched fields
    title: meta.title ?? relayRow.title ?? relayRow.external_id ?? "",
    thumbnail_url: meta.thumbnail_url ?? relayRow.thumbnail_url ?? null,
    view_count: meta.view_count ?? relayRow.view_count ?? 0,
    published_at: meta.published_at ?? relayRow.published_at ?? null,
    channel_name: meta.channel_name ?? relayRow.channel_name ?? null,

    // keep collected_at if exists
    collected_at: relayRow.collected_at ?? null,
  };
}

/**
 * Best-effort: mark error for given relay ids
 */
async function markRelayError(ids, message) {
  if (!ids?.length) return;
  const safeMsg = String(message || "").slice(0, 900);
  await supabase
    .from(RELAY_TABLE)
    .update({
      error: safeMsg,
      // processed stays false so it can be retried if you clear error later
      processed_at: new Date().toISOString(),
    })
    .in("id", ids);
}

async function processOnce() {
  // 1) 미처리 relay_videos 읽기 (error는 일단 NULL만; 필요하면 조건 바꾸기)
  const { data: relayRows, error: readErr } = await supabase
    .from(RELAY_TABLE)
    .select("*")
    .eq("processed", false)
    .is("error", null)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (readErr) throw readErr;
  if (!relayRows?.length) {
    console.log("[relay-metadata-worker] no jobs");
    return;
  }

  // 2) 필수값 체크 + youtube ids 모으기
  const validRows = [];
  const invalidIds = [];

  for (const row of relayRows) {
    // videos insert에 필수
    if (!row.user_id || !row.channel_id || !row.external_id) {
      invalidIds.push(row.id);
      continue;
    }
    // 현재는 youtube만 처리(필요 시 platform 분기 확장)
    if ((row.platform || "youtube") !== "youtube") {
      invalidIds.push(row.id);
      continue;
    }
    validRows.push(row);
  }

  if (invalidIds.length) {
    await markRelayError(
      invalidIds,
      "missing required fields (user_id/channel_id/external_id) or unsupported platform"
    );
  }
  if (!validRows.length) return;

  // 3) YouTube API로 메타데이터 가져오기 (batch)
  const videoIds = [...new Set(validRows.map((r) => r.external_id))];
  let videoById;
  try {
    videoById = await fetchYoutubeVideos(videoIds);
  } catch (e) {
    // 전체 배치 실패면 전부 error로 찍고 끝(로컬 링크/SSE/Mongo는 영향 없음)
    await markRelayError(
      validRows.map((r) => r.id),
      e?.message || String(e)
    );
    console.error("[relay-metadata-worker] youtube fetch error:", e);
    return;
  }

  // 4) 채널명까지 필요 → channelId 수집 후 channels.list
  const channelIds = [];
  for (const id of videoIds) {
    const meta = videoById.get(id);
    if (meta?.youtube_channel_id) channelIds.push(meta.youtube_channel_id);
  }
  const uniqChannelIds = [...new Set(channelIds)];

  let channelNameById = new Map();
  if (uniqChannelIds.length) {
    try {
      channelNameById = await fetchYoutubeChannels(uniqChannelIds);
    } catch (e) {
      // 채널명만 실패한 경우: 영상 메타는 저장하되 channel_name은 null로 둔다
      console.error("[relay-metadata-worker] youtube channels fetch error:", e);
      channelNameById = new Map();
    }
  }

  // 5) videos payload 생성 + row별 에러 분리
  const payload = [];
  const processedIds = [];
  const notFoundIds = [];

  for (const row of validRows) {
    const meta = videoById.get(row.external_id);

    // videos.list 응답에 없는 경우(삭제/비공개/잘못된 id)
    if (!meta) {
      notFoundIds.push(row.id);
      continue;
    }

    const metaWithChannel = {
      ...meta,
      channel_name: meta.youtube_channel_id
        ? channelNameById.get(meta.youtube_channel_id) ?? null
        : null,
    };

    payload.push(transformRelayToVideoDb(row, metaWithChannel));
    processedIds.push(row.id);
  }

  if (notFoundIds.length) {
    await markRelayError(
      notFoundIds,
      "youtube metadata not found (private/deleted/invalid video id)"
    );
  }

  if (!payload.length) return;

  // 6) videos upsert (youtube_video_id로 중복 방지)
  const { error: upsertErr } = await supabase
    .from(VIDEOS_TABLE)
    .upsert(payload, { onConflict: "youtube_video_id" });

  if (upsertErr) {
    // upsert 실패면 processed 찍지 말고 error로 남김
    await markRelayError(
      processedIds,
      `videos upsert failed: ${upsertErr.message || String(upsertErr)}`
    );
    throw upsertErr;
  }

  // 7) relay_videos 처리완료 표시
  const { error: updateErr } = await supabase
    .from(RELAY_TABLE)
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      error: null,
    })
    .in("id", processedIds);

  if (updateErr) throw updateErr;

  console.log(`[relay-metadata-worker] processed: ${processedIds.length}`);
}

export async function main() {
  console.log("🧩 relay-metadata-worker started");
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "[relay-metadata-worker] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  if (!YOUTUBE_API_KEY) {
    console.error("[relay-metadata-worker] missing YOUTUBE_API_KEY_1");
  }

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
