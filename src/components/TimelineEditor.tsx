import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Play, Pause, AlertCircle, Trash2, Scissors, Copy, ZoomIn, ZoomOut, SkipBack, SkipForward, Undo2, Redo2 } from 'lucide-react';
import { VideoClipItem, UnlinkedAudioClipItem } from './TimelineClipItems';

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
    layer?: number; // 0 = Main, 1 = Overlay
    hasAudio?: boolean; // true by default, false when audio is unlinked
    src?: string;
    name?: string;
    type?: string;
}

export interface AudioClip {
    id: string;
    videoClipId: string; // Original video clip this came from
    startTime: number;
    endTime: number;
    sourceStart: number;
    sourceEnd: number;
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
    isCutMode?: boolean;
    // New Props for Linked Editing
    audioClips: AudioClip[];
    onUpdateAudioClips: (clips: AudioClip[]) => void;
    isAudioSeparated: boolean;
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
    isCutMode = false,
    audioClips,
    onUpdateAudioClips,
    isAudioSeparated
}: TimelineEditorProps) {
    // Timeline State
    const [pxPerSec, setPxPerSec] = useState(100);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState<{ id: string, type: 'left' | 'right' | 'move', target: 'clip' | 'subtitle' | 'audio', startX: number, originalStart: number, originalEnd: number, currentX?: number, mouseX?: number, mouseY?: number } | null>(null);
    const [dropIndicator, setDropIndicator] = useState<{ time: number, layer: number, gapIndex?: number, gapSize?: number } | null>(null);
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

    useEffect(() => {
        setVideoClips(externalClips);
    }, [externalClips]);

    useEffect(() => {
        setLocalAudioClips(audioClips);
    }, [audioClips]);

    // NOTE: Auto-condense removed for performance. Clips are condensed only on drop (handleMouseUp).

    // Dynamic Layers Logic: Show max used layer + 1 (for creating new)
    const renderLayers = useMemo(() => {
        // Find max used layer
        const maxLayer = Math.max(0, ...videoClips.map(c => c.layer || 0));
        // Array from 0 to maxLayer + 1
        // We reverse it so higher layers are on top
        return Array.from({ length: maxLayer + 2 }, (_, i) => i).reverse();
    }, [videoClips]);

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

    // Sync single selection to multi-selection (compatibility)
    useEffect(() => {
        if (selectedClipId) setSelectedClipIds(new Set([selectedClipId]));
        else if (selectedClipIds.size === 1) { /* already synced or handled elsewhere */ }
        else if (selectedClipIds.size === 0 && selectedClipId) setSelectedClipId(null);
    }, [selectedClipId]);

    // Derived single ID for backward compatibility properties (like property panel)
    // If multiple selected, maybe we just show the first one or null
    useEffect(() => {
        if (selectedClipIds.size === 1) {
            const id = Array.from(selectedClipIds)[0];
            if (id !== selectedClipId) setSelectedClipId(id);
        } else if (selectedClipIds.size > 1) {
            // If multiple, strictly separate from 'selectedClipId' which might be used for single-clip props??
            // For now, let's keep selectedClipId as the "primary" selection if valid
            if (!selectedClipIds.has(selectedClipId || '')) setSelectedClipId(null);
        } else {
            if (selectedClipId) setSelectedClipId(null);
        }
    }, [selectedClipIds]);

    // Smooth playhead & Scrubbing state
    const playheadRef = useRef<HTMLDivElement>(null);

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

            if (isPlaying && videoElement && videoClips.length > 0) {
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
                const currentPx = time * pxPerSec;
                playheadRef.current.style.left = `${currentPx}px`;

                // Auto-center logic
                if (containerRef.current) {
                    const container = containerRef.current;
                    const containerWidth = container.clientWidth;
                    const halfWidth = containerWidth / 2;
                    const targetScrollLeft = currentPx - halfWidth;

                    if (isPlaying) {
                        const currentScrollLeft = container.scrollLeft;
                        const diff = targetScrollLeft - currentScrollLeft;
                        if (Math.abs(diff) > 50) {
                            container.scrollLeft = currentScrollLeft + diff * 0.1;
                        }
                    }
                }
            }
            animationFrameId = requestAnimationFrame(updatePlayhead);
        };

        animationFrameId = requestAnimationFrame(updatePlayhead);
        return () => cancelAnimationFrame(animationFrameId);
    }, [videoElement, isPlaying, pxPerSec, isScrubbing, externalCurrentTime, videoClips, localAudioClips]);

    // Total timeline width
    const totalWidth = Math.max((duration + 5) * pxPerSec, window.innerWidth);

    // Multi-clip Frame Extraction
    const generateFrameThumbnails = useCallback(async () => {
        if (!videoElement || duration <= 0 || videoClips.length === 0) return;

        // Prevent double run if already running (check ref for immediate feedback)
        if (isGeneratingFramesRef.current) return;

        setIsGeneratingFrames(true);
        isGeneratingFramesRef.current = true; // Sync Ref
        onFrameExtractionChange?.(true);

        const canvasHeight = 480;
        const canvasWidth = Math.round(canvasHeight * (16 / 9));
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d', { alpha: false });

        if (!ctx) {
            setIsGeneratingFrames(false);
            isGeneratingFramesRef.current = false; // Reset Ref
            onFrameExtractionChange?.(false);
            return;
        }

        const thumbnails: string[] = [];
        const maxFrames = Math.min(Math.ceil(duration), 30);
        const interval = duration / maxFrames;

        // Helper to load video source
        const loadSource = async (src: string, videoEl: HTMLVideoElement): Promise<void> => {
            return new Promise((resolve, reject) => {
                const isRemote = src.startsWith('http');

                // IMPORTANT: Set crossOrigin BEFORE src for reliable CORS handling
                videoEl.crossOrigin = 'anonymous';
                videoEl.preload = 'auto'; // Force load

                // Add timestamp to prevent caching issues with CORS
                videoEl.src = isRemote
                    ? `/api/proxy-video?url=${encodeURIComponent(src)}&t=${Date.now()}`
                    : src;

                videoEl.muted = true;

                // Use canplay as it might be safer than onloadedmetadata for seeking readiness
                videoEl.onloadedmetadata = () => resolve();
                videoEl.onerror = (e) => {
                    console.error('Video Load Error', e);
                    reject(e);
                };

                // Explicitly call load()
                videoEl.load();
            });
        };

        const extractionVideo = document.createElement('video');

        // Sort clips by startTime (Layer 0)
        const sortedClips = [...videoClips]
            .filter(c => c.layer === 0 || c.layer === undefined)
            .sort((a, b) => a.startTime - b.startTime);

        // Optimized Frame Extraction: Batch by Clip to avoid reloading source
        const framesToExtract: { time: number; index: number; clip: VideoClip }[] = [];

        // 1. Identify which clip is needed for each frame interval
        for (let i = 0; i < maxFrames; i++) {
            const time = i * interval;
            const activeClip = sortedClips.find(c => time >= c.startTime && time < c.endTime);
            if (activeClip && activeClip.src) {
                framesToExtract.push({ time, index: i, clip: activeClip });
            } else {
                thumbnails[i] = ''; // Placeholder for empty space
            }
        }

        // 2. Group frames by Clip ID
        const clipsToProcess = new Map<string, typeof framesToExtract>();
        framesToExtract.forEach(item => {
            const list = clipsToProcess.get(item.clip.id) || [];
            list.push(item);
            clipsToProcess.set(item.clip.id, list);
        });

        // 3. Process each clip ONCE
        for (const [clipId, frames] of clipsToProcess.entries()) {
            if (frames.length === 0) continue;
            const clip = frames[0].clip;

            try {
                // Load source ONLY ONCE per clip
                await loadSource(clip.src!, extractionVideo);

                // Extract all frames for this clip
                for (const frame of frames) {
                    if (!isGeneratingFramesRef.current) break; // Check abort

                    const offset = frame.time - clip.startTime;
                    const targetTime = clip.sourceStart + offset;

                    extractionVideo.currentTime = targetTime;
                    await new Promise<void>(resolve => {
                        const seekHandler = () => {
                            ctx.drawImage(extractionVideo, 0, 0, canvas.width, canvas.height);
                            thumbnails[frame.index] = canvas.toDataURL('image/jpeg', 0.6);
                            resolve();
                        };
                        extractionVideo.addEventListener('seeked', seekHandler, { once: true });
                        // Timeout fallback
                        setTimeout(resolve, 3000);
                    });

                    // Tiny yield to prevent UI freeze and allow network for main player
                    await new Promise(r => setTimeout(r, 50));
                }
            } catch (e) {
                console.error(`Failed to extract frames for clip ${clip.id}`, e);
                // Fill failed frames with black
                frames.forEach(f => {
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    thumbnails[f.index] = canvas.toDataURL('image/jpeg', 0.1);
                });
            }
        }

        // 4. Fallback for any missing indices (should be covered, but safely fill)
        for (let i = 0; i < maxFrames; i++) {
            if (thumbnails[i] === undefined) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                thumbnails[i] = canvas.toDataURL('image/jpeg', 0.1);
            }
        }


        setFrameThumbnails(thumbnails);
        setIsGeneratingFrames(false);
        isGeneratingFramesRef.current = false; // Reset Ref
        onFrameExtractionChange?.(false);
    }, [videoElement, duration, videoClips, onFrameExtractionChange]);

    useEffect(() => {
        if (videoElement && duration > 0 && frameThumbnails.length === 0) {
            const timer = setTimeout(() => {
                generateFrameThumbnails();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [videoElement, duration, generateFrameThumbnails, frameThumbnails.length]);

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

        // Create new audio clip
        const newAudioClip: AudioClip = {
            id: `audio-${clipId}-${Date.now()}`,
            videoClipId: clipId,
            startTime: clip.startTime,
            endTime: clip.endTime,
            sourceStart: clip.sourceStart,
            sourceEnd: clip.sourceEnd,
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
        console.log('[Audio] Unlinked audio from clip:', clipId);
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

    // Main Drag Logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

            const deltaX = e.clientX - isDragging.startX;
            const deltaTime = deltaX / pxPerSec;

            let newStart = isDragging.originalStart;
            let newEnd = isDragging.originalEnd;
            const blockDuration = isDragging.originalEnd - isDragging.originalStart;

            if (isDragging.target === 'subtitle') {
                const rawNewStart = Math.max(0, isDragging.originalStart + deltaTime);
                const rawNewEnd = rawNewStart + blockDuration;

                // Get other subtitles sorted by position
                const otherSubtitles = subtitles
                    .filter((s: Subtitle) => s.id !== isDragging.id)
                    .sort((a: Subtitle, b: Subtitle) => a.startTime - b.startTime);

                if (isDragging.type === 'move') {
                    // Front-Edge 70% Rule for subtitles
                    let pOverlapIndex = -1;

                    otherSubtitles.forEach((s: Subtitle, idx: number) => {
                        const targetDuration = s.endTime - s.startTime;
                        const threshold30Percent = s.startTime + (targetDuration * 0.3);

                        // If dragged subtitle's FRONT is past the 30% mark (70% rule)
                        if (rawNewStart < threshold30Percent && rawNewStart >= s.startTime) {
                            pOverlapIndex = idx;
                        }
                    });

                    if (pOverlapIndex !== -1) {
                        // Reorder detected - sort and condense
                        const targetSub = otherSubtitles[pOverlapIndex];

                        // Create temp array with new position for sorting
                        const tempSubs = subtitles.map(s => {
                            if (s.id === isDragging.id) {
                                return { ...s, startTime: targetSub.startTime - 0.001, endTime: targetSub.startTime - 0.001 + blockDuration };
                            }
                            return s;
                        });

                        // Sort and condense
                        const sortedSubs = tempSubs.sort((a, b) => a.startTime - b.startTime);
                        let cursor = 0;

                        sortedSubs.forEach(s => {
                            const dur = s.endTime - s.startTime;
                            // Update each subtitle with condensed position
                            // (For the dragged one, use raw position for visual float)
                            if (s.id === isDragging.id) {
                                onUpdateSubtitle(s.id, rawNewStart, rawNewEnd);
                            } else {
                                onUpdateSubtitle(s.id, cursor, cursor + dur);
                            }
                            cursor += dur;
                        });
                    } else {
                        // No reorder - just follow mouse
                        onUpdateSubtitle(isDragging.id, rawNewStart, rawNewEnd);
                    }
                } else if (isDragging.type === 'left') {
                    // Resize left edge
                    newStart += deltaTime;
                    const { prevSub } = getAdjacentSubtitles(isDragging.id);
                    if (prevSub && newStart < prevSub.endTime) newStart = prevSub.endTime;
                    if (newStart < 0) newStart = 0;
                    if (newEnd - newStart < 0.1) newStart = newEnd - 0.1;
                    onUpdateSubtitle(isDragging.id, newStart, newEnd);
                } else if (isDragging.type === 'right') {
                    // Resize right edge
                    newEnd += deltaTime;
                    const { nextSub } = getAdjacentSubtitles(isDragging.id);
                    if (nextSub && newEnd > nextSub.startTime) newEnd = nextSub.startTime;
                    if (newEnd > duration) newEnd = duration;
                    if (newEnd - newStart < 0.1) newEnd = newStart + 0.1;
                    onUpdateSubtitle(isDragging.id, newStart, newEnd);
                }

            } else if (isDragging.target === 'clip') {
                const clip = videoClips.find(c => c.id === isDragging.id);
                if (!clip) return;

                let targetLayer = clip.layer || 0;

                // Layer Logic: Calculate target layer from Y position
                if (isDragging.type === 'move') {
                    const containerRect = containerRef.current?.getBoundingClientRect();
                    if (containerRect) {
                        const relativeY = e.clientY - containerRect.top;
                        const headerHeight = 80;
                        const trackHeight = 56;
                        const trackAreaY = relativeY - headerHeight;

                        if (trackAreaY >= 0) {
                            const visualIndex = Math.floor(trackAreaY / trackHeight);
                            if (visualIndex >= 0 && visualIndex < renderLayers.length) {
                                targetLayer = renderLayers[visualIndex];
                            } else if (visualIndex >= renderLayers.length) {
                                targetLayer = 0;
                            }
                        }
                    }


                    const otherClipsInLayer = videoClips.filter(c => c.id !== isDragging.id && (c.layer || 0) === targetLayer)
                        .sort((a, b) => a.startTime - b.startTime);


                    // -------------------------------------------------------------------------
                    // NEW INTERACTION: Magnetic Reorder (TikTok Style)
                    // -------------------------------------------------------------------------
                    // 1. Calculate Unconstrained Position (Visual Ghost)
                    // This is just for the proxy rendering
                    const rawNewStart = Math.max(0, isDragging.originalStart + deltaTime);

                    // 2. Identify Drop Target (Gap Index)
                    const draggedClipDuration = isDragging.originalEnd - isDragging.originalStart;

                    // Get clips in the target layer (excluding dragged clip itself)
                    // We need their indices relative to the layer *before* drag?
                    // No, we treat the remaining clips as a sequence and insert into them.
                    const targetClips = videoClips
                        .filter(c => c.id !== isDragging.id && (c.layer || 0) === targetLayer)
                        .sort((a, b) => a.startTime - b.startTime);

                    // Default insert at end
                    let gapIndex = targetClips.length;

                    // Iterate to find insertion point
                    for (let i = 0; i < targetClips.length; i++) {
                        const target = targetClips[i];
                        const targetWidth = target.endTime - target.startTime;
                        // 70% Threshold Logic
                        // Mouse X (in time units) relative to target start
                        const mouseTime = rawNewStart; // Mouse "head" time? Or Mouse cursor time?
                        // "rawNewStart" is roughly the start time of the ghost clip.
                        // User wants: "Pass 70% of target".
                        // Target 70% point: start + width * 0.7
                        const threshold = target.startTime + (targetWidth * 0.7);

                        // Check if we haven't passed this clip's threshold yet
                        if (rawNewStart < threshold) {
                            gapIndex = i;
                            break;
                        }
                        // If we passed it, we check the next one.
                    }

                    // 3. Update UI State (No Array Mutation Here!)
                    // Store gapIndex and gapSize (dragged clip duration)
                    setDropIndicator({ time: 0, layer: targetLayer, gapIndex, gapSize: draggedClipDuration });

                    // Update isDragging with current Delta to drive Ghost Rendering
                    setIsDragging(prev => prev ? { ...prev, currentX: deltaTime, mouseX: e.clientX, mouseY: e.clientY } : null);

                    return; // Early return, do not condense or setVideoClips
                }




                // Deleted old magnetic logic


                // Resize Logic
                if (isDragging.type !== 'move') {
                    const currentDrag = isDragging!; // Assert non-null
                    const targetClip = videoClips.find(c => c.id === currentDrag.id);

                    if (targetClip) {
                        let newStart = currentDrag.originalStart;
                        let newEnd = currentDrag.originalEnd;
                        let targetLayer = targetClip.layer || 0;

                        if (isDragging.type === 'left') {
                            newStart = isDragging.originalStart + deltaTime;

                            // Adjacent Clip Logic
                            const { prevClip } = getAdjacentClips(isDragging.id, targetLayer);
                            if (prevClip && newStart < prevClip.endTime) newStart = prevClip.endTime;

                            if (newStart < 0) newStart = 0;
                            if (newStart >= targetClip.endTime - 0.1) newStart = targetClip.endTime - 0.1;

                        } else if (isDragging.type === 'right') {
                            newEnd = isDragging.originalEnd + deltaTime;

                            // Adjacent Clip Logic
                            const { nextClip } = getAdjacentClips(isDragging.id, targetLayer);
                            if (nextClip && newEnd > nextClip.startTime) newEnd = nextClip.startTime;

                            if (newEnd > duration) newEnd = duration;
                            if (newEnd <= targetClip.startTime + 0.1) newEnd = targetClip.startTime + 0.1;
                        }

                        const updatedClips = videoClips.map((c: VideoClip) =>
                            c.id === currentDrag.id
                                ? { ...c, startTime: newStart, endTime: newEnd, layer: targetLayer }
                                : c
                        );
                        setVideoClips(updatedClips);
                    }
                }

            } else if (isDragging.target === 'audio') {
                const audioClip = localAudioClips.find(a => a.id === isDragging.id);
                if (!audioClip) return;

                const { prevClip, nextClip } = getAdjacentAudioClips(isDragging.id);

                if (isDragging.type === 'move') {
                    newStart += deltaTime;
                    newEnd += deltaTime;

                    if (prevClip && newStart < prevClip.endTime) {
                        newStart = prevClip.endTime;
                        newEnd = newStart + blockDuration;
                    }
                    if (nextClip && newEnd > nextClip.startTime) {
                        newEnd = nextClip.startTime;
                        newStart = newEnd - blockDuration;
                    }
                } else if (isDragging.type === 'left') {
                    newStart += deltaTime;
                    if (prevClip && newStart < prevClip.endTime) newStart = prevClip.endTime;
                } else if (isDragging.type === 'right') {
                    newEnd += deltaTime;
                    if (nextClip && newEnd > nextClip.startTime) newEnd = nextClip.startTime;
                }

                if (newStart < 0) newStart = 0;
                if (newEnd > duration) newEnd = duration;

                if (newEnd - newStart < 0.1) {
                    if (isDragging.type === 'left') newStart = newEnd - 0.1;
                    else newEnd = newStart + 0.1;
                }

                const updatedAudioClips = localAudioClips.map(a =>
                    a.id === isDragging.id
                        ? { ...a, startTime: newStart, endTime: newEnd }
                        : a
                );
                setLocalAudioClips(updatedAudioClips); // Local only during drag
            }
        };

        const handleMouseUp = () => {
            // COMMIT ON DROP: Always auto-condense clips to ensure no overlaps/gaps
            // COMMIT INSERT: Use Drop Indicator (Gap Logic)
            if (isDragging?.target === 'clip' && dropIndicator && dropIndicator.gapIndex !== undefined) {
                const clip = videoClips.find(c => c.id === isDragging.id);
                if (!clip) {
                    setDropIndicator(null);
                    setIsDragging(null);
                    return;
                }

                // 1. Remove clip from old position (filter)
                const otherClips = videoClips.filter(c => c.id !== clip.id);

                // 2. Identify target layer clips
                // We need the same sorted list we used in handleMouseMove
                const targetLayerClips = otherClips
                    .filter(c => (c.layer || 0) === dropIndicator.layer)
                    .sort((a, b) => a.startTime - b.startTime);

                // 3. Insert into Gap Index
                // gapIndex is an index into targetLayerClips
                const insertIdx = Math.min(Math.max(0, dropIndicator.gapIndex), targetLayerClips.length);

                const newLayerOrder = [
                    ...targetLayerClips.slice(0, insertIdx),
                    { ...clip, layer: dropIndicator.layer },
                    ...targetLayerClips.slice(insertIdx)
                ];

                // 4. Condense All clips in the target layer (Ripple)
                let finalClips: VideoClip[] = [];

                // Process other layers separately (keep them as is)
                const otherLayers = otherClips.filter(c => (c.layer || 0) !== dropIndicator.layer);
                finalClips = [...finalClips, ...otherLayers];

                // Process Target Layer (Condense)
                let cursor = 0;
                newLayerOrder.forEach(c => {
                    const dur = c.endTime - c.startTime;
                    finalClips.push({ ...c, startTime: cursor, endTime: cursor + dur });
                    cursor += dur;
                });

                setVideoClips(finalClips);
                onUpdateVideoClips(finalClips); // Sync immediately

                // Reset playhead to beginning after reorder for better UX
                onSeek(0);

                // Skip handleDragEndSync since we just synced with correct data!
                setDropIndicator(null);
                setIsDragging(null);
                return; // Early return to avoid handleDragEndSync overwriting
            } else if (isDragging?.target === 'audio') {
                // Dragging Audio Clip: 
                // Updates are handled optimistically in handleMouseMove and synced via handleDragEndSync.
                // We just ensure sync here to be safe.
                onUpdateAudioClips(localAudioClips);
            }
            setDropIndicator(null);

            handleDragEndSync();
            setIsDragging(null);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, pxPerSec, duration, onUpdateSubtitle, subtitles, videoClips, localAudioClips, renderLayers, handleDragEndSync, dropIndicator, getAdjacentAudioClips, onUpdateAudioClips, setLocalAudioClips, setVideoClips, onUpdateVideoClips, setDropIndicator, setIsDragging]); // Added renderLayers dep

    // Keyboard handling for Ripple Delete and Shortcuts


    // Scrubbing Logic with Auto-Scroll
    const scrubMouseX = useRef<number>(0);

    const handleScrubMove = useCallback((e: MouseEvent) => {
        scrubMouseX.current = e.clientX;

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
        const time = Math.max(0, Math.min(clickX / pxPerSec, duration));

        if (playheadRef.current) playheadRef.current.style.left = `${time * pxPerSec}px`;
        onSeek(time);
    }, [duration, pxPerSec, onSeek]);

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
                    const clickX = mouseX - rect.left + container.scrollLeft;
                    const time = Math.max(0, Math.min(clickX / pxPerSec, duration));

                    if (playheadRef.current) playheadRef.current.style.left = `${time * pxPerSec}px`;
                    onSeek(time);
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
    }, [isScrubbing, handleScrubMove, handleScrubEnd, duration, pxPerSec, onSeek]);

    const handleTrackMouseDown = (e: React.MouseEvent) => {
        // Prevent event bubbling if clicking a known interactive element
        if ((e.target as HTMLElement).closest('.subtitle-block')) return;
        if ((e.target as HTMLElement).closest('.video-clip')) return;
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
        // Handle Marquee Selection
        if (interactionMode === 'select-candidate') {
            if (interactionStartRef.current) {
                const dist = Math.sqrt(Math.pow(e.clientX - interactionStartRef.current.x, 2) + Math.pow(e.clientY - interactionStartRef.current.y, 2));
                if (dist > 5) {
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

                // Check Video Clips
                // Convert time to pixels: clip.startTime * pxPerSec
                // Y position: based on layer. Layer 0 is bottom. headerHeight=80, trackHeight=56.
                // Need robust way to get clip Y...
                // We can approximate or calculate same way as render.

                const newSelection = new Set<string>();
                const headerHeight = 80;
                const trackHeight = 56;

                videoClips.forEach(clip => {
                    const clipX1 = clip.startTime * pxPerSec;
                    const clipX2 = clip.endTime * pxPerSec;

                    // Calculate Y
                    // renderLayers is reversed array of [0, 1, 2...]
                    // In UI: header + (layerIndex * trackHeight) ??
                    // NO, renderLayers.map renders them from top to bottom.
                    // renderLayers[0] is at top. renderLayers[0] corresponds to maxLayer.
                    // So Y = headerHeight + (indexOf(layer) * trackHeight).

                    const visualIndex = renderLayers.indexOf(clip.layer || 0);
                    if (visualIndex === -1) return;

                    const clipY1 = headerHeight + (visualIndex * trackHeight);
                    const clipY2 = clipY1 + trackHeight; // roughly height of track row, clip is h-12 (48px) inside h-14 (56px)

                    // Check overlap
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
                const x = e.clientX - rect.left + containerRef.current.scrollLeft;
                const time = Math.max(0, Math.min(x / pxPerSec, duration));
                if (playheadRef.current) playheadRef.current.style.left = `${time * pxPerSec}px`;
                onSeek(time);
            }
        }
    }, [interactionMode, isScrubbing, isDragging, pxPerSec, duration, onSeek, renderLayers, videoClips, selectionBox, containerRef, interactionStartRef, setSelectedClipIds]);

    // Handle Mouse Up (Global)
    const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
        if (interactionMode === 'select-candidate') {
            // It was a Click!
            // 1. Move Playhead
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
                const time = Math.max(0, Math.min(clickX / pxPerSec, duration));
                onSeek(time);
            }
            // 2. Clear Selection
            setSelectedClipIds(new Set());
            setSelectedClipId(null);
            setSelectedAudioClipId(null);
        }

        if (interactionMode === 'selecting' || interactionMode === 'select-candidate') {
            setInteractionMode('none');
            setSelectionBox(null);
        }

        if (isScrubbing) {
            setIsScrubbing(false);
        }

        setIsDragging(null); // Clear item drag too
    }, [interactionMode, isScrubbing, duration, onSeek, pxPerSec, setSelectedClipIds, setSelectedClipId, setSelectedAudioClipId, containerRef, setInteractionMode, setSelectionBox, setIsScrubbing, setIsDragging]);


    // Attach Global Listeners
    useEffect(() => {
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [handleGlobalMouseMove, handleGlobalMouseUp]);


    const handleScrubStart = (e: React.MouseEvent) => {
        // Only for Ruler now?
        e.preventDefault();
        e.stopPropagation(); // Prevent track marquee

        // Force pause if playing
        if (isPlaying && onPlayPause) {
            onPlayPause();
        }

        setIsScrubbing(true);
        scrubMouseX.current = e.clientX;
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
            const time = Math.max(0, Math.min(clickX / pxPerSec, duration));
            if (playheadRef.current) playheadRef.current.style.left = `${time * pxPerSec}px`;
            onSeek(time);
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
                const clip1 = { ...clip, id: `${clip.id}-1`, endTime: time, sourceEnd: sourceSplit };
                const clip2 = { ...clip, id: `${clip.id}-2`, startTime: time, sourceStart: sourceSplit };
                const newClips = videoClips.filter(c => c.id !== clipId).concat([clip1, clip2]).sort((a, b) => a.startTime - b.startTime);
                setVideoClips(newClips);
                onUpdateVideoClips(newClips);
                // If it was selected, select the second part
                if (selectedClipId === clipId) setSelectedClipId(clip2.id);
            }
        } else if (type === 'audio') {
            const audioClip = localAudioClips.find(a => a.id === clipId);
            if (audioClip && time > audioClip.startTime && time < audioClip.endTime) {
                const ratio = (time - audioClip.startTime) / (audioClip.endTime - audioClip.startTime); // Fixed: audioClip.endTime - audioClip.startTime
                const sourceSplit = audioClip.sourceStart + (audioClip.sourceEnd - audioClip.sourceStart) * ratio;
                const audio1: AudioClip = { ...audioClip, id: `${audioClip.id}-1`, endTime: time, sourceEnd: sourceSplit };
                const audio2: AudioClip = { ...audioClip, id: `${audioClip.id}-2`, startTime: time, sourceStart: sourceSplit };
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

        if (contextMenu.type === 'clip') { // Fixed: 'video' -> 'clip'
            // Delete video clip...
            const targetId = contextMenu.id; // Fixed: clipId -> id
            onUpdateVideoClips(videoClips.filter(c => c.id !== targetId));
        } else if (contextMenu.type === 'audio') {
            const targetId = contextMenu.id; // Fixed: clipId -> id
            const updatedClips = localAudioClips.filter(c => c.id !== targetId);
            setLocalAudioClips(updatedClips);
            onUpdateAudioClips(updatedClips);
        } else if (contextMenu.type === 'subtitle') {
            // ...
        }
        setContextMenu(null);
    };
    const handleDelete = () => {
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
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onDropFile) {
            const file = e.dataTransfer.files[0];
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left + containerRef.current.scrollLeft;
                const time = Math.max(0, Math.min(x / pxPerSec, duration));
                onDropFile(file, time);
            }
        }
    };

    // Optimized Handlers for Clip Items
    const handleVideoClipMouseDown = useCallback((e: React.MouseEvent, clip: VideoClip) => {
        if (e.button === 0) {
            e.stopPropagation();
            // Left click - drag
            setSelectedClipId(clip.id);
            setSelectedAudioClipId(null);
            setIsDragging({ id: clip.id, type: 'move', target: 'clip', startX: e.clientX, originalStart: clip.startTime, originalEnd: clip.endTime });
        } else if (e.button === 2) {
            e.stopPropagation();
        }
    }, [setSelectedClipId, setSelectedAudioClipId, setIsDragging]); // Removed videoClips from dep array as it's not needed for drag start

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

    const handleAudioClipMouseDown = useCallback((e: React.MouseEvent, clip: AudioClip) => {
        if (e.button === 0) {
            e.stopPropagation();
            setSelectedAudioClipId(clip.id);
            setSelectedClipId(null);
            setIsDragging({ id: clip.id, type: 'move', target: 'audio', startX: e.clientX, originalStart: clip.startTime, originalEnd: clip.endTime });
        }
    }, [setSelectedAudioClipId, setSelectedClipId, setIsDragging]);

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
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedClipId, selectedAudioClipId, selectedSubtitleId, videoClips, localAudioClips, onUpdateVideoClips, onUpdateAudioClips, onDeleteSubtitle, handleSplit, handleRippleTrimLeft, handleRippleTrimRight, setLocalAudioClips, setSelectedClipId, setSelectedAudioClipId, setSelectedSubtitleId]); // Fixed dep

    return (
        <div className="w-full bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700 flex flex-col select-none">
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

            <div className="flex flex-1">
                {/* Labels Sidebar */}
                <div className="sidebar-tools w-10 flex-shrink-0 bg-gray-50 dark:bg-zinc-800 border-r border-gray-200 dark:border-zinc-700 flex flex-col">
                    <div className="h-6 border-b border-gray-200 dark:border-zinc-700" />
                    <div className="h-14 flex items-center justify-center border-b border-gray-200 dark:border-zinc-700">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">CC</span>
                    </div>
                    {/* Dynamic Track Labels */}
                    {renderLayers.map(layer => (
                        <div key={layer} className="h-14 flex items-center justify-center border-b border-gray-200 dark:border-zinc-700 relative group">
                            <span className="text-[10px] text-gray-400 font-bold">V{layer + 1}</span>
                        </div>
                    ))}
                    {/* Audio Track Label */}
                    <div className="h-9 flex items-center justify-center border-b border-gray-200 dark:border-zinc-700">
                        <span className="text-[10px] text-sky-400 font-bold">A1</span>
                    </div>
                </div>

                {/* Timeline Tracks */}
                <div
                    ref={containerRef}
                    className="flex-1 overflow-x-auto overflow-y-hidden relative bg-gray-100 dark:bg-zinc-950 cursor-text"
                    onMouseDown={handleTrackMouseDown} // Changed to new handler
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{ scrollBehavior: 'smooth' }}
                >
                    {/* Ruler (Strict Scrubbing) */}
                    <div
                        className="h-6 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 relative cursor-ew-resize sticky top-0 z-20"
                        style={{ width: totalWidth }}
                        onMouseDown={handleScrubStart}
                    >
                        {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                            <div key={i} className="absolute top-0 h-full flex flex-col items-start" style={{ left: i * pxPerSec }}>
                                <div className={`w-px ${i % 5 === 0 ? 'h-3 bg-gray-400' : 'h-2 bg-gray-300'}`} />
                                {i % 5 === 0 && <span className="text-[10px] text-gray-500 ml-0.5">{formatTime(i)}</span>}
                            </div>
                        ))}
                    </div>

                    {/* Subtitles */}
                    <div className="relative h-14 border-b border-gray-200 dark:border-zinc-800" style={{ width: totalWidth }}>
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

                    {/* Dynamic Video Layers */}
                    {renderLayers.map(layerIndex => (
                        <div key={layerIndex} className="relative h-14 border-b border-gray-200 dark:border-zinc-800" style={{ width: totalWidth }}>
                            <div className={`absolute inset-0 ${layerIndex === 0 ? 'bg-zinc-200 dark:bg-zinc-900' : 'bg-zinc-100 dark:bg-zinc-950/50'}`} />

                            {/* Hint for new track */}
                            {videoClips.filter(c => (c.layer || 0) === layerIndex).length === 0 && layerIndex > 0 && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                                    <span className="text-xs text-black dark:text-white">Track V{layerIndex + 1}</span>
                                </div>
                            )}
                            {(() => {
                                // Prepare clips for this layer (Excluding dragged clip for Magnetic layout)
                                const layerClips = videoClips
                                    .filter(c => (c.layer || 0) === layerIndex && c.id !== isDragging?.id)
                                    .sort((a, b) => a.startTime - b.startTime);

                                // Check if we should render a gap in this layer
                                const showGap = dropIndicator && dropIndicator.layer === layerIndex && dropIndicator.gapIndex !== undefined && dropIndicator.gapSize !== undefined;

                                return layerClips.map((clip, index) => {
                                    // Calculate Shift
                                    // If we are showing a gap, and this clip's index is >= gapIndex, shift it Right.
                                    // NOTE: This assumes gapIndex is based on the *filtered* list indices.
                                    const isShifted = showGap && index >= (dropIndicator.gapIndex!);
                                    const shiftAmount = isShifted ? (dropIndicator.gapSize! * pxPerSec) : 0;

                                    return (
                                        <React.Fragment key={clip.id}>
                                            {/* Render GHOST SLOT if this is the gap index */}
                                            {showGap && index === dropIndicator.gapIndex && (
                                                <div
                                                    className="absolute h-12 top-1 border-2 border-dashed border-indigo-400/50 bg-indigo-500/10 rounded-lg transition-all duration-200"
                                                    style={{
                                                        // Visual Gap Position
                                                        // Use the clip's original start time as the anchor.
                                                        left: (clip.startTime * pxPerSec),
                                                        width: dropIndicator.gapSize! * pxPerSec,
                                                        zIndex: 0
                                                    }}
                                                />
                                            )}

                                            {/* The Clip Itself (Wrapped for Shift) */}
                                            <div
                                                className="absolute inset-0 transition-transform duration-200 ease-out pointer-events-none" // Wrapper to apply transform
                                                style={{
                                                    transform: `translateX(${shiftAmount}px)`,
                                                    // Ensure the wrapper doesn't capture events, but children (clip) do. 
                                                    // But VideoClipItem is absolute positioned?
                                                    // If I wrap it in `absolute inset-0`, the child `left` works inside.
                                                    // But `pointer-events-none` on wrapper might block children if not `auto`.
                                                }}
                                            >
                                                <div className="pointer-events-auto">
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
                                                        isDragging={isDragging?.id === clip.id}
                                                    />
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                }).concat(
                                    // Handle Gap at the END of the list
                                    (showGap && dropIndicator.gapIndex === layerClips.length) ? [(
                                        <div
                                            key="ghost-end"
                                            className="absolute h-12 top-1 border-2 border-dashed border-indigo-400/50 bg-indigo-500/10 rounded-lg transition-all duration-200"
                                            style={{
                                                left: (layerClips.length > 0 ? layerClips[layerClips.length - 1].endTime : 0) * pxPerSec,
                                                width: dropIndicator.gapSize! * pxPerSec,
                                                zIndex: 0
                                            }}
                                        />
                                    )] : []
                                );
                            })()}
                        </div>
                    ))}

                    {/* A1 Audio Track (Premiere Pro style - mono upward) */}
                    <div className="relative h-9 border-b border-gray-200 dark:border-zinc-800" style={{ width: totalWidth }}>
                        {/* Background for entire track */}
                        <div className="absolute inset-0 bg-zinc-900/50" />

                        {/* Linked audio clips (from video clips with audio) */}
                        {videoClips.filter(c => (c.layer || 0) === 0 && c.hasAudio !== false).map(clip => {
                            const clipWidth = (clip.endTime - clip.startTime) * pxPerSec;
                            return (
                                <div
                                    key={`audio-${clip.id}`}
                                    className="absolute top-0 bottom-0 bg-slate-800 rounded overflow-hidden cursor-pointer hover:ring-1 hover:ring-sky-500/50"
                                    style={{ left: clip.startTime * pxPerSec, width: Math.max(clipWidth, 20) }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Cut Mode Logic
                                        if (isCutMode) {
                                            if (containerRef.current) {
                                                const rect = containerRef.current.getBoundingClientRect();
                                                const x = e.clientX - rect.left + containerRef.current.scrollLeft;
                                                const time = Math.max(0, Math.min(x / pxPerSec, duration));
                                                // Splitting the linked audio means splitting the VIDEO clip
                                                splitClip(clip.id, 'video', time);
                                            }
                                            return;
                                        }

                                        // Select parent video clip
                                        setSelectedClipId(clip.id);
                                        setSelectedAudioClipId(null);
                                    }}
                                >
                                    {isGeneratingWaveform && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-[10px] text-sky-400 animate-pulse">Analyzing...</span>
                                        </div>
                                    )}
                                    {audioWaveformL.length === 0 && !isGeneratingWaveform && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-[10px] text-slate-500">🔊</span>
                                        </div>
                                    )}
                                    <canvas
                                        className="absolute inset-0"
                                        ref={(canvas) => {
                                            if (!canvas || audioWaveformL.length === 0) return;
                                            const ctx = canvas.getContext('2d');
                                            if (!ctx) return;

                                            const width = Math.max(clipWidth, 20);
                                            const height = 36;
                                            canvas.width = width;
                                            canvas.height = height;

                                            ctx.fillStyle = '#1e293b';
                                            ctx.fillRect(0, 0, width, height);

                                            const clipDuration = clip.sourceEnd - clip.sourceStart;
                                            const totalSamples = audioWaveformL.length;

                                            ctx.fillStyle = '#38bdf8';
                                            for (let x = 0; x < width; x++) {
                                                const clipTimeOffset = (x / width) * clipDuration;
                                                const sourceTime = clip.sourceStart + clipTimeOffset;
                                                const sampleIndex = Math.floor((sourceTime / duration) * totalSamples);
                                                const amplitude = audioWaveformL[Math.min(sampleIndex, totalSamples - 1)] || 0;
                                                const barHeight = amplitude * (height - 4);
                                                ctx.fillRect(x, height - 2 - barHeight, 1, barHeight);
                                            }
                                        }}
                                    />
                                </div>
                            );
                        })}

                        {/* Unlinked audio clips (separated from video) */}
                        {localAudioClips.map(audioClip => (
                            <UnlinkedAudioClipItem
                                key={audioClip.id}
                                clip={audioClip}
                                pxPerSec={pxPerSec}
                                containerDuration={duration}
                                isSelected={selectedAudioClipId === audioClip.id}
                                isCutMode={isCutMode}
                                audioWaveformL={audioWaveformL}
                                containerRef={containerRef}
                                splitClip={splitClip}
                                onMouseDown={handleAudioClipMouseDown}
                                onContextMenu={handleAudioClipContextMenu}
                                onDragHandle={handleAudioClipDragHandle}
                            />
                        ))}
                    </div>

                    <div ref={playheadRef} className="absolute top-0 bottom-0 z-50 group cursor-ew-resize" onMouseDown={handleScrubStart}>
                        {/* Hit area */}
                        <div className="absolute inset-y-0 -left-2 -right-2 bg-transparent" />

                        {/* Playhead Triangle */}
                        <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-gray-800 dark:border-t-white group-hover:bg-indigo-500 transition-colors" />

                        {/* Playhead Line */}
                        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-gray-800 dark:bg-white shadow-lg group-hover:bg-indigo-500 transition-colors" />
                    </div>

                    {/* Selection Box Overlay */}
                    {selectionBox && (
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

                    {/* DROP INDICATOR LINE (Clean Professional Style) */}
                    {dropIndicator && (
                        <div
                            className="absolute z-[90] w-0.5 bg-red-500 pointer-events-none shadow-[0_0_4px_rgba(239,68,68,0.8)]"
                            style={{
                                left: dropIndicator.time * pxPerSec,
                                top: 80 + 24 + ((dropIndicator.layer) * 56),
                                height: 56,
                            }}
                        >
                            {/* Simple triangle head at top */}
                            <div className="absolute -top-1 -left-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-red-500" />
                        </div>
                    )}

                    {/* GLOBAL DRAG PROXY (Follows Mouse) */}
                    {isDragging?.type === 'move' && isDragging.target === 'clip' && isDragging.mouseX !== undefined && isDragging.mouseY !== undefined && (() => {
                        const clip = videoClips.find(c => c.id === isDragging.id);
                        if (!clip || !containerRef.current) return null;

                        const rect = containerRef.current.getBoundingClientRect();
                        // Calculate visual left based on time to keep sync with cursor's time position
                        // Or simpler: relative to mouse START.
                        // We have deltaX.
                        // Let's use Time based calculation for X to match the "Ghost" logic.
                        const rawTime = isDragging.originalStart + (isDragging.currentX || 0);
                        const visualLeft = rect.left + (rawTime * pxPerSec) - containerRef.current.scrollLeft;

                        return (
                            <div
                                className="fixed z-[100] rounded-lg overflow-hidden border border-indigo-500/50 shadow-2xl pointer-events-none bg-slate-800/80 backdrop-blur-sm flex items-center justify-center"
                                style={{
                                    left: visualLeft,
                                    top: isDragging.mouseY - 28, // Center vertically on mouse
                                    width: Math.max((clip.endTime - clip.startTime) * pxPerSec, 20),
                                    height: 56,
                                }}
                            >
                                <span className="text-white text-xs font-medium truncate px-2 opacity-80">
                                    {selectedClipId === clip.id ? videoFileName : `Clip ${clip.id.slice(0, 4)}`}
                                </span>
                                {frameThumbnails.length > 0 && (
                                    <img src={frameThumbnails[0]} className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" />
                                )}
                            </div>
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
                                <button
                                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-zinc-700 flex items-center gap-2"
                                    onClick={() => handleUnlinkAudio(contextMenu.id)}
                                >
                                    🔊 오디오 분리
                                </button>
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
                                    onClick={() => handleRelinkAudio(contextMenu.id)}
                                >
                                    🔗 비디오에 연결
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
        </div >
    );
}

