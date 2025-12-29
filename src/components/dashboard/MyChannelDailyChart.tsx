"use client";

import React, { useMemo, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    Area,
    AreaChart,
    ReferenceLine
} from 'recharts';
import { useMyChannelStore } from '@/lib/myChannelStore';
import { getMyChannelDailySeries, getMyChannelSummary } from '@/lib/analytics/myChannelAnalytics';
import { TrendingUp, DollarSign, Eye, CheckCircle2 } from 'lucide-react';

// Helper for formatting
const formatCompact = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
};

const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(num);
};

export function MyChannelDailyChart() {
    const { channels, isConnected } = useMyChannelStore();
    const [days, setDays] = useState<14 | 30>(14);

    const series = useMemo(() => {
        return getMyChannelDailySeries(channels, days);
    }, [channels, days]);

    const summary = useMemo(() => {
        return getMyChannelSummary(series);
    }, [series]);

    if (!isConnected) {
        return (
            <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-white p-8 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-white to-emerald-50/50 blur-3xl dark:from-indigo-900/10 dark:via-zinc-900 dark:to-emerald-900/10" />
                <div className="relative flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-6 flex -space-x-4">
                        <div className="h-16 w-16 rounded-full border-4 border-white bg-indigo-500 shadow-xl flex items-center justify-center dark:border-zinc-900">
                            <DollarSign className="h-8 w-8 text-white" />
                        </div>
                        <div className="h-16 w-16 rounded-full border-4 border-white bg-emerald-500 shadow-xl flex items-center justify-center dark:border-zinc-900">
                            <TrendingUp className="h-8 w-8 text-white" />
                        </div>
                    </div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">프리미엄 수익 및 성과 분석 활성화</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed mb-8">
                        YouTube 채널을 연결하면 모든 채널의 일별 예상 수익과 정밀 조회수 추이를 한눈에 분석할 수 있습니다.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold dark:bg-indigo-900/30 dark:text-indigo-300">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 정밀 수익 분석
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold dark:bg-emerald-900/30 dark:text-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 14/30일 통합 추이
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        내 채널 수익/조회 추이
                        {channels.some(c => c.connected && c.trackingEnabled) && (
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">추적 중인 채널들의 실시간 합산 성과 데이터</p>
                </div>

                <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg">
                    <button
                        onClick={() => setDays(14)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${days === 14 ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        14일
                    </button>
                    <button
                        onClick={() => setDays(30)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${days === 30 ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        30일
                    </button>
                </div>
            </div>

            <div className="h-80 w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.5} />
                        <XAxis
                            dataKey="date"
                            stroke="#9ca3af"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => val.split('-').slice(1).join('/')}
                            minTickGap={20}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#6366f1"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => formatCompact(val)}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#10b981"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => `$${formatCompact(val)}`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#18181b',
                                border: 'none',
                                borderRadius: '12px',
                                color: '#fff',
                                fontSize: '12px',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(value: any, name: string | undefined) => [
                                name === 'totalViews' ? formatNumber(value) : formatCurrency(value),
                                (name || '') === 'totalViews' ? '조회수' : '수익'
                            ]}
                            labelFormatter={(label) => `날짜: ${label}`}
                        />
                        <Legend
                            verticalAlign="top"
                            align="right"
                            iconType="circle"
                            wrapperStyle={{ paddingTop: '0', paddingBottom: '24px', fontSize: '11px', fontWeight: 'bold' }}
                            formatter={(value) => value === 'totalViews' ? '일일 조회수' : '일일 수익'}
                        />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="totalViews"
                            stroke="#6366f1"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                            animationDuration={1000}
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="totalRevenue"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                            animationDuration={1000}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-100 dark:border-zinc-800">
                <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                        <Eye className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">최근 7일 조회수 합</span>
                    </div>
                    <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                        {formatCompact(summary.totalViews7d)}
                    </p>
                </div>
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">최근 7일 예상 수익</span>
                    </div>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(summary.totalRevenue7d)}
                    </p>
                </div>
            </div>
        </div>
    );
}

// Helper to use project's existing formatNumber if available, or fallback
function formatNumber(num: number) {
    return new Intl.NumberFormat().format(num);
}
