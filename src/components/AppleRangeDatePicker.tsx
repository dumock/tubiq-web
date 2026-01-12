'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, ArrowRight } from 'lucide-react';

interface AppleRangeDatePickerProps {
    startDate: string;
    endDate: string;
    onRangeChange: (startDate: string, endDate: string) => void;
    placeholder?: string;
    className?: string;
    position?: 'top' | 'bottom';
}

export default function AppleRangeDatePicker({
    startDate,
    endDate,
    onRangeChange,
    placeholder = '기간 선택',
    className = '',
    position = 'top'
}: AppleRangeDatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(startDate ? new Date(startDate) : new Date());
    const containerRef = useRef<HTMLDivElement>(null);

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

    const formatDate = (date: Date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const handleDateSelect = (day: number) => {
        const selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        const selectedStr = formatDate(selectedDate);

        if (!startDate || (startDate && endDate)) {
            // Start new range selection
            onRangeChange(selectedStr, '');
        } else {
            // Finish range selection
            const start = new Date(startDate);
            if (selectedDate < start) {
                // If selected date is before start date, swap them
                onRangeChange(selectedStr, startDate);
            } else {
                onRangeChange(startDate, selectedStr);
                setIsOpen(false); // Close after range is complete
            }
        }
    };

    const renderCalendar = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const days = [];
        const totalDays = daysInMonth(year, month);
        const startDay = firstDayOfMonth(year, month);

        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-9 w-9" />);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const start = startDate ? new Date(startDate) : null;
        if (start) start.setHours(0, 0, 0, 0);

        const end = endDate ? new Date(endDate) : null;
        if (end) end.setHours(0, 0, 0, 0);

        for (let day = 1; day <= totalDays; day++) {
            const date = new Date(year, month, day);
            date.setHours(0, 0, 0, 0);

            const isToday = date.getTime() === today.getTime();
            const isStart = start && date.getTime() === start.getTime();
            const isEnd = end && date.getTime() === end.getTime();
            const isInRange = start && end && date > start && date < end;

            days.push(
                <button
                    key={day}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDateSelect(day);
                    }}
                    className={`h-9 w-9 relative flex items-center justify-center text-sm transition-all duration-200 ${isStart || isEnd
                        ? 'bg-indigo-600 text-white rounded-full z-10 shadow-lg shadow-indigo-100'
                        : isInRange
                            ? 'bg-indigo-50 text-indigo-600 rounded-none'
                            : isToday
                                ? 'bg-gray-50 text-indigo-600 font-bold rounded-full'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full'
                        }`}
                >
                    {isInRange && (
                        <div className="absolute inset-0 bg-indigo-50 dark:bg-indigo-900/20 -z-10" />
                    )}
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
                className={`flex items-center gap-3 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm cursor-pointer transition-all hover:bg-white focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white group`}
            >
                <CalendarIcon className={`h-4 w-4 shrink-0 transition-colors ${isOpen ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600'}`} />
                <div className="flex items-center gap-2 overflow-hidden">
                    {startDate ? (
                        <>
                            <span className="font-bold text-gray-900 dark:text-gray-100">{startDate}</span>
                            <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                            <span className="font-bold text-gray-900 dark:text-gray-100">{endDate || '종료일'}</span>
                        </>
                    ) : (
                        <span className="text-gray-400">{placeholder}</span>
                    )}
                </div>
                {(startDate || endDate) && (
                    <X
                        className="h-3.5 w-3.5 ml-auto text-gray-400 hover:text-gray-600 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRangeChange('', '');
                        }}
                    />
                )}
            </div>

            {isOpen && (
                <div className={`absolute ${position === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 z-50 animate-in fade-in slide-in-from-${position === 'top' ? 'bottom-1' : 'top-1'} duration-200 origin-${position === 'top' ? 'bottom' : 'top'}`}>
                    <div className="w-72 rounded-2xl border border-indigo-100 bg-white/95 backdrop-blur-xl p-4 shadow-xl dark:bg-zinc-900/95 dark:border-zinc-800 ring-1 ring-black/5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white px-2">
                                {viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월
                            </h3>
                            <div className="flex gap-1">
                                <button onClick={handlePrevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 transition-colors">
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button onClick={handleNextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 transition-colors">
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
                            <div className="flex flex-col">
                                <span className="text-[9px] text-gray-400 font-bold uppercase">현재 진행 상태</span>
                                <span className="text-[11px] font-bold text-indigo-600">
                                    {!startDate ? '시작일 선택' : !endDate ? '종료일 선택' : '선택 완료'}
                                </span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOpen(false);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-[11px] font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors"
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
