import React, { memo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DragOverlayProps {
    isVisible: boolean;
    screenX: number;
    screenY: number;
    grabOffsetX: number;
    clipWidth: number;
    clipHeight?: number;
    clipName: string;
    frameSlots: string[]; // Array of thumbnail URLs
    slotWidth: number;
    waveformData?: number[]; // Audio waveform data
    pxPerSec?: number; // Pixels per second for waveform rendering
    clipDuration?: number; // Clip duration in seconds
}

/**
 * Global Drag Overlay Component
 * 
 * Renders a dragged clip using React Portal directly to document.body.
 * Uses direct DOM manipulation for position updates to avoid React re-render lag.
 */
export const DragOverlay = memo(({
    isVisible,
    screenX,
    screenY,
    grabOffsetX,
    clipWidth,
    clipHeight = 56,
    clipName,
    frameSlots,
    slotWidth,
    waveformData,
}: DragOverlayProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const positionRef = useRef({ x: screenX, y: screenY });

    // Update position via direct DOM manipulation for smooth animation
    useEffect(() => {
        positionRef.current = { x: screenX, y: screenY };
        if (containerRef.current) {
            containerRef.current.style.transform = `translate3d(${screenX - grabOffsetX}px, ${screenY - (clipHeight / 2)}px, 0)`;
        }
    }, [screenX, screenY, grabOffsetX, clipHeight]);

    // Draw waveform on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !waveformData || waveformData.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw waveform bars - CapCut style (bars from bottom)
        ctx.fillStyle = 'rgba(20, 184, 166, 0.8)'; // Teal color

        const barWidth = 2;
        const barGap = 1;
        const totalBarWidth = barWidth + barGap;
        const barCount = Math.floor(width / totalBarWidth);

        for (let i = 0; i < barCount; i++) {
            const dataIndex = Math.floor((i / barCount) * waveformData.length);
            const amplitude = waveformData[dataIndex] || 0;
            const normalizedAmp = Math.min(1, amplitude);
            const barHeight = Math.max(1, normalizedAmp * height * 0.9);

            ctx.fillRect(
                i * totalBarWidth,
                height - barHeight,
                barWidth,
                barHeight
            );
        }

        // Draw baseline
        ctx.strokeStyle = 'rgba(20, 184, 166, 0.5)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, height - 0.5);
        ctx.lineTo(width, height - 0.5);
        ctx.stroke();
    }, [waveformData, clipWidth]);

    // Don't render if not dragging or if we're on the server
    if (!isVisible || typeof document === 'undefined') {
        return null;
    }

    const overlayContent = (
        <div
            ref={containerRef}
            className="fixed top-0 left-0 z-[9999] pointer-events-none"
            style={{
                width: clipWidth,
                height: clipHeight,
                transform: `translate3d(${screenX - grabOffsetX}px, ${screenY - (clipHeight / 2)}px, 0)`,
                willChange: 'transform',
            }}
        >
            <div className="relative w-full h-full rounded-lg overflow-hidden border-2 border-yellow-400 shadow-2xl bg-zinc-800">
                {/* Video frame thumbnails - top 44px */}
                <div className="absolute inset-0 flex" style={{ height: 44 }}>
                    {frameSlots.length > 0 ? (
                        frameSlots.map((src, i) => (
                            <img
                                key={i}
                                src={src}
                                alt=""
                                className="h-full flex-shrink-0 object-cover"
                                style={{ width: slotWidth }}
                                draggable={false}
                            />
                        ))
                    ) : (
                        <div className="w-full h-full bg-gradient-to-r from-zinc-700 to-zinc-600" />
                    )}
                </div>

                {/* Audio waveform area - bottom 12px */}
                <div
                    className="absolute bottom-0 left-0 right-0 bg-zinc-900/60"
                    style={{ height: 12 }}
                >
                    <canvas
                        ref={canvasRef}
                        width={clipWidth}
                        height={12}
                        className="w-full h-full"
                    />
                </div>

                {/* Clip label */}
                <div className="absolute top-0.5 left-1 px-1 py-0.5 bg-black/70 rounded text-[10px] text-white truncate max-w-[70%]">
                    {clipName || 'Clip'}
                </div>
            </div>
        </div>
    );

    return createPortal(overlayContent, document.body);
});

DragOverlay.displayName = 'DragOverlay';

export interface DragOverlayData {
    clipId: string;
    clipWidth: number;
    clipName: string;
    frameSlots: string[];
    slotWidth: number;
    grabOffsetX: number;
    screenX: number;
    screenY: number;
    waveformData?: number[];
    clipDuration?: number;
}
