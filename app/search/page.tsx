'use client';

import { useState, useMemo } from 'react';
import Header from '@/src/components/Header';
import FilterBar from '@/src/components/FilterBar';
import SearchTable from '@/src/components/SearchTable';
import ChannelTable, { Channel } from '@/src/components/ChannelTable';
import { LayoutGrid, Video, Search, Download } from 'lucide-react';
import { mockVideos, Video as VideoType } from '@/src/mock/videos';

export default function SearchPage() {
    const [activeTab, setActiveTab] = useState<'video' | 'channel'>('video');
    const [searchQuery, setSearchQuery] = useState('');
    const [submittedQuery, setSubmittedQuery] = useState('');

    // Selection State
    const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
    const [lastSelectedVideoId, setLastSelectedVideoId] = useState<string | null>(null);
    const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
    const [lastSelectedChannelId, setLastSelectedChannelId] = useState<string | null>(null);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                if (prev.direction === 'asc') return { key, direction: 'desc' };
                return null;
            }
            return { key, direction: 'asc' };
        });
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittedQuery(searchQuery);
        // Clear selection on new search
        setSelectedVideoIds([]);
        setSelectedChannelIds([]);
    };

    const handleToggleVideo = (id: string, multiSelect: boolean, shiftSelect: boolean) => {
        if (multiSelect) {
            setSelectedVideoIds(prev => prev.includes(id) ? prev.filter(curr => curr !== id) : [...prev, id]);
            setLastSelectedVideoId(id);
        } else if (shiftSelect && lastSelectedVideoId) {
            const currentIds = filteredVideos.map(v => v.id);
            const startIdx = currentIds.indexOf(lastSelectedVideoId);
            const endIdx = currentIds.indexOf(id);
            if (startIdx !== -1 && endIdx !== -1) {
                const rangeIds = currentIds.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
                setSelectedVideoIds(prev => Array.from(new Set([...prev, ...rangeIds])));
            }
        } else {
            setSelectedVideoIds(prev => prev.includes(id) ? prev.filter(curr => curr !== id) : [id]);
            setLastSelectedVideoId(id);
        }
    };

    const handleToggleChannel = (id: string, multiSelect: boolean, shiftSelect: boolean) => {
        if (multiSelect) {
            setSelectedChannelIds(prev => prev.includes(id) ? prev.filter(curr => curr !== id) : [...prev, id]);
            setLastSelectedChannelId(id);
        } else if (shiftSelect && lastSelectedChannelId) {
            const currentIds = filteredChannels.map(c => c.id);
            const startIdx = currentIds.indexOf(lastSelectedChannelId);
            const endIdx = currentIds.indexOf(id);
            if (startIdx !== -1 && endIdx !== -1) {
                const rangeIds = currentIds.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
                setSelectedChannelIds(prev => Array.from(new Set([...prev, ...rangeIds])));
            }
        } else {
            setSelectedChannelIds(prev => prev.includes(id) ? prev.filter(curr => curr !== id) : [id]);
            setLastSelectedChannelId(id);
        }
    };

    const handleToggleAllVideos = (allIds: string[]) => {
        setSelectedVideoIds(prev => prev.length === allIds.length ? [] : allIds);
    };

    const handleToggleAllChannels = (allIds: string[]) => {
        setSelectedChannelIds(prev => prev.length === allIds.length ? [] : allIds);
    };

    const parseCompactNumber = (str: string) => {
        const val = parseFloat(str.replace(/[^0-9.]/g, ''));
        if (str.includes('M')) return val * 1000000;
        if (str.includes('K')) return val * 1000;
        return val;
    };

    // Filter and Sort videos based on submitted search query
    const filteredVideos = useMemo(() => {
        let results = [...mockVideos];
        if (submittedQuery) {
            results = results.filter(v =>
                v.title.toLowerCase().includes(submittedQuery.toLowerCase())
            );
        }

        if (sortConfig) {
            results.sort((a, b) => {
                let aVal: any = a[sortConfig.key as keyof VideoType];
                let bVal: any = b[sortConfig.key as keyof VideoType];

                if (sortConfig.key === 'rank') {
                    // Default ranking from mockVideos
                    aVal = mockVideos.indexOf(a);
                    bVal = mockVideos.indexOf(b);
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return results;
    }, [submittedQuery, sortConfig]);

    // Filter and Sort channels
    const filteredChannels = useMemo(() => {
        const mockChannels: Channel[] = [
            { id: '1', rank: 1, name: 'TubiQ Official', handle: '@tubiq_official', category: 'Technology', subscribers: '1.2M', subscriberGrowth: 12.5, views: '85.4M', videos: 142, status: 'Growing', avatar: 'bg-indigo-500' },
            { id: '2', rank: 2, name: 'Daily Vloggers', handle: '@daily_vlog', category: 'Lifestyle', subscribers: '850K', subscriberGrowth: 5.2, views: '42.1M', videos: 89, status: 'Stable', avatar: 'bg-rose-500' },
            { id: '3', rank: 3, name: 'Code with Me', handle: '@codewithme', category: 'Education', subscribers: '620K', subscriberGrowth: -2.1, views: '15.8M', videos: 230, status: 'Active', avatar: 'bg-blue-500' },
            { id: '4', rank: 4, name: 'Foodie Heaven', handle: '@foodie_hvn', category: 'Food', subscribers: '450K', subscriberGrowth: 8.4, views: '28.9M', videos: 156, status: 'Growing', avatar: 'bg-orange-500' },
            { id: '5', rank: 5, name: 'Travel Diaries', handle: '@travel_diaries', category: 'Travel', subscribers: '320K', subscriberGrowth: 1.8, views: '12.5M', videos: 64, status: 'Stable', avatar: 'bg-emerald-500' }
        ];

        let results = [...mockChannels];
        if (submittedQuery) {
            results = results.filter(c =>
                c.name.toLowerCase().includes(submittedQuery.toLowerCase()) ||
                c.handle.toLowerCase().includes(submittedQuery.toLowerCase())
            );
        }

        if (sortConfig) {
            results.sort((a, b) => {
                let aVal: any = a[sortConfig.key as keyof Channel];
                let bVal: any = b[sortConfig.key as keyof Channel];

                if (sortConfig.key === 'subscribers' || sortConfig.key === 'views') {
                    aVal = parseCompactNumber(aVal as string);
                    bVal = parseCompactNumber(bVal as string);
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return results;
    }, [submittedQuery, sortConfig]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black">
            <Header />
            <FilterBar onFetchVideos={(cond) => console.log('Filter:', cond)} />

            <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">

                {/* Search Input Section */}
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <form onSubmit={handleSearch} className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="text"
                                placeholder={activeTab === 'video' ? "영상 키워드를 입력하세요" : "채널명을 입력하세요"}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-14 w-full rounded-2xl border border-gray-200 bg-white pl-12 pr-4 text-lg shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                            />
                            <button
                                type="submit"
                                className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white px-6 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                            >
                                검색
                            </button>
                        </form>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">검색 결과</h1>

                        {/* Tab Group */}
                        <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-zinc-800">
                            <button
                                onClick={() => setActiveTab('video')}
                                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${activeTab === 'video'
                                    ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                <Video className="h-4 w-4" />
                                영상 검색
                            </button>
                            <button
                                onClick={() => setActiveTab('channel')}
                                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${activeTab === 'channel'
                                    ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                <LayoutGrid className="h-4 w-4" />
                                채널 검색
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            총 <span className="font-bold text-gray-900 dark:text-white">{activeTab === 'video' ? filteredVideos.length : filteredChannels.length}</span>개의 {activeTab === 'video' ? '영상' : '채널'}을 찾았습니다
                        </span>
                    </div>

                    {activeTab === 'video' ? (
                        <SearchTable
                            videos={filteredVideos}
                            selectedIds={selectedVideoIds}
                            onToggle={handleToggleVideo}
                            onToggleAll={handleToggleAllVideos}
                            sortConfig={sortConfig}
                            onSort={handleSort}
                        />
                    ) : (
                        <ChannelTable
                            hideHeader
                            channelsData={filteredChannels}
                            selectedIds={selectedChannelIds}
                            onToggle={handleToggleChannel}
                            onToggleAll={handleToggleAllChannels}
                            sortConfig={sortConfig}
                            onSort={handleSort}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}
