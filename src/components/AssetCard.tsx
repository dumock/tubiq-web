import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Image as ImageIcon, Type, File, Play, Tv, Check, X, Download, Link, Video, BarChart3 } from 'lucide-react';
import { Asset } from '@/types';
import { formatCompactNumber, formatDate } from '../lib/format';

interface AssetCardProps {
    asset: Asset;
    variant?: 'default' | 'overlay';
    isSelected?: boolean;
    onDoubleClick?: (e: React.MouseEvent) => void;
    onDelete?: (id: string) => void;
    onMoveToVideoAssets?: (id: string) => void;
    onMoveToChannelAnalysis?: (id: string) => void;
    enableChannelMenu?: boolean;
}

export default function AssetCard({ asset, variant = 'default', isSelected, onDoubleClick, onDelete, onMoveToVideoAssets, onMoveToChannelAnalysis, enableChannelMenu }: AssetCardProps) {
    const isOverlay = variant === 'overlay';
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // ... (rest of code)

    <button
        onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(false);
            if (onMoveToChannelAnalysis) {
                onMoveToChannelAnalysis(asset.id);
            } else {
                window.location.href = '/channel-analysis';
            }
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-zinc-700"
    >
        <BarChart3 className="h-4 w-4" />
        채널분석
    </button>

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Get video ID from asset
    const getVideoId = () => {
        if (asset.type !== 'video') return null;
        if (asset.youtubeVideoId) return asset.youtubeVideoId;

        // Fallback parsers for various internal ID formats
        if (asset.id.startsWith('added-') || asset.id.startsWith('video-')) {
            return asset.id.split('-')[1];
        }
        return asset.id;
    };

    const handleCopyLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        const videoId = getVideoId();
        if (videoId) {
            const url = `https://youtube.com/watch?v=${videoId}`;
            navigator.clipboard.writeText(url);
            alert('링크가 복사되었습니다.');
        }
        setIsMenuOpen(false);
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        alert('다운로드 기능은 서버 설정 후 사용 가능합니다.');
        setIsMenuOpen(false);
    };

    const getIcon = () => {
        switch (asset.type) {
            case 'image': return <ImageIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />;
            case 'video': return <Play className="h-6 w-6 text-rose-600 dark:text-rose-400" />;
            case 'font': return <Type className="h-6 w-6 text-gray-600 dark:text-gray-400" />;
            case 'channel': return <Tv className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />;
            default: return <File className="h-6 w-6 text-gray-600 dark:text-gray-400" />;
        }
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        if (isOverlay) return; // No interaction in overlay mode

        if (onDoubleClick) {
            onDoubleClick(e);
            return;
        }

        if (asset.type === 'channel' || asset.type === 'video') {
            e.stopPropagation();

            let targetUrl = '';
            if (asset.type === 'channel') {
                const channelId = asset.youtubeChannelId || (asset.id.startsWith('channel-') ? asset.id.split('-')[1] : asset.id);
                targetUrl = asset.channelUrl || `https://youtube.com/channel/${channelId}`;
            } else if (asset.type === 'video') {
                const videoId = asset.youtubeVideoId ||
                    (asset.id.startsWith('added-') || asset.id.startsWith('video-')
                        ? asset.id.split('-')[1]
                        : asset.id);
                targetUrl = `https://youtube.com/watch?v=${videoId}`;
            }

            if (targetUrl) {
                window.open(targetUrl, '_blank', 'noopener,noreferrer');
            }
        }
    };

    // Base card classes - overlay variant uses simpler, cleaner styling
    const cardClasses = isOverlay
        ? "relative overflow-hidden rounded-xl bg-white dark:bg-zinc-900 shadow-sm"
        : `group relative rounded-xl border transition-all duration-300 bg-white select-none ${isSelected
            ? 'z-10 border-indigo-500 ring-[2.5px] ring-indigo-500/50 shadow-lg shadow-indigo-100 dark:shadow-none bg-indigo-50/10 dark:bg-indigo-950/10'
            : 'border-gray-200 dark:border-zinc-800 hover:shadow-md dark:bg-zinc-950'
        }`;

    // Preview background - overlay mode uses neutral bg, normal uses pastel
    const isUrl = asset.url?.startsWith('http') || false;
    const previewBgClasses = isOverlay
        ? "flex h-32 w-full items-center justify-center bg-gray-50 dark:bg-zinc-800"
        : `flex h-40 w-full items-center justify-center ${isUrl ? 'bg-gray-100 dark:bg-zinc-800' : (asset.url || 'bg-gray-100')}`;

    return (
        <div onDoubleClick={handleDoubleClick} className={cardClasses}>
            {/* Selection Checkmark Overlay */}
            {isSelected && !isOverlay && (
                <div className="absolute left-2 top-2 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md animate-in fade-in zoom-in duration-200">
                    <Check className="h-4 w-4 stroke-[3px]" />
                </div>
            )}
            {/* Delete Button on Hover (when not selected) */}
            {!isSelected && !isOverlay && onDelete && (
                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(asset.id);
                    }}
                    className="absolute left-2 top-2 z-30 rounded-lg p-1.5 bg-white/50 backdrop-blur-sm opacity-0 hover:bg-white group-hover:opacity-100 transition-all dark:bg-black/50 dark:hover:bg-black"
                >
                    <X className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                </button>
            )}
            {/* Channel Menu */}
            {!isOverlay && asset.type === 'channel' && enableChannelMenu && (
                <div ref={menuRef} className="absolute right-2 top-2 z-40">
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(!isMenuOpen);
                        }}
                        className="rounded-lg p-1.5 bg-white/50 backdrop-blur-sm opacity-0 hover:bg-white group-hover:opacity-100 transition-all dark:bg-black/50 dark:hover:bg-black"
                    >
                        <MoreVertical className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                    </button>

                    {isMenuOpen && (
                        <div className="absolute right-0 mt-1 w-32 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-150 dark:border-zinc-700 dark:bg-zinc-800">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const url = asset.channelUrl || `https://youtube.com/channel/${asset.id}`;
                                    navigator.clipboard.writeText(url);
                                    alert('채널 링크가 복사되었습니다.');
                                    setIsMenuOpen(false);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-zinc-700"
                            >
                                <Link className="h-4 w-4" />
                                링크복사
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMenuOpen(false);
                                    if (onMoveToChannelAnalysis) {
                                        onMoveToChannelAnalysis(asset.id);
                                    } else {
                                        window.location.href = '/channel-analysis';
                                    }
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-zinc-700"
                            >
                                <BarChart3 className="h-4 w-4" />
                                채널분석
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Preview Area - Needs overflow-hidden locally for rounded top corners */}
            <div className={`${previewBgClasses} relative overflow-hidden rounded-t-xl`}>
                {isUrl && asset.type !== 'channel' && (
                    <img
                        src={asset.url || ''}
                        alt={asset.title}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                )}
                {asset.type === 'channel' ? (
                    asset.avatarUrl ? (
                        <img
                            src={asset.avatarUrl}
                            alt={asset.channelName || asset.title}
                            className={isOverlay
                                ? "w-16 h-16 rounded-full object-cover border border-gray-200 bg-white"
                                : "w-24 h-24 rounded-full object-cover border-2 border-white/60 shadow-sm bg-white"
                            }
                        />
                    ) : (
                        <div className={isOverlay
                            ? "flex w-16 h-16 items-center justify-center rounded-full bg-indigo-50 border border-gray-200"
                            : "flex w-24 h-24 items-center justify-center rounded-full bg-indigo-50/90 border-2 border-white/60 shadow-sm"
                        }>
                            <span className={isOverlay ? "text-xl font-bold text-indigo-600" : "text-3xl font-bold text-indigo-600"}>
                                {(asset.channelName || asset.title || '?').charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )
                ) : asset.type !== 'video' ? (
                    <div className="opacity-50">{getIcon()}</div>
                ) : null}
            </div>

            {/* Info Area - Needs overflow-hidden locally for rounded bottom corners */}
            <div className={`${isOverlay ? "p-3" : "p-4"} overflow-hidden rounded-b-xl`}>
                <div className="flex items-start justify-between">
                    <div className="w-full">
                        {asset.type === 'channel' ? (
                            <div className="flex flex-col items-center text-center">
                                <h3 className={`w-full truncate font-semibold text-gray-900 dark:text-white ${isOverlay ? 'text-xs' : 'text-sm'}`} title={asset.channelName || asset.title}>
                                    {asset.channelName || asset.title}
                                </h3>
                                {!isOverlay && (
                                    <>
                                        <p className="mt-1 w-full truncate text-sm text-gray-500 dark:text-gray-400">
                                            구독자 {asset.subscribers ? formatCompactNumber(asset.subscribers) : '0'}
                                        </p>
                                        <p className="w-full truncate text-sm text-gray-500 dark:text-gray-400">
                                            개설일 {asset.createdAt ? formatDate(asset.createdAt) : '-'}
                                        </p>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-center">
                                <h3 className={`w-full truncate font-medium text-gray-900 dark:text-white ${isOverlay ? 'text-xs' : 'text-sm'}`} title={asset.title}>
                                    {asset.title}
                                </h3>
                                {!isOverlay && (
                                    <>
                                        <p className="mt-1 w-full truncate text-[11px] text-gray-500 dark:text-gray-400">
                                            {asset.type === 'video' && asset.views !== undefined
                                                ? `조회수 ${formatCompactNumber(asset.views)}`
                                                : asset.size} • {asset.updatedAt}
                                        </p>
                                        {asset.channelName && (
                                            <p className="mt-2 w-full truncate text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md">
                                                {asset.channelName}
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    {!isOverlay && asset.type === 'video' && (
                        <div ref={menuRef} className="absolute right-2 top-2 z-40">
                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMenuOpen(!isMenuOpen);
                                }}
                                className="rounded-lg p-1.5 bg-white/50 backdrop-blur-sm opacity-0 hover:bg-white group-hover:opacity-100 transition-all dark:bg-black/50 dark:hover:bg-black"
                            >
                                <MoreVertical className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                            </button>

                            {isMenuOpen && (
                                <div className="absolute right-0 mt-1 w-32 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-150 dark:border-zinc-700 dark:bg-zinc-800">
                                    <button
                                        onClick={handleDownload}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-zinc-700"
                                    >
                                        <Download className="h-4 w-4" />
                                        다운로드
                                    </button>
                                    <button
                                        onClick={handleCopyLink}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-zinc-700"
                                    >
                                        <Link className="h-4 w-4" />
                                        링크복사
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsMenuOpen(false);
                                            if (onMoveToVideoAssets) {
                                                onMoveToVideoAssets(asset.id);
                                            } else {
                                                window.location.href = '/video-assets';
                                            }
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-zinc-700"
                                    >
                                        <Video className="h-4 w-4" />
                                        영상에셋
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
