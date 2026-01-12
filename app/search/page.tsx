'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import SearchTable from '@/components/SearchTable';
import ChannelTable, { Channel } from '@/components/ChannelTable';
import KeywordSuggestions from '@/components/KeywordSuggestions';
import MainSearchBar from '@/components/MainSearchBar';
import { LayoutGrid, Video, Search, Download, Sparkles } from 'lucide-react';
import { useYouTubeApi } from '@/hooks/useYouTubeApi';

export default function SearchPage() {
    const { fetchYouTube } = useYouTubeApi();
    const [activeTab, setActiveTab] = useState<'video' | 'channel'>('video');
    const [searchQuery, setSearchQuery] = useState('');
    const [submittedQuery, setSubmittedQuery] = useState('');
    const [country, setCountry] = useState('KR');
    const [isTranslating, setIsTranslating] = useState(false);
    const [translatedKeyword, setTranslatedKeyword] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

    // Selection State
    const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
    const [lastSelectedVideoId, setLastSelectedVideoId] = useState<string | null>(null);
    const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
    const [lastSelectedChannelId, setLastSelectedChannelId] = useState<string | null>(null);

    // In a real app, these would come from an API search
    const [videos, setVideos] = useState<any[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);

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

    const performSearch = async (q: string) => {
        if (!q.trim()) return;

        setSubmittedQuery(q);
        setSelectedVideoIds([]);
        setSelectedChannelIds([]);
        setTranslatedKeyword('');
        setIsSearching(true);

        try {
            let finalKeyword = q;

            // 1. Translation if needed (non-KR countries)
            if (activeTab === 'video' && country !== 'KR') {
                setIsTranslating(true);
                console.log('[Search] Requesting translation for:', q, 'country:', country);

                try {
                    const transRes = await fetchYouTube('/api/gemini/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ keyword: q, country })
                    });
                    const transData = await transRes.json();
                    console.log('[Search] Translation response:', transData);

                    if (transRes.ok && transData.ok && transData.translated) {
                        finalKeyword = transData.translated;
                        setTranslatedKeyword(finalKeyword);
                        setSearchQuery(finalKeyword); // Update input field
                        console.log('[Search] Input updated to:', finalKeyword);
                    } else {
                        console.warn('[Search] Translation failed, using original:', q);
                    }
                } catch (transError) {
                    console.error('[Search] Translation error:', transError);
                }
                setIsTranslating(false);
            }

            // 2. YouTube Search with final keyword
            console.log('[Search] Searching YouTube with:', finalKeyword, 'region:', country, 'type:', activeTab);
            const searchRes = await fetchYouTube(`/api/youtube/search?q=${encodeURIComponent(finalKeyword)}&regionCode=${country}&type=${activeTab}`);
            const searchData = await searchRes.json();

            if (searchData.ok) {
                if (activeTab === 'video') {
                    setVideos(searchData.data);
                } else {
                    setChannels(searchData.data);
                }
            }
        } catch (error) {
            console.error('Search Error:', error);
        } finally {
            setIsSearching(false);
            setIsTranslating(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        performSearch(searchQuery);
    };

    const handleGenerateSuggestions = async () => {
        const q = submittedQuery || searchQuery;
        if (!q) return;
        setSuggestions([]);
        setIsGeneratingSuggestions(true);

        try {
            const res = await fetchYouTube('/api/gemini/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyword: q,
                    country
                })
            });
            const data = await res.json();
            if (data.ok) {
                setSuggestions(data.suggestions);
            }
        } catch (error) {
            console.error('Suggestion Error:', error);
        } finally {
            setIsGeneratingSuggestions(false);
        }
    };

    const handleSelectSuggestion = (keyword: string) => {
        setSearchQuery(keyword);
        performSearch(keyword);
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
        let results = [...videos];
        if (submittedQuery) {
            const query = submittedQuery.toLowerCase();
            const trans = translatedKeyword.toLowerCase();
            results = results.filter(v =>
                v.title.toLowerCase().includes(query) ||
                (trans && v.title.toLowerCase().includes(trans))
            );
        }

        if (sortConfig) {
            results.sort((a, b) => {
                let aVal: any = a[sortConfig.key];
                let bVal: any = b[sortConfig.key];

                if (sortConfig.key === 'rank') {
                    aVal = videos.indexOf(a);
                    bVal = videos.indexOf(b);
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return results;
    }, [submittedQuery, sortConfig, videos, translatedKeyword]);

    const filteredChannels = useMemo(() => {
        let results = [...channels];
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
    }, [submittedQuery, sortConfig, channels]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black">
            <Header />
            <FilterBar
                showCountryFilter={true}
                country={country}
                onCountryChange={setCountry}
                onFetchVideos={(cond) => console.log('Filter:', cond)}
                isFetching={isSearching}
            />

            <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Compact Search Section */}
                <div className="mx-auto w-full max-w-2xl flex flex-col gap-3">
                    <MainSearchBar
                        query={searchQuery}
                        onQueryChange={setSearchQuery}
                        onSearch={handleSearch}
                        isSearching={isSearching}
                        placeholder={activeTab === 'video' ? "검색어를 입력하세요" : "채널명을 입력하세요"}
                    />

                    {/* Compact Translation Hint & AI Suggestion Button */}
                    <div className="flex items-center justify-between px-1">
                        <div className="flex-1">
                            {(isTranslating || translatedKeyword) && (
                                <div className="flex items-center gap-2 text-xs">
                                    {isTranslating && (
                                        <div className="flex items-center gap-2 text-indigo-500 animate-pulse">
                                            <div className="h-1.5 w-1.5 rounded-full bg-current" />
                                            <span>번역 중...</span>
                                        </div>
                                    )}
                                    {translatedKeyword && !isTranslating && (
                                        <div className="inline-flex items-center gap-1.5 text-gray-400">
                                            <span className="font-medium">{country}:</span>
                                            <span className="text-gray-600 dark:text-gray-300 font-semibold italic">"{translatedKeyword}"</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {(submittedQuery || searchQuery) && !isGeneratingSuggestions && suggestions.length === 0 && (
                            <button
                                onClick={handleGenerateSuggestions}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/50 dark:bg-indigo-900/10 dark:text-indigo-400 rounded-lg transition-all"
                            >
                                <Sparkles className="h-3 w-3" />
                                AI 추천
                            </button>
                        )}
                    </div>
                </div>

                {/* Gemini Keyword Suggestions */}
                {(isGeneratingSuggestions || suggestions.length > 0) && (
                    <KeywordSuggestions
                        suggestions={suggestions}
                        isLoading={isGeneratingSuggestions}
                        onSelect={handleSelectSuggestion}
                        onClose={() => setSuggestions([])}
                    />
                )}

                {/* Results Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">검색 결과</h1>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {activeTab === 'video' ? filteredVideos.length : filteredChannels.length}개
                        </span>
                    </div>

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
                            영상
                        </button>
                        <button
                            onClick={() => setActiveTab('channel')}
                            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${activeTab === 'channel'
                                ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            <LayoutGrid className="h-4 w-4" />
                            채널
                        </button>
                    </div>
                </div>

                {/* Table */}
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
            </main>
        </div>
    );
}
