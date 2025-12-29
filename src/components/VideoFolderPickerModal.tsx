'use client';

import { useState, useEffect } from 'react';
import { X, Folder, ChevronRight, Plus } from 'lucide-react';
import { Folder as FolderType } from '@/types';

interface VideoFolderPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    folders: FolderType[];
    onSelectFolder: (folderId: string | null) => void;
    onCreateFolder?: (name: string) => Promise<boolean>;
    videoTitle?: string;
}

export default function VideoFolderPickerModal({
    isOpen,
    onClose,
    folders,
    onSelectFolder,
    onCreateFolder,
    videoTitle
}: VideoFolderPickerModalProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setIsCreating(false);
            setNewFolderName('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCreateFolder = async () => {
        if (!newFolderName.trim() || !onCreateFolder) return;

        const success = await onCreateFolder(newFolderName.trim());
        if (success) {
            setNewFolderName('');
            setIsCreating(false);
        }
    };

    const parentFolders = folders.filter(f => !f.parentId);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        영상에셋에 저장
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Video Title */}
                {videoTitle && (
                    <p className="mb-4 text-sm text-gray-600 dark:text-gray-400 truncate">
                        "{videoTitle}"
                    </p>
                )}

                {/* Folder List */}
                <div className="mb-4 max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-zinc-700">
                    {/* All Videos (no folder) */}
                    <button
                        onClick={() => onSelectFolder(null)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 border-b border-gray-100 dark:border-zinc-700"
                    >
                        <Folder className="h-5 w-5 text-indigo-500" />
                        <span className="font-medium text-gray-900 dark:text-white">전체보기 (폴더 없음)</span>
                    </button>

                    {/* Parent Folders */}
                    {parentFolders.map((folder) => {
                        const children = folders.filter(f => f.parentId === folder.id);
                        return (
                            <div key={folder.id}>
                                <button
                                    onClick={() => onSelectFolder(folder.id)}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    <Folder className="h-5 w-5 text-amber-500" />
                                    <span className="text-gray-900 dark:text-white">{folder.name}</span>
                                    {children.length > 0 && (
                                        <ChevronRight className="ml-auto h-4 w-4 text-gray-400" />
                                    )}
                                </button>
                                {/* Child Folders */}
                                {children.map((child) => (
                                    <button
                                        key={child.id}
                                        onClick={() => onSelectFolder(child.id)}
                                        className="flex w-full items-center gap-3 px-4 py-3 pl-10 text-left hover:bg-gray-50 dark:hover:bg-zinc-800"
                                    >
                                        <Folder className="h-4 w-4 text-gray-400" />
                                        <span className="text-gray-700 dark:text-gray-300">{child.name}</span>
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                </div>

                {/* Create New Folder */}
                {onCreateFolder && (
                    <div className="border-t border-gray-200 pt-4 dark:border-zinc-700">
                        {isCreating ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    placeholder="폴더 이름"
                                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreateFolder();
                                        if (e.key === 'Escape') setIsCreating(false);
                                    }}
                                />
                                <button
                                    onClick={handleCreateFolder}
                                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                                >
                                    생성
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsCreating(true)}
                                className="flex w-full items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                            >
                                <Plus className="h-4 w-4" />
                                새 폴더 만들기
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
