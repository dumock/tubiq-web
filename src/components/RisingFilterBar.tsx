'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Filter, ListFilter } from 'lucide-react';

interface RisingFilterBarProps {
    countryFilter: 'all' | 'KR' | 'overseas';
    setCountryFilter: (val: 'all' | 'KR' | 'overseas') => void;
    topicFilter: string;
    setTopicFilter: (val: string) => void;
    sortKey: 'dailyViews' | 'subscribers';
    setSortKey: (val: 'dailyViews' | 'subscribers') => void;
}

const TOPIC_OPTIONS = [
    '게임', '음악/댄스', '엔터/유머', '일상/브이로그', '영화/애니',
    'IT/테크', '경제/재테크', '푸드/요리', '뷰티/패션', '스포츠/운동',
    '동물/펫', '뉴스/이슈', '교육/지식', '자동차/탈것'
];

export default function RisingFilterBar({
    countryFilter,
    setCountryFilter,
    topicFilter,
    setTopicFilter,
    sortKey,
    setSortKey
}: RisingFilterBarProps) {
    const [isTopicOpen, setIsTopicOpen] = useState(false);
    const topicRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (topicRef.current && !topicRef.current.contains(event.target as Node)) {
                setIsTopicOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border-b border-gray-50 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-4">
                {/* Country Filter */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl dark:bg-zinc-800">
                    <button
                        onClick={() => setCountryFilter('all')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${countryFilter === 'all' ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        전체
                    </button>
                    <button
                        onClick={() => setCountryFilter('KR')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${countryFilter === 'KR' ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        국내
                    </button>
                    <button
                        onClick={() => setCountryFilter('overseas')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${countryFilter === 'overseas' ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        해외
                    </button>
                </div>

                {/* Topic Dropdown */}
                <div className="relative" ref={topicRef}>
                    <button
                        onClick={() => setIsTopicOpen(!isTopicOpen)}
                        className={`flex h-10 w-[140px] items-center justify-between gap-2 rounded-xl border px-3 text-sm font-medium transition-all ${isTopicOpen ? 'border-indigo-500 bg-white ring-4 ring-indigo-500/10 dark:bg-zinc-800' : 'border-gray-200 bg-white hover:border-indigo-400 dark:bg-zinc-800 dark:border-zinc-700'}`}
                    >
                        <span className="truncate">{topicFilter === 'all' ? '주제 전체' : topicFilter}</span>
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isTopicOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                    </button>

                    {isTopicOpen && (
                        <div className="absolute left-0 mt-2 z-[100] w-[180px] overflow-hidden rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                            <div className="max-h-60 overflow-y-auto">
                                <button
                                    onClick={() => { setTopicFilter('all'); setIsTopicOpen(false); }}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-lg ${topicFilter === 'all' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-800/60'}`}
                                >
                                    주제 전체
                                </button>
                                {TOPIC_OPTIONS.map(topic => (
                                    <button
                                        key={topic}
                                        onClick={() => { setTopicFilter(topic); setIsTopicOpen(false); }}
                                        className={`w-full text-left px-3 py-2 text-sm rounded-lg ${topicFilter === topic ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-800/60'}`}
                                    >
                                        {topic}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sort Toggle */}
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500 bg-gray-50 p-1 rounded-xl dark:bg-zinc-800/50">
                <button
                    onClick={() => setSortKey('dailyViews')}
                    className={`px-4 py-1.5 rounded-lg transition-all ${sortKey === 'dailyViews' ? 'bg-indigo-600 text-white shadow-md' : 'hover:text-gray-700'}`}
                >
                    일조회수순
                </button>
                <button
                    onClick={() => setSortKey('subscribers')}
                    className={`px-4 py-1.5 rounded-lg transition-all ${sortKey === 'subscribers' ? 'bg-indigo-600 text-white shadow-md' : 'hover:text-gray-700'}`}
                >
                    구독자순
                </button>
            </div>
        </div>
    );
}
