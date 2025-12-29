'use client';

import { useState, useEffect } from 'react';
import Header from '@/src/components/Header';
import FilterBar from '@/src/components/FilterBar';
import AssetCard from '@/src/components/AssetCard';
import DraggableAssetCard from '@/src/components/DraggableAssetCard';
import FolderSidebar from '@/src/components/FolderSidebar';
import AddVideoModal from '@/src/components/AddVideoModal';
import { mockAssets, Asset } from '@/src/mock/assets';
import { mockFolders as initialFolders, Folder } from '@/src/mock/folders';
import { Plus, Video as VideoIcon, Trash2 } from 'lucide-react';
import {
    DndContext,
    pointerWithin,
    rectIntersection,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    CollisionDetection,
} from '@dnd-kit/core';
import ClientOnly from '@/src/components/ClientOnly';
import {
    arrayMove,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    SortableContext,
} from '@dnd-kit/sortable';
import { mockVideos } from '@/src/mock/videos';

export default function VideoAssetsPage() {
    // State
    const [selectedFolderId, setSelectedFolderId] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Data State (lifted for DnD)
    const [folders, setFolders] = useState<Folder[]>(initialFolders);
    const [videoAssets, setVideoAssets] = useState<Asset[]>([]);

    // DnD State
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<'FOLDER' | 'ASSET' | null>(null);
    const [lastDroppedFolderId, setLastDroppedFolderId] = useState<string | null>(null);
    const [moveNotification, setMoveNotification] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState(false);

    // Multi-Selection State
    const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
    const [isMoveMode, setIsMoveMode] = useState(false);

    // Filtered Assets
    const filteredAssets = videoAssets.filter(asset =>
        selectedFolderId === 'all' || asset.folderId === selectedFolderId
    );

    // Esc Key to Deselect
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedAssetIds([]);
                setLastSelectedId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Helper: Extract YouTube ID
    const getYoutubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const handleSaveVideo = (url: string) => {
        const videoId = getYoutubeId(url);
        if (!videoId) {
            alert('올바른 유튜브 링크가 아닙니다.');
            return;
        }

        const newVideo: Asset = {
            id: `added-${Date.now()}`,
            type: 'video',
            title: `New Video Asset ${videoAssets.length + 1}`,
            size: '-',
            updatedAt: new Date().toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, ''),
            url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            folderId: selectedFolderId === 'all' ? 'favorites' : selectedFolderId,
            views: Math.floor(Math.random() * 1000000), // Mock views
        };

        setVideoAssets(prev => [newVideo, ...prev]);
        setMoveNotification('영상이 저장되었습니다.');
        setTimeout(() => setMoveNotification(null), 2000);
        setIsModalOpen(false);
    };

    // Selection Logic
    const handleAssetClick = (e: React.MouseEvent | React.TouchEvent, id: string) => {
        const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isMultiSelect = 'metaKey' in e ? (isMac ? e.metaKey : e.ctrlKey) : false;
        const isShiftSelect = 'shiftKey' in e ? e.shiftKey : false;

        if (isMultiSelect) {
            setSelectedAssetIds(prev =>
                prev.includes(id)
                    ? prev.filter(currId => currId !== id)
                    : [...prev, id]
            );
            setLastSelectedId(id);
        } else if (isShiftSelect && lastSelectedId) {
            const currentIds = filteredAssets.map(a => a.id);
            const startIdx = currentIds.indexOf(lastSelectedId);
            const endIdx = currentIds.indexOf(id);

            if (startIdx !== -1 && endIdx !== -1) {
                const rangeIds = currentIds.slice(
                    Math.min(startIdx, endIdx),
                    Math.max(startIdx, endIdx) + 1
                );
                setSelectedAssetIds(prev => Array.from(new Set([...prev, ...rangeIds])));
            }
        } else {
            setSelectedAssetIds([id]);
            setLastSelectedId(id);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // 5px 이상 이동해야 드래그 시작 (클릭과 구분)
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const customCollisionDetection: CollisionDetection = (args) => {
        const activeIdStr = String(args.active.id);
        const isDraggingAsset = activeIdStr.startsWith('asset:') || args.active.data.current?.type === 'ASSET';

        if (isDraggingAsset) {
            const pointerCollisions = pointerWithin(args);
            const folderCollisions = pointerCollisions.filter(
                collision => String(collision.id).startsWith('folder:')
            );
            if (folderCollisions.length > 0) return folderCollisions;

            const rectCollisions = rectIntersection(args);
            if (rectCollisions.length > 0) return rectCollisions;

            return closestCenter(args);
        } else {
            // Dragging a FOLDER (reordering folders)
            const centerCollisions = closestCenter(args);
            const filtered = centerCollisions.filter(c => !String(c.id).startsWith('folder:'));
            return filtered.length > 0 ? filtered : centerCollisions;
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
        const activeIdStr = String(active.id);
        if (activeIdStr.startsWith('asset:') || active.data.current?.type === 'ASSET') {
            setActiveType('ASSET');
            const actualId = activeIdStr.replace('asset:', '');
            if (!selectedAssetIds.includes(actualId)) {
                setSelectedAssetIds([actualId]);
                setLastSelectedId(actualId);
            }
        } else {
            setActiveType('FOLDER');
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveType(null);
        if (!over) return;

        const activeIdStr = String(active.id);
        const overIdStr = String(over.id);
        const isActiveAsset = activeIdStr.startsWith('asset:');
        const isOverAsset = overIdStr.startsWith('asset:');
        const isOverFolder = overIdStr.startsWith('folder:') ||
            over.data.current?.type === 'FOLDER' ||
            folders.some(f => f.id === overIdStr);

        if (!isActiveAsset && !isOverAsset && isOverFolder) {
            if (active.id !== over.id) {
                setFolders((items) => {
                    const oldIndex = items.findIndex((item) => item.id === active.id);
                    const newIndex = items.findIndex((item) => item.id === over.id);
                    if (oldIndex === -1 || newIndex === -1) return items;
                    return arrayMove(items, oldIndex, newIndex);
                });
            }
            return;
        }

        if (isActiveAsset && isOverAsset) {
            if (active.id !== over.id) {
                setVideoAssets((items) => {
                    const oldId = activeIdStr.replace('asset:', '');
                    const newId = overIdStr.replace('asset:', '');
                    const oldIndex = items.findIndex((item) => item.id === oldId);
                    const newIndex = items.findIndex((item) => item.id === newId);
                    if (oldIndex === -1 || newIndex === -1) return items;
                    return arrayMove(items, oldIndex, newIndex);
                });
            }
            return;
        }

        if (isActiveAsset && isOverFolder) {
            const targetFolderId = overIdStr.startsWith('folder:') ? overIdStr.replace('folder:', '') : overIdStr;
            const targetFolder = folders.find(f => f.id === targetFolderId);
            if (!targetFolder) return;

            const idsToMove = selectedAssetIds;
            setVideoAssets(prev => prev.map(asset => {
                if (idsToMove.includes(asset.id)) return { ...asset, folderId: targetFolderId };
                return asset;
            }));

            setLastDroppedFolderId(targetFolderId);
            setTimeout(() => setLastDroppedFolderId(null), 1000);
            setMoveNotification(`${targetFolder.name}으로 ${idsToMove.length}개 이동됨`);
            setTimeout(() => setMoveNotification(null), 2000);
            setSelectedAssetIds([]);
            setLastSelectedId(null);
        }
    };

    const handleFetchVideos = ({ daysAgo, minViews, limit }: { daysAgo: number; minViews: number; limit: number }) => {
        if (isFetching) return;
        setIsFetching(true);

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

        const newAssetCandidates: Asset[] = mockVideos
            .filter((video) => {
                const parts = video.publishedAt.split('.');
                if (parts.length < 3) return false;
                const videoDate = new Date(
                    parseInt(parts[0]),
                    parseInt(parts[1]) - 1,
                    parseInt(parts[2])
                );
                return videoDate >= cutoffDate && video.views >= minViews;
            })
            .map((video) => ({
                id: video.id,
                type: 'video',
                title: video.title,
                size: '-',
                updatedAt: video.publishedAt,
                url: video.thumbnailUrl,
                folderId: selectedFolderId === 'all' ? 'favorites' : selectedFolderId,
                views: video.views,
                channelName: video.channelName,
            }));

        const limitedCandidates = newAssetCandidates.slice(0, limit);

        setTimeout(() => {
            if (limitedCandidates.length === 0) {
                setIsFetching(false);
                return;
            }

            let index = 0;
            const intervalId = setInterval(() => {
                const candidate = limitedCandidates[index];
                setVideoAssets((prev) => {
                    const exists = prev.some(a => a.id === candidate.id);
                    if (exists) return prev;
                    return [...prev, candidate];
                });

                index++;
                if (index >= limitedCandidates.length) {
                    clearInterval(intervalId);
                    setIsFetching(false);
                }
            }, 100);
        }, 600);
    };

    const activeAssetId = activeId && String(activeId).startsWith('asset:') ? String(activeId).replace('asset:', '') : null;
    const activeAsset = activeAssetId ? videoAssets.find(a => a.id === activeAssetId) : null;
    const activeFolder = activeId && !String(activeId).startsWith('asset:') ? folders.find(f => f.id === activeId) : null;

    const pageTitle = selectedFolderId === 'all' ? '전체보기' : (folders.find((f) => f.id === selectedFolderId)?.name || 'Videos');

    const counts: Record<string, number> = {};
    folders.forEach((f) => {
        counts[f.id] = videoAssets.filter((a) => a.folderId === f.id).length;
    });
    counts['all'] = videoAssets.length;

    const handleRenameFolder = (folderId: string, newName: string) => {
        setFolders((items) =>
            items.map((f) => (f.id === folderId ? { ...f, name: newName } : f))
        );
    };

    const handleCreateFolder = (newFolder: Folder) => {
        setFolders((current) => [...current, newFolder]);
    };

    const handleSelectFolder = (id: string) => {
        if (isMoveMode && selectedAssetIds.length > 0) {
            const targetFolder = folders.find(f => f.id === id);
            if (!targetFolder || id === 'all') return;

            setVideoAssets(prev => prev.map(asset => {
                if (selectedAssetIds.includes(asset.id)) return { ...asset, folderId: id };
                return asset;
            }));

            setMoveNotification(`${targetFolder.name}으로 ${selectedAssetIds.length}개 이동됨`);
            setTimeout(() => setMoveNotification(null), 2000);
            setSelectedAssetIds([]);
            setIsMoveMode(false);
            return;
        }
        setSelectedFolderId(id);
    };

    const handleDeleteFolder = (folderId: string) => {
        setFolders((prev) => {
            const folderToDelete = prev.find(f => f.id === folderId);
            if (!folderToDelete) return prev;
            const idsToDelete = [folderId];
            if (folderToDelete.parentId === null) {
                const childIds = prev.filter(f => f.parentId === folderId).map(f => f.id);
                idsToDelete.push(...childIds);
            }
            if (idsToDelete.includes(selectedFolderId)) {
                setSelectedFolderId('all');
            }
            return prev.filter(f => !idsToDelete.includes(f.id));
        });
    };

    const handleDeleteSelected = () => {
        if (selectedAssetIds.length === 0) return;
        if (confirm(`${selectedAssetIds.length}개의 에셋을 삭제하시겠습니까?`)) {
            setVideoAssets(prev => prev.filter(asset => !selectedAssetIds.includes(asset.id)));
            setMoveNotification(`${selectedAssetIds.length}개 삭제됨`);
            setTimeout(() => setMoveNotification(null), 2000);
            setSelectedAssetIds([]);
            setLastSelectedId(null);
            setIsMoveMode(false);
        }
    };

    const handleDeselect = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const isCardChild = target.closest('[data-asset-card="true"]');
        if (!isCardChild) {
            setSelectedAssetIds([]);
            setLastSelectedId(null);
            setIsMoveMode(false);
        }
    };

    const handleDoubleClick = (asset: Asset) => {
        let targetUrl = '';
        if (asset.type === 'channel') {
            targetUrl = asset.channelUrl || `https://youtube.com/channel/${asset.id}`;
        } else if (asset.type === 'video') {
            const videoId = asset.id.startsWith('added-') ? asset.id.split('-')[1] : asset.id;
            targetUrl = `https://youtube.com/watch?v=${videoId}`;
        }
        if (targetUrl) {
            window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black" onClick={handleDeselect}>
            <Header />
            <FilterBar onFetchVideos={handleFetchVideos} isFetching={isFetching} />


            <ClientOnly>
                <DndContext
                    sensors={sensors}
                    collisionDetection={customCollisionDetection}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                        <div className="flex flex-col lg:flex-row gap-6">
                            <div className="w-full lg:w-[300px] flex-none overflow-visible">
                                <div className="sticky top-24 overflow-visible">
                                    <FolderSidebar
                                        folders={folders}
                                        selectedFolderId={selectedFolderId}
                                        onSelect={handleSelectFolder}
                                        onRename={handleRenameFolder}
                                        onDelete={handleDeleteFolder}
                                        onCreateFolder={handleCreateFolder}
                                        lastDroppedFolderId={lastDroppedFolderId}
                                        counts={counts}
                                        activeType={activeType}
                                    />
                                </div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100/50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                                            <VideoIcon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                {pageTitle} <span className="text-gray-500 font-normal">({filteredAssets.length})</span>
                                            </h2>
                                            {moveNotification && (
                                                <span className="text-sm font-medium text-indigo-600 animate-fade-in-out bg-indigo-50 px-2 py-0.5 rounded-full dark:bg-indigo-900/30 dark:text-indigo-400">
                                                    {moveNotification}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {selectedAssetIds.length > 0 && (
                                            <button
                                                onClick={handleDeleteSelected}
                                                className="group flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-rose-600 shadow-sm ring-1 ring-inset ring-rose-200 hover:bg-rose-600 hover:text-white hover:ring-rose-600 transition-all duration-200 active:scale-95 dark:bg-zinc-900 dark:text-rose-400 dark:ring-rose-500/30 dark:hover:bg-rose-500 dark:hover:text-white"
                                            >
                                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-50 group-hover:bg-rose-500 transition-colors dark:bg-rose-900/40">
                                                    <Trash2 className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
                                                </div>
                                                <span className="tabular-nums">{selectedAssetIds.length}개 삭제</span>
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setIsModalOpen(true)}
                                            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
                                        >
                                            <Plus className="h-4 w-4" />
                                            영상 저장
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                                    <SortableContext items={filteredAssets.map(a => `asset:${a.id}`)} strategy={rectSortingStrategy}>
                                        {filteredAssets.map((asset) => (
                                            <DraggableAssetCard
                                                key={asset.id}
                                                asset={asset}
                                                isSelected={selectedAssetIds.includes(asset.id)}
                                                onClick={handleAssetClick}
                                                onDoubleClick={() => handleDoubleClick(asset)}
                                            />
                                        ))}
                                    </SortableContext>

                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="group relative flex h-full min-h-[220px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:bg-zinc-900 transition-colors"
                                    >
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-zinc-800 shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                            <Plus className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                                        </div>
                                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">새로 추가</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </main>

                    <DragOverlay dropAnimation={null}>
                        {activeFolder ? (
                            <div className="pointer-events-none opacity-90 scale-95 shadow-lg rounded-lg bg-white px-3 py-2 border border-gray-200 dark:bg-zinc-800 dark:border-zinc-700">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{activeFolder.name}</span>
                            </div>
                        ) : null}
                        {activeAsset ? (
                            <div className="pointer-events-none relative">
                                <div className="opacity-80 scale-[0.85] shadow-xl rounded-2xl rotate-2 bg-white border border-gray-200 overflow-hidden dark:bg-zinc-800 dark:border-zinc-700">
                                    <AssetCard asset={activeAsset} variant="overlay" />
                                </div>
                                {selectedAssetIds.length > 1 && (
                                    <div className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-lg ring-2 ring-white">
                                        {selectedAssetIds.length}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </ClientOnly>

            <AddVideoModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveVideo}
            />
        </div>
    );
}
