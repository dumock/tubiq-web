'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import AssetCard from '@/components/AssetCard';
import DraggableAssetCard from '@/components/DraggableAssetCard';
import FolderSidebar from '@/components/FolderSidebar';
import AddVideoModal from '@/components/AddVideoModal';
import ConfirmModal from '@/components/ConfirmModal';
import { useFolders } from '@/hooks/useFolders';
import { useVideos } from '@/hooks/useVideos';
import { useYouTubeApi } from '@/hooks/useYouTubeApi';
import { Asset } from '@/types';
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
    DragStartEvent,
    CollisionDetection,
    DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    SortableContext,
} from '@dnd-kit/sortable';
import ClientOnly from '@/components/ClientOnly';

export default function VideoAssetsPage() {
    // State
    const [selectedFolderId, setSelectedFolderId] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);

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

    // Data State - from hooks (scope='videos' for separate folders from channel-assets)
    const { fetchYouTube, config } = useYouTubeApi();
    const { folders, createFolder, renameFolder, deleteFolder } = useFolders('videos');
    const { videos: videoAssets, setVideos: setVideoAssets, saveVideos, deleteVideo, clearAllVideos, fetchVideos, updateVideoFolder } = useVideos();
    const [isLoading, setIsLoading] = useState(false);

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
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length >= 11) ? match[2].slice(0, 11) : null;
    };

    // SAVE VIDEO - fetch real video info from YouTube API
    // SAVE VIDEO - fetch real video info from YouTube API or save generic
    const handleSaveVideo = async (inputStr: string) => {
        // 1. Extract URL and Title from potential mixed text (Douyin/TikTok style)
        // Regex to find http/https URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urlMatch = inputStr.match(urlRegex);

        let url = inputStr.trim();
        let titleFromText = '';

        if (urlMatch && urlMatch.length > 0) {
            url = urlMatch[0]; // Use the first found URL
            // Remove the URL from the input string to get the title
            titleFromText = inputStr.replace(url, '').trim();
            // Optional: Clean up common prefixes like "8.97 ZzG:/" or "复制此链接..."
            // But usually keeping the text is safer. We can trim "复制此链接..." if needed.
            titleFromText = titleFromText
                .replace(/复制此链接，打开Dou音搜索，直接观看视频！/g, '')
                .replace(/^[0-9.]+\s+[A-Za-z0-9]+:\/\s+/, '') // Remove "8.97 ZzG:/" style prefix
                .trim();
        }

        const videoId = getYoutubeId(url);
        const currentFolderId = selectedFolderId === 'all' ? null : selectedFolderId;
        const nowStr = new Date().toISOString();

        // 2. YouTube Video (Logic remains similar)
        if (videoId) {
            try {
                // Fetch actual video info from YouTube API
                const res = await fetchYouTube(`/api/youtube/video-info?videoId=${videoId}`);
                const data = await res.json();

                if (!data.ok || !data.video) {
                    alert(data.message || '영상 정보를 가져올 수 없습니다.');
                    return;
                }

                const videoInfo = data.video;
                const newVideo: Asset = {
                    id: `video-${Date.now()}`,
                    type: 'video',
                    platform: 'youtube',
                    title: videoInfo.title,
                    size: '-',
                    createdAt: videoInfo.publishedAt?.split('T')[0] || nowStr.split('T')[0],
                    updatedAt: new Date().toLocaleDateString(),
                    url: videoInfo.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                    folderId: currentFolderId || 'all',
                    views: videoInfo.viewCount || 0,
                    channelName: videoInfo.channelTitle || 'Unknown Channel',
                    youtubeVideoId: videoId,
                    youtubeChannelId: videoInfo.channelId
                };

                // Save to DB
                await saveVideos([newVideo]);
                setVideoAssets(prev => [newVideo, ...prev]);
                setMoveNotification('영상(YouTube)이 저장되었습니다.');
                setTimeout(() => setMoveNotification(null), 2000);
                setIsModalOpen(false);
            } catch (error) {
                console.error('Error saving video:', error);
                alert('영상 저장 중 오류가 발생했습니다.');
            }
        }
        // 3. Non-YouTube Video (TikTok, Instagram, Xiaohongshu via TikHub API, or Douyin via Electron)
        else {
            try {
                // Infer platform
                let platform = 'web';
                if (url.includes('douyin')) platform = 'douyin';
                else if (url.includes('tiktok')) platform = 'tiktok';
                else if (url.includes('instagram')) platform = 'instagram';
                else if (url.includes('xiaohongshu') || url.includes('xhslink')) platform = 'xiaohongshu';

                let scrapedData: any = {};
                let usedTikHub = false;

                // TikTok, Instagram, Xiaohongshu: Use TikHub API
                if (platform === 'tiktok' || platform === 'instagram' || platform === 'xiaohongshu') {
                    console.log(`[Client] Fetching ${platform} video via TikHub API...`);

                    // Try Client-Side Fetch for Instagram first (to bypass server-side 401 issues)
                    if (platform === 'instagram') {
                        const tikHubKeys = config?.tikhub?.keys || [];
                        const activeKeyEntry = tikHubKeys.find(k => k.active);
                        const activeKey = activeKeyEntry?.key;

                        if (activeKey) {
                            console.log('[Client] Attempting Direct Instagram Fetch (V1)...');
                            try {
                                const tikHubApiUrl = `https://api.tikhub.io/api/v1/instagram/v1/fetch_post_by_url?post_url=${encodeURIComponent(url)}`;
                                const res = await fetch(tikHubApiUrl, {
                                    headers: {
                                        'Authorization': `Bearer ${activeKey}`,
                                        'Accept': 'application/json'
                                    }
                                });

                                if (res.ok) {
                                    const tikHubData = await res.json();
                                    const data = tikHubData?.data || tikHubData; // V1 structure

                                    // Parse V1 Data
                                    // V1 returns 'thumbnail_src', 'display_url'

                                    const v = data?.items?.[0] || data;
                                    if (v) {
                                        // Title Parsing (V1 often nests caption)
                                        let title = v.caption?.text || '';
                                        if (!title && v.edge_media_to_caption?.edges?.[0]?.node?.text) {
                                            title = v.edge_media_to_caption.edges[0].node.text;
                                        }

                                        // Thumbnail Parsing (Prioritize display_url as it's often the main image)
                                        const thumb = v.thumbnail_src || v.display_url || v.image_versions2?.candidates?.[0]?.url || v.thumbnail_url || '';

                                        scrapedData = {
                                            title: title.slice(0, 100) || 'Instagram Feed',
                                            thumbnail_url: thumb,
                                            channel_name: v.user?.username || v.owner?.username || 'Unknown',
                                            views: v.view_count || v.video_view_count || 0,
                                            date: new Date().toISOString(),
                                            url: url
                                        };

                                        if (v.taken_at_timestamp) {
                                            scrapedData.date = new Date(v.taken_at_timestamp * 1000).toISOString();
                                        } else if (v.taken_at) {
                                            scrapedData.date = new Date(v.taken_at * 1000).toISOString();
                                        }

                                        usedTikHub = true;
                                        console.log('[Client] Direct Instagram Fetch SUCCESS:', scrapedData);
                                    }
                                } else {
                                    console.warn('[Client] Direct Instagram Fetch Failed:', res.status);
                                }
                            } catch (err) {
                                console.error('[Client] Direct Instagram Fetch Error:', err);
                            }
                        }
                    }

                    // Try Client-Side Fetch for Xiaohongshu (V2)
                    if (platform === 'xiaohongshu') {
                        const tikHubKeys = config?.tikhub?.keys || [];
                        const activeKeyEntry = tikHubKeys.find(k => k.active);
                        const activeKey = activeKeyEntry?.key;

                        if (activeKey) {
                            console.log('[Client] Attempting Direct Xiaohongshu Fetch (V2)...');
                            // Use V2 as it provides exact stats (V3 is bucketed) and correct timestamps

                            try {
                                // Extract Note ID for V2
                                // URLs are like: https://www.xiaohongshu.com/discovery/item/69413e48000000001e038b46 or explored
                                const noteIdMatch = url.match(/explore\/([a-f0-9]+)/) || url.match(/discovery\/item\/([a-f0-9]+)/);
                                const noteId = noteIdMatch ? (noteIdMatch[1] || noteIdMatch[2]) : null;

                                if (noteId) {
                                    const tikHubApiUrl = `https://api.tikhub.io/api/v1/xiaohongshu/web_v2/fetch_feed_notes_v2?note_id=${noteId}`;
                                    const res = await fetch(tikHubApiUrl, {
                                        headers: {
                                            'Authorization': `Bearer ${activeKey}`,
                                            'Accept': 'application/json'
                                        }
                                    });

                                    if (res.ok) {
                                        const tikHubData = await res.json();
                                        const data = tikHubData?.data || tikHubData;

                                        // V2 structure: data.note_list is an array
                                        const v = data?.note_list?.[0];

                                        if (v) {
                                            // Date parsing: V2 'time' is seconds (e.g. 1765883464)
                                            let dateStr = new Date().toISOString();
                                            if (v.time) {
                                                // Convert seconds to milliseconds
                                                dateStr = new Date(v.time * 1000).toISOString();
                                            } else if (v.last_update_time) {
                                                dateStr = new Date(v.last_update_time * 1000).toISOString();
                                            }

                                            scrapedData = {
                                                title: v.title || v.desc || 'Xiaohongshu Note',
                                                thumbnail_url: v.images_list?.[0]?.url || v.images_list?.[0]?.original || '',
                                                channel_name: v.user?.nickname || 'Unknown',
                                                // V2 gives exact numbers for liked_count
                                                views: v.liked_count || 0,
                                                date: dateStr,
                                                url: url
                                            };

                                            usedTikHub = true;
                                            console.log('[Client] Direct Xiaohongshu Fetch (V2) SUCCESS:', scrapedData);
                                        }
                                    } else {
                                        console.warn('[Client] Direct Xiaohongshu V2 Fetch Failed:', res.status);
                                    }
                                } else {
                                    console.warn('[Client] Could not extract Note ID for Xiaohongshu V2 API. URL:', url);
                                }
                            } catch (err) {
                                console.error('[Client] Direct Xiaohongshu Fetch Error:', err);
                            }
                        }
                    }

                    // Fallback to Server Proxy if Client-Side failed
                    if (!usedTikHub) {
                        try {
                            const tikHubRes = await fetch(`/api/tikhub/resolve-video?url=${encodeURIComponent(url)}`);
                            const tikHubData = await tikHubRes.json();

                            if (tikHubData.ok && tikHubData.video) {
                                scrapedData = {
                                    title: tikHubData.video.title,
                                    thumbnail_url: tikHubData.video.thumbnailUrl,
                                    channel_name: tikHubData.video.authorName,
                                    views: tikHubData.video.viewCount,
                                    date: tikHubData.video.publishedAt,
                                    url: tikHubData.video.videoUrl || url
                                };
                                usedTikHub = true;
                                console.log('[Client] TikHub API (Server) success:', scrapedData);
                            } else {
                                console.warn('[Client] TikHub API (Server) failed:', tikHubData.message);
                            }
                        } catch (tikHubError) {
                            console.error('[Client] TikHub API (Server) error:', tikHubError);
                        }
                    }
                }

                // Douyin or fallback: Use Electron Client-side Scraping
                if (!usedTikHub && (window as any).electron?.scrapeMetadata) {
                    console.log('[Client] Scraping metadata via Electron...');
                    const scrapeRes = await (window as any).electron.scrapeMetadata(url);
                    console.log('[Client] raw scrapeRes:', scrapeRes);
                    if (scrapeRes && scrapeRes.success) {
                        scrapedData = scrapeRes;
                        console.log('[Client] Scrape success:', scrapedData);
                    }
                }

                // Parse Date safely
                const createdDate = scrapedData.date
                    ? scrapedData.date
                    : nowStr.split('T')[0];

                const newVideo: Asset = {
                    id: `video-${Date.now()}`,
                    type: 'video',
                    platform: platform,
                    title: scrapedData.title || titleFromText || `새 동영상 (${platform})`,
                    size: '-',
                    createdAt: createdDate.includes('-') ? createdDate.split('T')[0] : nowStr.split('T')[0],
                    updatedAt: new Date().toLocaleDateString(),
                    url: scrapedData.thumbnail_url || scrapedData.url || url,
                    folderId: currentFolderId || 'all',
                    views: scrapedData.views || 0,
                    channelName: scrapedData.channel_name || 'Unknown Source',
                    youtubeVideoId: `ext-${Date.now()}`,
                    youtubeChannelId: 'channel-ext',
                    memo: usedTikHub ? `TikHub API (${platform})` : '수동 추가된 링크'
                };

                const assetPayload = {
                    ...newVideo,
                    redirectUrl: scrapedData.url || url
                };

                await saveVideos([assetPayload]);

                setVideoAssets(prev => [newVideo, ...prev]);
                const platformName = platform === 'tiktok' ? 'TikTok' :
                    platform === 'instagram' ? 'Instagram' :
                        platform === 'xiaohongshu' ? '샤오홍슈' :
                            platform === 'douyin' ? 'Douyin' : '링크';
                setMoveNotification(`${platformName} 영상이 저장되었습니다.`);
                setTimeout(() => setMoveNotification(null), 2000);
                setIsModalOpen(false);

            } catch (error) {
                console.error('Error saving generic video:', error);
                alert('링크 저장 중 오류가 발생했습니다.');
            }
        }
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

        // Case 1: Reorder Folders (disabled - requires API)
        if (!isActiveAsset && !isOverAsset && isOverFolder) {
            // Folder reordering disabled
            return;
        }

        // Case 2: Reorder Assets (Mock)
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

        // Case 3: Move to Folder (DB + UI)
        if (isActiveAsset && isOverFolder) {
            const targetFolderId = overIdStr.startsWith('folder:') ? overIdStr.replace('folder:', '') : overIdStr;
            const targetFolder = folders.find(f => f.id === targetFolderId);
            if (!targetFolder) return;

            const idsToMove = selectedAssetIds;

            // Optimistic UI update
            setVideoAssets(prev => prev.map(asset => {
                if (idsToMove.includes(asset.id)) return { ...asset, folderId: targetFolderId };
                return asset;
            }));

            // Save to DB
            updateVideoFolder(idsToMove, targetFolderId).then(success => {
                if (success) {
                    setMoveNotification(`${targetFolder.name}으로 ${idsToMove.length}개 이동됨`);
                } else {
                    // Revert on failure
                    fetchVideos();
                    setMoveNotification('이동 실패');
                }
                setTimeout(() => setMoveNotification(null), 2000);
            });

            setLastDroppedFolderId(targetFolderId);
            setTimeout(() => setLastDroppedFolderId(null), 1000);
            setSelectedAssetIds([]);
            setLastSelectedId(null);
        }
    };

    const handleFetchVideos = async ({ daysAgo, minViews, limit }: { daysAgo: number; minViews: number; limit: number }) => {
        if (isFetching) return;
        setIsFetching(true);
        console.log('Fetching videos (Mock)...', { selectedFolderId, daysAgo, minViews, limit });
        setIsFetching(false);
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

    // RENAME FOLDER
    const handleRenameFolder = async (folderId: string, newName: string): Promise<boolean> => {
        return await renameFolder(folderId, newName);
    };

    // CREATE FOLDER - for parent folders
    const handleCreateParent = async (name: string): Promise<boolean> => {
        return await createFolder(name, null);
    };

    // CREATE FOLDER - for child folders
    const handleCreateChild = async (name: string, parentId: string): Promise<boolean> => {
        return await createFolder(name, parentId);
    };

    // MOVE ASSETS TO FOLDER via Click (DB + UI)
    const handleSelectFolder = async (id: string) => {
        if (isMoveMode && selectedAssetIds.length > 0) {
            const targetFolder = folders.find(f => f.id === id);
            if (!targetFolder || id === 'all') return;

            // Optimistic UI update
            setVideoAssets(prev => prev.map(asset => {
                if (selectedAssetIds.includes(asset.id)) return { ...asset, folderId: id };
                return asset;
            }));

            // Save to DB
            const success = await updateVideoFolder(selectedAssetIds, id);
            if (success) {
                setMoveNotification(`${targetFolder.name}으로 ${selectedAssetIds.length}개 이동됨`);
            } else {
                // Revert on failure
                fetchVideos();
                setMoveNotification('이동 실패');
            }
            setTimeout(() => setMoveNotification(null), 2000);

            setSelectedAssetIds([]);
            setIsMoveMode(false);
            return;
        }
        setSelectedFolderId(id);
    };

    // DELETE FOLDER
    const handleDeleteFolder = async (folderId: string): Promise<boolean> => {
        const result = await deleteFolder(folderId);
        if (result && folderId === selectedFolderId) {
            setSelectedFolderId('all');
        }
        return result;
    };

    // DELETE SELECTED (Mock)
    const handleDeleteSelected = async () => {
        if (selectedAssetIds.length === 0) return;

        setConfirmData({
            isOpen: true,
            title: '선택 항목 삭제',
            message: `선택한 ${selectedAssetIds.length}개의 에셋을 삭제하시겠습니까?`,
            isDestructive: true,
            confirmText: '삭제',
            onConfirm: async () => {
                // Delete from DB
                for (const id of selectedAssetIds) {
                    await deleteVideo(id);
                }
                setMoveNotification(`${selectedAssetIds.length}개 삭제됨`);
                setTimeout(() => setMoveNotification(null), 2000);
                setSelectedAssetIds([]);
                setLastSelectedId(null);
                setIsMoveMode(false);
            }
        });
    };

    // DELETE SINGLE
    const handleDeleteSingle = async (id: string) => {
        const asset = videoAssets.find(a => a.id === id);
        if (!asset) return;

        setConfirmData({
            isOpen: true,
            title: '영상 삭제',
            message: `"${asset.title}"을(를) 삭제하시겠습니까?`,
            isDestructive: true,
            confirmText: '삭제',
            onConfirm: async () => {
                await deleteVideo(id);
                setMoveNotification('삭제됨');
                setTimeout(() => setMoveNotification(null), 2000);
                setSelectedAssetIds(prev => prev.filter(assetId => assetId !== id));
            }
        });
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
            const channelId = asset.youtubeChannelId || (asset.id.startsWith('channel-') ? asset.id.split('-')[1] : asset.id);
            targetUrl = asset.channelUrl || `https://youtube.com/channel/${channelId}`;
        } else if (asset.type === 'video') {
            // Check for explicit redirectUrl (video content) or non-YouTube platforms
            if (asset.redirectUrl || (asset.platform && asset.platform !== 'youtube' && asset.platform !== 'web')) {
                // Prioritize redirectUrl, fallback to asset.url if it looks like a content link (but asset.url is often thumbnail)
                // Actually, if platform is not youtube, we should trust redirectUrl primarily.
                targetUrl = asset.redirectUrl || asset.url || '';
            } else {
                const videoId = asset.youtubeVideoId ||
                    (asset.id.startsWith('added-') || asset.id.startsWith('video-')
                        ? asset.id.split('-')[1]
                        : asset.id);

                // Validate if it looks like a real YouTube ID (not timestamp-based ID)
                if (videoId && !videoId.startsWith('ext-') && !videoId.startsWith('video-')) {
                    targetUrl = `https://youtube.com/watch?v=${videoId}`;
                } else {
                    // Fallback to raw URL if available
                    targetUrl = asset.redirectUrl || asset.url || '';
                }
            }
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
                                        onCreateParent={handleCreateParent}
                                        onCreateChild={handleCreateChild}
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
                                                onDelete={() => handleDeleteSingle(asset.id)}
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

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
                confirmText={confirmData.confirmText}
                isDestructive={confirmData.isDestructive}
            />
        </div>
    );
}
