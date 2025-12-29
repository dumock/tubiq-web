"use client";

import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useMyChannelStore } from '@/lib/myChannelStore';
import { getMyChannelDailySeries, getMyChannelSummary } from '@/lib/analytics/myChannelAnalytics';
import { DollarSign, TrendingUp } from 'lucide-react';

export function RevenueAnalyticsCard() {
    const { channels, isConnected } = useMyChannelStore();

    const series = useMemo(() => {
        return getMyChannelDailySeries(channels, 14);
    }, [channels]);

    const summary = useMemo(() => {
        return getMyChannelSummary(series);
    }, [series]);

    if (!isConnected) return null;

    return (
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3 text-emerald-500" />
                    예상 수익 (최근 14일)
                </h3>
                <div className="text-emerald-600 font-black text-xs bg-emerald-50 px-2 py-0.5 rounded dark:bg-emerald-900/20 dark:text-emerald-400">
                    ${summary.totalRevenue7d.toFixed(2)}
                </div>
            </div>

            <div className="h-32 w-full mb-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series}>
                        <defs>
                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="date" hide />
                        <YAxis hide domain={['auto', 'auto']} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '10px' }}
                            labelStyle={{ display: 'none' }}
                            formatter={(val: number | undefined) => [`$${(val || 0).toFixed(2)}`, '수익']}
                        />
                        <Area
                            type="monotone"
                            dataKey="totalRevenue"
                            stroke="#10b981"
                            fillOpacity={1}
                            fill="url(#colorRev)"
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-zinc-800">
                <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] font-bold text-gray-500">전주 대비 성장 중</span>
                </div>
                <button className="text-[10px] font-bold text-indigo-600 hover:underline">상세 분석</button>
            </div>
        </div>
    );
}
