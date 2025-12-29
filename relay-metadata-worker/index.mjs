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
 * Fetch channel metadata and statistics for up to 50 channel ids per request
 * Returns:
 *  - channelById: Map(channelId -> { title, thumbnailUrl, subscriberCount, snippet })
 */
async function fetchYoutubeChannels(channelIds) {
  const channelById = new Map();
  if (!channelIds.length) return channelById;

  if (!YOUTUBE_API_KEY) {
    throw new Error("Missing env YOUTUBE_API_KEY_1");
  }

  const groups = chunk(channelIds, 50);

  for (const ids of groups) {
    const url = new URL(`${YT_API_BASE}/channels`);
    url.searchParams.set("part", "snippet,statistics");
    url.searchParams.set("id", ids.join(","));
    url.searchParams.set("key", YOUTUBE_API_KEY);

    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`YouTube channels.list failed: ${res.status} ${text}`);
    }

    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];

    for (const it of items) {
      if (!it?.id) continue;
      channelById.set(it.id, {
        title: it.snippet?.title ?? null,
        thumbnailUrl: pickBestThumbnail(it.snippet?.thumbnails),
        subscriberCount: Number(it.statistics?.subscriberCount) || 0,
        snippet: it.snippet
      });
    }
  }

  return channelById;
}

/**
 * Get or create "📱 큐쉐어러" folder for a user
 */
async function getOrCreateQSharerFolder(userId) {
  const { data: existing } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "📱 큐쉐어러")
    .eq("scope", "videos")
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("folders")
    .insert({
      name: "📱 큐쉐어러",
      user_id: userId,
      scope: "videos",
      sort_order: 0,
      parent_id: null
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[relay-metadata-worker] Failed to create folder for ${userId}:`, error);
    return null;
  }
  return created.id;
}

/**
 * Get or create channel in public.channels table
 */
async function getOrCreateChannel(userId, channelId, meta) {
  // Check if channel already exists for this user in videos scope
  const { data: existing } = await supabase
    .from("channels")
    .select("id")
    .eq("youtube_channel_id", channelId)
    .eq("user_id", userId)
    .eq("scope", "videos")
    .single();

  if (existing) return existing.id;

  // Create new channel
  const { data: created, error } = await supabase
    .from("channels")
    .insert({
      youtube_channel_id: channelId,
      title: meta.title || "Unknown Channel",
      thumbnail_url: meta.thumbnailUrl,
      subscriber_count: meta.subscriberCount || 0,
      channel_created_at: meta.snippet?.publishedAt,
      user_id: userId,
      scope: "videos",
      status: "active"
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[relay-metadata-worker] Failed to create channel ${channelId} for ${userId}:`, error);
    return null;
  }
  return created.id;
}

/**
 * Build videos table payload.
 * IMPORTANT: videos에 들어가야 하는 필드:
 * - thumbnail_url, title, view_count, published_at, channel_name
 * plus existing required fields:
 * - user_id, channel_id, youtube_video_id
 */
function transformRelayToVideoDb(relayRow, meta, internalChannelId, qsharerFolderId) {
  return {
    user_id: relayRow.user_id || relayRow.account_id,
    channel_id: internalChannelId || relayRow.channel_id,
    youtube_video_id: relayRow.external_id,

    title: meta.title ?? relayRow.title ?? relayRow.external_id ?? "",
    thumbnail_url: meta.thumbnail_url ?? relayRow.thumbnail_url ?? null,
    view_count: meta.view_count ?? relayRow.view_count ?? 0,
    published_at: meta.published_at ?? relayRow.published_at ?? null,
    channel_name: meta.channel_name ?? relayRow.channel_name ?? null,

    // Auto folder assignment
    folder_id: qsharerFolderId || relayRow.folder_id || null,

    collected_at: relayRow.collected_at ?? new Date().toISOString(),

    // Required by DB
    account_id: relayRow.account_id || relayRow.user_id,
    platform: relayRow.platform || 'youtube',
    external_id: relayRow.external_id,
    url: relayRow.url || `https://www.youtube.com/watch?v=${relayRow.external_id}`,
    source: relayRow.source || 'qsharer-app'
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

  // 4) metadata 수집 및 DB 연동
  const processedIds = [];
  const payload = [];
  const notFoundIds = [];

  for (const row of validRows) {
    const meta = videoById.get(row.external_id);
    if (!meta) {
      notFoundIds.push(row.id);
      continue;
    }

    const userId = row.user_id || row.account_id;

    // Auto-folder
    let qsharerFolderId = null;
    if (row.source === 'qsharer-app' || (row.source || '').includes('sharer')) {
      qsharerFolderId = await getOrCreateQSharerFolder(userId);
    }

    // Auto-channel lookup/creation in public.channels
    let internalChannelId = null;
    if (meta.youtube_channel_id) {
      const channelMeta = channelById.get(meta.youtube_channel_id);
      if (channelMeta) {
        internalChannelId = await getOrCreateChannel(userId, meta.youtube_channel_id, channelMeta);
        meta.channel_name = channelMeta.title;
      }
    }

    payload.push(transformRelayToVideoDb(row, meta, internalChannelId, qsharerFolderId));
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
