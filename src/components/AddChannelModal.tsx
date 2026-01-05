'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Youtube, Loader2, Check } from 'lucide-react';

export interface ChannelData {
    id: string;
    title: string;
    handle: string;
    thumbnailUrl: string;
    subscriberCount?: number;
    viewCount?: number;
    videoCount?: number;
    publishedAt?: string | null; // ISO date string
}

interface AddChannelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (channel: ChannelData) => void;
}

import { useYouTubeApi } from '@/hooks/useYouTubeApi';

export default function AddChannelModal({ isOpen, onClose, onSave }: AddChannelModalProps) {
    const { fetchYouTube } = useYouTubeApi();
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [resolvedChannel, setResolvedChannel] = useState<ChannelData | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Restore focus to input when loading finishes, so user can press Enter again to save
    useEffect(() => {
        if (!isLoading && isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isLoading, isOpen]);

    if (!isOpen) return null;

    const handleCheckOrSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // 1. If we already have a resolved channel, perform the "Save" action
        if (resolvedChannel) {
            console.log('save channel', resolvedChannel);
            // We can still call the parent onSave if needed, or just close.
            onSave(resolvedChannel);
            resetAndClose();
            return;
        }

        // 2. Otherwise, perform the "Check" (Resolve) action
        if (!input.trim()) {
            setError('채널 링크 또는 핸들명을 입력해주세요.');
            return;
        }

        setIsLoading(true);

        // Extract URL if input contains mixed text (e.g. Douyin share text)
        let queryInput = input;
        const urlMatch = input.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
            queryInput = urlMatch[0];
        }

        try {
            const res = await fetchYouTube(`/api/youtube/resolve-channel?input=${encodeURIComponent(queryInput)}`)
            const data = await res.json();

            if (!res.ok || !data.ok) {
                // Determine error message
                if (res.status === 404) {
                    setError('채널을 찾을 수 없습니다. 핸들명(@...)이나 URL을 확인해주세요.');
                } else if (res.status === 400 && data.message === 'missing api key') {
                    setError('서버에 YouTube API Key가 설정되지 않았습니다.');
                } else {
                    setError(data.message || '채널 정보를 가져오는 중 오류가 발생했습니다.');
                }
                setResolvedChannel(null);
            } else {
                setResolvedChannel(data.channel);
            }
        } catch (err) {
            console.error(err);
            setError('네트워크 오류가 발생했습니다.');
            setResolvedChannel(null);
        } finally {
            setIsLoading(false);
        }
    };

    const resetAndClose = () => {
        setInput('');
        setError('');
        setResolvedChannel(null);
        setIsLoading(false);
        onClose();
    };

    const handleInputChange = (val: string) => {
        setInput(val);
        // If user changes input, reset the resolved state so they have to check again
        if (resolvedChannel) {
            setResolvedChannel(null);
        }
        if (error) setError('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 transform transition-all">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <Youtube className="w-6 h-6 text-red-600 dark:text-red-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            채널 저장
                        </h3>
                    </div>
                    <button
                        onClick={resetAndClose}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleCheckOrSave} className="p-6">
                    <div className="mb-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                채널 링크 또는 핸들명
                            </label>
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => handleInputChange(e.target.value)}
                                placeholder="https://youtube.com/@handle 또는 @handle"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-400 dark:placeholder-zinc-500 disabled:opacity-50"
                                autoFocus
                                disabled={isLoading}
                            />
                            {error && (
                                <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                                    {error}
                                </p>
                            )}
                            {!error && !resolvedChannel && (
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    예: https://www.youtube.com/@YouTube 또는 @YouTube
                                </p>
                            )}
                        </div>

                        {/* Resolved Channel Card */}
                        {resolvedChannel && (
                            <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
                                <img
                                    src={resolvedChannel.thumbnailUrl}
                                    alt={resolvedChannel.title}
                                    className="w-12 h-12 rounded-full object-cover bg-gray-200"
                                />
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                        {resolvedChannel.title}
                                    </h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                        {resolvedChannel.handle}
                                    </p>
                                </div>
                                <div className="text-indigo-600 dark:text-indigo-400">
                                    <Check className="w-5 h-5" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={resetAndClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            disabled={isLoading}
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || (!input.trim() && !resolvedChannel)}
                            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 dark:shadow-none transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>확인 중...</span>
                                </>
                            ) : resolvedChannel ? (
                                '저장하기'
                            ) : (
                                '채널 확인'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
