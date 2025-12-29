import { MoreVertical, Image as ImageIcon, Type, File, Play, Tv, Check } from 'lucide-react';
import { Asset } from '../mock/assets';
import { formatCompactNumber, formatDate } from '../lib/format';

interface AssetCardProps {
    asset: Asset;
    variant?: 'default' | 'overlay';
    isSelected?: boolean;
    onDoubleClick?: (e: React.MouseEvent) => void;
}

export default function AssetCard({ asset, variant = 'default', isSelected, onDoubleClick }: AssetCardProps) {
    const isOverlay = variant === 'overlay';

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
                targetUrl = asset.channelUrl || `https://youtube.com/channel/${asset.id}`;
            } else if (asset.type === 'video') {
                // If it's a mock video from search, the ID might be 'v1', 'v2', etc.
                // If it's a saved video, we might have stored the real ID.
                const videoId = asset.id.startsWith('added-') ? asset.id.split('-')[1] : asset.id;
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
    const isUrl = asset.url.startsWith('http');
    const previewBgClasses = isOverlay
        ? "flex h-32 w-full items-center justify-center bg-gray-50 dark:bg-zinc-800"
        : `flex h-40 w-full items-center justify-center ${isUrl ? 'bg-gray-100 dark:bg-zinc-800' : asset.url}`;

    return (
        <div onDoubleClick={handleDoubleClick} className={cardClasses}>
            {/* Selection Checkmark Overlay */}
            {isSelected && !isOverlay && (
                <div className="absolute left-2 top-2 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md animate-in fade-in zoom-in duration-200">
                    <Check className="h-4 w-4 stroke-[3px]" />
                </div>
            )}
            {/* Preview Area - Needs overflow-hidden locally for rounded top corners */}
            <div className={`${previewBgClasses} relative overflow-hidden rounded-t-xl`}>
                {isUrl && asset.type !== 'channel' && (
                    <img
                        src={asset.url}
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
                                {(asset.channelName || asset.title).charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )
                ) : (
                    <div className="opacity-50">{getIcon()}</div>
                )}
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
                    {!isOverlay && (
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                console.log('Menu clicked');
                            }}
                            className="absolute right-2 top-2 rounded-lg p-1.5 bg-white/50 backdrop-blur-sm opacity-0 hover:bg-white group-hover:opacity-100 transition-all dark:bg-black/50 dark:hover:bg-black"
                        >
                            <MoreVertical className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
