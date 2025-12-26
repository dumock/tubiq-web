// relay-metadata-worker/index.mjs

/**
 * 목적:
 * - relay-video 쪽 메타데이터를 video-db에서 사용하는 스키마로 변환
 * - 이 워커는 "변환"만 책임진다 (수집/저장은 다른 워커)
 * - 현재는 mock input 기반, I/O는 추후 연결
 */

/**
 * relay-video → video-db 스키마 변환
 * @param {object} relayMeta
 * @returns {object|null}
 */
export function transformRelayToVideoDb(relayMeta) {
  if (!relayMeta || typeof relayMeta !== "object") {
    return null;
  }

  const {
    videoId,
    id,
    title,
    channelId,
    publishedAt,
    durationSec,
    thumbnails,
    description,
  } = relayMeta;

  return {
    // 메타
    source: "relay-video",

    // video-db 기준 필드 (1차 가정)
    video_id: videoId ?? id ?? null,
    title: title ?? "",
    channel_id: channelId ?? null,
    description: description ?? null,
    published_at: publishedAt ?? null,
    duration_sec: typeof durationSec === "number" ? durationSec : null,

    // 대표 썸네일 1개만 추출 (없으면 null)
    thumbnail_url: Array.isArray(thumbnails) && thumbnails.length > 0
      ? thumbnails[0].url ?? null
      : null,

    // 원본 보관 (디버깅 / 재처리 대비)
    raw: relayMeta,
  };
}

/**
 * 워커 엔트리 포인트
 */
export async function main() {
  console.log("🧩 relay-metadata-worker started");

  // TODO: 실제로는 relay-video 큐/이벤트/DB에서 입력 받음
  const mockInput = {
    videoId: "abc123",
    title: "sample video",
    description: "this is a sample",
    channelId: "ch_01",
    publishedAt: "2025-12-26",
    durationSec: 120,
    thumbnails: [
      { url: "https://example.com/a.jpg", width: 120, height: 90 },
    ],
  };

  const transformed = transformRelayToVideoDb(mockInput);

  if (!transformed) {
    console.error("❌ transform failed:", mockInput);
    return;
  }

  // TODO: video-db writer로 전달
  console.log(
    "[relay-metadata-worker] transformed result:",
    JSON.stringify(transformed, null, 2)
  );
}

/**
 * 단독 실행 지원 (node index.mjs)
 * runner에서 import로 호출할 경우에는 실행되지 않음
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("[relay-metadata-worker] fatal error:", err);
    process.exit(1);
  });
}
