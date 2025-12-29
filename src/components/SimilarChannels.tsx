'use client';

import { Info, ChevronDown, MoreHorizontal } from 'lucide-react';

interface SimilarChannel {
    id: string;
    name: string;
    thumbnail: string;
    tags: string[];
    subscribers: string;
    avgViews: number;
}

const MOCK_SIMILAR_CHANNELS: SimilarChannel[] = [
    {
        id: 's1',
        name: '작은기적',
        thumbnail: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop',
        tags: ['뉴스', '펫 / 동물'],
        subscribers: '2.8만',
        avgViews: 232
    },
    {
        id: 's2',
        name: '파인딩스타',
        thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
        tags: ['펫 / 동물', '사회 / 문화'],
        subscribers: '23.6만',
        avgViews: 112011
    },
    {
        id: 's3',
        name: '감동미소',
        thumbnail: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop',
        tags: ['헬스', '육아 / 패밀리'],
        subscribers: '1.8만',
        avgViews: 258
    },
    {
        id: 's4',
        name: '시니어사연책방',
        thumbnail: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop',
        tags: ['육아 / 패밀리', '사회 / 문화'],
        subscribers: '2만',
        avgViews: 911
    }
];

export default function SimilarChannels() {
    return (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-gray-50 dark:border-zinc-800 flex items-center gap-2">
                <h3 className="font-bold text-gray-900 dark:text-white">유사 채널</h3>
                <Info className="h-4 w-4 text-gray-400 cursor-help" />
            </div>

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
                        {MOCK_SIMILAR_CHANNELS.map((channel) => (
                            <tr key={channel.id} className="hover:bg-gray-50/50 transition-colors dark:hover:bg-zinc-800/20">
                                <td className="px-4 py-4">
                                    <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-900" />
                                </td>
                                <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-gray-100 overflow-hidden ring-2 ring-gray-100 dark:ring-zinc-800">
                                            <img src={channel.thumbnail} alt="" className="h-full w-full object-cover" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold text-gray-900 dark:text-white">{channel.name}</span>
                                            <div className="flex flex-wrap gap-1">
                                                {channel.tags.map(tag => (
                                                    <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-[10px] text-gray-500 rounded dark:bg-zinc-800 dark:text-gray-400">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-right font-medium text-gray-700 dark:text-gray-300">
                                    {channel.subscribers}
                                </td>
                                <td className="px-4 py-4 text-right font-medium text-gray-700 dark:text-gray-300">
                                    {channel.avgViews.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
