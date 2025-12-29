'use client';

import { useState, useEffect } from 'react';
import Header from '@/src/components/Header';
import ClientOnly from '@/src/components/ClientOnly';
import {
    Search,
    Globe,
    Zap,
    ListFilter,
    MoreVertical,
    ExternalLink,
    TrendingUp,
    Database,
    Languages,
    Play,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown
} from 'lucide-react';

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
}

const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
};

const INITIAL_MOCK_DATA: CollectedChannel[] = [
    {
        id: '1',
        thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100&h=100&fit=crop',
        name: 'Tech Insider',
        subscribers: 2500000,
        totalViews: 450000000,
        videoCount: 1200,
        createdDate: '2015.03.12',
        country: 'US',
        collectedAt: '2025.12.21',
        isDomestic: false
    },
    {
        id: '2',
        thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100&h=100&fit=crop',
        name: '미스터 비스트 한국팬',
        subscribers: 850000,
        totalViews: 120000000,
        videoCount: 450,
        createdDate: '2020.08.21',
        country: 'KR',
        collectedAt: '2025.12.21',
        isDomestic: true
    },
    {
        id: '3',
        thumbnail: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
        name: 'Vlog with Me',
        subscribers: 12000,
        totalViews: 850000,
        videoCount: 120,
        createdDate: '2022.01.05',
        country: 'UK',
        collectedAt: '2025.12.20',
        isDomestic: false
    }
];

export default function ChannelCollectPage() {
    const [channels, setChannels] = useState<CollectedChannel[]>(INITIAL_MOCK_DATA);
    const [filter, setFilter] = useState<'all' | 'domestic' | 'overseas'>('all');
    const [isCrawling, setIsCrawling] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof CollectedChannel; direction: 'asc' | 'desc' } | null>(null);

    // Simulate automatic crawling entry
    useEffect(() => {
        const interval = setInterval(() => {
            if (Math.random() > 0.8) { // 20% chance to "discover" a new channel
                simulateNewChannel();
            }
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const simulateNewChannel = () => {
        const isDom = Math.random() > 0.5;
        const newChannel: CollectedChannel = {
            id: Math.random().toString(36).substr(2, 9),
            thumbnail: `https://i.pravatar.cc/100?u=${Math.random()}`,
            name: isDom ? `탐구생활 ${Math.floor(Math.random() * 100)}` : `Global Explorer ${Math.floor(Math.random() * 100)}`,
            subscribers: Math.floor(Math.random() * 1000000) + 1000,
            totalViews: Math.floor(Math.random() * 10000000) + 50000,
            videoCount: Math.floor(Math.random() * 500) + 10,
            createdDate: '2023.10.12',
            country: isDom ? 'KR' : ['US', 'JP', 'UK', 'DE'][Math.floor(Math.random() * 4)],
            collectedAt: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
            isDomestic: isDom
        };
        setChannels(prev => [newChannel, ...prev]);
        setIsCrawling(true);
        setTimeout(() => setIsCrawling(false), 2000);
    };

    const filteredData = channels.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
        if (filter === 'domestic') return matchesSearch && c.isDomestic;
        if (filter === 'overseas') return matchesSearch && !c.isDomestic;
        return matchesSearch;
    });

    const sortedData = [...filteredData].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
        if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key: keyof CollectedChannel) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ columnKey }: { columnKey: keyof CollectedChannel }) => {
        if (sortConfig?.key !== columnKey) return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400 opacity-50 group-hover:opacity-100 transition-opacity" />;
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 stroke-[3px]" />
            : <ChevronDown className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 stroke-[3px]" />;
    };

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
                        <p className="text-sm text-gray-500">전 전계 유튜브 채널을 실시간으로 추적하고 수집합니다.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl dark:bg-indigo-900/30 dark:border-indigo-500/30">
                            <div className={`h-2 w-2 rounded-full ${isCrawling ? 'bg-indigo-500 animate-pulse' : 'bg-gray-300'}`} />
                            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                                {isCrawling ? '채널 수집 중...' : '대기 중'}
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
                        <div className="text-2xl font-bold dark:text-white">{channels.length.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">누적 수집 채널</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="p-2 w-fit bg-green-50 text-green-600 rounded-lg mb-3 dark:bg-green-900/20">
                            <Languages className="h-5 w-5" />
                        </div>
                        <div className="text-2xl font-bold dark:text-white">{channels.filter(c => c.isDomestic).length.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">국내 채널</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="p-2 w-fit bg-purple-50 text-purple-600 rounded-lg mb-3 dark:bg-purple-900/20">
                            <Globe className="h-5 w-5" />
                        </div>
                        <div className="text-2xl font-bold dark:text-white">{channels.filter(c => !c.isDomestic).length.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">해외 채널</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="p-2 w-fit bg-amber-50 text-amber-600 rounded-lg mb-3 dark:bg-amber-900/20">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div className="text-2xl font-bold dark:text-white">+{(Math.random() * 10).toFixed(1)}%</div>
                        <div className="text-xs text-gray-500">오늘 수집 증가율</div>
                    </div>
                </div>

                {/* Filter & Table Section */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                    {/* Control Bar */}
                    <div className="p-4 border-b border-gray-50 dark:border-zinc-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl dark:bg-zinc-800">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filter === 'all' ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                전체
                            </button>
                            <button
                                onClick={() => setFilter('domestic')}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filter === 'domestic' ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                국내 채널
                            </button>
                            <button
                                onClick={() => setFilter('overseas')}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filter === 'overseas' ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                해외 채널
                            </button>
                        </div>

                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="채널명으로 검색"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-zinc-800 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-50 dark:bg-zinc-800/50 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">썸네일</th>
                                    <th className="px-6 py-4 font-semibold cursor-pointer group" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-1">
                                            채널명 <SortIcon columnKey="name" />
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
                                    <th className="px-6 py-4 font-semibold"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                                {sortedData.map((channel) => (
                                    <tr key={channel.id} className="hover:bg-gray-50/50 transition-colors group dark:hover:bg-zinc-800/30">
                                        <td className="px-6 py-4">
                                            <div className="h-10 w-10 overflow-hidden rounded-full ring-2 ring-gray-100 dark:ring-zinc-800">
                                                <img src={channel.thumbnail} alt="" className="h-full w-full object-cover" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {channel.name}
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
                                        <td className="px-6 py-4 text-gray-500 text-xs">
                                            {channel.createdDate}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${channel.isDomestic ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                                                {channel.country}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-gray-900 font-medium dark:text-white">{channel.collectedAt}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white">
                                                <ExternalLink className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
