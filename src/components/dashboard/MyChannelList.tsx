"use client";

import React from 'react';
import { X, CheckCircle2, Circle } from 'lucide-react';
import { useMyChannelStore } from '@/lib/myChannelStore';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export function MyChannelList({ isOpen, onClose }: Props) {
    const { channels, toggleTracking } = useMyChannelStore();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white">내 채널 관리</h2>
                        <p className="text-xs text-gray-500 mt-1">대시보드에서 추적할 채널을 선택하세요</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 max-h-[400px] overflow-y-auto space-y-3">
                    {channels.map((channel) => (
                        <div
                            key={channel.channelId}
                            className="group flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white hover:border-indigo-200 transition-all dark:bg-zinc-800 dark:border-zinc-700"
                        >
                            <div className="flex items-center gap-3">
                                <img src={channel.thumbnailUrl} alt="" className="w-10 h-10 rounded-full border border-gray-100" />
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate dark:text-white">{channel.title}</p>
                                    <p className="text-[10px] text-gray-400">{channel.handle || channel.channelId}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => toggleTracking(channel.channelId)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${channel.trackingEnabled
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 text-gray-400 dark:bg-zinc-700'
                                    }`}
                            >
                                {channel.trackingEnabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                                {channel.trackingEnabled ? '추적 중' : '추적 OFF'}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800">
                    <p className="text-[10px] text-gray-400 leading-relaxed text-center">
                        * 추적을 활성화한 채널의 영상들만 '오늘의 이상 신호' 및 '급등 영상' 분석 대상에 포함됩니다.
                    </p>
                    <button
                        onClick={onClose}
                        className="w-full mt-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-black transition-colors dark:bg-white dark:text-black"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
