'use client';

import { useState, useMemo } from 'react';
import { X, Folder, Search, Check } from 'lucide-react';
import { useFolders } from '@/hooks/useFolders';

interface VideoFolderSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectFolder: (folderId: string) => void;
}

export default function VideoFolderSelectionModal({ isOpen, onClose, onSelectFolder }: VideoFolderSelectionModalProps) {
    const { folders, isLoading } = useFolders('videos');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const filteredFolders = useMemo(() => {
        return folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [folders, searchQuery]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative p-6 pb-2">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        영상 에셋으로 이동
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        영상 에셋 페이지의 어느 폴더로 저장하시겠습니까?
                    </p>
                </div>

                {/* Search */}
                <div className="px-6 py-2 pb-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="폴더 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-800 border-2 border-gray-900 dark:border-zinc-600 rounded-2xl text-[15px] focus:outline-none placeholder-gray-400 text-gray-900 dark:text-gray-100"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Folder List */}
                <div className="p-4 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-zinc-700">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <button
                                onClick={() => setSelectedId('all')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${selectedId === 'all'
                                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-500/30'
                                    : 'hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                <div className={`p-2 rounded-lg ${selectedId === 'all' ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-gray-100 dark:bg-zinc-800'}`}>
                                    <Folder className={`w-5 h-5 ${selectedId === 'all' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}`} />
                                </div>
                                <div className="flex-1 text-left">
                                    <span className="font-medium">
                                        전체 목록 (폴더 없음)
                                    </span>
                                </div>
                                {selectedId === 'all' && <Check className="w-4 h-4 text-indigo-600" />}
                            </button>

                            {filteredFolders.map((folder) => (
                                <button
                                    key={folder.id}
                                    onClick={() => setSelectedId(folder.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${selectedId === folder.id
                                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-500/30'
                                        : 'hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg ${selectedId === folder.id ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-gray-100 dark:bg-zinc-800'}`}>
                                        <Folder className={`w-5 h-5 ${selectedId === folder.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}`} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <span className="font-medium">
                                            {folder.name}
                                        </span>
                                    </div>
                                    {selectedId === folder.id && <Check className="w-4 h-4 text-indigo-600" />}
                                </button>
                            ))}

                            {filteredFolders.length === 0 && folders.length > 0 && (
                                <div className="text-center py-8 text-gray-400 text-sm">
                                    검색 결과가 없습니다
                                </div>
                            )}

                            {filteredFolders.length === 0 && folders.length === 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    <p>생성된 폴더가 없습니다.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        disabled={!selectedId}
                        onClick={() => selectedId && onSelectFolder(selectedId)}
                        className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                    >
                        이동하기
                    </button>
                </div>
            </div>
        </div>
    );
}
