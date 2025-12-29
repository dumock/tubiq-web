'use client';

import { useState, useEffect } from 'react';
import Header from '@/src/components/Header';
import FilterBar from '@/src/components/FilterBar';
import AssetCard from '@/src/components/AssetCard';
import DraggableAssetCard from '@/src/components/DraggableAssetCard';
import AddChannelModal from '@/src/components/AddChannelModal';
import FolderSidebar from '@/src/components/FolderSidebar';
import { mockAssets, Asset } from '@/src/mock/assets';
import { mockFolders as initialFolders, Folder } from '@/src/mock/folders';
import { Plus, Trash2 } from 'lucide-react';
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

export default function ChannelAssetsPage() {
    // State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedFolderId, setSelectedFolderId] = useState('all');
    const [contentType, setContentType] = useState<'channel' | 'video'>('channel');

    // Data State (lifted for DnD)
    const [folders, setFolders] = useState<Folder[]>(initialFolders);
    const [channelAssets, setChannelAssets] = useState<Asset[]>(mockAssets);
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

    // Derived State for filtering
    const currentAssets = contentType === 'channel' ? channelAssets : videoAssets;
    const filteredAssets = currentAssets.filter(asset =>
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

    // Selection Logic
    const handleAssetClick = (e: React.MouseEvent | React.TouchEvent, id: string) => {
        // Stop bubbling if it's a drag handle click (handled by grip icon listeners)
        // But here we want the card click.

        const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isMultiSelect = 'metaKey' in e ? (isMac ? e.metaKey : e.ctrlKey) : false;
        const isShiftSelect = 'shiftKey' in e ? e.shiftKey : false;

        if (isMultiSelect) {
            // Toggle
            setSelectedAssetIds(prev =>
                prev.includes(id)
                    ? prev.filter(currId => currId !== id)
                    : [...prev, id]
            );
            setLastSelectedId(id);
        } else if (isShiftSelect && lastSelectedId) {
            // Range
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
            // Single
            setSelectedAssetIds([id]);
            setLastSelectedId(id);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Custom collision detection: handle assets and folders differently
    const customCollisionDetection: CollisionDetection = (args) => {
        const activeIdStr = String(args.active.id);
        const isDraggingAsset = activeIdStr.startsWith('asset:') || args.active.data.current?.type === 'ASSET';

        if (isDraggingAsset) {
            // Priority 1: Pointer within folder droppables (for moving assets)
            const pointerCollisions = pointerWithin(args);
            const folderCollisions = pointerCollisions.filter(
                collision => String(collision.id).startsWith('folder:')
            );
            if (folderCollisions.length > 0) return folderCollisions;

            // Priority 2: Grid reordering
            const rectCollisions = rectIntersection(args);
            if (rectCollisions.length > 0) return rectCollisions;

            return closestCenter(args);
        } else {
            // Dragging a FOLDER (reordering folders)
            // Skip 'folder:' prefixed IDs to ensure we detect sortable IDs (raw ID)
            const centerCollisions = closestCenter(args);
            const filtered = centerCollisions.filter(c => !String(c.id).startsWith('folder:'));

            // If we found raw folder IDs, return them
            if (filtered.length > 0) return filtered;

            return centerCollisions;
        }
    };

    const handleSaveChannel = (input: string) => {
        console.log('Saving channel:', input);
        alert(`채널이 저장되었습니다: ${input}`);
        setIsModalOpen(false);
    };

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);

        // Determine type based on ID prefix or data type
        const activeIdStr = String(active.id);
        if (activeIdStr.startsWith('asset:') || active.data.current?.type === 'ASSET') {
            setActiveType('ASSET');

            // Auto-select the dragged item if not selected
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

        // Check if over is a folder (either pure ID or prefixed)
        const isOverFolder = overIdStr.startsWith('folder:') ||
            over.data.current?.type === 'FOLDER' ||
            folders.some(f => f.id === overIdStr);

        // Case 1: Reordering Folders (Both are pure IDs/Folders)
        if (!isActiveAsset && !isOverAsset && isOverFolder) {
            if (active.id !== over.id) {
                setFolders((items) => {
                    const oldIndex = items.findIndex((item) => item.id === active.id);
                    const newIndex = items.findIndex((item) => item.id === over.id);
                    if (oldIndex === -1 || newIndex === -1) return items;
                    const newOrder = arrayMove(items, oldIndex, newIndex);
                    console.log("reorder folders", ['all', ...newOrder.filter(f => f.id !== 'all').map(f => f.id)]);
                    return newOrder;
                });
            }
            return;
        }

        // Case 2: Reordering Assets (Grid Sort)
        if (isActiveAsset && isOverAsset) {
            if (active.id !== over.id) {
                const updateState = contentType === 'channel' ? setChannelAssets : setVideoAssets;
                updateState((items) => {
                    const oldId = activeIdStr.replace('asset:', '');
                    const newId = overIdStr.replace('asset:', '');
                    const oldIndex = items.findIndex((item) => item.id === oldId);
                    const newIndex = items.findIndex((item) => item.id === newId);
                    if (oldIndex === -1 || newIndex === -1) return items;
                    return arrayMove(items, oldIndex, newIndex);
                });
                console.log("reorder assets", { from: active.id, to: over.id });
            }
            return;
        }

        // Case 3: Moving Asset(s) to Folder
        if (isActiveAsset && isOverFolder) {
            const targetFolderId = overIdStr.startsWith('folder:') ? overIdStr.replace('folder:', '') : overIdStr;

            const targetFolder = folders.find(f => f.id === targetFolderId);
            if (!targetFolder) return;

            const idsToMove = selectedAssetIds;
            console.log("move multiple", { ids: idsToMove, to: targetFolderId });

            // Update state for moved assets
            const updateState = (prev: Asset[]) => prev.map(asset => {
                if (idsToMove.includes(asset.id)) return { ...asset, folderId: targetFolderId };
                return asset;
            });

            setChannelAssets(updateState);
            setVideoAssets(updateState);

            // Trigger success effect
            setLastDroppedFolderId(targetFolderId);
            setTimeout(() => setLastDroppedFolderId(null), 1000);

            // Trigger Notification
            setMoveNotification(`${targetFolder.name}으로 ${idsToMove.length}개 이동됨`);
            setTimeout(() => setMoveNotification(null), 2000);

            // Clear selection after move
            setSelectedAssetIds([]);
            setLastSelectedId(null);
        }
    };

    const handleFetchVideos = ({ daysAgo, minViews, limit }: { daysAgo: number; minViews: number; limit: number }) => {
        if (isFetching) return;
        setIsFetching(true);
        console.log('fetch videos', { folderId: selectedFolderId, daysAgo, minViews });

        // Calculate cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

        // Filter videos
        const newAssetCandidates: Asset[] = mockVideos
            .filter((video) => {
                // Parse publishedAt "YYYY. MM. DD"
                const parts = video.publishedAt.split('.');
                if (parts.length < 3) return false;
                const videoDate = new Date(
                    parseInt(parts[0]),
                    parseInt(parts[1]) - 1, // Month is 0-indexed
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
            }));

        // Limit to max 12
        const limitedCandidates = newAssetCandidates.slice(0, limit);

        // Initial Delay (Simulate Network)
        setTimeout(() => {
            if (limitedCandidates.length === 0) {
                setIsFetching(false);
                return;
            }

            // Switch to video view to show animation
            setContentType('video');

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
            }, 100); // Add one every 100ms
        }, 600);
    };

    const activeAssetId = activeId && String(activeId).startsWith('asset:') ? String(activeId).replace('asset:', '') : null;
    const activeAsset = activeAssetId ? currentAssets.find(a => a.id === activeAssetId) : null;
    const activeFolder = activeId && !String(activeId).startsWith('asset:') ? folders.find(f => f.id === activeId) : null;

    const pageTitle = selectedFolderId === 'all' ? '전체보기' : (folders.find((f) => f.id === selectedFolderId)?.name || 'Assets');

    const counts: Record<string, number> = {};
    folders.forEach((f) => {
        counts[f.id] = currentAssets.filter((a) => a.folderId === f.id).length;
    });
    counts['all'] = currentAssets.length;

    const handleRenameFolder = (folderId: string, newName: string) => {
        setFolders((items) =>
            items.map((f) => (f.id === folderId ? { ...f, name: newName } : f))
        );
        console.log("rename folder", { id: folderId, name: newName });
    };

    const handleCreateFolder = (newFolder: Folder) => {
        setFolders((current) => [...current, newFolder]);
        console.log("create folder", newFolder);
    };

    const handleSelectFolder = (id: string) => {
        if (isMoveMode && selectedAssetIds.length > 0) {
            // Execute move
            const targetFolder = folders.find(f => f.id === id);
            if (!targetFolder || id === 'all') return;

            const updateState = (prev: Asset[]) => prev.map(asset => {
                if (selectedAssetIds.includes(asset.id)) return { ...asset, folderId: id };
                return asset;
            });

            setChannelAssets(updateState);
            setVideoAssets(updateState);

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
            // Find if it's a parent
            const folderToDelete = prev.find(f => f.id === folderId);
            if (!folderToDelete) return prev;

            // Collect IDs to delete (folder itself + children if parent)
            const idsToDelete = [folderId];
            if (folderToDelete.parentId === null) {
                const childIds = prev.filter(f => f.parentId === folderId).map(f => f.id);
                idsToDelete.push(...childIds);
            }

            // Adjust selection if current folder is being deleted
            if (idsToDelete.includes(selectedFolderId)) {
                setSelectedFolderId('all');
            }

            console.log("delete folder", { id: folderId });
            return prev.filter(f => !idsToDelete.includes(f.id));
        });
    };

    const handleDeselect = (e: React.MouseEvent) => {
        // Clear selection if clicking outside a card
        const target = e.target as HTMLElement;
        const isCardChild = target.closest('[data-asset-card="true"]');

        if (!isCardChild) {
            setSelectedAssetIds([]);
            setLastSelectedId(null);
            setIsMoveMode(false);
        }
    };

    const handleDeleteSelected = () => {
        if (selectedAssetIds.length === 0) return;
        if (confirm(`${selectedAssetIds.length}개의 에셋을 삭제하시겠습니까?`)) {
            const updateState = (prev: Asset[]) => prev.filter(asset => !selectedAssetIds.includes(asset.id));
            setChannelAssets(updateState);
            setVideoAssets(updateState);
            setMoveNotification(`${selectedAssetIds.length}개 삭제됨`);
            setTimeout(() => setMoveNotification(null), 2000);
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
                            {/* Left Sidebar */}
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

                            {/* Right Content */}
                            <div className="flex-1 min-w-0">
                                {/* Page Header Action */}
                                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                {pageTitle} <span className="text-gray-500 font-normal">({filteredAssets.length})</span>
                                            </h2>
                                            {moveNotification && (
                                                <span className="text-sm font-medium text-indigo-600 animate-fade-in-out bg-indigo-50 px-2 py-0.5 rounded-full dark:bg-indigo-900/30 dark:text-indigo-400">
                                                    {moveNotification}
                                                </span>
                                            )}
                                        </div>
                                        {/* Content Type Toggle */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setContentType('channel')}
                                                className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors border ${contentType === 'channel'
                                                    ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-zinc-900 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-800'
                                                    }`}
                                            >
                                                채널
                                            </button>
                                            <button
                                                onClick={() => setContentType('video')}
                                                className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors border ${contentType === 'video'
                                                    ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-zinc-900 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-800'
                                                    }`}
                                            >
                                                영상
                                            </button>
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
                                            채널 저장
                                        </button>
                                    </div>
                                </div>

                                {/* Asset Grid */}
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

                                    {/* Add New Placeholder */}
                                    <button className="group relative flex h-full min-h-[220px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:bg-zinc-900 transition-colors">
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


            <AddChannelModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveChannel}
            />
        </div>
    );
}
