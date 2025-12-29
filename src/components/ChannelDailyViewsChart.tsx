'use client';

import React from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from 'recharts';

interface ChannelDailyStat {
    date: string;
    totalViews: number;
}

interface ChannelDailyViewsChartProps {
    data: ChannelDailyStat[];
}

export default function ChannelDailyViewsChart({ data }: ChannelDailyViewsChartProps) {
    // Calculate daily views: Today's Total - Yesterday's Total
    const chartData = data.slice(1).map((stat, index) => {
        const prevStat = data[index];
        const dailyViews = stat.totalViews - prevStat.totalViews;
        return {
            date: stat.date.split('.').slice(1).join('.'), // MM.DD
            dailyViews,
            fullDate: stat.date
        };
    });

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">일별 조회수 변동 추이</h3>
                <p className="text-sm text-gray-500">최근 30일간의 일일 조회수 발생 현황</p>
            </div>

            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#E5E7EB"
                            className="dark:stroke-zinc-800"
                        />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 11 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 11 }}
                            tickFormatter={(val) => {
                                if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                                if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
                                return val;
                            }}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                                            <p className="text-xs font-bold text-gray-400 mb-1">{payload[0].payload.fullDate}</p>
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-indigo-500" />
                                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {payload[0].value?.toLocaleString()} Views
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="dailyViews"
                            stroke="#6366f1"
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
