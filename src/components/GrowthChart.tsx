'use client';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from 'recharts';
import { ArrowUpRight } from 'lucide-react';

const data = [
    { name: 'Jan', value: 4000, organic: 2400 },
    { name: 'Feb', value: 3000, organic: 1398 },
    { name: 'Mar', value: 2000, organic: 9800 },
    { name: 'Apr', value: 2780, organic: 3908 },
    { name: 'May', value: 1890, organic: 4800 },
    { name: 'Jun', value: 2390, organic: 3800 },
    { name: 'Jul', value: 3490, organic: 4300 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                <p className="mb-2 text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                <div className="flex flex-col gap-1">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                            <div
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-gray-500 dark:text-gray-400">
                                {entry.name === 'value' ? '전체 조회수' : '유기적 트래픽'}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {entry.value.toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

export default function GrowthChart() {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        일일 조회수 추이
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        최근 일일 조회수 및 유기적 트래픽 추이
                    </p>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    <ArrowUpRight className="h-4 w-4" />
                    <span>+24.5%</span>
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{
                            top: 5,
                            right: 10,
                            left: 0,
                            bottom: 0,
                        }}
                    >
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorOrganic" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#E5E7EB"
                            className="dark:stroke-zinc-800"
                        />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            tickFormatter={(value) => `${value / 1000}k`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#6366f1" // indigo-500
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                        <Area
                            type="monotone"
                            dataKey="organic"
                            stroke="#10b981" // emerald-500
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorOrganic)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
