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
            // Skip if scrubbing (timeline is master during scrub)
            if (isScrubbing) return;

            // Skip if not playing
            if (!isPlaying) return;

            const videoTime = video.currentTime;
            const clip = activeClipRef.current;

            if (clip) {
                // Convert video time to timeline time
                const timelineTime = videoTimeToTimelineTime(videoTime, clip);

                // Check if we've reached the end of this clip
                if (timelineTime >= clip.endTime) {
                    // Find next clip
                    const nextClip = videoClips.find(c =>
                        Math.abs(c.startTime - clip.endTime) < 0.1 &&
                        (c.layer === 0 || c.layer === undefined)
                    );

                    if (nextClip) {
                        // Switch to next clip
                        activeClipRef.current = nextClip;
                        if (nextClip.src) {
                            const currentSrc = video.currentSrc || video.src;
                            if (!isSameSource(currentSrc, nextClip.src)) {
                                video.src = getProxiedUrl(nextClip.src);
                            }
                            video.currentTime = nextClip.sourceStart;
                            video.play().catch(() => { });
                        }
                        setCurrentTime(nextClip.startTime);
                        onTimeUpdate(nextClip.startTime);
                    } else {
                        // End of timeline
                        setIsPlaying(false);
                        setCurrentTime(clip.endTime);
                        onTimeUpdate(clip.endTime);
                    }
                } else {
                    // Normal playback - update timeline position
                    setCurrentTime(timelineTime);
                    onTimeUpdate(timelineTime);
                }
            } else {
                // No active clip - try to find one
                const foundClip = findActiveClip(currentTime);
                if (foundClip) {
                    activeClipRef.current = foundClip;
                }
            }
        };

        // Handle video ended
        const handleEnded = () => {
            const clip = activeClipRef.current;
            if (clip) {
                // Check for next clip
                const nextClip = videoClips.find(c =>
                    Math.abs(c.startTime - clip.endTime) < 0.1 &&
                    (c.layer === 0 || c.layer === undefined)
                );

                if (!nextClip) {
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
    }, [videoRef, isPlaying, isScrubbing, videoClips, currentTime, onTimeUpdate, findActiveClip]);

    // =========================================================
    // Mute state and volume sync
    // =========================================================
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const clip = activeClipRef.current;
        const shouldMute = shouldMuteVideo || (clip?.hasAudio === false);
        if (video.muted !== shouldMute) {
            video.muted = shouldMute;
        }

        // Sync volume (0-2 range to 0-1 clamped)
        const clipVolume = clip?.volume ?? 1.0;
        video.volume = Math.min(1, Math.max(0, clipVolume));
    }, [videoRef, shouldMuteVideo, currentTime, videoClips]);

    // =========================================================
    // Play / Pause / Toggle
    // =========================================================
    const play = useCallback(() => {
        console.log('[Hybrid Engine] play() called, currentTime:', currentTime);
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
            // No clip at current position - just set playing state
            // Timeline will advance for V2+ or audio-only clips
            setIsPlaying(true);
        }
    }, [videoRef, videoClips, currentTime, shouldMuteVideo, findActiveClip]);

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

        if (isPlaying) {
            videoRef.current?.pause();
            setIsPlaying(false);
        }
    }, [isPlaying, videoRef]);

    const endScrub = useCallback(() => {
        console.log('[Hybrid Engine] endScrub() - resuming:', wasPlayingBeforeScrub.current);
        setIsScrubbing(false);

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
        // Throttle seeks during scrubbing for smooth preview
        const now = performance.now();
        const THROTTLE_MS = 30; // ~33fps max seek rate

        if (isScrubbing && now - lastSeekTime.current < THROTTLE_MS) {
            // Store pending seek to ensure final position is accurate
            pendingSeek.current = time;
            return;
        }
        lastSeekTime.current = now;
        pendingSeek.current = null;

        // Update timeline state
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

            // Seek video to show frame - use fastSeek if available for smoother scrubbing
            const targetVideoTime = timelineTimeToVideoTime(time, clip);
            if ('fastSeek' in video && typeof video.fastSeek === 'function') {
                video.fastSeek(targetVideoTime);
            } else {
                video.currentTime = targetVideoTime;
            }
        }
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
