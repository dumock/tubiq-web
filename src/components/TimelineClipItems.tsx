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
    dragOffsetX?: number; // Offset in pixels during drag (horizontal)
    dragOffsetY?: number; // Offset in pixels during drag (vertical - for layer change)
    audioWaveformL: number[]; // Audio waveform data for CapCut-style integrated display
    onMouseDown: (e: React.MouseEvent, clip: VideoClip) => void;
    onContextMenu: (e: React.MouseEvent, clip: VideoClip) => void;
    onDragHandle: (e: React.MouseEvent, clip: VideoClip, type: 'left' | 'right') => void;
    onVolumeChange?: (clipId: string, volume: number) => void; // CapCut-style volume control
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
    dragOffsetX = 0, // Offset during drag (X)
    dragOffsetY = 0, // Offset during drag (Y - for layer change)
    audioWaveformL, // Audio waveform for CapCut-style display
    onVolumeChange, // Volume change callback
    onMouseDown,
    onContextMenu,
    onDragHandle,
    splitClip,
    containerRef,
    handleUnlinkAudio,
    contextMenu
}: VideoClipItemProps) => {
    const clipWidth = (clip.endTime - clip.startTime) * pxPerSec;
    const [localVolume, setLocalVolume] = React.useState(clip.volume ?? 1.0);
    const [isVolumeDragging, setIsVolumeDragging] = React.useState(false);

    // Sync local volume with clip volume when not dragging
    React.useEffect(() => {
        if (!isVolumeDragging) {
            setLocalVolume(clip.volume ?? 1.0);
        }
    }, [clip.volume, isVolumeDragging]);

    const volume = localVolume; // Use local volume for instant feedback

    // Dynamic slot width based on actual video aspect ratio
    // Track height: 44px for video frames, 20px for audio waveform = 64px total (h-16)
    const videoHeight = 44;
    const audioHeight = 20;
    // Use clip's ratio if available, otherwise use passed thumbnailAspectRatio, or default to 16:9
    const aspectRatio = clip.ratio || thumbnailAspectRatio || (16 / 9);

    // For landscape videos (ratio >= 1): Wide slots like CapCut
    // For portrait videos (ratio < 1): Narrow slots
    // CapCut style: Show frames at their natural aspect ratio
    const slotWidth = Math.round(videoHeight * aspectRatio);

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
            className={`video-clip absolute inset-y-0 rounded-lg overflow-hidden cursor-pointer group select-none ${isDragging
                ? 'opacity-0 pointer-events-none' // Hidden during drag - rendered at global level to avoid track clipping
                : 'z-0 border-2' // No transition - instant position update to prevent drop bounce
                } ${isSelected && !isDragging ? 'border-yellow-400 ring-2 ring-yellow-400 z-10' : !isDragging ? 'border-indigo-500 hover:border-indigo-400' : ''}`}
            style={{
                left: clip.startTime * pxPerSec,
                width: Math.max(clipWidth, 20),
                // Apply transform for smooth drag following (both horizontal and vertical)
                transform: isDragging ? `translate(${dragOffsetX}px, ${dragOffsetY}px)` : undefined,
            }}
            onMouseDown={(e) => {
                // Block all interactions if clip is locked
                if (clip.isLocked) {
                    e.stopPropagation();
                    return;
                }

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
            {/* Always show contents - isDragging just makes clip semi-transparent */}
            {(
                <>
                    {/* Video frames section - top portion */}
                    <div className="absolute top-0 left-0 right-0 flex overflow-hidden pointer-events-none" style={{ height: videoHeight }}>
                        {frameSlots.map((src, i) => (
                            <img
                                key={i}
                                src={src}
                                className="h-full flex-shrink-0"
                                style={{
                                    width: slotWidth,
                                    objectFit: 'cover',
                                    objectPosition: 'center'
                                }}
                                draggable={false}
                                alt=""
                            />
                        ))}
                        {frameSlots.length === 0 && <div className="w-full h-full bg-zinc-700" />}
                    </div>

                    {/* Audio waveform section - bottom portion (CapCut style with volume control) */}
                    {clip.hasAudio !== false && (
                        <div
                            className="absolute left-0 right-0 cursor-ns-resize group/audio"
                            style={{ top: videoHeight, height: audioHeight }}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                setIsVolumeDragging(true);
                                const startY = e.clientY;
                                const startVolume = localVolume;
                                let currentVolume = startVolume;

                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                    const deltaY = startY - moveEvent.clientY; // Up = increase, Down = decrease
                                    const volumeChange = deltaY / 10; // High sensitivity - 10px = 100% change
                                    currentVolume = Math.max(0, Math.min(2, startVolume + volumeChange)); // 0% to 200%
                                    setLocalVolume(currentVolume); // Instant local update
                                };

                                const handleMouseUp = () => {
                                    setIsVolumeDragging(false);
                                    window.removeEventListener('mousemove', handleMouseMove);
                                    window.removeEventListener('mouseup', handleMouseUp);
                                    // Commit final volume to parent
                                    if (onVolumeChange) {
                                        onVolumeChange(clip.id, currentVolume);
                                    }
                                };

                                window.addEventListener('mousemove', handleMouseMove);
                                window.addEventListener('mouseup', handleMouseUp);
                            }}
                        >
                            {/* Canvas for waveform */}
                            <canvas
                                className="absolute inset-0 pointer-events-none"
                                ref={(canvas) => {
                                    // Use clip's own waveform if available, otherwise fallback to global
                                    const waveformData = clip.waveform && clip.waveform.length > 0 ? clip.waveform : audioWaveformL;
                                    if (!canvas || waveformData.length === 0) return;
                                    const ctx = canvas.getContext('2d');
                                    if (!ctx) return;

                                    const width = Math.max(clipWidth, 20);
                                    canvas.width = width;
                                    canvas.height = audioHeight;

                                    // Dark teal background (CapCut style)
                                    ctx.fillStyle = '#0d3d3d';
                                    ctx.fillRect(0, 0, width, audioHeight);

                                    // Draw bottom baseline (dotted) - CapCut style
                                    ctx.strokeStyle = '#2dd4bf';
                                    ctx.setLineDash([2, 2]);
                                    ctx.lineWidth = 1;
                                    ctx.beginPath();
                                    ctx.moveTo(0, audioHeight - 1);
                                    ctx.lineTo(width, audioHeight - 1);
                                    ctx.stroke();
                                    ctx.setLineDash([]);

                                    // Draw waveform bars - upward only from bottom (CapCut style)
                                    const clipDuration = clip.sourceEnd - clip.sourceStart;
                                    const totalSamples = waveformData.length;
                                    const effectiveVolume = volume;
                                    const barWidth = 2; // Thicker bars like CapCut
                                    const barGap = 1;

                                    // Determine mapping mode
                                    const useDirectMapping = clip.waveform && clip.waveform.length > 0;

                                    ctx.fillStyle = '#2dd4bf'; // Teal waveform (CapCut style)
                                    for (let x = 0; x < width; x += (barWidth + barGap)) {
                                        const clipTimeOffset = (x / width) * clipDuration;

                                        let sampleIndex: number;
                                        if (useDirectMapping) {
                                            // Direct mapping: Waveform covers the clip's source duration
                                            sampleIndex = Math.floor((clipTimeOffset / clipDuration) * totalSamples);
                                        } else {
                                            // Global mapping: Waveform covers the entire container duration
                                            const sourceTime = clip.sourceStart + clipTimeOffset;
                                            sampleIndex = Math.floor((sourceTime / containerDuration) * totalSamples);
                                        }

                                        const amplitude = (waveformData[Math.min(sampleIndex, totalSamples - 1)] || 0) * effectiveVolume;
                                        const barHeight = Math.max(2, Math.min(amplitude * (audioHeight - 2), audioHeight - 2));
                                        // Draw from bottom upward only
                                        ctx.fillRect(x, audioHeight - barHeight - 1, barWidth, barHeight);
                                    }

                                    // Volume line indicator (horizontal line showing current volume level)
                                    const volumeLineY = audioHeight - (volume / 2) * (audioHeight - 2) - 1;
                                    ctx.strokeStyle = '#fbbf24'; // Yellow volume line
                                    ctx.lineWidth = 0.5;
                                    ctx.setLineDash([]);
                                    ctx.beginPath();
                                    ctx.moveTo(0, volumeLineY);
                                    ctx.lineTo(width, volumeLineY);
                                    ctx.stroke();
                                }}
                            />
                            {/* Volume indicator on hover */}
                            <div className={`absolute right-1 top-0.5 text-[8px] px-1 rounded transition-opacity ${isVolumeDragging ? 'opacity-100 bg-yellow-500 text-black' : 'opacity-0 group-hover/audio:opacity-100 bg-black/60 text-white'}`}>
                                {Math.round(volume * 100)}%
                            </div>
                        </div>
                    )
                    }
                    {/* No audio indicator */}
                    {
                        clip.hasAudio === false && (
                            <div
                                className="absolute left-0 right-0 bg-zinc-800 flex items-center justify-center pointer-events-none"
                                style={{ top: videoHeight, height: audioHeight }}
                            >
                                <span className="text-[8px] text-zinc-500">🔇</span>
                            </div>
                        )
                    }
                    <div className="absolute top-0.5 left-1 bg-black/60 text-white text-[9px] px-1 rounded pointer-events-none max-w-full truncate">
                        {clip.name || `V${layerIndex + 1} Clip`}
                    </div>

                    {/* Handles - Hide if cut mode or locked */}
                    {
                        !isCutMode && !clip.isLocked && (
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
                        )
                    }
                    {/* Locked indicator */}
                    {
                        clip.isLocked && (
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                                <span className="text-white/50 text-[10px]">🔒</span>
                            </div>
                        )
                    }
                </>
            )}
        </div >
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
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = Math.max(clipWidth, 20);
        const height = 36;
        canvas.width = width;
        canvas.height = height;

        // Clear with background (CapCut dark teal style)
        ctx.fillStyle = '#064e3b'; // emerald-900
        ctx.fillRect(0, 0, width, height);

        // Use clip's own waveform if available, otherwise fallback to global
        const waveformData = clip.waveform && clip.waveform.length > 0 ? clip.waveform : audioWaveformL;

        // Debug: log waveform status
        console.log('[AudioClip] Rendering waveform for', clip.id, '| clip.waveform:', clip.waveform?.length || 0, '| global:', audioWaveformL.length, '| using:', waveformData.length);

        if (waveformData.length > 0) {

            const clipDuration = clip.sourceEnd - clip.sourceStart;
            const totalSamples = waveformData.length;

            // For per-clip waveform: Use direct mapping (waveform covers the whole source)
            const useDirectMapping = clip.waveform && clip.waveform.length > 0;

            // CapCut style: Bars drawn upward from bottom
            const barWidth = 2;
            const barGap = 1;
            const maxBarHeight = height - 4; // Leave some padding

            // Draw waveform as bars (CapCut style - upward only)
            ctx.fillStyle = '#34d399'; // emerald-400
            for (let x = 0; x < width; x += (barWidth + barGap)) {
                const clipTimeOffset = (x / width) * clipDuration;

                let sampleIndex: number;
                if (useDirectMapping) {
                    // Direct mapping: Waveform covers the clip's source duration
                    sampleIndex = Math.floor((clipTimeOffset / clipDuration) * totalSamples);
                } else {
                    // Global mapping: Waveform covers the entire container duration
                    const sourceTime = clip.sourceStart + clipTimeOffset;
                    sampleIndex = Math.floor((sourceTime / containerDuration) * totalSamples);
                }

                const amplitude = waveformData[Math.min(sampleIndex, totalSamples - 1)] || 0;
                const barHeight = Math.max(2, amplitude * maxBarHeight);

                // Draw bar from bottom upward
                ctx.fillRect(x, height - barHeight - 2, barWidth, barHeight);
            }

            // Draw bottom baseline (CapCut style)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, height - 1);
            ctx.lineTo(width, height - 1);
            ctx.stroke();
        }

    }, [clip, clipWidth, audioWaveformL, containerDuration]);

    return (
        <div
            className={`audio-clip absolute top-0 h-9 bg-emerald-900 rounded overflow-hidden border-2 cursor-pointer transition-colors duration-75 ${isSelected ? 'border-yellow-400 ring-2 ring-yellow-400 z-10' : 'border-emerald-500 hover:border-emerald-400'}`}
            style={{
                left: clip.startTime * pxPerSec,
                width: Math.max(clipWidth, 20),
                height: 36
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
