// relay-metadata-worker/index.mjs

/**
 * 목적:
 * - relay-video 쪽 메타데이터를 video-db에서 쓰는 스키마로 변환
 * - 현재는 mock/placeholder (I/O는 나중에 붙임)
 */

export function transformRelayToVideoDb(relayMeta) {
  // TODO: 실제 필드 매핑 정의
  // 예: { title, channelId, publishedAt, durationSec, thumbnails, ... }
  if (!relayMeta || typeof relayMeta !== "object") return null;

  return {
    source: "relay-video",
    // 예시 매핑
    videoId: relayMeta.videoId ?? relayMeta.id ?? null,
    title: relayMeta.title ?? "",
    channelId: relayMeta.channelId ?? null,
    publishedAt: relayMeta.publishedAt ?? null,
    durationSec: relayMeta.durationSec ?? null,
    thumbnails: relayMeta.thumbnails ?? [],
    raw: relayMeta, // 원본 보관(디버깅용)
  };
}

export async function main() {
  // TODO: relay-video에서 메시지/데이터 받아오기
  const mockInput = {
    videoId: "abc123",
    title: "sample",
    channelId: "ch_01",
    publishedAt: "2025-12-26",
    durationSec: 120,
    thumbnails: [{ url: "https://example.com/a.jpg", width: 120, height: 90 }],
  };

  const out = transformRelayToVideoDb(mockInput);

  // TODO: video-db로 write
  console.log("[relay-metadata-worker] transformed:", out);
}

// 기존 runner가 main()을 호출하는 구조면 유지
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("[relay-metadata-worker] error:", e);
    process.exit(1);
  });
}

