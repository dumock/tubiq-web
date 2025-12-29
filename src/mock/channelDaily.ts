export interface ChannelDailyStat {
    date: string;
    totalViews: number;
    subscribers: number;
    videoCount: number;
}

const generateMockDailyData = (
    baseViews: number,
    baseSubs: number,
    baseVideos: number
): ChannelDailyStat[] => {
    const data: ChannelDailyStat[] = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Use deterministic growth based on index to avoid hydration mismatch
        const dailyGrowth = 200000 + (i * 5000); // Deterministic
        const subGrowth = 200 + (i * 10); // Deterministic
        const videoGrowth = i % 5 === 0 ? 1 : 0; // Deterministic

        data.push({
            date: date.toISOString().split('T')[0].replace(/-/g, '.'),
            totalViews: baseViews - (i * dailyGrowth),
            subscribers: baseSubs - (i * subGrowth),
            videoCount: baseVideos - (i * videoGrowth)
        });
    }

    return data;
};

export const MOCK_CHANNEL_DAILY: Record<string, ChannelDailyStat[]> = {
    '1': generateMockDailyData(1500000000, 2300000, 2500),
    '2': generateMockDailyData(2000000000, 3000000, 800),
    '3': generateMockDailyData(1000000000, 2500000, 1200),
    '4': generateMockDailyData(5000000, 150000, 8),
    '5': generateMockDailyData(2400000, 80000, 15),
    'test-a': generateMockDailyData(12000000, 500000, 10),
    'test-b': generateMockDailyData(2000000, 120000, 8),
};
