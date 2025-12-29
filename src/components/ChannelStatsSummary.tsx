'use client';

import React from 'react';
import { Eye, TrendingUp, Zap } from 'lucide-react';

interface ChannelDailyStat {
    date: string;
    totalViews: number;
}

interface ChannelStatsSummaryProps {
    data: ChannelDailyStat[];
}

export default function ChannelStatsSummary({ data }: ChannelStatsSummaryProps) {
    // Calculate daily increments
    const dailyViews = data.slice(1).map((stat, i) => ({
        date: stat.date,
        views: stat.totalViews - data[i].totalViews
    }));

    if (dailyViews.length === 0) return null;

    // 1. Total 30d views
    const total30d = dailyViews.reduce((acc, curr) => acc + curr.views, 0);

    // 2. Avg 7d daily views
    const last7Days = dailyViews.slice(-7);
    const avg7d = last7Days.reduce((acc, curr) => acc + curr.views, 0) / (last7Days.length || 1);

    // 3. Max daily views
    const maxDay = dailyViews.reduce((prev, curr) => (prev.views > curr.views ? prev : curr), dailyViews[0]);

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.floor(num).toLocaleString();
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-50 rounded-lg dark:bg-indigo-900/20">
                        <Eye className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-500">최근 30일 총 조회수</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(total30d)}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-green-50 rounded-lg dark:bg-green-900/20">
                        <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-500">최근 7일 평균 일조회수</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(avg7d)}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-orange-50 rounded-lg dark:bg-orange-900/20">
                        <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-500">최고 일조회수</span>
                </div>
                <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatNumber(maxDay.views)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                        {maxDay.date} 기록
                    </div>
                </div>
            </div>
        </div>
    );
}
