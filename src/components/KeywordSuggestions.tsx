'use client';

import { Sparkles, X } from 'lucide-react';
import { useState } from 'react';

interface KeywordSuggestionsProps {
    suggestions: string[];
    onSelect: (keyword: string) => void;
    isLoading?: boolean;
    onClose?: () => void;
}

export default function KeywordSuggestions({ suggestions, onSelect, isLoading, onClose }: KeywordSuggestionsProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (isLoading) {
        return (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4 dark:border-indigo-900/30 dark:bg-indigo-900/10 animate-pulse">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <Sparkles className="h-4 w-4 animate-spin" />
                    <span className="text-sm font-bold">연관 키워드를 분석 중입니다...</span>
                </div>
            </div>
        );
    }

    if (!suggestions || suggestions.length === 0) return null;

    const displaySuggestions = isExpanded ? suggestions : suggestions.slice(0, 20);

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden relative transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white">
                        <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Gemini 연관 키워드 추천</h3>
                    <span className="text-xs text-gray-400">({suggestions.length}개 발견)</span>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                {displaySuggestions.map((keyword, idx) => (
                    <button
                        key={idx}
                        onClick={() => onSelect(keyword)}
                        className="px-3 py-1.5 rounded-full bg-gray-50 text-xs font-medium text-gray-600 border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-all dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-400 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400 dark:hover:border-indigo-800"
                    >
                        {keyword}
                    </button>
                ))}
            </div>

            {suggestions.length > 20 && (
                <div className="mt-4 flex justify-center border-t border-gray-50 dark:border-zinc-800 pt-3">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-xs font-bold text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors"
                    >
                        {isExpanded ? '간략히 보기' : `${suggestions.length - 20}개 키워드 더 보기...`}
                    </button>
                </div>
            )}
        </div>
    );
}
