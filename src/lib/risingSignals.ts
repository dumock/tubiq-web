import { Video } from '@/mock/videos';
import { VideoDailyStat } from '@/mock/videoDaily';

export type RisingSignal = {
    key: string;
    label: string;
    tone: "green" | "blue" | "orange" | "red";
};

interface GetRisingSignalsParams {
    channelId: string;
    channelDailyViews: number;
    videosForChannel: Video[];
    videoDailyForVideos: Record<string, VideoDailyStat[]>;
    videoCount: number;
    createdAt: string; // YYYY-MM-DD
}

export function getRisingSignals({
    channelId,
    channelDailyViews,
    videosForChannel,
    videoDailyForVideos,
    videoCount,
    createdAt
}: GetRisingSignalsParams): RisingSignal[] {
    const signals: RisingSignal[] = [];

    // 1. ⚠️ 리스크 (Risk)
    const hasRisk = videosForChannel.some(v => v.status === 'deleted' || v.status === 'blocked_suspected');
    if (hasRisk) {
        signals.push({ key: "risk", label: "⚠️ 리스크", tone: "red" });
    }

    // Prepare video-level yesterday/today views for other rules
    const videoStats = videosForChannel.map(v => {
        const stats = videoDailyForVideos[v.id] || [];
        let todayViews = 0;
        if (stats.length >= 2) {
            const latest = stats[stats.length - 1];
            const prev = stats[stats.length - 2];
            todayViews = Math.max(0, latest.cumulativeViews - prev.cumulativeViews);
        }
        return { videoId: v.id, todayViews };
    }).sort((a, b) => b.todayViews - a.todayViews);

    const top1VideoViews = videoStats[0]?.todayViews || 0;
    const top2VideoViews = videoStats[1]?.todayViews || 0;

    // 2. 🎯 단일 영상 급등 (Single Hit)
    // - channelDailyViews 대비 top1VideoViews 비중이 60% 이상
    // - 또는 top1VideoViews >= top2VideoViews * 3
    const isSingleHit =
        (channelDailyViews > 0 && (top1VideoViews / channelDailyViews) >= 0.6) ||
        (top2VideoViews > 0 && top1VideoViews >= top2VideoViews * 3) ||
        (videoStats.length === 1 && top1VideoViews > 0); // Only one video and it's getting views

    if (isSingleHit && top1VideoViews > 0) {
        signals.push({ key: "single_hit", label: "🎯 단일 영상 급등", tone: "blue" });
    }

    // 3. 🆕 신규 급등 (New Rising)
    // - 개설일이 180일 이내이고 channelDailyViews가 10,000 이상 (상위권 대용)
    const createdDate = new Date(createdAt);
    const now = new Date();
    const ageInDays = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays <= 180 && channelDailyViews >= 10000) {
        signals.push({ key: "new_rising", label: "🆕 신규 급등", tone: "green" });
    }

    // 4. 🔥 고효율 (High Efficiency)
    // - 영상수가 30 이하인데 일조회수가 20,000 이상
    if (videoCount <= 30 && channelDailyViews >= 20000) {
        signals.push({ key: "high_eff", label: "🔥 고효율", tone: "orange" });
    }

    // Priority ordering: risk > single_hit > new_rising > high_eff
    // The current push order matches this. We just need to slice to 2.
    return signals.slice(0, 2);
}

export function getTopCauseVideo({
    videosForChannel,
    videoDailyForVideos,
    channelDailyViews,
    poolSize // Optional limit for analysis
}: {
    videosForChannel: Video[];
    videoDailyForVideos: Record<string, VideoDailyStat[]>;
    channelDailyViews: number;
    poolSize?: number;
}) {
    // Slicing by poolSize if provided
    const pool = poolSize ? videosForChannel.slice(0, poolSize) : videosForChannel;

    const videoStats = pool.map(v => {
        const stats = videoDailyForVideos[v.id] || [];
        let todayViews = 0;
        if (stats.length >= 2) {
            const latest = stats[stats.length - 1];
            const prev = stats[stats.length - 2];
            todayViews = Math.max(0, latest.cumulativeViews - prev.cumulativeViews);
        }
        return { video: v, todayViews };
    }).sort((a, b) => b.todayViews - a.todayViews);

    const top = videoStats[0];
    if (!top || top.todayViews <= 0) {
        return null;
    }

    const share = channelDailyViews > 0 ? (top.todayViews / channelDailyViews) : 0;

    return {
        video: top.video,
        todayViews: top.todayViews,
        share: Math.round(share * 100)
    };
}
