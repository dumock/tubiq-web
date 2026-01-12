'use client';

import { useState, useEffect } from 'react';
import { Info, ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SimilarChannel {
    id: string;
    name: string;
    thumbnail: string;
    subscribers: number;
    avgViews: number;
}

interface SimilarChannelsProps {
    channelId?: string;
}

export default function SimilarChannels({ channelId }: SimilarChannelsProps) {
    const [channels, setChannels] = useState<SimilarChannel[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!channelId) {
            setChannels([]);
            return;
        }

        const fetchSimilarChannels = async () => {
            setIsLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) return;

                const res = await fetch(`/api/similar-channels?channelId=${channelId}`, {
                    headers: { Authorization: `Bearer ${session.access_token}` }
                });
                const json = await res.json();
                if (json.ok && Array.isArray(json.data)) {
                    setChannels(json.data);
                }
            } catch (error) {
                console.error('Failed to fetch similar channels:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSimilarChannels();
    }, [channelId]);

    const formatSubscribers = (count: number) => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1)}만`;
        return count.toString();
    };

    return (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-gray-50 dark:border-zinc-800 flex items-center gap-2">
                <h3 className="font-bold text-gray-900 dark:text-white">유사 채널</h3>
                <Info className="h-4 w-4 text-gray-400 cursor-help" />
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
            ) : channels.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                    {channelId ? '유사한 채널을 찾을 수 없습니다' : '채널을 선택해주세요'}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50/30 text-gray-500 border-b border-gray-50 dark:bg-zinc-800/30 dark:border-zinc-800">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-900" />
                                </th>
                                <th className="px-4 py-3 font-medium">채널명</th>
                                <th className="px-4 py-3 font-medium text-right">
                                    <button className="inline-flex items-center gap-1 hover:text-gray-900 transition-colors">
                                        구독자 수 <ChevronDown className="h-4 w-4" />
                                    </button>
                                </th>
                                <th className="px-4 py-3 font-medium text-right">
                                    <button className="inline-flex items-center gap-1 hover:text-gray-900 transition-colors">
                                        평균 조회수 <ChevronDown className="h-4 w-4" />
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                            {channels.map((channel) => (
                                <tr key={channel.id} className="hover:bg-gray-50/50 transition-colors dark:hover:bg-zinc-800/20">
                                    <td className="px-4 py-4">
                                        <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-900" />
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-gray-100 overflow-hidden ring-2 ring-gray-100 dark:ring-zinc-800">
                                                {channel.thumbnail ? (
                                                    <img src={channel.thumbnail} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold">
                                                        {channel.name?.[0]}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="font-bold text-gray-900 dark:text-white">{channel.name}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right font-medium text-gray-700 dark:text-gray-300">
                                        {formatSubscribers(channel.subscribers)}
                                    </td>
                                    <td className="px-4 py-4 text-right font-medium text-gray-700 dark:text-gray-300">
                                        {channel.avgViews.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
