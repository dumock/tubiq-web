'use strict';

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !YOUTUBE_API_KEY) {
  console.error('Missing env. Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const RUN_EVERY_MS = 6 * 60 * 60 * 1000; // 6시간마다 (원하면 24시간: 24*60*60*1000)
const YT_BATCH_SIZE = 50; // channels.list는 id 최대 50개
const PAGE_SIZE = 1000; // supabase channels fetch page

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function kstDateString(date = new Date()) {
  // KST(+9) 기준 날짜 yyyy-mm-dd
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
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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

async function youtubeChannelsList(ids) {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'snippet,statistics');
  url.searchParams.set('id', ids.join(','));
  url.searchParams.set('key', YOUTUBE_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`YouTube API error: ${res.status} ${res.statusText} :: ${text}`);
  }

  return res.json();
}

async function runOnce() {
  const today = kstDateString();
  const yesterday = kstYesterdayString();

  console.log(`[worker] runOnce start (KST today=${today})`);

  const channels = await fetchAllChannelsFromDB();
  console.log(`[worker] channels in DB: ${channels.length}`);

  if (channels.length === 0) {
    console.log('[worker] no channels. done.');
    return;
  }

  // DB id <-> youtube_channel_id 매핑
  const byYoutubeId = new Map();
  for (const c of channels) byYoutubeId.set(c.youtube_channel_id, c);

  const youtubeIds = channels.map((c) => c.youtube_channel_id);
  const batches = chunk(youtubeIds, YT_BATCH_SIZE);

  const snapshotRows = [];
  const channelDailyUpdate = []; // (옵션) channels.daily_view_count 업데이트용
  const channelIds = []; // 오늘 처리한 channel_id 모음

  for (let i = 0; i < batches.length; i++) {
    const ids = batches[i];
    const json = await youtubeChannelsList(ids);

    const items = json.items || [];
    for (const item of items) {
      const ytId = item.id;
      const row = byYoutubeId.get(ytId);
      if (!row) continue;

      const stats = item.statistics || {};
      const viewCount = Number(stats.viewCount || 0);
      const subscriberCount = Number(stats.subscriberCount || 0);
      const videoCount = Number(stats.videoCount || 0);

      snapshotRows.push({
        channel_id: row.id,
        date: today,
        view_count: viewCount,
        subscriber_count: subscriberCount,
        video_count: videoCount,
      });

      channelIds.push(row.id);
    }

    // API 과호출 방지(필요하면 늘려)
    await sleep(150);
    console.log(`[worker] fetched batch ${i + 1}/${batches.length} (items=${items.length})`);
  }

  if (snapshotRows.length === 0) {
    console.log('[worker] no snapshot rows from YouTube. done.');
    return;
  }

  // 1) 오늘 스냅샷 upsert
  {
    const { error } = await supabase
      .from('channel_daily_stats')
      .upsert(snapshotRows, { onConflict: 'channel_id,date' });

    if (error) throw error;
    console.log(`[worker] upsert channel_daily_stats: ${snapshotRows.length}`);
  }

  // 2) (옵션) daily_view_count 계산해서 channels 테이블에 저장
  //    오늘 - 어제 스냅샷 차이
  //    채널이 많으면 쿼리/업데이트 부하가 있을 수 있어. 필요없으면 이 블록 통째로 삭제해도 됨.
  {
    // 중복 제거
    const uniqChannelIds = Array.from(new Set(channelIds));

    // 어제 스냅샷 가져오기
    const { data: yRows, error: yErr } = await supabase
      .from('channel_daily_stats')
      .select('channel_id, view_count')
      .eq('date', yesterday)
      .in('channel_id', uniqChannelIds);

    if (yErr) throw yErr;

    const yMap = new Map();
    for (const r of (yRows || [])) yMap.set(r.channel_id, Number(r.view_count || 0));

    for (const s of snapshotRows) {
      const y = yMap.get(s.channel_id);
      if (y === undefined) continue; // 어제 값 없으면 daily 계산 못함
      const daily = Number(s.view_count) - y;
      channelDailyUpdate.push({ id: s.channel_id, daily_view_count: daily });
    }

    if (channelDailyUpdate.length > 0) {
      const { error } = await supabase
        .from('channels')
        .upsert(channelDailyUpdate, { onConflict: 'id' });

      if (error) throw error;
      console.log(`[worker] updated channels.daily_view_count: ${channelDailyUpdate.length}`);
    } else {
      console.log('[worker] skip daily_view_count update (no yesterday snapshots found)');
    }
  }

  console.log('[worker] runOnce done.');
}

async function main() {
  console.log('[worker] collector-worker started');

  // 부팅 직후 1회 실행
  try {
    await runOnce();
  } catch (e) {
    console.error('[worker] first run error:', e);
  }

  // 이후 주기 실행
  setInterval(async () => {
    try {
      await runOnce();
    } catch (e) {
      console.error('[worker] scheduled run error:', e);
    }
  }, RUN_EVERY_MS);

  // 살아있음 로그(원하면 제거)
  setInterval(() => console.log('[worker] alive...'), 60_000);
}

main().catch((e) => {
  console.error('[worker] fatal:', e);
  process.exit(1);
});
