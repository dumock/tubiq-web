interface ChannelInput {
    publishedAt: string;
    viewCount: number;
    videoCount: number;
}

interface ScoreResult {
    score: number;
    signals: string[];
    metrics: {
        ageDays: number;
        avgViews: number;
    };
}

export function calculateGoodChannelScore(channel: ChannelInput): ScoreResult {
    const { publishedAt, viewCount, videoCount } = channel;

    // 1. Metrics Calculation
    const publishedDate = new Date(publishedAt);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - publishedDate.getTime());
    const ageDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const safeVideoCount = Math.max(videoCount, 1);
    const avgViews = viewCount / safeVideoCount;

    let score = 0;
    const signals: string[] = [];

    // 2. Scoring Rules

    // [신생성 점수 | 최대 30점]
    if (ageDays <= 180) score += 30;
    else if (ageDays <= 365) score += 20;
    else if (ageDays <= 730) score += 10;

    // [평균 조회수 점수 | 최대 30점]
    if (avgViews >= 300000) score += 30;
    else if (avgViews >= 150000) score += 24;
    else if (avgViews >= 80000) score += 18;
    else if (avgViews >= 30000) score += 10;
    else if (avgViews >= 10000) score += 5;

    // [영상 수 점수 | 최대 15점]
    if (videoCount <= 10) score += 15;
    else if (videoCount <= 30) score += 10;
    else if (videoCount <= 60) score += 5;

    // 3. Signals Rules
    if (ageDays <= 365) signals.push("신생");
    if (avgViews >= 100000) signals.push("평균조회수↑");
    if (videoCount <= 30) signals.push("영상수적음");

    return {
        score,
        signals,
        metrics: {
            ageDays,
            avgViews
        }
    };
}
