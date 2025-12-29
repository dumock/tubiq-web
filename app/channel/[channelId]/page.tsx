'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import {
    ChevronLeft,
    BarChart3,
    Users,
    Eye,
    PlaySquare,
    TrendingUp,
    Zap,
    Loader2
} from 'lucide-react';
import MetricCard from '@/components/MetricCard';
import GrowthChart from '@/components/GrowthChart';
import Link from 'next/link';
import VideoListTable from '@/components/VideoListTable';
import DailyViewPanel from '@/components/DailyViewPanel';
import ChannelDailyChart from '@/components/ChannelDailyChart';
import ChannelDailyTable from '@/components/ChannelDailyTable';
import ChannelStatsSummary from '@/components/ChannelStatsSummary';
import ChannelDailyViewsChart from '@/components/ChannelDailyViewsChart';
import ChannelDailyViewsTable from '@/components/ChannelDailyViewsTable';
import TopicSelector from '@/components/TopicSelector';
import { getTopicName } from '@/lib/topics';
import { supabase } from '@/lib/supabase';
import { MOCK_ASSETS } from '@/mock/channels';
import { MOCK_CHANNEL_DAILY } from '@/mock/channelDaily';
import { MOCK_VIDEOS } from '@/mock/videos';

export default function ChannelDetailPage() {
    const params = useParams();
    const channelId = params.channelId as string;

    // Find channel from main mock data (src/mock/channels.ts)
    const activeAsset = MOCK_ASSETS.find(a => a.id === channelId) || MOCK_ASSETS[0];

    // Fallback for fields used in UI
    const [channelData, setChannelData] = useState({
        name: activeAsset.channelName || activeAsset.title,
        handle: activeAsset.channelUrl?.includes('@') ? `@${activeAsset.channelUrl.split('@')[1]}` : '@channel',
        thumbnail: activeAsset.avatarUrl || 'https://via.placeholder.com/100',
        subscribers: activeAsset.subscribers || 0,
        totalViews: activeAsset.viewCount || activeAsset.views || 0,
        videoCount: activeAsset.videoCount || 0,
        avg7dViews: 125000,
        total30dViews: 3800000,
        topics_cached: [] as string[]
    });

    const [activeTab, setActiveTab] = useState<'video' | 'analysis'>('video');
    const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

    const formatCompactNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.floor(num).toLocaleString();
    };

    const dailyStats = MOCK_CHANNEL_DAILY[channelId] || MOCK_CHANNEL_DAILY['1'];

    // Calculate 7-day average daily views
    const last8Days = dailyStats.slice(-8);
    const dailyIncrements = last8Days.slice(1).map((stat, i) => stat.totalViews - last8Days[i].totalViews);
    const avg7dViewsCalc = dailyIncrements.reduce((a, b) => a + b, 0) / dailyIncrements.length;

    const selectedVideo = MOCK_VIDEOS.find(v => v.id === selectedVideoId) || null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black">
            <Header />

            <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Back Link & Title */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/channel-collect"
                            className="p-2 transition-colors hover:bg-gray-100 rounded-lg dark:hover:bg-zinc-800 text-gray-500"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm dark:ring-zinc-800">
                                <img src={channelData.thumbnail} alt="" className="h-full w-full object-cover" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{channelData.name}</h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{channelData.handle}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                        <BarChart3 className="h-4 w-4" />
                        실시간 데이터 추적 중
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-zinc-800">
                    <button
                        onClick={() => setActiveTab('video')}
                        className={`px-8 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'video'
                            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        영상
                    </button>
                    <button
                        onClick={() => setActiveTab('analysis')}
                        className={`px-8 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'analysis'
                            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        데이터 통계
                    </button>
                </div>

                {activeTab === 'video' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {/* 1. Summary Cards */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <MetricCard
                                title="최근 7일 평균 일조회수"
                                value={formatCompactNumber(avg7dViewsCalc)}
                                icon={TrendingUp}
                            />
                            <MetricCard
                                title="최근 30일 조회수 요약"
                                value={formatCompactNumber(channelData.total30dViews)}
                                icon={Eye}
                            />
                            <MetricCard
                                title="총 구독자"
                                value={formatCompactNumber(channelData.subscribers)}
                                icon={Users}
                            />
                            <MetricCard
                                title="전체 영상"
                                value={channelData.videoCount.toLocaleString()}
                                icon={PlaySquare}
                            />
                        </div>

                        {/* 2. Daily Stats Section */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">일별 일조회수 추이</h3>
                                    <p className="text-sm text-gray-500">최근 30일간의 트래픽 변화</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">7일 평균</div>
                                    <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                        +{formatCompactNumber(avg7dViewsCalc)}
                                    </div>
                                </div>
                            </div>

                            <ChannelDailyChart data={dailyStats} />
                        </div>

                        {/* 3. Daily Stats Table */}
                        <div className="space-y-3">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 px-1">
                                <BarChart3 className="h-5 w-5 text-indigo-500" />
                                일별 데이터 상세
                            </h3>
                            <ChannelDailyTable data={dailyStats} />
                        </div>

                        {/* 4. Video List Table (Optional, kept at bottom) */}
                        <VideoListTable
                            channelId={channelId}
                            onVideoClick={(id) => setSelectedVideoId(id)}
                        />
                    </div>
                )}

                {activeTab === 'analysis' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <ChannelStatsSummary data={dailyStats} />
                        <ChannelDailyViewsChart data={dailyStats} />
                        <ChannelDailyViewsTable data={dailyStats} />
                    </div>
                )}
            </main>

            <DailyViewPanel
                video={selectedVideo}
                onClose={() => setSelectedVideoId(null)}
            />
        </div>
    );
}
