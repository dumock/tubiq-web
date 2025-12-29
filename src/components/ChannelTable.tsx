'use client';

import { MoreHorizontal, ArrowUpRight, ArrowDownRight, Users, Eye, Video, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { calculateGoodChannelScore } from '@/lib/goodChannelScore';

// Types for Mock Data
export interface Channel {
    id: string;
    rank: number;
    name: string;
    handle: string;
    category: string;
    subscribers: string;
    subscriberGrowth: number; // positive or negative percentage
    views: string;
    videos: number;
    status: 'Active' | 'Growing' | 'Stable';
    avatar: string; // Placeholder color or image URL
    topic?: string;
    publishedAt?: string;
    viewCount?: number;
    videoCount?: number;
}

// Mock Data
const channels: Channel[] = [
    {
        id: '1',
        rank: 1,
        name: 'TubiQ Official',
        handle: '@tubiq_official',
        category: 'Technology',
        subscribers: '1.2M',
        subscriberGrowth: 12.5,
        views: '85.4M',
        videos: 142,
        status: 'Growing',
        avatar: 'bg-indigo-500',
        topic: 'IT/테크',
        publishedAt: '2023-01-15',
        viewCount: 85400000,
        videoCount: 142
    },
    {
        id: '2',
        rank: 2,
        name: 'Daily Vloggers',
        handle: '@daily_vlog',
        category: 'Lifestyle',
        subscribers: '850K',
        subscriberGrowth: 5.2,
        views: '42.1M',
        videos: 89,
        status: 'Stable',
        avatar: 'bg-rose-500',
        topic: '일상/브이로그',
        publishedAt: '2023-05-20',
        viewCount: 42100000,
        videoCount: 89
    },
    {
        id: '3',
        rank: 3,
        name: 'Code with Me',
        handle: '@codewithme',
        category: 'Education',
        subscribers: '620K',
        subscriberGrowth: -2.1,
        views: '15.8M',
        videos: 230,
        status: 'Active',
        avatar: 'bg-blue-500',
        topic: '교육/지식',
        publishedAt: '2022-11-10',
        viewCount: 15800000,
        videoCount: 230
    },
    {
        id: '4',
        rank: 4,
        name: 'Rising Tech Star',
        handle: '@rising_tech',
        category: 'Technology',
        subscribers: '150K',
        subscriberGrowth: 25.4,
        views: '5.2M',
        videos: 8,
        status: 'Growing',
        avatar: 'bg-emerald-500',
        topic: 'IT/테크',
        publishedAt: '2024-10-01',
        viewCount: 5200000,
        videoCount: 8
    },
    {
        id: '5',
        rank: 5,
        name: 'Daily Insights',
        handle: '@daily_insights',
        category: 'Education',
        subscribers: '80K',
        subscriberGrowth: 15.8,
        views: '2.4M',
        videos: 15,
        status: 'Stable',
        avatar: 'bg-amber-500',
        topic: '교육/지식',
        publishedAt: '2024-08-15',
        viewCount: 2400000,
        videoCount: 15
    },
];

interface ChannelTableProps {
    hideHeader?: boolean;
    channelsData?: Channel[];
    selectedIds?: string[];
    onToggle?: (id: string, multiSelect: boolean, shiftSelect: boolean) => void;
    onToggleAll?: (allIds: string[]) => void;
    sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
    onSort?: (key: string) => void;
}

export default function ChannelTable({
    hideHeader = false,
    channelsData,
    selectedIds = [],
    onToggle,
    onToggleAll,
    sortConfig,
    onSort
}: ChannelTableProps) {
    const displayChannels = channelsData || channels;
    const allSelected = displayChannels.length > 0 && selectedIds.length === displayChannels.length;

    const handleHeaderCheckboxChange = () => {
        onToggleAll?.(displayChannels.map(c => c.id));
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <ChevronsUpDown className="h-3 w-3 text-gray-400 group-hover:text-gray-600 transition-colors" />;
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="h-3 w-3 text-indigo-600 transition-colors" />
            : <ChevronDown className="h-3 w-3 text-indigo-600 transition-colors" />;
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            {/* Table Header */}
            {!hideHeader && (
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-900 px-6 py-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        오늘 주목할 채널
                    </h3>
                    <button className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                        View All Channels
                    </button>
                </div>
            )}

            {/* Table Content */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/50 dark:bg-zinc-900/50">
                        <tr>
                            <th className="w-[40px] px-6 py-3">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={handleHeaderCheckboxChange}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-900"
                                />
                            </th>
                            <th
                                onClick={() => onSort?.('rank')}
                                className="pl-6 pr-2 py-3 font-medium text-gray-500 dark:text-gray-400 text-center cursor-pointer hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 transition-colors group select-none"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    순위
                                    <SortIcon columnKey="rank" />
                                </div>
                            </th>
                            <th
                                className="pl-2 pr-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-center select-none"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    채널
                                </div>
                            </th>
                            <th
                                onClick={() => onSort?.('category')}
                                className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-center cursor-pointer hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 transition-colors group select-none"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    카테고리
                                    <SortIcon columnKey="category" />
                                </div>
                            </th>
                            <th
                                onClick={() => onSort?.('subscribers')}
                                className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-center cursor-pointer hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 transition-colors group select-none"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    <Users className="h-3.5 w-3.5" />
                                    구독자수
                                    <SortIcon columnKey="subscribers" />
                                </div>
                            </th>
                            <th
                                onClick={() => onSort?.('views')}
                                className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-center cursor-pointer hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 transition-colors group select-none"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    <Eye className="h-3.5 w-3.5" />
                                    조회수
                                    <SortIcon columnKey="views" />
                                </div>
                            </th>
                            <th
                                onClick={() => onSort?.('videos')}
                                className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell text-center cursor-pointer hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 transition-colors group select-none"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    <Video className="h-3.5 w-3.5" />
                                    영상수
                                    <SortIcon columnKey="videos" />
                                </div>
                            </th>
                            <th
                                onClick={() => onSort?.('status')}
                                className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-center cursor-pointer hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 transition-colors group select-none"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    상태
                                    <SortIcon columnKey="status" />
                                </div>
                            </th>
                            <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
                        {displayChannels.map((channel) => {
                            const isSelected = selectedIds.includes(channel.id);
                            return (
                                <tr
                                    key={channel.id}
                                    onClick={(e) => {
                                        const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                                        onToggle?.(channel.id, isMac ? e.metaKey : e.ctrlKey, e.shiftKey);
                                    }}
                                    className={`group hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : 'dark:hover:bg-zinc-900/50'}`}
                                >
                                    <td className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                onToggle?.(channel.id, true, false);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-900"
                                        />
                                    </td>
                                    <td className="pl-6 pr-2 py-4 text-gray-500 dark:text-gray-500 text-center">
                                        {channel.rank}
                                    </td>
                                    <td className="pl-2 pr-6 py-4">
                                        <Link href={`/channel/${channel.id}`} className="flex items-center gap-3 group/link">
                                            <div className={`h-10 w-10 flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center text-white font-bold group-hover/link:ring-2 group-hover/link:ring-indigo-500 transition-all ${channel.avatar.startsWith('bg-') ? channel.avatar : 'bg-gray-100 dark:bg-zinc-800'}`}>
                                                {channel.avatar.startsWith('http') || channel.avatar.startsWith('/') ? (
                                                    <Image
                                                        src={channel.avatar}
                                                        alt={channel.name}
                                                        width={40}
                                                        height={40}
                                                        className="h-full w-full object-cover"
                                                        unoptimized // Avoid domain issues for external YouTube images
                                                    />
                                                ) : (
                                                    channel.name[0]
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white group-hover/link:text-indigo-600 transition-colors">
                                                    {channel.name}
                                                </div>
                                                {channel.topic && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {channel.topic}
                                                    </div>
                                                )}
                                                {channel.publishedAt && channel.viewCount && channel.videoCount && (() => {
                                                    const result = calculateGoodChannelScore({
                                                        publishedAt: channel.publishedAt,
                                                        viewCount: channel.viewCount,
                                                        videoCount: channel.videoCount
                                                    });
                                                    if (result.signals.length > 0) {
                                                        return (
                                                            <div className="text-[10px] text-orange-600 font-bold mt-0.5 flex items-center gap-1 dark:text-orange-400">
                                                                <span>🔥</span>
                                                                <span>{result.signals.join(' · ')}</span>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                                    {channel.handle}
                                                </div>
                                            </div>
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-zinc-800 dark:text-gray-200">
                                            {channel.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-center">
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {channel.subscribers}
                                            </span>
                                            <span className={`flex items-center text-xs ${channel.subscriberGrowth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {channel.subscriberGrowth >= 0 ? (
                                                    <ArrowUpRight className="mr-1 h-3 w-3" />
                                                ) : (
                                                    <ArrowDownRight className="mr-1 h-3 w-3" />
                                                )}
                                                {Math.abs(channel.subscriberGrowth)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-center">
                                        {channel.views}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300 hidden md:table-cell text-center">
                                        {channel.videos}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border
                    ${channel.status === 'Growing'
                                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50'
                                                : channel.status === 'Stable'
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/50'
                                                    : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                                            }`}
                                        >
                                            <span className={`h-1.5 w-1.5 rounded-full ${channel.status === 'Growing' ? 'bg-green-500' :
                                                channel.status === 'Stable' ? 'bg-blue-500' : 'bg-gray-500'
                                                }`} />
                                            {channel.status === 'Growing' ? '성장 중' :
                                                channel.status === 'Stable' ? '안정적' : '활동 중'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-zinc-800 dark:hover:text-gray-300 transition-colors">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination (Simple Mock) */}
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-zinc-900 px-6 py-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    전체 <span className="font-medium text-gray-900 dark:text-white">120</span>개 중 <span className="font-medium">1</span> - <span className="font-medium">5</span> 표시
                </span>
                <div className="flex gap-2">
                    <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50 dark:border-zinc-800 dark:text-gray-300">
                        이전
                    </button>
                    <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-900">
                        다음
                    </button>
                </div>
            </div>
        </div>
    );
}
