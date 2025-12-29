'use strict';

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

/**
 * ================================
 * ENV
 * ================================
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// YOUTUBE_API_KEY_1, YOUTUBE_API_KEY_2, ...
const YOUTUBE_KEYS = Object.keys(process.env)
  .filter((k) => k.startsWith('YOUTUBE_API_KEY_'))
  .sort()
  .map((k) => process.env[k])
  .filter(Boolean);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE env');
  process.exit(1);
}

if (YOUTUBE_KEYS.length === 0) {
  console.error('Missing YOUTUBE_API_KEY_* env');
  process.exit(1);
}

/**
 * ================================
 * CONSTANTS
 * ================================
 */
const RUN_EVERY_MS = 6 * 60 * 60 * 1000; // 6시간
const YT_BATCH_SIZE = 50;
const PAGE_SIZE = 1000;
const PER_KEY_LIMIT = 9000;

/**
 * ================================
 * SUPABASE
 * ================================
 */
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * ================================
 * YOUTUBE KEY ROTATION
 * ================================
 */
let keyIndex = 0;
const keyUsage = new Array(YOUTUBE_KEYS.length).fill(0);

function getApiKey() {
  for (let i = 0; i < YOUTUBE_KEYS.length; i++) {
    const idx = (keyIndex + i) % YOUTUBE_KEYS.length;
    if (keyUsage[idx] < PER_KEY_LIMIT) {
      keyIndex = idx;
      keyUsage[idx]++;
      return YOUTUBE_KEYS[idx];
    }
  }
  throw new Error('All YouTube API keys exhausted');
}

/**
 * ================================
 * UTILS
 * ================================
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function kstDateString(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function kstYesterdayString() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() - 1);
  return kst.toISOString().slice(0, 10);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * ================================
 * DB
 * ================================
 */
async function fetchAllChannelsFromDB() {
  const all = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('channels')
      .select('id, youtube_channel_id')
      .not('youtube_channel_id', 'is', null)
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

/**
 * ================================
 * YOUTUBE API
 * ================================
 */
async function youtubeChannelsList(ids) {
  const apiKey = getApiKey();

  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'snippet,statistics');
  url.searchParams.set('id', ids.join(','));
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`YouTube API error ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * ================================
 * MAIN LOGIC
 * ================================
 */
async function runOnce() {
  const today = kstDateString();
  const yesterday = kstYesterdayString();

  console.log(`[worker] runOnce start | KST=${today}`);
  console.log(`[worker] YouTube keys usage:`, keyUsage);

  const channels = await fetchAllChannelsFromDB();
  console.log(`[worker] channels count: ${channels.length}`);
  if (channels.length === 0) return;

  const byYoutubeId = new Map();
  for (const c of channels) byYoutubeId.set(c.youtube_channel_id, c);

  const batches = chunk(
    channels.map((c) => c.youtube_channel_id),
    YT_BATCH_SIZE
  );

  const snapshotRows = [];
  const channelIds = [];

  for (let i = 0; i < batches.length; i++) {
    const json = await youtubeChannelsList(batches[i]);
    const items = json.items || [];

    for (const item of items) {
      const row = byYoutubeId.get(item.id);
      if (!row) continue;

      const s = item.statistics || {};
      snapshotRows.push({
        channel_id: row.id,
        date: today,
        view_count: Number(s.viewCount || 0),
        subscriber_count: Number(s.subscriberCount || 0),
        video_count: Number(s.videoCount || 0),
      });
      channelIds.push(row.id);
    }

    console.log(`[worker] batch ${i + 1}/${batches.length}`);
    await sleep(150);
  }

  if (snapshotRows.length === 0) return;

  // 1️⃣ daily snapshot
  await supabase
    .from('channel_daily_stats')
    .upsert(snapshotRows, { onConflict: 'channel_id,date' });

  // 2️⃣ daily_view_count
  const uniqIds = [...new Set(channelIds)];
  const { data: yRows } = await supabase
    .from('channel_daily_stats')
    .select('channel_id, view_count')
    .eq('date', yesterday)
    .in('channel_id', uniqIds);

  const yMap = new Map();
  for (const r of yRows || []) yMap.set(r.channel_id, Number(r.view_count));

  const updates = [];
  for (const s of snapshotRows) {
    if (!yMap.has(s.channel_id)) continue;
    updates.push({
      id: s.channel_id,
      daily_view_count: s.view_count - yMap.get(s.channel_id),
    });
  }

  if (updates.length > 0) {
    await supabase
      .from('channels')
      .upsert(updates, { onConflict: 'id' });
  }

  console.log('[worker] runOnce done');
}

/**
 * ================================
 * BOOT
 * ================================
 */
async function main() {
  console.log('[worker] started');
  await runOnce().catch(console.error);

  setInterval(() => runOnce().catch(console.error), RUN_EVERY_MS);
  setInterval(() => console.log('[worker] alive'), 60_000);
}

main().catch((e) => {
  console.error('[worker] fatal', e);
  process.exit(1);
});
