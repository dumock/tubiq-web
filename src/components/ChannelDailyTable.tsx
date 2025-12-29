'use client';

interface DailyStat {
    date: string;
    totalViews: number;
    subscribers: number;
    videoCount: number;
}

interface ChannelDailyTableProps {
    data: DailyStat[];
}

export default function ChannelDailyTable({ data }: ChannelDailyTableProps) {
    // Reverse data to show most recent first
    const reversedData = [...data].reverse();

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-800 z-10 border-b border-gray-100 dark:border-zinc-700">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300">날짜</th>
                            <th className="px-6 py-4 font-semibold text-right text-gray-600 dark:text-gray-300">일조회수</th>
                            <th className="px-6 py-4 font-semibold text-right text-gray-600 dark:text-gray-300">총조회수</th>
                            <th className="px-6 py-4 font-semibold text-right text-gray-600 dark:text-gray-300">구독자 수</th>
                            <th className="px-6 py-4 font-semibold text-right text-gray-600 dark:text-gray-300">영상 수</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/50">
                        {reversedData.map((stat, index) => {
                            // Find corresponding previous stat to calculate daily views
                            // Note: index in reversedData i, corresponds to data item [length - 1 - i]
                            // The previous day in chronological order is [length - 1 - i - 1]
                            const originalIndex = data.length - 1 - index;
                            const prevStat = originalIndex > 0 ? data[originalIndex - 1] : null;
                            const dailyViews = prevStat ? stat.totalViews - prevStat.totalViews : 0;

                            return (
                                <tr key={stat.date} className="hover:bg-gray-50/50 transition-colors dark:hover:bg-zinc-800/30">
                                    <td className="px-6 py-4 text-gray-500 font-mono text-xs dark:text-gray-400">
                                        {stat.date}
                                    </td>
                                    <td className="px-6 py-4 text-right text-indigo-600 font-bold dark:text-indigo-400">
                                        {prevStat ? `+${dailyViews.toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-900 dark:text-gray-100 font-medium">
                                        {stat.totalViews.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                                        {stat.subscribers.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                                        {stat.videoCount.toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
