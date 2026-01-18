import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Play, Pause, AlertCircle, Trash2, Scissors, Copy, ZoomIn, ZoomOut, SkipBack, SkipForward, Undo2, Redo2, Magnet, MousePointer, Link } from 'lucide-react';
import { VideoClipItem, UnlinkedAudioClipItem } from './TimelineClipItems';
import { DragOverlay, DragOverlayData } from './DragOverlay';

interface Subtitle {
    id: string;
    startTime: number;
    endTime: number;
    text: string;
}

export interface VideoClip {
    id: string;
    startTime: number;
    endTime: number;
    sourceStart: number;
    sourceEnd: number;
    sourceDuration?: number; // Original full video duration (for trim limits)
    layer?: number; // 0 = Main, 1 = Overlay
    hasAudio?: boolean; // true by default, false when audio is unlinked
    isAudioLinked?: boolean; // true when audio is inside video clip
    src?: string;
    name?: string;
    type?: string;
    frames?: string[]; // Per-clip frame thumbnails
    previewPosition?: { x: number; y: number }; // Position in preview (percentage)
    ratio?: number; // Video aspect ratio for dynamic slot sizing
    isLocked?: boolean; // Lock clip from editing
    isHidden?: boolean; // Hide clip from preview
    isMuted?: boolean; // Mute clip audio
    volume?: number; // Audio volume (0.0 to 2.0, default 1.0 = 100%)
    waveform?: number[]; // Per-clip audio waveform data
}

export interface AudioClip {
    id: string;
    videoClipId: string; // Original video clip this came from
    startTime: number;
    endTime: number;
    sourceStart: number;
    sourceEnd: number;
    layer?: number; // Audio track layer (0 = A1, 1 = A2, etc.)
    waveform?: number[]; // Per-clip waveform data
    volume?: number; // Audio volume (0.0 to 2.0, default 1.0 = 100%)
    src?: string; // Audio source URL (usually same as video source)
    name?: string; // Filename for display
    isMuted?: boolean; // Track-level mute
}

interface TimelineEditorProps {
    duration: number;
    subtitles: Subtitle[];
    onUpdateSubtitle: (id: string, newStart: number, newEnd: number) => void;
    onSeek: (time: number) => void;
    excludedSubtitleIds: Set<string>;
    onToggleExclude: (id: string) => void;
    videoElement: HTMLVideoElement | null;
    currentTime?: number; // Optional prop to drive timeline externally
    videoFileName?: string;
    isPlaying?: boolean;
    onPlayPause?: () => void;
    onSplitSubtitle?: (id: string, time: number) => void;
    onDeleteSubtitle?: (id: string) => void;
    videoClips: VideoClip[];
    onUpdateVideoClips: (clips: VideoClip[]) => void;
    onFrameExtractionChange?: (isExtracting: boolean) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    onDropFile?: (file: File, time: number) => void;
    onDropAsset?: (assetData: string, time: number) => void; // For Q Drive asset drops
    isCutMode?: boolean;
    // New Props for Linked Editing
    audioClips: AudioClip[];
    onUpdateAudioClips: (clips: AudioClip[]) => void;
    isAudioSeparated: boolean;
    // Hybrid Engine Scrubbing
    onStartScrub?: () => void;
    onEndScrub?: () => void;
    onPreviewFrame?: (time: number) => void;
}


const BLOCK_COLORS = [
    { bg: 'bg-indigo-500', border: 'border-indigo-600', hover: 'hover:bg-indigo-600', text: 'text-white' },
    { bg: 'bg-purple-500', border: 'border-purple-600', hover: 'hover:bg-purple-600', text: 'text-white' },
    { bg: 'bg-pink-500', border: 'border-pink-600', hover: 'hover:bg-pink-600', text: 'text-white' },
    { bg: 'bg-rose-500', border: 'border-rose-600', hover: 'hover:bg-rose-600', text: 'text-white' },
    { bg: 'bg-orange-500', border: 'border-orange-600', hover: 'hover:bg-orange-600', text: 'text-white' },
    { bg: 'bg-amber-500', border: 'border-amber-600', hover: 'hover:bg-amber-600', text: 'text-white' },
    { bg: 'bg-emerald-500', border: 'border-emerald-600', hover: 'hover:bg-emerald-600', text: 'text-white' },
    { bg: 'bg-teal-500', border: 'border-teal-600', hover: 'hover:bg-teal-600', text: 'text-white' },
    { bg: 'bg-cyan-500', border: 'border-cyan-600', hover: 'hover:bg-cyan-600', text: 'text-white' },
    { bg: 'bg-sky-500', border: 'border-sky-600', hover: 'hover:bg-sky-600', text: 'text-white' },
    { bg: 'bg-none', border: 'border-sky-600', hover: 'hover:bg-sky-600', text: 'text-white' }, // Intentionally keeping colors logic same if used elsewhere
];

// Video Preview Tooltip Component
const VideoPreviewTooltip = ({ src, startTime, endTime, x, y }: { src: string, startTime: number, endTime: number, x: number, y: number }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Initial Seek
        video.currentTime = startTime;

        const handleTimeUpdate = () => {
            if (video.currentTime >= endTime) {
                video.currentTime = startTime;
                video.play().catch(() => { });
            }
        };

        video.addEventListener('timeupdate', handleTimeUpdate);

        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Auto-play prevented", error);
            });
        }

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.pause();
        };
    }, [src, startTime, endTime]);

    // Position adjustment to keep inside viewport
    // Assuming fixed width around 240px
    const style: React.CSSProperties = {
        position: 'fixed',
        left: x,
        top: y,
        transform: 'translate(-50%, -110%)', // Centered horizontally above the cursor
        zIndex: 100,
        pointerEvents: 'none'
    };

    return (
        <div style={style} className="bg-black rounded-lg shadow-xl overflow-hidden border border-gray-700 w-64 aspect-video relative">
            <video
                ref={videoRef}
                src={src}
                className="w-full h-full object-cover"
                // Muted removed to allow audio preview
                preload="auto"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 text-center">
                Preview {startTime.toFixed(1)}s - {endTime.toFixed(1)}s
            </div>
        </div>
    );
};

export default function TimelineEditor({
    duration,
    subtitles,
    onUpdateSubtitle,
    onSeek,
    excludedSubtitleIds,
    onToggleExclude,
    videoElement,
    currentTime: externalCurrentTime,
    videoFileName,
    isPlaying = false,
    onPlayPause,
    onSplitSubtitle,
    onDeleteSubtitle,
    videoClips: externalClips,
    onUpdateVideoClips,
    onFrameExtractionChange,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
    onDropFile,
    onDropAsset,
    isCutMode = false,
    audioClips,
    onUpdateAudioClips,
    isAudioSeparated,
    onStartScrub,
    onEndScrub,
    onPreviewFrame
}: TimelineEditorProps) {
    // Debug: Log isCutMode changes
    useEffect(() => {
        console.log('[TimelineEditor] isCutMode prop changed:', isCutMode);
    }, [isCutMode]);

    // Timeline State
    const [pxPerSec, setPxPerSec] = useState(100);
    const [hasInitializedZoom, setHasInitializedZoom] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState<{ id: string, type: 'left' | 'right' | 'move', target: 'clip' | 'subtitle' | 'audio', startX: number, originalStart: number, originalEnd: number, currentX?: number, currentY?: number, mouseX?: number, mouseY?: number, screenStartX?: number, screenStartY?: number, screenX?: number, screenY?: number, grabOffsetX?: number, grabOffsetY?: number, stickyLayer?: number, visualOffsetY?: number, originalLayer?: number } | null>(null);
    const isDraggingRef = useRef(isDragging); // Ref to avoid stale closure in event handlers
    isDraggingRef.current = isDragging; // Keep ref in sync with state
    const wasPlayingRef = useRef(false); // Track play state for scrubbing
    const [dropIndicator, setDropIndicator] = useState<{ time: number, layer: number, gapIndex?: number, gapSize?: number } | null>(null);
    const [audioDropIndicator, setAudioDropIndicator] = useState<{ layer: number, gapIndex: number, gapSize: number } | null>(null);

    // Direct DOM Refs for Drag Optimization
    const dragProxyRef = useRef<HTMLDivElement>(null);
    const dropIndicatorRef = useRef<HTMLDivElement>(null); // For free mode red line optimization

    // Real-time Trim DOM Refs
    // Trim refs removed - now using React state for trim updates

    // CapCut-style Timeline Mode Toggles
    const [magnetMode, setMagnetMode] = useState(true); // 메인트랙 마그넷: clips auto-condense (no gaps)
    const [snapMode, setSnapMode] = useState(true); // 자동스냅: clips snap to edges/playhead
    const [linkMode, setLinkMode] = useState(true); // 연결: audio-video clips move together

    // Snap Indicator State - shows yellow line when snapping
    const [snapIndicator, setSnapIndicator] = useState<{ type: 'playhead' | 'clip-start' | 'clip-end', time: number } | null>(null);

    // Global Drag Overlay State - stores visual data for the dragged clip
    const [dragOverlayData, setDragOverlayData] = useState<DragOverlayData | null>(null);

    const [isScrubbing, setIsScrubbing] = useState(false);
    const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
    // Removed old dropIndicatorTime to avoid confusion

    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    // ... (unchanged lines)

    // ... (inside handleMouseMove)

    const [selectedAudioClipId, setSelectedAudioClipId] = useState<string | null>(null);

    const [frameThumbnails, setFrameThumbnails] = useState<string[]>([]);
    const [thumbnailAspectRatio, setThumbnailAspectRatio] = useState(16 / 9);
    const [isGeneratingFrames, setIsGeneratingFrames] = useState(false);
    const isGeneratingFramesRef = useRef(false); // Ref for abort check in loop

    // Audio Waveform State (Stereo: L/R channels)
    const [audioWaveformL, setAudioWaveformL] = useState<number[]>([]);
    const [audioWaveformR, setAudioWaveformR] = useState<number[]>([]);
    const [isGeneratingWaveform, setIsGeneratingWaveform] = useState(false);
    const audioTrackCanvasRef = useRef<HTMLCanvasElement>(null);
    const [rulerScale, setRulerScale] = useState(1);

    // Removed internal unlinkedAudioClips state in favor of prop
    // const [unlinkedAudioClips, setUnlinkedAudioClips] = useState<AudioClip[]>([]);

    // Context Menu
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'clip' | 'subtitle' | 'audio', id: string } | null>(null);

    // Using internal clips state for optimistic updates, synced with external
    const [videoClips, setVideoClips] = useState<VideoClip[]>(externalClips);
    const [localAudioClips, setLocalAudioClips] = useState<AudioClip[]>(audioClips);

    // Ref for async operations to get latest videoClips without stale closures
    const videoClipsRef = useRef(videoClips);
    videoClipsRef.current = videoClips;

    // Clipboard for copy/paste (stores copied clip data)
    const clipboardRef = useRef<{ type: 'video' | 'audio', clip: VideoClip | AudioClip } | null>(null);

    useEffect(() => {
        setVideoClips(externalClips);
    }, [externalClips]);

    // Clear frame thumbnails when clips change significantly (forces re-extraction for multi-clip)
    const prevClipIdsRef = useRef<string>('');
    useEffect(() => {
        const newClipIds = externalClips.map(c => c.id).join(',');
        if (prevClipIdsRef.current && prevClipIdsRef.current !== newClipIds && frameThumbnails.length > 0) {
            console.log('[TimelineEditor] Clips changed, clearing frame thumbnails for re-extraction');
            setFrameThumbnails([]);
        }
        prevClipIdsRef.current = newClipIds;
    }, [externalClips, frameThumbnails.length]);

    useEffect(() => {
        setLocalAudioClips(audioClips);
    }, [audioClips]);

    // Adaptive initial zoom based on video duration
    // Calculate pxPerSec so video fits in ~80% of viewport width
    useEffect(() => {
        if (hasInitializedZoom || duration <= 0 || !containerRef.current) return;

        const viewportWidth = containerRef.current.clientWidth - 80; // Subtract header column and padding
        const targetWidth = viewportWidth * 0.5; // Use 50% of available width for comfortable editing

        // Calculate pxPerSec to fit the video in targetWidth
        let adaptiveZoom = targetWidth / duration;

        // Clamp to valid range (5-500)
        adaptiveZoom = Math.max(5, Math.min(500, adaptiveZoom));

        // Round to nice value
        adaptiveZoom = Math.round(adaptiveZoom);

        console.log(`[Zoom] Adaptive zoom for ${duration}s video: ${adaptiveZoom} px/sec`);
        setPxPerSec(adaptiveZoom);
        setHasInitializedZoom(true);
    }, [duration, hasInitializedZoom]);



    // Native wheel event listener for timeline zoom (prevents browser zoom)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            // Ctrl + Wheel for zoom (includes trackpad pinch)
            if (e.ctrlKey) {
                e.preventDefault(); // Block browser zoom

                // Zoom in/out based on wheel direction
                // pxPerSec range: 5-500, delta should be proportional
                const zoomDelta = e.deltaY > 0 ? -10 : 10; // Scroll down = zoom out, up = zoom in
                setPxPerSec(prev => Math.max(5, Math.min(500, prev + zoomDelta)));
            }
            // Alt + Wheel for horizontal pan (CapCut style)
            else if (e.altKey) {
                e.preventDefault(); // Block browser back/forward navigation

                // Pan left/right based on wheel direction
                const panDelta = e.deltaY > 0 ? 100 : -100; // Scroll down = pan right, up = pan left
                container.scrollLeft += panDelta;
            }
        };

        // Must use passive: false to allow preventDefault
        container.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, []);

    // NOTE: Auto-condense removed for performance. Clips are condensed only on drop (handleMouseUp).

    // Dynamic Layers Logic: Show only layers that have clips
    // Extra layer for new track is created on DROP, not during drag
    // (Prevents layout shift that causes clip to separate from mouse)
    const renderLayers = useMemo(() => {
        // Find max used layer
        const maxLayer = Math.max(0, ...videoClips.map(c => c.layer || 0));

        // Generate layers from 0 to maxLayer, REVERSED so V1 is at bottom
        return Array.from({ length: maxLayer + 1 }, (_, i) => i).reverse();
    }, [videoClips]);

    // Dynamic Audio Layers Logic: Show only layers that have clips
    // Extra layer for new track is created on DROP, not during drag
    const audioRenderLayers = useMemo(() => {
        const maxAudioLayer = Math.max(0, ...localAudioClips.map(c => c.layer || 0));

        // Array from 0 to maxAudioLayer (A1 at top, higher layers below)
        return Array.from({ length: maxAudioLayer + 1 }, (_, i) => i);
    }, [localAudioClips]);

    // Lift state up when drag ends
    const handleDragEndSync = useCallback(() => {
        if (isDragging?.target === 'clip') {
            onUpdateVideoClips(videoClips);
        } else if (isDragging?.target === 'audio') {
            onUpdateAudioClips(localAudioClips);
        }
    }, [isDragging, videoClips, localAudioClips, onUpdateVideoClips, onUpdateAudioClips]);

    // Marquee Selection State
    const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
    const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);
    const [interactionMode, setInteractionMode] = useState<'none' | 'scrub' | 'select-candidate' | 'selecting'>('none');
    const interactionStartRef = useRef<{ x: number, y: number } | null>(null);

    // Sync single selection to multi-selection (compatibility) - includes audio clips
    useEffect(() => {
        if (selectedClipId) {
            setSelectedClipIds(new Set([selectedClipId]));
        } else if (selectedAudioClipId) {
            setSelectedClipIds(new Set([selectedAudioClipId]));
        } else if (selectedClipIds.size === 0) {
            // No selection
        }
    }, [selectedClipId, selectedAudioClipId]);

    // Derived single ID for backward compatibility properties (like property panel)
    // If multiple selected, maybe we just show the first one or null
    // IMPORTANT: Only sync VIDEO clip IDs to selectedClipId, not audio clip IDs
    useEffect(() => {
        if (selectedClipIds.size === 1) {
            const id = Array.from(selectedClipIds)[0];
            // Check if this ID belongs to a video clip (not audio)
            const isVideoClip = videoClips.some(c => c.id === id);
            if (isVideoClip) {
                if (id !== selectedClipId) setSelectedClipId(id);
            } else {
                // It's an audio clip - make sure selectedClipId is null
                if (selectedClipId !== null) setSelectedClipId(null);
            }
        } else if (selectedClipIds.size > 1) {
            // If multiple, strictly separate from 'selectedClipId' which might be used for single-clip props??
            // For now, let's keep selectedClipId as the "primary" selection if valid
            if (!selectedClipIds.has(selectedClipId || '')) setSelectedClipId(null);
        } else {
            if (selectedClipId) setSelectedClipId(null);
        }
    }, [selectedClipIds, videoClips]);

    // Smooth playhead & Scrubbing state
    const playheadRef = useRef<HTMLDivElement>(null);
    const prevPlayheadTimeRef = useRef<number>(0); // Track previous time to prevent backward jumps

    // Sequencer State
    const activeClipRef = useRef<VideoClip | null>(null);
    const currentSrcRef = useRef<string | null>(null);

    // Initial Sync on Mount/Update
    useEffect(() => {
        if (videoClips.length > 0 && !activeClipRef.current) {
            activeClipRef.current = videoClips[0];
            currentSrcRef.current = videoClips[0].src || null;
        }
    }, [videoClips]);

    // Smooth playhead animation loop
    useEffect(() => {
        let animationFrameId: number;

        const updatePlayhead = () => {
            let time: number;

            // SIMPLIFIED PLAYHEAD LOGIC:
            // 1. Always trust externalCurrentTime as the authoritative source
            // 2. Use video.currentTime only for smooth interpolation when safe
            // 3. Avoid complex clip matching that can fail at boundaries

            // Check if we're in a gap or transition (video paused while playing)
            const isInGapOrTransition = isPlaying && videoElement?.paused && externalCurrentTime !== undefined;

            if (isInGapOrTransition) {
                // Gap/transition: use externalCurrentTime directly (updated at 60fps by gap timer)
                time = externalCurrentTime;
            } else if (isPlaying && videoElement && !videoElement.paused && externalCurrentTime !== undefined) {
                // Normal clip playback: use externalCurrentTime as base, interpolate with video.currentTime
                const vTime = videoElement.currentTime;

                // Find the expected clip based on externalCurrentTime (source of truth)
                const expectedClip = videoClips.find(c =>
                    externalCurrentTime >= c.startTime && externalCurrentTime < c.endTime &&
                    (c.layer === 0 || c.layer === undefined)
                );

                if (expectedClip) {
                    // Check if video.currentTime is within expected range for this clip
                    const vTimeInClipRange = vTime >= expectedClip.sourceStart - 0.1 && vTime < expectedClip.sourceEnd + 0.1;

                    if (vTimeInClipRange) {
                        // Safe to use video.currentTime for smooth interpolation
                        time = expectedClip.startTime + (vTime - expectedClip.sourceStart);
                    } else {
                        // Video position doesn't match expected clip - use externalCurrentTime
                        // This can happen during transitions or when seeking
                        time = externalCurrentTime;
                    }
                } else {
                    // No clip found at externalCurrentTime - might be in gap or at boundary
                    time = externalCurrentTime;
                }
            } else if (isPlaying && externalCurrentTime !== undefined) {
                // Fallback for playing state
                time = externalCurrentTime;
            } else if (isPlaying && videoElement && videoClips.length > 0) {
                // SEQUENCER LOGIC:
                // 1. Determine Current Clip based on last known time or continuity
                let clip = activeClipRef.current;

                // Safety: If no clip, find one at 0
                if (!clip) {
                    clip = videoClips.find(c => c.startTime === 0) || videoClips[0];
                    activeClipRef.current = clip;
                }

                if (clip) {
                    const vTime = videoElement.currentTime;
                    // Calculate Global Time: Start of Clip + (Progress in Source)
                    // Note: sourceStart is where the clip BEGINS in the source file
                    time = clip.startTime + (vTime - clip.sourceStart);

                    // 2. Autoswitch / Limit Check
                    // If we exceeded the clip's duration on timeline
                    if (time >= clip.endTime - 0.05) { // 50ms buffer to switch cleanly
                        const nextClip = videoClips.find(c => Math.abs(c.startTime - clip!.endTime) < 0.1); // Contiguous next

                        if (nextClip && nextClip.src) {
                            console.log(`[Sequencer] Switching to next clip: ${nextClip.name}`);

                            // Switch Source
                            if (currentSrcRef.current !== nextClip.src) {
                                videoElement.src = nextClip.src;
                                currentSrcRef.current = nextClip.src;
                            }

                            // Seek to start of next clip
                            videoElement.currentTime = nextClip.sourceStart;

                            // Update Ref
                            activeClipRef.current = nextClip;

                            // Continue playing
                            videoElement.play().catch(e => console.warn("Autoplay blocked", e));

                            // Adjust time to exact start of next to avoid jitter
                            time = nextClip.startTime;
                        } else {
                            // End of timeline or gap
                            // For now, let it pause or just loop? 
                            // Standard behavior: Stop at end of last clip
                            /* 
                            if (!nextClip) {
                               onPlayPause(); // Pause
                            }
                            */
                        }
                    }
                } else {
                    time = videoElement.currentTime; // Fallback
                }

                // Gap Muting Logic
                // ... (Existing Muting Logic can use calculated 'time')
                const hasVideoAudio = clip && clip.hasAudio !== false; // Simplified for active clip
                const hasAudioClip = localAudioClips.some(c => time >= c.startTime && time < c.endTime);
                const shouldPlayAudio = hasVideoAudio || hasAudioClip;
                if (videoElement.muted === shouldPlayAudio) videoElement.muted = !shouldPlayAudio;

            } else {
                // When paused or scrubbing, use the React state/prop for precision
                time = externalCurrentTime !== undefined ? externalCurrentTime : (videoElement?.currentTime || 0);
            }

            if (playheadRef.current && (isPlaying || externalCurrentTime !== undefined) && !isScrubbing) {
                // ANTI-JITTER: Prevent backward jumps during playback
                // If playing and time jumps backward more than threshold, keep previous position
                const maxBackwardJump = 0.1; // seconds (tighter threshold)
                if (isPlaying && prevPlayheadTimeRef.current > 0) {
                    const timeDiff = time - prevPlayheadTimeRef.current;
                    if (timeDiff < -maxBackwardJump) {
                        // Backward jump detected - keep previous time and advance slightly
                        time = prevPlayheadTimeRef.current + 0.016; // ~1 frame forward
                    }
                }

                // Update ref only when playing, reset when paused so next play starts fresh
                if (isPlaying) {
                    prevPlayheadTimeRef.current = time;
                } else {
                    prevPlayheadTimeRef.current = 0;
                }

                const currentPx = time * pxPerSec;
                playheadRef.current.style.left = `${currentPx}px`; // marginLeft: 40 handles the offset
            }
            animationFrameId = requestAnimationFrame(updatePlayhead);
        };

        animationFrameId = requestAnimationFrame(updatePlayhead);
        return () => cancelAnimationFrame(animationFrameId);
    }, [videoElement, isPlaying, pxPerSec, isScrubbing, externalCurrentTime, videoClips, localAudioClips]);

    // Total timeline width - ensure ruler extends across visible area and beyond
    // Add extra 30 seconds or at least fill the viewport width
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const totalWidth = Math.max((duration + 30) * pxPerSec, viewportWidth * 2);

    // Multi-clip Frame Extraction (Per Clip)
    const extractFramesForClip = useCallback(async (clip: VideoClip) => {
        console.log('[FrameDebug] Extractor called for:', clip.id, clip.src);
        if (!clip.src) return null;

        // Setup minimal video/canvas for extraction
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        // Use proxy for CORS
        video.src = clip.src.startsWith('http')
            ? `/api/proxy-video?url=${encodeURIComponent(clip.src)}`
            : clip.src;

        await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            video.onerror = () => resolve(); // Continue even if load fails to avoid blocking
            video.load();
        });

        // If metadata failed to load properly
        if (video.videoWidth === 0) return null;

        // Detect and set aspect ratio from video dimensions
        const videoRatio = video.videoWidth / video.videoHeight;
        setThumbnailAspectRatio(videoRatio);

        const duration = clip.sourceEnd - clip.sourceStart;
        if (duration <= 0) return null;

        // Extract frames for the USED duration (sourceStart to sourceEnd)
        const frameCount = 10; // Fixed number of frames for consistent thumbnails
        const extractedFrames: string[] = [];

        // Dynamic canvas size based on video aspect ratio
        const canvas = document.createElement('canvas');
        if (videoRatio >= 1) {
            // Landscape or square video
            canvas.width = 160;
            canvas.height = Math.round(160 / videoRatio);
        } else {
            // Portrait video (9:16 etc)
            canvas.height = 160;
            canvas.width = Math.round(160 * videoRatio);
        }
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return null;

        for (let i = 0; i < frameCount; i++) {
            const offset = (i / frameCount) * duration;
            const targetTime = clip.sourceStart + offset;

            video.currentTime = targetTime;
            await new Promise<void>(resolve => {
                const onSeek = () => {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    extractedFrames.push(canvas.toDataURL('image/jpeg', 0.5));
                    resolve();
                };
                video.addEventListener('seeked', onSeek, { once: true });
                // Fallback timeout
                setTimeout(resolve, 500);
            });
        }

        // Return both frames AND ratio for synchronous use (avoids state timing issues)
        return { frames: extractedFrames, ratio: videoRatio };
    }, []);

    // Effect to trigger extraction for clips that don't have frames yet
    useEffect(() => {
        if (videoClips.length === 0) return;

        const processClips = async () => {
            // Find clips that need frame extraction from current state
            const clipsNeedingFrames = videoClips.filter(
                clip => clip.src && (!clip.frames || clip.frames.length === 0)
            );

            for (const clip of clipsNeedingFrames) {
                if (isGeneratingFramesRef.current) continue;

                console.log('[FrameExtract] Extracting for clip:', clip.id);
                isGeneratingFramesRef.current = true;
                onFrameExtractionChange?.(true);

                try {
                    const result = await extractFramesForClip(clip);
                    if (result && result.frames.length > 0) {
                        // Use ref to get latest state and only update frames/ratio
                        onUpdateVideoClips(videoClipsRef.current.map(c =>
                            c.id === clip.id ? { ...c, frames: result.frames, ratio: result.ratio } : c
                        ));
                    }
                } catch (e) {
                    console.error('[FrameExtract] Failed for clip:', clip.name, e);
                } finally {
                    isGeneratingFramesRef.current = false;
                    onFrameExtractionChange?.(false);
                }
            }
        };

        const timer = setTimeout(processClips, 1000);
        return () => clearTimeout(timer);

    }, [videoClips, extractFramesForClip, onUpdateVideoClips, onFrameExtractionChange]);

    // Audio Waveform Extraction (Stereo L/R)
    const generateAudioWaveform = useCallback(async () => {
        if (!videoElement || isGeneratingWaveform || !videoElement.src) return;

        setIsGeneratingWaveform(true);
        console.log('[Waveform] Starting stereo audio waveform extraction...');

        try {
            const audioContext = new AudioContext();
            const response = await fetch(videoElement.src);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const samples = Math.ceil(duration * 50); // 50 samples per second for high detail
            const leftChannel = audioBuffer.getChannelData(0);
            const rightChannel = audioBuffer.numberOfChannels > 1
                ? audioBuffer.getChannelData(1)
                : leftChannel; // Fallback to mono

            const blockSize = Math.floor(leftChannel.length / samples);
            const waveformL: number[] = [];
            const waveformR: number[] = [];

            for (let i = 0; i < samples; i++) {
                let maxL = 0, maxR = 0;
                const start = i * blockSize;
                for (let j = 0; j < blockSize; j++) {
                    const absL = Math.abs(leftChannel[start + j] || 0);
                    const absR = Math.abs(rightChannel[start + j] || 0);
                    if (absL > maxL) maxL = absL;
                    if (absR > maxR) maxR = absR;
                }
                waveformL.push(maxL);
                waveformR.push(maxR);
            }

            setAudioWaveformL(waveformL);
            setAudioWaveformR(waveformR);
            console.log('[Waveform] Stereo extraction complete:', waveformL.length, 'samples per channel');
            audioContext.close();
        } catch (e) {
            console.error('[Waveform] Failed to extract waveform:', e);
        } finally {
            setIsGeneratingWaveform(false);
        }
    }, [videoElement, duration, isGeneratingWaveform]);

    // Trigger waveform generation after video loads
    useEffect(() => {
        if (videoElement && duration > 0 && audioWaveformL.length === 0 && !isGeneratingWaveform) {
            const timer = setTimeout(() => {
                generateAudioWaveform();
            }, 800); // Start after frame extraction
            return () => clearTimeout(timer);
        }
    }, [videoElement, duration, audioWaveformL.length, isGeneratingWaveform, generateAudioWaveform]);

    // Generate waveform for a specific video clip (per-clip waveform extraction)
    const generateClipWaveform = useCallback(async (clip: VideoClip) => {
        if (!clip.src || clip.waveform) return; // Skip if no source or already has waveform

        console.log('[Waveform] Extracting waveform for clip:', clip.id);

        try {
            const audioContext = new AudioContext();
            const response = await fetch(clip.src);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const clipDuration = clip.sourceEnd - clip.sourceStart;
            const samples = Math.ceil(clipDuration * 50); // 50 samples per second
            const leftChannel = audioBuffer.getChannelData(0);

            // Calculate sample offset based on source start time
            const sampleRate = audioBuffer.sampleRate;
            const startSample = Math.floor(clip.sourceStart * sampleRate);
            const totalClipSamples = Math.floor(clipDuration * sampleRate);
            const blockSize = Math.floor(totalClipSamples / samples);

            const waveform: number[] = [];

            for (let i = 0; i < samples; i++) {
                let max = 0;
                const start = startSample + (i * blockSize);
                for (let j = 0; j < blockSize; j++) {
                    const abs = Math.abs(leftChannel[start + j] || 0);
                    if (abs > max) max = abs;
                }
                waveform.push(max);
            }

            // Update the video clip with the extracted waveform
            // Use ref to get latest videoClips state to avoid overwriting user changes
            onUpdateVideoClips(videoClipsRef.current.map(c =>
                c.id === clip.id ? { ...c, waveform } : c
            ));

            console.log('[Waveform] Clip waveform extracted:', clip.id, waveform.length, 'samples');
            audioContext.close();
        } catch (e) {
            console.error('[Waveform] Failed to extract clip waveform:', clip.id, e);
        }
    }, [onUpdateVideoClips]); // Remove videoClips from deps since we use ref

    // Auto-extract waveform for clips that don't have one
    useEffect(() => {
        videoClips.forEach(clip => {
            if (clip.src && !clip.waveform && clip.hasAudio !== false) {
                // Delay to avoid overwhelming with multiple extractions
                const timer = setTimeout(() => {
                    generateClipWaveform(clip);
                }, 1000 + Math.random() * 500); // Stagger extractions
                return () => clearTimeout(timer);
            }
        });
    }, [videoClips, generateClipWaveform]);

    // Render mono waveform to A1 track canvas (Premiere Pro style - upward bars)
    useEffect(() => {
        if (!audioTrackCanvasRef.current || audioWaveformL.length === 0) return;

        const canvas = audioTrackCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const containerWidth = totalWidth;
        const height = 36; // Compact height
        canvas.width = containerWidth;
        canvas.height = height;

        // Dark background
        ctx.fillStyle = '#1e293b'; // slate-800
        ctx.fillRect(0, 0, containerWidth, height);

        const videoEndPx = duration * pxPerSec;
        const pixelsToRender = Math.min(containerWidth, videoEndPx);
        const samplesPerPixel = audioWaveformL.length / (duration * pxPerSec);

        // Premiere Pro blue color
        const waveColor = '#38bdf8'; // sky-400

        // Draw mono waveform (upward from bottom)
        ctx.fillStyle = waveColor;
        for (let x = 0; x < pixelsToRender; x++) {
            const sampleIndex = Math.floor(x * samplesPerPixel);
            const amplitude = audioWaveformL[Math.min(sampleIndex, audioWaveformL.length - 1)] || 0;
            const barHeight = amplitude * (height - 4); // Leave 2px margin
            ctx.fillRect(x, height - 2 - barHeight, 1, barHeight);
        }

        // Dark area after video ends
        if (videoEndPx < containerWidth) {
            ctx.fillStyle = '#0f172a'; // slate-900
            ctx.fillRect(videoEndPx, 0, containerWidth - videoEndPx, height);
        }

    }, [audioWaveformL, totalWidth, pxPerSec, duration]);

    const handleZoomIn = () => setPxPerSec(prev => Math.min(prev * 1.5, 500));
    const handleZoomOut = () => setPxPerSec(prev => Math.max(prev / 1.5, 20));

    // Handle audio unlink from video clip
    const handleUnlinkAudio = useCallback((clipId: string) => {
        const clip = videoClips.find(c => c.id === clipId);
        if (!clip) return;

        // Find the first layer without time conflict
        const findAvailableLayer = () => {
            for (let layer = 0; layer < 10; layer++) { // Check up to 10 layers
                const clipsInLayer = localAudioClips.filter(a => (a.layer || 0) === layer);
                const hasConflict = clipsInLayer.some(existing =>
                    // Check if time ranges overlap
                    !(clip.endTime <= existing.startTime || clip.startTime >= existing.endTime)
                );
                if (!hasConflict) {
                    return layer;
                }
            }
            return 0; // Fallback to layer 0
        };

        const targetLayer = findAvailableLayer();

        // Get waveform data - from clip or extract from global
        let waveformForAudio: number[] | undefined = clip.waveform;

        // If video clip doesn't have waveform, extract from global audioWaveformL
        if (!waveformForAudio || waveformForAudio.length === 0) {
            if (audioWaveformL.length > 0 && duration > 0) {
                const clipStartRatio = clip.sourceStart / duration;
                const clipEndRatio = clip.sourceEnd / duration;
                const startIdx = Math.floor(clipStartRatio * audioWaveformL.length);
                const endIdx = Math.floor(clipEndRatio * audioWaveformL.length);
                waveformForAudio = audioWaveformL.slice(startIdx, Math.max(endIdx, startIdx + 1));
                console.log('[Audio] Extracted waveform from global:', waveformForAudio.length, 'samples from range', startIdx, '-', endIdx);
            }
        }

        // Create new audio clip with waveform from source video
        const newAudioClip: AudioClip = {
            id: `audio-${clipId}-${Date.now()}`,
            videoClipId: clipId,
            startTime: clip.startTime,
            endTime: clip.endTime,
            sourceStart: clip.sourceStart,
            sourceEnd: clip.sourceEnd,
            layer: targetLayer, // Auto-assign to non-overlapping layer
            waveform: waveformForAudio, // Copy waveform
        };

        // Add to unlinked audio clips
        const newAudioClipsList = [...localAudioClips, newAudioClip];
        setLocalAudioClips(newAudioClipsList);
        onUpdateAudioClips(newAudioClipsList); // Sync immediately for unlink

        // Mark video clip as having no audio
        onUpdateVideoClips(videoClips.map(c =>
            c.id === clipId ? { ...c, hasAudio: false } : c
        ));

        setContextMenu(null);
        console.log('[Audio] Unlinked audio from clip to layer A' + (targetLayer + 1) + ':', clipId);
    }, [videoClips, localAudioClips, onUpdateAudioClips, onUpdateVideoClips, setContextMenu]);

    // Handle audio relink to video clip
    const handleRelinkAudio = useCallback((audioClipId: string) => {
        const audioClip = localAudioClips.find(a => a.id === audioClipId);
        if (!audioClip) return;

        // Remove from unlinked clips
        const newAudioClipsList = localAudioClips.filter(a => a.id !== audioClipId);
        setLocalAudioClips(newAudioClipsList);
        onUpdateAudioClips(newAudioClipsList); // Sync immediately

        // Restore audio to video clip
        onUpdateVideoClips(videoClips.map(c =>
            c.id === audioClip.videoClipId ? { ...c, hasAudio: true } : c
        ));

        setContextMenu(null);
        console.log('[Audio] Relinked audio to clip:', audioClip.videoClipId);
    }, [localAudioClips, onUpdateAudioClips, onUpdateVideoClips, videoClips, setContextMenu]);

    // Simple helpers
    const getAdjacentSubtitles = (id: string) => {
        const sortedSubs = [...subtitles].sort((a, b) => a.startTime - b.startTime);
        const currentIndex = sortedSubs.findIndex(s => s.id === id);
        const prevSub = currentIndex > 0 ? sortedSubs[currentIndex - 1] : null;
        const nextSub = currentIndex < sortedSubs.length - 1 ? sortedSubs[currentIndex + 1] : null;
        return { prevSub, nextSub };
    };

    const getAdjacentClips = (id: string, layer: number) => {
        const sortedClips = videoClips
            .filter(c => (c.layer || 0) === layer)
            .sort((a, b) => a.startTime - b.startTime);
        const currentIndex = sortedClips.findIndex(c => c.id === id);
        const prevClip = currentIndex > 0 ? sortedClips[currentIndex - 1] : null;
        const nextClip = currentIndex < sortedClips.length - 1 ? sortedClips[currentIndex + 1] : null;
        return { prevClip, nextClip };
    };

    const getAdjacentAudioClips = (id: string) => {
        const sortedClips = localAudioClips.sort((a, b) => a.startTime - b.startTime);
        const currentIndex = sortedClips.findIndex(c => c.id === id);
        const prevClip = currentIndex > 0 ? sortedClips[currentIndex - 1] : null;
        const nextClip = currentIndex < sortedClips.length - 1 ? sortedClips[currentIndex + 1] : null;
        return { prevClip, nextClip };
    };

    // ============================================================
    // CLEAN DRAG LOGIC - Uses ref to avoid stale closure
    // ============================================================
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const drag = isDraggingRef.current;
            if (!drag || !containerRef.current) return;

            const containerRect = containerRef.current.getBoundingClientRect();
            const deltaX = e.clientX - drag.startX;
            const deltaTime = deltaX / pxPerSec;

            // Get clip for all operations
            const clip = videoClips.find(c => c.id === drag.id);

            // ====== LEFT TRIM (adjust start) ======
            if (drag.type === 'left' && drag.target === 'clip') {
                if (!clip) return;

                // Calculate new start time
                let newStart = drag.originalStart + deltaTime;
                const minDuration = 0.1; // Minimum clip duration (100ms)

                // Clamp: can't go before 0, can't go past end - minDuration
                newStart = Math.max(0, Math.min(newStart, drag.originalEnd - minDuration));

                // Calculate the effective delta (after clamping)
                const effectiveDelta = newStart - drag.originalStart;

                // Update both ref and state for React to render correctly
                isDraggingRef.current = { ...drag, currentX: effectiveDelta };
                setIsDragging({ ...drag, currentX: effectiveDelta });
                return;
            }

            // ====== RIGHT TRIM (adjust end) ======
            if (drag.type === 'right' && drag.target === 'clip') {
                if (!clip) return;

                // Calculate new end time
                let newEnd = drag.originalEnd + deltaTime;
                const minDuration = 0.1; // Minimum clip duration (100ms)

                // Clamp: can't go before start + minDuration
                newEnd = Math.max(drag.originalStart + minDuration, newEnd);

                // Calculate available extension based on source duration
                const currentSourceEnd = clip.sourceEnd ?? (clip.endTime - clip.startTime);
                const fullSourceDuration = clip.sourceDuration ?? currentSourceEnd;
                const maxExtension = fullSourceDuration - currentSourceEnd;

                // Only block EXTENDING when at max source length, allow SHRINKING
                if (deltaTime > 0 && maxExtension <= 0) {
                    // Trying to extend but already at max - keep at original
                    newEnd = drag.originalEnd;
                } else if (deltaTime > 0) {
                    // Extending - limit to maxExtension
                    newEnd = Math.min(newEnd, drag.originalEnd + maxExtension);
                }
                // deltaTime <= 0 means shrinking - always allowed

                // Calculate the effective delta (after clamping)
                const effectiveDelta = newEnd - drag.originalEnd;

                // Update both ref and state for React to render correctly
                isDraggingRef.current = { ...drag, currentX: effectiveDelta };
                setIsDragging({ ...drag, currentX: effectiveDelta });
                return;
            }

            // ====== AUDIO LEFT TRIM (adjust start) ======
            if (drag.type === 'left' && drag.target === 'audio') {
                const audioClip = localAudioClips.find(c => c.id === drag.id);
                if (!audioClip) return;

                // Calculate new start time
                let newStart = drag.originalStart + deltaTime;
                const minDuration = 0.1; // Minimum clip duration (100ms)

                // Clamp: can't go before 0, can't go past end - minDuration
                newStart = Math.max(0, Math.min(newStart, drag.originalEnd - minDuration));

                // Calculate the effective delta (after clamping)
                const effectiveDelta = newStart - drag.originalStart;

                // Update both ref and state for React to render correctly
                isDraggingRef.current = { ...drag, currentX: effectiveDelta };
                setIsDragging({ ...drag, currentX: effectiveDelta });
                return;
            }

            // ====== AUDIO RIGHT TRIM (adjust end) ======
            if (drag.type === 'right' && drag.target === 'audio') {
                const audioClip = localAudioClips.find(c => c.id === drag.id);
                if (!audioClip) return;

                // Calculate new end time
                let newEnd = drag.originalEnd + deltaTime;
                const minDuration = 0.1; // Minimum clip duration (100ms)

                // Clamp: can't go before start + minDuration
                newEnd = Math.max(drag.originalStart + minDuration, newEnd);

                // Calculate available extension based on source duration
                const currentSourceEnd = audioClip.sourceEnd ?? (audioClip.endTime - audioClip.startTime);
                const fullSourceDuration = audioClip.sourceDuration ?? currentSourceEnd;
                const maxExtension = fullSourceDuration - currentSourceEnd;

                // Only block EXTENDING when at max source length, allow SHRINKING
                if (deltaTime > 0 && maxExtension <= 0) {
                    // Trying to extend but already at max - keep at original
                    newEnd = drag.originalEnd;
                } else if (deltaTime > 0) {
                    // Extending - limit to maxExtension
                    newEnd = Math.min(newEnd, drag.originalEnd + maxExtension);
                }
                // deltaTime <= 0 means shrinking - always allowed

                // Calculate the effective delta (after clamping)
                const effectiveDelta = newEnd - drag.originalEnd;

                // Update both ref and state for React to render correctly
                isDraggingRef.current = { ...drag, currentX: effectiveDelta };
                setIsDragging({ ...drag, currentX: effectiveDelta });
                return;
            }

            // ====== MOVE (existing logic) ======
            const clipDuration = drag.originalEnd - drag.originalStart;

            // Calculate new time position (only clamp to left edge, allow extending past duration)
            // Calculate new time position
            let newStart = drag.originalStart + deltaTime;
            if (newStart < 0) newStart = 0;

            let stickyLayer = drag.stickyLayer ?? drag.originalLayer ?? 0;
            let visualOffsetY = 0;
            const rawDeltaY = e.clientY - (drag.screenStartY || e.clientY);
            let originalLayer = drag.originalLayer ?? 0;

            if (drag.target === 'clip') {
                // Calculate target layer from mouse Y position with STICKY THRESHOLD (CapCut style)
                const mouseY = e.clientY - containerRect.top + containerRef.current.scrollTop;
                const headerHeight = 24 + 64 + 6; // Ruler + CC row + spacer
                // Use average height for layer switch calculation (V1=86, others=71)
                const avgTrackHeight = renderLayers.length === 1 ? 86 : 75;

                // Get original layer from clip'
                originalLayer = drag.originalLayer !== undefined ? drag.originalLayer : (clip?.layer ?? 0);
                stickyLayer = drag.stickyLayer !== undefined ? drag.stickyLayer : originalLayer;

                // CAPCUT STICKY BEHAVIOR
                const STICKY_THRESHOLD = 20;
                const trackSwitches = Math.floor((rawDeltaY + (rawDeltaY > 0 ? STICKY_THRESHOLD : -STICKY_THRESHOLD)) / avgTrackHeight);

                if (trackSwitches !== 0) {
                    const originalVisualIndex = renderLayers.indexOf(originalLayer);
                    if (originalVisualIndex >= 0) {
                        const newVisualIndex = Math.max(0, Math.min(renderLayers.length - 1, originalVisualIndex + trackSwitches));
                        stickyLayer = renderLayers[newVisualIndex] ?? originalLayer;
                    }
                } else {
                    stickyLayer = originalLayer;
                }

                // Calculate visualOffsetY using actual heights
                const originalVisualIndex = renderLayers.indexOf(originalLayer);
                const currentStickyVisualIndex = renderLayers.indexOf(stickyLayer);
                // V1 is 86px (80+6), others are 58px (52+6)
                let offsetY = 0;
                for (let i = Math.min(originalVisualIndex, currentStickyVisualIndex); i < Math.max(originalVisualIndex, currentStickyVisualIndex); i++) {
                    offsetY += (renderLayers[i] === 0) ? 86 : 71;
                }
                visualOffsetY = (currentStickyVisualIndex >= originalVisualIndex) ? offsetY : -offsetY;

                setDropIndicator({ time: newStart, layer: stickyLayer, gapIndex: -1, gapSize: clipDuration });
            } else if (drag.target === 'audio') {
                // AUDIO LOGIC
                const mouseY = e.clientY - containerRect.top + containerRef.current.scrollTop;
                const headerHeight = 24 + 64 + 6; // Ruler + CC
                const videoSectionHeight = headerHeight + (renderLayers.length * 70) + 6 + 6;
                const audioTrackHeight = 37;

                // Get original layer
                originalLayer = drag.originalLayer ?? 0;
                stickyLayer = drag.stickyLayer !== undefined ? drag.stickyLayer : originalLayer;

                const trackAreaY = mouseY - videoSectionHeight;
                let targetLayer = originalLayer;

                if (trackAreaY >= 0) {
                    targetLayer = Math.floor(trackAreaY / audioTrackHeight);
                    targetLayer = Math.max(0, targetLayer);
                } else {
                    targetLayer = 0;
                }

                stickyLayer = targetLayer;
                visualOffsetY = (stickyLayer - originalLayer) * audioTrackHeight;

                setAudioDropIndicator({ layer: stickyLayer, gapIndex: -1, gapSize: clipDuration });
            }

            setIsDragging(prev => prev ? {
                ...prev,
                currentX: deltaTime,
                currentY: rawDeltaY,
                screenX: e.clientX,
                screenY: e.clientY,
                stickyLayer: stickyLayer,
                visualOffsetY: visualOffsetY,
                originalLayer: originalLayer
            } : null);
        };

        const handleMouseUp = (e: MouseEvent) => {
            const drag = isDraggingRef.current;
            if (!drag) {
                setDropIndicator(null);
                setIsDragging(null);
                return;
            }

            const deltaX = e.clientX - drag.startX;
            const deltaTime = deltaX / pxPerSec;

            // Get clip for all operations
            const clip = videoClips.find(c => c.id === drag.id);

            // ====== LEFT TRIM (adjust start) ======
            if (drag.type === 'left' && drag.target === 'clip') {
                if (!clip) {
                    setDropIndicator(null);
                    setIsDragging(null);
                    return;
                }

                // Calculate new start time
                let newStart = drag.originalStart + deltaTime;
                const minDuration = 0.1;

                // Clamp
                newStart = Math.max(0, Math.min(newStart, drag.originalEnd - minDuration));

                // Calculate source shift
                const startShift = newStart - drag.originalStart;
                const newSourceStart = Math.max(0, (clip.sourceStart ?? 0) + startShift);

                // Update video clip
                const updatedClips = videoClips.map(c =>
                    c.id === drag.id
                        ? { ...c, startTime: newStart, sourceStart: newSourceStart }
                        : c
                );
                setVideoClips(updatedClips);
                onUpdateVideoClips(updatedClips);

                setDropIndicator(null);
                setIsDragging(null);
                return;
            }

            // ====== RIGHT TRIM (adjust end) ======
            if (drag.type === 'right' && drag.target === 'clip') {
                if (!clip) {
                    setDropIndicator(null);
                    setIsDragging(null);
                    return;
                }

                // Calculate new end time
                let newEnd = drag.originalEnd + deltaTime;
                const minDuration = 0.1;

                // Clamp: can't go before start + minDuration
                newEnd = Math.max(drag.originalStart + minDuration, newEnd);

                // Calculate new source end
                const endShift = newEnd - drag.originalEnd;
                const currentSourceEnd = clip.sourceEnd ?? (clip.endTime - clip.startTime);
                let newSourceEnd = Math.max(clip.sourceStart ?? 0, currentSourceEnd + endShift);

                // Calculate available extension based on source duration
                const fullSourceDuration = clip.sourceDuration ?? currentSourceEnd;
                const maxExtension = fullSourceDuration - currentSourceEnd;

                // Only block EXTENDING when at max source length, allow SHRINKING
                if (deltaTime > 0 && maxExtension <= 0) {
                    // Trying to extend but already at max - don't change
                    newEnd = drag.originalEnd;
                    newSourceEnd = currentSourceEnd;
                } else if (deltaTime > 0) {
                    // Extending - limit to maxExtension
                    newEnd = Math.min(newEnd, drag.originalEnd + maxExtension);
                    newSourceEnd = Math.min(newSourceEnd, fullSourceDuration);
                }
                // deltaTime <= 0 means shrinking - always allowed

                // Update video clip
                const updatedClips = videoClips.map(c =>
                    c.id === drag.id
                        ? { ...c, endTime: newEnd, sourceEnd: newSourceEnd }
                        : c
                );
                setVideoClips(updatedClips);
                onUpdateVideoClips(updatedClips);

                setDropIndicator(null);
                setIsDragging(null);
                return;
            }

            // ====== AUDIO LEFT TRIM (adjust start) ======
            if (drag.type === 'left' && drag.target === 'audio') {
                const audioClip = localAudioClips.find(c => c.id === drag.id);
                if (!audioClip) {
                    setDropIndicator(null);
                    setIsDragging(null);
                    return;
                }

                // Calculate new start time
                let newStart = drag.originalStart + deltaTime;
                const minDuration = 0.1;

                // Clamp
                newStart = Math.max(0, Math.min(newStart, drag.originalEnd - minDuration));

                // Calculate source shift
                const startShift = newStart - drag.originalStart;
                const newSourceStart = Math.max(0, (audioClip.sourceStart ?? 0) + startShift);

                // Update audio clip
                const updatedAudioClips = localAudioClips.map(c =>
                    c.id === drag.id
                        ? { ...c, startTime: newStart, sourceStart: newSourceStart }
                        : c
                );
                setLocalAudioClips(updatedAudioClips);
                onUpdateAudioClips(updatedAudioClips);

                setDropIndicator(null);
                setIsDragging(null);
                return;
            }

            // ====== AUDIO RIGHT TRIM (adjust end) ======
            if (drag.type === 'right' && drag.target === 'audio') {
                const audioClip = localAudioClips.find(c => c.id === drag.id);
                if (!audioClip) {
                    setDropIndicator(null);
                    setIsDragging(null);
                    return;
                }

                // Calculate new end time
                let newEnd = drag.originalEnd + deltaTime;
                const minDuration = 0.1;

                // Clamp: can't go before start + minDuration
                newEnd = Math.max(drag.originalStart + minDuration, newEnd);

                // Calculate new source end
                const endShift = newEnd - drag.originalEnd;
                const currentSourceEnd = audioClip.sourceEnd ?? (audioClip.endTime - audioClip.startTime);
                let newSourceEnd = Math.max(audioClip.sourceStart ?? 0, currentSourceEnd + endShift);

                // Calculate available extension based on source duration
                const fullSourceDuration = audioClip.sourceDuration ?? currentSourceEnd;
                const maxExtension = fullSourceDuration - currentSourceEnd;

                // Only block EXTENDING when at max source length, allow SHRINKING
                if (deltaTime > 0 && maxExtension <= 0) {
                    // Trying to extend but already at max - don't change
                    newEnd = drag.originalEnd;
                    newSourceEnd = currentSourceEnd;
                } else if (deltaTime > 0) {
                    // Extending - limit to maxExtension
                    newEnd = Math.min(newEnd, drag.originalEnd + maxExtension);
                    newSourceEnd = Math.min(newSourceEnd, fullSourceDuration);
                }
                // deltaTime <= 0 means shrinking - always allowed

                // Update audio clip
                const updatedAudioClips = localAudioClips.map(c =>
                    c.id === drag.id
                        ? { ...c, endTime: newEnd, sourceEnd: newSourceEnd }
                        : c
                );
                setLocalAudioClips(updatedAudioClips);
                onUpdateAudioClips(updatedAudioClips);

                setDropIndicator(null);
                setIsDragging(null);
                return;
            }

            // ====== MOVE (existing logic) ======
            const clipDuration = drag.originalEnd - drag.originalStart;

            // Calculate final position (only clamp to left edge, allow extending past duration)
            let newStart = drag.originalStart + deltaTime;
            if (newStart < 0) newStart = 0;
            // Note: We don't clamp to duration in free-mode - clips can extend timeline
            const newEnd = newStart + clipDuration;

            // Calculate final target layer
            let targetLayer = clip?.layer || 0;
            const originalLayer = drag.originalLayer ?? (clip?.layer || 0);

            if (containerRef.current && drag.target === 'clip') {
                const containerRect = containerRef.current.getBoundingClientRect();
                const mouseY = e.clientY - containerRect.top + containerRef.current.scrollTop;
                const headerHeight = 24 + 64 + 6; // Ruler + CC row + spacer
                // Track heights: V1=86 (80+6), others=58 (52+6)
                const trackAreaY = mouseY - headerHeight;

                // Find max layer in current clips
                const maxLayer = Math.max(0, ...videoClips.map(c => c.layer || 0));

                // Calculate which track the mouse is over using variable heights
                // renderLayers is REVERSED: [maxLayer, maxLayer-1, ..., 1, 0]
                // So visualIndex 0 = maxLayer (top), last index = 0 (V1, bottom)

                if (trackAreaY < 0) {
                    // Mouse is ABOVE all tracks (in header/CC area)
                    // Only create new layer if user actually dragged upward
                    const draggedUpward = drag.screenStartY !== undefined &&
                        (drag.screenStartY - e.clientY) > 20;
                    if (draggedUpward) {
                        targetLayer = maxLayer + 1;
                    }
                    // If just clicked (no significant movement), keep original layer
                } else {
                    // Find which track the Y falls into using variable heights
                    let cumulativeY = 0;
                    let visualIndex = -1;
                    for (let i = 0; i < renderLayers.length; i++) {
                        const thisTrackHeight = (renderLayers[i] === 0) ? 86 : 71;
                        if (trackAreaY < cumulativeY + thisTrackHeight) {
                            visualIndex = i;
                            break;
                        }
                        cumulativeY += thisTrackHeight;
                    }

                    if (visualIndex >= 0 && visualIndex < renderLayers.length) {
                        // Mouse is over an existing track
                        targetLayer = renderLayers[visualIndex];
                        const thisTrackHeight = (targetLayer === 0) ? 86 : 71;
                        const positionInTrack = trackAreaY - cumulativeY + thisTrackHeight;

                        // Check if this is the top track and mouse is in the upper half
                        // Only create new layer if user actually dragged upward significantly
                        if (visualIndex === 0) {
                            const draggedUpward = drag.screenStartY !== undefined &&
                                (drag.screenStartY - e.clientY) > 20;
                            if (positionInTrack < thisTrackHeight / 2 && draggedUpward) {
                                // Upper half of top track AND actually dragged - create new layer
                                targetLayer = maxLayer + 1;
                            }
                        }
                    } else {
                        // Mouse is below all visible tracks - stay at V1
                        targetLayer = 0;
                    }
                }
            }

            // Apply the move
            if (drag.target === 'clip') {
                const updatedClips = videoClips.map(c =>
                    c.id === drag.id
                        ? { ...c, startTime: newStart, endTime: newEnd, layer: targetLayer }
                        : c
                );
                setVideoClips(updatedClips);
                onUpdateVideoClips(updatedClips);
            } else if (drag.target === 'audio') {
                // Calculate target Audio Layer
                let targetLayer = clip?.layer || 0;

                if (containerRef.current) {
                    const containerRect = containerRef.current.getBoundingClientRect();
                    const mouseY = e.clientY - containerRect.top + containerRef.current.scrollTop;

                    const headerHeight = 24 + 64 + 6; // Ruler + CC
                    const videoSectionHeight = headerHeight + (renderLayers.length * 70) + 6 + 6; // Videos + Spacers
                    const audioTrackHeight = 37;

                    const trackAreaY = mouseY - videoSectionHeight;

                    if (trackAreaY >= 0) {
                        const visualIndex = Math.floor(trackAreaY / audioTrackHeight);
                        targetLayer = Math.max(0, visualIndex);
                    }
                }

                // COLLISION DETECTION: Check if new position overlaps with other audio clips in same layer
                const movingClipDuration = newEnd - newStart;
                const otherClipsInLayer = localAudioClips.filter(a =>
                    a.id !== drag.id && (a.layer || 0) === targetLayer
                );

                const hasCollision = otherClipsInLayer.some(other =>
                    newStart < other.endTime && newEnd > other.startTime
                );

                if (hasCollision) {
                    // Find a free position or revert
                    // Strategy: Try to find the nearest gap that fits the clip
                    let foundPosition = false;
                    let adjustedStart = newStart;

                    // Sort clips by start time
                    const sortedClips = [...otherClipsInLayer].sort((a, b) => a.startTime - b.startTime);

                    // Try placing before first clip
                    if (sortedClips.length > 0 && sortedClips[0].startTime >= movingClipDuration) {
                        const gapEnd = sortedClips[0].startTime;
                        if (gapEnd >= movingClipDuration) {
                            adjustedStart = Math.max(0, gapEnd - movingClipDuration);
                            foundPosition = true;
                        }
                    }

                    // Try placing in gaps between clips
                    if (!foundPosition) {
                        for (let i = 0; i < sortedClips.length - 1; i++) {
                            const gapStart = sortedClips[i].endTime;
                            const gapEnd = sortedClips[i + 1].startTime;
                            const gapSize = gapEnd - gapStart;

                            if (gapSize >= movingClipDuration) {
                                adjustedStart = gapStart;
                                foundPosition = true;
                                break;
                            }
                        }
                    }

                    // Try placing after last clip
                    if (!foundPosition && sortedClips.length > 0) {
                        adjustedStart = sortedClips[sortedClips.length - 1].endTime;
                        foundPosition = true;
                    }

                    // If no gap found, place at start (layer 0 case with no clips)
                    if (!foundPosition) {
                        adjustedStart = 0;
                    }

                    const adjustedEnd = adjustedStart + movingClipDuration;

                    const updatedAudioClips = localAudioClips.map(a =>
                        a.id === drag.id
                            ? { ...a, startTime: adjustedStart, endTime: adjustedEnd, layer: targetLayer }
                            : a
                    );
                    setLocalAudioClips(updatedAudioClips);
                    onUpdateAudioClips(updatedAudioClips);
                } else {
                    // No collision - apply move normally
                    const updatedAudioClips = localAudioClips.map(a =>
                        a.id === drag.id
                            ? { ...a, startTime: newStart, endTime: newEnd, layer: targetLayer }
                            : a
                    );
                    setLocalAudioClips(updatedAudioClips);
                    onUpdateAudioClips(updatedAudioClips);
                }
            } else if (drag.target === 'subtitle') {
                onUpdateSubtitle(drag.id, newStart, newEnd);
            }

            // Reset all drag state
            setDropIndicator(null);
            setIsDragging(null);
            setSnapIndicator(null);
            setDragOverlayData(null);
            setAudioDropIndicator(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [pxPerSec, duration, videoClips, localAudioClips, renderLayers, onUpdateVideoClips, onUpdateAudioClips, onUpdateSubtitle, setVideoClips, setLocalAudioClips, setDropIndicator, setIsDragging]);

    // Keyboard handling for Ripple Delete and Shortcuts


    // Scrubbing Logic with Auto-Scroll
    const scrubMouseX = useRef<number>(0);

    const handleScrubMove = useCallback((e: MouseEvent) => {
        scrubMouseX.current = e.clientX;

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left + containerRef.current.scrollLeft - 40; // 40px header offset
        const time = Math.max(0, Math.min(clickX / pxPerSec, duration));

        if (playheadRef.current) playheadRef.current.style.left = `${time * pxPerSec}px`;
        // Use previewFrame for smooth scrubbing, fallback to seek
        if (onPreviewFrame) {
            onPreviewFrame(time);
        } else {
            onSeek(time);
        }
    }, [duration, pxPerSec, onSeek, onPreviewFrame]);

    const handleScrubEnd = useCallback(() => setIsScrubbing(false), []);

    useEffect(() => {
        if (!isScrubbing) return;

        let animationFrameId: number;

        const autoScrollLoop = () => {
            if (containerRef.current) {
                const container = containerRef.current;
                const rect = container.getBoundingClientRect();
                const mouseX = scrubMouseX.current;
                const edgeThreshold = 80; // px
                const maxScrollSpeed = 45; // px per frame (Faster speed)

                let scrollDelta = 0;

                // Check edges
                if (mouseX < rect.left + edgeThreshold) {
                    // Left edge
                    const intensity = (rect.left + edgeThreshold - mouseX) / edgeThreshold;
                    scrollDelta = -maxScrollSpeed * intensity;
                } else if (mouseX > rect.right - edgeThreshold) {
                    // Right edge
                    const intensity = (mouseX - (rect.right - edgeThreshold)) / edgeThreshold;
                    scrollDelta = maxScrollSpeed * intensity;
                }

                if (scrollDelta !== 0) {
                    container.scrollLeft += scrollDelta;

                    // Recalculate time/playhead because scroll changed the relative position
                    const clickX = mouseX - rect.left + container.scrollLeft - 40; // 40px header offset
                    const time = Math.max(0, Math.min(clickX / pxPerSec, duration));

                    if (playheadRef.current) playheadRef.current.style.left = `${time * pxPerSec}px`;
                    // Use previewFrame for smooth scrubbing, fallback to seek
                    if (onPreviewFrame) {
                        onPreviewFrame(time);
                    } else {
                        onSeek(time);
                    }
                }
            }
            animationFrameId = requestAnimationFrame(autoScrollLoop);
        };

        window.addEventListener('mousemove', handleScrubMove);
        window.addEventListener('mouseup', handleScrubEnd);
        animationFrameId = requestAnimationFrame(autoScrollLoop);

        return () => {
            window.removeEventListener('mousemove', handleScrubMove);
            window.removeEventListener('mouseup', handleScrubEnd);
            cancelAnimationFrame(animationFrameId);
        };
    }, [isScrubbing, handleScrubMove, handleScrubEnd, duration, pxPerSec, onSeek, onPreviewFrame]);

    const handleTrackMouseDown = (e: React.MouseEvent) => {
        // Prevent event bubbling if clicking a known interactive element
        if ((e.target as HTMLElement).closest('.subtitle-block')) return;
        if ((e.target as HTMLElement).closest('.video-clip')) return;
        if ((e.target as HTMLElement).closest('.video-clip-wrapper')) return;
        if ((e.target as HTMLElement).closest('.audio-clip')) return;
        if ((e.target as HTMLElement).closest('.sidebar-tools')) return;

        // If clicking on specific elements (handled by stopPropagation there), this won't fire.
        // But if clicking on empty track area:

        // 1. Store start point
        interactionStartRef.current = { x: e.clientX, y: e.clientY };

        // 2. Set candidate mode (wait to see if drag or click)
        setInteractionMode('select-candidate');

        // 3. Clear selection immediately? Or wait until click confirmed?
        // Standard behavior: Click on empty space clears selection immediately usually, OR on mouseUp?
        // Let's clear on Click (MouseUp without drag) to allow "Add to selection" modifiers later if needed.
        // But for now, user expects "Click empty -> Seek & Deselect". "Drag -> Select".

        // Let's NOT seek yet. We seek on MouseUp if it was a click.
    };

    // Global mouse move for the track area operations
    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        // Handle Marquee Selection - BUT NOT when dragging a clip
        if (interactionMode === 'select-candidate' && !isDragging) {
            if (interactionStartRef.current) {
                const dist = Math.sqrt(Math.pow(e.clientX - interactionStartRef.current.x, 2) + Math.pow(e.clientY - interactionStartRef.current.y, 2));
                if (dist > 15) {
                    setInteractionMode('selecting');
                    if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect();
                        // Relative to the scrolling container content??
                        // The box should be drawn absolute or fixed?
                        // Simpler to draw absolute relative to 'track container' (including scroll).

                        const startX = interactionStartRef.current.x - rect.left + containerRef.current.scrollLeft;
                        const startY = interactionStartRef.current.y - rect.top; // Relative to container top

                        setSelectionBox({ startX, startY, currentX: startX, currentY: startY });
                    }
                }
            }
        } else if (interactionMode === 'selecting') {
            if (containerRef.current && selectionBox) {
                const rect = containerRef.current.getBoundingClientRect();
                const currentX = e.clientX - rect.left + containerRef.current.scrollLeft;
                const currentY = e.clientY - rect.top;

                setSelectionBox(prev => prev ? { ...prev, currentX, currentY } : null);

                // Real-time Selection Update
                // Calculate intersection rect
                const boxLeft = Math.min(selectionBox.startX, currentX);
                const boxRight = Math.max(selectionBox.startX, currentX);
                const boxTop = Math.min(selectionBox.startY, currentY);
                const boxBottom = Math.max(selectionBox.startY, currentY);

                // Check Video Clips - Updated for new layout
                // X offset: 40px for sticky header column
                // Y: Ruler 24px + CC row 74px + video tracks (variable height)
                const newSelection = new Set<string>();
                const headerColumnOffset = 40;
                const headerHeight = 24 + 64 + 6; // Ruler + CC row with spacer
                const mainTrackHeight = 80 + 6; // V1 main track (80px) + spacer
                const slaveTrackHeight = 65 + 6; // V2+ slave tracks (65px) + spacer

                videoClips.forEach(clip => {
                    const clipX1 = headerColumnOffset + clip.startTime * pxPerSec;
                    const clipX2 = headerColumnOffset + clip.endTime * pxPerSec;

                    const visualIndex = renderLayers.indexOf(clip.layer || 0);
                    if (visualIndex === -1) return;

                    // Calculate Y position based on variable track heights
                    let clipY1 = headerHeight;
                    for (let i = 0; i < visualIndex; i++) {
                        clipY1 += (renderLayers[i] === 0) ? mainTrackHeight : slaveTrackHeight;
                    }
                    const currentTrackHeight = (clip.layer || 0) === 0 ? 80 : 65; // Content height (without spacer)
                    const clipY2 = clipY1 + currentTrackHeight;

                    const overlapsX = clipX1 < boxRight && clipX2 > boxLeft;
                    const overlapsY = clipY1 < boxBottom && clipY2 > boxTop;

                    if (overlapsX && overlapsY) {
                        newSelection.add(clip.id);
                    }
                });

                // Check Audio Clips - calculate based on audio track position
                // Audio track is after all video tracks
                let totalVideoTracksHeight = 0;
                renderLayers.forEach(layer => {
                    totalVideoTracksHeight += (layer === 0) ? mainTrackHeight : slaveTrackHeight;
                });
                const audioTrackStartY = headerHeight + totalVideoTracksHeight;
                const audioTrackHeight = 40; // h-10 = 40px

                localAudioClips.forEach(clip => {
                    const clipX1 = headerColumnOffset + clip.startTime * pxPerSec;
                    const clipX2 = headerColumnOffset + clip.endTime * pxPerSec;

                    // Calculate Y position based on the audio clip's layer
                    const audioLayer = clip.layer || 0;
                    const clipY1 = audioTrackStartY + (audioLayer * audioTrackHeight);
                    const clipY2 = clipY1 + audioTrackHeight;

                    const overlapsX = clipX1 < boxRight && clipX2 > boxLeft;
                    const overlapsY = clipY1 < boxBottom && clipY2 > boxTop;

                    if (overlapsX && overlapsY) {
                        newSelection.add(clip.id);
                    }
                });

                setSelectedClipIds(newSelection);
            }
        }


        // Handle Scrubbing (only if explicitly scrubbing via Ruler or similar, NOT empty track drag)
        if (isScrubbing) {
            scrubMouseX.current = e.clientX;
            if (isDragging) return; // Prioritize drag

            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left + containerRef.current.scrollLeft - 40; // 40px header column offset
                const time = Math.max(0, Math.min(x / pxPerSec, duration));
                if (playheadRef.current) playheadRef.current.style.left = `${time * pxPerSec}px`;
                // Real-time frame preview during scrubbing (previewFrame handles both UI state and video seek)
                // Do NOT call onSeek here - it conflicts with previewFrame's RAF-throttled seek
                if (onPreviewFrame) {
                    onPreviewFrame(time);
                } else {
                    onSeek(time);
                }
            }
        }
    }, [interactionMode, isScrubbing, isDragging, pxPerSec, duration, onSeek, renderLayers, videoClips, localAudioClips, selectionBox, containerRef, interactionStartRef, setSelectedClipIds]);

    // Handle Mouse Up (Global)
    const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
        // ALWAYS reset interaction start ref first
        interactionStartRef.current = null;

        if (interactionMode === 'select-candidate') {
            // It was a Click!
            // NOTE: Do NOT call onPlayPause here! seek() already pauses video internally.
            // Calling pause() first would update currentTime incorrectly BEFORE seek runs.

            // 1. Move Playhead (seek handles pause internally)
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const clickX = e.clientX - rect.left + containerRef.current.scrollLeft - 40; // 40px header column offset
                const time = Math.max(0, Math.min(clickX / pxPerSec, duration));
                onSeek(time);
                // Also preview the frame at clicked position
                onPreviewFrame?.(time);
            }
            // 2. Clear Selection
            setSelectedClipIds(new Set());
            setSelectedClipId(null);
            setSelectedAudioClipId(null);
        }

        // Always clear selection box and interaction mode - do this unconditionally
        setInteractionMode('none');
        setSelectionBox(null);

        if (isScrubbing) {
            setIsScrubbing(false);
            // Use hybrid engine's endScrub (handles resume if was playing)
            onEndScrub?.();
        }

        setIsDragging(null);
        setSnapIndicator(null); // Clear item drag too
    }, [interactionMode, isScrubbing, duration, onSeek, onPreviewFrame, pxPerSec, setSelectedClipIds, setSelectedClipId, setSelectedAudioClipId, containerRef, setInteractionMode, setSelectionBox, setIsScrubbing, setIsDragging, onEndScrub]);


    // Attach Global Listeners
    useEffect(() => {
        // Clean up selection box when window loses focus or mouse leaves
        const handleCleanup = () => {
            setSelectionBox(null);
            setInteractionMode('none');
            interactionStartRef.current = null;
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        window.addEventListener('blur', handleCleanup);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            window.removeEventListener('blur', handleCleanup);
        };
    }, [handleGlobalMouseMove, handleGlobalMouseUp]);


    const handleScrubStart = (e: React.MouseEvent) => {
        // Only for Ruler now?
        e.preventDefault();
        e.stopPropagation(); // Prevent track marquee

        // Use hybrid engine's startScrub (handles pause + remember state)
        onStartScrub?.();

        setIsScrubbing(true);
        scrubMouseX.current = e.clientX;
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left + containerRef.current.scrollLeft - 40; // 40px header column offset
            const time = Math.max(0, Math.min(clickX / pxPerSec, duration));
            if (playheadRef.current) playheadRef.current.style.left = `${time * pxPerSec}px`;
            // Immediate frame preview on scrub start (previewFrame handles both UI state and video seek)
            if (onPreviewFrame) {
                onPreviewFrame(time);
            } else {
                onSeek(time);
            }
        }
        // Scrubbing usually doesn't deselect? Or does it?
        // Let's keep selection during ruler scrub.
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };
    const formatTimeFull = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        const ms = Math.floor((sec % 1) * 100);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
    };
    const getBlockColor = (index: number) => BLOCK_COLORS[index % BLOCK_COLORS.length];

    // Helper to split a clip at a specific time
    const splitClip = useCallback((clipId: string, type: 'video' | 'audio', time: number) => {
        if (type === 'video') {
            const clip = videoClips.find(c => c.id === clipId);
            if (clip && time > clip.startTime && time < clip.endTime) {
                const ratio = (time - clip.startTime) / (clip.endTime - clip.startTime);
                const sourceSplit = clip.sourceStart + (clip.sourceEnd - clip.sourceStart) * ratio;

                // Slice existing frames proportionally for immediate visual feedback
                // New frames will be extracted later and replace these
                const existingFrames = clip.frames || [];
                const splitIndex = Math.floor(existingFrames.length * ratio);
                const frames1 = existingFrames.slice(0, splitIndex);
                const frames2 = existingFrames.slice(splitIndex);

                // Clear waveform so they regenerate for new source ranges
                const clip1 = { ...clip, id: `${clip.id}-1`, endTime: time, sourceEnd: sourceSplit, frames: frames1.length > 0 ? frames1 : undefined, waveform: undefined };
                const clip2 = { ...clip, id: `${clip.id}-2`, startTime: time, sourceStart: sourceSplit, frames: frames2.length > 0 ? frames2 : undefined, waveform: undefined };
                const newClips = videoClips.filter(c => c.id !== clipId).concat([clip1, clip2]).sort((a, b) => a.startTime - b.startTime);
                setVideoClips(newClips);
                onUpdateVideoClips(newClips);
                // If it was selected, select the second part
                if (selectedClipId === clipId) setSelectedClipId(clip2.id);

                // ALSO split the corresponding audio clip if it exists and is separated
                const linkedAudioClip = localAudioClips.find(a => a.videoClipId === clipId || a.id === `audio-${clipId}`);
                if (linkedAudioClip && time > linkedAudioClip.startTime && time < linkedAudioClip.endTime) {
                    const audioRatio = (time - linkedAudioClip.startTime) / (linkedAudioClip.endTime - linkedAudioClip.startTime);
                    const audioSourceSplit = linkedAudioClip.sourceStart + (linkedAudioClip.sourceEnd - linkedAudioClip.sourceStart) * audioRatio;
                    const audio1: AudioClip = {
                        ...linkedAudioClip,
                        id: `${linkedAudioClip.id}-1`,
                        videoClipId: clip1.id,
                        endTime: time,
                        sourceEnd: audioSourceSplit,
                        waveform: undefined
                    };
                    const audio2: AudioClip = {
                        ...linkedAudioClip,
                        id: `${linkedAudioClip.id}-2`,
                        videoClipId: clip2.id,
                        startTime: time,
                        sourceStart: audioSourceSplit,
                        waveform: undefined
                    };
                    const newAudioClips = localAudioClips.filter(a => a.id !== linkedAudioClip.id).concat([audio1, audio2]).sort((a, b) => a.startTime - b.startTime);
                    setLocalAudioClips(newAudioClips);
                    onUpdateAudioClips(newAudioClips);
                    console.log('[Split] Also split linked audio clip:', linkedAudioClip.id);
                }
            }
        } else if (type === 'audio') {
            const audioClip = localAudioClips.find(a => a.id === clipId);
            console.log('[Audio Split] clipId:', clipId, 'time:', time, 'clip:', audioClip ? `${audioClip.startTime}-${audioClip.endTime}` : 'NOT FOUND');
            if (audioClip && time > audioClip.startTime && time < audioClip.endTime) {
                const ratio = (time - audioClip.startTime) / (audioClip.endTime - audioClip.startTime);
                const sourceSplit = audioClip.sourceStart + (audioClip.sourceEnd - audioClip.sourceStart) * ratio;

                // Slice existing waveform proportionally for immediate visual feedback
                const existingWaveform = audioClip.waveform || [];
                const splitIndex = Math.floor(existingWaveform.length * ratio);
                const waveform1 = existingWaveform.slice(0, splitIndex);
                const waveform2 = existingWaveform.slice(splitIndex);

                const audio1: AudioClip = { ...audioClip, id: `${audioClip.id}-1`, endTime: time, sourceEnd: sourceSplit, waveform: waveform1.length > 0 ? waveform1 : undefined };
                const audio2: AudioClip = { ...audioClip, id: `${audioClip.id}-2`, startTime: time, sourceStart: sourceSplit, waveform: waveform2.length > 0 ? waveform2 : undefined };
                const newAudioClips = localAudioClips.filter(a => a.id !== clipId).concat([audio1, audio2]).sort((a, b) => a.startTime - b.startTime);
                setLocalAudioClips(newAudioClips);
                onUpdateAudioClips(newAudioClips);
                // If it was selected, select the second part
                if (selectedAudioClipId === clipId) setSelectedAudioClipId(audio2.id);
                console.log('[Audio] Split audio clip by Tool at', time);
            }
        }
    }, [videoClips, localAudioClips, onUpdateVideoClips, selectedClipId, selectedAudioClipId, onUpdateAudioClips, setLocalAudioClips, setVideoClips]);

    // Toolbar handlers (Split/Delete/Zoom)
    const handleSplit = () => {
        const time = externalCurrentTime || videoElement?.currentTime || 0;
        console.log('[handleSplit] selectedClipId:', selectedClipId, 'selectedAudioClipId:', selectedAudioClipId, 'time:', time);

        if (selectedClipId) {
            splitClip(selectedClipId, 'video', time);
        } else if (selectedAudioClipId) {
            splitClip(selectedAudioClipId, 'audio', time);
        } else if (selectedSubtitleId && onSplitSubtitle) {
            onSplitSubtitle(selectedSubtitleId, time);
        }
    };

    const handleContextMenuDelete = () => {
        if (!contextMenu) return;

        // If multiple clips are selected, delete all selected clips
        if (selectedClipIds.size > 1) {
            const idsToDelete = new Set(selectedClipIds);
            const updatedVideoClips = videoClips.filter(c => !idsToDelete.has(c.id));
            const updatedAudioClips = localAudioClips.filter(c => !idsToDelete.has(c.id));

            onUpdateVideoClips(updatedVideoClips);
            setLocalAudioClips(updatedAudioClips);
            onUpdateAudioClips(updatedAudioClips);
            setSelectedClipIds(new Set());
            setSelectedClipId(null);
            setSelectedAudioClipId(null);
            console.log('[ContextMenu Delete] Deleted', idsToDelete.size, 'clips');
        } else if (contextMenu.type === 'clip') {
            // Delete single video clip
            const targetId = contextMenu.id;
            onUpdateVideoClips(videoClips.filter(c => c.id !== targetId));
        } else if (contextMenu.type === 'audio') {
            const targetId = contextMenu.id;
            const updatedClips = localAudioClips.filter(c => c.id !== targetId);
            setLocalAudioClips(updatedClips);
            onUpdateAudioClips(updatedClips);
        } else if (contextMenu.type === 'subtitle') {
            // ...
        }
        setContextMenu(null);
    };
    const handleDelete = () => {
        // If multiple clips are selected, delete all selected clips
        if (selectedClipIds.size > 1) {
            const idsToDelete = new Set(selectedClipIds);
            const updatedVideoClips = videoClips.filter(c => !idsToDelete.has(c.id));
            const updatedAudioClips = localAudioClips.filter(c => !idsToDelete.has(c.id));

            onUpdateVideoClips(updatedVideoClips);
            setLocalAudioClips(updatedAudioClips);
            onUpdateAudioClips(updatedAudioClips);
            setSelectedClipIds(new Set());
            setSelectedClipId(null);
            setSelectedAudioClipId(null);
            console.log('[Toolbar Delete] Deleted', idsToDelete.size, 'clips');
            return;
        }

        if (selectedClipId) {
            const newClips = videoClips.filter(c => c.id !== selectedClipId);
            setVideoClips(newClips);
            onUpdateVideoClips(newClips);
            setSelectedClipId(null);
        } else if (selectedAudioClipId) {
            const deletedClip = localAudioClips.find(c => c.id === selectedAudioClipId);
            if (deletedClip) {
                const gap = deletedClip.endTime - deletedClip.startTime;

                const changedAudioClips = localAudioClips
                    .filter(c => c.id !== selectedAudioClipId)
                    .map(c => {
                        // Shift subsequent clips left
                        if (c.startTime >= deletedClip.endTime) {
                            return {
                                ...c,
                                startTime: c.startTime - gap,
                                endTime: c.endTime - gap
                            };
                        }
                        return c;
                    });
                setLocalAudioClips(changedAudioClips);
                onUpdateAudioClips(changedAudioClips);
                setSelectedAudioClipId(null);
            }
        } else if (selectedSubtitleId) {
            onDeleteSubtitle?.(selectedSubtitleId);
            setSelectedSubtitleId(null);
        }
    };

    // Q Shortcut: Ripple Trim Left (Delete Start -> Playhead, Shift Left)
    const handleRippleTrimLeft = useCallback(() => {
        const time = externalCurrentTime || videoElement?.currentTime || 0;
        let targetClip = selectedClipId ? videoClips.find(c => c.id === selectedClipId) : null;

        // Fallback: Find clip on Layer 0 at current time
        if (!targetClip) {
            targetClip = videoClips.find(c => (c.layer || 0) === 0 && time > c.startTime && time < c.endTime);
        }

        if (!targetClip) return;
        if (time <= targetClip.startTime || time >= targetClip.endTime) return;

        const cutDuration = time - targetClip.startTime;
        const targetLayer = targetClip.layer || 0;

        const updatedClips = videoClips
            .filter(c => c.id !== targetClip!.id)
            .map(c => {
                // Shift subsequent clips on SAME layer left
                if ((c.layer || 0) === targetLayer && c.startTime >= targetClip!.endTime) {
                    return { ...c, startTime: c.startTime - cutDuration, endTime: c.endTime - cutDuration };
                }
                return c;
            });

        // Update target clip: Start time remains (visually shifts left), content starts later
        const newTarget: VideoClip = {
            ...targetClip,
            endTime: targetClip.endTime - cutDuration,
            sourceStart: targetClip.sourceStart + cutDuration
        };

        const finalClips = [...updatedClips, newTarget].sort((a, b) => a.startTime - b.startTime);

        onUpdateVideoClips(finalClips);
        // Ensure playhead stays synced visually or updates if needed?
        // Playhead is at 'time'. Clip moves to 'time'. Content under playhead changes.
        // Ideally we might want to seek to the new start of the clip?
        // CapCut behavior: Playhead stays. Content shifts.
    }, [videoClips, externalCurrentTime, videoElement, selectedClipId, onUpdateVideoClips]);

    // W Shortcut: Ripple Trim Right (Delete Playhead -> End, Shift Subsequent Left)
    const handleRippleTrimRight = useCallback(() => {
        const time = externalCurrentTime || videoElement?.currentTime || 0;
        let targetClip = selectedClipId ? videoClips.find(c => c.id === selectedClipId) : null;

        // Fallback: Find clip on Layer 0 at current time
        if (!targetClip) {
            targetClip = videoClips.find(c => (c.layer || 0) === 0 && time > c.startTime && time < c.endTime);
        }

        if (!targetClip) return;
        if (time <= targetClip.startTime || time >= targetClip.endTime) return;

        const cutDuration = targetClip.endTime - time;
        const targetLayer = targetClip.layer || 0;

        const updatedClips = videoClips
            .filter(c => c.id !== targetClip!.id)
            .map(c => {
                // Shift subsequent clips on SAME layer left
                if ((c.layer || 0) === targetLayer && c.startTime >= targetClip!.endTime) {
                    return { ...c, startTime: c.startTime - cutDuration, endTime: c.endTime - cutDuration };
                }
                return c;
            });

        // Update target clip: End time becomes playhead time
        const newTarget: VideoClip = {
            ...targetClip,
            endTime: time
        };

        const finalClips = [...updatedClips, newTarget].sort((a, b) => a.startTime - b.startTime);

        onUpdateVideoClips(finalClips);
    }, [videoClips, externalCurrentTime, videoElement, selectedClipId, onUpdateVideoClips]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left + containerRef.current.scrollLeft;
            const time = Math.max(0, Math.min(x / pxPerSec, duration));
            // This is for file drop indicator, not clip drag indicator
            // setDropIndicatorTime(time);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        // setDropIndicatorTime(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        // setDropIndicatorTime(null);

        // Calculate drop time based on mouse position
        let dropTime = 0;
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left + containerRef.current.scrollLeft - 40; // 40px header offset
            dropTime = Math.max(0, Math.min(x / pxPerSec, duration));
        }

        // 1. Check for Q Drive asset drops first
        const tubiqAssetData = e.dataTransfer.getData('application/tubiq-asset');
        if (tubiqAssetData && onDropAsset) {
            console.log('[TimelineEditor] Q Drive asset dropped at time:', dropTime);
            onDropAsset(tubiqAssetData, dropTime);
            return;
        }

        // 2. Handle file drops
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onDropFile) {
            const file = e.dataTransfer.files[0];
            onDropFile(file, dropTime);
        }
    };

    // Optimized Handlers for Clip Items
    const handleVideoClipMouseDown = useCallback((e: React.MouseEvent, clip: VideoClip) => {
        if (e.button === 0) {
            e.stopPropagation();

            // Ctrl+Click: Toggle selection for multi-select
            if (e.ctrlKey || e.metaKey) {
                setSelectedClipIds(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(clip.id)) {
                        newSet.delete(clip.id);
                    } else {
                        newSet.add(clip.id);
                    }
                    return newSet;
                });
                // Don't start drag when Ctrl+clicking
                return;
            }

            // Normal click - select single and prepare for drag
            setSelectedClipId(clip.id);
            setSelectedAudioClipId(null);
            // Add to selectedClipIds as well for consistency
            setSelectedClipIds(new Set([clip.id]));

            // Calculate grab offset (X and Y)
            const { grabOffsetX, grabOffsetY } = (() => {
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const clipLeftOnScreen = rect.left + 40 + (clip.startTime * pxPerSec) - containerRef.current.scrollLeft; // 40px header
                    const visualIndex = renderLayers.indexOf(clip.layer || 0);
                    const clipTopOnScreen = rect.top + 24 + 64 + 6 + (visualIndex * 70) - containerRef.current.scrollTop; // ruler + CC + tracks
                    return {
                        grabOffsetX: e.clientX - clipLeftOnScreen,
                        grabOffsetY: e.clientY - clipTopOnScreen
                    };
                }
                return { grabOffsetX: 0, grabOffsetY: 28 };
            })();

            // Calculate frame slots for the drag overlay
            const clipWidth = (clip.endTime - clip.startTime) * pxPerSec;
            const aspectRatio = clip.ratio || thumbnailAspectRatio || (16 / 9);
            const slotWidthCalc = Math.round(44 * aspectRatio); // 44px is frame height
            const slotCount = Math.max(1, Math.ceil(clipWidth / slotWidthCalc));
            const clipFrames = clip.frames || [];
            const sourceFrames = clipFrames.length > 0 ? clipFrames : frameThumbnails;

            const frameSlots = Array.from({ length: slotCount }, (_, i) => {
                const offsetInClip = (i * slotWidthCalc) / pxPerSec;
                if (clipFrames.length > 0) {
                    // Per-clip frames
                    const sourceTime = clip.sourceStart + offsetInClip;
                    const frameIndex = Math.floor((sourceTime / (clip.sourceEnd - clip.sourceStart)) * sourceFrames.length);
                    return sourceFrames[Math.min(Math.max(0, frameIndex), sourceFrames.length - 1)] || '';
                } else {
                    // Global timeline frames
                    const timelineTime = clip.startTime + offsetInClip;
                    const frameIndex = Math.floor((timelineTime / duration) * sourceFrames.length);
                    return sourceFrames[Math.min(Math.max(0, frameIndex), sourceFrames.length - 1)] || '';
                }
            });

            // Set drag overlay data for the Portal component
            setDragOverlayData({
                clipId: clip.id,
                clipWidth,
                clipName: clip.name || 'Clip',
                frameSlots,
                slotWidth: slotWidthCalc,
                grabOffsetX,
                screenX: e.clientX,
                screenY: e.clientY,
                waveformData: clip.waveform || audioWaveformL || [],
                clipDuration: clip.endTime - clip.startTime
            });

            // Store screen coordinates for drag handling
            setIsDragging({
                id: clip.id,
                type: 'move',
                target: 'clip',
                startX: e.clientX,
                originalStart: clip.startTime,
                originalEnd: clip.endTime,
                screenStartX: e.clientX,
                screenStartY: e.clientY,
                screenX: e.clientX,
                screenY: e.clientY,
                grabOffsetX,
                grabOffsetY
            });
        } else if (e.button === 2) {
            e.stopPropagation();
        }
    }, [setSelectedClipId, setSelectedAudioClipId, setIsDragging, setDragOverlayData, pxPerSec, thumbnailAspectRatio, frameThumbnails, duration, renderLayers]);

    const handleVideoClipContextMenu = useCallback((e: React.MouseEvent, clip: VideoClip) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, id: clip.id, type: 'clip' });
    }, [setContextMenu]);

    const handleVideoClipDragHandle = useCallback((e: React.MouseEvent, clip: VideoClip, type: 'left' | 'right') => {
        e.stopPropagation();
        setSelectedClipId(clip.id);
        setIsDragging({ id: clip.id, type, target: 'clip', startX: e.clientX, originalStart: clip.startTime, originalEnd: clip.endTime });
    }, [setSelectedClipId, setIsDragging]); // Removed videoClips from dep array

    // CapCut-style volume control - drag audio waveform up/down to adjust volume
    const handleVolumeChange = useCallback((clipId: string, volume: number) => {
        const updatedClips = videoClips.map(c =>
            c.id === clipId ? { ...c, volume: Math.round(volume * 100) / 100 } : c
        );
        onUpdateVideoClips(updatedClips);
    }, [videoClips, onUpdateVideoClips]);

    const handleAudioClipMouseDown = useCallback((e: React.MouseEvent, clip: AudioClip) => {
        if (e.button === 0) {
            e.stopPropagation();

            // Ctrl+Click: Toggle selection for multi-select
            if (e.ctrlKey || e.metaKey) {
                setSelectedClipIds(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(clip.id)) {
                        newSet.delete(clip.id);
                    } else {
                        newSet.add(clip.id);
                    }
                    return newSet;
                });
                // Don't start drag when Ctrl+clicking
                return;
            }

            // Normal click - select single and prepare for drag
            setSelectedAudioClipId(clip.id);
            setSelectedClipId(null);
            // Add to selectedClipIds as well for consistency
            setSelectedClipIds(new Set([clip.id]));

            // Calculate grab offset (X and Y)
            const { grabOffsetX, grabOffsetY } = (() => {
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const clipLeftOnScreen = rect.left + 40 + (clip.startTime * pxPerSec) - containerRef.current.scrollLeft; // 40px header

                    // Note: Audio tracks are BELOW video tracks. We need to calculate Y offset dynamically.
                    // But simpler: just use mouse delta from top-left of clip if possible?
                    // Let's use the same logic as video but adapted for audio layout.
                    // Visual index for Audio is simple: render order.
                    // Timeline layout: Ruler(24) + CC(64+2) + VideoTracks + Spacer + AudioTracks

                    // Actually, let's just use e.clientX - clipLeftOnScreen for X.
                    // For Y, allow it to snap to mouse Y initially.
                    const mouseXCurrent = e.clientX;
                    const mouseYCurrent = e.clientY;
                    // Approximate grab offset
                    return {
                        grabOffsetX: e.clientX - clipLeftOnScreen,
                        grabOffsetY: 18 // Middle of 36px height
                    };
                }
                return { grabOffsetX: 0, grabOffsetY: 18 };
            })();

            // Set drag overlay data
            const clipWidth = (clip.endTime - clip.startTime) * pxPerSec;

            setDragOverlayData({
                clipId: clip.id,
                clipWidth,
                clipName: '분리됨', // Fixed name for separated audio
                frameSlots: [], // Audio has no frames
                slotWidth: 0,
                grabOffsetX,
                screenX: e.clientX,
                screenY: e.clientY,
                waveformData: clip.waveform || audioWaveformL || [],
                clipDuration: clip.endTime - clip.startTime
            });

            setIsDragging({
                id: clip.id,
                type: 'move',
                target: 'audio',
                startX: e.clientX,
                originalStart: clip.startTime,
                originalEnd: clip.endTime,
                // Add extended drag props
                screenStartX: e.clientX,
                screenStartY: e.clientY,
                screenX: e.clientX,
                screenY: e.clientY,
                grabOffsetX,
                grabOffsetY,
                originalLayer: clip.layer
            });
        }
    }, [setSelectedAudioClipId, setSelectedClipId, setIsDragging, setDragOverlayData, pxPerSec, audioWaveformL]);

    const handleAudioClipContextMenu = useCallback((e: React.MouseEvent, clip: AudioClip) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, id: clip.id, type: 'audio' });
    }, [setContextMenu]);

    const handleAudioClipDragHandle = useCallback((e: React.MouseEvent, clip: AudioClip, type: 'left' | 'right') => {
        e.stopPropagation();
        setSelectedAudioClipId(clip.id);
        setIsDragging({ id: clip.id, type, target: 'audio', startX: e.clientX, originalStart: clip.startTime, originalEnd: clip.endTime });
    }, [setSelectedAudioClipId, setIsDragging]);

    // Keyboard handling for Ripple Delete and Shortcuts (Moved here to access handlers)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only trigger if no input is focused
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

            // Check if any modal is open? (Simple check for now)

            const key = e.key.toLowerCase();

            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Multi-select delete: delete all selected clips at once
                if (selectedClipIds.size > 0) {
                    const idsToDelete = new Set(selectedClipIds);
                    const updatedClips = videoClips.filter(c => !idsToDelete.has(c.id));
                    const updatedAudioClips = localAudioClips.filter(c => !idsToDelete.has(c.id));

                    onUpdateVideoClips(updatedClips);
                    onUpdateAudioClips(updatedAudioClips);
                    setSelectedClipIds(new Set());
                    setSelectedClipId(null);
                    setSelectedAudioClipId(null);
                    console.log('[Delete] Deleted', idsToDelete.size, 'clips');
                    return;
                }

                // Single-select delete (fallback)
                if (selectedClipId) {
                    const deletedClip = videoClips.find(c => c.id === selectedClipId);
                    if (deletedClip) {
                        const gap = deletedClip.endTime - deletedClip.startTime;
                        const deletedLayer = deletedClip.layer || 0;

                        // Filter out deleted clip AND shift subsequent clips on the SAME layer
                        const updatedClips = videoClips
                            .filter(c => c.id !== selectedClipId)
                            .map(c => {
                                // If clip is on the same layer and is after the deleted clip, shift it left
                                if ((c.layer || 0) === deletedLayer && c.startTime >= deletedClip.endTime) {
                                    return {
                                        ...c,
                                        startTime: c.startTime - gap,
                                        endTime: c.endTime - gap
                                    };
                                }
                                return c;
                            });

                        onUpdateVideoClips(updatedClips);
                        setSelectedClipId(null);
                    }
                } else if (selectedAudioClipId) {
                    const deletedClip = localAudioClips.find(c => c.id === selectedAudioClipId);
                    if (deletedClip) {
                        const gap = deletedClip.endTime - deletedClip.startTime;

                        const updatedClips = localAudioClips
                            .filter(c => c.id !== selectedAudioClipId)
                            .map(c => {
                                // Shift subsequent clips left
                                if (c.startTime >= deletedClip.endTime) {
                                    return {
                                        ...c,
                                        startTime: c.startTime - gap,
                                        endTime: c.endTime - gap
                                    };
                                }
                                return c;
                            });
                        setLocalAudioClips(updatedClips);
                        onUpdateAudioClips(updatedClips); // Immediate commit
                        setSelectedAudioClipId(null);
                    }
                } else if (selectedSubtitleId) {
                    onDeleteSubtitle?.(selectedSubtitleId);
                    setSelectedSubtitleId(null);
                }
            } else if (key === 'e') {
                handleSplit();
            } else if (key === 'q') {
                handleRippleTrimLeft();
            } else if (key === 'w') {
                handleRippleTrimRight();
            }

            // Ctrl+C: Copy selected clip
            if ((e.ctrlKey || e.metaKey) && key === 'c') {
                e.preventDefault();
                if (selectedClipId) {
                    const clip = videoClips.find(c => c.id === selectedClipId);
                    if (clip) {
                        clipboardRef.current = { type: 'video', clip: { ...clip } };
                        console.log('[Clipboard] Copied video clip:', clip.id);
                    }
                } else if (selectedAudioClipId) {
                    const clip = localAudioClips.find(c => c.id === selectedAudioClipId);
                    if (clip) {
                        clipboardRef.current = { type: 'audio', clip: { ...clip } };
                        console.log('[Clipboard] Copied audio clip:', clip.id);
                    }
                }
            }

            // Ctrl+V: Paste at current playhead position
            if ((e.ctrlKey || e.metaKey) && key === 'v') {
                e.preventDefault();
                if (clipboardRef.current) {
                    const { type, clip } = clipboardRef.current;
                    const pasteTime = externalCurrentTime ?? 0;
                    const clipDuration = clip.endTime - clip.startTime;
                    const newId = `${clip.id}-copy-${Date.now()}`;

                    if (type === 'video') {
                        const videoClip = clip as VideoClip;
                        const originalLayer = videoClip.layer ?? 0;

                        // CapCut style: V1 (layer 0) clips paste to V2 (layer 1)
                        // Other layers paste at same layer, but avoid overlaps
                        let targetLayer = originalLayer === 0 ? 1 : originalLayer;

                        // Find a layer without overlap
                        const clipStart = pasteTime;
                        const clipEnd = pasteTime + clipDuration;

                        const hasOverlap = (layer: number) => {
                            return videoClips.some(c =>
                                (c.layer ?? 0) === layer &&
                                c.startTime < clipEnd &&
                                c.endTime > clipStart
                            );
                        };

                        // Keep incrementing layer until we find one without overlap
                        while (hasOverlap(targetLayer)) {
                            targetLayer++;
                        }

                        const newClip: VideoClip = {
                            ...videoClip,
                            id: newId,
                            startTime: pasteTime,
                            endTime: pasteTime + clipDuration,
                            layer: targetLayer,
                        };
                        const updatedClips = [...videoClips, newClip];
                        setVideoClips(updatedClips);
                        onUpdateVideoClips(updatedClips);
                        setSelectedClipId(newId);
                        console.log('[Clipboard] Pasted video clip at:', pasteTime, 'layer:', targetLayer);
                    } else if (type === 'audio') {
                        const audioClip = clip as AudioClip;
                        const newClip: AudioClip = {
                            ...audioClip,
                            id: newId,
                            startTime: pasteTime,
                            endTime: pasteTime + clipDuration,
                        };
                        const updatedClips = [...localAudioClips, newClip];
                        setLocalAudioClips(updatedClips);
                        onUpdateAudioClips(updatedClips);
                        setSelectedAudioClipId(newId);
                        console.log('[Clipboard] Pasted audio clip at:', pasteTime);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedClipId, selectedAudioClipId, selectedSubtitleId, videoClips, localAudioClips, onUpdateVideoClips, onUpdateAudioClips, onDeleteSubtitle, handleSplit, handleRippleTrimLeft, handleRippleTrimRight, setLocalAudioClips, setSelectedClipId, setSelectedAudioClipId, setSelectedSubtitleId, externalCurrentTime]); // Fixed dep

    // Merge Audio Function
    const handleMergeAudio = useCallback(() => {
        // Collect all selected IDs
        const activeSelection = new Set(selectedClipIds);
        if (selectedClipId) activeSelection.add(selectedClipId);
        if (selectedAudioClipId) activeSelection.add(selectedAudioClipId);

        // Get selected audio clips
        const audiosToMerge = localAudioClips.filter(c => activeSelection.has(c.id));

        if (audiosToMerge.length === 0) return;

        const updatedVideos = [...videoClips];
        const updatedAudios = [...localAudioClips];

        // For each audio clip, restore hasAudio on its original video clip
        audiosToMerge.forEach(audio => {
            // Find the original video by videoClipId
            const videoIndex = updatedVideos.findIndex(v => v.id === audio.videoClipId);
            if (videoIndex !== -1) {
                updatedVideos[videoIndex] = {
                    ...updatedVideos[videoIndex],
                    hasAudio: true,
                    isAudioLinked: true
                };
            }
        });

        // Remove merged audio clips
        const audioIdsToRemove = new Set(audiosToMerge.map(a => a.id));
        const finalAudios = updatedAudios.filter(a => !audioIdsToRemove.has(a.id));

        onUpdateVideoClips(updatedVideos);
        setLocalAudioClips(finalAudios);
        onUpdateAudioClips(finalAudios);

        // Clear selection and close menu
        setSelectedClipIds(new Set());
        setSelectedClipId(null);
        setSelectedAudioClipId(null);
        setContextMenu(null);
    }, [selectedClipIds, selectedClipId, selectedAudioClipId, videoClips, localAudioClips, onUpdateVideoClips, onUpdateAudioClips, setSelectedClipIds]);

    return (
        <div className="w-full h-full bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700 flex flex-col select-none">
            {/* Toolbar */}
            <div className="h-12 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between px-4">
                <div className="flex items-center gap-1">
                    <button onClick={onUndo} disabled={!canUndo} className="p-2 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-zinc-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed" title="Undo (Ctrl+Z)">
                        <Undo2 size={18} />
                    </button>
                    <button onClick={onRedo} disabled={!canRedo} className="p-2 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-zinc-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed" title="Redo (Ctrl+Shift+Z)">
                        <Redo2 size={18} />
                    </button>
                    <div className="w-px h-6 bg-gray-300 dark:bg-zinc-600 mx-2" />
                    <button onClick={handleSplit} className="p-2 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-zinc-700 rounded-lg">
                        <Scissors size={18} />
                    </button>
                    <button onClick={handleDelete} className="p-2 text-gray-500 hover:text-red-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-zinc-700 rounded-lg">
                        <Trash2 size={18} />
                    </button>
                    <div className="w-px h-6 bg-gray-300 dark:bg-zinc-600 mx-2" />
                    {/* Audio Unlink Button */}
                    <button
                        onClick={() => selectedClipId && handleUnlinkAudio(selectedClipId)}
                        disabled={!selectedClipId || videoClips.find(c => c.id === selectedClipId)?.hasAudio === false}
                        className="p-2 text-gray-500 hover:text-sky-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-zinc-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                        title="오디오 분리"
                    >
                        <span className="text-sm">🔊</span>
                        <span className="text-xs">분리</span>
                    </button>
                    <div className="w-px h-6 bg-gray-300 dark:bg-zinc-600 mx-2" />

                    {/* CapCut-style Mode Toggles - Simple Icons */}
                    <button
                        onClick={() => setMagnetMode(!magnetMode)}
                        className={`p-2 rounded-lg transition-colors ${magnetMode ? 'text-cyan-500' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'}`}
                        title="마그넷: 클립 자동 정렬"
                    >
                        <Magnet size={18} />
                    </button>
                    <button
                        onClick={() => setSnapMode(!snapMode)}
                        className={`p-2 rounded-lg transition-colors ${snapMode ? 'text-cyan-500' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'}`}
                        title="스냅: 자동 붙기"
                    >
                        <MousePointer size={18} />
                    </button>
                    <button
                        onClick={() => setLinkMode(!linkMode)}
                        className={`p-2 rounded-lg transition-colors ${linkMode ? 'text-cyan-500' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'}`}
                        title="연결: 비디오-오디오 함께 이동"
                    >
                        <Link size={18} />
                    </button>

                    <div className="w-px h-6 bg-gray-300 dark:bg-zinc-600 mx-2" />
                    <button onClick={handleZoomOut} className="p-2 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-zinc-700 rounded-lg">
                        <ZoomOut size={18} />
                    </button>
                    <input type="range" min="20" max="500" value={pxPerSec} onChange={(e) => setPxPerSec(Number(e.target.value))} className="w-24 h-1 accent-indigo-500" />
                    <button onClick={handleZoomIn} className="p-2 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-zinc-700 rounded-lg">
                        <ZoomIn size={18} />
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onPlayPause} className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors shadow-lg">
                        {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                    </button>
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-700 px-3 py-1 rounded-lg">
                        <span className="text-sm font-mono font-bold text-gray-700 dark:text-gray-200">
                            {formatTimeFull(externalCurrentTime || 0)}
                        </span>
                    </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    {videoClips.length} clips
                </div>
            </div>

            {/* Single Scroll Container - Unified Layout */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <div
                    ref={containerRef}
                    className="w-full h-full overflow-auto relative bg-white cursor-text"
                    onMouseDown={handleTrackMouseDown}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {/* Ruler Row with Corner Cell - Sticky Top */}
                    <div className="flex sticky top-0 z-30">
                        {/* Corner cell - sticky both directions */}
                        <div className="w-10 h-6 bg-gray-100 border-b border-r border-gray-200 sticky left-0 z-40 flex-shrink-0" />
                        {/* Ruler */}
                        <div
                            className="h-6 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 relative cursor-ew-resize flex-shrink-0"
                            style={{ width: totalWidth }}
                            onMouseDown={handleScrubStart}
                        >
                            {(() => {
                                // Adaptive ruler ticks based on zoom level (CapCut/Premiere style)
                                // Calculate appropriate tick interval based on pxPerSec
                                // Aim for ticks to be at least 40px apart, labels at least 80px apart

                                const minTickSpacing = 40; // Minimum pixels between ticks
                                const minLabelSpacing = 80; // Minimum pixels between labels

                                // Available intervals in seconds (sorted from small to large)
                                const intervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

                                // Find smallest interval that gives at least minTickSpacing pixels
                                let tickInterval = 1;
                                for (const interval of intervals) {
                                    if (interval * pxPerSec >= minTickSpacing) {
                                        tickInterval = interval;
                                        break;
                                    }
                                }
                                if (tickInterval === 1 && pxPerSec < minTickSpacing) {
                                    // Even 1s is too small, find appropriate larger interval
                                    tickInterval = Math.ceil(minTickSpacing / pxPerSec);
                                }

                                // Calculate label interval (show label every N ticks)
                                let labelMultiplier = 1;
                                while (tickInterval * labelMultiplier * pxPerSec < minLabelSpacing) {
                                    labelMultiplier++;
                                }
                                const labelInterval = tickInterval * labelMultiplier;

                                // Generate ticks
                                const ticks = [];
                                for (let time = 0; time <= duration + tickInterval; time += tickInterval) {
                                    const isLabelTick = time % labelInterval === 0;
                                    ticks.push(
                                        <div
                                            key={time}
                                            className="absolute top-0 h-full flex flex-col items-start"
                                            style={{ left: time * pxPerSec }}
                                        >
                                            <div className={`w-px ${isLabelTick ? 'h-3 bg-gray-400' : 'h-2 bg-gray-300'}`} />
                                            {isLabelTick && <span className="text-[10px] text-gray-500 ml-0.5">{formatTime(time)}</span>}
                                        </div>
                                    );
                                }
                                return ticks;
                            })()}
                        </div>
                    </div>

                    {/* CC Track Row */}
                    <div className="flex">
                        {/* CC Header - sticky left */}
                        <div className="w-10 h-16 flex items-center justify-center bg-gray-50 border-b border-r border-gray-200 sticky left-0 z-10 flex-shrink-0">
                            <span className="text-[10px] text-gray-500 font-bold">CC</span>
                        </div>
                        {/* CC Content */}
                        <div className="relative h-16 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0" style={{ width: totalWidth }}>
                            <div className="absolute inset-0 bg-gray-200/30 dark:bg-zinc-800/30" />
                            {subtitles.map((sub, index) => (
                                <div
                                    key={sub.id}
                                    className={`subtitle-block absolute h-10 top-2 rounded-lg border-2 text-xs overflow-hidden flex items-center shadow-sm transition-all duration-75
                                        ${selectedSubtitleId === sub.id ? 'ring-2 ring-indigo-500 z-40' : ''}
                                        ${(externalCurrentTime || 0) >= sub.startTime && (externalCurrentTime || 0) < sub.endTime ? 'ring-2 ring-yellow-400 brightness-110 z-30 scale-[1.02]' : ''}
                                        ${getBlockColor(index).bg} ${getBlockColor(index).border}`}
                                    style={{
                                        left: sub.startTime * pxPerSec,
                                        width: Math.max((sub.endTime - sub.startTime) * pxPerSec, 30),
                                        zIndex: isDragging?.id === sub.id ? 50 : ((externalCurrentTime || 0) >= sub.startTime && (externalCurrentTime || 0) < sub.endTime ? 30 : 10)
                                    }}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setSelectedSubtitleId(sub.id);
                                        setIsDragging({ id: sub.id, type: 'move', target: 'subtitle', startX: e.clientX, originalStart: sub.startTime, originalEnd: sub.endTime });
                                    }}
                                >
                                    <span className="px-2 truncate text-white pointer-events-none">{sub.text}</span>
                                    <div className="absolute left-0 w-2 h-full cursor-ew-resize" onMouseDown={(e) => { e.stopPropagation(); setIsDragging({ id: sub.id, type: 'left', target: 'subtitle', startX: e.clientX, originalStart: sub.startTime, originalEnd: sub.endTime }) }} />
                                    <div className="absolute right-0 w-2 h-full cursor-ew-resize" onMouseDown={(e) => { e.stopPropagation(); setIsDragging({ id: sub.id, type: 'right', target: 'subtitle', startX: e.clientX, originalStart: sub.startTime, originalEnd: sub.endTime }) }} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Spacer between CC and Video tracks */}
                    <div className="flex">
                        <div className="w-10 h-1.5 bg-white sticky left-0 z-10 flex-shrink-0" />
                        <div className="h-1.5 bg-white flex-shrink-0" style={{ width: totalWidth }} />
                    </div>

                    {/* Dynamic Video Layers */}
                    {renderLayers.map(layerIndex => {
                        // V1 main track is taller (CapCut style)
                        const isMainTrack = layerIndex === 0;
                        const trackHeight = isMainTrack ? 80 : 65; // V1=80px, V2+=65px

                        return (
                            <React.Fragment key={layerIndex}>
                                {/* Video Track Row - overflow-visible for smooth vertical drag */}
                                <div className="flex overflow-visible">
                                    {/* Track Header - sticky left */}
                                    <div
                                        className={`w-10 flex items-center justify-center border-b border-r border-gray-200 sticky left-0 z-10 flex-shrink-0 ${isMainTrack ? 'bg-gray-100' : 'bg-gray-50'}`}
                                        style={{ height: trackHeight }}
                                    >
                                        <span className="text-[10px] text-gray-600 font-bold">V{layerIndex + 1}</span>
                                    </div>
                                    {/* Track Content - overflow-visible allows clips to extend during drag */}
                                    <div
                                        className={`relative border-b border-gray-200 dark:border-zinc-800 flex-shrink-0 overflow-visible`}
                                        style={{ width: totalWidth, height: trackHeight }}
                                    >
                                        <div className={`absolute inset-0 ${isMainTrack ? 'bg-zinc-200 dark:bg-zinc-900' : 'bg-zinc-100 dark:bg-zinc-950/50'}`} />

                                        {/* Hint for new track */}
                                        {videoClips.filter(c => (c.layer || 0) === layerIndex).length === 0 && layerIndex > 0 && (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                                                <span className="text-xs text-black dark:text-white">Track V{layerIndex + 1}</span>
                                            </div>
                                        )}
                                        {(() => {
                                            const layerClips = videoClips
                                                .filter(c => (c.layer || 0) === layerIndex)
                                                .sort((a, b) => a.startTime - b.startTime);

                                            const showGap = dropIndicator && dropIndicator.layer === layerIndex && dropIndicator.gapIndex !== undefined && dropIndicator.gapIndex >= 0 && dropIndicator.gapSize !== undefined;

                                            return layerClips.map((clip, index) => {
                                                const isShifted = showGap && index >= (dropIndicator.gapIndex!);
                                                const shiftAmount = isShifted ? (dropIndicator.gapSize! * pxPerSec) : 0;

                                                return (
                                                    <React.Fragment key={clip.id}>
                                                        {/* Magnet Gap Placeholder removed - using global CapCut-style placeholder */}

                                                        <div
                                                            className="absolute inset-0 pointer-events-none"
                                                            style={{ transform: `translateX(${shiftAmount}px)` }}
                                                        >
                                                            <div
                                                                className="pointer-events-auto video-clip-wrapper"
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                            >
                                                                <VideoClipItem
                                                                    clip={clip}
                                                                    layerIndex={layerIndex}
                                                                    pxPerSec={pxPerSec}
                                                                    containerDuration={duration}
                                                                    isSelected={selectedClipIds.has(clip.id)}
                                                                    isCutMode={isCutMode}
                                                                    frameThumbnails={frameThumbnails}
                                                                    thumbnailAspectRatio={thumbnailAspectRatio}
                                                                    containerRef={containerRef}
                                                                    handleUnlinkAudio={handleUnlinkAudio}
                                                                    contextMenu={contextMenu}
                                                                    splitClip={splitClip}
                                                                    onMouseDown={handleVideoClipMouseDown}
                                                                    onContextMenu={handleVideoClipContextMenu}
                                                                    onDragHandle={handleVideoClipDragHandle}
                                                                    isDragging={isDragging?.id === clip.id && isDragging?.type === 'move'}
                                                                    hasMoved={isDragging?.id === clip.id && isDragging?.type === 'move' && !!(
                                                                        isDragging?.screenX && isDragging?.screenStartX &&
                                                                        (Math.abs(isDragging.screenX - isDragging.screenStartX) > 5 ||
                                                                            Math.abs((isDragging?.screenY || 0) - (isDragging?.screenStartY || 0)) > 5)
                                                                    )}
                                                                    dragOffsetX={isDragging?.id === clip.id && isDragging?.type === 'move' ? (isDragging?.currentX || 0) * pxPerSec : 0}
                                                                    dragOffsetY={isDragging?.id === clip.id && isDragging?.type === 'move' ? (isDragging?.currentY || 0) : 0}
                                                                    trimLeftOffset={isDragging?.id === clip.id && isDragging?.type === 'left' ? (isDragging?.currentX || 0) * pxPerSec : 0}
                                                                    trimRightOffset={isDragging?.id === clip.id && isDragging?.type === 'right' ? (isDragging?.currentX || 0) * pxPerSec : 0}
                                                                    audioWaveformL={audioWaveformL}
                                                                    onVolumeChange={handleVolumeChange}
                                                                />
                                                            </div>
                                                        </div>
                                                    </React.Fragment>
                                                );
                                            }).concat(
                                                (showGap && dropIndicator.gapIndex === layerClips.length) ? [(
                                                    <div
                                                        key="ghost-end"
                                                        className="absolute h-12 top-1 border-2 border-dashed border-indigo-400/50 bg-indigo-500/10 rounded-lg"
                                                        style={{
                                                            left: (layerClips.length > 0 ? layerClips[layerClips.length - 1].endTime : 0) * pxPerSec,
                                                            width: dropIndicator.gapSize! * pxPerSec,
                                                            zIndex: 0
                                                        }}
                                                    />
                                                )] : []
                                            );
                                            // ghost-free placeholder removed - using global CapCut-style placeholder instead
                                        })()}
                                    </div>
                                </div>
                                {/* Spacer between video tracks */}
                                <div className="flex">
                                    <div className="w-10 h-1.5 bg-white sticky left-0 z-10 flex-shrink-0" />
                                    <div className="h-1.5 bg-white flex-shrink-0" style={{ width: totalWidth }} />
                                </div>
                            </React.Fragment>
                        );
                    })}

                    {/* Audio Tracks - Dynamic layers (A1, A2, A3...) */}
                    {(() => {
                        // Dynamic Audio Layer Calculation
                        let maxLayer = 0;
                        localAudioClips.forEach(c => {
                            if ((c.layer || 0) > maxLayer) maxLayer = c.layer || 0;
                        });

                        // If dragging an audio clip to a new layer (phantom track), add it
                        if (isDragging?.target === 'audio' && isDragging.stickyLayer !== undefined) {
                            if (isDragging.stickyLayer > maxLayer) maxLayer = isDragging.stickyLayer;
                        }

                        // Generate array from 0 to maxLayer (e.g., if max is 2, get [0, 1, 2])
                        const effectiveAudioLayers = Array.from({ length: maxLayer + 1 }, (_, i) => i);

                        return effectiveAudioLayers.map(audioLayer => {
                            const showAudioGap = audioDropIndicator && audioDropIndicator.layer === audioLayer && audioDropIndicator.gapIndex !== -1;
                            const audioLayerClips = localAudioClips
                                .filter(clip => (clip.layer || 0) === audioLayer)
                                .sort((a, b) => a.startTime - b.startTime);

                            return (
                                <React.Fragment key={`audio-track-${audioLayer}`}>
                                    {/* Audio Track Row */}
                                    <div className="flex">
                                        {/* Track Header - sticky left */}
                                        <div className="w-10 h-10 flex items-center justify-center bg-gray-50 border-b border-r border-gray-200 sticky left-0 z-10 flex-shrink-0">
                                            <span className="text-[10px] text-sky-600 font-bold">A{audioLayer + 1}</span>
                                        </div>
                                        {/* Track Content */}
                                        <div className="relative h-10 border-b border-gray-200 flex-shrink-0" style={{ width: totalWidth }}>
                                            <div className="absolute inset-0 bg-sky-50" />

                                            {audioLayerClips.map((audioClip, index) => {
                                                const isShifted = showAudioGap && index >= audioDropIndicator.gapIndex;
                                                const shiftAmount = isShifted ? (audioDropIndicator.gapSize * pxPerSec) : 0;

                                                return (
                                                    <React.Fragment key={audioClip.id}>
                                                        {showAudioGap && index === audioDropIndicator.gapIndex && (
                                                            <div
                                                                className="absolute top-0 bottom-0 border-2 border-dashed border-emerald-500 bg-emerald-500/10 rounded z-20"
                                                                style={{
                                                                    left: (index > 0 ? audioLayerClips[index - 1].endTime : 0) * pxPerSec,
                                                                    width: audioDropIndicator.gapSize * pxPerSec,
                                                                    zIndex: 0
                                                                }}
                                                            />
                                                        )}
                                                        <div style={{ transform: `translateX(${shiftAmount}px)` }}>
                                                            <UnlinkedAudioClipItem
                                                                clip={audioClip}
                                                                pxPerSec={pxPerSec}
                                                                containerDuration={duration}
                                                                isSelected={selectedClipIds.has(audioClip.id)}
                                                                isCutMode={isCutMode}
                                                                audioWaveformL={audioWaveformL}
                                                                containerRef={containerRef}
                                                                splitClip={splitClip}
                                                                onMouseDown={handleAudioClipMouseDown}
                                                                onContextMenu={handleAudioClipContextMenu}
                                                                onDragHandle={handleAudioClipDragHandle}
                                                                isDragging={isDragging?.id === audioClip.id && isDragging?.type === 'move' && !!(
                                                                    isDragging?.screenX && isDragging?.screenStartX &&
                                                                    (Math.abs(isDragging.screenX - isDragging.screenStartX) > 5 ||
                                                                        Math.abs((isDragging?.screenY || 0) - (isDragging?.screenStartY || 0)) > 5)
                                                                )}
                                                                trimLeftOffset={isDragging?.id === audioClip.id && isDragging?.type === 'left' ? (isDragging?.currentX || 0) * pxPerSec : 0}
                                                                trimRightOffset={isDragging?.id === audioClip.id && isDragging?.type === 'right' ? (isDragging?.currentX || 0) * pxPerSec : 0}
                                                            />
                                                        </div>
                                                    </React.Fragment>
                                                );
                                            })}

                                            {showAudioGap && audioDropIndicator.gapIndex === audioLayerClips.length && (
                                                <div
                                                    className="absolute top-0 bottom-0 border-2 border-dashed border-emerald-500 bg-emerald-500/10 rounded z-20"
                                                    style={{
                                                        left: (audioLayerClips.length > 0 ? audioLayerClips[audioLayerClips.length - 1].endTime : 0) * pxPerSec,
                                                        width: audioDropIndicator.gapSize * pxPerSec,
                                                        zIndex: 0
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    {/* Spacer between audio tracks */}
                                    <div className="flex">
                                        <div className="w-10 h-1.5 bg-white sticky left-0 z-10 flex-shrink-0" />
                                        <div className="h-1.5 bg-white flex-shrink-0" style={{ width: totalWidth }} />
                                    </div>
                                </React.Fragment>
                            );
                        });
                    })()}

                    {/* Bottom Spacer to ensure space for dragging audio down */}
                    <div className="h-10 w-full flex-shrink-0" />

                    {/* Playhead - offset by 40px for sticky header */}
                    <div
                        ref={playheadRef}
                        className="absolute top-0 bottom-0 z-50 group cursor-ew-resize"
                        style={{
                            marginLeft: 40,
                            // Smooth transition during playback, instant during scrubbing
                            transition: isPlaying && !isScrubbing ? 'left 50ms linear' : 'none'
                        }}
                        onMouseDown={handleScrubStart}
                    >
                        {/* Hit area */}
                        <div className="absolute inset-y-0 -left-2 -right-2 bg-transparent" />

                        {/* Playhead Triangle */}
                        <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-gray-800 dark:border-t-white group-hover:bg-indigo-500 transition-colors" />

                        {/* Playhead Line */}
                        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-gray-800 dark:bg-white shadow-lg group-hover:bg-indigo-500 transition-colors" />
                    </div>

                    {/* Selection Box Overlay - only show when actively selecting */}
                    {selectionBox && interactionMode === 'selecting' && (
                        <div
                            className="absolute border border-blue-400 bg-blue-400/20 z-[60] pointer-events-none"
                            style={{
                                left: Math.min(selectionBox.startX, selectionBox.currentX),
                                top: Math.min(selectionBox.startY, selectionBox.currentY),
                                width: Math.abs(selectionBox.currentX - selectionBox.startX),
                                height: Math.abs(selectionBox.currentY - selectionBox.startY)
                            }}
                        />
                    )}

                    {/* SNAP INDICATOR LINE (Yellow - CapCut/Premiere style) */}
                    {snapIndicator && (
                        <div
                            className="absolute z-[95] w-0.5 bg-yellow-400 pointer-events-none shadow-[0_0_8px_rgba(250,204,21,0.8)]"
                            style={{
                                left: 40 + snapIndicator.time * pxPerSec, // 40px header offset
                                top: 0,
                                bottom: 0,
                            }}
                        >
                            {/* Diamond indicator at top */}
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rotate-45" />
                            {/* Diamond indicator at bottom */}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rotate-45" />
                        </div>
                    )}

                    {/* VIDEO DRAG HANDLING - Placeholder and Moving Clip */}
                    {isDragging?.type === 'move' && isDragging?.target === 'clip' && (() => {
                        const clip = videoClips.find(c => c.id === isDragging.id);
                        if (!clip) return null;

                        const hasMoved = isDragging.screenX && isDragging.screenStartX &&
                            (Math.abs(isDragging.screenX - isDragging.screenStartX) > 5 ||
                                Math.abs((isDragging.screenY || 0) - (isDragging.screenStartY || 0)) > 5);

                        const clipWidth = (clip.endTime - clip.startTime) * pxPerSec;
                        const clipHeight = 64;

                        const dragX = (isDragging.currentX || 0) * pxPerSec;
                        const originalLeft = 40 + clip.startTime * pxPerSec;
                        const visualIndex = dropIndicator ? renderLayers.indexOf(dropIndicator.layer) : renderLayers.indexOf(clip.layer ?? 0);

                        const placeholderTop = 95 + (visualIndex * 71.5);
                        const placeholderLeft = originalLeft + dragX;

                        return (
                            <>
                                {hasMoved && (
                                    <div
                                        className="absolute border-2 border-dashed border-gray-400 bg-gray-200/50 rounded-lg z-10"
                                        style={{
                                            left: placeholderLeft,
                                            top: placeholderTop,
                                            width: clipWidth,
                                            height: clipHeight,
                                        }}
                                    />
                                )}

                                {(() => {
                                    const originalLayer = isDragging.originalLayer ?? (clip.layer ?? 0);
                                    const originalVisualIndex = renderLayers.indexOf(originalLayer);

                                    // Calculate originalTop accurately (V1=86, others=71)
                                    let originalTop = 94; // Header: Ruler(24) + CC(64) + spacer(6)
                                    for (let i = 0; i < originalVisualIndex; i++) {
                                        originalTop += (renderLayers[i] === 0) ? 86 : 71;
                                    }

                                    const dragY = isDragging.currentY || 0;
                                    const ghostLeft = originalLeft + dragX;

                                    // Height: V1=80, others=65
                                    const ghostHeight = (originalLayer === 0) ? 80 : 65;

                                    // Create ghost clip with startTime=0 to prevent double left calculation
                                    const ghostClip = { ...clip, startTime: 0, endTime: clip.endTime - clip.startTime };

                                    return (
                                        <div
                                            className="absolute z-[90] pointer-events-none"
                                            style={{
                                                left: ghostLeft,
                                                top: originalTop + dragY,
                                                width: clipWidth,
                                                height: ghostHeight,
                                            }}
                                        >
                                            <VideoClipItem
                                                clip={ghostClip}
                                                layerIndex={originalLayer}
                                                pxPerSec={pxPerSec}
                                                containerDuration={duration}
                                                isSelected={false}
                                                isCutMode={isCutMode}
                                                frameThumbnails={frameThumbnails}
                                                thumbnailAspectRatio={thumbnailAspectRatio}
                                                containerRef={containerRef}
                                                handleUnlinkAudio={() => { }}
                                                contextMenu={null}
                                                splitClip={() => { }}
                                                onMouseDown={() => { }}
                                                onContextMenu={() => { }}
                                                onDragHandle={() => { }}
                                                isDragging={false}
                                                dragOffsetX={0}
                                                dragOffsetY={0}
                                                audioWaveformL={audioWaveformL}
                                                onVolumeChange={() => { }}
                                            />
                                        </div>
                                    );
                                })()}
                            </>
                        );
                    })()}

                    {/* AUDIO DRAG HANDLING - Placeholder and Moving Clip */}
                    {isDragging?.type === 'move' && isDragging?.target === 'audio' && (() => {
                        const clip = localAudioClips.find(c => c.id === isDragging.id);
                        if (!clip) return null;

                        const hasMoved = isDragging.screenX && isDragging.screenStartX &&
                            (Math.abs(isDragging.screenX - isDragging.screenStartX) > 5 ||
                                Math.abs((isDragging.screenY || 0) - (isDragging.screenStartY || 0)) > 5);

                        const clipWidth = (clip.endTime - clip.startTime) * pxPerSec;
                        const clipHeight = 40; // Match actual h-10 = 40px
                        const dragX = (isDragging.screenX || 0) - (isDragging.screenStartX || 0);
                        const originalLeft = 40 + clip.startTime * pxPerSec;

                        // Calculate video section height accurately (V1=86, others=71)
                        // Header: Ruler(24) + CC(64) + spacer(6) = 94
                        // Each video track already includes its spacer: V1=80+6=86, V2+=65+6=71
                        const headerHeight = 24 + 64 + 6; // = 94
                        let videoTracksHeight = 0;
                        for (const layer of renderLayers) {
                            videoTracksHeight += (layer === 0) ? 86 : 71;
                        }
                        // Only add one spacer between video and audio sections
                        const videoSectionHeight = headerHeight + videoTracksHeight + 6;

                        const layerIndex = isDragging.type === 'move' ? (isDragging.stickyLayer ?? clip.layer ?? 0) : (clip.layer || 0);
                        const visualIndex = layerIndex; // Audio tracks are sequential 0..N

                        // Audio track: 40px height (h-10) + 6px spacer (h-1.5) = 46px per track
                        const audioTrackHeight = 46;
                        const originalTop = videoSectionHeight + ((clip.layer || 0) * audioTrackHeight);
                        const ghostTop = originalTop + (isDragging.currentY || 0);

                        // Placeholder position (snapped) - use same audioTrackHeight
                        const placeholderTop = videoSectionHeight + (visualIndex * audioTrackHeight);
                        const placeholderLeft = originalLeft + dragX;

                        return (
                            <>
                                {hasMoved && (
                                    <div
                                        className="absolute border-2 border-dashed border-emerald-500 bg-emerald-500/10 rounded-lg z-10"
                                        style={{
                                            left: placeholderLeft,
                                            top: placeholderTop,
                                            width: clipWidth,
                                            height: clipHeight,
                                        }}
                                    />
                                )}

                                {hasMoved && (() => {
                                    // Calculate ghost position based on mouse movement
                                    const ghostLeft = originalLeft + dragX;
                                    const dragY = (isDragging.screenY || 0) - (isDragging.screenStartY || 0);
                                    const ghostTopPos = originalTop + dragY;

                                    // Create a modified clip with startTime=0 for ghost rendering
                                    // This prevents double-calculation of left position
                                    const ghostClip = { ...clip, startTime: 0, endTime: clip.endTime - clip.startTime };

                                    return (
                                        <div
                                            className="absolute z-[90] pointer-events-none"
                                            style={{
                                                left: ghostLeft,
                                                top: ghostTopPos,
                                                width: clipWidth,
                                                height: clipHeight,
                                            }}
                                        >
                                            <UnlinkedAudioClipItem
                                                clip={ghostClip}
                                                pxPerSec={pxPerSec}
                                                containerDuration={duration}
                                                isSelected={false}
                                                isCutMode={isCutMode}
                                                audioWaveformL={audioWaveformL}
                                                containerRef={containerRef}
                                                splitClip={() => { }}
                                                onMouseDown={() => { }}
                                                onContextMenu={() => { }}
                                                onDragHandle={() => { }}
                                                isDragging={false}
                                            />
                                        </div>
                                    );
                                })()}
                            </>
                        );
                    })()}







                </div>
            </div>
            {/* Context Menu */}
            {
                contextMenu && (
                    <div
                        className="fixed z-[100] bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px]"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onClick={() => setContextMenu(null)}
                    >
                        {contextMenu.type === 'clip' && (
                            <>
                                {videoClips.find(c => c.id === contextMenu.id)?.hasAudio !== false && (
                                    <button
                                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-zinc-700 flex items-center gap-2"
                                        onClick={() => handleUnlinkAudio(contextMenu.id)}
                                    >
                                        🔊 오디오 분리
                                    </button>
                                )}
                                {/* Show Merge Option if both Video and Audio are selected */}
                                {(selectedClipIds.size > 0 && localAudioClips.some(a => selectedClipIds.has(a.id))) && (
                                    <button
                                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-zinc-700 flex items-center gap-2"
                                        onClick={() => handleMergeAudio()}
                                    >
                                        🔊 오디오 합치기
                                    </button>
                                )}
                                <button
                                    onClick={() => handleContextMenuDelete()}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    삭제
                                </button>
                                <div className="border-t border-zinc-700 my-1" />
                                <button
                                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-700 flex items-center gap-2"
                                    onClick={() => setContextMenu(null)}
                                >
                                    ✖ 취소
                                </button>
                            </>
                        )}
                        {contextMenu.type === 'audio' && (
                            <>
                                <button
                                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-zinc-700 flex items-center gap-2"
                                    onClick={() => handleMergeAudio()}
                                >
                                    🔊 오디오 합치기
                                </button>
                                <div className="border-t border-zinc-700 my-1" />
                                <button
                                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-700 flex items-center gap-2"
                                    onClick={() => setContextMenu(null)}
                                >
                                    ✖ 취소
                                </button>
                            </>
                        )}
                    </div>
                )
            }

            {/* Click away to close context menu */}
            {
                contextMenu && (
                    <div
                        className="fixed inset-0 z-[99]"
                        onClick={() => setContextMenu(null)}
                    />
                )
            }


            {/* DragOverlay removed - CapCut style uses only placeholder, not ghost clip */}
        </div >
    );
}

