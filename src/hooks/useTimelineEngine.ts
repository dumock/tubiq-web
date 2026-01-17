import { useEffect, useRef, useState, useCallback } from 'react';

interface VideoClip {
    id: string;
    startTime: number;
    endTime: number;
    sourceStart: number;
    sourceEnd: number;
    src?: string;
    layer?: number;
    hasAudio?: boolean;
    volume?: number;
}

interface UseTimelineEngineProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    videoClips: VideoClip[];
    onTimeUpdate: (time: number) => void;
    duration: number;
    shouldMuteVideo?: boolean;
}

// Helper: Apply proxy for CORS with http URLs
function getProxiedUrl(src: string | undefined): string {
    if (!src) return '';
    return src.startsWith('http')
        ? `/api/proxy-video?url=${encodeURIComponent(src)}`
        : src;
}

// Helper: Compare URLs (handles proxy vs original)
function isSameSource(currentSrc: string, targetSrc: string): boolean {
    if (!currentSrc || !targetSrc) return false;

    const extractOriginal = (url: string): string => {
        if (url.includes('/api/proxy-video?url=')) {
            const match = url.match(/url=([^&]+)/);
            if (match) return decodeURIComponent(match[1]);
        }
        return url;
    };

    const original1 = extractOriginal(currentSrc);
    const original2 = extractOriginal(targetSrc);

    try {
        const url1 = new URL(original1);
        const url2 = new URL(original2);
        return url1.pathname === url2.pathname;
    } catch {
        return original1 === original2;
    }
}

// Helper: Convert video time to timeline time
function videoTimeToTimelineTime(videoTime: number, clip: VideoClip): number {
    return clip.startTime + (videoTime - clip.sourceStart);
}

// Helper: Convert timeline time to video time
function timelineTimeToVideoTime(timelineTime: number, clip: VideoClip): number {
    return clip.sourceStart + (timelineTime - clip.startTime);
}

export function useTimelineEngine({ videoRef, videoClips, onTimeUpdate, duration, shouldMuteVideo = false }: UseTimelineEngineProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [isScrubbing, setIsScrubbing] = useState(false);

    // Track if we were playing before scrub started
    const wasPlayingBeforeScrub = useRef(false);

    // Track current active clip for time conversion
    const activeClipRef = useRef<VideoClip | null>(null);

    // Track when seek is in progress to prevent timeUpdate conflicts
    const isSeekingRef = useRef(false);

    // Track scrubbing state with ref to avoid closure issues
    const isScrubbingRef = useRef(false);

    // Find the active clip at a given timeline time
    const findActiveClip = useCallback((time: number): VideoClip | null => {
        return videoClips.find(clip =>
            time >= clip.startTime && time < clip.endTime &&
            (clip.layer === 0 || clip.layer === undefined)
        ) || null;
    }, [videoClips]);

    // =========================================================
    // HYBRID MODE: Video timeupdate drives timeline during playback
    // =========================================================
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            const videoTime = video.currentTime;
            const clip = activeClipRef.current;

            // DEBUG: Log every timeupdate
            console.log('[Engine] timeupdate fired. videoTime:', videoTime.toFixed(2),
                'paused:', video.paused, 'scrubbing:', isScrubbingRef.current,
                'clip:', clip?.id, 'clipEnd:', clip?.endTime?.toFixed(2));

            // Skip if scrubbing (use ref for real-time value)
            if (isScrubbingRef.current) return;

            // Skip if seeking (prevent jitter during click-to-seek)
            if (isSeekingRef.current) return;

            if (clip) {
                // Convert video time to timeline time
                const timelineTime = videoTimeToTimelineTime(videoTime, clip);

                // Check if we've reached the end of this clip (check both source and timeline time)
                // IMPORTANT: Check this BEFORE video.paused to handle natural video end
                const pastClipEnd = timelineTime >= clip.endTime || videoTime >= clip.sourceEnd;

                if (pastClipEnd) {
                    console.log('[Engine] CLIP END DETECTED - pausing video. timelineTime:', timelineTime, 'clip.endTime:', clip.endTime);

                    // FORCE STOP - pause immediately and mute
                    video.pause();
                    video.muted = true;
                    video.volume = 0;

                    // Find next clip that starts after this one (handle gaps)
                    const nextClip = videoClips
                        .filter(c => c.startTime >= clip.endTime && (c.layer === 0 || c.layer === undefined))
                        .sort((a, b) => a.startTime - b.startTime)[0];

                    if (nextClip) {
                        // Check if there's a gap between clips
                        const gapDuration = nextClip.startTime - clip.endTime;

                        if (gapDuration > 0.1) {
                            // There's a significant gap - need to ensure audio stops
                            console.log('[Engine] Gap detected:', gapDuration, 'seconds. Pausing for gap.');

                            // Keep video paused during gap
                            // Video is already paused from earlier in this function

                            // Set up the next clip
                            activeClipRef.current = nextClip;

                            // Jump timeline to next clip start immediately
                            setCurrentTime(nextClip.startTime);
                            onTimeUpdate(nextClip.startTime);

                            // Use microtask to ensure audio truly stops before resuming
                            setTimeout(() => {
                                if (nextClip.src) {
                                    const currentSrc = video.currentSrc || video.src;
                                    if (!isSameSource(currentSrc, nextClip.src)) {
                                        video.src = getProxiedUrl(nextClip.src);
                                    }
                                    video.currentTime = nextClip.sourceStart;
                                    video.muted = shouldMuteVideo || (nextClip.hasAudio === false);
                                    video.volume = 1;
                                    video.play().catch(() => { });
                                }
                            }, 50); // Small delay to ensure clean audio cut
                        } else {
                            // No significant gap - seamless transition
                            console.log('[Engine] Seamless transition to next clip at:', nextClip.startTime);
                            activeClipRef.current = nextClip;
                            if (nextClip.src) {
                                const currentSrc = video.currentSrc || video.src;
                                if (!isSameSource(currentSrc, nextClip.src)) {
                                    video.src = getProxiedUrl(nextClip.src);
                                }
                                video.currentTime = nextClip.sourceStart;
                                video.muted = shouldMuteVideo || (nextClip.hasAudio === false);
                                video.volume = 1;
                                video.play().catch(() => { });
                            }
                            setCurrentTime(nextClip.startTime);
                            onTimeUpdate(nextClip.startTime);
                        }
                    } else {
                        // No more clips - end of timeline
                        console.log('[Engine] No more clips - stopping playback');
                        setIsPlaying(false);
                        setCurrentTime(clip.endTime);
                        onTimeUpdate(clip.endTime);
                    }
                } else {
                    // Normal playback - update timeline position (only if video is playing)
                    if (!video.paused) {
                        setCurrentTime(timelineTime);
                        onTimeUpdate(timelineTime);
                    }
                }
            } else {
                // No active clip at current time - we're in a gap
                // Immediately mute and pause to stop audio
                video.muted = true;
                video.pause();

                // Find next clip to jump to
                const nextClip = videoClips
                    .filter(c => c.startTime > currentTime && (c.layer === 0 || c.layer === undefined))
                    .sort((a, b) => a.startTime - b.startTime)[0];

                if (nextClip) {
                    // Jump to next clip
                    activeClipRef.current = nextClip;
                    if (nextClip.src) {
                        const currentSrc = video.currentSrc || video.src;
                        if (!isSameSource(currentSrc, nextClip.src)) {
                            video.src = getProxiedUrl(nextClip.src);
                        }
                        video.currentTime = nextClip.sourceStart;
                        video.muted = shouldMuteVideo || (nextClip.hasAudio === false);
                        video.play().catch(() => { });
                    }
                    setCurrentTime(nextClip.startTime);
                    onTimeUpdate(nextClip.startTime);
                } else {
                    // No more clips - stop playback
                    setIsPlaying(false);
                }
            }
        };

        // Handle video ended
        const handleEnded = () => {
            const clip = activeClipRef.current;
            if (clip) {
                // Check for next clip (handle gaps)
                const nextClip = videoClips
                    .filter(c => c.startTime >= clip.endTime && (c.layer === 0 || c.layer === undefined))
                    .sort((a, b) => a.startTime - b.startTime)[0];

                if (nextClip) {
                    // Jump to next clip
                    activeClipRef.current = nextClip;
                    if (nextClip.src) {
                        video.src = getProxiedUrl(nextClip.src);
                        video.currentTime = nextClip.sourceStart;
                        video.play().catch(() => { });
                    }
                    setCurrentTime(nextClip.startTime);
                    onTimeUpdate(nextClip.startTime);
                } else {
                    setIsPlaying(false);
                }
            }
        };

        // Attach listeners
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('ended', handleEnded);
        };
    }, [videoRef, isScrubbing, videoClips, currentTime, onTimeUpdate, findActiveClip, shouldMuteVideo]);

    // =========================================================
    // Mute state and volume sync
    // =========================================================
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Get current clip at current time for accurate hasAudio check
        const clip = findActiveClip(currentTime);

        // Mute if: globally muted OR current clip has no audio (was separated)
        const shouldMute = shouldMuteVideo || (clip?.hasAudio === false);
        video.muted = shouldMute;

        // Also set volume to 0 as backup when audio is separated (redundant safety)
        if (clip?.hasAudio === false) {
            video.volume = 0;
        } else {
            // Sync volume (0-2 range to 0-1 clamped)
            const clipVolume = clip?.volume ?? 1.0;
            video.volume = Math.min(1, Math.max(0, clipVolume));
        }
    }, [videoRef, shouldMuteVideo, currentTime, videoClips, findActiveClip]);

    // =========================================================
    // Play / Pause / Toggle
    // =========================================================
    const play = useCallback(() => {
        console.log('[Hybrid Engine] play() called, currentTime:', currentTime);

        // CRITICAL: Reset scrubbing state when play is called
        setIsScrubbing(false);
        isScrubbingRef.current = false;

        const video = videoRef.current;

        // Use video's actual position if available AND we have an active clip, otherwise use state
        let playFromTime = currentTime;
        if (video && activeClipRef.current) {
            playFromTime = videoTimeToTimelineTime(video.currentTime, activeClipRef.current);
        }

        // Find active clip at the play position
        const clip = findActiveClip(playFromTime) || findActiveClip(currentTime);
        activeClipRef.current = clip;

        if (video && clip?.src) {
            // Sync source if needed
            const currentSrc = video.currentSrc || video.src;
            const needsSourceSwitch = !currentSrc || !isSameSource(currentSrc, clip.src);

            if (needsSourceSwitch) {
                video.src = getProxiedUrl(clip.src);
                // Only seek if we changed source
                const targetVideoTime = timelineTimeToVideoTime(currentTime, clip);
                video.currentTime = Math.max(0, targetVideoTime);
            }
            // If same source, just resume from current position (no seek)

            // Set mute state
            const shouldMute = shouldMuteVideo || (clip.hasAudio === false);
            video.muted = shouldMute;

            // Start playing
            video.play()
                .then(() => {
                    setIsPlaying(true);
                })
                .catch(e => {
                    console.warn('[Hybrid Engine] Auto-play blocked:', e);
                    // Still set isPlaying true - timeupdate will handle sync
                    setIsPlaying(true);
                });
        } else {
            // No clip at current position - we're in a gap
            // Find next clip and jump to it
            const nextClip = videoClips
                .filter(c => c.startTime > currentTime && (c.layer === 0 || c.layer === undefined))
                .sort((a, b) => a.startTime - b.startTime)[0];

            if (nextClip && video) {
                activeClipRef.current = nextClip;
                if (nextClip.src) {
                    const currentSrc = video.currentSrc || video.src;
                    if (!isSameSource(currentSrc, nextClip.src)) {
                        video.src = getProxiedUrl(nextClip.src);
                    }
                    video.currentTime = nextClip.sourceStart;
                    video.muted = shouldMuteVideo || (nextClip.hasAudio === false);
                    video.play().catch(() => { });
                }
                setCurrentTime(nextClip.startTime);
                onTimeUpdate(nextClip.startTime);
                setIsPlaying(true);
            }
            // If no next clip, don't do anything (already at end)
        }
    }, [videoRef, videoClips, currentTime, shouldMuteVideo, findActiveClip, onTimeUpdate]);

    const pause = useCallback(() => {
        console.log('[Hybrid Engine] pause() called');
        const video = videoRef.current;

        // Sync currentTime to video's actual position before pausing
        // This prevents flicker from late timeupdate events
        if (video && activeClipRef.current) {
            const syncedTime = videoTimeToTimelineTime(video.currentTime, activeClipRef.current);
            setCurrentTime(syncedTime);
            onTimeUpdate(syncedTime);
        }

        setIsPlaying(false);
        video?.pause();
    }, [videoRef, onTimeUpdate]);

    const togglePlay = useCallback(() => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }, [isPlaying, play, pause]);

    // =========================================================
    // Scrubbing Mode Control
    // =========================================================
    const startScrub = useCallback(() => {
        console.log('[Hybrid Engine] startScrub() - wasPlaying:', isPlaying);
        wasPlayingBeforeScrub.current = isPlaying;
        setIsScrubbing(true);
        isScrubbingRef.current = true; // Sync ref for closure

        if (isPlaying) {
            videoRef.current?.pause();
            setIsPlaying(false);
        }
    }, [isPlaying, videoRef]);

    const endScrub = useCallback(() => {
        console.log('[Hybrid Engine] endScrub() - resuming:', wasPlayingBeforeScrub.current);
        setIsScrubbing(false);
        isScrubbingRef.current = false; // Sync ref for closure

        if (wasPlayingBeforeScrub.current) {
            // Small delay to ensure state is settled
            setTimeout(() => {
                play();
            }, 50);
        }
        wasPlayingBeforeScrub.current = false;
    }, [play]);

    // Throttle ref for seek during scrubbing
    const lastSeekTime = useRef<number>(0);
    const pendingSeek = useRef<number | null>(null);

    // =========================================================
    // Seek (used during scrubbing and click-to-seek)
    // =========================================================
    const seek = useCallback((time: number) => {
        // Set seeking flag to prevent timeUpdate conflicts
        isSeekingRef.current = true;

        // Update timeline state immediately for responsive UI
        setCurrentTime(time);
        onTimeUpdate(time);

        // Find clip at target time and update active clip ref
        const clip = findActiveClip(time);
        activeClipRef.current = clip;

        // Sync video to show frame
        const video = videoRef.current;
        if (video && clip) {
            // Sync source if needed
            if (clip.src) {
                const currentSrc = video.currentSrc || video.src;
                if (!isSameSource(currentSrc, clip.src)) {
                    video.src = getProxiedUrl(clip.src);
                }
            }

            // Seek video to show frame - use direct currentTime for reliable updates
            const targetVideoTime = timelineTimeToVideoTime(time, clip);
            video.currentTime = targetVideoTime;
        }

        // Reset seeking flag after a short delay to allow video to settle
        setTimeout(() => {
            isSeekingRef.current = false;
        }, 50);
    }, [videoClips, onTimeUpdate, videoRef, findActiveClip, isScrubbing]);

    // =========================================================
    // Preview Frame (for trim operations - doesn't move playhead)
    // =========================================================
    const previewFrame = useCallback((time: number) => {
        const video = videoRef.current;
        if (!video) return;

        // Find clip at this time
        const clip = findActiveClip(time);
        if (!clip) return;

        // Sync source if needed
        if (clip.src) {
            const currentSrc = video.currentSrc || video.src;
            if (!isSameSource(currentSrc, clip.src)) {
                video.src = getProxiedUrl(clip.src);
            }
        }

        // Update video frame only (no state update, no playhead move)
        const targetVideoTime = timelineTimeToVideoTime(time, clip);
        if ('fastSeek' in video && typeof video.fastSeek === 'function') {
            video.fastSeek(targetVideoTime);
        } else {
            video.currentTime = targetVideoTime;
        }
    }, [videoRef, findActiveClip]);

    return {
        isPlaying,
        isScrubbing,
        currentTime,
        play,
        pause,
        togglePlay,
        seek,
        startScrub,
        endScrub,
        previewFrame
    };
}
