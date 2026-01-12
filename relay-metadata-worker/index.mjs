// relay-metadata-worker/index.mjs
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // CWD is tubiq-web
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('[DEBUG] Loading Env:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseKey,
  cwd: process.cwd(),
  envPath: '../.env.local'
});

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

const RELAY_TABLE = process.env.SUPABASE_TABLE_RELAY_VIDEOS || "relay_videos";
const RELAY_CHANNELS_TABLE = "relay_channels";
const VIDEOS_TABLE = process.env.SUPABASE_TABLE_VIDEOS || "videos";
const CHANNELS_TABLE = "channels";
const USER_CHANNELS_TABLE = "user_channels";

const pollIntervalSec = Number(process.env.POLL_INTERVAL_SEC || 10);
const batchSize = Number(process.env.BATCH_SIZE || 50);

// const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY_1; // Removed global const check
const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Fetch YouTube API Key for a specific user from DB.
 */
async function getApiKeyForUser(userId) {
  const envKey = process.env.YOUTUBE_API_KEY_1;
  console.log('[DEBUG] getApiKeyForUser called. userId:', userId, 'envKey exists:', !!envKey);

  if (!userId) return envKey;

  try {
    const { data } = await supabase
      .from('user_settings')
      .select('setting_value')
      .eq('user_id', userId)
      .eq('setting_key', 'api_config')
      .single();

    if (data?.setting_value) {
      const config = data.setting_value;
      const youtubeKeys = config.youtube?.keys || [];
      const activeKey = youtubeKeys.find((k) => k.active);
      if (activeKey) {
        console.log('[DEBUG] Found active key in DB for user:', userId);
        return activeKey.key;
      }
    }
  } catch (e) {
    console.warn(`[relay-metadata-worker] Failed to get key for user ${userId}`, e);
  }

  console.log('[DEBUG] Falling back to envKey for user:', userId);
  return envKey;
}

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
async function fetchYoutubeVideos(videoIds, apiKey) {
  const videoById = new Map();
  if (!videoIds.length) return videoById;

  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is not defined");
  }

  // YouTube Data API: videos.list
  // max 50 ids per call
  const groups = chunk(videoIds, 50);

  for (const ids of groups) {
    const url = new URL(`${YT_API_BASE}/videos`);
    url.searchParams.set("part", "snippet,statistics");
    url.searchParams.set("id", ids.join(","));
    url.searchParams.set("key", apiKey);

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
async function fetchYoutubeChannels(channelIds, apiKey) {
  const channelById = new Map();
  if (!channelIds.length) return channelById;

  console.log('[DEBUG] fetchYoutubeChannels called. apiKey exists:', !!apiKey, 'channelIds:', channelIds);

  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is not defined");
  }

  // Separate IDs (UC...) from Handles (@...)
  const idsOnly = channelIds.filter(id => !id.startsWith("@"));
  const handlesOnly = channelIds.filter(id => id.startsWith("@"));

  // 1. Fetch by ID (batch of 50)
  if (idsOnly.length) {
    const groups = chunk(idsOnly, 50);
    for (const ids of groups) {
      const url = new URL(`${YT_API_BASE}/channels`);
      url.searchParams.set("part", "snippet,statistics");
      url.searchParams.set("id", ids.join(","));
      url.searchParams.set("key", apiKey);

      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        for (const it of (json.items || [])) {
          channelById.set(it.id, {
            id: it.id,
            title: it.snippet?.title ?? null,
            thumbnailUrl: pickBestThumbnail(it.snippet?.thumbnails),
            subscriberCount: Number(it.statistics?.subscriberCount) || 0,
            snippet: it.snippet
          });
        }
      }
    }
  }

  // 2. Fetch by Handle (one by one, or small groups? YouTube API forHandle is single usually)
  // Actually, forHandle only supports ONE per request.
  for (const handle of handlesOnly) {
    const url = new URL(`${YT_API_BASE}/channels`);
    url.searchParams.set("part", "snippet,statistics");
    url.searchParams.set("forHandle", handle); // handle includes @ prefix
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    if (res.ok) {
      const json = await res.json();
      const it = json.items?.[0];
      if (it) {
        channelById.set(handle, {
          id: it.id, // The real UC... id
          title: it.snippet?.title ?? null,
          thumbnailUrl: pickBestThumbnail(it.snippet?.thumbnails),
          subscriberCount: Number(it.statistics?.subscriberCount) || 0,
          snippet: it.snippet
        });
      }
    }
  }

  return channelById;
}

/**
 * Get or create "📱 큐쉐어러" folder for a user
 */
async function getOrCreateQSharerFolder(userId, scope = "videos") {
  const { data: existing } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "📱 큐쉐어러")
    .eq("scope", scope)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("folders")
    .insert({
      name: "📱 큐쉐어러",
      user_id: userId,
      scope: scope,
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
async function getOrCreateChannel(userId, youtubeId, meta, scope = "videos") {
  // Check if channel already exists for this user in given scope
  const { data: existing } = await supabase
    .from("channels")
    .select("id")
    .eq("youtube_channel_id", youtubeId)
    .eq("user_id", userId)
    .eq("scope", scope)
    .single();

  if (existing) return existing.id;

  // Create new channel
  const { data: created, error } = await supabase
    .from("channels")
    .insert({
      youtube_channel_id: youtubeId,
      title: meta.title || "Unknown Channel",
      thumbnail_url: meta.thumbnailUrl,
      subscriber_count: meta.subscriberCount || 0,
      channel_created_at: meta.snippet?.publishedAt,
      user_id: userId,
      scope: scope,
      status: "active"
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[relay-metadata-worker] Failed to create channel ${youtubeId} for ${userId} (${scope}):`, error);
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

    // ✅ NEW: memo from Q-Sharer app
    memo: relayRow.memo || null,

    // Auto folder assignment
    folder_id: qsharerFolderId || relayRow.folder_id || null,

    // Use added_at column
    added_at: relayRow.collected_at || new Date().toISOString(),
    // Fallback for UI sorting/display which uses collected_at
    collected_at: relayRow.collected_at || new Date().toISOString(),

    // Required by DB (re-adding these as they are marked NOT NULL in user's DB)
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

/**
 * Best-effort: mark error for given relay channel ids
 */
async function markRelayChannelError(ids, message) {
  if (!ids?.length) return;
  const safeMsg = String(message || "").slice(0, 900);
  await supabase
    .from(RELAY_CHANNELS_TABLE)
    .update({
      error: safeMsg,
      processed_at: new Date().toISOString(),
    })
    .in("id", ids);
}

const WORKER_URL = process.env.DOUYIN_WORKER_URL || "https://port-0-douyin-worker-mjk7tb329db087f3.sel3.cloudtype.app";

async function fetchWorkerMetadata(url) {
  try {
    const apiUrl = `${WORKER_URL}/api/hybrid/video_data?url=${encodeURIComponent(url)}&minimal=true`;
    console.log(`[relay-metadata-worker] Fetching worker metadata: ${url}`);
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
      console.warn(`[relay-metadata-worker] Worker API error ${res.status}`);
      return null;
    }
    const json = await res.json();
    return json.data || null;
  } catch (e) {
    console.error(`[relay-metadata-worker] Worker fetch failed: ${e.message}`);
    return null;
  }
}

async function processOnce() {
  // 1) 미처리 relay_videos 읽기
  const { data: relayRows, error: readErr } = await supabase
    .from(RELAY_TABLE)
    .select("*")
    .eq("processed", false)
    .is("error", null)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (readErr) throw readErr;
  if (!relayRows?.length) {
    return;
  }

  // 2) 필수값 체크 + youtube ids 모으기
  const validRows = [];
  const invalidIds = [];

  for (const row of relayRows) {
    if (!row.account_id || !row.external_id) {
      invalidIds.push(row.id);
      continue;
    }
    // ✅ Allow youtube, tiktok, douyin
    const plat = row.platform || "youtube";
    if (!["youtube", "tiktok", "douyin"].includes(plat)) {
      invalidIds.push(row.id);
      continue;
    }
    validRows.push(row);
  }

  if (invalidIds.length) {
    await markRelayError(
      invalidIds,
      "missing required fields or unsupported platform"
    );
  }
  if (!validRows.length) return;

  // 3) YouTube API로 메타데이터 가져오기 (Only for YouTube rows)
  const youtubeRows = validRows.filter(r => (r.platform || 'youtube') === 'youtube');
  const otherRows = validRows.filter(r => (r.platform || 'youtube') !== 'youtube');

  let videoById = new Map();
  let apiKey = null;

  if (youtubeRows.length > 0) {
    const representativeUser = youtubeRows[0].user_id || youtubeRows[0].account_id;
    apiKey = await getApiKeyForUser(representativeUser);

    const videoIds = [...new Set(youtubeRows.map((r) => r.external_id))];
    try {
      const ytMap = await fetchYoutubeVideos(videoIds, apiKey);
      ytMap.forEach((v, k) => videoById.set(k, v));
    } catch (e) {
      // 전체 배치 실패면 전부 error로 찍고 끝
      await markRelayError(
        youtubeRows.map((r) => r.id),
        e?.message || String(e)
      );
      console.error("[relay-metadata-worker] youtube fetch error:", e);
      // We continue to process otherRows if any
    }
  }

  // 3.5) Gather unique channel ids and fetch channel metadata (YouTube)
  let channelById = new Map();
  if (videoById.size > 0 && apiKey) {
    const channelIds = [...new Set(Array.from(videoById.values()).map(v => v.youtube_channel_id).filter(Boolean))];
    try {
      channelById = await fetchYoutubeChannels(channelIds, apiKey);
    } catch (e) {
      console.warn("[relay-metadata-worker] channel fetch failed (optional):", e);
    }
  }

  // 4) metadata 수집 및 DB 연동
  const processedIds = [];
  const payload = [];
  const notFoundIds = []; // Only for YouTube not found
  const workerFailedIds = [];

  // Process ALL valid rows (YouTube + Others)
  for (const row of validRows) {
    const plat = row.platform || "youtube";
    let meta = null;
    let internalChannelId = null;

    if (plat === 'youtube') {
      // Check if fetch failed previously for this batch
      if (!videoById.has(row.external_id) && youtubeRows.includes(row)) {
        // If it was in the youtube batch but not in result, it's not found
        notFoundIds.push(row.id);
        continue;
      }
      meta = videoById.get(row.external_id);
      if (!meta) continue; // Should have been caught above

      // Resolve channel
      if (meta.youtube_channel_id) {
        const channelMeta = channelById.get(meta.youtube_channel_id);
        if (channelMeta) {
          internalChannelId = await getOrCreateChannel(row.user_id || row.account_id, meta.youtube_channel_id, channelMeta);
          meta.channel_name = channelMeta.title;
        }
      }
    } else {
      // TikTok / Douyin
      // Fetch one by one (Worker API)
      const d = await fetchWorkerMetadata(row.url);
      if (!d) {
        workerFailedIds.push(row.id);
        continue;
      }

      // Map Worker Data to Meta
      // Correct extraction for TubiQ/Douyin thumbnail structure
      let videoThumb = null;
      if (d.cover_data && d.cover_data.cover && d.cover_data.cover.url_list) {
        videoThumb = d.cover_data.cover.url_list[0];
      } else if (d.cover_data && d.cover_data.origin_cover && d.cover_data.origin_cover.url_list) {
        videoThumb = d.cover_data.origin_cover.url_list[0];
      } else {
        videoThumb = d.cover || d.origin_cover || null;
      }

      const stats = d.statistics || {};
      const viewCount = stats.play_count || stats.digg_count || 0;
      const authorName = d.author?.nickname || d.author?.unique_id || 'Unknown';

      meta = {
        title: d.desc || d.title || "Untitled",
        thumbnail_url: videoThumb,
        view_count: viewCount,
        published_at: d.create_time ? new Date(d.create_time * 1000).toISOString() : new Date().toISOString(),
        channel_name: authorName,
        youtube_channel_id: null // No youtube channel ID
      };

      // Note: For TikTok/Douyin, we don't create a 'channels' record currently, 
      // nor do we have a persistent channel ID in our DB for them yet (unless we expand channels table).
      // So internalChannelId stays null, and we just use channel_name string.
    }

    const userId = row.user_id || row.account_id;

    // Auto-folder
    let qsharerFolderId = null;
    if (row.source === 'qsharer-app' || (row.source || '').includes('sharer') || row.source === 'android_floating') {
      qsharerFolderId = await getOrCreateQSharerFolder(userId);
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

  if (workerFailedIds.length) {
    await markRelayError(
      workerFailedIds,
      "worker metadata fetch failed"
    );
  }

  if (!payload.length) return;

  // 6) videos upsert (user_id + youtube_video_id로 중복 방지)
  const { error: upsertErr } = await supabase
    .from(VIDEOS_TABLE)
    .upsert(payload, { onConflict: "user_id,youtube_video_id" });

  if (upsertErr) {
    await markRelayError(
      processedIds,
      `videos upsert failed: ${upsertErr.message || String(upsertErr)}`
    );
    throw upsertErr;
  }

  // 7) relay_videos 삭제
  const { error: deleteErr } = await supabase
    .from(RELAY_TABLE)
    .delete()
    .in("id", processedIds);

  if (deleteErr) throw deleteErr;

  console.log(`[relay-metadata-worker] processed: ${processedIds.length} (YouTube: ${youtubeRows.length}, Others: ${otherRows.length})`);
}

async function processRelayChannels() {
  // 1) Read unprocessed relay_channels
  const { data: relayRows, error: readErr } = await supabase
    .from(RELAY_CHANNELS_TABLE)
    .select("*")
    .is("processed_at", null) // Using processed_at since processed might not exist or be different
    .is("error", null)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (readErr) {
    if (readErr.code === 'PGRST116') return; // Empty
    throw readErr;
  }
  if (!relayRows?.length) return;

  const validRows = [];
  for (const row of relayRows) {
    if (!row.account_id || !row.external_id) {
      await markRelayChannelError([row.id], "missing account_id or external_id");
      continue;
    }
    validRows.push(row);
  }
  if (!validRows.length) return;

  // 2) Batch fetch channel info from YouTube
  const representativeUser = validRows[0].user_id || validRows[0].account_id;
  const apiKey = await getApiKeyForUser(representativeUser);

  const channelIds = [...new Set(validRows.map(r => r.external_id))];
  let channelById;
  try {
    channelById = await fetchYoutubeChannels(channelIds, apiKey);
  } catch (e) {
    await markRelayChannelError(validRows.map(r => r.id), `YouTube fetch failed: ${e.message}`);
    return;
  }

  const processedIds = [];

  for (const row of validRows) {
    const userId = row.user_id || row.account_id;
    const plat = row.platform || "youtube";
    let meta = null;
    let externalId = row.external_id; // For DB unique key

    if (plat === 'youtube') {
      meta = channelById.get(row.external_id);
      if (!meta) {
        await markRelayChannelError([row.id], "YouTube channel metadata not found");
        continue;
      }
      // Use the resolved UC ID if available
      if (meta.id) externalId = meta.id;
    } else if (plat === 'tiktok') {
      const d = await fetchWorkerMetadata(row.url);
      if (!d || !d.title) {
        // Try profile specific parsing if video parsing returned nothing useful
        // The worker endpoint is currently specialized for videos, but let's see if we can reuse it
        // Actually currently worker endpoint `hybrid_parsing_single_video` might fail for profile URL
        // But let's assume we can use the same `fetchWorkerMetadata` which calls `hybrid_parsing_single_video`
        // If that fails, we might need a profile endpoint.
        // Based on douyin-worker main.py, it tries profile parsing if video parsing fails!
        // So `fetchWorkerMetadata` should return profile data with `is_profile: true`.
        if (!d && row.url.includes('@')) {
          // It might have failed or returned null.
          await markRelayChannelError([row.id], "TikTok/Douyin profile metadata fetch failed");
          continue;
        }
      }

      // If success
      if (d) {
        meta = {
          title: d.title || d.author || externalId,
          thumbnailUrl: d.thumbnail_url || null,
          subscriberCount: d.follower_count || 0,
          snippet: { publishedAt: null }, // No creation date usually
          id: d.author_id || externalId // Use unique_id or handle
        };
        // Update externalId to be the unique ID from platform if possible
        if (d.author_id) externalId = d.author_id;
      } else {
        await markRelayChannelError([row.id], "TikTok metadata empty");
        continue;
      }
    } else {
      await markRelayChannelError([row.id], `Unsupported channel platform: ${plat}`);
      continue;
    }

    // Auto-folder for channels (same as videos)
    let qsharerFolderId = null;
    if (row.source === 'qsharer-app' || (row.source || '').includes('sharer') || row.source === 'android_floating') {
      qsharerFolderId = await getOrCreateQSharerFolder(userId, 'channels');
    }

    try {
      // 3) Ensure master channel exists
      const channelId = await getOrCreateChannel(userId, externalId, meta, "channels");
      if (!channelId) {
        await markRelayChannelError([row.id], "Failed to create master channel record");
        continue;
      }

      // 4) Link to user_channels
      const { error: linkError } = await supabase
        .from(USER_CHANNELS_TABLE)
        .upsert({
          user_id: userId,
          channel_id: channelId,
          folder_id: qsharerFolderId
        }, { onConflict: 'user_id,channel_id' });

      if (linkError) {
        await markRelayChannelError([row.id], `Linking failed: ${linkError.message}`);
        continue;
      }

      processedIds.push(row.id);
    } catch (e) {
      await markRelayChannelError([row.id], `Processing error: ${e.message}`);
    }
  }

  if (processedIds.length) {
    // 5) Cleanup relay_channels
    const { error: deleteErr } = await supabase
      .from(RELAY_CHANNELS_TABLE)
      .delete()
      .in("id", processedIds);

    if (deleteErr) throw deleteErr;
    console.log(`[relay-metadata-worker] processed channels: ${processedIds.length}`);
  }
}

/**
 * Process channels that have missing metadata (title, thumbnail, etc.)
 */
async function processIncompleteChannels() {
  const { data: incomplete, error } = await supabase
    .from("channels")
    .select("*")
    .or("title.is.null,thumbnail_url.is.null")
    .limit(batchSize);

  if (error) {
    console.error("[relay-metadata-worker] Failed to fetch incomplete channels:", error);
    return;
  }

  if (!incomplete?.length) return;

  const channelIds = incomplete.map(c => c.youtube_channel_id || c.external_id).filter(Boolean);
  if (!channelIds.length) return;

  console.log(`[relay-metadata-worker] Resolving metadata for ${incomplete.length} channels...`);

  const representativeUser = incomplete[0].user_id; // channels table has user_id
  const apiKey = await getApiKeyForUser(representativeUser);

  try {
    const channelMeta = await fetchYoutubeChannels(channelIds, apiKey);

    for (const row of incomplete) {
      const extId = row.youtube_channel_id || row.external_id;
      const meta = channelMeta.get(extId);

      if (meta) {
        const updatePayload = {
          title: meta.title || row.title,
          thumbnail_url: meta.thumbnailUrl || row.thumbnail_url,
          subscriber_count: meta.subscriberCount || row.subscriber_count || 0,
          channel_created_at: meta.snippet?.publishedAt ? meta.snippet.publishedAt.split('T')[0] : (row.channel_created_at || null),
          status: 'active'
        };

        const { error: updateErr } = await supabase
          .from("channels")
          .update(updatePayload)
          .eq("id", row.id);

        if (updateErr) {
          console.error(`[relay-metadata-worker] Failed to update channel ${row.id}:`, updateErr);
        }
      }
    }
  } catch (e) {
    console.error("[relay-metadata-worker] Channel resolution error:", e);
  }
}

export async function main() {
  console.log("🧩 relay-metadata-worker started (Mode: Realtime + Polling Fallback)");
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "[relay-metadata-worker] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  // YOUTUBE_API_KEY check removed because we fetch it from DB now

  // 1) 초기 1회 실행 (기존 미처리 건 처리)
  await processOnce();
  await processRelayChannels();
  await processIncompleteChannels();

  // 2) 실시간 리스너 설정: Videos
  supabase
    .channel("relay-videos-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: RELAY_TABLE },
      async (payload) => {
        console.log("[relay-metadata-worker] New relay_video detected! Processing...");
        await processOnce();
      }
    )
    .subscribe();

  // 3) 실시간 리스너 설정: Channels
  supabase
    .channel("relay-channels-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: RELAY_CHANNELS_TABLE },
      async (payload) => {
        console.log("[relay-metadata-worker] New relay_channel detected! Processing...");
        await processRelayChannels();
      }
    )
    .subscribe();

  // 4) 실시간 리스너 설정: Channels Metadata Resolution
  supabase
    .channel("channels-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "channels" },
      async (payload) => {
        console.log("[relay-metadata-worker] New channel detected! Resolving metadata...");
        await processIncompleteChannels();
      }
    )
    .subscribe((status) => {
      console.log(`[relay-metadata-worker] Realtime subscription status: ${status}`);
    });

  // 4) 🆕 Polling fallback: Process every N seconds regardless of Realtime status
  // This ensures data is processed even when Realtime connection fails (CHANNEL_ERROR)
  setInterval(async () => {
    try {
      await processOnce();
      await processRelayChannels();
      await processIncompleteChannels();
    } catch (e) {
      console.error("[relay-metadata-worker] Polling cycle error:", e);
    }
  }, pollIntervalSec * 1000);

  console.log(`[relay-metadata-worker] Waiting for real-time events... (Polling fallback every ${pollIntervalSec}s)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("[relay-metadata-worker] fatal:", e);
    process.exit(1);
  });
}
