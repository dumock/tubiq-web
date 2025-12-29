'use client';

import React, { useState } from 'react';
import { X, Youtube } from 'lucide-react';

interface AddChannelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (input: string) => void;
}

export default function AddChannelModal({ isOpen, onClose, onSave }: AddChannelModalProps) {
    const [input, setInput] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!input.trim()) {
            setError('채널 링크 또는 핸들명을 입력해주세요.');
            return;
        }

        // Basic validation for URL or Handle
        const isUrl = input.includes('youtube.com/') || input.includes('youtu.be/');
        const isHandle = input.startsWith('@');

        if (!isUrl && !isHandle) {
            // If strictly enforcing, uncomment below. For now allow flexible input as per request "Handle Name" might be just name too? 
            // Usually handles start with @. Let's assume user expects @ or URL.
            // If user just types a name, maybe we should accept it too? 
            // Prompt says "Channel Link or Channel Handle".
            if (!input.includes('/')) {
                // treat as potential handle without @? or just error. 
                // Let's suggest adding @ if it looks like a handle but missing it.
                // For safety, let's just pass it but might warn.
            }
        }

        onSave(input);
        setInput('');
        onClose();
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
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            채널 링크 또는 핸들명
                        </label>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="https://youtube.com/@handle 또는 @handle"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-400 dark:placeholder-zinc-500"
                            autoFocus
                        />
                        {error && (
                            <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                                {error}
                            </p>
                        )}
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            예: https://www.youtube.com/@YouTube 또는 @YouTube
                        </p>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 dark:shadow-none transition-colors"
                        >
                            저장하기
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
