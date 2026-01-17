'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Play, Pause, RotateCcw, Download, Upload, Type, Wand2, X, Plus, GripVertical, Search, Music, Video as VideoIcon, Layers, Monitor, Youtube, Hash, Palette, Lock, Unlock, Eye, EyeOff, Film, Scissors, RefreshCw, FileText, Settings, ChevronDown, ChevronUp, Link, Unlink } from 'lucide-react';
import TimelineEditor from '@/components/TimelineEditor';
import QDriveSidebar from '@/components/QDriveSidebar';
import SubtitleRow from './SubtitleRow';
import { extractAudioFromVideo } from '@/lib/audio-utils';

import VideoPreviewTooltip from '@/components/VideoPreviewTooltip';
import WordEditMenu from '@/components/WordEditMenu';
import AppleConfirmModal from '@/components/AppleConfirmModal';
import { useTimelineEngine } from '@/hooks/useTimelineEngine';

interface Subtitle {
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    translatedText?: string; // For bilingual display
    animation?: string;
    animationDuration?: number;
    fontSize?: string;
    fontFamily?: string;
    color?: string;
    words?: {
        text: string;
        startTime: number;
        endTime: number;
        animation?: string;
        animationDuration?: number;
    }[];
}

// Helper to split text into words with distributed duration
const splitTextToWords = (text: string, startTime: number, endTime: number) => {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return [];

    const duration = endTime - startTime;
    const durationPerWord = duration / words.length;

    return words.map((word, i) => ({
        text: word,
        startTime: startTime + (i * durationPerWord),
        endTime: startTime + ((i + 1) * durationPerWord)
    }));
};

export default function SubtitleMakerPage() {
    // Media State
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [scriptText, setScriptText] = useState('');

    // Subtitle State
    const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
    const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
    const [hoveredSubtitle, setHoveredSubtitle] = useState<{ id: string, startTime: number, endTime: number, x: number, y: number } | null>(null);



    const [duration, setDuration] = useState(0);

    // Word Menu State
    const [activeWordMenu, setActiveWordMenu] = useState<{
        subtitleId: string;
        wordIndex: number;
        word: string;
        startTime: number;
        endTime: number;
        x: number;
        y: number;
    } | null>(null);
    const [detailEditState, setDetailEditState] = useState<{ subtitleId: string, wordIndex: number } | null>(null);
    const hiddenFileInputRef = useRef<HTMLInputElement>(null);
    const qDriveDrawerRef = useRef<HTMLDivElement>(null);

    // Initial load ref
    const isInitialLoad = useRef(true);
    const videoRef = useRef<HTMLVideoElement>(null); // Keeps reference to Layer 0 for compatibility
    const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});
    const isExtractingFramesRef = useRef(false);
    const latestSeekTimeRef = useRef<number | null>(null); // For smart seek throttling

    // Tools State
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [isInputPanelOpen, setIsInputPanelOpen] = useState(false);
    const [isToolbarSticky, setIsToolbarSticky] = useState(true);
    const [isQDriveOpen, setIsQDriveOpen] = useState(false); // Drawer state

    // Cut Editor State
    const [isCutMode, setIsCutMode] = useState(false);
    const [excludedSubtitleIds, setExcludedSubtitleIds] = useState<Set<string>>(new Set());

    // Video Clips State (for non-destructive editing)
    interface VideoClip {
        id: string;
        startTime: number;
        endTime: number;
        sourceStart: number;
        sourceEnd: number;
        sourceDuration?: number; // Original full video duration (for trim limits)
        layer?: number; // 0 = Main, 1+ = Overlay
        assetId?: string; // ID of the video asset
        trackId?: number;
        src?: string;
        type?: string;
        name?: string;
        startOffset?: number;
        frames?: string[]; // Per-clip frame thumbnails
        previewPosition?: { x: number; y: number }; // Position in preview (percentage)
        scale?: number; // Scale factor (default 1)
        ratio?: number; // Aspect ratio (width / height)
        isMuted?: boolean; // Track-level mute
        isLocked?: boolean; // Track-level lock (prevent editing/moving)
        isHidden?: boolean; // Track-level visibility (hide from preview)
        // Audio-Video Linking
        hasAudio?: boolean;       // Does this clip have audio?
        audioClipId?: string;     // Linked audio clip ID
        isAudioLinked?: boolean;  // true = linked (move together), false = unlinked
    }
    const [videoClips, setVideoClips] = useState<VideoClip[]>([]);

    // Interaction State
    const [draggingOverlayId, setDraggingOverlayId] = useState<string | null>(null);
    const [resizingOverlayId, setResizingOverlayId] = useState<string | null>(null);
    const resizeStartData = useRef<{
        startScale: number;
        startDist: number;
        startX: number;
        startY: number;
        startPos: { x: number; y: number };
    } | null>(null);

    // Audio Clips State (for separated audio editing)
    interface AudioClip {
        id: string;
        videoClipId: string; // Original video clip this came from
        startTime: number;
        endTime: number;
        sourceStart: number;
        sourceEnd: number;
        // Enhanced fields for multi-track audio
        layer?: number;           // Audio track layer (A1=0, A2=1, etc.)
        src?: string;            // Audio source URL (same as video src)
        name?: string;           // Filename for display
        isMuted?: boolean;       // Mute state
    }
    const [audioClips, setAudioClips] = useState<AudioClip[]>([]);

    const [assets, setAssets] = useState<{ [key: string]: string }>({}); // assetId -> blobUrl
    const hasInitializedClips = useRef(false);
    const ignoreResetRef = useRef(false); // Guard against videoUrl reset effect

    // Audio Separation State
    const [isAudioSeparated, setIsAudioSeparated] = useState(false);

    // Timeline Height Resize State
    const [timelineHeight, setTimelineHeight] = useState(200); // Default timeline height in pixels
    const [isResizingTimeline, setIsResizingTimeline] = useState(false);
    const resizeStartY = useRef(0);
    const resizeStartHeight = useRef(200);

    // Subtitle Table Toggle State (for manual subtitle entry)
    const [isSubtitleTableOpen, setIsSubtitleTableOpen] = useState(false);

    // Undo/Redo History State
    const [history, setHistory] = useState<{ subtitles: Subtitle[], videoClips: VideoClip[], audioClips?: AudioClip[] }[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isUndoing = useRef(false);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Engine Helpers
    const lastVideoClipIdRef = useRef<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Canvas & Video Refs for Compositing
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const hiddenVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
    const [mainVideoElement, setMainVideoElement] = useState<HTMLVideoElement | null>(null);

    // Video logic
    const mainVideoRef = useRef<HTMLVideoElement>(null);
    // const [videoElementReady, setVideoElementReady] = useState<HTMLVideoElement | null>(null); // Replaced by mainVideoElement

    // Waveform needs the mainVideoElement state to analyze audio.
    // Ensure we update the state when the ref is attached.
    const preparedClipIdRef = useRef<string | null>(null);


    const [playbackTime, setPlaybackTime] = useState(0);

    // =============================
    // PLAYBACK ENGINE
    // =============================
    const {
        isPlaying,
        currentTime,
        play,
        pause,
        togglePlay,
        seek,
        startScrub,
        endScrub,
        previewFrame
    } = useTimelineEngine({
        videoRef: mainVideoRef, // Connect to main video element
        videoClips,
        duration,
        shouldMuteVideo: false, // DEPRECATED: Engine now handles per-clip muting via clip.hasAudio (was: audioClips.length > 0 || videoClips.some(c => c.hasAudio && c.isAudioLinked === false)),
        onTimeUpdate: (time) => {
            setPlaybackTime(time);
        }
    });

    const setCurrentTime = (timeOrFn: number | ((prev: number) => number)) => {
        if (typeof timeOrFn === 'function') {
            seek(timeOrFn(currentTime));
        } else {
            seek(timeOrFn);
        }
    };

    const setIsPlaying = (stateOrFn: boolean | ((prev: boolean) => boolean)) => {
        const newState = typeof stateOrFn === 'function' ? stateOrFn(isPlaying) : stateOrFn;
        if (newState) play();
        else pause();
    };

    // =============================
    // STATE PERSISTENCE (localStorage)
    // =============================
    const STORAGE_KEY = 'tubiq-subtitle-maker-state';

    // LOAD state from localStorage on mount
    useEffect(() => {
        try {
            // 1. Check for Auto Edit Project (One-time handoff)
            const autoEditData = localStorage.getItem('tubiq-edit-project');
            if (autoEditData) {
                console.log('[SubtitleMaker] Found Auto Edit Project data');
                const parsed = JSON.parse(autoEditData);
                console.log('[SubtitleMaker] Parsed clips:', parsed.videoClips?.length, 'clips');
                console.log('[SubtitleMaker] First clip:', JSON.stringify(parsed.videoClips?.[0], null, 2));
                console.log('[SubtitleMaker] All clips src:', parsed.videoClips?.map((c: any) => c.src?.substring(0, 50)));

                if (parsed.videoClips && Array.isArray(parsed.videoClips)) {
                    // Set flag to prevent useEffect from wiping our clips when videoUrl changes
                    ignoreResetRef.current = true;

                    setVideoClips(parsed.videoClips);
                    // Set videoUrl to the first clip's source to initialize the player
                    if (parsed.videoClips.length > 0) {
                        setVideoUrl(parsed.videoClips[0].src);
                    }
                }
                if (parsed.subtitles && Array.isArray(parsed.subtitles)) {
                    setSubtitles(parsed.subtitles);
                }

                // IMPORTANT: Prevent default initialization from overwriting our clips
                hasInitializedClips.current = true;

                // Set initial duration from clips if available
                if (parsed.videoClips && parsed.videoClips.length > 0) {
                    const maxTime = Math.max(...parsed.videoClips.map((c: any) => c.endTime || 0));
                    console.log('[SubtitleMaker] Setting duration from clips:', maxTime);
                    if (maxTime > 0) setDuration(maxTime);
                }

                // CONSUME the data so it doesn't overwrite manual edits on reload
                localStorage.removeItem('tubiq-edit-project');
                return;
            }

            // 2. Normal State Restore
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.subtitles) setSubtitles(parsed.subtitles);
                if (parsed.videoClips) setVideoClips(parsed.videoClips);
                if (parsed.scriptText) setScriptText(parsed.scriptText);

                // Only restore remote URLs (Supabase), discard stale blob URLs
                if (parsed.videoUrl && !parsed.videoUrl.startsWith('blob:')) {
                    setVideoUrl(parsed.videoUrl);
                } else {
                    // If video was local (blob), we can't restore it.
                    // By leaving videoUrl null, the UI will show the Upload button.
                    // User just needs to re-select the file, and since we restored clips/subtitles, 
                    // the session will be resumed perfectly.
                    console.log('[SubtitleMaker] Skipped stale blob URL, waiting for re-upload');
                }

                console.log('[SubtitleMaker] Restored state from localStorage');
            }
        } catch (e) {
            console.error('[SubtitleMaker] Failed to restore state:', e);
        }
    }, []);

    // SAVE state to localStorage on change (DEBOUNCED to prevent playback stuttering)
    useEffect(() => {
        // Skip initial empty save
        if (!videoUrl && subtitles.length === 0 && videoClips.length === 0) return;

        // Debounce: wait 1 second after last change before saving
        const timeoutId = setTimeout(() => {
            try {
                const stateToSave = {
                    subtitles,
                    videoClips,
                    scriptText,
                    videoUrl, // blob URLs won't persist, but data URLs might work
                    savedAt: new Date().toISOString(),
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
            } catch (e) {
                console.error('[SubtitleMaker] Failed to save state:', e);
            }
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [subtitles, videoClips, scriptText, videoUrl]);

    // Initial History Push
    useEffect(() => {
        if (history.length === 0 && subtitles.length === 0 && videoClips.length > 0) {
            setHistory([{ subtitles: [], videoClips, audioClips: [] }]);
            setHistoryIndex(0);
        }
    }, [videoClips, history.length, subtitles.length, audioClips.length]);

    const addToHistory = (newSubtitles: Subtitle[], newClips: VideoClip[]) => {
        if (isUndoing.current) return;

        const current = history[historyIndex];
        // Simple distinct check to avoid duplicate states
        if (current &&
            JSON.stringify(current.subtitles) === JSON.stringify(newSubtitles) &&
            JSON.stringify(current.videoClips) === JSON.stringify(newClips)) {
            return;
        }

        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ subtitles: newSubtitles, videoClips: newClips });

        // Limit history size (e.g., 50 steps)
        if (newHistory.length > 50) newHistory.shift();

        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    // Unified Undo/Redo Logic
    const handleUndo = () => {
        if (historyIndex > 0) {
            isUndoing.current = true;
            const prevIndex = historyIndex - 1;
            setHistoryIndex(prevIndex);

            const prevState = history[prevIndex];
            setSubtitles(prevState.subtitles);
            setVideoClips(prevState.videoClips);
            if (prevState.audioClips) setAudioClips(prevState.audioClips);
            // Restore scriptText? Probably better to keep scriptText separate if it's large text input.
            // But if we want full undo we should add it. For now sticking to core timeline elements.

            setTimeout(() => { isUndoing.current = false; }, 100);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            isUndoing.current = true;
            const nextIndex = historyIndex + 1;
            setHistoryIndex(nextIndex);

            const nextState = history[nextIndex];
            setSubtitles(nextState.subtitles);
            setVideoClips(nextState.videoClips);
            if (nextState.audioClips) setAudioClips(nextState.audioClips);

            setTimeout(() => { isUndoing.current = false; }, 100);
        }
    };

    // Word Menu Handlers
    const handleWordAnimationChange = (animId: string) => {
        if (!activeWordMenu) return;

        // In a real scenario, we might want per-word animation.
        // For now, let's update the SUBTITLE's animation, or needs a schema update for word-level.
        // Assuming user wants to animate the SUBTITLE based on this word trigger OR specific word (requires schema change).
        // Since schema has `words` array, we can update that if it has animation props, or fallback to subtitle.
        // Let's assume updating the subtitle's main animation for simplicity unless user complained,
        // BUT user said "choose animation for THAT WORD".
        // Ok, I will try to add `animation` to the word object in the subtitle state.

        setSubtitles(prev => prev.map(sub => {
            if (sub.id === activeWordMenu.subtitleId) {
                // Ensure words array exists
                let newWords = sub.words ? [...sub.words] : [];
                if (newWords.length === 0) {
                    // If words are missing, generate them (simple split based on time)
                    // Re-using logic similar to splitTextToWords but we need it here.
                    // For now, assuming words align linearly.
                    const words = sub.text.split(' ');
                    const duration = sub.endTime - sub.startTime;
                    const wordDuration = duration / words.length;
                    newWords = words.map((w, i) => ({
                        text: w,
                        startTime: sub.startTime + (i * wordDuration),
                        endTime: sub.startTime + ((i + 1) * wordDuration)
                    }));
                }

                // Update specific word
                if (newWords[activeWordMenu.wordIndex]) {
                    newWords[activeWordMenu.wordIndex] = {
                        ...newWords[activeWordMenu.wordIndex],
                        animation: animId
                    };
                }

                return { ...sub, words: newWords };
            }
            return sub;
        }));
    };

    const handleWordDurationChange = (dur: number) => {
        if (!activeWordMenu) return;

        setSubtitles(prev => prev.map(sub => {
            if (sub.id === activeWordMenu.subtitleId) {
                // Ensure words array exists
                let newWords = sub.words ? [...sub.words] : [];
                if (newWords.length === 0) {
                    const words = sub.text.split(' ');
                    const duration = sub.endTime - sub.startTime;
                    const wordDuration = duration / words.length;
                    newWords = words.map((w, i) => ({
                        text: w,
                        startTime: sub.startTime + (i * wordDuration),
                        endTime: sub.startTime + ((i + 1) * wordDuration)
                    }));
                }

                // Update specific word
                if (newWords[activeWordMenu.wordIndex]) {
                    newWords[activeWordMenu.wordIndex] = {
                        ...newWords[activeWordMenu.wordIndex],
                        animationDuration: dur
                    };
                }

                return { ...sub, words: newWords };
            }
            return sub;
        }));
    };

    const handleReplaceVideoForWord = () => {
        hiddenFileInputRef.current?.click();
    };

    // Detail Edit Handler
    const handleDetailEdit = () => {
        console.log("handleDetailEdit called", activeWordMenu);
        if (!activeWordMenu) return;
        setDetailEditState({
            subtitleId: activeWordMenu.subtitleId,
            wordIndex: activeWordMenu.wordIndex
        });
        setActiveWordMenu(null); // Close floating menu
    };

    const handleWordSyncUpdate = (subtitleId: string, wordIndex: number, newStart: number, newEnd: number) => {
        setSubtitles(prev => prev.map(s => {
            if (s.id === subtitleId && s.words && s.words[wordIndex]) {
                const newWords = [...s.words];
                newWords[wordIndex] = { ...newWords[wordIndex], startTime: newStart, endTime: newEnd };

                // Auto-expand parent subtitle boundaries if word exceeds them
                let newSubtitleStart = s.startTime;
                let newSubtitleEnd = s.endTime;

                if (newStart < newSubtitleStart) newSubtitleStart = newStart;
                if (newEnd > newSubtitleEnd) newSubtitleEnd = newEnd;

                // Also if it's the first/last word, force sync (optional, but good for consistency)
                if (wordIndex === 0) newSubtitleStart = Math.min(newSubtitleStart, newStart);
                if (wordIndex === newWords.length - 1) newSubtitleEnd = Math.max(newSubtitleEnd, newEnd);

                return { ...s, words: newWords, startTime: newSubtitleStart, endTime: newSubtitleEnd };
            }
            return s;
        }));
    };

    const handleFileSelectForReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeWordMenu) return;

        const newUrl = URL.createObjectURL(file);

        // Find clip at activeWordMenu.startTime and replace it
        setVideoClips(prev => {
            // Logic: Find clip containing the word start time
            const targetTime = activeWordMenu.startTime;
            const clipIdx = prev.findIndex(c => targetTime >= c.startTime && targetTime < c.endTime);

            if (clipIdx === -1) {
                // No clip found? Create one for this word duration?
                // Or just add new layer.
                // Let's Replace the 'main' clip if it exists, or just add new one on top.
                // Simplest 'Replace':
                // 1. Remove old clip having this time.
                // 2. Insert new clip with same start/end (or file duration?)
                // User said "Delete clip for this word and replace".
                // Be careful not to delete a 1-hour clip for a 1-second word.
                // Maybe split?
                // Safe bet: Just ADD the new clip on top (Layer 1) at this timestamp for the word duration.
                // If there's an existing clip on Layer 0, it gets covered.
                // Wait, "Delete clip... and replace".
                // Ok, I will SPLIT the underlying clip at word start/end, delete the gap, and put new clip.
                // Implementing 'Patch' Logic:

                // For now, simpler: Just Replace the file of the clip that corresponds to this subtitle row?
                // Usually 1 Subtitle Row ~ 1 Video Clip in these tools.
                // If so, replace the whole clip's source.
                // I'll try that first: Find clip overlapping significantly with subtitle and replace its Source.
                // If multiple clips, replace the one at the exact start time.

                const newClip: VideoClip = {
                    id: crypto.randomUUID(),
                    trackId: 1, // Layer 1 to overlay
                    startTime: activeWordMenu.startTime,
                    endTime: activeWordMenu.endTime,
                    src: newUrl,
                    type: 'video',
                    name: file.name,
                    startOffset: 0,
                    sourceStart: 0,
                    sourceEnd: activeWordMenu.endTime - activeWordMenu.startTime // Approximate duration
                };
                return [...prev, newClip];
            }

            // If clip found
            const oldClip = prev[clipIdx];
            // Simple approach: Replace the source of THIS clip?
            // No, that changes the whole clip.
            // Subtitle-based Editing philosophy:
            // The subtitle defines the "Clip" of interest.
            // So we should essentially treat the video "under" this word as the target.
            // Let's SPLIT the old clip around the word, remove center, insert new.

            // 1. Split at Start
            // 2. Split at End
            // 3. Remove Middle
            // 4. Insert New

            // This is hard to get right blindly.
            // Backtrack: "Replace Video Clip" -> Just change the `src` of the clip that corresponds to this subtitle row?
            // Usually 1 Subtitle Row ~ 1 Video Clip in these tools.
            // If so, replace the whole clip's source.
            // I'll try that first: Find clip overlapping significantly with subtitle and replace its Source.
            // If multiple clips, replace the one at the exact start time.

            const newClip = { ...oldClip, src: newUrl, name: file.name, startOffset: 0 };
            // Reset offset since new file might be shorter/different.
            // Keep timeline duration same?
            // If new file is shorter than duration, loop or black?
            // Let's just update the src.
            const newClips = [...prev];
            newClips[clipIdx] = newClip;
            return newClips;
        });

        setActiveWordMenu(null); // Close menu
    };

    // Keyboard Shortcuts for Undo/Redo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    handleRedo();
                } else {
                    handleUndo();
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                handleRedo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [history, historyIndex]);

    // Keyboard Shortcut for Spacebar Play/Pause
    useEffect(() => {
        const handleSpacebar = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                // Ignore if typing in input/textarea or if contenteditable
                const activeEl = document.activeElement;
                const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.getAttribute('contenteditable') === 'true';

                if (!isInput) {
                    e.preventDefault();
                    togglePlay();
                }
            }
        };

        window.addEventListener('keydown', handleSpacebar);
        return () => window.removeEventListener('keydown', handleSpacebar);
    }, [isPlaying]); // togglePlay dependency implied or we can include it if it's stable

    // Enhanced State Updaters with History
    const updateSubtitlesWithHistory = (newSubtitles: Subtitle[] | ((prev: Subtitle[]) => Subtitle[])) => {
        setSubtitles(prev => {
            const resolved = typeof newSubtitles === 'function' ? newSubtitles(prev) : newSubtitles;
            addToHistory(resolved, videoClips);
            return resolved;
        });
    };

    const updateVideoClipsWithHistory = (newClips: VideoClip[] | ((prev: VideoClip[]) => VideoClip[])) => {
        setVideoClips(prev => {
            const resolved = typeof newClips === 'function' ? newClips(prev) : newClips;
            addToHistory(subtitles, resolved);
            return resolved;
        });
    };

    const updateAudioClipsWithHistory = (newAudioClips: AudioClip[] | ((prev: AudioClip[]) => AudioClip[])) => {
        setAudioClips(prev => {
            const resolved = typeof newAudioClips === 'function' ? newAudioClips(prev) : newAudioClips;
            // Need to update addToHistory to accept audioClips
            // For now, manually add to history
            if (isUndoing.current) return resolved;

            const current = history[historyIndex];
            // Simple distinct check to avoid duplicate states
            if (current &&
                JSON.stringify(current.subtitles) === JSON.stringify(subtitles) &&
                JSON.stringify(current.videoClips) === JSON.stringify(videoClips) &&
                JSON.stringify(current.audioClips) === JSON.stringify(resolved)) {
                return resolved;
            }

            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push({ subtitles, videoClips, audioClips: resolved });

            // Limit history size (e.g., 50 steps)
            if (newHistory.length > 50) newHistory.shift();

            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);

            return resolved;
        });
    };

    // Separate all video clips' audio into independent AudioClips
    const separateAllAudio = () => {
        const newAudioClips: AudioClip[] = [];

        videoClips.forEach(clip => {
            if (clip.hasAudio && clip.isAudioLinked) {
                // Create independent AudioClip for this video
                const audioClip: AudioClip = {
                    id: `audio-${clip.id}`,
                    videoClipId: clip.id,
                    startTime: clip.startTime,
                    endTime: clip.endTime,
                    sourceStart: clip.sourceStart,
                    sourceEnd: clip.sourceEnd,
                    layer: clip.layer || 0,  // Same layer as video (A1 matches V1, etc.)
                    src: clip.src,
                    name: clip.name, // Use video's filename for audio display
                    isMuted: false,
                };
                newAudioClips.push(audioClip);
            }
        });

        // Update video clips to mark audio as unlinked
        updateVideoClipsWithHistory(prev =>
            prev.map(clip =>
                clip.hasAudio && clip.isAudioLinked
                    ? { ...clip, isAudioLinked: false, audioClipId: `audio-${clip.id}` }
                    : clip
            )
        );

        // Replace audio clips (clear old ones to avoid playing audio from previous videos)
        updateAudioClipsWithHistory(newAudioClips);
        setIsAudioSeparated(true);

        console.log(`Separated audio from ${newAudioClips.length} clips`);
    };

    // Re-link all audio back to video clips
    const relinkAllAudio = () => {
        // Remove audio clips
        updateAudioClipsWithHistory([]);

        // Mark all video clips as having audio again (restore hasAudio and isAudioLinked)
        updateVideoClipsWithHistory(prev =>
            prev.map(clip => ({
                ...clip,
                hasAudio: true, // Restore audio to video clip
                isAudioLinked: true,
                audioClipId: undefined
            }))
        );

        setIsAudioSeparated(false);
        console.log('Audio re-linked to video clips');
    };

    // Reset when videoUrl changes
    useEffect(() => {
        // If we are restoring clips (ignoreResetRef is true), don't wipe them!
        if (ignoreResetRef.current) {
            ignoreResetRef.current = false;
            return;
        }
        hasInitializedClips.current = false;
        // Only clear clips if we are actually loading a NEW single video file
        // If we have multiple clips effectively managed, this might be aggressive.
        // For now, relies on the Ref guard during restore.
        setVideoClips([]);
    }, [videoUrl]);

    // Initialize default clip when duration is ready
    useEffect(() => {
        if (videoUrl && duration > 0 && !hasInitializedClips.current) {
            const clipId = `clip-main-${Date.now()}`;

            // Get video dimensions for aspect ratio
            const videoRatio = mainVideoRef.current
                ? mainVideoRef.current.videoWidth / mainVideoRef.current.videoHeight
                : 16 / 9; // Default to 16:9 if not available

            // CapCut-style: Create main video clip WITHOUT separate audio clip
            // Audio will only appear in A1 after user clicks "분리" button
            setVideoClips([{
                id: clipId,
                startTime: 0,
                endTime: duration,
                sourceStart: 0,
                sourceEnd: duration,
                sourceDuration: duration, // Original full video length for trim limits
                layer: 0,
                assetId: 'main',
                src: videoUrl,
                name: videoFile?.name || 'Main Video', // Display filename on timeline
                hasAudio: true,
                isAudioLinked: true,  // Audio stays with video until explicitly separated
                ratio: videoRatio || 16 / 9 // Store actual aspect ratio
            }]);

            // Don't create audio clip - CapCut style
            // setAudioClips(...) removed

            if (!assets['main']) setAssets(prev => ({ ...prev, 'main': videoUrl }));
            hasInitializedClips.current = true;

            console.log('[Init] Created main clip (no separate audio):', clipId, 'ratio:', videoRatio);
        }
    }, [duration, videoUrl]);

    // Set initial src for mainVideoRef - prioritize first clip's src for multi-clip scenarios
    useEffect(() => {
        if (mainVideoRef.current) {
            // Priority: first clip's src > videoUrl
            const firstClipSrc = videoClips.length > 0 ? videoClips[0].src : null;
            const rawSrc = firstClipSrc || videoUrl;
            // Use proxy for CORS with http URLs (e.g., Supabase)
            const srcToSet = rawSrc?.startsWith('http')
                ? `/api/proxy-video?url=${encodeURIComponent(rawSrc)}`
                : rawSrc;
            if (srcToSet && mainVideoRef.current.src !== srcToSet) {
                console.log('[SubtitleMaker] Setting mainVideoRef src:', srcToSet?.substring(0, 80));
                mainVideoRef.current.src = srcToSet;
            }
        }
    }, [videoUrl, videoClips]);

    // Dynamic Active Layers
    const activeLayers = useMemo(() => {
        const max = Math.max(0, ...videoClips.map(c => c.layer || 0));
        return Array.from({ length: max + 1 }, (_, i) => i);
    }, [videoClips]);

    // Auto-update timeline duration based on max endTime across ALL clips (not just V1)
    useEffect(() => {
        const maxVideoEnd = videoClips.length > 0
            ? Math.max(...videoClips.map(c => c.endTime))
            : 0;
        const maxAudioEnd = audioClips.length > 0
            ? Math.max(...audioClips.map(c => c.endTime))
            : 0;
        const newDuration = Math.max(maxVideoEnd, maxAudioEnd, duration);

        // Only update if clips extend beyond current duration
        if (newDuration > duration) {
            setDuration(newDuration);
        }
    }, [videoClips, audioClips]);

    // Animation State
    const [animationStyle, setAnimationStyle] = useState('none');

    const ANIMATION_STYLES = [
        { id: 'none', label: '없음', class: '' },
        { id: 'fade', label: 'Fade', class: 'animate-fade' },
        { id: 'pop', label: 'Pop', class: 'animate-pop' },
        { id: 'slide-up', label: 'Slide↑', class: 'animate-slide-up' },
        { id: 'slide-down', label: 'Slide↓', class: 'animate-slide-down' },
        { id: 'typewriter', label: 'Typewriter', class: 'animate-typewriter overflow-hidden whitespace-nowrap border-r-4 border-white pr-1' },
        { id: 'neon', label: 'Neon', class: 'animate-neon' },
        { id: 'shake', label: 'Shake', class: 'animate-shake' },
        { id: 'zoom-out', label: 'Zoom', class: 'animate-zoom-out' },
        { id: 'blur', label: 'Blur', class: 'animate-blur' },
        { id: 'flip', label: '3D Flip', class: 'animate-flip' },
    ];

    const FONT_SIZES = [
        ...Array.from({ length: 16 }, (_, i) => i + 5).map(s => ({
            id: String(s),
            label: String(s),
            class: `text-[${s}px]`
        })),
        { id: '24', label: '24', class: 'text-[24px]' },
        { id: '28', label: '28', class: 'text-[28px]' },
        { id: '32', label: '32', class: 'text-[32px]' },
        { id: '40', label: '40', class: 'text-[40px]' },
        { id: '48', label: '48', class: 'text-[48px]' },
        { id: '56', label: '56', class: 'text-[56px]' },
        { id: '64', label: '64', class: 'text-[64px]' },
        { id: '72', label: '72', class: 'text-[72px]' },
    ];

    const FONT_FAMILIES = [
        { id: 'malgun', label: '맑은 고딕', style: { fontFamily: '"Malgun Gothic", "맑은 고딕", sans-serif' } },
        { id: 'nanum', label: '나눔고딕', style: { fontFamily: '"NanumGothic", "나눔고딕", sans-serif' } },
        { id: 'gulim', label: '굴림', style: { fontFamily: '"Gulim", "굴림", sans-serif' } },
        { id: 'dotum', label: '돋움', style: { fontFamily: '"Dotum", "돋움", sans-serif' } },
        { id: 'batang', label: '바탕', style: { fontFamily: '"Batang", "바탕", serif' } },
        { id: 'gungsuh', label: '궁서', style: { fontFamily: '"Gungsuh", "궁서", serif' } },
        { id: 'arial', label: 'Arial', style: { fontFamily: 'Arial, sans-serif' } },
        { id: 'impact', label: 'Impact', style: { fontFamily: 'Impact, sans-serif' } },
        { id: 'times', label: 'Times New Roman', style: { fontFamily: '"Times New Roman", serif' } },
        { id: 'comic', label: 'Comic Sans', style: { fontFamily: '"Comic Sans MS", cursive' } },
    ];

    const TRANSLATION_LANGUAGES = [
        { id: 'en', label: 'English (영어)' },
        { id: 'ja', label: '日本語 (일어)' },
        { id: 'zh', label: '中文 (중국어)' },
        { id: 'es', label: 'Español (스페인어)' },
    ];

    // Translation State
    const [selectedTranslationLang, setSelectedTranslationLang] = useState('en');

    // Subtitle Display Options
    const [showSubtitleBackground, setShowSubtitleBackground] = useState(false);

    // Subtitle Position (percentage based: x: 0-100, y: 0-100)
    const [subtitlePosition, setSubtitlePosition] = useState({ x: 50, y: 75 });
    const [subtitleWidth, setSubtitleWidth] = useState(80); // percentage width
    const [yUnit, setYUnit] = useState<'percent' | 'px'>('percent'); // 'percent' | 'px'
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    // Drag handlers for subtitle position
    const handleSubtitleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleSubtitleDrag = (e: React.MouseEvent | React.TouchEvent) => {
        if (!videoContainerRef.current) return;

        const container = videoContainerRef.current.getBoundingClientRect();
        let clientX: number, clientY: number;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        if (isResizing) {
            // Calculate width based on distance from center
            const centerX = container.left + container.width * (subtitlePosition.x / 100);
            const distanceFromCenter = Math.abs(clientX - centerX);
            const newWidth = (distanceFromCenter / container.width) * 200; // *2 because we measure from center
            setSubtitleWidth(Math.max(30, Math.min(95, newWidth)));
        } else if (isDragging) {
            const x = ((clientX - container.left) / container.width) * 100;
            const y = ((clientY - container.top) / container.height) * 100;
            setSubtitlePosition({
                x: Math.max(5, Math.min(95, x)),
                y: Math.max(5, Math.min(95, y))
            });
        }
    };

    const handleSubtitleDragEnd = () => {
        setIsDragging(false);
        setIsResizing(false);
    };

    const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
    };

    // Drag and drop state
    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounter = useRef(0);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragOver(true);
        }
    };

    // --- Apple Confirm Modal Logic ---
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        message: string;
        resolve: ((value: boolean) => void) | null;
    }>({
        isOpen: false,
        message: '',
        resolve: null
    });

    const requestConfirm = (message: string): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirmState({
                isOpen: true,
                message,
                resolve
            });
        });
    };

    const handleConfirmAction = (result: boolean) => {
        if (confirmState.resolve) {
            confirmState.resolve(result);
        }
        setConfirmState(prev => ({ ...prev, isOpen: false, resolve: null }));
    };


    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDragOver(false);
        }
    };

    // Upload State
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedPath, setUploadedPath] = useState<string | null>(null);

    // ... (existing handlers)

    const uploadToSupabase = async (file: File) => {
        setIsUploading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.warn('No session found, skipping upload');
                return null;
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const filePath = `${session.user.id}/${fileName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('videos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            setUploadedPath(filePath); // Save path for processing

            // Get Signed URL
            const { data: signedData, error: signedError } = await supabase.storage
                .from('videos')
                .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days

            if (signedError || !signedData?.signedUrl) throw signedError || new Error('Failed to get signed URL');
            const signedUrl = signedData.signedUrl;

            // Save metadata
            await supabase.from('video_files').insert({
                filename: file.name,
                storage_path: filePath,
                size: file.size,
                mime_type: file.type
            });

            return signedUrl;
        } catch (error) {
            console.error('Upload failed:', error);
            alert('영상 업로드 실패 (Supabase 설정을 확인해주세요)');
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    // Q Drive Drag Handler
    const handleQDriveDragStart = (e: React.DragEvent, asset: any) => {
        e.dataTransfer.setData('application/tubiq-asset', JSON.stringify(asset));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        dragCounter.current = 0;

        // 1. Check for Q Drive Assets
        const tubiqAssetData = e.dataTransfer.getData('application/tubiq-asset');
        if (tubiqAssetData) {
            try {
                const asset = JSON.parse(tubiqAssetData);
                console.log("Dropped Q Drive Asset:", asset);

                // If from Storage, get signed URL for proper playback
                let finalUrl = asset.url;
                if (asset.platform === 'storage' && asset.url) {
                    // Extract path from URL
                    const urlObj = new URL(asset.url);
                    const pathMatch = urlObj.pathname.match(/\/videos\/(.+)$/);
                    if (pathMatch) {
                        const storagePath = decodeURIComponent(pathMatch[1]);
                        const { data } = await supabase.storage.from('videos').createSignedUrl(storagePath, 3600);
                        if (data?.signedUrl) {
                            finalUrl = data.signedUrl;
                            console.log("Using signed URL for storage asset:", finalUrl);
                        }
                    }
                }

                // Add to timeline
                const newClipId = `clip-${Date.now()}`;

                // Load video metadata to get actual duration
                const videoEl = document.createElement('video');
                videoEl.crossOrigin = 'anonymous';
                // Use proxy for CORS
                const proxiedUrl = finalUrl.startsWith('http')
                    ? `/api/proxy-video?url=${encodeURIComponent(finalUrl)}`
                    : finalUrl;
                videoEl.src = proxiedUrl;

                videoEl.onloadedmetadata = () => {
                    const videoDuration = videoEl.duration || 10;

                    // Find next available layer (V1=0, V2=1, V3=2...)
                    const newLayer = videoClips.length === 0 ? 0 : Math.max(0, ...videoClips.map(c => c.layer || 0)) + 1;

                    // Magnet snap: find last clip end time in this layer
                    const sameLayerClips = videoClips.filter(c => (c.layer || 0) === newLayer);
                    const snapStartTime = sameLayerClips.length > 0
                        ? Math.max(...sameLayerClips.map(c => c.endTime))
                        : 0;

                    const newClip: VideoClip = {
                        id: newClipId,
                        startTime: snapStartTime,
                        endTime: snapStartTime + videoDuration,
                        sourceStart: 0,
                        sourceEnd: videoDuration,
                        layer: newLayer,
                        assetId: asset.id,
                        src: finalUrl,
                        hasAudio: true,
                        isAudioLinked: true,
                    };

                    updateVideoClipsWithHistory(prev => [...prev, newClip]);
                    setAssets(prev => ({ ...prev, [asset.id]: finalUrl }));

                    // Set as main video if first clip
                    if (!videoUrl) {
                        setVideoUrl(finalUrl);
                    }

                    // Update duration if needed
                    const newEndTime = snapStartTime + videoDuration;
                    if (newEndTime > duration) {
                        setDuration(newEndTime);
                    }

                    console.log(`Q Drive clip added to V${newLayer + 1} at ${snapStartTime}:`, newClipId);
                };

                videoEl.onerror = () => {
                    const newLayer = videoClips.length === 0 ? 0 : Math.max(0, ...videoClips.map(c => c.layer || 0)) + 1;
                    const sameLayerClips = videoClips.filter(c => (c.layer || 0) === newLayer);
                    const snapStartTime = sameLayerClips.length > 0
                        ? Math.max(...sameLayerClips.map(c => c.endTime))
                        : 0;

                    const newClip: VideoClip = {
                        id: newClipId,
                        startTime: snapStartTime,
                        endTime: snapStartTime + 10,
                        sourceStart: 0,
                        sourceEnd: 10,
                        layer: newLayer,
                        assetId: asset.id,
                        src: finalUrl,
                        hasAudio: true,
                        isAudioLinked: true,
                    };
                    updateVideoClipsWithHistory(prev => [...prev, newClip]);
                    setAssets(prev => ({ ...prev, [asset.id]: finalUrl }));

                    if (!videoUrl) {
                        setVideoUrl(finalUrl);
                    }

                    console.log(`Q Drive clip added (fallback) to V${newLayer + 1}:`, newClipId);
                };
                return;
            } catch (err) {
                console.error("Failed to parse Q Drive drop:", err);
            }
        }

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            const isVideo = file.type.startsWith('video/');
            const isAudio = file.type.startsWith('audio/');

            if (isVideo) {
                // Immediate local preview
                const localUrl = URL.createObjectURL(file);
                const assetId = `asset-${Date.now()}`;
                const clipId = `clip-${Date.now()}`;

                setAssets(prev => ({ ...prev, [assetId]: localUrl }));

                const videoEl = document.createElement('video');
                videoEl.src = localUrl;
                videoEl.onloadedmetadata = () => {
                    const newDuration = videoEl.duration;

                    // Find next available layer (V1=0, V2=1, V3=2...)
                    const newLayer = videoClips.length === 0 ? 0 : Math.max(0, ...videoClips.map(c => c.layer || 0)) + 1;

                    // Magnet snap: find last clip end time in this layer
                    const sameLayerClips = videoClips.filter(c => (c.layer || 0) === newLayer);
                    const snapStartTime = sameLayerClips.length > 0
                        ? Math.max(...sameLayerClips.map(c => c.endTime))
                        : 0;

                    const newClip: VideoClip = {
                        id: clipId,
                        startTime: snapStartTime,
                        endTime: snapStartTime + newDuration,
                        sourceStart: 0,
                        sourceEnd: newDuration,
                        layer: newLayer,
                        assetId: assetId,
                        src: localUrl,
                        hasAudio: true,
                        isAudioLinked: true,
                    };

                    updateVideoClipsWithHistory(prev => [...prev, newClip]);

                    // Set as main video if first clip
                    if (!videoUrl) {
                        setVideoFile(file);
                        setVideoUrl(localUrl);
                    }

                    // Update duration if needed
                    const newEndTime = snapStartTime + newDuration;
                    if (newEndTime > duration) {
                        setDuration(newEndTime);
                    }

                    console.log(`Local clip added to V${newLayer + 1} at ${snapStartTime}:`, clipId);

                    // Prevent duplicate clip creation from initialization useEffect
                    hasInitializedClips.current = true;
                };

                // Background upload
                uploadToSupabase(file);
            } else if (isAudio) {
                setAudioFile(file);
            }
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // CRITICAL: Reset all video-related states for clean replacement
            setPlaybackTime(0);
            setVideoClips([]);  // Clear old clips
            hasInitializedClips.current = false;  // Allow re-initialization
            setMainVideoElement(null);  // Reset video element reference
            setDuration(0);  // Reset duration (will be set by onLoadedMetadata)
            hiddenVideoRefs.current.clear();  // Clear overlay video pool

            // Set new video
            setVideoFile(file);
            const localUrl = URL.createObjectURL(file);
            setVideoUrl(localUrl);
            setAssets({ 'main': localUrl });

            console.log('[VideoReplace] States reset, new video loaded:', file.name);

            // Background upload
            uploadToSupabase(file).then(remoteUrl => {
                if (remoteUrl) console.log('Video uploaded:', remoteUrl);
            });
        }
    };

    const handleTimelineDrop = (file: File, time: number) => {
        if (!file.type.startsWith('video/')) return;

        const localUrl = URL.createObjectURL(file);
        const assetId = `asset-${Date.now()}`;
        setAssets(prev => ({ ...prev, [assetId]: localUrl }));

        const videoEl = document.createElement('video');
        videoEl.src = localUrl;
        videoEl.onloadedmetadata = () => {
            const newDuration = videoEl.duration;
            const clipId = `clip-${Date.now()}`;

            // Find the next available layer (V1=0, V2=1, V3=2, ...)
            // Each new clip goes to a new layer for multi-track editing
            const usedLayers = new Set(videoClips.map(c => c.layer || 0));
            let newLayer = 0;

            // If there are already clips, assign to next layer
            if (videoClips.length > 0) {
                const maxLayer = Math.max(...videoClips.map(c => c.layer || 0));
                newLayer = maxLayer + 1;
            }

            // Alternative: Find first layer where there's no overlap at the drop time
            // This allows stacking at same time on different layers
            for (let layer = 0; layer <= (usedLayers.size + 1); layer++) {
                const layerClips = videoClips.filter(c => (c.layer || 0) === layer);
                const hasOverlap = layerClips.some(c =>
                    (time >= c.startTime && time < c.endTime) ||
                    (time + newDuration > c.startTime && time + newDuration <= c.endTime) ||
                    (time <= c.startTime && time + newDuration >= c.endTime)
                );
                if (!hasOverlap) {
                    newLayer = layer;
                    break;
                }
            }

            // Create new clip at the drop time on the new layer
            // Calculate aspect ratio from video dimensions
            const videoRatio = videoEl.videoWidth / videoEl.videoHeight;

            const newClip: VideoClip = {
                id: clipId,
                startTime: time,
                endTime: time + newDuration,
                sourceStart: 0,
                sourceEnd: newDuration,
                sourceDuration: newDuration, // Original full video length for trim limits
                layer: newLayer,
                assetId: assetId,
                src: localUrl,
                name: file.name, // Display filename on timeline
                hasAudio: true,
                isAudioLinked: true,
                ratio: videoRatio // Store actual aspect ratio
            };

            updateVideoClipsWithHistory(prev => [...prev, newClip]);

            // Update duration if this clip extends beyond current duration
            const newTotalDuration = time + newDuration;
            if (newTotalDuration > duration) {
                setDuration(newTotalDuration);
            }

            // Set as main video only if this is the first clip
            if (videoClips.length === 0) {
                setVideoUrl(localUrl);
            }

            console.log(`[Timeline Drop] Added clip to V${newLayer + 1} at ${time}:`, clipId);
        };

        // Background upload
        uploadToSupabase(file);
    };





    // =============================
    // CANVAS COMPOSITING LOOP
    // =============================
    useEffect(() => {
        let animationFrameId: number;

        const renderLoop = () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d', { alpha: false }); // Optimize for no transparency

            if (canvas && ctx) {
                // 2. Identify Active Clips at Current Time
                // We use the Main Video's time as the source of truth if playing, else state time
                const masterTime = mainVideoElement && !mainVideoElement.paused
                    ? mainVideoElement.currentTime
                    : playbackTime;

                const activeClips = videoClips
                    .filter(c => masterTime >= c.startTime && masterTime < c.endTime && !c.isHidden)
                    .sort((a, b) => (a.layer || 0) - (b.layer || 0));

                // Check if main video is ready to draw (only if there's actually a V1 clip)
                const mainClip = activeClips.find(c => (c.layer || 0) === 0);
                const mainVideoReady = mainClip && mainVideoElement && mainVideoElement.readyState >= 2;

                // Check if any overlay clip is ready to draw (for V2-only case)
                const anyOverlayReady = activeClips.some(c => {
                    if ((c.layer || 0) === 0) return false; // Skip main clip
                    const videoEl = hiddenVideoRefs.current.get(c.id);
                    return videoEl && videoEl.readyState >= 2;
                });

                // CRITICAL: Only clear canvas if we have something READY to draw
                // This prevents flicker when V2 is still loading
                const hasAnythingToDraw = mainVideoReady || anyOverlayReady;

                if (hasAnythingToDraw || activeClips.length === 0) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                // else: Keep the last frame displayed during buffering

                // 3. Draw Clips (Layer 0 -> N)
                activeClips.forEach(clip => {
                    let videoEl: HTMLVideoElement | undefined;

                    if ((clip.layer || 0) === 0) {
                        videoEl = mainVideoElement || undefined;
                    } else {
                        videoEl = hiddenVideoRefs.current.get(clip.id);
                    }

                    if (videoEl && videoEl.readyState >= 2) { // HAVE_CURRENT_DATA
                        // Sync Overlay Videos to Master Time
                        if ((clip.layer || 0) > 0) {
                            const offset = masterTime - clip.startTime;
                            const sourceTime = clip.sourceStart + offset;

                            // Sync Check
                            const diff = Math.abs(videoEl.currentTime - sourceTime);
                            if (diff > 0.25) { // 250ms tolerance (relaxed to prevent stutter)
                                videoEl.currentTime = sourceTime;
                            }

                            // Play State Sync
                            if (isPlaying && videoEl.paused) videoEl.play().catch(() => { });
                            else if (!isPlaying && !videoEl.paused) videoEl.pause();
                        }

                        // Calculate Draw Position
                        const width = canvas.width;
                        const height = canvas.height;

                        let drawX = 0;
                        let drawY = 0;
                        let drawW = width;
                        let drawH = height;

                        if ((clip.layer || 0) === 0) {
                            // Layer 0: Contain (Fit Center)
                            const srcRatio = videoEl.videoWidth / videoEl.videoHeight;
                            const dstRatio = width / height;

                            if (srcRatio > dstRatio) {
                                // Source is wider (Letterbox top/bottom)
                                drawW = width;
                                drawH = width / srcRatio;
                                drawY = (height - drawH) / 2;
                            } else {
                                // Source is taller (Pillarbox left/right)
                                drawH = height;
                                drawW = height * srcRatio;
                                drawX = (width - drawW) / 2;
                            }
                        }

                        // Apply Preview Position for ALL clips (V1 included)
                        if (clip.previewPosition) {
                            const { x, y } = clip.previewPosition;
                            const scale = clip.scale || 1;

                            // For V1 (layer 0): Keep the contain sizing already calculated above
                            // Only adjust position based on previewPosition offset from center (50%, 50%)
                            if ((clip.layer || 0) === 0) {
                                // Calculate offset from center (default position is 50%, 50%)
                                const offsetX = ((x - 50) / 100) * width;
                                const offsetY = ((y - 50) / 100) * height;

                                // Apply offset to contain-calculated position
                                drawX += offsetX;
                                drawY += offsetY;

                                // Apply scale if set
                                if (scale !== 1) {
                                    const centerX = drawX + drawW / 2;
                                    const centerY = drawY + drawH / 2;
                                    drawW *= scale;
                                    drawH *= scale;
                                    drawX = centerX - drawW / 2;
                                    drawY = centerY - drawH / 2;
                                }
                            } else {
                                // For overlays (V2+): Use full position/scale logic
                                // Base Size: CONTAIN (Fit to Screen 100%)
                                let baseW = width;
                                let baseH = height;

                                // Use stored ratio if available, else derive from element or default
                                const aspect = clip.ratio || (videoEl.videoWidth / videoEl.videoHeight) || (16 / 9);

                                // Calculate Contain Dimensions
                                if (width / height > aspect) {
                                    // Canvas is wider than video -> fit height
                                    baseH = height;
                                    baseW = height * aspect;
                                } else {
                                    // Canvas is taller than video -> fit width
                                    baseW = width;
                                    baseH = width / aspect;
                                }

                                // Apply Scale
                                drawW = baseW * scale;
                                drawH = baseH * scale;

                                // Position (Center)
                                drawX = (x / 100) * width - (drawW / 2);
                                drawY = (y / 100) * height - (drawH / 2);
                            }
                        }

                        ctx.drawImage(videoEl, drawX, drawY, drawW, drawH);
                    }
                });
            }

            animationFrameId = requestAnimationFrame(renderLoop);
        };

        renderLoop();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [videoClips, playbackTime, isPlaying, mainVideoElement]); // Dependencies


    // Audio Sync for Overlays (Volume/Mute)
    // We unmute all active overlays to allow mixing, or handle volume.
    // Assuming simple mixing for now.

    // Sync V1 (mainVideoElement) mute state with clip audio state
    useEffect(() => {
        const video = mainVideoRef.current || mainVideoElement;
        if (!video) return;

        // Check if any V1 clip has isMuted set (track-level mute)
        const v1Clips = videoClips.filter(c => (c.layer || 0) === 0);
        const isV1Muted = v1Clips.some(c => c.isMuted);

        // Also mute video if audio has been separated (isAudioLinked = false)
        const hasUnlinkedAudio = v1Clips.some(c => c.hasAudio && c.isAudioLinked === false);

        // Also check if separated audio clips exist (legacy check)
        const hasSeparatedAudio = audioClips.length > 0;

        // Force apply mute state directly to video element
        const shouldMute = isV1Muted || hasUnlinkedAudio || hasSeparatedAudio;
        video.muted = shouldMute;
        console.log('[Mute Sync] V1 muted:', isV1Muted, 'hasUnlinkedAudio:', hasUnlinkedAudio, 'hasSeparatedAudio:', hasSeparatedAudio, 'video.muted:', video.muted);
    }, [mainVideoElement, videoClips, audioClips]);

    // Audio Engine (for Separated Audio)
    useEffect(() => {
        const audioEl = audioRef.current;
        if (!audioEl) return;

        // Play audio if there are separated audio clips
        if (audioClips.length === 0) {
            if (!audioEl.paused) audioEl.pause();
            return;
        }

        // Find active audio clip at current time
        const clip = audioClips.find(c => currentTime >= c.startTime && currentTime < c.endTime);

        if (clip) {
            // Use clip's own source (from video it was separated from)
            const src = clip.src || videoUrl;
            if (src && audioEl.src !== src && !audioEl.src.includes(src)) {
                audioEl.src = src;
            }

            const offset = currentTime - clip.startTime;
            const sourceTime = clip.sourceStart + offset;

            if (Number.isFinite(sourceTime)) {
                const drift = Math.abs(audioEl.currentTime - sourceTime);
                if (isPlaying) {
                    if (audioEl.paused) audioEl.play().catch(() => { });
                    if (drift > 0.1) audioEl.currentTime = sourceTime;
                } else {
                    if (!audioEl.paused) audioEl.pause();
                    if (drift > 0.1) audioEl.currentTime = sourceTime;
                }
            }
        } else {
            if (!audioEl.paused) audioEl.pause();
        }
    }, [currentTime, audioClips, isPlaying, videoUrl]);

    // Video Processing Request
    const [isProcessing, setIsProcessing] = useState(false);

    const requestVideoProcessing = async () => {
        if (!videoFile || !subtitles.length) {
            alert("처리할 영상이나 자막이 없습니다.");
            return;
        }

        setIsProcessing(true);
        try {
            // Get current session for user ID
            const { data: { session } = {} } = await supabase.auth.getSession();
            if (!session) throw new Error("No session");

            // Assuming file is already uploaded and we have the path
            // We need to find the video_files record or just construct path if we know it.
            // For now, let's reconstruct path if we uploaded it or store it in state.
            // Simplified: Re-upload logic or find latest upload.
            // Better: Store uploaded path in state `uploadedVideoPath`

            // Temporary: Use a stored path or upload again if needed?
            // For this iteration, let's assume we saved it.
            // NOTE: In real app, `uploadedVideoPath` should be state.
            // Let's quickly try to find the file or just use the logic in uploadToSupabase to set a state.

            // Actually, let's find the latest file in the bucket for this user (quick hack for demo)
            // or better, update uploadToSupabase to set state.

            // Let's use a hardcoded fetch for now to prove concept if we don't have path state yet.
            // Wait, we need the path.
            // Let's add `uploadedPath` state in next step or use what we have.
            // Re-uploading is safest for now to ensure we have the path.

            if (!uploadedPath) {
                alert("먼저 영상을 업로드해주세요.");
                return;
            }

            const response = await fetch('http://localhost:8080/process-video', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'x-account-id': session.user.id
                },
                body: JSON.stringify({
                    video_path: uploadedPath,
                    subtitles: subtitles,
                    options: {}
                })
            });

            const result = await response.json();
            if (result.ok) {
                alert(`처리 완료! 다운로드 링크: \n${result.url}`);
                window.open(result.url, '_blank');
            } else {
                throw new Error('Processing failed');
            }

        } catch (e) {
            console.error(e);
            alert("비디오 처리 실패 (로컬 서버가 켜져있나요?)");
        } finally {
            setIsProcessing(false);
        }
    };



    const handleGenerateSubtitles = async () => {
        // if (!scriptText) return alert('대본을 입력해주세요.'); // Removed strict check
        if (!videoFile && !audioFile) return alert('영상 또는 음성 파일을 업로드해주세요.');
        if (!scriptText && !(await requestConfirm('대본 없이 진행하시겠습니까?\nAI가 음성을 분석하여 자동으로 자막을 생성합니다.'))) return;

        setIsGenerating(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const formData = new FormData();

            // Optimization: Extract audio from video to reduce payload size (Fix 413 Error)
            if (videoFile && !audioFile) {
                // console.log("Optimizing: Extracting audio from video...");
                try {
                    const wavBlob = await extractAudioFromVideo(videoFile);
                    // Send as 'audio' so backend treats it as audio file
                    formData.append('audio', wavBlob, 'extracted_audio.wav');
                } catch (e) {
                    console.warn("Audio extraction failed, falling back to original video upload.", e);
                    formData.append('video', videoFile);
                }
            } else {
                if (videoFile) formData.append('video', videoFile);
                if (audioFile) formData.append('audio', audioFile);
            }

            if (scriptText) {
                formData.append('script', scriptText);
            }

            const response = await fetch('/api/subtitle/generate', {
                method: 'POST',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: formData
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`[${response.status}] ${errText}`);
            }

            const result = await response.json();
            if (result.ok && result.data) {
                // Map API response to Subtitle interface
                // Remove punctuation marks from subtitle text
                const removePunctuation = (text: string) =>
                    text.replace(/[.,!?;:'"()\[\]{}…·、。！？，。「」『』【】〈〉《》]/g, '').trim();

                const newSubtitles = result.data.map((item: any, idx: number) => ({
                    id: `gen-${idx}`,
                    startTime: item.start,
                    endTime: item.end,
                    text: removePunctuation(item.text),
                    animation: 'none',
                    fontSize: '16',
                    fontFamily: 'malgun'
                }));
                setSubtitles(newSubtitles);
            } else {
                throw new Error(result.message || 'Generation failed');
            }

        } catch (error) {
            console.error('Failed to generate subtitles:', error);
            alert('자막 생성 중 오류가 발생했습니다. (파일이 너무 크거나 API 문제일 수 있습니다)');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSmartSync = async () => {
        if (!subtitles.length) return alert('자막이 없습니다.');
        const fileToSync = audioFile || videoFile;
        if (!fileToSync) return alert('영상 또는 음성 파일이 필요합니다.');

        // Warning for large files (optional, but good for UX)
        if (fileToSync.size > 50 * 1024 * 1024) {
            if (!(await requestConfirm('파일 크기가 커서 시간이 오래 걸릴 수 있습니다.\n계속하시겠습니까?'))) return;
        }

        setIsSyncing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            let fileToProcess: File | Blob = fileToSync;
            let mimeType = fileToSync.type;

            // Optimizing: Extract audio if it's a video file
            if (videoFile && fileToSync === videoFile) {
                // console.log('Extracting audio from video...');
                try {
                    const wavBlob = await extractAudioFromVideo(videoFile);
                    fileToProcess = wavBlob;
                    mimeType = 'audio/wav';
                } catch (e) {
                    console.warn('Audio extraction failed, falling back to original file', e);
                }
            }

            const reader = new FileReader();
            reader.readAsDataURL(fileToProcess);

            const base64Data = await new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                    const result = reader.result as string;
                    const base64 = result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
            });

            const transcript = subtitles.map(s => s.text);

            const response = await fetch('/api/gemini/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    audioData: base64Data,
                    mimeType: mimeType,
                    transcript
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`[${response.status}] ${errText}`);
            }

            const result = await response.json();

            if (!result.ok) throw new Error(result.error || result.message || 'Sync failed');

            const aligned = result.alignedData; // [{ index, text, startTime, endTime }]

            const newSubtitles = [...subtitles];

            // Update timestamps based on index
            if (Array.isArray(aligned)) {
                aligned.forEach((item: any) => {
                    // item.index should be 1-based
                    const idx = (item.index || 0) - 1;

                    // Fallback if index missing: use array index if lengths match
                    const targetIdx = (item.index !== undefined) ? idx : subtitles.findIndex(s => s.text === item.text);

                    if (targetIdx >= 0 && targetIdx < newSubtitles.length) {
                        // Only update if duration is valid > 0
                        if (item.endTime > item.startTime) {
                            let newStart = item.startTime;
                            // Lead-in compensation: If animation is active, start slightly earlier
                            if (animationStyle !== 'none') {
                                newStart = Math.max(0, newStart - 0.15); // 0.15s lead-in
                            }

                            newSubtitles[targetIdx].startTime = newStart;
                            newSubtitles[targetIdx].endTime = item.endTime;
                            // Update text if Gemini corrected it
                            if (item.text) {
                                newSubtitles[targetIdx].text = item.text;
                            }
                        }
                    }
                });
                setSubtitles(newSubtitles);
                alert('싱크 보정이 완료되었습니다!');
            } else {
                throw new Error('Invalid response format');
            }

        } catch (error: any) {
            console.error('Smart Sync Failed:', error);
            alert('싱크 보정 실패: ' + error.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleTranslate = async () => {
        if (subtitles.length === 0) return alert('번역할 자막이 없습니다.');

        // Get full language name for the API
        const langLabel = TRANSLATION_LANGUAGES.find(l => l.id === selectedTranslationLang)?.label || 'English';

        setIsTranslating(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch('/api/subtitle/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    subtitles,
                    targetLang: langLabel // Send full language name for better translation
                })
            });

            const result = await response.json();
            if (result.ok && Array.isArray(result.data)) {
                // Store translation in translatedText, keep original text
                const translatedSubtitles = subtitles.map((sub, idx) => ({
                    ...sub,
                    translatedText: result.data[idx] || '' // Store translation separately
                }));
                setSubtitles(translatedSubtitles);
            } else {
                throw new Error(result.message || 'Translation failed');
            }
        } catch (error) {
            console.error('Translation error:', error);
            alert('번역 중 오류가 발생했습니다.');
        } finally {
            setIsTranslating(false);
        }
    };

    const formatTime = (seconds: number) => {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    // Parse time string "MM:SS.ms" back to seconds
    const parseTime = (timeStr: string): number | null => {
        const match = timeStr.match(/^(\d+):(\d+)\.?(\d*)$/);
        if (!match) return null;
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = match[3] ? parseInt(match[3].padEnd(2, '0').slice(0, 2), 10) : 0;
        return min * 60 + sec + ms / 100;
    };

    // Apply offset to all subtitles (shift all times)
    const applyOffset = (offsetSeconds: number) => {
        setSubtitles(subtitles.map(sub => ({
            ...sub,
            startTime: Math.max(0, sub.startTime + offsetSeconds),
            endTime: Math.max(0.1, sub.endTime + offsetSeconds)
        })));
    };

    const handleExport = () => {
        if (subtitles.length === 0) return alert('내보낼 자막이 없습니다.');

        const toSrtTime = (seconds: number) => {
            const date = new Date(0);
            date.setMilliseconds(seconds * 1000);
            return date.toISOString().substr(11, 12).replace('.', ',');
        };

        const srtContent = subtitles.map((sub, index) => {
            return `${index + 1}\n${toSrtTime(sub.startTime)} --> ${toSrtTime(sub.endTime)}\n${sub.text}\n`;
        }).join('\n');

        const blob = new Blob([srtContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `subtitles_${Date.now()}.srt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Get current active subtitle (exclusive end time to avoid overlap) & Filter out excluded cuts
    const currentSubtitle = subtitles.find(sub =>
        currentTime >= sub.startTime &&
        currentTime < sub.endTime &&
        !excludedSubtitleIds.has(sub.id)
    );

    // Get per-subtitle style classes (animation, fontSize, fontFamily)
    const getSubtitleAnimationClass = (sub: Subtitle) => ANIMATION_STYLES.find(s => s.id === sub.animation)?.class || '';
    const getSubtitleFontSizeClass = (sub: Subtitle) => FONT_SIZES.find(s => s.id === sub.fontSize)?.class || 'text-[16px]';
    const getSubtitleFontFamilyStyle = (sub: Subtitle) => FONT_FAMILIES.find(s => s.id === sub.fontFamily)?.style || { fontFamily: '"Malgun Gothic", sans-serif' };

    // Stable Handlers for SubtitleRow Optimization
    const handleTimelineSeek = (time: number) => {
        const safeTime = Math.max(0, Math.min(time, duration));

        // Update State
        setCurrentTime(safeTime);

        // Sync Audio (Single Track for now)
        if (audioRef.current) {
            const activeAudio = audioClips.find(c => safeTime >= c.startTime && safeTime < c.endTime);
            if (activeAudio) {
                const offset = safeTime - activeAudio.startTime;
                audioRef.current.currentTime = activeAudio.sourceStart + offset;
            }
        }

        // Sync Layer 0 (Main Video)
        if (mainVideoElement) {
            mainVideoElement.currentTime = safeTime;
        } else if (mainVideoRef.current) {
            mainVideoRef.current.currentTime = safeTime;
        }

        // Sync Overlay Videos (Hidden)
        videoClips.forEach(clip => {
            if ((clip.layer || 0) > 0) {
                const videoEl = hiddenVideoRefs.current.get(clip.id);
                if (videoEl) {
                    const offset = safeTime - clip.startTime;
                    videoEl.currentTime = clip.sourceStart + offset;
                }
            }
        });
    };



    // History-aware handlers
    // 1. For SubtitleRow (Object-based & Cursor-based)
    const handleUpdateSubtitleObject = (updatedSub: Subtitle) => {
        updateSubtitlesWithHistory(prev => prev.map(s => s.id === updatedSub.id ? updatedSub : s));
    };

    const handleSplitByCursor = (sub: Subtitle, cursorPosition: number) => {
        updateSubtitlesWithHistory(prev => {
            const index = prev.findIndex(s => s.id === sub.id);
            if (index === -1) return prev;

            const text = sub.text;
            const part1Text = text.slice(0, cursorPosition).trim();
            const part2Text = text.slice(cursorPosition).trim();

            // Prevent empty splits if possible, or allow empty
            if (!part1Text && !part2Text) return prev;

            const duration = sub.endTime - sub.startTime;
            const totalLength = part1Text.length + part2Text.length;
            let splitRatio = 0.5;
            if (totalLength > 0) splitRatio = part1Text.length / totalLength;
            const splitTime = sub.startTime + (duration * splitRatio);

            const sub1 = { ...sub, endTime: splitTime, text: part1Text };
            const sub2 = { ...sub, id: `split-${Date.now()}`, startTime: splitTime, text: part2Text };

            sub1.words = splitTextToWords(sub1.text, sub1.startTime, sub1.endTime);
            sub2.words = splitTextToWords(sub2.text, sub2.startTime, sub2.endTime);

            const newSubs = [...prev];
            newSubs.splice(index, 1, sub1, sub2);
            return newSubs;
        });
    };

    // 2. For TimelineEditor (Time-based & ID-based)
    const handleUpdateSubtitleTimes = (id: string, newStart: number, newEnd: number) => {
        updateSubtitlesWithHistory(prev => prev.map(s => s.id === id ? { ...s, startTime: newStart, endTime: newEnd } : s));
    };

    const handleDeleteSubtitle = (id: string) => {
        updateSubtitlesWithHistory(prev => prev.filter(s => s.id !== id));
    };

    const handleToggleExclude = (id: string) => {
        if (isCutMode) {
            setExcludedSubtitleIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) newSet.delete(id);
                else newSet.add(id);
                return newSet;
            });
        }
    };

    const handleSplitByTime = (id: string, time: number) => {
        updateSubtitlesWithHistory(prev => {
            const index = prev.findIndex(s => s.id === id);
            if (index === -1) return prev;

            const sub = prev[index];
            if (time <= sub.startTime || time >= sub.endTime) return prev;

            // Find the closest word boundary to split the text
            const words = splitTextToWords(sub.text, sub.startTime, sub.endTime);
            let splitWordIndex = -1;
            for (let i = 0; i < words.length; i++) {
                if (words[i].startTime >= time) {
                    splitWordIndex = i;
                    break;
                }
            }

            let part1Text = sub.text;
            let part2Text = '';
            let splitTime = time;

            if (splitWordIndex !== -1) {
                // Split at word boundary
                part1Text = words.slice(0, splitWordIndex).map(w => w.text).join(' ');
                part2Text = words.slice(splitWordIndex).map(w => w.text).join(' ');
                splitTime = words[splitWordIndex].startTime; // Use word's start time for split
            } else {
                // Fallback to character split if no clear word boundary or words array is empty
                const charIndex = Math.round((time - sub.startTime) / (sub.endTime - sub.startTime) * sub.text.length);
                part1Text = sub.text.substring(0, charIndex).trim();
                part2Text = sub.text.substring(charIndex).trim();
            }

            // Ensure both parts have text
            if (!part1Text && !part2Text) return prev;

            const updatedCurrent = {
                ...sub,
                text: part1Text,
                endTime: splitTime,
                words: splitTextToWords(part1Text, sub.startTime, splitTime)
            };

            const newNext = {
                ...sub,
                id: `split-${Date.now()}`,
                startTime: splitTime,
                endTime: sub.endTime,
                text: part2Text,
                words: splitTextToWords(part2Text, splitTime, sub.endTime)
            };

            const newPrev = [...prev];
            newPrev[index] = updatedCurrent;
            newPrev.splice(index + 1, 0, newNext);
            return newPrev;
        });
    };

    const handleMergeNext = (sub: Subtitle) => {
        setSubtitles(prev => {
            const index = prev.findIndex(s => s.id === sub.id);
            if (index < prev.length - 1) {
                const nextSub = prev[index + 1];
                const mergedText = (sub.text + ' ' + nextSub.text).trim();
                const mergedEndTime = nextSub.endTime;
                const updatedCurrent = { ...sub, text: mergedText, endTime: mergedEndTime };
                const newPrev = prev.filter(s => s.id !== nextSub.id);
                const newIndex = newPrev.findIndex(s => s.id === sub.id); // Re-find index
                if (newIndex !== -1) newPrev[newIndex] = updatedCurrent;
                return newPrev;
            }
            return prev;
        });
    };

    const handleMergePrev = (sub: Subtitle) => {
        setSubtitles(prev => {
            const index = prev.findIndex(s => s.id === sub.id);
            if (index > 0) {
                const prevSub = prev[index - 1];
                const mergedText = (prevSub.text + ' ' + sub.text).trim();
                const mergedEndTime = sub.endTime;
                const updatedPrev = { ...prevSub, text: mergedText, endTime: mergedEndTime };
                const newPrev = prev.filter(s => s.id !== sub.id);
                const newIndex = newPrev.findIndex(s => s.id === prevSub.id); // Re-find
                if (newIndex !== -1) newPrev[newIndex] = updatedPrev;
                return newPrev;
            }
            return prev;
        });
    };


    // Word Menu Font Handlers
    const handleWordFontFamilyChange = (font: string, scope: 'word' | 'subtitle' | 'all') => {
        if (!activeWordMenu) return;
        updateSubtitlesWithHistory(prev => {
            if (scope === 'all') {
                return prev.map(s => ({ ...s, fontFamily: font }));
            } else if (scope === 'subtitle') {
                return prev.map(s => s.id === activeWordMenu.subtitleId ? { ...s, fontFamily: font } : s);
            } else {
                // 'word' scope - apply to word level (if words exist)
                return prev.map(s => {
                    if (s.id === activeWordMenu.subtitleId) {
                        // For now, apply to the whole subtitle since individual word styling is complex
                        // Could extend words[] with fontFamily per-word in future
                        return { ...s, fontFamily: font };
                    }
                    return s;
                });
            }
        });
    };

    const handleWordFontSizeChange = (size: string, scope: 'word' | 'subtitle' | 'all') => {
        if (!activeWordMenu) return;
        updateSubtitlesWithHistory(prev => {
            if (scope === 'all') {
                return prev.map(s => ({ ...s, fontSize: size }));
            } else if (scope === 'subtitle') {
                return prev.map(s => s.id === activeWordMenu.subtitleId ? { ...s, fontSize: size } : s);
            } else {
                return prev.map(s => {
                    if (s.id === activeWordMenu.subtitleId) {
                        return { ...s, fontSize: size };
                    }
                    return s;
                });
            }
        });
    };

    const handleWordColorChange = (color: string, scope: 'word' | 'subtitle' | 'all') => {
        if (!activeWordMenu) return;
        updateSubtitlesWithHistory(prev => {
            if (scope === 'all') {
                return prev.map(s => ({ ...s, color: color }));
            } else if (scope === 'subtitle') {
                return prev.map(s => s.id === activeWordMenu.subtitleId ? { ...s, color: color } : s);
            } else {
                return prev.map(s => {
                    if (s.id === activeWordMenu.subtitleId) {
                        return { ...s, color: color };
                    }
                    return s;
                });
            }
        });
    };

    // Close Q Drive when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isQDriveOpen && qDriveDrawerRef.current && !qDriveDrawerRef.current.contains(event.target as Node)) {
                setIsQDriveOpen(false);
            }
        };

        if (isQDriveOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isQDriveOpen]);

    // Overlay Interaction (Move & Resize)
    const handleOverlayPointerDown = (e: React.PointerEvent, clipId: string, type: 'move' | 'resize') => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target as Element;
        target.setPointerCapture(e.pointerId);

        const clip = videoClips.find(c => c.id === clipId);
        if (!clip) return;

        const currentPos = clip.previewPosition || { x: 50, y: 50 };
        const currentScale = clip.scale || 1;

        if (videoContainerRef.current) {
            const rect = videoContainerRef.current.getBoundingClientRect();

            // Calculate Center of the clip in pixels for Resize distance
            const centerX = rect.left + (rect.width * (currentPos.x / 100));
            const centerY = rect.top + (rect.height * (currentPos.y / 100));
            const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);

            resizeStartData.current = {
                startScale: currentScale,
                startDist: dist,
                startX: e.clientX,
                startY: e.clientY,
                startPos: { ...currentPos }
            };
        }

        if (type === 'resize') {
            setResizingOverlayId(clipId);
        } else {
            setDraggingOverlayId(clipId);
        }
    };

    const handleOverlayPointerMove = (e: React.PointerEvent) => {
        if (!videoContainerRef.current || !resizeStartData.current) return;
        const container = videoContainerRef.current;
        const rect = container.getBoundingClientRect();

        // 1. Handle Resizing
        if (resizingOverlayId) {
            const { startDist, startScale, startX, startY } = resizeStartData.current;

            // Only consider distance change for scaling, or use hybrid approach
            // Simple approach: Distance from center of OBJECT (not mouse start)
            // But we need the object center. Let's stick to the previous logic but using robust start data.
            // Recalculate center based on live updated position? No, use start pos.

            const clip = videoClips.find(c => c.id === resizingOverlayId);
            if (clip) {
                const center = clip.previewPosition || { x: 50, y: 50 };
                const centerX = rect.left + (rect.width * (center.x / 100));
                const centerY = rect.top + (rect.height * (center.y / 100));
                const curDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);

                const scaleFactor = curDist / startDist;
                const newScale = Math.max(0.1, startScale * scaleFactor);

                setVideoClips(prev => prev.map(c =>
                    c.id === resizingOverlayId ? { ...c, scale: newScale } : c
                ));
            }
            return;
        }

        // 2. Handle Moving (Delta-based)
        if (draggingOverlayId) {
            const { startX, startY, startPos } = resizeStartData.current;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            // Convert Pixel Delta to Percentage
            const deltaPercentX = (deltaX / rect.width) * 100;
            const deltaPercentY = (deltaY / rect.height) * 100;

            const newX = startPos.x + deltaPercentX;
            const newY = startPos.y + deltaPercentY;

            // Clamp values (allow slight overdraw for ease)
            // Relaxed clamping to allow moving off-screen
            const clampedX = Math.max(-100, Math.min(200, newX));
            const clampedY = Math.max(-100, Math.min(200, newY));

            setVideoClips(prev => prev.map(c =>
                c.id === draggingOverlayId
                    ? { ...c, previewPosition: { x: clampedX, y: clampedY } }
                    : c
            ));
        }
    };

    const handleOverlayPointerUp = (e: React.PointerEvent) => {
        (e.target as Element).releasePointerCapture(e.pointerId);
        setDraggingOverlayId(null);
        setResizingOverlayId(null);
        resizeStartData.current = null;
    };

    // Handle overlay drag/resize at document level to avoid infinite re-render loops
    useEffect(() => {
        if (!draggingOverlayId && !resizingOverlayId) return;

        const handleDocumentPointerMove = (e: PointerEvent) => {
            if (!videoContainerRef.current || !resizeStartData.current) return;
            const container = videoContainerRef.current;
            const rect = container.getBoundingClientRect();

            // Handle Resizing
            if (resizingOverlayId) {
                const { startDist, startScale } = resizeStartData.current;
                const clip = videoClips.find(c => c.id === resizingOverlayId);
                if (clip) {
                    const center = clip.previewPosition || { x: 50, y: 50 };
                    const centerX = rect.left + (rect.width * (center.x / 100));
                    const centerY = rect.top + (rect.height * (center.y / 100));
                    const curDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
                    const scaleFactor = curDist / startDist;
                    const newScale = Math.max(0.1, startScale * scaleFactor);

                    setVideoClips(prev => prev.map(c =>
                        c.id === resizingOverlayId ? { ...c, scale: newScale } : c
                    ));
                }
                return;
            }

            // Handle Moving
            if (draggingOverlayId) {
                const { startX, startY, startPos } = resizeStartData.current;
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                const deltaPercentX = (deltaX / rect.width) * 100;
                const deltaPercentY = (deltaY / rect.height) * 100;
                const newX = startPos.x + deltaPercentX;
                const newY = startPos.y + deltaPercentY;
                const clampedX = Math.max(-100, Math.min(200, newX));
                const clampedY = Math.max(-100, Math.min(200, newY));

                setVideoClips(prev => prev.map(c =>
                    c.id === draggingOverlayId
                        ? { ...c, previewPosition: { x: clampedX, y: clampedY } }
                        : c
                ));
            }
        };

        const handleDocumentPointerUp = () => {
            setDraggingOverlayId(null);
            setResizingOverlayId(null);
            resizeStartData.current = null;
        };

        document.addEventListener('pointermove', handleDocumentPointerMove);
        document.addEventListener('pointerup', handleDocumentPointerUp);

        return () => {
            document.removeEventListener('pointermove', handleDocumentPointerMove);
            document.removeEventListener('pointerup', handleDocumentPointerUp);
        };
    }, [draggingOverlayId, resizingOverlayId, videoClips]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black font-sans text-gray-900 dark:text-gray-100 flex flex-col">
            <Header />

            {/* Custom Animations Styles */}
            <style jsx global>{`
                /* 1. Fade In */
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade {
                    animation: fadeIn 0.4s ease-out forwards;
                }

                /* 2. Pop Up (Scale) - Fast & Snappy (CapCut style) */
                @keyframes popIn {
                    0% { transform: scale(0.8); opacity: 0; }
                    60% { transform: scale(1.05); }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-pop {
                    animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                }

                /* 3. Slide Up */
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slideUp 0.4s ease-out forwards;
                }

                /* 4. Slide Down */
                @keyframes slideDown {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-down {
                    animation: slideDown 0.4s ease-out forwards;
                }

                /* 5. Typewriter */
                @keyframes typewriter {
                    from { width: 0; }
                    to { width: 100%; }
                }
                .animate-typewriter {
                    animation: typewriter 1.5s steps(40, end) forwards;
                }

                /* 6. Neon Pulse */
                @keyframes neon {
                    0%, 100% {
                        text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 20px #e60073, 0 0 30px #e60073, 0 0 40px #e60073;
                    }
                    50% {
                        text-shadow: 0 0 10px #fff, 0 0 20px #ff4da6, 0 0 30px #ff4da6, 0 0 40px #ff4da6, 0 0 50px #ff4da6;
                    }
                }
                .animate-neon {
                    animation: neon 1.5s infinite alternate;
                    color: #fff;
                }

                /* 7. Shake */
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                    20%, 40%, 60%, 80% { transform: translateX(5px); }
                }
                .animate-shake {
                    animation: shake 0.6s ease-in-out;
                }

                /* 8. Zoom Out (Start big, shrink to normal) */
                @keyframes zoomOut {
                    from { transform: scale(1.5); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-zoom-out {
                    animation: zoomOut 0.5s ease-out forwards;
                }

                /* 9. Blur Reveal */
                @keyframes blurReveal {
                    from { filter: blur(15px); opacity: 0; }
                    to { filter: blur(0); opacity: 1; }
                }
                .animate-blur {
                    animation: blurReveal 0.5s ease-out forwards;
                }

                /* 10. 3D Flip */
                @keyframes flipIn {
                    0% { transform: perspective(400px) rotateX(90deg); opacity: 0; }
                    40% { transform: perspective(400px) rotateX(-15deg); }
                    70% { transform: perspective(400px) rotateX(15deg); }
                    100% { transform: perspective(400px) rotateX(0deg); opacity: 1; }
                }
                .animate-flip {
                    animation: flipIn 0.7s ease-out forwards;
                    backface-visibility: visible;
                }

                /* 11. Slide In Right (for panel) */
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .animate-slide-in-right {
                    animation: slideInRight 0.3s ease-out forwards;
                }
            `}</style>



            <div className="max-w-[1920px] mx-auto w-full p-4 md:p-6 lg:p-8 min-h-[calc(100vh-64px)] relative">

                {/* Q Drive Drawer - Slide Out (Right Side) */}
                <div
                    ref={qDriveDrawerRef}
                    className={`fixed right-0 top-[64px] bottom-0 w-80 bg-white/95 dark:bg-black/95 backdrop-blur-xl shadow-2xl z-[100] transform transition-transform duration-300 ease-in-out border-l border-gray-200 dark:border-zinc-800 ${isQDriveOpen ? 'translate-x-0' : 'translate-x-full'}`}
                >
                    <QDriveSidebar
                        onDragStart={handleQDriveDragStart}
                        onClose={() => setIsQDriveOpen(false)}
                    />

                    {/* Toggle Handle (Visible when closed) - Minimalist Tab on Right Edge - Absolute Top (adjusted 5px down) */}
                    {!isQDriveOpen && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent immediate closing
                                setIsQDriveOpen(true);
                            }}
                            className="absolute -left-8 top-[1px] w-8 h-10 bg-white dark:bg-zinc-800 rounded-l-lg shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.1)] border border-r-0 border-gray-100 dark:border-zinc-700 flex items-center justify-center group z-50 overflow-hidden"
                            title="Q Drive 열기"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="font-extrabold text-lg text-indigo-600 dark:text-indigo-400">Q</span>
                        </button>
                    )}
                </div>

                <div className="flex gap-4 items-start pl-0 transition-all duration-300">
                    {/* LEFT COLUMN: Video Preview - Sticky */}
                    <div className="flex flex-col gap-4 flex-shrink-0 sticky top-24">
                        {/* Fixed Height Container for Video */}
                        <div className="flex flex-col gap-4">
                            {/* Video Player - Adjusted height to prevent scrolling */}
                            <div
                                ref={videoContainerRef}
                                className={`relative bg-black rounded-xl overflow-hidden shadow-xl border flex-shrink-0 transition-all ${isDragOver ? 'border-indigo-500 border-2 ring-4 ring-indigo-500/30' : 'border-gray-800'}`}
                                style={{ height: 'calc(100vh - 200px)', width: 'calc((100vh - 200px) * 9 / 16)' }}
                                onDragEnter={handleDragEnter}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                {/* Drag Overlay */}
                                {isDragOver && (
                                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-indigo-500/20 backdrop-blur-sm">
                                        <div className="bg-white dark:bg-zinc-800 px-6 py-4 rounded-xl shadow-lg text-center">
                                            <Upload className="h-8 w-8 mx-auto mb-2 text-indigo-500" />
                                            <p className="font-bold text-gray-900 dark:text-white">파일을 여기에 놓으세요</p>
                                            <p className="text-sm text-gray-500">영상 또는 음성 파일</p>
                                        </div>
                                    </div>
                                )}
                                {/* Upload Loading Overlay */}
                                {isUploading && (
                                    <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mb-3"></div>
                                        <p className="text-white font-bold">영상을 안전하게 저장 중...</p>
                                        <p className="text-xs text-white/70 mt-1">대용량 파일은 시간이 걸릴 수 있습니다</p>
                                    </div>
                                )}
                                {videoUrl ? (
                                    <>
                                        {/* Multi-Track Video Renderer */}
                                        <div ref={videoContainerRef} className="relative w-full h-full bg-black">
                                            {/* CANVAS DISPLAY: Vertical 9:16 for Shorts */}
                                            <canvas
                                                ref={canvasRef}
                                                width={1080}
                                                height={1920}
                                                className="absolute inset-0 w-full h-full object-contain"
                                                style={{ zIndex: 1 }}
                                            />

                                            {/* HIDDEN VIDEO POOL (Sources) */}
                                            <div style={{ display: 'none' }}>
                                                {/* Main Video (Layer 0) */}
                                                <video
                                                    ref={(el) => {
                                                        mainVideoRef.current = el;
                                                        if (el && !mainVideoElement) setMainVideoElement(el);
                                                    }}
                                                    crossOrigin="anonymous"
                                                    src={videoUrl ? (videoUrl.startsWith('http') ? `/api/proxy-video?url=${encodeURIComponent(videoUrl)}` : videoUrl) : ''}
                                                    preload="auto"
                                                    muted={audioClips.length > 0 || videoClips.some(c => c.hasAudio && c.isAudioLinked === false)}
                                                    onTimeUpdate={(e) => {
                                                        const t = e.currentTarget.currentTime;
                                                        setPlaybackTime(t);
                                                    }}
                                                    onLoadedMetadata={(e) => {
                                                        const dur = e.currentTarget.duration;
                                                        // CRITICAL: Set duration for timeline and waveform
                                                        if (dur && dur > 0) {
                                                            setDuration(dur);
                                                        }
                                                        if (!hasInitializedClips.current) {
                                                            setVideoClips([{
                                                                id: `clip-${Date.now()}`,
                                                                startTime: 0,
                                                                endTime: dur,
                                                                sourceStart: 0,
                                                                sourceEnd: dur,
                                                                layer: 0,
                                                                ratio: e.currentTarget.videoWidth / e.currentTarget.videoHeight,
                                                                scale: 1, // Default scale
                                                                src: videoUrl || '' // Use original URL, not proxy URL
                                                            }]);
                                                            hasInitializedClips.current = true;
                                                        }
                                                    }}
                                                />
                                                {/* Overlay Videos (Layer > 0) */}
                                                {videoClips
                                                    .filter(c => (c.layer || 0) > 0 && c.src)
                                                    .map(clip => {
                                                        const src = clip.src?.startsWith('http')
                                                            ? `/api/proxy-video?url=${encodeURIComponent(clip.src)}`
                                                            : clip.src;

                                                        return (
                                                            <video
                                                                key={clip.id}
                                                                ref={el => {
                                                                    if (el) hiddenVideoRefs.current.set(clip.id, el);
                                                                    else hiddenVideoRefs.current.delete(clip.id);
                                                                }}
                                                                crossOrigin="anonymous"
                                                                src={src}
                                                                className="hidden"
                                                                preload="auto"
                                                                muted={!!clip.isMuted || clip.isAudioLinked === false || audioClips.length > 0}
                                                                playsInline
                                                                onLoadedData={(e) => {
                                                                    // Seek to first frame immediately for preview
                                                                    const video = e.currentTarget;
                                                                    video.currentTime = clip.sourceStart || 0;
                                                                    console.log('[V2 Preload] First frame ready:', clip.id);
                                                                }}
                                                                onLoadedMetadata={(e) => {
                                                                    const ratio = e.currentTarget.videoWidth / e.currentTarget.videoHeight;
                                                                    if (ratio && (!clip.ratio || Math.abs(clip.ratio - ratio) > 0.01)) {
                                                                        setVideoClips(prev => prev.map(c => c.id === clip.id ? { ...c, ratio: ratio } : c));
                                                                    }
                                                                }}
                                                            />
                                                        );
                                                    })
                                                }
                                            </div>


                                            {/* Placeholder: Overlay Interaction moved outside (see below) */}

                                            {/* CapCut Style: Click on preview does NOT toggle play. Use Play Button instead. */}
                                            {/* Removed: togglePlay on click layer */}
                                        </div>
                                        {/* Subtitle Overlay - Draggable */}
                                        <div
                                            className="absolute inset-0 pointer-events-none z-[1000]"
                                            onMouseMove={handleSubtitleDrag}
                                            onMouseUp={handleSubtitleDragEnd}
                                            onMouseLeave={handleSubtitleDragEnd}
                                            onTouchMove={handleSubtitleDrag}
                                            onTouchEnd={handleSubtitleDragEnd}
                                        >
                                            {currentSubtitle && (
                                                <div
                                                    key={currentSubtitle.id}
                                                    className={`absolute cursor-move select-none pointer-events-auto text-white flex justify-center items-center ${isDragging || isResizing ? 'ring-2 ring-indigo-400 ring-offset-2 rounded-lg' : ''}`}
                                                    style={{
                                                        left: `${subtitlePosition.x}%`,
                                                        top: `${subtitlePosition.y}%`,
                                                        transform: 'translate(-50%, -50%)',
                                                        width: `${subtitleWidth}%`,
                                                        maxWidth: '95%',
                                                    }}
                                                    onMouseDown={handleSubtitleDragStart}
                                                    onTouchStart={handleSubtitleDragStart}
                                                >
                                                    <div
                                                        key={`anim-${currentSubtitle.id}-${currentSubtitle.animation}`}
                                                        className={`w-full px-3 py-2 rounded-lg font-medium leading-relaxed ${showSubtitleBackground ? 'bg-black/70 backdrop-blur-sm shadow-lg border border-white/20' : ''}`}
                                                        style={{
                                                            color: currentSubtitle.color || 'white',
                                                            fontSize: currentSubtitle.fontSize ? `${currentSubtitle.fontSize}px` : undefined,
                                                            ...getSubtitleFontFamilyStyle(currentSubtitle),
                                                            ...(!showSubtitleBackground ? {
                                                                WebkitTextStroke: '3px rgba(0,0,0,0.6)',
                                                                paintOrder: 'stroke fill',
                                                                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                                            } : {})
                                                        }}
                                                    >
                                                        {currentSubtitle.words && currentSubtitle.words.length > 0 ? (
                                                            currentSubtitle.words.map((word, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className={`inline-block mx-1 ${word.animation ? getSubtitleAnimationClass({ animation: word.animation } as any) : ''}`}
                                                                    style={{
                                                                        animationDuration: word.animationDuration ? `${word.animationDuration}s` : undefined,
                                                                        animationDelay: word.animation ? `${Math.max(0, word.startTime - currentSubtitle.startTime)}s` : undefined,
                                                                        animationFillMode: 'both'
                                                                    }}
                                                                >
                                                                    {word.text}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span
                                                                className={getSubtitleAnimationClass(currentSubtitle)}
                                                                style={{
                                                                    animationDuration: currentSubtitle.animationDuration ? `${currentSubtitle.animationDuration}s` : undefined
                                                                }}
                                                            >
                                                                {currentSubtitle.text}
                                                            </span>
                                                        )}
                                                        {currentSubtitle.translatedText && (
                                                            <div className="text-yellow-300 mt-1 text-sm font-medium text-center">
                                                                {currentSubtitle.translatedText}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {/* Play Button Overlay (when paused) */}
                                        {!isPlaying && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                                                <div className="bg-white/20 backdrop-blur-md p-4 rounded-full">
                                                    <Play className="h-8 w-8 text-white fill-current" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Replace Video Button (Top-Right) */}
                                        <div className="absolute top-4 right-4 z-[1001]">
                                            <label className="flex items-center gap-2 px-3 py-1.5 bg-black/50 hover:bg-black/70 backdrop-blur-md text-white rounded-lg text-xs font-bold cursor-pointer transition-colors border border-white/20">
                                                <RefreshCw className="h-3.5 w-3.5" />
                                                영상 교체
                                                <input
                                                    type="file"
                                                    accept="video/*"
                                                    className="hidden"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            if (await requestConfirm('영상을 교체하시겠습니까?\n(기존 작업 내용은 유지됩니다)')) {
                                                                handleFileUpload(e);
                                                            }
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>

                                        {/* OVERLAY INTERACTION LAYER (TOP OF Z-STACK - z-3000) */}
                                        <div className="absolute inset-0 z-[3000] pointer-events-none">
                                            {videoClips
                                                .filter(c => (c.layer || 0) >= 0 && playbackTime >= c.startTime && playbackTime < c.endTime)
                                                .map(clip => {
                                                    const position = clip.previewPosition || { x: 50, y: 50 };
                                                    const scale = clip.scale || 1;
                                                    const isSelected = draggingOverlayId === clip.id || resizingOverlayId === clip.id;

                                                    // V1 (layer 0): Always cover full container since it's the background video
                                                    // V2+ (overlays): Calculate based on aspect ratio
                                                    let sizeStyle: React.CSSProperties = {};

                                                    if ((clip.layer || 0) === 0) {
                                                        // V1: Full container coverage
                                                        sizeStyle = { width: '100%', height: '100%' };
                                                    } else {
                                                        // V2+: Calculate based on aspect ratio
                                                        const containerAspect = 9 / 16;
                                                        let clipAspect = clip.ratio;
                                                        if (!clipAspect) {
                                                            const videoEl = hiddenVideoRefs.current?.get(clip.id);
                                                            clipAspect = videoEl ? (videoEl.videoWidth / videoEl.videoHeight) : (16 / 9);
                                                        }

                                                        if (clipAspect > containerAspect) {
                                                            sizeStyle = { width: '100%', height: 'auto', aspectRatio: `${clipAspect}` };
                                                        } else {
                                                            sizeStyle = { height: '100%', width: 'auto', aspectRatio: `${clipAspect}` };
                                                        }
                                                    }

                                                    return (
                                                        <div
                                                            key={clip.id}
                                                            onPointerDown={(e) => {
                                                                console.log("[Overlay Click] Clip:", clip.id);
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleOverlayPointerDown(e, clip.id, 'move');
                                                            }}
                                                            className="absolute group bg-transparent pointer-events-auto cursor-move select-none"
                                                            style={{
                                                                left: `${position.x}%`,
                                                                top: `${position.y}%`,
                                                                transform: `translate(-50%, -50%) scale(${scale})`,
                                                                zIndex: isSelected ? 3002 : 3001,
                                                                maxWidth: 'none',
                                                                maxHeight: 'none',
                                                                ...sizeStyle
                                                            }}
                                                        >
                                                            {/* Visual Border Box (CapCut Style) */}
                                                            <div className={`w-full h-full border-2 transition-colors relative ${isSelected ? 'border-white bg-white/10' : 'border-transparent hover:border-white/50'}`}>
                                                                {isSelected && (
                                                                    <>
                                                                        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white rounded-full shadow-sm" />
                                                                        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white rounded-full shadow-sm" />
                                                                        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white rounded-full shadow-sm" />
                                                                        <div
                                                                            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white rounded-full shadow-sm cursor-nwse-resize pointer-events-auto"
                                                                            onPointerDown={(e) => {
                                                                                console.log("[Resize Handle] Clip:", clip.id);
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                handleOverlayPointerDown(e, clip.id, 'resize');
                                                                            }}
                                                                        />
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                        <VideoIcon className="h-12 w-12 mb-3 opacity-50" />
                                        <p className="font-medium text-sm">영상을 업로드해주세요</p>
                                        <p className="text-xs mt-1 opacity-60">MP4, MOV supported</p>
                                        <label className="mt-4 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold text-sm cursor-pointer transition-colors shadow-lg shadow-indigo-500/30">
                                            파일 선택
                                            <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Timeline & Tools */}
                    <div className="flex-1 min-w-0 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm relative">
                        {/* Sticky Toolbar Wrapper */}
                        {/* Sticky Toolbar Wrapper */}
                        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-gray-100 dark:border-zinc-800 rounded-t-2xl transition-all duration-300">
                            {/* Toolbar */}
                            <div className="flex flex-col border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                                {/* ROW 1: Header & Formatting Controls */}
                                <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between p-3 pb-1 gap-3">
                                    {/* Left: Title & Input */}
                                    <div className="flex items-center gap-3">
                                        <h2 className="font-bold text-lg flex items-center gap-2 text-indigo-600">
                                            Timeline
                                        </h2>
                                        <button
                                            onClick={() => setIsInputPanelOpen(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                                        >
                                            <FileText className="h-3.5 w-3.5" />
                                            📝 대본 입력
                                            {(scriptText || audioFile) && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                                        </button>
                                    </div>

                                    {/* Right: Formatting Tools */}
                                    <div className="flex flex-wrap items-center gap-2 justify-end w-full xl:w-auto">
                                        {/* Time Offsets */}
                                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 rounded-lg p-1">
                                            <button onClick={() => applyOffset(-0.5)} className="px-2 py-1 text-xs font-bold rounded hover:bg-white dark:hover:bg-zinc-700">-0.5s</button>
                                            <button onClick={() => applyOffset(-0.1)} className="px-2 py-1 text-xs font-bold rounded hover:bg-white dark:hover:bg-zinc-700">-0.1s</button>
                                            <button onClick={() => applyOffset(0.1)} className="px-2 py-1 text-xs font-bold rounded hover:bg-white dark:hover:bg-zinc-700">+0.1s</button>
                                            <button onClick={() => applyOffset(0.5)} className="px-2 py-1 text-xs font-bold rounded hover:bg-white dark:hover:bg-zinc-700">+0.5s</button>
                                        </div>

                                        {/* Effect */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:inline">Effect:</span>
                                            <select
                                                value={animationStyle}
                                                onChange={(e) => {
                                                    const newStyle = e.target.value;
                                                    setAnimationStyle(newStyle);
                                                    setSubtitles(prev => prev.map(s => ({ ...s, animation: newStyle })));
                                                }}
                                                className="h-8 rounded-lg border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold focus:ring-indigo-500 focus:border-indigo-500"
                                            >
                                                {ANIMATION_STYLES.map(style => (
                                                    <option key={style.id} value={style.id}>{style.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* BG Toggle */}
                                        <button
                                            onClick={() => setShowSubtitleBackground(!showSubtitleBackground)}
                                            className={`h-8 px-3 rounded-lg text-xs font-bold transition-colors ${showSubtitleBackground
                                                ? 'bg-gray-800 text-white'
                                                : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300'}`}
                                        >
                                            {showSubtitleBackground ? '배경 ON' : '배경 OFF'}
                                        </button>

                                        {/* Position */}
                                        <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden h-8">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setSubtitlePosition(prev => ({ ...prev, x: 50 }));
                                                }}
                                                className="h-full px-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                                                title="중앙 정렬"
                                            >
                                                ↔️
                                            </button>
                                            <div className="flex items-center gap-1 px-2 border-l border-gray-200 dark:border-zinc-700 h-full">
                                                <span className="text-xs text-gray-500">Y:</span>
                                                <input
                                                    type="number"
                                                    min={yUnit === 'percent' ? 0 : 0}
                                                    max={yUnit === 'percent' ? 100 : (videoRef.current?.videoHeight || 2000)}
                                                    value={Math.round(yUnit === 'percent' ? subtitlePosition.y : (subtitlePosition.y / 100) * (videoRef.current?.videoHeight || 0))}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value);
                                                        if (yUnit === 'percent') {
                                                            setSubtitlePosition(prev => ({ ...prev, y: Math.max(0, Math.min(100, val)) }));
                                                        } else {
                                                            const height = videoRef.current?.videoHeight || 0;
                                                            if (height > 0) {
                                                                const percent = (val / height) * 100;
                                                                setSubtitlePosition(prev => ({ ...prev, y: Math.max(0, Math.min(100, percent)) }));
                                                            }
                                                        }
                                                    }}
                                                    className="w-12 h-full px-1 text-xs text-center border-none bg-transparent focus:ring-0"
                                                />
                                                <button
                                                    onClick={() => setYUnit(prev => prev === 'percent' ? 'px' : 'percent')}
                                                    className="text-[10px] bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 px-1 py-0.5 rounded text-gray-500 dark:text-gray-400 min-w-[20px]"
                                                >
                                                    {yUnit === 'percent' ? '%' : 'px'}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-1 px-2 border-l border-gray-200 dark:border-zinc-700 h-full">
                                                <span className="text-xs text-gray-500">W:</span>
                                                <input
                                                    type="range"
                                                    min="30"
                                                    max="95"
                                                    step="5"
                                                    value={subtitleWidth}
                                                    onChange={(e) => setSubtitleWidth(Number(e.target.value))}
                                                    className="w-12 h-4 accent-indigo-600 cursor-pointer"
                                                    title="자막 너비"
                                                />
                                                <span className="text-xs text-gray-400 w-6 text-right">{subtitleWidth}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ROW 2: Action Buttons */}
                                <div className="flex flex-wrap items-center justify-end p-3 pt-1 gap-2">
                                    <button
                                        onClick={handleGenerateSubtitles}
                                        disabled={isGenerating || !videoFile}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                                    >
                                        {isGenerating ? <span className="animate-spin">🌀</span> : <Wand2 className="h-3.5 w-3.5" />}
                                        AI 자막
                                    </button>

                                    <button
                                        onClick={async () => {
                                            if (await requestConfirm('현재 작업을 모두 비우시겠습니까?\n(되돌릴 수 없습니다)')) {
                                                setVideoUrl(null);
                                                setVideoFile(null);
                                                setAudioFile(null);
                                                setSubtitles([]);
                                                setVideoClips([]);
                                                setScriptText('');
                                                setAssets({});
                                                setHistory([{ subtitles: [], videoClips: [] }]);
                                                setHistoryIndex(0);
                                                localStorage.removeItem(STORAGE_KEY);
                                            }
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg font-bold text-sm transition-all shadow-md group"
                                        title="작업 비우기 (초기화)"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5 group-hover:-rotate-180 transition-transform duration-500" />
                                        초기화
                                    </button>

                                    <button
                                        onClick={() => setIsCutMode(!isCutMode)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm transition-all shadow-md ${isCutMode ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'}`}
                                    >
                                        <Scissors className="h-3.5 w-3.5" />
                                        컷편집
                                    </button>

                                    <button
                                        onClick={handleSmartSync}
                                        disabled={isSyncing || !subtitles.length}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                                    >
                                        <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                                        싱크 보정
                                    </button>

                                    <button
                                        onClick={() => isAudioSeparated ? relinkAllAudio() : separateAllAudio()}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm transition-all shadow-md ${isAudioSeparated
                                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
                                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'}`}
                                        title={isAudioSeparated ? "오디오 분리됨 (클릭하여 연결)" : "오디오 연결됨 (클릭하여 분리)"}
                                    >
                                        {isAudioSeparated ? <Unlink className="h-3.5 w-3.5" /> : <Link className="h-3.5 w-3.5" />}
                                        {isAudioSeparated ? '분리됨' : '연결됨'}
                                    </button>

                                    {/* Translation */}
                                    <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden h-8">
                                        <select
                                            value={selectedTranslationLang}
                                            onChange={(e) => setSelectedTranslationLang(e.target.value)}
                                            className="h-full px-2 text-xs font-medium border-none bg-transparent focus:ring-0"
                                        >
                                            {TRANSLATION_LANGUAGES.map(lang => (
                                                <option key={lang.id} value={lang.id}>{lang.label}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={handleTranslate}
                                            disabled={isTranslating || subtitles.length === 0}
                                            className="h-full px-3 font-bold text-xs border-l border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50"
                                        >
                                            번역
                                        </button>
                                    </div>

                                    {/* Global Style Controls */}
                                    <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-1 h-8">
                                        {/* Global Font Family */}
                                        <select
                                            className="h-full text-xs font-bold border-none bg-transparent focus:ring-0 w-24"
                                            onChange={(e) => {
                                                const newFont = e.target.value;
                                                setSubtitles(prev => prev.map(s => ({ ...s, fontFamily: newFont })));
                                            }}
                                            defaultValue="Pretendard"
                                        >
                                            <option value="" disabled>폰트 일괄</option>
                                            {FONT_FAMILIES.map(font => (
                                                <option key={font.id} value={font.id}>{font.label}</option>
                                            ))}
                                        </select>
                                        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700"></div>
                                        {/* Global Font Size */}
                                        <div className="flex items-center gap-1 w-20 px-2">
                                            <span className="text-[10px] text-gray-400 font-bold">T</span>
                                            <input
                                                type="number"
                                                min="5"
                                                max="200"
                                                className="h-6 w-full text-xs font-bold border-none bg-transparent focus:ring-0 p-0 text-center"
                                                placeholder="16"
                                                onChange={(e) => {
                                                    const newSize = e.target.value;
                                                    if (newSize) {
                                                        setSubtitles(prev => prev.map(s => ({ ...s, fontSize: newSize })));
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={requestVideoProcessing}
                                        disabled={isProcessing || !videoFile}
                                        className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/30 ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {isProcessing ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                                <span>처리 중...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Download className="h-4 w-4" />
                                                <span className="font-bold">영상 내보내기</span>
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={handleExport}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition-colors shadow-md"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        내보내기
                                    </button>
                                </div>
                            </div>

                            {/* Subtitle Table Toggle Button */}
                            <button
                                onClick={() => setIsSubtitleTableOpen(prev => !prev)}
                                className={`w-full flex items-center justify-center gap-2 py-2 border-b border-gray-100 dark:border-zinc-800 text-sm font-medium transition-colors ${subtitles.length > 0 || isSubtitleTableOpen
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                    : 'bg-gray-50 dark:bg-zinc-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                    }`}
                            >
                                {subtitles.length > 0 || isSubtitleTableOpen ? (
                                    <>
                                        <ChevronUp className="h-4 w-4" />
                                        자막 테이블 접기 ({subtitles.length}개)
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="h-4 w-4" />
                                        자막 테이블 펼치기
                                    </>
                                )}
                            </button>

                            {/* List Header - show when subtitles exist OR table is manually opened */}
                            {(subtitles.length > 0 || isSubtitleTableOpen) && (
                                <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-zinc-800 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-zinc-950/30">
                                    <div className="w-12 text-center">#</div>
                                    <div className="flex-1 pl-4">내용</div>
                                    <div className="w-24 text-center">효과</div>
                                    <div className="w-16 text-center">크기</div>
                                    <div className="w-24 text-center">폰트</div>
                                    <div className="w-12 text-center">{isCutMode ? 'ON/OFF' : '삭제'}</div>
                                </div>
                            )}
                        </div>

                        {/* Timeline List - show when subtitles exist OR table is manually opened */}
                        {(subtitles.length > 0 || isSubtitleTableOpen) ? (
                            <div className="p-2 space-y-1">
                                {subtitles.length === 0 ? (
                                    /* Empty state when table is manually opened */
                                    <div className="py-8 flex flex-col items-center justify-center text-gray-400">
                                        <Type className="h-8 w-8 mb-3 opacity-50" />
                                        <p className="text-sm mb-3">자막이 없습니다</p>
                                        <button
                                            onClick={() => {
                                                const newSubtitle = {
                                                    id: `sub-${Date.now()}`,
                                                    startTime: currentTime,
                                                    endTime: Math.min(currentTime + 3, duration || currentTime + 3),
                                                    text: '새 자막',
                                                };
                                                updateSubtitlesWithHistory([...subtitles, newSubtitle]);
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors"
                                        >
                                            <Plus className="h-4 w-4" />
                                            자막 추가
                                        </button>
                                    </div>
                                ) : (
                                    subtitles.map((sub, index) => (
                                        <SubtitleRow
                                            key={sub.id}
                                            sub={sub}
                                            index={index}
                                            isActive={currentTime >= sub.startTime && currentTime <= sub.endTime}
                                            isExcluded={excludedSubtitleIds.has(sub.id)}
                                            isCutMode={isCutMode}
                                            currentTime={currentTime}
                                            onSeek={handleTimelineSeek}
                                            onUpdate={handleUpdateSubtitleObject}
                                            onDelete={handleDeleteSubtitle}
                                            onToggleExclude={handleToggleExclude}
                                            onSplit={handleSplitByCursor}
                                            onMergeNext={handleMergeNext}
                                            onMergePrev={handleMergePrev}
                                            FONT_SIZES={FONT_SIZES}
                                            FONT_FAMILIES={FONT_FAMILIES}
                                            ANIMATION_STYLES={ANIMATION_STYLES}
                                            onHoverStart={(startTime, endTime, x, y) => {
                                                if (!isDragging && !isResizing && !isPlaying && !activeWordMenu) {
                                                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                                    hoverTimeoutRef.current = setTimeout(() => {
                                                        setHoveredSubtitle({
                                                            id: sub.id,
                                                            startTime: startTime,
                                                            endTime: endTime,
                                                            x,
                                                            y
                                                        });
                                                    }, 500);
                                                }
                                            }}
                                            onHoverEnd={() => {
                                                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                                setHoveredSubtitle(null);
                                            }}
                                            onWordClick={(word, startTime, endTime, x, y, wordIdx) => {
                                                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                                setHoveredSubtitle(null);

                                                // If already detail editing this subtitle, just switch the word
                                                if (detailEditState?.subtitleId === sub.id) {
                                                    setDetailEditState({
                                                        subtitleId: sub.id,
                                                        wordIndex: wordIdx
                                                    });
                                                    setActiveWordMenu(null);
                                                } else {
                                                    // Otherwise open the menu
                                                    setActiveWordMenu({
                                                        subtitleId: sub.id,
                                                        wordIndex: wordIdx,
                                                        word,
                                                        startTime,
                                                        endTime,
                                                        x,
                                                        y
                                                    });
                                                }
                                            }}
                                            // Detail Edit props
                                            audioUrl={videoUrl || undefined}
                                            isDetailMode={detailEditState?.subtitleId === sub.id}
                                            editingWordIndex={detailEditState?.subtitleId === sub.id ? detailEditState.wordIndex : undefined}
                                            onCloseDetail={() => setDetailEditState(null)}
                                            onWordUpdate={(word: any, start: number, end: number) => {
                                                if (detailEditState) handleWordSyncUpdate(detailEditState.subtitleId, detailEditState.wordIndex, start, end);
                                            }}
                                        />
                                    ))
                                )}
                            </div>
                        ) : null}

                        {/* Word Edit Menu Overlay */}
                        {activeWordMenu && (
                            <WordEditMenu
                                word={activeWordMenu.word}
                                startTime={activeWordMenu.startTime}
                                endTime={activeWordMenu.endTime}
                                currentAnimation={(() => {
                                    const sub = subtitles.find(s => s.id === activeWordMenu.subtitleId);
                                    if (sub && sub.words && sub.words[activeWordMenu.wordIndex]) {
                                        return sub.words[activeWordMenu.wordIndex].animation || 'none';
                                    }
                                    return sub?.animation || 'none';
                                })()}
                                currentDuration={(() => {
                                    const sub = subtitles.find(s => s.id === activeWordMenu.subtitleId);
                                    if (sub && sub.words && sub.words[activeWordMenu.wordIndex]) {
                                        return sub.words[activeWordMenu.wordIndex].animationDuration;
                                    }
                                    return sub?.animationDuration;
                                })()}
                                x={activeWordMenu.x}
                                y={activeWordMenu.y}
                                onClose={() => setActiveWordMenu(null)}
                                onAnimationChange={handleWordAnimationChange}
                                onDurationChange={handleWordDurationChange}
                                onReplaceVideo={handleReplaceVideoForWord}

                                // New prop for Vrew Menu
                                onDetailEdit={handleDetailEdit}
                                ANIMATION_STYLES={ANIMATION_STYLES}

                                // Font Settings
                                FONT_FAMILIES={FONT_FAMILIES}
                                FONT_SIZES={FONT_SIZES}
                                currentFontFamily={(() => {
                                    const sub = subtitles.find(s => s.id === activeWordMenu.subtitleId);
                                    return sub?.fontFamily || 'Pretendard';
                                })()}
                                currentFontSize={(() => {
                                    const sub = subtitles.find(s => s.id === activeWordMenu.subtitleId);
                                    return sub?.fontSize || '16';
                                })()}
                                currentColor={(() => {
                                    const sub = subtitles.find(s => s.id === activeWordMenu.subtitleId);
                                    return sub?.color || '#000000';
                                })()}
                                onFontFamilyChange={handleWordFontFamilyChange}
                                onFontSizeChange={handleWordFontSizeChange}
                                onColorChange={handleWordColorChange}
                            />
                        )}

                        {/* Hidden File Input for Video Replacement */}
                        <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            ref={hiddenFileInputRef}
                            onChange={handleFileSelectForReplace}
                        />

                        {/* Visual Timeline Section (Moved inside Right Column) */}
                        {videoUrl && (
                            <>
                                {/* Resizable Divider Handle - show when subtitle table is open */}
                                {(subtitles.length > 0 || isSubtitleTableOpen) && (
                                    <div
                                        className={`h-2 cursor-ns-resize flex items-center justify-center border-t border-gray-200 dark:border-zinc-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors ${isResizingTimeline ? 'bg-indigo-200 dark:bg-indigo-800' : 'bg-gray-100 dark:bg-zinc-800'}`}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            setIsResizingTimeline(true);
                                            resizeStartY.current = e.clientY;
                                            resizeStartHeight.current = timelineHeight;

                                            const handleMouseMove = (moveEvent: MouseEvent) => {
                                                const deltaY = resizeStartY.current - moveEvent.clientY; // Up = bigger
                                                const newHeight = Math.max(100, Math.min(600, resizeStartHeight.current + deltaY));
                                                setTimelineHeight(newHeight);
                                            };

                                            const handleMouseUp = () => {
                                                setIsResizingTimeline(false);
                                                window.removeEventListener('mousemove', handleMouseMove);
                                                window.removeEventListener('mouseup', handleMouseUp);
                                            };

                                            window.addEventListener('mousemove', handleMouseMove);
                                            window.addEventListener('mouseup', handleMouseUp);
                                        }}
                                    >
                                        <div className="w-8 h-1 bg-gray-300 dark:bg-zinc-600 rounded-full" />
                                    </div>
                                )}
                                <div
                                    className={`border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-b-2xl overflow-hidden ${!(subtitles.length > 0 || isSubtitleTableOpen) ? 'flex-1' : ''}`}
                                    style={(subtitles.length > 0 || isSubtitleTableOpen) ? { height: timelineHeight } : undefined}
                                >
                                    <TimelineEditor
                                        duration={duration}
                                        subtitles={subtitles}
                                        onUpdateSubtitle={(id, start, end) => {
                                            updateSubtitlesWithHistory(prev => prev.map(s =>
                                                s.id === id ? { ...s, startTime: start, endTime: end } : s
                                            ));
                                        }}
                                        onSeek={seek}
                                        excludedSubtitleIds={excludedSubtitleIds}
                                        onToggleExclude={handleToggleExclude}
                                        videoElement={mainVideoElement}
                                        currentTime={playbackTime}
                                        videoFileName={videoFile?.name}
                                        isPlaying={isPlaying}
                                        onPlayPause={togglePlay}
                                        onStartScrub={startScrub}
                                        onEndScrub={endScrub}
                                        onPreviewFrame={previewFrame}
                                        onSplitSubtitle={handleSplitByTime}
                                        onDeleteSubtitle={handleDeleteSubtitle}
                                        videoClips={videoClips}
                                        onUpdateVideoClips={updateVideoClipsWithHistory}
                                        audioClips={audioClips}
                                        onUpdateAudioClips={updateAudioClipsWithHistory}
                                        isAudioSeparated={isAudioSeparated}
                                        onFrameExtractionChange={(isExtracting) => {
                                            isExtractingFramesRef.current = isExtracting;
                                            if (isExtracting && videoRef.current) {
                                                videoRef.current.pause();
                                                setIsPlaying(false);
                                            }
                                        }}
                                        isCutMode={isCutMode}
                                        onDropFile={handleTimelineDrop}
                                        onUndo={handleUndo}
                                        onRedo={handleRedo}
                                        canUndo={historyIndex > 0}
                                        canRedo={historyIndex < history.length - 1}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
            {/* End of Main UI Container */}


            {/* Input Slide Panel */}
            {
                isInputPanelOpen && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() => setIsInputPanelOpen(false)}
                        />

                        {/* Panel */}
                        <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col animate-slide-in-right">
                            {/* Header */}
                            <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
                                <h3 className="font-bold text-lg">📝 대본 & 음성 입력</h3>
                                <button
                                    onClick={() => setIsInputPanelOpen(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
                                {/* Audio File Drop Zone */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        🎵 음성 파일 (선택)
                                    </label>
                                    <div
                                        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${audioFile
                                            ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                                            : 'border-gray-300 dark:border-zinc-700 hover:border-indigo-400'
                                            }`}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            const file = e.dataTransfer.files[0];
                                            if (file?.type.startsWith('audio/')) {
                                                setAudioFile(file);
                                            }
                                        }}
                                    >
                                        {audioFile ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="text-green-600 dark:text-green-400 font-medium">
                                                    ✓ {audioFile.name}
                                                </span>
                                                <button
                                                    onClick={() => setAudioFile(null)}
                                                    className="text-red-500 hover:text-red-700"
                                                >✕</button>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                                <p className="text-sm text-gray-500">드래그하거나 클릭하여 업로드</p>
                                                <label className="mt-2 inline-block px-4 py-2 bg-gray-100 dark:bg-zinc-800 rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700">
                                                    파일 선택
                                                    <input
                                                        type="file"
                                                        accept="audio/*"
                                                        className="hidden"
                                                        onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                                                    />
                                                </label>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Script Input */}
                                <div className="flex-1 flex flex-col space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        📝 원본 대본 (선택)
                                    </label>
                                    <textarea
                                        value={scriptText}
                                        onChange={(e) => setScriptText(e.target.value)}
                                        placeholder="대본이 있으면 입력해주세요. (없으면 자동으로 생성됩니다)&#10;&#10;Whisper + Gemini가 영상/음성과 싱크를 맞춰 자막을 생성합니다."
                                        className="flex-1 min-h-[200px] w-full p-4 bg-gray-50 dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm leading-relaxed"
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-gray-200 dark:border-zinc-800 flex gap-2">
                                <button
                                    onClick={() => setIsInputPanelOpen(false)}
                                    className="flex-1 py-3 bg-gray-100 dark:bg-zinc-800 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    닫기
                                </button>
                                <button
                                    onClick={() => {
                                        setIsInputPanelOpen(false);
                                        handleGenerateSubtitles();
                                    }}
                                    disabled={(!scriptText && !videoFile && !audioFile) || isGenerating}
                                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isGenerating ? (
                                        <><span className="animate-spin">🌀</span> 생성 중...</>
                                    ) : (
                                        <><Wand2 className="h-4 w-4" /> AI 자막 생성</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* Video Preview Tooltip (Global) */}
            {
                hoveredSubtitle && videoUrl && (
                    <VideoPreviewTooltip
                        src={videoUrl}
                        startTime={hoveredSubtitle.startTime}
                        endTime={hoveredSubtitle.endTime}
                        x={hoveredSubtitle.x}
                        y={hoveredSubtitle.y}
                    />
                )
            }
            {/* --- Apple Confirm Modal --- */}
            <AppleConfirmModal
                isOpen={confirmState.isOpen}
                message={confirmState.message}
                onConfirm={() => handleConfirmAction(true)}
                onCancel={() => handleConfirmAction(false)}
            />
            {/* Hidden Audio Engine */}
            <audio ref={audioRef} className="hidden" />
        </div >
    );
}

