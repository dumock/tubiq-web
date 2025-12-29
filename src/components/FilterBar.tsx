'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Filter, FileVideo, Check } from 'lucide-react';

interface FilterBarProps {
    onFetchVideos?: (conditions: { daysAgo: number; minViews: number; limit: number }) => void;
    isFetching?: boolean;
}

const DAYS_OPTIONS = [1, 2, 3, 5, 7, 10, 15, 30];
const VIEWS_OPTIONS = [
    { label: '5만', value: 50000 },
    { label: '10만', value: 100000 },
    { label: '20만', value: 200000 },
    { label: '30만', value: 300000 },
    { label: '50만', value: 500000 },
    { label: '100만', value: 1000000 },
    { label: '150만', value: 1500000 },
    { label: '200만', value: 2000000 },
    { label: '300만', value: 3000000 },
];
const COLLECTION_OPTIONS = [50, 100, 200, 300, 500, 1000, 2000, 3000];

function CustomDropdown<T extends string | number>({
    value,
    options,
    onChange,
    disabled,
    labelSuffix = '',
    formatLabel = (val: T) => `${val}`
}: {
    value: T;
    options: (T | { label: string; value: T })[];
    onChange: (val: T) => void;
    disabled?: boolean;
    labelSuffix?: string;
    formatLabel?: (val: T) => string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => (typeof o === 'object' ? o.value === value : o === value));
    const displayLabel = typeof selectedOption === 'object' ? selectedOption.label : formatLabel(value);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all duration-200 outline-none
                    ${isOpen
                        ? 'border-indigo-500 bg-white ring-4 ring-indigo-500/10 dark:bg-zinc-900 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-indigo-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-gray-300'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}`}
            >
                <span className="truncate">{displayLabel}{labelSuffix}</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 mt-2 z-[100] min-w-[140px] overflow-hidden rounded-2xl border border-gray-100 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 dark:border-zinc-800 dark:bg-zinc-900/95">
                    <div className="flex max-h-60 flex-col overflow-y-auto custom-scrollbar">
                        {options.map((opt, idx) => {
                            const optValue = typeof opt === 'object' ? opt.value : opt;
                            const optLabel = typeof opt === 'object' ? opt.label : formatLabel(opt);
                            const isSelected = optValue === value;

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                        onChange(optValue);
                                        setIsOpen(false);
                                    }}
                                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors
                                        ${isSelected
                                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                                            : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-zinc-800/60'
                                        }`}
                                >
                                    <span>{optLabel}{labelSuffix}</span>
                                    {isSelected && <Check className="h-3.5 w-3.5" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function FilterBar({ onFetchVideos, isFetching }: FilterBarProps) {
    const [daysAgo, setDaysAgo] = useState(30);
    const [minViews, setMinViews] = useState(100000);
    const [limit, setLimit] = useState(100);

    return (
        <div className="w-full border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-zinc-950">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">

                {/* Left Section: Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 pr-2 text-sm font-medium text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-zinc-800 mr-2">
                        <Filter className="h-4 w-4" />
                        <span>조건 설정</span>
                    </div>

                    <CustomDropdown
                        value={daysAgo}
                        options={DAYS_OPTIONS}
                        onChange={setDaysAgo}
                        disabled={isFetching}
                        labelSuffix="일전"
                    />

                    <CustomDropdown
                        value={minViews}
                        options={VIEWS_OPTIONS}
                        onChange={setMinViews}
                        disabled={isFetching}
                        labelSuffix=" 이상"
                    />

                    <CustomDropdown
                        value={limit}
                        options={COLLECTION_OPTIONS}
                        onChange={setLimit}
                        disabled={isFetching}
                        formatLabel={(val) => `수집 ${val}개`}
                    />
                </div>

                {/* Right Section: Fetch Action */}
                <button
                    onClick={() => onFetchVideos?.({ daysAgo, minViews, limit })}
                    disabled={isFetching}
                    className="group flex h-10 items-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white hover:bg-zinc-800 active:scale-95 transition-all shadow-md shadow-black/5 dark:bg-white dark:text-black dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                    <div className={`flex items-center justify-center rounded-lg bg-white/20 p-1 group-hover:bg-white/30 transition-colors ${isFetching ? 'animate-spin' : ''}`}>
                        <FileVideo className="h-4 w-4" />
                    </div>
                    {isFetching ? '가져오는 중...' : '영상 가져오기'}
                </button>
            </div>
        </div>
    );
}
