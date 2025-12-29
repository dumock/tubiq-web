'use client';

import { useState, useMemo } from 'react';
import { Search, X, Check, Command } from 'lucide-react';
import { YOUTUBE_TOPICS, TOPIC_PRESETS } from '@/lib/topics';

interface TopicSelectorProps {
    selectedCodes: string[];
    onSelect: (codes: string[]) => void;
    onClose: () => void;
}

export default function TopicSelector({ selectedCodes, onSelect, onClose }: TopicSelectorProps) {
    const [search, setSearch] = useState('');

    const filteredTopics = useMemo(() => {
        if (!search) return YOUTUBE_TOPICS;
        const s = search.toLowerCase();
        return YOUTUBE_TOPICS.filter(t =>
            t.name.toLowerCase().includes(s) ||
            t.code.toLowerCase().includes(s)
        );
    }, [search]);

    const toggleTopic = (code: string) => {
        if (selectedCodes.includes(code)) {
            onSelect(selectedCodes.filter(c => c !== code));
        } else {
            onSelect([...selectedCodes, code]);
        }
    };

    const applyPreset = (codes: string[]) => {
        onSelect(codes);
    };

    return (
        <div className="absolute right-0 mt-2 z-50 w-[320px] bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-2xl p-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Command className="h-4 w-4 text-indigo-500" />
                    토픽 선택
                </h3>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                    <X className="h-4 w-4 text-gray-400" />
                </button>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2">
                {TOPIC_PRESETS.map((preset) => (
                    <button
                        key={preset.label}
                        onClick={() => applyPreset(preset.codes)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-800 dark:text-gray-400 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 rounded-lg border border-gray-100 dark:border-zinc-700 transition-all shadow-sm"
                    >
                        [{preset.label}]
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                    autoFocus
                    type="text"
                    placeholder="토픽 이름 또는 코드 검색..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-950 border border-transparent focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2 text-sm outline-none transition-all placeholder:text-gray-400"
                />
            </div>

            {/* Topic List */}
            <div className="max-h-[240px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {filteredTopics.map((topic) => (
                    <button
                        key={topic.code}
                        onClick={() => toggleTopic(topic.code)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all group ${selectedCodes.includes(topic.code)
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-800/60'
                            }`}
                    >
                        <div className="flex flex-col items-start">
                            <span className="font-semibold">{topic.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono tracking-tight group-hover:text-gray-500">
                                {topic.code}
                            </span>
                        </div>
                        {selectedCodes.includes(topic.code) && (
                            <Check className="h-4 w-4 text-indigo-600" />
                        )}
                    </button>
                ))}
                {filteredTopics.length === 0 && (
                    <div className="py-8 text-center text-xs text-gray-400 italic">
                        검색 결과가 없습니다.
                    </div>
                )}
            </div>

            {/* Footer Summary */}
            <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between text-[11px]">
                <span className="text-gray-500 font-medium">선택됨: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{selectedCodes.length}</span>개</span>
                <button
                    onClick={onClose}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 dark:shadow-none"
                >
                    확인
                </button>
            </div>
        </div>
    );
}
