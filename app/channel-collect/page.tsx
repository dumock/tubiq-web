'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import ClientOnly from '@/components/ClientOnly';
import {
    Search,
    Globe,
    Zap,
    TrendingUp,
    Database,
    Languages,
    Play,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import { calculateGoodChannelScore } from '@/lib/goodChannelScore';

interface CollectedChannel {
    id: string;
    thumbnail: string;
    name: string;
    subscribers: number;
    totalViews: number;
    videoCount: number;
    createdDate: string;
    country: string;
    collectedAt: string;
    isDomestic: boolean;
    topic?: string;
    topics_cached?: string[];
    dailyViews: number;
    channelUrl?: string;
}

const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
};

export default function ChannelCollectPage() {
    const [channels, setChannels] = useState<CollectedChannel[]>([]);
    const [summary, setSummary] = useState({
        totalChannels: 0,
        domesticChannels: 0,
        overseasChannels: 0,
        dailyGrowthRate: 0
    });
    const [jobStatus, setJobStatus] = useState<'idle' | 'running' | 'finished' | 'failed'>('idle');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filter & Pagination States
    const [filter, setFilter] = useState<'all' | 'domestic' | 'overseas'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof CollectedChannel; direction: 'asc' | 'desc' }>({
        key: 'collectedAt',
        direction: 'desc'
    });

    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // Fetch Summary & Job Status
    const fetchMetadata = async () => {
        try {
            const [summaryRes, jobRes] = await Promise.all([
                fetch('/api/collector/summary'),
                fetch('/api/collector/job/latest')
            ]);
            const summaryData = await summaryRes.json();
            const jobData = await jobRes.json();

            if (summaryData.ok) setSummary(summaryData.data);
            if (jobData.ok) setJobStatus(jobData.data.status);
        } catch (error) {
            console.error('Failed to fetch metadata', error);
        }
    };

    // Fetch Channels
    const fetchChannels = async () => {
        setIsRefreshing(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: pageSize.toString(),
                filter,
                query: searchQuery,
                sortBy: sortConfig.key,
                sortOrder: sortConfig.direction
            });

            const res = await fetch(`/api/collector/channels?${params}`);
            const data = await res.json();

            if (data.ok) {
                setChannels(data.data);
                setTotalCount(data.pagination.totalCount);
                setTotalPages(data.pagination.totalPages);
            }
        } catch (error) {
            console.error('Failed to fetch channels', error);
        } finally {
            setIsRefreshing(false);
            setIsLoading(false);
        }
    };

    // Correctly handle useEffect for fetching channels
    useEffect(() => {
        fetchChannels();
    }, [page, filter, sortConfig, searchQuery]); // Added searchQuery to dependencies

    useEffect(() => {
        fetchMetadata();
        const interval = setInterval(fetchMetadata, 30000); // Poll metadata every 30s
        return () => clearInterval(interval);
    }, []);

    // Handle Search with explicit enter
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1); // Reset page to 1 on new search
        fetchChannels();
    };

    const handleSort = (key: keyof CollectedChannel) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
        setPage(1);
    };

    const SortIcon = ({ columnKey }: { columnKey: keyof CollectedChannel }) => {
        if (sortConfig.key !== columnKey) return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400 opacity-50 group-hover:opacity-100 transition-opacity" />;
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 stroke-[3px]" />
            : <ChevronDown className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 stroke-[3px]" />;
    };


    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'running': return { label: '수집 중...', color: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100' };
            case 'finished': return { label: '완료', color: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-100' };
            case 'failed': return { label: '실패', color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-100' };
            default: return { label: '대기 중', color: 'bg-gray-300', text: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' };
        }
    };

    const status = getStatusInfo(jobStatus);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black">
            <Header />


            <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                            <Database className="h-5 w-5" />
                            <span className="text-xs font-bold uppercase tracking-widest">Global Collector</span>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">전세계 채널 수집</h1>
                        <p className="text-sm text-gray-500">전 세계 유튜브 채널을 실시간으로 추적하고 수집합니다.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/rising"
                            className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl hover:bg-amber-100 transition-all dark:bg-amber-900/20 dark:border-amber-500/30 dark:text-amber-400 shadow-sm"
                        >
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-sm font-bold">오늘 급등 채널 보기</span>
                        </Link>
                        <div className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-all shadow-sm ${status.bg} ${status.border}`}>
                            <div className={`h-2 w-2 rounded-full ${status.color} ${jobStatus === 'running' ? 'animate-pulse' : ''}`} />
                            <span className={`text-sm font-medium ${status.text}`}>
                                {status.label}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Stats Dashboard */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="p-2 w-fit bg-blue-50 text-blue-600 rounded-lg mb-3 dark:bg-blue-900/20">
                            <Zap className="h-5 w-5" />
                        </div>
                        <div className="text-2xl font-bold dark:text-white">
                            {isLoading ? '...' : summary.totalChannels.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">누적 수집 채널</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="p-2 w-fit bg-red-50 text-red-600 rounded-lg mb-3 dark:bg-red-900/20">
                            <Languages className="h-5 w-5" />
                        </div>
                        <div className="text-2xl font-bold dark:text-white">
                            {isLoading ? '...' : summary.domesticChannels.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">국내 채널</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="p-2 w-fit bg-blue-50 text-blue-600 rounded-lg mb-3 dark:bg-blue-900/20">
                            <Globe className="h-5 w-5" />
                        </div>
                        <div className="text-2xl font-bold dark:text-white">
                            {isLoading ? '...' : summary.overseasChannels.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">해외 채널</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="p-2 w-fit bg-amber-50 text-amber-600 rounded-lg mb-3 dark:bg-amber-900/20">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div className="text-2xl font-bold text-green-600">
                            +{summary.dailyGrowthRate}%
                        </div>
                        <div className="text-xs text-gray-500">오늘 수집 증가율</div>
                    </div>
                </div>

                {/* Filter & Table Section */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                    {/* Control Bar */}
                    <div className="p-4 border-b border-gray-50 dark:border-zinc-800 flex flex-col sm:flex-row gap-4 items-center justify-between flex-wrap">

                        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                            {/* Filter Buttons */}
                            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl dark:bg-zinc-800">
                                <button
                                    onClick={() => { setFilter('all'); setPage(1); }}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filter === 'all' ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    전체
                                </button>
                                <button
                                    onClick={() => { setFilter('domestic'); setPage(1); }}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filter === 'domestic' ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    국내 채널
                                </button>
                                <button
                                    onClick={() => { setFilter('overseas'); setPage(1); }}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filter === 'overseas' ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    해외 채널
                                </button>
                            </div>

                            <form onSubmit={handleSearch} className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="채널명으로 검색"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-zinc-800 dark:text-white"
                                />
                            </form>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto relative min-h-[400px]">
                        {isRefreshing && (
                            <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                            </div>
                        )}
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-50 dark:bg-zinc-800/50 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">썸네일</th>
                                    <th className="px-6 py-4 font-semibold cursor-pointer group" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-1">
                                            채널명 <SortIcon columnKey="name" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 font-semibold text-right cursor-pointer group" onClick={() => handleSort('dailyViews')}>
                                        <div className="flex items-center justify-end gap-1">
                                            일조회수 <SortIcon columnKey="dailyViews" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 font-semibold text-right cursor-pointer group" onClick={() => handleSort('subscribers')}>
                                        <div className="flex items-center justify-end gap-1">
                                            구독자수 <SortIcon columnKey="subscribers" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 font-semibold text-right cursor-pointer group" onClick={() => handleSort('totalViews')}>
                                        <div className="flex items-center justify-end gap-1">
                                            총조회수 <SortIcon columnKey="totalViews" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 font-semibold text-right cursor-pointer group" onClick={() => handleSort('videoCount')}>
                                        <div className="flex items-center justify-end gap-1">
                                            영상수 <SortIcon columnKey="videoCount" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 font-semibold cursor-pointer group" onClick={() => handleSort('createdDate')}>
                                        <div className="flex items-center gap-1">
                                            개설일 <SortIcon columnKey="createdDate" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 font-semibold">국가</th>
                                    <th className="px-6 py-4 font-semibold text-center cursor-pointer group" onClick={() => handleSort('collectedAt')}>
                                        <div className="flex items-center justify-center gap-1">
                                            수집일 <SortIcon columnKey="collectedAt" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 font-semibold w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                                {channels.length === 0 && !isLoading ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                                            수집된 채널이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    channels.map((channel) => (
                                        <tr key={channel.id} className="hover:bg-gray-50/50 transition-colors group dark:hover:bg-zinc-800/30">
                                            <td className="px-6 py-4">
                                                <a
                                                    href={channel.channelUrl || '#'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block h-10 w-10 overflow-hidden rounded-full ring-2 ring-gray-100 transition-transform hover:scale-110 active:scale-95 dark:ring-zinc-800"
                                                >
                                                    <img src={channel.thumbnail} alt="" className="h-full w-full object-cover" />
                                                </a>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                                <a
                                                    href={channel.channelUrl || '#'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="transition-colors hover:text-indigo-600"
                                                >
                                                    {channel.name}
                                                </a>
                                                {(() => {
                                                    const result = calculateGoodChannelScore({
                                                        publishedAt: channel.createdDate.replace(/\./g, '-'),
                                                        viewCount: channel.totalViews,
                                                        videoCount: channel.videoCount
                                                    });

                                                    if (result.signals.length > 0) {
                                                        return (
                                                            <div className="text-xs text-orange-600 font-bold mt-1 flex items-center gap-1">
                                                                <span>🔥</span>
                                                                <span>{result.signals.join(' · ')}</span>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div className="text-xs text-gray-400 mt-1">
                                                            점수 {result.score}점
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className={`px-6 py-4 text-right font-bold ${channel.dailyViews > 0 ? 'text-green-600' :
                                                channel.dailyViews < 0 ? 'text-red-500' : 'text-gray-400'
                                                }`}>
                                                {channel.dailyViews > 0 ? '+' : ''}{formatNumber(channel.dailyViews)}
                                            </td>
                                            <td className="px-6 py-4 text-right text-indigo-600 font-bold dark:text-indigo-400">
                                                {formatNumber(channel.subscribers)}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                                                {formatNumber(channel.totalViews)}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                                                {channel.videoCount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 text-xs text-right whitespace-nowrap">
                                                {channel.createdDate}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${channel.isDomestic ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                                                    {channel.country}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-gray-900 font-medium whitespace-nowrap dark:text-white">{channel.collectedAt}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    href={`/channel/${channel.id}`}
                                                    className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-block"
                                                >
                                                    <ArrowUpRight className="h-5 w-5" />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 border-t border-gray-50 dark:border-zinc-800 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            총 <span className="font-bold text-gray-900 dark:text-white">{totalCount}</span>개 채널
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                disabled={page === 1 || isRefreshing}
                                className="px-3 py-1.5 text-xs font-bold border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
                            >
                                이전
                            </button>
                            <div className="flex items-center gap-1">
                                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                    const pageNum = i + 1; // Simplified for now
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setPage(pageNum)}
                                            className={`h-8 w-8 text-xs font-bold rounded-lg transition-all ${page === pageNum ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800'}`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={page === totalPages || isRefreshing}
                                className="px-3 py-1.5 text-xs font-bold border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
                            >
                                다음
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
