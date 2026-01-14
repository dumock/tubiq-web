import React, { memo } from 'react';
import { VideoClip, AudioClip } from './TimelineEditor';

interface VideoClipItemProps {
    clip: VideoClip;
    layerIndex: number;
    pxPerSec: number;
    containerDuration: number; // pass the timeline duration for calculations
    isSelected: boolean;
    isCutMode: boolean;
    frameThumbnails: string[];
    thumbnailAspectRatio: number; // New prop
    isDragging?: boolean;
    onMouseDown: (e: React.MouseEvent, clip: VideoClip) => void;
    onContextMenu: (e: React.MouseEvent, clip: VideoClip) => void;
    onDragHandle: (e: React.MouseEvent, clip: VideoClip, type: 'left' | 'right') => void;
    splitClip: (id: string, type: 'video', time: number) => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
    handleUnlinkAudio: (id: string) => void;
    contextMenu: { id: string, type: 'clip' | 'subtitle' | 'audio', x: number, y: number } | null;
}

export const VideoClipItem = memo(({
    clip,
    layerIndex,
    pxPerSec,
    containerDuration,
    isSelected,
    isCutMode,
    frameThumbnails,
    thumbnailAspectRatio, // Destructure new prop
    isDragging, // New prop
    onMouseDown,
    onContextMenu,
    onDragHandle,
    splitClip,
    containerRef,
    handleUnlinkAudio,
    contextMenu
}: VideoClipItemProps) => {
    const clipWidth = (clip.endTime - clip.startTime) * pxPerSec;
    const slotWidth = thumbnailAspectRatio * 48; // Use dynamic aspect ratio * height (h-12 = 48px)

    // Memoize frame slots calculation to prevent recalc on every drag move if source params haven't changed
    const frameSlots = React.useMemo(() => {
        const slotCount = Math.ceil(clipWidth / slotWidth);
        const clipFrames = clip.frames || [];

        // If no frames yet, return empty array (will show placeholder color)
        if (clipFrames.length === 0 && frameThumbnails.length === 0) return [];

        // Fallback to global frameThumbnails if clip.frames not ready (backward compatibility/transition)
        const sourceFrames = clipFrames.length > 0 ? clipFrames : frameThumbnails;
        const sourceIsGlobal = clipFrames.length === 0;

        return Array.from({ length: slotCount }, (_, i) => {
            const offsetInClip = (i * slotWidth) / pxPerSec; // time offset from start of clip

            if (sourceIsGlobal) {
                // OLD LOGIC: Use global timeline time (fallback)
                const timelineTime = clip.startTime + offsetInClip;
                const frameIndex = Math.floor((timelineTime / containerDuration) * sourceFrames.length);
                return sourceFrames[Math.min(Math.max(0, frameIndex), sourceFrames.length - 1)] || '';
            } else {
                // NEW LOGIC: Use clip internal duration (source-based indexing)
                // Frame array covers clip.sourceStart to clip.sourceEnd
                const clipDuration = clip.sourceEnd - clip.sourceStart;
                if (clipDuration <= 0) return '';

                // Map offset (0 to duration) to frame index
                // Note: We might need to consider source start if frames are extracted only for the USED portion?
                // But usually we extract for the full duration or at least the relevant part.
                // Assuming clip.frames covers the currently defined [sourceStart, sourceEnd] range?
                // Actually, let's assume frames represent the visible range or the full source?
                // Let's implement extraction for the *used duration* first.

                // If frames extracted for duration:
                const frameIndex = Math.floor((offsetInClip / clipDuration) * sourceFrames.length);
                return sourceFrames[Math.min(Math.max(0, frameIndex), sourceFrames.length - 1)] || '';
            }
        });
    }, [clipWidth, slotWidth, pxPerSec, clip.startTime, clip.sourceStart, clip.sourceEnd, clip.frames, containerDuration, frameThumbnails]);

    return (
        <div
            className={`video-clip absolute h-12 rounded-lg overflow-hidden border-2 cursor-pointer group select-none ${isDragging ? 'z-50 shadow-lg opacity-20' : 'transition-[left,width] duration-200 ease-out z-0 opacity-100'
                } ${isSelected ? 'border-yellow-400 ring-2 ring-yellow-400 z-10' : 'border-indigo-500 hover:border-indigo-400'}`}
            style={{
                left: clip.startTime * pxPerSec,
                top: 2, // slight offset
                width: Math.max(clipWidth, 20),
            }}
            onMouseDown={(e) => {
                // Cut Mode Logic handled inside child wrapper or parent?
                // Parent logic was:
                /*
                 if (isCutMode) {
                     ... splitClip ...
                     return;
                 }
                 ... drag ...
                */
                // We'll reimplement that logic here or delegate to a smart handler.
                // Parent passed logic blocks. Let's replicate the structure.

                if (isCutMode) {
                    e.stopPropagation();
                    if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect();
                        const x = e.clientX - rect.left + containerRef.current.scrollLeft;
                        const time = Math.max(0, Math.min(x / pxPerSec, containerDuration));
                        splitClip(clip.id, 'video', time);
                    }
                    return;
                }
                onMouseDown(e, clip);
            }}
            onContextMenu={(e) => onContextMenu(e, clip)}
        >
            <div className="absolute inset-0 bg-zinc-800 flex items-center overflow-hidden pointer-events-none">
                {frameSlots.map((src, i) => (
                    <img
                        key={i}
                        src={src}
                        className="h-full object-cover border-r border-black/10 flex-shrink-0"
                        style={{ width: `${slotWidth}px` }}
                        draggable={false}
                        alt=""
                    />
                ))}
                {frameSlots.length === 0 && <div className="w-full h-full bg-zinc-700" />}
            </div>
            <div className="absolute top-0.5 left-1 bg-black/60 text-white text-[9px] px-1 rounded pointer-events-none max-w-full truncate">
                {clip.name || `V${layerIndex + 1} Clip`}
            </div>

            {/* Handles - Only show if not in cut mode? Original code didn't strictly hide them but they wouldn't work if stopPropagation in parent? Actually original had onMouseDown on handles. */}
            {!isCutMode && (
                <>
                    <div
                        className="absolute left-0 w-3 h-full cursor-ew-resize hover:bg-white/20 z-20"
                        onMouseDown={(e) => onDragHandle(e, clip, 'left')}
                    />
                    <div
                        className="absolute right-0 w-3 h-full cursor-ew-resize hover:bg-white/20 z-20"
                        onMouseDown={(e) => onDragHandle(e, clip, 'right')}
                    />
                </>
            )}
        </div>
    );
}, (prev, next) => {
    // Custom comparison for performance if needed, or rely on shallow compare
    // We care about: clip (position/time), isSelected, isCutMode, pxPerSec, styling props
    // We do NOT want to re-render if just 'currentTime' (playhead) changes in parent, unless it affects this clip (it shouldn't).
    // The parent re-renders typically on 'updatePlayhead' which updates a REF, not state, so it doesn't trigger React render.
    // However, if parent state changes (e.g. selection), we need update.
    return (
        prev.clip === next.clip &&
        prev.layerIndex === next.layerIndex &&
        prev.pxPerSec === next.pxPerSec &&
        prev.isSelected === next.isSelected &&
        prev.isCutMode === next.isCutMode &&
        prev.frameThumbnails === next.frameThumbnails &&
        prev.containerDuration === next.containerDuration &&
        // Functions usually unstable if inline, need useCallback in parent
        prev.onMouseDown === next.onMouseDown &&
        prev.contextMenu === next.contextMenu &&
        prev.isDragging === next.isDragging // Add isDragging check
    );
});


interface UnlinkedAudioClipItemProps {
    clip: AudioClip;
    pxPerSec: number;
    containerDuration: number;
    isSelected: boolean;
    isCutMode: boolean;
    audioWaveformL: number[]; // Pass the waveform data
    onMouseDown: (e: React.MouseEvent, clip: AudioClip) => void;
    onContextMenu: (e: React.MouseEvent, clip: AudioClip) => void;
    onDragHandle: (e: React.MouseEvent, clip: AudioClip, type: 'left' | 'right') => void;
    splitClip: (id: string, type: 'audio', time: number) => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

export const UnlinkedAudioClipItem = memo(({
    clip,
    pxPerSec,
    containerDuration,
    isSelected,
    isCutMode,
    audioWaveformL,
    onMouseDown,
    onContextMenu,
    onDragHandle,
    splitClip,
    containerRef
}: UnlinkedAudioClipItemProps) => {
    const clipWidth = (clip.endTime - clip.startTime) * pxPerSec;

    // Canvas ref for waveform
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || audioWaveformL.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = Math.max(clipWidth, 20);
        const height = 36;
        canvas.width = width;
        canvas.height = height;

        ctx.fillStyle = '#064e3b'; // emerald-900 (bg matches container but darker)
        ctx.fillRect(0, 0, width, height);

        const clipDuration = clip.sourceEnd - clip.sourceStart;
        const totalSamples = audioWaveformL.length;

        ctx.fillStyle = '#34d399'; // emerald-400
        for (let x = 0; x < width; x++) {
            const clipTimeOffset = (x / width) * clipDuration;
            // Map clip time to global source time
            const sourceTime = clip.sourceStart + clipTimeOffset;
            const sampleIndex = Math.floor((sourceTime / containerDuration) * totalSamples);

            const amplitude = audioWaveformL[Math.min(sampleIndex, totalSamples - 1)] || 0;
            const barHeight = amplitude * (height - 4);
            ctx.fillRect(x, height - 2 - barHeight, 1, barHeight);
        }

    }, [clip, clipWidth, audioWaveformL, containerDuration]);

    return (
        <div
            className={`audio-clip absolute top-0 bottom-0 bg-emerald-900 rounded overflow-hidden border-2 cursor-pointer transition-colors duration-75 ${isSelected ? 'border-yellow-400 ring-2 ring-yellow-400 z-10' : 'border-emerald-500 hover:border-emerald-400'}`}
            style={{
                left: clip.startTime * pxPerSec,
                width: Math.max(clipWidth, 20)
            }}
            onClick={(e) => {
                e.stopPropagation();
                if (isCutMode) {
                    if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect();
                        const x = e.clientX - rect.left + containerRef.current.scrollLeft;
                        const time = Math.max(0, Math.min(x / pxPerSec, containerDuration));
                        splitClip(clip.id, 'audio', time);
                    }
                    return;
                }
                // Normal select is handled by onMouseDown or onClick? 
                // Original code had both? No, original had onClick for select/cut, and onMouseDown for drag.
                // We will consolidate.
            }}
            onMouseDown={(e) => {
                if (isCutMode) {
                    // Click handler above handles cut.
                    return;
                }
                onMouseDown(e, clip);
            }}
            onContextMenu={(e) => onContextMenu(e, clip)}
        >
            {/* Resize Handles */}
            {!isCutMode && (
                <>
                    <div className="absolute left-0 w-3 h-full cursor-ew-resize hover:bg-white/20 z-20" onMouseDown={(e) => onDragHandle(e, clip, 'left')} />
                    <div className="absolute right-0 w-3 h-full cursor-ew-resize hover:bg-white/20 z-20" onMouseDown={(e) => onDragHandle(e, clip, 'right')} />
                </>
            )}

            <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none"
            />
            <div className="absolute top-0.5 left-1 text-[8px] text-emerald-300 pointer-events-none">🔊 분리됨</div>
        </div>
    );
});
