'use client';

interface DailyStat {
    date: string;
    cumulativeViews: number;
}

interface VideoDailyTableProps {
    data: DailyStat[];
}

export default function VideoDailyTable({ data }: VideoDailyTableProps) {
    // Reverse data to show most recent first
    const reversedData = [...data].reverse();

    return (
        <div className="rounded-xl border border-gray-100 overflow-hidden dark:border-zinc-800">
            <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-zinc-800/50">
                    <tr>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">날짜</th>
                        <th className="px-4 py-3 font-semibold text-right text-gray-700 dark:text-gray-300">증감</th>
                        <th className="px-4 py-3 font-semibold text-right text-gray-700 dark:text-gray-300">누적</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                    {reversedData.map((stat, index) => {
                        // Find corresponding previous stat to calculate daily views
                        const originalIndex = data.length - 1 - index;
                        const prevStat = originalIndex > 0 ? data[originalIndex - 1] : null;
                        const dailyViews = prevStat ? stat.cumulativeViews - prevStat.cumulativeViews : 0;

                        return (
                            <tr key={stat.date} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono">
                                    {stat.date}
                                </td>
                                <td className="px-4 py-3 text-right text-indigo-600 font-bold dark:text-indigo-400">
                                    {prevStat ? `+${dailyViews.toLocaleString()}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-200">
                                    {stat.cumulativeViews.toLocaleString()}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
