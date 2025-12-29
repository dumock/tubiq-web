export interface MyChannelDailyStat {
    date: string;
    channelId: string;
    viewsDelta: number;
    subsDelta: number;
    estimatedRevenue: number; // In USD
}

const generateMockDaily = (channelId: string, baseViews: number, baseRev: number, days: number): MyChannelDailyStat[] => {
    const stats: MyChannelDailyStat[] = [];
    const today = new Date();

    for (let i = days; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];

        // Add some random variance
        const variance = 0.8 + Math.random() * 0.4;
        stats.push({
            date: dateString,
            channelId,
            viewsDelta: Math.floor(baseViews * variance),
            subsDelta: Math.floor((baseViews / 100) * variance),
            estimatedRevenue: Number((baseRev * variance).toFixed(2))
        });
    }
    return stats;
};

export const MOCK_MY_CHANNEL_DAILY: MyChannelDailyStat[] = [
    ...generateMockDaily('UC_my_channel_1', 50000, 150.50, 30),
    ...generateMockDaily('UC_my_channel_2', 12000, 45.20, 30),
    ...generateMockDaily('UC_my_channel_3', 35000, 110.00, 30),
];
