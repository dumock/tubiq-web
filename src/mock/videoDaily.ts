export interface VideoDailyStat {
    date: string;
    cumulativeViews: number;
}

const generateMockVideoData = (baseViews: number): VideoDailyStat[] => {
    const data: VideoDailyStat[] = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Use deterministic growth based on index to avoid hydration mismatch
        const dailyViews = 2000 + (i * 100); // Deterministic

        data.push({
            date: date.toISOString().split('T')[0].replace(/-/g, '.'),
            cumulativeViews: baseViews - (i * dailyViews)
        });
    }

    return data;
};

const generateExplosiveVideoData = (baseViews: number): VideoDailyStat[] => {
    const data: VideoDailyStat[] = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Latest day has massive views (e.g., 160k out of channel growth)
        const dailyViews = i === 0 ? 160000 : 1000;

        data.push({
            date: date.toISOString().split('T')[0].replace(/-/g, '.'),
            cumulativeViews: baseViews - (i * dailyViews)
        });
    }

    return data;
};

export const MOCK_VIDEO_DAILY: Record<string, VideoDailyStat[]> = {
    'v1': generateMockVideoData(450000),
    'v2': generateMockVideoData(890000),
    'v3': generateMockVideoData(1250000),
    'v2-1': generateExplosiveVideoData(1000000),
    'v2-2': generateMockVideoData(50000),
    'v2-3': generateMockVideoData(80000),
    'v4-1': generateMockVideoData(100000),
    'v-old-hit': generateExplosiveVideoData(5000000),
};
