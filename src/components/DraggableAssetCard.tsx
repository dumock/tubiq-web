'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AssetCard from './AssetCard';
import { Asset } from '@/types';

interface DraggableAssetCardProps {
    asset: Asset;
    isSelected?: boolean;
    onClick?: (e: React.MouseEvent | React.TouchEvent, id: string) => void;
    onDoubleClick?: (e: React.MouseEvent) => void;
    onDelete?: (id: string) => void;
    onMoveToVideoAssets?: (id: string) => void;
    onMoveToChannelAnalysis?: (id: string) => void;
    enableChannelMenu?: boolean;
}

export default function DraggableAssetCard({ asset, isSelected, onClick, onDoubleClick, onDelete, onMoveToVideoAssets, onMoveToChannelAnalysis, enableChannelMenu }: DraggableAssetCardProps) {

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: `asset:${asset.id}`,
        data: {
            type: 'ASSET',
            asset,
            assetId: asset.id,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const [longPressTimer, setLongPressTimer] = React.useState<NodeJS.Timeout | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        const timer = setTimeout(() => {
            onClick?.(e, asset.id);
        }, 500);
        setLongPressTimer(timer);
    };

    const handleTouchEnd = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            data-asset-card="true"
            className={`relative group touch-none cursor-pointer ${isDragging ? 'opacity-30' : ''}`}
            onClick={(e) => onClick?.(e, asset.id)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <AssetCard
                asset={asset}
                isSelected={isSelected}
                onDoubleClick={onDoubleClick}
                onDelete={onDelete}
                onMoveToVideoAssets={onMoveToVideoAssets}
                onMoveToChannelAnalysis={onMoveToChannelAnalysis}
                enableChannelMenu={enableChannelMenu}
            />

            {/* Subtle dashed outline when dragging */}
            {isDragging && (
                <div className="absolute inset-0 rounded-xl border-2 border-dashed border-gray-300 pointer-events-none dark:border-zinc-600" />
            )}
        </div>
    );
}
