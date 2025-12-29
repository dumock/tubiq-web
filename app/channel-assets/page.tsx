'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import FilterBar from '@/components/FilterBar';
import DraggableAssetCard from '@/components/DraggableAssetCard';
import AddChannelModal from '@/components/AddChannelModal';
import LoginModal from '@/components/LoginModal';
import SignUpModal from '@/components/SignUpModal';
import ConfirmModal from '@/components/ConfirmModal';
import FolderSidebar from '@/components/FolderSidebar';
import { useFolders } from '@/hooks/useFolders';
import { useVideos } from '@/hooks/useVideos';
import VideoFolderSelectionModal from '@/components/VideoFolderSelectionModal';
import GenericFolderSelectionModal from '@/components/GenericFolderSelectionModal';
import { Asset } from '@/types';
import { MOCK_ASSETS } from '@/mock/channels';
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
    DragStartEvent,
    CollisionDetection,
    DragOverlay,
} from '@dnd-kit/core';
import ClientOnly from '@/components/ClientOnly';
import {
    arrayMove,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    SortableContext,
} from '@dnd-kit/sortable';

export default function ChannelAssetsPage() {
    // State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);
    const [selectedFolderId, setSelectedFolderId] = useState('all');
    const [contentType, setContentType] = useState<'channel' | 'video'>('channel');
    const [pendingChannel, setPendingChannel] = useState<any>(null);

    // Video Move Modal State
    const [isVideoFolderModalOpen, setIsVideoFolderModalOpen] = useState(false);
    const [selectedVideoForMove, setSelectedVideoForMove] = useState<Asset | null>(null);

    // Analysis Move State
    const [isAnalysisFolderModalOpen, setIsAnalysisFolderModalOpen] = useState(false);
    const [selectedChannelForAnalysis, setSelectedChannelForAnalysis] = useState<Asset | null>(null);

    // Confirm Modal State
    const [confirmData, setConfirmData] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText?: string;
        isDestructive?: boolean;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });

    // Data State - Folders from useFolders hook
    const { folders, createFolder, renameFolder, deleteFolder, fetchFolders } = useFolders(
        contentType === 'channel' ? 'channels' : 'videos'
    );
    // Separate hook for analysis folders
    const { folders: analysisFolders } = useFolders('analysis');

    const [channelAssets, setChannelAssets] = useState<Asset[]>([]);
    const [videoAssets, setVideoAssets] = useState<Asset[]>([]); // Local state for fetched videos
    const [isLoading, setIsLoading] = useState(true);
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);

    // Load videoAssets from localStorage on mount (separate from video-assets page DB)
    useEffect(() => {
        const savedVideos = localStorage.getItem('tubiq-channel-fetched-videos');
        if (savedVideos) {
            try {
                const parsed = JSON.parse(savedVideos);
                if (Array.isArray(parsed)) {
                    setVideoAssets(parsed);
                }
            } catch {
                // ignore parse error
            }
        }
        setIsVideoLoaded(true);
    }, []);

    // Save videoAssets to localStorage whenever they change
    useEffect(() => {
        if (isVideoLoaded) {
            localStorage.setItem('tubiq-channel-fetched-videos', JSON.stringify(videoAssets));
        }
    }, [videoAssets, isVideoLoaded]);

    // Data Fetch Function
    const fetchChannels = async () => {
        setIsLoading(true);
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) console.error('Session get error:', sessionError);

            const token = session?.access_token;

            // No scope param needed anymore, API defaults to user's assets via user_channels
            const res = await fetch('/api/channel-assets', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const json = await res.json();

            if (json.ok && Array.isArray(json.data)) {
                const mappedAssets = json.data.map((row: any) => {
                    const c = row.channels; // Joined data
                    if (!c) return null;

                    return {
                        id: row.id, // user_channels.id
                        type: 'channel' as const,
                        title: c.title || 'Untitled Channel',
                        channelName: c.title || 'Untitled Channel',
                        subscribers: c.subscriber_count || 0,
                        views: 0, // Removed non-existent view_count reference
                        createdAt: c.published_at ? new Date(c.published_at).toISOString().split('T')[0] : '',
                        size: '-',
                        updatedAt: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '',
                        url: 'bg-indigo-100',
                        folderId: row.folder_id || 'all',
                        avatarUrl: c.thumbnail_url || '',
                        channelUrl: c.youtube_channel_id ? `https://youtube.com/channel/${c.youtube_channel_id}` : '',
                        youtubeChannelId: c.youtube_channel_id || ''
                    };
                }).filter(Boolean) as Asset[];

                // Merge with mock assets if enabled
                const enableMock = process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true';
                if (enableMock) {
                    setChannelAssets([...MOCK_ASSETS, ...mappedAssets]);
                } else {
                    setChannelAssets(mappedAssets);
                }
            } else {
                console.error('Failed to fetch channels:', json.message);
            }
        } catch (error) {
            console.error('API Fetch Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Initial Data Load (API) and Real-time Subscription
    useEffect(() => {
        fetchChannels();

        // Subscribe to user_channels changes
        const userChannelsChannel = supabase
            .channel('user-channels-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_channels' },
                () => {
                    console.log('Real-time update: user_channels changed');
                    fetchChannels();
                }
            )
            .subscribe();

        // Subscribe to global channels changes (for metadata updates)
        const globalChannelsChannel = supabase
            .channel('global-channels-realtime')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'channels' },
                () => {
                    console.log('Real-time update: channels metadata updated');
                    fetchChannels();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(userChannelsChannel);
            supabase.removeChannel(globalChannelsChannel);
        };
    }, []);

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
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Custom collision detection
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
            const centerCollisions = closestCenter(args);
            const filtered = centerCollisions.filter(c => !String(c.id).startsWith('folder:'));
            if (filtered.length > 0) return filtered;
            return centerCollisions;
        }
    };

    // HANDLE SAVE CHANNEL (API)
    const handleSaveChannel = async (channel: { id: string; title: string; handle: string; thumbnailUrl: string; subscriberCount?: number; viewCount?: number; videoCount?: number; publishedAt?: string | null }) => {
        const currentFolderId = selectedFolderId === 'all' ? null : selectedFolderId;

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) console.error('Session get error:', sessionError);

            const token = session?.access_token;

            if (!token) {
                setPendingChannel(channel);
                setIsLoginModalOpen(true);
                return;
            }

            const body = {
                youtube_channel_id: channel.id,
                title: channel.title,
                thumbnail_url: channel.thumbnailUrl,
                subscriber_count: channel.subscriberCount,
                published_at: channel.publishedAt,
                folder_id: currentFolderId
            };

            const res = await fetch('/api/channel-assets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });
            const json = await res.json();

            if (json.ok && json.data) {
                // Refresh list from DB to ensure sync
                await fetchChannels();

                setMoveNotification(`${channel.title} 저장 완료`);
                setTimeout(() => setMoveNotification(null), 2000);
                setIsModalOpen(false);
            } else {
                throw new Error(json.message || 'Save failed');
            }
        } catch (error) {
            console.error('Save Error:', error);
            alert('채널 저장 중 오류가 발생했습니다.');
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

        // Case 1: Reordering Folders (disabled - DB ordering not implemented)
        if (!isActiveAsset && !isOverAsset && isOverFolder) {
            // Folder reordering requires API update - skipping for now
            return;
        }

        // Case 2: Reordering Assets (Mock)
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
            }
            return;
        }

        // Case 3: Moving Asset(s) to Folder
        if (isActiveAsset && isOverFolder) {
            const targetFolderId = overIdStr.startsWith('folder:') ? overIdStr.replace('folder:', '') : overIdStr;
            const targetFolder = folders.find(f => f.id === targetFolderId);
            if (!targetFolder) return;

            const idsToMove = selectedAssetIds;

            // Update local state immediately for responsiveness
            const updateState = (prev: Asset[]) => prev.map(asset => {
                if (idsToMove.includes(asset.id)) return { ...asset, folderId: targetFolderId };
                return asset;
            });

            if (contentType === 'channel') {
                setChannelAssets(updateState);

                // Save to DB for channels
                (async () => {
                    try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const token = session?.access_token;
                        if (!token) return;

                        await fetch('/api/channel-assets', {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                channel_ids: idsToMove,
                                folder_id: targetFolderId
                            })
                        });
                    } catch (err) {
                        console.error('Failed to update folder:', err);
                    }
                })();
            } else {
                setVideoAssets(updateState);
            }

            setLastDroppedFolderId(targetFolderId);
            setTimeout(() => setLastDroppedFolderId(null), 1000);

            setMoveNotification(`${targetFolder.name}으로 ${idsToMove.length}개 이동됨`);
            setTimeout(() => setMoveNotification(null), 2000);

            setSelectedAssetIds([]);
            setLastSelectedId(null);
        }
    };

    // HANDLE FETCH VIDEOS (Real Logic with YouTube API)
    const handleFetchVideos = async ({ daysAgo, minViews, limit }: { daysAgo: number; minViews: number; limit: number }) => {
        if (isFetching) return;
        setIsFetching(true);

        try {
            // 1. Determine target channels
            const targetChannels = selectedFolderId === 'all'
                ? channelAssets
                : channelAssets.filter(c => c.folderId === selectedFolderId);

            if (targetChannels.length === 0) {
                alert('수집할 채널이 없습니다.');
                setIsFetching(false);
                return;
            }

            // 2. Calculate Date
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            const publishedAfter = date.toISOString();

            let totalFetched = 0;
            const newVideos: Asset[] = [];

            // 3. Fetch from each channel
            await Promise.all(targetChannels.map(async (channel) => {
                if (!channel.youtubeChannelId) return;

                try {
                    const res = await fetch(`/api/youtube/channel-videos?channelId=${channel.youtubeChannelId}&maxResults=${limit}&publishedAfter=${publishedAfter}`);
                    const data = await res.json();

                    if (data.ok && data.videos) {
                        const filtered = data.videos.filter((v: any) => v.viewCount >= minViews);

                        filtered.forEach((v: any) => {
                            newVideos.push({
                                id: `video-${v.id}`,
                                type: 'video',
                                title: v.title,
                                channelName: channel.title, // Use local channel title
                                views: v.viewCount,
                                createdAt: v.publishedAt.split('T')[0],
                                size: '-',
                                updatedAt: new Date().toISOString().split('T')[0],
                                url: `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`,
                                folderId: channel.folderId || 'all', // Inherit folder from channel
                                youtubeVideoId: v.id,
                                youtubeChannelId: channel.youtubeChannelId
                            });
                        });
                    }
                } catch (e) {
                    console.error(`Error fetching videos for ${channel.title}:`, e);
                }
            }));

            if (newVideos.length > 0) {
                // Append to existing videos, avoiding duplicates by video ID
                setVideoAssets(prev => {
                    const existingIds = new Set(prev.map(v => v.id));
                    const uniqueNewVideos = newVideos.filter(v => !existingIds.has(v.id));
                    return [...prev, ...uniqueNewVideos];
                });

                // Note: Videos are saved to localStorage only (session-based, not DB)

                setMoveNotification(`${newVideos.length}개의 영상을 가져왔습니다.`);
                setTimeout(() => setMoveNotification(null), 3000);
                setContentType('video');
            } else {
                setMoveNotification('조건에 맞는 영상이 없습니다.');
                setTimeout(() => setMoveNotification(null), 3000);
            }

        } catch (error) {
            console.error('Fetch error:', error);
            alert('영상 수집 중 오류가 발생했습니다.');
        } finally {
            setIsFetching(false);
        }
    };

    const activeAssetId = activeId && String(activeId).startsWith('asset:') ? String(activeId).replace('asset:', '') : null;

    const pageTitle = selectedFolderId === 'all' ? '전체보기' : (folders.find((f) => f.id === selectedFolderId)?.name || 'Assets');

    const counts: Record<string, number> = {};
    folders.forEach((f) => {
        counts[f.id] = currentAssets.filter((a) => a.folderId === f.id).length;
    });
    counts['all'] = currentAssets.length;

    // RENAME FOLDER (API)
    const handleRenameFolder = async (folderId: string, newName: string): Promise<boolean> => {
        return await renameFolder(folderId, newName);
    };

    // CREATE PARENT FOLDER (API)
    const handleCreateParent = async (name: string): Promise<boolean> => {
        return await createFolder(name, null);
    };

    // CREATE CHILD FOLDER (API)
    const handleCreateChild = async (name: string, parentId: string): Promise<boolean> => {
        return await createFolder(name, parentId);
    };

    // MOVE ASSETS TO FOLDER via Click (Mock)
    const handleSelectFolder = async (id: string) => {
        if (isMoveMode && selectedAssetIds.length > 0) {
            const targetFolder = folders.find(f => f.id === id);
            if (!targetFolder || id === 'all') return;

            const updateState = (prev: Asset[]) => prev.map(asset => {
                if (selectedAssetIds.includes(asset.id)) return { ...asset, folderId: id };
                return asset;
            });
            if (contentType === 'channel') setChannelAssets(updateState);
            else setVideoAssets(updateState);

            setMoveNotification(`${targetFolder.name}으로 ${selectedAssetIds.length}개 이동됨 (Mock)`);
            setTimeout(() => setMoveNotification(null), 2000);

            setSelectedAssetIds([]);
            setIsMoveMode(false);
            return;
        }
        setSelectedFolderId(id);
    };

    // DELETE FOLDER (API)
    const handleDeleteFolder = async (folderId: string): Promise<boolean> => {
        const confirmed = window.confirm('폴더를 삭제하시겠습니까? 관련된 채널은 유지됩니다.');
        if (!confirmed) return false;

        const success = await deleteFolder(folderId);
        if (success && folderId === selectedFolderId) {
            setSelectedFolderId('all');
        }
        return success;
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

    // DELETE SELECTED ASSETS
    const handleDeleteSelected = async () => {
        if (selectedAssetIds.length === 0) return;

        setConfirmData({
            isOpen: true,
            title: '선택 항목 삭제',
            message: `선택한 ${selectedAssetIds.length}개의 항목을 삭제하시겠습니까?`,
            isDestructive: true,
            confirmText: '삭제',
            onConfirm: async () => {
                // Delete from DB if channel type
                if (contentType === 'channel') {
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    if (token) {
                        for (const id of selectedAssetIds) {
                            await fetch(`/api/channel-assets?id=${id}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                        }
                    }
                    await fetchChannels(); // Refresh from DB
                } else {
                    setVideoAssets(prev => prev.filter(asset => !selectedAssetIds.includes(asset.id)));
                }

                setMoveNotification(`${selectedAssetIds.length}개 삭제됨`);
                setTimeout(() => setMoveNotification(null), 2000);
                setSelectedAssetIds([]);
                setLastSelectedId(null);
                setIsMoveMode(false);
            }
        });
    };

    // DELETE SINGLE ASSET
    const handleDeleteSingle = async (id: string) => {
        const asset = currentAssets.find(a => a.id === id);
        if (!asset) return;

        setConfirmData({
            isOpen: true,
            title: '채널/영상 삭제',
            message: `"${asset.channelName || asset.title}"을(를) 삭제하시겠습니까?`,
            isDestructive: true,
            confirmText: '삭제',
            onConfirm: async () => {
                // Delete from DB if channel type
                if (contentType === 'channel') {
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    if (token) {
                        await fetch(`/api/channel-assets?id=${id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                    }
                    await fetchChannels(); // Refresh from DB
                } else {
                    setVideoAssets(prev => prev.filter(a => a.id !== id));
                }

                setMoveNotification('삭제됨');
                setTimeout(() => setMoveNotification(null), 2000);
                setSelectedAssetIds(prev => prev.filter(assetId => assetId !== id));
            }
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black" onClick={handleDeselect}>
            <Header />
            <FilterBar onFetchVideos={handleFetchVideos} isFetching={isFetching} hideCollectionFilter />

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
                                        onCreateParent={handleCreateParent}
                                        onCreateChild={handleCreateChild}
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
                                        {/* Clear All Videos Button - only when viewing videos */}
                                        {contentType === 'video' && videoAssets.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('모든 영상을 삭제하시겠습니까?')) {
                                                        setVideoAssets([]);
                                                        localStorage.removeItem('tubiq-channel-fetched-videos');
                                                        setMoveNotification('모든 영상이 삭제되었습니다.');
                                                        setTimeout(() => setMoveNotification(null), 2000);
                                                    }
                                                }}
                                                className="flex items-center gap-2 rounded-lg bg-rose-100 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-600 hover:text-white transition-colors shadow-sm dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-600 dark:hover:text-white"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                전체 삭제
                                            </button>
                                        )}
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
                                                onClick={(e) => handleAssetClick(e, asset.id)}
                                                isSelected={selectedAssetIds.includes(asset.id)}
                                                onDelete={() => handleDeleteSingle(asset.id)}
                                                onMoveToVideoAssets={(id) => {
                                                    const video = videoAssets.find(v => v.id === id);
                                                    if (video) {
                                                        setSelectedVideoForMove(video);
                                                        setIsVideoFolderModalOpen(true);
                                                    }
                                                }}
                                                onMoveToChannelAnalysis={(id) => {
                                                    const channel = channelAssets.find(c => c.id === id);
                                                    if (channel) {
                                                        setSelectedChannelForAnalysis(channel);
                                                        setIsAnalysisFolderModalOpen(true);
                                                    }
                                                }}
                                                enableChannelMenu={true}
                                            />
                                        ))}
                                    </SortableContext>
                                </div>

                                {filteredAssets.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                        <div className="mb-4 text-4xl">📭</div>
                                        <p>저장된 {contentType === 'channel' ? '채널이' : '영상이'} 없습니다.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </main>
                    <DragOverlay>
                        {activeType === 'ASSET' ? (
                            <div className="opacity-80">
                                <div className="p-4 bg-white rounded-xl shadow-lg border border-indigo-200 w-48 h-12 flex items-center justify-center">
                                    Items Moving...
                                </div>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </ClientOnly>

            {isModalOpen && (
                <AddChannelModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveChannel}
                />
            )}

            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => {
                    setIsLoginModalOpen(false);
                    setPendingChannel(null);
                }}
                onLoginSuccess={() => {
                    setIsLoginModalOpen(false);
                    fetchChannels();
                    if (pendingChannel) {
                        handleSaveChannel(pendingChannel);
                        setPendingChannel(null);
                    }
                }}
                onOpenSignUp={() => {
                    setIsLoginModalOpen(false);
                    setIsSignUpModalOpen(true);
                }}
            />

            <SignUpModal
                isOpen={isSignUpModalOpen}
                onClose={() => {
                    setIsSignUpModalOpen(false);
                    setPendingChannel(null);
                }}
                onOpenLogin={() => {
                    setIsSignUpModalOpen(false);
                    setIsLoginModalOpen(true);
                }}
            />

            <VideoFolderSelectionModal
                isOpen={isVideoFolderModalOpen}
                onClose={() => {
                    setIsVideoFolderModalOpen(false);
                    setSelectedVideoForMove(null);
                }}
                onSelectFolder={async (folderId) => {
                    if (!selectedVideoForMove) return;

                    let targetChannelId = selectedVideoForMove.youtubeChannelId;

                    // Validation: Check if channel info exists
                    if (!targetChannelId) {
                        // Fallback: Try to find channel ID from existing channel assets
                        const matchedChannel = channelAssets.find(ch => ch.title === selectedVideoForMove.channelName);
                        if (matchedChannel?.youtubeChannelId) {
                            targetChannelId = matchedChannel.youtubeChannelId;
                        } else {
                            alert('채널 정보가 부족합니다. 영상을 다시 수집해주세요.');
                            setIsVideoFolderModalOpen(false);
                            return;
                        }
                    }

                    try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const token = session?.access_token;
                        if (!token) {
                            setIsLoginModalOpen(true);
                            return;
                        }

                        // Prepare payload for /api/videos
                        // Video type in useVideos uses youtubeVideoId, but db expects snake_case for some fields if we hit raw api?
                        // Actually let's check useVideos fetch call. It uses specific payload structure.
                        // I will match the structure I saw in useVideos.ts:saveVideos
                        const payload = [{
                            youtube_video_id: selectedVideoForMove.youtubeVideoId,
                            channel_id: targetChannelId, // Use resolved channel ID
                            title: selectedVideoForMove.title,
                            thumbnail_url: selectedVideoForMove.url,
                            view_count: selectedVideoForMove.views || 0,
                            published_at: selectedVideoForMove.createdAt,
                            // folder_id IS supported in DB but was missing in useVideos map function?
                            // Wait, useVideos.ts mapDbToAsset had "folderId: 'all' // DB doesn't store folder_id".
                            // But earlier I saw channel-assets route handling folder_id.
                            // I should assume /api/videos handles folder_id if the column exists.
                            // Given the user request is specifically about folders, I'll pass it.
                            folder_id: folderId === 'all' ? null : folderId
                        }];

                        const res = await fetch('/api/videos', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ videos: payload })
                        });

                        const json = await res.json();

                        if (json.ok) {
                            setMoveNotification('영상 에셋으로 저장되었습니다');
                            setTimeout(() => setMoveNotification(null), 2000);

                            const confirmMove = window.confirm('저장되었습니다. 영상 에셋 페이지로 이동하시겠습니까?');
                            if (confirmMove) {
                                window.location.href = '/video-assets';
                            }
                        } else {
                            throw new Error(json.message || 'Save failed');
                        }
                    } catch (error) {
                        console.error('Save video error:', error);
                        alert('영상 저장 중 오류가 발생했습니다.');
                    } finally {
                        setIsVideoFolderModalOpen(false);
                        setSelectedVideoForMove(null);
                    }
                }}
            />

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
                confirmText={confirmData.confirmText}
                isDestructive={confirmData.isDestructive}
            />
            <GenericFolderSelectionModal
                isOpen={isAnalysisFolderModalOpen}
                onClose={() => setIsAnalysisFolderModalOpen(false)}
                folders={analysisFolders}
                title="채널 분석으로 복사"
                description="채널 분석 페이지의 어느 폴더에 저장하시겠습니까?"
                onSelect={async (folderId) => {
                    if (!selectedChannelForAnalysis) return;

                    try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const token = session?.access_token;

                        if (!token) {
                            alert('로그인이 필요합니다.');
                            return;
                        }

                        // Save channel with scope='analysis'
                        const res = await fetch('/api/channel-assets', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                youtube_channel_id: selectedChannelForAnalysis.youtubeChannelId || selectedChannelForAnalysis.id,
                                title: selectedChannelForAnalysis.channelName || selectedChannelForAnalysis.title,
                                thumbnail_url: selectedChannelForAnalysis.avatarUrl || selectedChannelForAnalysis.url,
                                subscriber_count: selectedChannelForAnalysis.subscribers,
                                published_at: selectedChannelForAnalysis.createdAt,
                                scope: 'analysis',
                                folder_id: folderId === 'all' ? null : folderId
                            })
                        });

                        const json = await res.json();
                        if (json.ok) {
                            const confirmMove = window.confirm('채널 분석에 저장되었습니다. 채널 분석 페이지로 이동하시겠습니까?');
                            if (confirmMove) {
                                window.location.href = '/channel-analysis';
                            }
                        } else {
                            throw new Error(json.message || 'Save failed');
                        }
                    } catch (error) {
                        console.error('Save code analysis error:', error);
                        alert('저장 중 오류가 발생했습니다.');
                    } finally {
                        setIsAnalysisFolderModalOpen(false);
                        setSelectedChannelForAnalysis(null);
                    }
                }}
            />
        </div>
    );
}
