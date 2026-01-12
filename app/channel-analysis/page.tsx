'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import MetricCard from '@/components/MetricCard';
// AudienceChart removed - demographics not available via public API
import GrowthChart from '@/components/GrowthChart';
import FolderSidebar from '@/components/FolderSidebar';
import DraggableAssetCard from '@/components/DraggableAssetCard';
import ClientOnly from '@/components/ClientOnly';
import SimilarChannels from '@/components/SimilarChannels';
import SubscriberChartModal from '@/components/SubscriberChartModal';
import { Users, Eye, PlaySquare, TrendingUp, ChevronLeft, BarChart3, Plus, Trash2 } from 'lucide-react';
import AddChannelModal from '@/components/AddChannelModal';
import { Asset, Folder } from '@/types';
import { supabase } from '@/lib/supabase';
import { useFolders } from '@/hooks/useFolders';
import { useYouTubeApi } from '@/hooks/useYouTubeApi';
import AssetCard from '@/components/AssetCard';
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
    DragOverlay
} from '@dnd-kit/core';
import {
    arrayMove,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    SortableContext
} from '@dnd-kit/sortable';

export default function ChannelAnalysisPage() {
    // Navigation & Data State
    const [selectedFolderId, setSelectedFolderId] = useState('all');
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

    // Real Data Hooks
    const { fetchYouTube } = useYouTubeApi();
    const { folders, createFolder, renameFolder, deleteFolder } = useFolders('analysis');
    const [channels, setChannels] = useState<Asset[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [dailyStats, setDailyStats] = useState<{ date: string; view_count: number; subscriber_count: number; video_count: number }[]>([]);

    // Fetch Channels from DB
    const fetchChannels = async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (token) {
                const res = await fetchYouTube('/api/channel-assets?scope=analysis');
                const json = await res.json();
                if (json.ok && Array.isArray(json.data)) {
                    const mappedChannels = json.data.map((row: any) => {
                        const c = row.channels;
                        if (!c) return null;

                        return {
                            id: row.id, // user_channels.id
                            type: 'channel' as const,
                            title: c.title || 'Untitled Channel',
                            channelName: c.title || 'Untitled Channel',
                            subscribers: c.subscriber_count || 0,
                            views: 0,
                            videoCount: 0,
                            createdAt: c.published_at ? new Date(c.published_at).toISOString().split('T')[0] : '-',
                            size: '-',
                            updatedAt: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '-',
                            url: 'bg-indigo-100',
                            folderId: row.folder_id || 'all',
                            avatarUrl: c.thumbnail_url || '',
                            channelUrl: c.youtube_channel_id ? `https://youtube.com/channel/${c.youtube_channel_id}` : '',
                            youtubeChannelId: c.youtube_channel_id || ''
                        };
                    }).filter(Boolean) as Asset[];
                    setChannels(mappedChannels);
                }
            }
        } catch (error) {
            console.error('Failed to fetch channels:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch daily stats for active channel
    const fetchDailyStats = async (channelId: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            // Find the internal channel_id from channels table
            const channel = channels.find(c => c.id === channelId);
            if (!channel) return;

            const res = await fetch(`/api/channel-stats?channelId=${channelId}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            const json = await res.json();
            if (json.ok && Array.isArray(json.data)) {
                setDailyStats(json.data);
            }
        } catch (error) {
            console.error('Failed to fetch daily stats:', error);
        }
    };

    useEffect(() => {
        fetchChannels();
    }, []);

    useEffect(() => {
        if (selectedChannelId) {
            fetchDailyStats(selectedChannelId);
        } else {
            setDailyStats([]);
        }
    }, [selectedChannelId, channels]);

    // DnD State
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<'FOLDER' | 'ASSET' | null>(null);
    const [lastDroppedFolderId, setLastDroppedFolderId] = useState<string | null>(null);
    const [moveNotification, setMoveNotification] = useState<string | null>(null);

    // Selection State
    const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
    const [isMoveMode, setIsMoveMode] = useState(false);

    // Derived State
    const filteredChannels = channels.filter(c =>
        selectedFolderId === 'all' || c.folderId === selectedFolderId
    );
    const activeChannel = selectedChannelId ? channels.find(c => c.id === selectedChannelId) : null;

    const handleSelectFolder = (id: string) => {
        if (isMoveMode && selectedAssetIds.length > 0) {
            const targetFolder = folders.find(f => f.id === id);
            if (!targetFolder || id === 'all') return;

            setChannels(prev => prev.map(asset => {
                if (selectedAssetIds.includes(asset.id)) return { ...asset, folderId: id };
                return asset;
            }));

            setMoveNotification(`${targetFolder.name}으로 ${selectedAssetIds.length}개 이동됨 (Mock)`);
            setTimeout(() => setMoveNotification(null), 2000);
            setSelectedAssetIds([]);
            setLastSelectedId(null);
            setIsMoveMode(false);
            setSelectedChannelId(null);
            return;
        }
        setSelectedFolderId(id);
        setSelectedChannelId(null);
        setSelectedAssetIds([]);
    };

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
            const currentIds = filteredChannels.map(a => a.id);
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

        // Case 1: Reordering Folders (Mock)
        if (!isActiveAsset && !isOverAsset && isOverFolder) {
            if (active.id !== over.id) {
                const oldIndex = folders.findIndex((item) => item.id === active.id);
                const newIndex = folders.findIndex((item) => item.id === over.id);
                if (oldIndex === -1 || newIndex === -1) return;

                // const newOrder = arrayMove(folders, oldIndex, newIndex);
                // setFolders(newOrder);
                console.log('Folder reordering not yet supported in DB');
            }
            return;
        }

        // Case 2: Reordering Assets (Mock)
        if (isActiveAsset && isOverAsset) {
            if (active.id !== over.id) {
                setChannels((items) => {
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

        // Case 3: Moving to Folder (Mock)
        if (isActiveAsset && isOverFolder) {
            const targetFolderId = overIdStr.startsWith('folder:') ? overIdStr.replace('folder:', '') : overIdStr;
            const targetFolder = folders.find(f => f.id === targetFolderId);
            if (!targetFolder) return;

            const idsToMove = selectedAssetIds;

            setChannels(prev => prev.map(asset => {
                if (idsToMove.includes(asset.id)) return { ...asset, folderId: targetFolderId };
                return asset;
            }));

            setMoveNotification(`${targetFolder.name}으로 ${idsToMove.length}개 이동됨 (Mock)`);
            setTimeout(() => setMoveNotification(null), 2000);

            setSelectedAssetIds([]);
            setLastSelectedId(null);
        }
    };

    const handleDeselect = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-asset-card="true"]')) {
            setSelectedAssetIds([]);
            setLastSelectedId(null);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedAssetIds.length === 0) return;
        if (confirm(`${selectedAssetIds.length}개의 채널을 삭제하시겠습니까?`)) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                if (!token) return;

                await Promise.all(selectedAssetIds.map(id =>
                    fetchYouTube(`/api/channel-assets?id=${id}`, {
                        method: 'DELETE'
                    })
                ));

                await fetchChannels();
                setMoveNotification(`${selectedAssetIds.length}개 삭제됨`);
                setTimeout(() => setMoveNotification(null), 2000);
                setSelectedAssetIds([]);
                setLastSelectedId(null);
            } catch (error) {
                console.error('Delete failed:', error);
                alert('삭제 중 오류가 발생했습니다.');
            }
        }
    };

    const handleDeleteSingle = async (id: string) => {
        const channel = channels.find(c => c.id === id);
        if (!channel) return;

        if (confirm(`"${channel.channelName || channel.title}"을(를) 삭제하시겠습니까?`)) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                if (!token) return;

                await fetchYouTube(`/api/channel-assets?id=${id}`, {
                    method: 'DELETE'
                });

                await fetchChannels();
                setMoveNotification('삭제됨');
                setTimeout(() => setMoveNotification(null), 2000);
                setSelectedAssetIds(prev => prev.filter(assetId => assetId !== id));
            } catch (error) {
                console.error('Delete failed:', error);
                alert('삭제 중 오류가 발생했습니다.');
            }
        }
    };

    const handleSaveChannel = async (channel: { id: string; title: string; handle: string; thumbnailUrl: string; subscriberCount?: number; viewCount?: number; videoCount?: number; publishedAt?: string | null }) => {
        const currentFolderId = selectedFolderId === 'all' ? null : selectedFolderId;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                alert('로그인이 필요합니다.');
                return;
            }

            const body = {
                youtube_channel_id: channel.id,
                title: channel.title,
                thumbnail_url: channel.thumbnailUrl,
                subscriber_count: channel.subscriberCount,
                published_at: channel.publishedAt,
                folder_id: currentFolderId,
                scope: 'analysis'
            };

            const res = await fetchYouTube('/api/channel-assets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            const json = await res.json();

            if (json.ok && json.data) {
                await fetchChannels(); // Refresh list
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

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black" onClick={handleDeselect}>
            <Header />
            <FilterBar onFetchVideos={(cond) => console.log('Fetch analysis for (Mock):', cond)} fetchLabel="채널 가져오기" />

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
                                        onRename={renameFolder}
                                        onDelete={deleteFolder}
                                        onCreateParent={(name) => createFolder(name, null)}
                                        onCreateChild={(name, parentId) => createFolder(name, parentId)}
                                        counts={Object.fromEntries(folders.map(f => [f.id, channels.filter(c => c.folderId === f.id).length]))}
                                        activeType={activeType}
                                    />
                                </div>
                            </div>

                            {/* Right Content */}
                            <div className="flex-1 min-w-0">
                                {selectedChannelId ? (
                                    /* 1. Channel Analysis Dashboard */
                                    <div className="space-y-6">
                                        {/* Back Button & Header */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => setSelectedChannelId(null)}
                                                    className="p-2 transition-colors hover:bg-gray-100 rounded-lg dark:hover:bg-zinc-800"
                                                >
                                                    <ChevronLeft className="h-5 w-5 text-gray-500" />
                                                </button>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100 ring-2 ring-white shadow-sm">
                                                        {activeChannel?.avatarUrl ? (
                                                            <img src={activeChannel.avatarUrl} alt="" className="h-full w-full object-cover" />
                                                        ) : (
                                                            <div className="flex h-full w-full items-center justify-center bg-indigo-50 text-indigo-500 font-bold">
                                                                {activeChannel?.channelName?.[0]}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{activeChannel?.channelName}</h2>
                                                        <p className="text-sm text-gray-500">채널 분석 리포트</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold dark:bg-indigo-900/30 dark:text-indigo-400">
                                                <BarChart3 className="h-3.5 w-3.5" />
                                                실시간 분석 중
                                            </div>
                                        </div>

                                        <SubscriberChartModal isOpen={isSubModalOpen} onClose={() => setIsSubModalOpen(false)} />

                                        {/* Metric Grid */}
                                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                            <MetricCard
                                                title="총 구독자 수"
                                                value={activeChannel?.subscribers !== undefined ? (activeChannel.subscribers >= 1000000 ? `${(activeChannel.subscribers / 1000000).toFixed(1)}M` : `${(activeChannel.subscribers / 1000).toFixed(1)}K`) : "0"}
                                                change={12.5}
                                                icon={Users}
                                                onClick={() => setIsSubModalOpen(true)}
                                            />
                                            <MetricCard
                                                title="총 조회수"
                                                value={dailyStats[0]?.view_count ? (dailyStats[0].view_count >= 1000000 ? `${(dailyStats[0].view_count / 1000000).toFixed(1)}M` : `${(dailyStats[0].view_count / 1000).toFixed(1)}K`) : "-"}
                                                change={dailyStats.length >= 2 ? Number(((dailyStats[0]?.view_count - dailyStats[1]?.view_count) / (dailyStats[1]?.view_count || 1) * 100).toFixed(1)) : 0}
                                                icon={Eye}
                                            />
                                            <MetricCard
                                                title="활성 동영상"
                                                value={dailyStats[0]?.video_count?.toString() || "-"}
                                                change={dailyStats.length >= 2 ? (dailyStats[0]?.video_count - dailyStats[1]?.video_count) : 0}
                                                icon={PlaySquare}
                                            />
                                            <MetricCard
                                                title="일일 조회수"
                                                value={dailyStats.length >= 2 ? ((dailyStats[0]?.view_count - dailyStats[1]?.view_count) >= 1000 ? `${((dailyStats[0]?.view_count - dailyStats[1]?.view_count) / 1000).toFixed(1)}K` : (dailyStats[0]?.view_count - dailyStats[1]?.view_count).toString()) : "-"}
                                                change={0}
                                                icon={TrendingUp}
                                            />
                                        </div>

                                        {/* Charts Section - Similar Channels Only (Demographics removed) */}
                                        <div className="grid gap-6 lg:grid-cols-1">
                                            <SimilarChannels channelId={selectedChannelId || undefined} />
                                        </div>

                                        {/* Growth Chart & Daily Table */}
                                        <div className="space-y-6">
                                            <GrowthChart />

                                            {/* Daily Stats Table */}
                                            <div className="rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm text-left">
                                                        <thead>
                                                            <tr className="bg-gray-50/50 border-b border-gray-100 dark:bg-zinc-800/50 dark:border-zinc-800">
                                                                <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">날짜</th>
                                                                <th className="px-6 py-3 font-semibold text-gray-900 text-right dark:text-white">조회수</th>
                                                                <th className="px-6 py-3 font-semibold text-gray-900 text-right dark:text-white">누적 조회수</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                                                            {/* Summary Rows */}
                                                            <tr className="bg-gray-50/30 dark:bg-zinc-800/20 font-bold">
                                                                <td className="px-6 py-3 text-gray-900 dark:text-white text-base">합계</td>
                                                                <td className="px-6 py-3 text-indigo-600 text-right text-base dark:text-indigo-400">
                                                                    {dailyStats.length >= 2 ? (dailyStats[0].view_count - dailyStats[dailyStats.length - 1].view_count).toLocaleString() : '-'}
                                                                </td>
                                                                <td className="px-6 py-3 text-gray-400 text-right">-</td>
                                                            </tr>
                                                            <tr className="bg-gray-50/10 dark:bg-zinc-800/10 italic">
                                                                <td className="px-6 py-3 text-gray-500">평균</td>
                                                                <td className="px-6 py-3 text-gray-600 text-right dark:text-gray-400">
                                                                    {dailyStats.length >= 2 ? Math.floor((dailyStats[0].view_count - dailyStats[dailyStats.length - 1].view_count) / dailyStats.length).toLocaleString() : '-'}
                                                                </td>
                                                                <td className="px-6 py-3 text-gray-400 text-right">-</td>
                                                            </tr>

                                                            {/* Data Rows from channel_daily_stats */}
                                                            {dailyStats.map((stat, i) => {
                                                                const dailyViews = i < dailyStats.length - 1 ? stat.view_count - dailyStats[i + 1].view_count : 0;
                                                                return (
                                                                    <tr key={stat.date} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                                        <td className="px-6 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                                                                            {stat.date.replace(/-/g, '.')}
                                                                        </td>
                                                                        <td className="px-6 py-3 text-gray-900 text-right dark:text-gray-100 font-medium">
                                                                            {dailyViews.toLocaleString()}
                                                                        </td>
                                                                        <td className="px-6 py-3 text-gray-500 text-right dark:text-gray-500">
                                                                            {stat.view_count.toLocaleString()}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* 2. Channel Selection Grid */
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                                                    {folders.find(f => f.id === selectedFolderId)?.name || '전체'} 채널 <span className="text-gray-400 font-normal">({filteredChannels.length})</span>
                                                </h2>
                                                {moveNotification && (
                                                    <span className="text-sm font-medium text-indigo-600 animate-fade-in-out bg-indigo-50 px-2 py-0.5 rounded-full dark:bg-indigo-900/30 dark:text-indigo-400">
                                                        {moveNotification}
                                                    </span>
                                                )}
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

                                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                                            <SortableContext items={filteredChannels.map(c => `asset:${c.id}`)} strategy={rectSortingStrategy}>
                                                {filteredChannels.map((channel) => (
                                                    <DraggableAssetCard
                                                        key={channel.id}
                                                        asset={channel}
                                                        isSelected={selectedAssetIds.includes(channel.id)}
                                                        onClick={handleAssetClick}
                                                        onDoubleClick={() => setSelectedChannelId(channel.id)}
                                                        onDelete={() => handleDeleteSingle(channel.id)}
                                                    />
                                                ))}
                                            </SortableContext>

                                            {/* Add New Card - Identical to Video Assets */}
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
                                )}
                            </div>
                        </div>
                    </main>
                    <DragOverlay dropAnimation={null}>
                        {activeType === 'FOLDER' && activeId ? (
                            <div className="pointer-events-none opacity-90 scale-95 shadow-lg rounded-lg bg-white px-3 py-2 border border-gray-200 dark:bg-zinc-800 dark:border-zinc-700">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                    {folders.find(f => f.id === activeId)?.name}
                                </span>
                            </div>
                        ) : null}
                        {activeType === 'ASSET' && activeId ? (
                            <div className="pointer-events-none relative">
                                <div className="opacity-80 scale-[0.85] shadow-xl rounded-2xl rotate-2 bg-white border border-gray-200 overflow-hidden dark:bg-zinc-800 dark:border-zinc-700">
                                    <AssetCard asset={channels.find(c => c.id === activeId.replace('asset:', ''))!} variant="overlay" />
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
        </div >
    );
}
