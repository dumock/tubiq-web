'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';

interface ChannelDailyStat {
    date: string;
    totalViews: number;
    subscribers: number;
    videoCount: number;
}

interface ChannelDailyViewsTableProps {
    data: ChannelDailyStat[];
}

export default function ChannelDailyViewsTable({ data }: ChannelDailyViewsTableProps) {
    // Process data to include daily view increments
    // Data is usually sorted by date ascending in the mock.
    // We want to show most recent first in the table.

    const tableData = data.slice(1).map((stat, index) => {
        const prevStat = data[index];
        const dailyViews = stat.totalViews - prevStat.totalViews;
        return {
            ...stat,
            dailyViews
        };
    }).reverse();

    const formatNumber = (num: number) => {
        return Math.floor(num).toLocaleString();
    };

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-indigo-500" />
                    일별 데이터 상세
                </h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 dark:bg-zinc-800/50 dark:border-zinc-800 dark:text-gray-400">
                        <tr>
                            <th className="px-6 py-4 font-semibold">날짜</th>
                            <th className="px-6 py-4 font-semibold text-right">일조회수</th>
                            <th className="px-6 py-4 font-semibold text-right">누적 조회수</th>
                            <th className="px-6 py-4 font-semibold text-right">구독자</th>
                            <th className="px-6 py-4 font-semibold text-right">영상 개수</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                        {tableData.map((row) => (
                            <tr key={row.date} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{row.date}</td>
                                <td className="px-6 py-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                    +{formatNumber(row.dailyViews)}
                                </td>
                                <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-300">
                                    {formatNumber(row.totalViews)}
                                </td>
                                <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-300">
                                    {formatNumber(row.subscribers)}
                                </td>
                                <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-300">
                                    {formatNumber(row.videoCount)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
