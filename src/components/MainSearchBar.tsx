'use client';

import { Search } from 'lucide-react';

interface MainSearchBarProps {
    query: string;
    onQueryChange: (val: string) => void;
    onSearch: (e: React.FormEvent) => void;
    isSearching: boolean;
    placeholder?: string;
}

export default function MainSearchBar({
    query,
    onQueryChange,
    onSearch,
    isSearching,
    placeholder = "검색어를 입력하세요"
}: MainSearchBarProps) {
    return (
        <form onSubmit={onSearch} className="relative group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-all duration-300 group-focus-within:scale-110" />
            <input
                type="text"
                placeholder={placeholder}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                className="h-12 w-full rounded-2xl border border-gray-200 bg-white pl-12 pr-28 text-sm shadow-lg shadow-black/[0.03] outline-none transition-all duration-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:shadow-none"
            />
            <button
                type="submit"
                disabled={isSearching}
                className="absolute right-1.5 top-1.5 bottom-1.5 bg-zinc-900 text-white px-6 rounded-xl text-xs font-semibold hover:bg-black active:scale-95 transition-all disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
                {isSearching ? (
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span>검색 중</span>
                    </div>
                ) : '검색'}
            </button>
        </form>
    );
}
