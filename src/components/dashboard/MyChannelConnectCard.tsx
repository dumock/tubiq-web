"use client";

import React, { useState } from 'react';
import { Youtube, Link2, Link2Off, Settings, AlertCircle, Loader2 } from 'lucide-react';
import { useMyChannelStore } from '@/lib/myChannelStore';
import { MyChannelList } from '@/components/dashboard/MyChannelList';
import { MyChannelDailyChart } from './MyChannelDailyChart';

export function MyChannelConnectCard() {
    const { isConnected, channels, setConnected, setChannels, disconnect } = useMyChannelStore();
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleConnect = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/youtube/mock?action=connect', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setConnected(true);
                setChannels(data.channels);
            }
        } catch (error) {
            console.error('Failed to connect:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('정말 YouTube 채널 연결을 해제하시겠습니까?')) return;

        setIsLoading(true);
        try {
            await fetch('/api/auth/youtube/mock?action=disconnect', { method: 'POST' });
            disconnect();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 dark:text-white">
                    <Youtube className="w-4 h-4 text-rose-600" />
                    내 채널 연결
                </h3>
                {isConnected && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        연결됨 ({channels.length})
                    </span>
                )}
            </div>

            {!isConnected ? (
                <div className="space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        채널의 수익 분석 및 상세 지표 관제를 위해 YouTube 채널을 안전하게 연결하세요.
                        <span className="block mt-1 font-bold text-indigo-500 dark:text-indigo-400">※ 연결 시 일별 예상 수익 및 정밀 지표가 활성화됩니다.</span>
                    </p>
                    <button
                        onClick={handleConnect}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-200 dark:hover:bg-zinc-700"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <img src="https://www.google.com/favicon.ico" className="w-3 h-3" alt="" />}
                        Google로 내 채널 연결
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-gray-50 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700"
                    >
                        <div className="flex items-center gap-2">
                            <Settings className="w-4 h-4 text-gray-400" />
                            채널 및 추적 관리
                        </div>
                    </button>
                    <button
                        onClick={handleDisconnect}
                        disabled={isLoading}
                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-rose-600 text-[11px] font-bold hover:bg-rose-50 transition-colors dark:hover:bg-rose-900/10"
                    >
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2Off className="w-3 h-3" />}
                        연결 해제
                    </button>
                </div>
            )}

            {/* Management Modal */}
            {isModalOpen && (
                <MyChannelList isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
            )}

            {/* Note for Implementation */}
            {/* TODO: Replace with real OAuth in production */}
        </div>
    );
}
