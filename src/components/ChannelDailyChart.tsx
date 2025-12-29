'use client';

import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from 'recharts';

interface DailyStat {
    date: string;
    totalViews: number;
}

interface ChannelDailyChartProps {
    data: DailyStat[];
}

export default function ChannelDailyChart({ data }: ChannelDailyChartProps) {
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
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="dailyViewGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                    </defs>
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
                    <Area
                        type="monotone"
                        dataKey="dailyViews"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#dailyViewGradient)"
                        activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
