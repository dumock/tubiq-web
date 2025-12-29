import { useState, useMemo } from 'react';
import { X, Folder, Search, Check } from 'lucide-react';
import { Folder as FolderType } from '@/types';

interface GenericFolderSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    folders: FolderType[];
    onSelect: (folderId: string) => void;
    title: string;
    description: string;
}

export default function GenericFolderSelectionModal({
    isOpen,
    onClose,
    folders,
    onSelect,
    title,
    description
}: GenericFolderSelectionModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const filteredFolders = useMemo(() => {
        return folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [folders, searchQuery]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            {title}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {description}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b border-gray-50 dark:border-zinc-800/50 bg-gray-50/50 dark:bg-zinc-900/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="폴더 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 placeholder-gray-400"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Folder List */}
                <div className="max-h-[320px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-zinc-700">
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
                            <span className="font-medium">전체보기 (기본)</span>
                        </div>
                        {selectedId === 'all' && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>

                    {filteredFolders.map(folder => (
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
                                <span className="font-medium">{folder.name}</span>
                            </div>
                            {selectedId === folder.id && <Check className="w-4 h-4 text-indigo-600" />}
                        </button>
                    ))}

                    {filteredFolders.length === 0 && (
                        <div className="py-8 text-center text-gray-400 text-sm">
                            검색 결과가 없습니다
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
                        onClick={() => selectedId && onSelect(selectedId)}
                        className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                    >
                        이동하기
                    </button>
                </div>
            </div>
        </div>
    );
}
