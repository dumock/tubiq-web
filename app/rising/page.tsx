'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { MOCK_ASSETS } from '@/mock/channels';
import { MOCK_CHANNEL_DAILY } from '@/mock/channelDaily';
import RisingSummary from '@/components/RisingSummary';
import RisingFilterBar from '@/components/RisingFilterBar';
import RisingChannelTable from '@/components/RisingChannelTable';

export default function RisingPage() {
    const [countryFilter, setCountryFilter] = useState<'all' | 'KR' | 'overseas'>('all');
    const [topicFilter, setTopicFilter] = useState('all');
    const [sortKey, setSortKey] = useState<'dailyViews' | 'subscribers'>('dailyViews');

    const processedData = useMemo(() => {
        // 1. Filter only channels
        const channels = MOCK_ASSETS.filter(a => a.type === 'channel');

        // 2. Map with dailyViews helper
        const withDailyStats = channels.map(c => {
            const dailyData = MOCK_CHANNEL_DAILY[c.id];
            let dailyViews = 0;
            if (dailyData && dailyData.length >= 2) {
                const latest = dailyData[dailyData.length - 1];
                const prev = dailyData[dailyData.length - 2];
                dailyViews = latest.totalViews - prev.totalViews;
            }

            // Infer country for mock purposes
            const isKR = ['1', '2', '3'].includes(c.id) || (c.channelName && /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(c.channelName));
            const country = isKR ? 'KR' : 'US';

            return {
                ...c,
                dailyViews,
                country,
                isDomestic: isKR
            };
        });

        // 3. Apply Filters
        const filtered = withDailyStats.filter(c => {
            const matchesCountry =
                countryFilter === 'all' ||
                (countryFilter === 'KR' && c.isDomestic) ||
                (countryFilter === 'overseas' && !c.isDomestic);

            const matchesTopic = topicFilter === 'all' || c.topic === topicFilter;

            return matchesCountry && matchesTopic;
        });

        // 4. Sort
        const sorted = filtered.sort((a, b) => {
            if (sortKey === 'dailyViews') return b.dailyViews - a.dailyViews;
            return (b.subscribers || 0) - (a.subscribers || 0);
        });

        // 5. Slice & Add Rank
        return sorted.slice(0, 50).map((c, index) => ({
            id: c.id,
            rank: index + 1,
            thumbnail: c.avatarUrl || 'https://via.placeholder.com/100',
            name: c.channelName || c.title,
            dailyViews: c.dailyViews,
            subscribers: c.subscribers || 0,
            totalViews: c.viewCount || c.views || 0,
            videoCount: c.videoCount || 0,
            createdDate: c.publishedAt || '2023.01.01',
            country: c.country,
            channelUrl: c.channelUrl || '#',
            topic: c.topic || '기타'
        }));
    }, [countryFilter, topicFilter, sortKey]);

    const summary = useMemo(() => {
        const risingCount = processedData.filter(c => c.dailyViews > 0).length;
        const totalDailyViews = processedData.reduce((acc, curr) => acc + Math.max(0, curr.dailyViews), 0);
        const topChannel = processedData[0] || { name: '-', dailyViews: 0 };
        return { risingCount, totalDailyViews, topChannel };
    }, [processedData]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black">
            <Header />

            <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Title Section */}
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                        <TrendingUp className="h-5 w-5" />
                        <span className="text-xs font-bold uppercase tracking-widest">Growth Analytics</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">오늘 급등 채널 TOP</h1>
                    <p className="text-sm text-gray-500">최근 24시간 동안 가장 높은 폭으로 성장 중인 채널들입니다.</p>
                </div>

                {/* Summary Cards */}
                <RisingSummary
                    risingCount={summary.risingCount}
                    totalDailyViews={summary.totalDailyViews}
                    topChannel={summary.topChannel}
                />

                {/* Filter & Table Section */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                    <RisingFilterBar
                        countryFilter={countryFilter}
                        setCountryFilter={setCountryFilter}
                        topicFilter={topicFilter}
                        setTopicFilter={setTopicFilter}
                        sortKey={sortKey}
                        setSortKey={setSortKey}
                    />

                    <RisingChannelTable data={processedData} />
                </div>
            </main>
        </div>
    );
}
