'use client';

import { X, TrendingUp } from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

interface SubscriberChartModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MOCK_DATA = [
    { date: '2025.12.01', subscribers: 10500 },
    { date: '2025.12.04', subscribers: 10800 },
    { date: '2025.12.08', subscribers: 11200 },
    { date: '2025.12.12', subscribers: 11500 },
    { date: '2025.12.15', subscribers: 12100 },
    { date: '2025.12.18', subscribers: 12300 },
    { date: '2025.12.20', subscribers: 12500 }
];

export default function SubscriberChartModal({ isOpen, onClose }: SubscriberChartModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl scale-100 transform overflow-hidden rounded-3xl bg-white shadow-2xl transition-all dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-50 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg dark:bg-indigo-900/20 dark:text-indigo-400">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">구독자 성장 추이</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">지난 30일간의 구독자 변화</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Chart Content */}
                <div className="p-6">
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={MOCK_DATA}>
                                <defs>
                                    <linearGradient id="colorSub" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                    domain={['dataMin - 500', 'dataMax + 500']}
                                    tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                        backgroundColor: '#fff',
                                        fontSize: '12px'
                                    }}
                                    labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="subscribers"
                                    stroke="#4f46e5"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorSub)"
                                    name="구독자 수"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/50">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">현재 구독자</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">12,500</p>
                        </div>
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/50">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">이번 달 증가</p>
                            <p className="text-lg font-bold text-green-600">+1,520</p>
                        </div>
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/50">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">일평균 증가</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">50.6</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
