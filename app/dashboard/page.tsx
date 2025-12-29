'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import ClientOnly from '@/components/ClientOnly';
import { MyChannelConnectCard } from '@/components/dashboard/MyChannelConnectCard';
import { MyChannelDailyChart } from '@/components/dashboard/MyChannelDailyChart';
import { RevenueAnalyticsCard } from '@/components/dashboard/RevenueAnalyticsCard';
import {
    Users,
    Eye,
    PlaySquare,
    Tv,
    Plus,
    FolderOpen,
    TrendingUp,
    TrendingDown,
    Flame,
    ExternalLink,
    ArrowUpRight,
    AlertCircle,
    ArrowUpCircle,
    ArrowDownCircle,
    Zap
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';

// ================================
// Dashboard Mock Data (Managed Channels Focus)
// ================================

// "Managed Channels" simulation (e.g., Channels 1, 2, 4)
const managedChannelIds = ['1', '2', '4'];

// KPI Summary (Aggregated for managed channels)
const kpiData = {
    managedChannels: 3,
    totalSubscribers: 2450000,
    last30DaysViews: 12500000,
    trackingVideos: 48
};

// Aggregated Trend Data (Recent 14 days, Static to avoid Hydration Mismatch)
const aggregatedGraphData = [
    { date: '12/10', totalViews: 1200000, subsChange: 1200 },
    { date: '12/11', totalViews: 1250000, subsChange: 1350 },
    { date: '12/12', totalViews: 1180000, subsChange: 980 },
    { date: '12/13', totalViews: 1320000, subsChange: 1540 },
    { date: '12/14', totalViews: 1450000, subsChange: 2100 },
    { date: '12/15', totalViews: 1380000, subsChange: 1800 },
    { date: '12/16', totalViews: 1520000, subsChange: 2400 },
    { date: '12/17', totalViews: 1480000, subsChange: 1900 },
    { date: '12/18', totalViews: 1650000, subsChange: 2800 },
    { date: '12/19', totalViews: 1720000, subsChange: 3100 },
    { date: '12/20', totalViews: 1580000, subsChange: 2200 },
    { date: '12/21', totalViews: 1850000, subsChange: 3500 },
    { date: '12/22', totalViews: 1920000, subsChange: 4200 },
    { date: '12/23', totalViews: 2100000, subsChange: 4800 },
];

// "Today's Anomalies" Data
const anomalyData = [
    {
        id: 'a1',
        type: 'spike',
        level: 'critical',
        title: '조회수 급등 (평균 대비 4.2배)',
        description: '과거 업로드한 "전설의 영상"이 쇼츠 역주행으로 인해 조회수 폭증 중',
        videoId: 'v-old-hit',
        thumbnail: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=320&h=180&fit=crop',
        channelName: '침착맨',
        timestamp: '10분 전'
    },
    {
        id: 'a2',
        type: 'risk',
        level: 'warning',
        title: '삭제/차단 감지',
        description: '업로드된 영상 중 1건이 저작권 사유로 차단 의심 상태입니다.',
        videoId: 'v-block',
        thumbnail: 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?w=320&h=180&fit=crop',
        channelName: '침착맨',
        timestamp: '1시간 전'
    },
    {
        id: 'a3',
        type: 'efficiency',
        level: 'info',
        title: '신규 고효율 영상',
        description: '7일 이내 업로드된 영상 중 구독자 수 대비 최상위 효율 기록',
        videoId: 'v4-1',
        thumbnail: 'https://picsum.photos/seed/v41/320/180',
        channelName: '신규급등러',
        timestamp: '3시간 전'
    }
];

// Managed Channel sparklines
const managedChannelsTrend = [
    { id: '1', name: '침착맨', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=c', change: 12, sparkline: [100, 110, 105, 120, 130, 125, 140] },
    { id: '2', name: 'Tech Insider', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=t', change: -2, sparkline: [150, 145, 148, 142, 140, 138, 135] },
    { id: '4', name: '신규급등러', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=n', change: 45, sparkline: [10, 20, 35, 50, 80, 120, 180] },
];

// Today's Rising Videos (Managed Channels)
const risingVideosData = [
    {
        id: 'v-old-hit',
        title: '과거에 올렸던 전설의 영상 (역주행 중)',
        thumbnail: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=320&h=180&fit=crop',
        todayViews: 120000,
        channelTodayViews: 180000
    },
    {
        id: 'v4-1',
        title: '신규 채널의 고효율 영상',
        thumbnail: 'https://picsum.photos/seed/v41/320/180',
        todayViews: 50000,
        channelTodayViews: 85000
    }
];

// ================================
// Helper Functions
// ================================

const formatNumber = (num: number): string => {
    if (num >= 100000000) return `${(num / 100000000).toFixed(1)}억`;
    if (num >= 10000) return `${(num / 10000).toFixed(1)}만`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}천`;
    return num.toString();
};

const formatCompact = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
};

// ================================
// Sub Components
// ================================

// Summary Card Component
function SummaryCard({
    title,
    value,
    icon: Icon,
    color
}: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
}) {
    const colorClasses: Record<string, string> = {
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    };

    return (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorClasses[color]}`}>
                    <Icon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                </div>
            </div>
        </div>
    );
}

// Channel Trend Mini Card
function TrendMiniCard({
    channel
}: {
    channel: typeof managedChannelsTrend[0]
}) {
    const isPositive = channel.change >= 0;

    return (
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
                <img
                    src={channel.avatar}
                    alt={channel.name}
                    className="h-10 w-10 rounded-full object-cover bg-gray-100"
                />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate dark:text-white">
                        {channel.name}
                    </p>
                    <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {isPositive ? '+' : ''}{channel.change}%
                    </div>
                </div>
            </div>
            <div className="h-12">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={channel.sparkline.map((value: number, i: number) => ({ value, i }))}>
                        <defs>
                            <linearGradient id={`gradient-${channel.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={isPositive ? '#10b981' : '#f43f5e'}
                            strokeWidth={2}
                            fill={`url(#gradient-${channel.id})`}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// Today's Anomaly Card
function AnomalyCard({ anomaly }: { anomaly: typeof anomalyData[0] }) {
    const iconMap: Record<string, any> = {
        spike: { icon: ArrowUpCircle, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
        risk: { icon: AlertCircle, color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
        efficiency: { icon: Zap, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
        drop: { icon: ArrowDownCircle, color: 'text-gray-500 bg-gray-50 dark:bg-zinc-800' }
    };

    const { icon: Icon, color } = iconMap[anomaly.type] || iconMap.drop;

    return (
        <div className="relative flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all dark:bg-zinc-900 dark:border-zinc-800">
            <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-lg">
                <img src={anomaly.thumbnail} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/10" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 mb-1">
                        <div className={`p-1 rounded ${color}`}>
                            <Icon className="w-3 h-3" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{anomaly.timestamp}</span>
                    </div>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${anomaly.level === 'critical' ? 'bg-red-500 text-white' :
                        anomaly.level === 'warning' ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                        }`}>
                        {anomaly.level.toUpperCase()}
                    </span>
                </div>
                <h4 className="text-sm font-bold text-gray-900 line-clamp-1 mb-1 dark:text-white">{anomaly.title}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{anomaly.description}</p>
                <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{anomaly.channelName}</span>
                    <button className="text-[10px] font-bold text-gray-400 flex items-center gap-1 hover:text-indigo-600 transition-colors">
                        영상 확인 <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Rising Video Card
function RisingVideoCard({ video }: { video: typeof risingVideosData[0] }) {
    const contribution = Math.round((video.todayViews / video.channelTodayViews) * 100);

    return (
        <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer dark:bg-zinc-900 dark:border-zinc-800">
            <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg">
                <img src={video.thumbnail} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-gray-900 line-clamp-1 mb-1 dark:text-white">{video.title}</h4>
                <div className="flex items-baseline gap-2">
                    <span className="text-sm font-black text-emerald-500">+{formatNumber(video.todayViews)}</span>
                    <span className="text-[10px] font-bold text-gray-400">채널 기여도 {contribution}%</span>
                </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-gray-300" />
        </div>
    );
}

// ================================
// Main Dashboard Page
// ================================

export default function DashboardPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black">
            <ClientOnly>
                <Header />

                <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Main Content */}
                        <div className="flex-1 min-w-0 space-y-6">

                            {/* Section Title */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">내 채널 관제 홈</h1>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        오늘 내 채널의 이상 신호와 통합 성장 지표를 확인하세요
                                    </p>
                                </div>
                            </div>

                            {/* 1. Overview Summary Cards (Managed Channels Focus) */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <SummaryCard
                                    title="관리 중 채널"
                                    value={kpiData.managedChannels}
                                    icon={Tv}
                                    color="indigo"
                                />
                                <SummaryCard
                                    title="전체 구독자"
                                    value={formatCompact(kpiData.totalSubscribers)}
                                    icon={Users}
                                    color="emerald"
                                />
                                <SummaryCard
                                    title="내 채널 30일 조회수"
                                    value={formatCompact(kpiData.last30DaysViews)}
                                    icon={Eye}
                                    color="rose"
                                />
                                <SummaryCard
                                    title="추적 중 영상"
                                    value={kpiData.trackingVideos}
                                    icon={PlaySquare}
                                    color="amber"
                                />
                            </div>

                            {/* 2. Today's Anomalies Section (CRITICAL MONITORING) */}
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 dark:text-white">
                                        오늘의 이상 신호
                                        <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                    </h2>
                                    <button className="text-xs font-bold text-indigo-600 hover:underline">전체 보기</button>
                                </div>
                                <div className="grid gap-4">
                                    {anomalyData.map((anomaly) => (
                                        <AnomalyCard key={anomaly.id} anomaly={anomaly} />
                                    ))}
                                </div>
                            </section>

                            {/* Today's Rising Videos (NEW Section) */}
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 dark:text-white">
                                        🔥 오늘 내 채널 급등 영상
                                    </h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {risingVideosData.length > 0 ? (
                                        risingVideosData.map((video) => (
                                            <RisingVideoCard key={video.id} video={video} />
                                        ))
                                    ) : (
                                        <div className="col-span-full py-8 text-center rounded-xl border border-dashed border-gray-200 dark:border-zinc-800">
                                            <p className="text-sm text-gray-500">오늘 급등한 영상이 아직 없습니다.</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* 3. Integrated Growth Trend (Restored) */}
                            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-white">
                                    내 채널 통합 성장 추이 (14일)
                                </h2>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={aggregatedGraphData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.5} />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#9ca3af"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis
                                                yAxisId="left"
                                                stroke="#9ca3af"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => formatCompact(value)}
                                            />
                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                stroke="#9ca3af"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => `+${formatCompact(value)}`}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#18181b',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    color: '#fff',
                                                    fontSize: '12px'
                                                }}
                                                formatter={(value, name) => [
                                                    formatNumber(Number(value)),
                                                    name === 'totalViews' ? '합산 조회수' : '구독자 증감'
                                                ]}
                                            />
                                            <Legend
                                                verticalAlign="top"
                                                align="right"
                                                wrapperStyle={{ paddingTop: '0', paddingBottom: '20px', fontSize: '12px' }}
                                                formatter={(value) => value === 'totalViews' ? '합산 조회수' : '구독자 증감'}
                                            />
                                            <Line
                                                yAxisId="left"
                                                type="monotone"
                                                dataKey="totalViews"
                                                stroke="#6366f1"
                                                strokeWidth={3}
                                                dot={false}
                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                            />
                                            <Line
                                                yAxisId="right"
                                                type="monotone"
                                                dataKey="subsChange"
                                                stroke="#10b981"
                                                strokeWidth={3}
                                                dot={false}
                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* 4. My Channel Daily Analytics (Revenue/Performance Focus) */}
                            <MyChannelDailyChart />

                            {/* 4. Managed Channels Status */}
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-white">
                                    관리 중인 채널 현황
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {managedChannelsTrend.map((channel) => (
                                        <TrendMiniCard key={channel.id} channel={channel} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Side Action Panel */}
                        <div className="hidden lg:block lg:w-64 xl:w-72 flex-shrink-0">
                            <div className="sticky top-24 space-y-4">
                                {/* Monitoring Summary (Moved to Top) */}
                                <div className="rounded-xl border border-gray-100 bg-zinc-900 p-5 shadow-lg text-white">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-bold">실시간 관제 현황</h3>
                                        <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-400">데이터 동기화</span>
                                            <span className="text-xs font-bold text-green-400">정상</span>
                                        </div>
                                        <div className="pt-3 border-t border-zinc-800 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-400">신규 조회수</span>
                                                <span className="text-xs font-bold text-white">+2.4M</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-400">신규 구독자</span>
                                                <span className="text-xs font-bold text-white">+12.5K</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-400">업로드 영상</span>
                                                <span className="text-xs font-bold text-white">3개</span>
                                            </div>
                                        </div>
                                        <div className="pt-3 border-t border-zinc-800">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-400">오늘 합산 증감</span>
                                                <p className="flex items-center gap-1 text-xs font-bold text-blue-400">
                                                    <TrendingUp className="w-3 h-3" />
                                                    +12.4%
                                                </p>
                                            </div>
                                        </div>
                                        <div className="pt-3 border-t border-zinc-800">
                                            <p className="text-[10px] text-gray-500 mb-1">마지막 업데이트</p>
                                            <p className="text-xs font-mono text-gray-300">2025-12-24 05:10</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                    <h3 className="text-sm font-bold text-gray-900 mb-4 dark:text-white">
                                        빠른 제어
                                    </h3>
                                    <div className="space-y-2">
                                        <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <Plus className="h-4 w-4" />
                                                채널 추가
                                            </div>
                                            <ArrowUpCircle className="w-3 h-3 opacity-50" />
                                        </button>
                                        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-colors dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700">
                                            <PlaySquare className="h-4 w-4 text-gray-400" />
                                            영상 추적 설정
                                        </button>
                                        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-colors dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700">
                                            <FolderOpen className="h-4 w-4 text-gray-400" />
                                            카테고리 분류
                                        </button>
                                    </div>
                                </div>

                                <RevenueAnalyticsCard />
                                <MyChannelConnectCard />
                            </div>
                        </div>
                    </div>
                </main>
            </ClientOnly>
        </div>
    );
}
