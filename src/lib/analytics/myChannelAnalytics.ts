import { MOCK_MY_CHANNEL_DAILY, MyChannelDailyStat } from '@/mock/myChannelDaily';
import { MyChannel } from '@/mock/myChannels';

export interface DailySeriesItem {
    date: string;
    totalViews: number;
    totalRevenue: number;
}

export function getMyChannelDailySeries(
    connectedChannels: MyChannel[],
    days: number = 14
): DailySeriesItem[] {
    const trackingChannelIds = new Set(
        connectedChannels.filter(ch => ch.connected && ch.trackingEnabled).map(ch => ch.channelId)
    );

    const filteredData = MOCK_MY_CHANNEL_DAILY.filter(stat => trackingChannelIds.has(stat.channelId));

    // Get date range
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days + 1);
    const startDateStr = startDate.toISOString().split('T')[0];

    const dailyMap: Record<string, { views: number; rev: number }> = {};

    filteredData.forEach(stat => {
        if (stat.date >= startDateStr) {
            if (!dailyMap[stat.date]) {
                dailyMap[stat.date] = { views: 0, rev: 0 };
            }
            dailyMap[stat.date].views += stat.viewsDelta;
            dailyMap[stat.date].rev += stat.estimatedRevenue;
        }
    });

    return Object.entries(dailyMap)
        .map(([date, data]) => ({
            date,
            totalViews: data.views,
            totalRevenue: data.rev
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

export function getMyChannelSummary(series: DailySeriesItem[]) {
    const last7Days = series.slice(-7);

    return {
        totalRevenue7d: last7Days.reduce((sum, item) => sum + item.totalRevenue, 0),
        totalViews7d: last7Days.reduce((sum, item) => sum + item.totalViews, 0)
    };
}
