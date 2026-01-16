import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Grid, List as ListIcon, RefreshCw, Film, Filter, X, HardDrive, Folder, CornerUpLeft, Trash2, CheckCircle2, UploadCloud } from 'lucide-react';
import { Asset } from '@/types';
import { YouTubeLogo } from '@/components/icons/YouTubeLogo';
import { supabase } from '@/lib/supabase';

interface QDriveSidebarProps {
    onDragStart: (e: React.DragEvent, asset: Asset) => void;
    onClose?: () => void;
}

// Global URL cache (persists across re-renders and tab switches)
const urlCache = new Map<string, { url: string; expires: number }>();
const CACHE_DURATION = 55 * 60 * 1000; // 55 minutes (signed URLs valid for 1 hour)

export default function QDriveSidebar({ onDragStart, onClose }: QDriveSidebarProps) {
    const [activeTab, setActiveTab] = useState<'qdrive' | 'youtube' | 'storage'>('storage');
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Storage State
    const [currentPath, setCurrentPath] = useState<string[]>([]);
    const [storageItems, setStorageItems] = useState<any[]>([]);
    const [storageUrls, setStorageUrls] = useState<Map<string, string>>(new Map());
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // Marquee Selection State
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const startPosRef = useRef<{ x: number; y: number } | null>(null);
    const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    // Hardcoded Quota: 1GB (Supabase Free Tier default)
    const STORAGE_QUOTA = 1 * 1024 * 1024 * 1024;

    const fetchAssets = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/videos');
            const json = await res.json();
            if (json.ok) {
                const mapped: Asset[] = json.data.map((v: any) => ({
                    id: v.id,
                    type: 'video',
                    title: v.title,
                    url: v.url,
                    thumbnailUrl: v.thumbnail_url,
                    createdAt: v.created_at || v.collected_at,
                    duration: v.duration || '00:00',
                    platform: v.platform || 'youtube'
                }));
                setAssets(mapped);
            }
        } catch (error) {
            console.error('Failed to fetch Q Drive assets:', error);
        } finally {
            setLoading(false);
        }
    };

    // Helper functions for file type detection
    const isVideoFile = useCallback((name: string, mime?: string) => {
        if (mime?.startsWith('video/')) return true;
        return /\.(mp4|mov|webm|avi|mkv|m4v|3gp|wmv|flv|mts|ts|qt)$/i.test(name);
    }, []);

    const isImageFile = useCallback((name: string, mime?: string) => {
        if (mime?.startsWith('image/')) return true;
        return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|heic)$/i.test(name);
    }, []);

    // Batch fetch signed URLs for all media files
    const fetchStorageItems = useCallback(async () => {
        setLoading(true);
        setSelectedItems(new Set());
        try {
            const path = currentPath.join('/');
            const { data, error } = await supabase
                .storage
                .from('videos')
                .list(path, {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'name', order: 'asc' },
                });

            if (error) {
                console.error('Error fetching storage:', error);
                return;
            }

            const items = data || [];
            setStorageItems(items);

            // Batch generate signed URLs for media files
            const now = Date.now();
            const urlMap = new Map<string, string>();
            const urlPromises: Promise<void>[] = [];

            for (const item of items) {
                if (item.metadata) { // Not a folder
                    const fullPath = [...currentPath, item.name].join('/');
                    const isMedia = isVideoFile(item.name, item.metadata?.mimetype) ||
                                   isImageFile(item.name, item.metadata?.mimetype);

                    if (isMedia) {
                        // Check cache first
                        const cached = urlCache.get(fullPath);
                        if (cached && cached.expires > now) {
                            urlMap.set(item.name, cached.url);
                        } else {
                            // Queue URL generation
                            urlPromises.push(
                                (async () => {
                                    const { data: urlData } = await supabase.storage
                                        .from('videos')
                                        .createSignedUrl(fullPath, 3600);
                                    if (urlData?.signedUrl) {
                                        urlCache.set(fullPath, {
                                            url: urlData.signedUrl,
                                            expires: now + CACHE_DURATION
                                        });
                                        urlMap.set(item.name, urlData.signedUrl);
                                    }
                                })()
                            );
                        }
                    }
                }
            }

            // Wait for all URLs (parallel)
            if (urlPromises.length > 0) {
                await Promise.all(urlPromises);
            }

            setStorageUrls(new Map(urlMap));
        } catch (e) {
            console.error('Storage fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, [currentPath, isVideoFile, isImageFile]);

    useEffect(() => {
        if (activeTab === 'qdrive') {
            fetchAssets();
        } else if (activeTab === 'storage') {
            fetchStorageItems();
        }
    }, [activeTab, currentPath, fetchStorageItems]);

    const handleFolderClick = (folderName: string) => {
        setCurrentPath([...currentPath, folderName]);
    };

    const handleBack = () => {
        setCurrentPath(currentPath.slice(0, -1));
    };

    const getPublicUrl = (name: string) => {
        const fullPath = [...currentPath, name].join('/');
        const { data } = supabase.storage.from('videos').getPublicUrl(fullPath);
        return data.publicUrl;
    };

    const handleDeleteSelected = async () => {
        if (selectedItems.size === 0) return;
        if (!confirm(`${selectedItems.size}개의 항목을 삭제하시겠습니까?`)) return;

        setLoading(true);
        try {
            const pathsToDelete = Array.from(selectedItems).map(name => {
                const fullPath = [...currentPath, name].join('/');
                return fullPath;
            });

            const { error } = await supabase.storage.from('videos').remove(pathsToDelete);

            if (error) {
                alert('삭제 실패: ' + error.message);
            } else {
                // Clear cache for deleted items
                pathsToDelete.forEach(p => urlCache.delete(p));
                fetchStorageItems();
            }
        } catch (e) {
            console.error('Delete error:', e);
        } finally {
            setLoading(false);
        }
    };

    // --- Upload Logic ---
    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFileUpload(files[0]);
        }
        e.target.value = '';
    };

    const handleFileUpload = async (file: File) => {
        if (!file) return;

        setUploading(true);
        try {
            const fileName = file.name;
            const fullPath = [...currentPath, fileName].join('/');

            const { data, error } = await supabase.storage
                .from('videos')
                .upload(fullPath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                if (error.message.includes('The resource already exists')) {
                    alert('이미 같은 이름의 파일이 존재합니다.');
                } else if (error.message.includes('The object exceeded the maximum allowed size')) {
                    alert('파일 크기가 제한(현재 50MB)을 초과했습니다.');
                } else {
                    alert('업로드 실패: ' + error.message);
                }
            } else {
                fetchStorageItems();
            }
        } catch (e: any) {
            console.error('Upload error:', e);
            alert('업로드 중 오류가 발생했습니다.');
        } finally {
            setUploading(false);
        }
    };

    // --- Drop Logic for Upload ---
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (activeTab !== 'storage') return;

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            if (files.length > 1) {
                if (!confirm(`Total ${files.length} files. Upload all?`)) return;
            }

            setUploading(true);
            try {
                for (let i = 0; i < files.length; i++) {
                    await handleFileUpload(files[i]);
                }
            } finally {
                setUploading(false);
            }
        }
    };

    // --- Marquee Selection Logic ---
    const handleMouseDown = (e: React.MouseEvent) => {
        if (activeTab !== 'storage') return;
        if ((e.target as HTMLElement).closest('button')) return;

        if (!e.ctrlKey && !e.shiftKey) {
            if (!(e.target as HTMLElement).closest('.storage-item')) {
                setSelectedItems(new Set());
            }
        }

        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        startPosRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top + container.scrollTop
        };
        setIsSelecting(true);
        setSelectionBox(null);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isSelecting || !startPosRef.current || !containerRef.current) return;

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top + container.scrollTop;

        const startX = startPosRef.current.x;
        const startY = startPosRef.current.y;

        const newBox = {
            x: Math.min(startX, currentX),
            y: Math.min(startY, currentY),
            w: Math.abs(currentX - startX),
            h: Math.abs(currentY - startY)
        };

        setSelectionBox(newBox);

        const items = container.querySelectorAll('.storage-item');
        const newSelected = new Set(e.ctrlKey ? selectedItems : []);

        items.forEach((item) => {
            const itemRect = (item as HTMLElement).getBoundingClientRect();
            const itemRelative = {
                left: itemRect.left - rect.left,
                top: itemRect.top - rect.top + container.scrollTop,
                width: itemRect.width,
                height: itemRect.height
            };

            if (
                newBox.x < itemRelative.left + itemRelative.width &&
                newBox.x + newBox.w > itemRelative.left &&
                newBox.y < itemRelative.top + itemRelative.height &&
                newBox.y + newBox.h > itemRelative.top
            ) {
                const name = (item as HTMLElement).dataset.name;
                if (name) newSelected.add(name);
            }
        });
        setSelectedItems(newSelected);

        const scrollThreshold = 50;
        const scrollSpeed = 10;
        const relativeY = e.clientY - rect.top;

        if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;

        if (relativeY < scrollThreshold) {
            scrollIntervalRef.current = setInterval(() => {
                if (container) container.scrollTop -= scrollSpeed;
            }, 16);
        } else if (relativeY > rect.height - scrollThreshold) {
            scrollIntervalRef.current = setInterval(() => {
                if (container) container.scrollTop += scrollSpeed;
            }, 16);
        }
    };

    const handleMouseUp = () => {
        setIsSelecting(false);
        setSelectionBox(null);
        startPosRef.current = null;
        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }
    };

    const toggleSelection = (name: string, multi: boolean) => {
        const newSet = new Set(multi ? selectedItems : []);
        if (newSet.has(name)) {
            newSet.delete(name);
        } else {
            newSet.add(name);
        }
        setSelectedItems(newSet);
    };

    const filteredAssets = assets.filter(a =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredStorageItems = storageItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <aside className="flex h-full w-full flex-col bg-white/80 backdrop-blur-xl dark:bg-zinc-900/80">
            {/* Header / Tabs */}
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 space-y-4 flex-none z-10 bg-white/50 dark:bg-zinc-900/50">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="text-indigo-600">Q</span> Drive
                    </h2>
                    <div className="flex items-center gap-1">
                        {selectedItems.size > 0 && activeTab === 'storage' && (
                            <button
                                onClick={handleDeleteSelected}
                                className="p-1.5 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 dark:bg-rose-900/50 dark:text-rose-300"
                                title="선택 항목 삭제"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
                        {activeTab === 'storage' && (
                            <button
                                onClick={handleUploadClick}
                                disabled={uploading}
                                className={`p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-indigo-600 dark:hover:bg-zinc-800 ${uploading ? 'animate-pulse text-indigo-400' : ''}`}
                                title="파일 업로드"
                            >
                                <UploadCloud className="h-4 w-4" />
                            </button>
                        )}
                        <button
                            onClick={activeTab === 'storage' ? fetchStorageItems : fetchAssets}
                            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 dark:hover:bg-zinc-800"
                            title="새로고침"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-rose-500 dark:hover:bg-zinc-800"
                                title="닫기"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-gray-100 rounded-lg dark:bg-zinc-800">
                    <button
                        onClick={() => setActiveTab('qdrive')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'qdrive'
                            ? 'bg-white text-indigo-600 shadow-sm dark:bg-zinc-700 dark:text-white'
                            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
                            }`}
                    >
                        <Film className="h-3.5 w-3.5" />
                        내 파일
                    </button>
                    <button
                        onClick={() => setActiveTab('storage')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'storage'
                            ? 'bg-white text-emerald-600 shadow-sm dark:bg-zinc-700 dark:text-white'
                            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
                            }`}
                    >
                        <HardDrive className="h-3.5 w-3.5" />
                        Storage
                    </button>
                    <button
                        onClick={() => setActiveTab('youtube')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'youtube'
                            ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
                            }`}
                    >
                        <YouTubeLogo width={16} height={16} />
                        YouTube
                    </button>
                </div>

                {/* Path Navigation (Storage only) */}
                {activeTab === 'storage' && currentPath.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded dark:bg-zinc-800/50">
                        <button onClick={handleBack} className="hover:text-indigo-600 flex items-center gap-1">
                            <CornerUpLeft className="h-3 w-3" />
                            ..
                        </button>
                        <span className="text-gray-300">/</span>
                        <span className="truncate font-medium text-gray-700 dark:text-gray-300">
                            {currentPath[currentPath.length - 1]}
                        </span>
                    </div>
                )}

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="파일 검색..."
                        className="w-full h-9 pl-9 pr-3 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-200"
                    />
                </div>

                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>

            {/* Content Grid */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto p-3 relative select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Marquee Box */}
                {selectionBox && (
                    <div
                        className="absolute bg-indigo-500/20 border border-indigo-500/50 pointer-events-none z-50"
                        style={{
                            left: selectionBox.x,
                            top: selectionBox.y,
                            width: selectionBox.w,
                            height: selectionBox.h
                        }}
                    />
                )}

                {activeTab === 'qdrive' && (
                    filteredAssets.length > 0 ? (
                        <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {filteredAssets.map(asset => (
                                <div
                                    key={asset.id}
                                    draggable
                                    onDragStart={(e) => onDragStart(e, asset)}
                                    className="group relative bg-white border border-gray-100 rounded-xl overflow-hidden cursor-grab hover:shadow-md hover:border-indigo-200 transition-all dark:bg-zinc-800 dark:border-zinc-700"
                                >
                                    <div className="aspect-video bg-gray-100 relative overflow-hidden dark:bg-zinc-900">
                                        {asset.thumbnailUrl ? (
                                            <img
                                                src={asset.thumbnailUrl}
                                                alt={asset.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                <Film className="h-8 w-8" />
                                            </div>
                                        )}
                                        <div className="absolute top-1.5 right-1.5 bg-white rounded-full p-1 shadow-sm">
                                            {asset.platform === 'youtube' ? (
                                                <YouTubeLogo width={12} height={12} />
                                            ) : (
                                                <Film className="h-3 w-3 text-gray-600" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-2.5">
                                        <h3 className="text-xs font-semibold text-gray-800 truncate dark:text-gray-200" title={asset.title}>
                                            {asset.title}
                                        </h3>
                                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                                            {new Date(asset.createdAt || '').toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                            <i className="text-4xl opacity-20">📂</i>
                            <p className="text-sm">업로드된 파일이 없습니다</p>
                        </div>
                    )
                )}

                {activeTab === 'storage' && (
                    <div className="grid gap-3 grid-cols-2">
                        {filteredStorageItems.map((item, idx) => {
                            const isFolder = !item.metadata;
                            const isSelected = selectedItems.has(item.name);
                            const mediaUrl = storageUrls.get(item.name) || '';
                            const isVid = !isFolder && isVideoFile(item.name, item.metadata?.mimetype);
                            const isImg = !isFolder && isImageFile(item.name, item.metadata?.mimetype);

                            return (
                                <div
                                    key={idx}
                                    data-name={item.name}
                                    className={`storage-item group relative bg-white border rounded-xl overflow-hidden transition-all dark:bg-zinc-800
                                        ${isFolder ? 'cursor-pointer' : 'cursor-grab'}
                                        ${isSelected
                                            ? 'border-indigo-500 ring-2 ring-indigo-500/20 z-10'
                                            : 'border-gray-100 dark:border-zinc-700 hover:shadow-md hover:border-emerald-200'
                                        }
                                    `}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isFolder) {
                                            handleFolderClick(item.name);
                                        } else {
                                            toggleSelection(item.name, e.ctrlKey || e.shiftKey || isSelecting);
                                        }
                                    }}
                                    draggable={!isFolder}
                                    onDragStart={(e) => {
                                        if (isFolder) {
                                            e.preventDefault();
                                            return;
                                        }
                                        if (!isSelected && !e.ctrlKey) {
                                            setSelectedItems(new Set([item.name]));
                                        }

                                        const asset: Asset = {
                                            id: item.id || item.name,
                                            type: 'video',
                                            title: item.name,
                                            url: mediaUrl || getPublicUrl(item.name),
                                            platform: 'storage',
                                            size: item.metadata?.size || 0,
                                            updatedAt: item.updated_at || new Date().toISOString()
                                        };
                                        onDragStart(e, asset);
                                    }}
                                >
                                    {/* Selection Checkbox */}
                                    {!isFolder && (
                                        <div className={`absolute top-2 left-2 z-20 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                            <div className={`w-4 h-4 rounded-full border ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'bg-white/80 border-gray-300'} flex items-center justify-center`}>
                                                {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                                            </div>
                                        </div>
                                    )}

                                    <div className="aspect-video bg-gray-50 flex items-center justify-center relative dark:bg-zinc-900 overflow-hidden">
                                        {isFolder ? (
                                            <Folder className="h-10 w-10 text-emerald-200 group-hover:text-emerald-400 transition-colors" />
                                        ) : isImg && mediaUrl ? (
                                            <img
                                                src={mediaUrl}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                                decoding="async"
                                            />
                                        ) : isVid && mediaUrl ? (
                                            <StorageVideoThumbnail url={mediaUrl} />
                                        ) : (
                                            <HardDrive className="h-8 w-8 text-gray-300 group-hover:text-indigo-300 transition-colors" />
                                        )}
                                    </div>
                                    <div className="p-2.5">
                                        <h3 className="text-xs font-semibold text-gray-800 truncate dark:text-gray-200" title={item.name}>
                                            {item.name}
                                        </h3>
                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                            {isFolder ? '폴더' : (item.metadata?.size ? `${(item.metadata.size / 1024 / 1024).toFixed(1)} MB` : 'File')}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredStorageItems.length === 0 && !loading && (
                            <div className="col-span-2 text-center py-10 text-gray-400 text-sm">
                                폴더/파일이 없습니다
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'youtube' && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                        <YouTubeLogo width={48} height={48} className="opacity-50" />
                        <p className="text-sm">YouTube 검색 준비 중...</p>
                    </div>
                )}
            </div>

            {/* Footer Status */}
            <div className="p-3 border-t border-gray-100 bg-gray-50/50 text-[10px] text-gray-500 dark:border-zinc-800 dark:bg-zinc-900">
                {activeTab === 'storage' ? (
                    <div className="space-y-1.5">
                        <div className="text-center">
                            {selectedItems.size > 0
                                ? `${selectedItems.size}개 선택됨`
                                : `${storageItems.length} items`
                            }
                        </div>
                        {(() => {
                            const totalSize = storageItems.reduce((acc, item) => acc + (item.metadata?.size || 0), 0);
                            const usedMB = (totalSize / 1024 / 1024).toFixed(1);
                            const totalMB = (STORAGE_QUOTA / 1024 / 1024).toFixed(0);
                            const percentage = Math.min(100, (totalSize / STORAGE_QUOTA) * 100);

                            return (
                                <div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-zinc-700 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${percentage > 90 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center mt-1 text-[10px] text-gray-400">
                                        <span>{usedMB} MB</span>
                                        <span>{totalMB} MB</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                ) : (
                    <div className="text-center">
                        {filteredAssets.length} assets
                    </div>
                )}
            </div>
        </aside>
    );
}

// Optimized Video Thumbnail with Intersection Observer
function StorageVideoThumbnail({ url }: { url: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '100px' }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full bg-black relative">
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Film className="h-8 w-8 text-gray-600 animate-pulse" />
                </div>
            )}
            {isVisible && (
                <video
                    ref={videoRef}
                    src={url + '#t=1.0'}
                    className={`w-full h-full object-cover transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                    muted
                    playsInline
                    preload="metadata"
                    crossOrigin="anonymous"
                    onLoadedData={() => setIsLoaded(true)}
                    onMouseEnter={(e) => {
                        const v = e.currentTarget;
                        v.currentTime = 0;
                        v.play().catch(() => {});
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 1.0;
                    }}
                />
            )}
        </div>
    );
}
