'use client';

import React from 'react';
import { Zap, TrendingUp, Award } from 'lucide-react';

interface RisingSummaryProps {
    risingCount: number;
    totalDailyViews: number;
    topChannel: {
        name: string;
        dailyViews: number;
    };
}

export default function RisingSummary({ risingCount, totalDailyViews, topChannel }: RisingSummaryProps) {
    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-50 rounded-lg dark:bg-indigo-900/20">
                        <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-500">오늘 급등 채널 수</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {risingCount.toLocaleString()}개
                </div>
                <div className="text-xs text-gray-400 mt-1">실시간 트래픽 증가 기준</div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-emerald-50 rounded-lg dark:bg-emerald-900/20">
                        <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-500">오늘 총 일조회수 합</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    +{formatNumber(totalDailyViews)}
                </div>
                <div className="text-xs text-gray-400 mt-1">오늘 하루 발생한 전체 조회수</div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-amber-50 rounded-lg dark:bg-amber-900/20">
                        <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-500">실시간 급등 1위</span>
                </div>
                <div className="flex items-end justify-between">
                    <div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[150px]">
                            {topChannel.name}
                        </div>
                        <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                            +{formatNumber(topChannel.dailyViews)} views
                        </div>
                    </div>
                    <div className="text-[10px] text-amber-500 font-bold px-2 py-0.5 bg-amber-50 rounded-full dark:bg-amber-900/20">
                        CHAMPION
                    </div>
                </div>
            </div>
        </div>
    );
}
