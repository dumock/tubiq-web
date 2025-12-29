'use client';

import { MoreHorizontal, Eye, ArrowUpRight, ArrowDownRight, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { mockVideos } from '../mock/videos';
import Link from 'next/link';

import { Video as VideoType } from '../mock/videos';

interface SearchTableProps {
    videos?: VideoType[];
    selectedIds?: string[];
    onToggle?: (id: string, multiSelect: boolean, shiftSelect: boolean) => void;
    onToggleAll?: (allIds: string[]) => void;
    sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
    onSort?: (key: string) => void;
}

export default function SearchTable({
    videos,
    selectedIds = [],
    onToggle,
    onToggleAll,
    sortConfig,
    onSort
}: SearchTableProps) {
    const displayVideos = videos || mockVideos;
    const allSelected = displayVideos.length > 0 && selectedIds.length === displayVideos.length;

    const handleHeaderCheckboxChange = () => {
        onToggleAll?.(displayVideos.map(v => v.id));
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <ChevronsUpDown className="h-3 w-3 text-gray-400 group-hover:text-gray-600 transition-colors" />;
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="h-3 w-3 text-indigo-600 transition-colors" />
            : <ChevronDown className="h-3 w-3 text-indigo-600 transition-colors" />;
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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
                                    영상
                                </div>
                            </th>
                            <th
                                onClick={() => onSort?.('views')}
                                className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-center cursor-pointer hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 transition-colors group select-none"
                            >
                                <div className="flex items-center justify-center gap-1 text-center">
                                    <Eye className="h-3.5 w-3.5" />
                                    조회수
                                    <SortIcon columnKey="views" />
                                </div>
                            </th>
                            <th
                                onClick={() => onSort?.('contribution')}
                                className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-center cursor-pointer hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 transition-colors group select-none"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    기여도
                                    <SortIcon columnKey="contribution" />
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
                            <th
                                onClick={() => onSort?.('publishedAt')}
                                className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-center cursor-pointer hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 transition-colors group select-none"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    게시일
                                    <SortIcon columnKey="publishedAt" />
                                </div>
                            </th>
                            <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
                        {displayVideos.map((video, index) => {
                            const isSelected = selectedIds.includes(video.id);
                            return (
                                <tr
                                    key={video.id}
                                    onClick={(e) => {
                                        const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                                        onToggle?.(video.id, isMac ? e.metaKey : e.ctrlKey, e.shiftKey);
                                    }}
                                    className={`group hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : 'dark:hover:bg-zinc-900/50'}`}
                                >
                                    <td className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                onToggle?.(video.id, true, false);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-900"
                                        />
                                    </td>
                                    <td className="pl-6 pr-2 py-4 text-gray-500 dark:text-gray-500 text-center">
                                        {index + 1}
                                    </td>
                                    <td className="pl-2 pr-6 py-4">
                                        <Link href={`/video/${video.id}`} className="flex items-center gap-3 group/link">
                                            <img
                                                src={video.thumbnailUrl}
                                                alt={video.title}
                                                className="h-16 w-28 flex-shrink-0 rounded-lg object-cover bg-gray-100 dark:bg-zinc-800 group-hover/link:ring-2 group-hover/link:ring-indigo-500 transition-all"
                                            />
                                            <div className="max-w-[240px]">
                                                <div className="font-medium text-gray-900 dark:text-white line-clamp-2 group-hover/link:text-indigo-600 transition-colors">
                                                    {video.title}
                                                </div>
                                            </div>
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-center">
                                        {video.views.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center gap-1 text-xs font-medium
                    ${video.contribution >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {video.contribution >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                            {Math.abs(video.contribution)}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border
                    ${video.status === 'Published'
                                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50'
                                                : video.status === 'Processing'
                                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-900/50'
                                                    : video.status === 'Scheduled'
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/50'
                                                        : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                                            }`}
                                        >
                                            {video.status === 'Published' ? '게시 완료' :
                                                video.status === 'Processing' ? '분석 중' :
                                                    video.status === 'Scheduled' ? '예약됨' : '실패'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                                        {video.publishedAt}
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
        </div>
    );
}
