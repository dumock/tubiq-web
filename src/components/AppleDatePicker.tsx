'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';

interface AppleDatePickerProps {
    value: string;
    onChange: (date: string) => void;
    placeholder?: string;
    className?: string;
    accentColor?: 'indigo' | 'rose';
}

export default function AppleDatePicker({
    value,
    onChange,
    placeholder = '날짜 선택',
    className = '',
    accentColor = 'indigo'
}: AppleDatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
    const containerRef = useRef<HTMLDivElement>(null);

    const theme = {
        indigo: {
            bg: 'bg-indigo-50/50',
            text: 'text-indigo-600',
            border: 'border-indigo-100',
            ring: 'focus:ring-indigo-100',
            active: 'bg-indigo-600 text-white shadow-lg shadow-indigo-100',
            hover: 'hover:bg-indigo-50 hover:text-indigo-600'
        },
        rose: {
            bg: 'bg-rose-50/50',
            text: 'text-rose-600',
            border: 'border-rose-100',
            ring: 'focus:ring-rose-100',
            active: 'bg-rose-600 text-white shadow-lg shadow-rose-100',
            hover: 'hover:bg-rose-50 hover:text-rose-600'
        }
    }[accentColor];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const handlePrevMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const handleDateSelect = (day: number) => {
        const selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        const yyyy = selectedDate.getFullYear();
        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const dd = String(selectedDate.getDate()).padStart(2, '0');
        onChange(`${yyyy}-${mm}-${dd}`);
        setIsOpen(false);
    };

    const renderCalendar = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const days = [];
        const totalDays = daysInMonth(year, month);
        const startDay = firstDayOfMonth(year, month);

        // Blank spaces for previous month
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-9 w-9" />);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const currentSelected = value ? new Date(value) : null;
        if (currentSelected) currentSelected.setHours(0, 0, 0, 0);

        for (let day = 1; day <= totalDays; day++) {
            const date = new Date(year, month, day);
            const isToday = date.getTime() === today.getTime();
            const isSelected = currentSelected && date.getTime() === currentSelected.getTime();

            days.push(
                <button
                    key={day}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDateSelect(day);
                    }}
                    className={`h-9 w-9 rounded-full flex items-center justify-center text-sm transition-all duration-200 ${isSelected
                            ? theme.active
                            : isToday
                                ? `font-bold ${theme.text} ${theme.bg}`
                                : `text-gray-600 dark:text-gray-400 ${theme.hover}`
                        }`}
                >
                    {day}
                </button>
            );
        }

        return days;
    };

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-3 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm cursor-pointer transition-all hover:bg-white focus-within:bg-white focus-within:ring-4 ${theme.ring} dark:bg-zinc-800 dark:border-zinc-700 dark:text-white group`}
            >
                <CalendarIcon className={`h-4 w-4 shrink-0 transition-colors ${isOpen ? theme.text : 'text-gray-400 group-hover:' + theme.text}`} />
                <span className={`block truncate ${value ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-400'}`}>
                    {value || placeholder}
                </span>
                {value && (
                    <X
                        className="h-3.5 w-3.5 ml-auto text-gray-400 hover:text-gray-600 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange('');
                        }}
                    />
                )}
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top">
                    <div className="w-72 rounded-2xl border border-gray-100 bg-white/90 backdrop-blur-xl p-4 shadow-2xl dark:bg-zinc-900/90 dark:border-zinc-800 ring-1 ring-black/5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white px-2">
                                {viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월
                            </h3>
                            <div className="flex gap-1">
                                <button
                                    onClick={handlePrevMonth}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 transition-colors"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={handleNextMonth}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 transition-colors"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                                <div key={d} className={`h-8 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>
                                    {d}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                            {renderCalendar()}
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800 flex justify-between items-center px-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const today = new Date();
                                    const yyyy = today.getFullYear();
                                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                                    const dd = String(today.getDate()).padStart(2, '0');
                                    onChange(`${yyyy}-${mm}-${dd}`);
                                    setIsOpen(false);
                                }}
                                className={`text-[11px] font-bold ${theme.text} hover:opacity-70 transition-opacity`}
                            >
                                오늘
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOpen(false);
                                }}
                                className="text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
