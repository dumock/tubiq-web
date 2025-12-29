'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ExternalLink, AlertTriangle } from 'lucide-react';
import { getRisingSignals, RisingSignal, getTopCauseVideo } from '@/lib/risingSignals';
import { MOCK_VIDEOS } from '@/mock/videos';
import { MOCK_VIDEO_DAILY } from '@/mock/videoDaily';

interface ChannelRow {
    id: string;
    rank: number;
    thumbnail: string;
    name: string;
    dailyViews: number;
    subscribers: number;
    totalViews: number;
    videoCount: number;
    createdDate: string;
    country: string;
    channelUrl: string;
    topic: string;
}

interface RisingChannelTableProps {
    data: ChannelRow[];
}

export default function RisingChannelTable({ data }: RisingChannelTableProps) {
    const [openPopoverKey, setOpenPopoverKey] = useState<string | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Initial expanded scan simulation for high growth channels
    const expandedScanChannelIds = useMemo(() =>
        data.filter(c => c.dailyViews >= 50000).map(c => c.id),
        [data]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setOpenPopoverKey(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-50 dark:bg-zinc-800/50 dark:border-zinc-800">
                    <tr>
                        <th className="px-6 py-4 font-semibold text-center w-16">순위</th>
                        <th className="px-6 py-4 font-semibold">채널</th>
                        <th className="px-6 py-4 font-semibold text-right">오늘 일조회수</th>
                        <th className="px-6 py-4 font-semibold text-right">구독자수</th>
                        <th className="px-6 py-4 font-semibold text-right">총조회수</th>
                        <th className="px-6 py-4 font-semibold text-right">영상수</th>
                        <th className="px-6 py-4 font-semibold">개설일</th>
                        <th className="px-6 py-4 font-semibold text-right"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                    {data.map((channel) => {
                        const isExpanded = expandedScanChannelIds.includes(channel.id);

                        return (
                            <tr key={channel.id} className="hover:bg-gray-50/50 transition-colors group dark:hover:bg-zinc-800/30">
                                <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold ${channel.rank === 1 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40' :
                                        channel.rank === 2 ? 'bg-gray-100 text-gray-600 dark:bg-gray-700' :
                                            channel.rank === 3 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/20' :
                                                'text-gray-400'
                                        }`}>
                                        {channel.rank}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-gray-100 dark:ring-zinc-800">
                                            <img src={channel.thumbnail} alt="" className="h-full w-full object-cover" />
                                        </div>
                                        <div className="relative">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <a
                                                    href={channel.channelUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-bold text-gray-900 hover:text-indigo-600 transition-colors dark:text-white dark:hover:text-indigo-400"
                                                >
                                                    {channel.name}
                                                </a>
                                                <ExternalLink className="w-3 h-3 text-gray-300" />

                                                {/* Expanded Scan Badge */}
                                                {isExpanded && (
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setOpenPopoverKey(openPopoverKey === `scan:${channel.id}` ? null : `scan:${channel.id}`);
                                                            }}
                                                            className="text-[10px] px-1.5 py-0.5 border border-gray-200 text-gray-500 rounded font-medium hover:bg-gray-50 dark:border-zinc-700 dark:text-gray-400 dark:hover:bg-zinc-800"
                                                        >
                                                            확장 스캔됨
                                                        </button>
                                                        {openPopoverKey === `scan:${channel.id}` && (
                                                            <div
                                                                ref={popoverRef}
                                                                className="absolute left-0 mt-2 z-50 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 dark:bg-zinc-900 dark:border-zinc-800"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2">분석 범위 확장 알림</h4>
                                                                <p className="text-xs text-gray-500 leading-relaxed">
                                                                    일조회수 5만 이상의 급등 채널로 감지되어, 분석 범위를 <span className="text-indigo-600 font-bold">최근 30개 → 200개</span>로 확대했습니다. 과거 영상의 역주행 여부도 함께 분석 중입니다.
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded dark:bg-indigo-900/20">
                                                    {channel.topic}
                                                </span>
                                                <span className="text-[10px] text-gray-400 uppercase">{channel.country}</span>
                                            </div>
                                            {/* Rising Signals */}
                                            {(() => {
                                                const videosForChannel = MOCK_VIDEOS.filter(v => v.channelId === channel.id);
                                                const signals = getRisingSignals({
                                                    channelId: channel.id,
                                                    channelDailyViews: channel.dailyViews,
                                                    videosForChannel,
                                                    videoDailyForVideos: MOCK_VIDEO_DAILY,
                                                    videoCount: channel.videoCount,
                                                    createdAt: channel.createdDate.replace(/\./g, '-')
                                                });

                                                if (signals.length === 0) return null;

                                                const toneStyles = {
                                                    green: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100",
                                                    blue: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-100",
                                                    orange: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 hover:bg-orange-100",
                                                    red: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100"
                                                };

                                                return (
                                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                                        {signals.map(signal => {
                                                            const popoverKey = `${channel.id}:${signal.key}`;
                                                            const isPopoverOpen = openPopoverKey === popoverKey;

                                                            return (
                                                                <div key={signal.key} className="relative">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenPopoverKey(isPopoverOpen ? null : popoverKey);
                                                                        }}
                                                                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${toneStyles[signal.tone]}`}
                                                                    >
                                                                        {signal.label}
                                                                    </button>

                                                                    {isPopoverOpen && (
                                                                        <div
                                                                            ref={popoverRef}
                                                                            className="absolute left-0 mt-2 z-50 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 animate-in fade-in zoom-in-95 duration-200 dark:bg-zinc-900 dark:border-zinc-800"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-tight mb-3">급등 원인 영상</h4>
                                                                            {(() => {
                                                                                const cause = getTopCauseVideo({
                                                                                    videosForChannel,
                                                                                    videoDailyForVideos: MOCK_VIDEO_DAILY,
                                                                                    channelDailyViews: channel.dailyViews,
                                                                                    poolSize: isExpanded ? 200 : 30
                                                                                });

                                                                                if (!cause) {
                                                                                    return <p className="text-xs text-gray-500">데이터를 분석할 수 없습니다.</p>;
                                                                                }

                                                                                return (
                                                                                    <div className="space-y-3">
                                                                                        <div className="flex gap-3">
                                                                                            <img
                                                                                                src={cause.video.thumbnail}
                                                                                                className="w-16 h-9 object-cover rounded-lg flex-shrink-0"
                                                                                                alt=""
                                                                                            />
                                                                                            <div className="min-w-0">
                                                                                                <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug">
                                                                                                    {cause.video.title}
                                                                                                </p>
                                                                                                {(cause.video.status === 'deleted' || cause.video.status === 'blocked_suspected') && (
                                                                                                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-red-500">
                                                                                                        <AlertTriangle className="w-3 h-3" />
                                                                                                        상태 이상 감지
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-zinc-800">
                                                                                            <div className="text-xs">
                                                                                                <span className="text-gray-500">오늘 조회수</span>
                                                                                                <p className="font-bold text-green-600">+{formatNumber(cause.todayViews)}</p>
                                                                                            </div>
                                                                                            <div className="text-xs text-right">
                                                                                                <span className="text-gray-500">채널 기여도</span>
                                                                                                <p className="font-bold text-indigo-600">{cause.share}%</p>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </td>

                                <td className="px-6 py-4 text-right">
                                    <span className="text-base font-bold text-green-600">
                                        +{formatNumber(channel.dailyViews)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                                    {formatNumber(channel.subscribers)}
                                </td>
                                <td className="px-6 py-4 text-right text-gray-500">
                                    {formatNumber(channel.totalViews)}
                                </td>
                                <td className="px-6 py-4 text-right text-gray-500">
                                    {channel.videoCount.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-gray-400 text-xs">
                                    {channel.createdDate}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Link
                                        href={`/channel/${channel.id}`}
                                        className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20"
                                    >
                                        <ArrowUpRight className="h-5 w-5" />
                                    </Link>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {data.length === 0 && (
                <div className="py-20 text-center text-gray-400">
                    조건에 맞는 채널이 없습니다.
                </div>
            )}
        </div>
    );
}
