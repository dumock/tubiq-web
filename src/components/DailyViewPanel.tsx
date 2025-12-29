'use client';

import { X, Clock } from 'lucide-react';
import { MOCK_VIDEO_DAILY } from '@/mock/videoDaily';
import VideoDailyTable from '@/components/VideoDailyTable';

interface DailyViewPanelProps {
    video: {
        id: string;
        thumbnail: string;
        title: string;
    } | null;
    onClose: () => void;
}

export default function DailyViewPanel({ video, onClose }: DailyViewPanelProps) {
    if (!video) return null;

    const stats = MOCK_VIDEO_DAILY[video.id] || MOCK_VIDEO_DAILY['v1'];

    return (
        <>
            <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-in fade-in duration-300"
                onClick={onClose}
            />
            <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-500 dark:bg-zinc-900 border-l dark:border-zinc-800">
                <div className="h-full flex flex-col">
                    {/* Panel Header */}
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between dark:border-zinc-800">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">일별 조회수 테이블</h3>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors dark:hover:bg-zinc-800"
                        >
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Panel Content (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="h-20 w-36 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-800">
                                    <img src={video.thumbnail} alt="" className="h-full w-full object-cover" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 leading-tight dark:text-gray-100">
                                        {video.title}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            최종 갱신: 방금 전
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <VideoDailyTable data={stats} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
